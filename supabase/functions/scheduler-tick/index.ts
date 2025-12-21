import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tempo de abandono em minutos (fallback para quando o evento pagehide não chega)
// Produção = 30 min
const ABANDON_THRESHOLD_MINUTES = 30;

// Security: Verify the request is from an authorized source
async function isAuthorizedRequest(req: Request): Promise<boolean> {
  // Check if this is a scheduled invocation (internal Supabase call)
  const isScheduledInvocation = req.headers.get('x-supabase-function-version') !== null;
  if (isScheduledInvocation) {
    console.log('[scheduler-tick] Authorized: Scheduled invocation');
    return true;
  }
  
  // For manual calls, verify service role or admin JWT
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    console.log('[scheduler-tick] Unauthorized: No authorization header');
    return false;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  // Allow service role key (for internal system calls)
  if (token === supabaseServiceKey) {
    console.log('[scheduler-tick] Authorized: Service role key');
    return true;
  }
  
  // Verify JWT and check for admin/owner role
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log('[scheduler-tick] Unauthorized: Invalid JWT');
      return false;
    }
    
    // Check if user has owner or admin role in any tenant
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['owner', 'admin'])
      .limit(1);
    
    if (roles && roles.length > 0) {
      console.log('[scheduler-tick] Authorized: Admin/Owner user');
      return true;
    }
    
    console.log('[scheduler-tick] Unauthorized: User lacks admin/owner role');
    return false;
  } catch (error) {
    console.error('[scheduler-tick] Authorization check failed:', error);
    return false;
  }
}

interface AbandonSweepStats {
  sessions_abandoned: number;
  events_emitted: number;
  errors: number;
}

interface CheckoutSession {
  id: string;
  tenant_id: string;
  customer_email: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  total_estimated: number | null;
  items_snapshot: unknown[];
  started_at: string;
}

// Detectar e marcar checkouts abandonados
async function runAbandonSweep(supabaseUrl: string, supabaseServiceKey: string): Promise<AbandonSweepStats> {
  const stats: AbandonSweepStats = {
    sessions_abandoned: 0,
    events_emitted: 0,
    errors: 0,
  };

  try {
    const thresholdTime = new Date(Date.now() - ABANDON_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    console.log(`[abandon-sweep] Looking for sessions started before ${thresholdTime}`);

    // Usar fetch direto para evitar problemas de tipagem com tabela nova
    const selectUrl = `${supabaseUrl}/rest/v1/checkout_sessions?status=eq.active&order_id=is.null&started_at=lte.${encodeURIComponent(thresholdTime)}&limit=100&select=id,tenant_id,customer_email,customer_phone,customer_name,total_estimated,items_snapshot,started_at`;
    
    const fetchResponse = await fetch(selectUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'apikey': supabaseServiceKey,
      },
    });

    if (!fetchResponse.ok) {
      const errorText = await fetchResponse.text();
      console.error('[abandon-sweep] Error fetching sessions:', errorText);
      stats.errors++;
      return stats;
    }

    const activeSessions: CheckoutSession[] = await fetchResponse.json();

    if (!activeSessions || activeSessions.length === 0) {
      console.log('[abandon-sweep] No sessions to abandon');
      return stats;
    }

    console.log(`[abandon-sweep] Found ${activeSessions.length} sessions to abandon`);

    const now = new Date().toISOString();

    for (const session of activeSessions) {
      try {
        // Marcar como abandonado via REST
        const updateUrl = `${supabaseUrl}/rest/v1/checkout_sessions?id=eq.${session.id}&status=eq.active`;
        const updateResponse = await fetch(updateUrl, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'apikey': supabaseServiceKey,
            'Prefer': 'return=minimal',
          },
          body: JSON.stringify({
            status: 'abandoned',
            abandoned_at: now,
          }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error(`[abandon-sweep] Error updating session ${session.id}:`, errorText);
          stats.errors++;
          continue;
        }

        stats.sessions_abandoned++;

        // Emitir evento checkout.abandoned (idempotente) via REST
        try {
          const idempotencyKey = `checkout.abandoned:${session.id}`;
          const eventUrl = `${supabaseUrl}/rest/v1/events_inbox`;
          await fetch(eventUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'apikey': supabaseServiceKey,
              'Prefer': 'return=minimal',
            },
            body: JSON.stringify({
              tenant_id: session.tenant_id,
              event_type: 'checkout.abandoned',
              idempotency_key: idempotencyKey,
              provider: 'internal',
              payload_raw: { session_id: session.id },
              payload_normalized: {
                session_id: session.id,
                customer_email: session.customer_email,
                customer_phone: session.customer_phone,
                customer_name: session.customer_name,
                total_estimated: session.total_estimated,
                items_count: Array.isArray(session.items_snapshot) ? session.items_snapshot.length : 0,
                started_at: session.started_at,
                abandoned_at: now,
              },
              status: 'pending',
            }),
          });
          stats.events_emitted++;
          console.log(`[abandon-sweep] Session ${session.id} abandoned, event emitted`);
        } catch (eventError) {
          // Ignorar erro de duplicidade (evento já existia)
          console.log(`[abandon-sweep] Event for session ${session.id} already exists or error:`, eventError);
        }
      } catch (sessionError) {
        console.error(`[abandon-sweep] Error processing session ${session.id}:`, sessionError);
        stats.errors++;
      }
    }

    console.log(`[abandon-sweep] Completed: ${stats.sessions_abandoned} abandoned, ${stats.events_emitted} events`);
    return stats;

  } catch (error) {
    console.error('[abandon-sweep] Fatal error:', error);
    stats.errors++;
    return stats;
  }
}

interface ReconcilePaymentsStats {
  checked: number;
  updated: number;
  unchanged: number;
  errors: number;
}

interface TickStats {
  tick_at: string;
  pass: number;
  process_events: {
    processed: number;
    ignored: number;
    errors: number;
    notifications_created: number;
  };
  run_notifications: {
    claimed: number;
    sent: number;
    retrying: number;
    failed: number;
    errors: number;
  };
  abandon_sweep: AbandonSweepStats;
  reconcile_payments: ReconcilePaymentsStats;
}

interface AggregatedStats {
  tick_started_at: string;
  tick_finished_at: string;
  total_passes: number;
  totals: {
    events_processed: number;
    events_ignored: number;
    notifications_created: number;
    notifications_sent: number;
    notifications_retrying: number;
    notifications_failed: number;
    sessions_abandoned: number;
    payments_reconciled: number;
  };
  passes: TickStats[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Security check: Only allow authorized requests
  const authorized = await isAuthorizedRequest(req);
  if (!authorized) {
    console.log('[scheduler-tick] Request rejected: Unauthorized');
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const tickStartedAt = new Date().toISOString();
  console.log(`[scheduler-tick] Starting tick at ${tickStartedAt}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Parse optional parameters
    let body: { passes?: number; process_limit?: number; run_limit?: number } = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON, use defaults
    }

    const passes = body.passes ?? 2; // Default 2 passes per tick (for 1-min cron = ~30s effective)
    const processLimit = body.process_limit ?? 50;
    const runLimit = body.run_limit ?? 50;

    const allPassStats: TickStats[] = [];
    const aggregatedTotals = {
      events_processed: 0,
      events_ignored: 0,
      notifications_created: 0,
      notifications_sent: 0,
      notifications_retrying: 0,
      notifications_failed: 0,
      sessions_abandoned: 0,
      payments_reconciled: 0,
    };

    for (let pass = 1; pass <= passes; pass++) {
      console.log(`[scheduler-tick] Pass ${pass}/${passes}`);
      
      const passStats: TickStats = {
        tick_at: new Date().toISOString(),
        pass,
        process_events: {
          processed: 0,
          ignored: 0,
          errors: 0,
          notifications_created: 0,
        },
        run_notifications: {
          claimed: 0,
          sent: 0,
          retrying: 0,
          failed: 0,
          errors: 0,
        },
        abandon_sweep: {
          sessions_abandoned: 0,
          events_emitted: 0,
          errors: 0,
        },
        reconcile_payments: {
          checked: 0,
          updated: 0,
          unchanged: 0,
          errors: 0,
        },
      };

      // --- Step 1: Abandon Sweep (check for abandoned checkouts) ---
      try {
        console.log(`[scheduler-tick] Running abandon sweep...`);
        passStats.abandon_sweep = await runAbandonSweep(supabaseUrl, supabaseServiceKey);
        aggregatedTotals.sessions_abandoned += passStats.abandon_sweep.sessions_abandoned;
      } catch (error) {
        console.error(`[scheduler-tick] abandon-sweep exception:`, error);
        passStats.abandon_sweep.errors = 1;
      }

      // --- Step 2: Call process-events ---
      try {
        console.log(`[scheduler-tick] Calling process-events with limit=${processLimit}`);
        const processResponse = await fetch(`${supabaseUrl}/functions/v1/process-events`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ limit: processLimit }),
        });

        if (processResponse.ok) {
          const processResult = await processResponse.json();
          console.log(`[scheduler-tick] process-events result:`, processResult);
          
          passStats.process_events.processed = processResult.processed_count ?? 0;
          passStats.process_events.ignored = processResult.ignored_count ?? 0;
          passStats.process_events.notifications_created = processResult.notifications_created ?? 0;
          
          aggregatedTotals.events_processed += passStats.process_events.processed;
          aggregatedTotals.events_ignored += passStats.process_events.ignored;
          aggregatedTotals.notifications_created += passStats.process_events.notifications_created;
        } else {
          const errorText = await processResponse.text();
          console.error(`[scheduler-tick] process-events error: ${processResponse.status} - ${errorText}`);
          passStats.process_events.errors = 1;
        }
      } catch (error) {
        console.error(`[scheduler-tick] process-events exception:`, error);
        passStats.process_events.errors = 1;
      }

      // --- Step 3: Call run-notifications ---
      try {
        console.log(`[scheduler-tick] Calling run-notifications with limit=${runLimit}`);
        const runResponse = await fetch(`${supabaseUrl}/functions/v1/run-notifications`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ limit: runLimit }),
        });

        if (runResponse.ok) {
          const runResult = await runResponse.json();
          console.log(`[scheduler-tick] run-notifications result:`, runResult);
          
          passStats.run_notifications.claimed = runResult.claimed_count ?? 0;
          passStats.run_notifications.sent = runResult.processed_success ?? 0;
          passStats.run_notifications.retrying = runResult.scheduled_retries ?? 0;
          passStats.run_notifications.failed = runResult.failed_final ?? 0;
          
          aggregatedTotals.notifications_sent += passStats.run_notifications.sent;
          aggregatedTotals.notifications_retrying += passStats.run_notifications.retrying;
          aggregatedTotals.notifications_failed += passStats.run_notifications.failed;
        } else {
          const errorText = await runResponse.text();
          console.error(`[scheduler-tick] run-notifications error: ${runResponse.status} - ${errorText}`);
          passStats.run_notifications.errors = 1;
        }
      } catch (error) {
        console.error(`[scheduler-tick] run-notifications exception:`, error);
        passStats.run_notifications.errors = 1;
      }

      // --- Step 4: Call reconcile-payments (only on first pass to avoid hammering) ---
      if (pass === 1) {
        try {
          console.log(`[scheduler-tick] Calling reconcile-payments...`);
          const reconcileResponse = await fetch(`${supabaseUrl}/functions/v1/reconcile-payments`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ limit: 20 }),
          });

          if (reconcileResponse.ok) {
            const reconcileResult = await reconcileResponse.json();
            console.log(`[scheduler-tick] reconcile-payments result:`, reconcileResult);
            
            passStats.reconcile_payments.checked = reconcileResult.stats?.checked ?? 0;
            passStats.reconcile_payments.updated = reconcileResult.stats?.updated ?? 0;
            passStats.reconcile_payments.unchanged = reconcileResult.stats?.unchanged ?? 0;
            passStats.reconcile_payments.errors = reconcileResult.stats?.errors ?? 0;
            
            aggregatedTotals.payments_reconciled += passStats.reconcile_payments.updated;
          } else {
            const errorText = await reconcileResponse.text();
            console.error(`[scheduler-tick] reconcile-payments error: ${reconcileResponse.status} - ${errorText}`);
            passStats.reconcile_payments.errors = 1;
          }
        } catch (error) {
          console.error(`[scheduler-tick] reconcile-payments exception:`, error);
          passStats.reconcile_payments.errors = 1;
        }
      }

      allPassStats.push(passStats);

      // Small delay between passes to avoid hammering (only if more passes remain)
      if (pass < passes) {
        console.log(`[scheduler-tick] Waiting 25s before next pass...`);
        await new Promise(resolve => setTimeout(resolve, 25000)); // 25s delay = ~30s effective interval
      }
    }

    const tickFinishedAt = new Date().toISOString();
    
    const aggregatedStats: AggregatedStats = {
      tick_started_at: tickStartedAt,
      tick_finished_at: tickFinishedAt,
      total_passes: passes,
      totals: aggregatedTotals,
      passes: allPassStats,
    };

    console.log(`[scheduler-tick] Tick completed:`, JSON.stringify(aggregatedStats, null, 2));

    return new Response(JSON.stringify(aggregatedStats), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[scheduler-tick] Fatal error:', error);
    return new Response(JSON.stringify({ 
      error: errorMessage,
      tick_started_at: tickStartedAt,
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
