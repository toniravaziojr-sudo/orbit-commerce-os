import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.4.1"; // monitor-chargebacks runs every 12h (00:00 and 12:00 UTC)
// v2.4.0 - Add monitor-chargebacks to parallel phase
// v2.3.0 - Shipping draft queue: creates draft shipments from approved orders
// v2.2.0 - Added fiscal-auto-create-drafts as parallel fallback

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Tempo de abandono em minutos baseado em INATIVIDADE (last_seen_at)
const ABANDON_THRESHOLD_MINUTES = parseInt(Deno.env.get('CHECKOUT_ABANDON_MINUTES') || '30', 10);

// Security: Verify the request is from an authorized source
async function isAuthorizedRequest(req: Request): Promise<boolean> {
  const isScheduledInvocation = req.headers.get('x-supabase-function-version') !== null;
  if (isScheduledInvocation) {
    console.log('[scheduler-tick] Authorized: Scheduled invocation');
    return true;
  }
  
  const authHeader = req.headers.get('authorization');
  if (!authHeader) {
    console.log('[scheduler-tick] Unauthorized: No authorization header');
    return false;
  }
  
  const token = authHeader.replace('Bearer ', '');
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') 
    || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') 
    || '';
  
  if (token === supabaseServiceKey) {
    console.log('[scheduler-tick] Authorized: Service role key');
    return true;
  }
  
  if (supabaseAnonKey && token === supabaseAnonKey) {
    console.log('[scheduler-tick] Authorized: Anon key (pg_cron scheduled call)');
    return true;
  }
  
  const expectedAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qc3NlemZqaGR2dm5jc3F5aHlxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1ODcyMDksImV4cCI6MjA4MTE2MzIwOX0.xijqzFrwy221qrnnwU2PAH7Kk6Qm2AlfXhbk6uEVAVg';
  if (token === expectedAnonKey) {
    console.log('[scheduler-tick] Authorized: Matched known anon key from pg_cron');
    return true;
  }
  
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log('[scheduler-tick] Unauthorized: Invalid JWT');
      return false;
    }
    
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
  last_seen_at: string | null;
  contact_captured_at: string | null;
}

// Detectar e marcar checkouts abandonados baseado em INATIVIDADE (last_seen_at)
async function runAbandonSweep(supabaseUrl: string, supabaseServiceKey: string): Promise<AbandonSweepStats> {
  const stats: AbandonSweepStats = {
    sessions_abandoned: 0,
    events_emitted: 0,
    errors: 0,
  };

  try {
    const thresholdTime = new Date(Date.now() - ABANDON_THRESHOLD_MINUTES * 60 * 1000).toISOString();
    console.log(`[abandon-sweep] Threshold: ${ABANDON_THRESHOLD_MINUTES} min. Looking for sessions inactive before ${thresholdTime}`);

    const selectUrl = `${supabaseUrl}/rest/v1/checkout_sessions?status=eq.active&order_id=is.null&contact_captured_at=not.is.null&limit=100&select=id,tenant_id,customer_email,customer_phone,customer_name,total_estimated,items_snapshot,started_at,last_seen_at,contact_captured_at`;
    
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
      console.log('[abandon-sweep] No active sessions with contact captured');
      return stats;
    }

    console.log(`[abandon-sweep] Found ${activeSessions.length} active sessions to evaluate`);

    const now = new Date();
    const thresholdMs = ABANDON_THRESHOLD_MINUTES * 60 * 1000;

    const sessionsToAbandon = activeSessions.filter(session => {
      const lastActivity = session.last_seen_at || session.contact_captured_at || session.started_at;
      const lastActivityTime = new Date(lastActivity).getTime();
      const inactiveMs = now.getTime() - lastActivityTime;
      const shouldAbandon = inactiveMs >= thresholdMs;
      
      console.log(`[abandon-sweep] Session ${session.id}: last_activity=${lastActivity}, inactive=${Math.round(inactiveMs/1000/60)}min, abandon=${shouldAbandon}`);
      
      return shouldAbandon;
    });

    if (sessionsToAbandon.length === 0) {
      console.log('[abandon-sweep] No sessions exceeded inactivity threshold');
      return stats;
    }

    console.log(`[abandon-sweep] ${sessionsToAbandon.length} sessions to mark as abandoned`);

    for (const session of sessionsToAbandon) {
      try {
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
            internal_state: 'inactive',
          }),
        });

        if (!updateResponse.ok) {
          const errorText = await updateResponse.text();
          console.error(`[abandon-sweep] Error updating session ${session.id}:`, errorText);
          stats.errors++;
          continue;
        }

        stats.sessions_abandoned++;

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
              status: 'new',
            }),
          });
          stats.events_emitted++;
          console.log(`[abandon-sweep] Session ${session.id} abandoned, event emitted`);

          // Add contact to "Clientes Potenciais" list (pre-provisioned by default)
          if (session.customer_email) {
            try {
              const supabase = createClient(supabaseUrl, supabaseServiceKey);

              // Find the pre-provisioned "Clientes Potenciais" list
              const { data: list } = await supabase
                .from('email_marketing_lists')
                .select('id')
                .eq('tenant_id', session.tenant_id)
                .eq('name', 'Clientes Potenciais')
                .maybeSingle();

              await supabase.rpc('upsert_subscriber_only', {
                p_tenant_id: session.tenant_id,
                p_email: session.customer_email,
                p_name: session.customer_name || null,
                p_phone: session.customer_phone || null,
                p_source: 'abandoned_checkout',
                p_list_id: list?.id || null,
              });

              console.log(`[abandon-sweep] Contact ${session.customer_email} added to "Clientes Potenciais" list`);
            } catch (subscriberError) {
              console.warn(`[abandon-sweep] Failed to add contact to "Clientes Potenciais":`, subscriberError);
            }
          }
        } catch (eventError) {
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

interface TrackingPollStats {
  polled: number;
  updated: number;
  errors_count: number;
}

interface ScheduledEmailsStats {
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
}

interface CreativePollStats {
  resumed: number;
  errors: number;
}

interface EmailListSyncStats {
  lists_synced: number;
  subscribers_synced: number;
  skipped_not_due: boolean;
  errors: number;
}

interface MonitorChargebacksStats {
  approved_checked: number;
  disputed_checked: number;
  chargebacks_detected: number;
  chargebacks_recovered: number;
  chargebacks_lost: number;
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
  tracking_poll: TrackingPollStats;
  scheduled_emails: ScheduledEmailsStats;
    creative_poll: CreativePollStats;
    email_list_sync: EmailListSyncStats;
    monitor_chargebacks: MonitorChargebacksStats;
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
    shipments_polled: number;
    shipments_updated: number;
      scheduled_emails_sent: number;
      email_lists_synced: number;
      email_subscribers_synced: number;
      chargebacks_detected: number;
      chargebacks_recovered: number;
      chargebacks_lost: number;
    };
    passes: TickStats[];
}

// Helper: call a sub-function and return typed result
async function callSubFunction(
  supabaseUrl: string,
  supabaseServiceKey: string,
  functionName: string,
  body: Record<string, unknown> = {}
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(body),
    });

    if (response.ok) {
      const data = await response.json();
      return { ok: true, data };
    } else {
      const errorText = await response.text();
      return { ok: false, error: `${response.status} - ${errorText}` };
    }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? "Erro interno. Se o problema persistir, entre em contato com o suporte." : String(error) };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[scheduler-tick][${VERSION}] Request received`);

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
    
    let body: { passes?: number; process_limit?: number; run_limit?: number } = {};
    try {
      body = await req.json();
    } catch {
      // No body or invalid JSON, use defaults
    }

    const passes = body.passes ?? 2;
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
      shipments_polled: 0,
      shipments_updated: 0,
      scheduled_emails_sent: 0,
      email_lists_synced: 0,
      email_subscribers_synced: 0,
      fiscal_drafts_created: 0,
      shipping_drafts_created: 0,
      chargebacks_detected: 0,
      chargebacks_recovered: 0,
      chargebacks_lost: 0,
    };

    for (let pass = 1; pass <= passes; pass++) {
      console.log(`[scheduler-tick] Pass ${pass}/${passes}`);
      
      const passStats: TickStats = {
        tick_at: new Date().toISOString(),
        pass,
        process_events: { processed: 0, ignored: 0, errors: 0, notifications_created: 0 },
        run_notifications: { claimed: 0, sent: 0, retrying: 0, failed: 0, errors: 0 },
        abandon_sweep: { sessions_abandoned: 0, events_emitted: 0, errors: 0 },
        reconcile_payments: { checked: 0, updated: 0, unchanged: 0, errors: 0 },
        tracking_poll: { polled: 0, updated: 0, errors_count: 0 },
        scheduled_emails: { processed: 0, sent: 0, failed: 0, skipped: 0 },
        creative_poll: { resumed: 0, errors: 0 },
        email_list_sync: { lists_synced: 0, subscribers_synced: 0, skipped_not_due: false, errors: 0 },
        monitor_chargebacks: { approved_checked: 0, disputed_checked: 0, chargebacks_detected: 0, chargebacks_recovered: 0, chargebacks_lost: 0, errors: 0 },
      };

      // ====================================================================
      // PHASE 1: Sequential pipeline (order matters)
      // abandon-sweep → process-events → run-notifications
      // ====================================================================

      // --- Step 1: Abandon Sweep ---
      try {
        console.log(`[scheduler-tick] Running abandon sweep...`);
        passStats.abandon_sweep = await runAbandonSweep(supabaseUrl, supabaseServiceKey);
        aggregatedTotals.sessions_abandoned += passStats.abandon_sweep.sessions_abandoned;
      } catch (error) {
        console.error(`[scheduler-tick] abandon-sweep exception:`, error);
        passStats.abandon_sweep.errors = 1;
      }

      // --- Step 2: Process Events ---
      try {
        console.log(`[scheduler-tick] Calling process-events with limit=${processLimit}`);
        const result = await callSubFunction(supabaseUrl, supabaseServiceKey, 'process-events', { limit: processLimit });
        
        if (result.ok) {
          console.log(`[scheduler-tick] process-events result:`, result.data);
          passStats.process_events.processed = result.data.processed_count ?? 0;
          passStats.process_events.ignored = result.data.ignored_count ?? 0;
          passStats.process_events.notifications_created = result.data.notifications_created ?? 0;
          aggregatedTotals.events_processed += passStats.process_events.processed;
          aggregatedTotals.events_ignored += passStats.process_events.ignored;
          aggregatedTotals.notifications_created += passStats.process_events.notifications_created;
        } else {
          console.error(`[scheduler-tick] process-events error: ${result.error}`);
          passStats.process_events.errors = 1;
        }
      } catch (error) {
        console.error(`[scheduler-tick] process-events exception:`, error);
        passStats.process_events.errors = 1;
      }

      // --- Step 3: Run Notifications ---
      try {
        console.log(`[scheduler-tick] Calling run-notifications with limit=${runLimit}`);
        const result = await callSubFunction(supabaseUrl, supabaseServiceKey, 'run-notifications', { limit: runLimit });
        
        if (result.ok) {
          console.log(`[scheduler-tick] run-notifications result:`, result.data);
          passStats.run_notifications.claimed = result.data.claimed_count ?? 0;
          passStats.run_notifications.sent = result.data.processed_success ?? 0;
          passStats.run_notifications.retrying = result.data.scheduled_retries ?? 0;
          passStats.run_notifications.failed = result.data.failed_final ?? 0;
          aggregatedTotals.notifications_sent += passStats.run_notifications.sent;
          aggregatedTotals.notifications_retrying += passStats.run_notifications.retrying;
          aggregatedTotals.notifications_failed += passStats.run_notifications.failed;
        } else {
          console.error(`[scheduler-tick] run-notifications error: ${result.error}`);
          passStats.run_notifications.errors = 1;
        }
      } catch (error) {
        console.error(`[scheduler-tick] run-notifications exception:`, error);
        passStats.run_notifications.errors = 1;
      }

      // ====================================================================
      // PHASE 1.5: Process fiscal_draft_queue (reliable queue → Edge Function)
      // Runs every pass to minimize latency
      // ====================================================================
      try {
        console.log(`[scheduler-tick] Processing fiscal draft queue...`);
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        
        // Fetch pending items (limit 10 per pass)
        const { data: queueItems, error: queueError } = await supabase
          .from('fiscal_draft_queue')
          .select('id, tenant_id, order_id, attempts')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(10);

        if (queueError) {
          console.error(`[scheduler-tick] fiscal queue fetch error:`, queueError);
        } else if (queueItems && queueItems.length > 0) {
          console.log(`[scheduler-tick] fiscal queue: ${queueItems.length} pending items`);
          
          for (const item of queueItems) {
            try {
              // Mark as processing
              await supabase
                .from('fiscal_draft_queue')
                .update({ status: 'processing', attempts: item.attempts + 1 })
                .eq('id', item.id);

              // Call the existing edge function in TRIGGER mode
              const result = await callSubFunction(supabaseUrl, supabaseServiceKey, 'fiscal-auto-create-drafts', {
                order_id: item.order_id,
                tenant_id: item.tenant_id,
              });

              if (result.ok) {
                await supabase
                  .from('fiscal_draft_queue')
                  .update({ status: 'done', processed_at: new Date().toISOString() })
                  .eq('id', item.id);
                aggregatedTotals.fiscal_drafts_created++;
                console.log(`[scheduler-tick] fiscal queue: order ${item.order_id} processed OK`);
              } else {
                const maxAttempts = 5;
                const newStatus = item.attempts + 1 >= maxAttempts ? 'failed' : 'pending';
                await supabase
                  .from('fiscal_draft_queue')
                  .update({
                    status: newStatus,
                    error_message: result.error?.substring(0, 500) || 'Unknown error',
                    processed_at: newStatus === 'failed' ? new Date().toISOString() : null,
                  })
                  .eq('id', item.id);
                console.error(`[scheduler-tick] fiscal queue: order ${item.order_id} failed (attempt ${item.attempts + 1}/${maxAttempts}): ${result.error}`);
              }
            } catch (itemError) {
              console.error(`[scheduler-tick] fiscal queue: error processing ${item.order_id}:`, itemError);
              await supabase
                .from('fiscal_draft_queue')
                .update({ status: 'pending', error_message: String(itemError).substring(0, 500) })
                .eq('id', item.id);
            }
          }
        } else {
          console.log(`[scheduler-tick] fiscal queue: no pending items`);
        }

        // Cleanup: remove done items older than 7 days
        const cleanupDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabase
          .from('fiscal_draft_queue')
          .delete()
          .eq('status', 'done')
          .lt('processed_at', cleanupDate);

      } catch (fiscalQueueError) {
        console.error(`[scheduler-tick] fiscal queue fatal error:`, fiscalQueueError);
      }

      // ====================================================================
      // PHASE 1.6: Process shipping_draft_queue (create draft shipments)
      // Creates shipment records with status 'draft' from approved orders
      // ====================================================================
      try {
        console.log(`[scheduler-tick] Processing shipping draft queue...`);
        const supabaseShipping = createClient(supabaseUrl, supabaseServiceKey);
        
        // Fetch pending items (limit 5 per pass)
        const { data: shippingItems, error: shippingQueueError } = await supabaseShipping
          .from('shipping_draft_queue')
          .select('id, tenant_id, order_id, provider, attempts')
          .eq('status', 'pending')
          .order('created_at', { ascending: true })
          .limit(5);

        if (shippingQueueError) {
          console.error(`[scheduler-tick] shipping queue fetch error:`, shippingQueueError);
        } else if (shippingItems && shippingItems.length > 0) {
          console.log(`[scheduler-tick] shipping queue: ${shippingItems.length} pending items`);
          
          for (const item of shippingItems) {
            try {
              // Mark as processing
              await supabaseShipping
                .from('shipping_draft_queue')
                .update({ status: 'processing', attempts: item.attempts + 1 })
                .eq('id', item.id);

              // Fetch order data
              const { data: order, error: orderError } = await supabaseShipping
                .from('orders')
                .select(`
                  id, tenant_id, total, shipping_street, shipping_number,
                  shipping_complement, shipping_neighborhood, shipping_city,
                  shipping_state, shipping_postal_code, shipping_carrier, shipping_method_name,
                  shipping_service_code, customer_name, customer_email, customer_phone
                `)
                .eq('id', item.order_id)
                .single();

              if (orderError || !order) {
                throw new Error(`Order not found: ${orderError?.message || 'null'}`);
              }

              // Fetch order items with product dimensions
              const { data: orderItems } = await supabaseShipping
                .from('order_items')
                .select('quantity, product_id, products(weight, height, width, depth)')
                .eq('order_id', item.order_id);

              // Calculate total weight and max dimensions
              let totalWeightGrams = 0;
              let maxHeight = 2, maxWidth = 11, maxLength = 16; // Correios minimums
              
              if (orderItems) {
                for (const oi of orderItems) {
                  const product = (oi as any).products;
                  if (product) {
                    totalWeightGrams += (product.weight || 300) * (oi.quantity || 1); // weight already in grams
                    maxHeight = Math.max(maxHeight, product.height || 2);
                    maxWidth = Math.max(maxWidth, product.width || 11);
                    maxLength = Math.max(maxLength, product.depth || 16);
                  } else {
                    totalWeightGrams += 300 * (oi.quantity || 1); // fallback 300g
                  }
                }
              }

              // Check if shipment already exists for this order
              const { data: existingShipment } = await supabaseShipping
                .from('shipments')
                .select('id')
                .eq('order_id', item.order_id)
                .limit(1);

              if (existingShipment && existingShipment.length > 0) {
                console.log(`[scheduler-tick] shipping queue: shipment already exists for order ${item.order_id}, skipping`);
                await supabaseShipping
                  .from('shipping_draft_queue')
                  .update({ status: 'done', processed_at: new Date().toISOString() })
                  .eq('id', item.id);
                continue;
              }

              // Create draft shipment — propagar carrier + service_name + service_code (3 campos obrigatórios)
              const { error: insertError } = await supabaseShipping
                .from('shipments')
                .insert({
                  tenant_id: item.tenant_id,
                  order_id: item.order_id,
                  carrier: order.shipping_carrier || item.provider || 'manual',
                  tracking_code: '',
                  delivery_status: 'draft' as any,
                  last_status_at: new Date().toISOString(),
                  service_name: order.shipping_service_name || null,
                  service_code: order.shipping_service_code || null,
                  source: 'auto_draft',
                  metadata: {
                    weight_grams: totalWeightGrams,
                    height_cm: maxHeight,
                    width_cm: maxWidth,
                    length_cm: maxLength,
                    shipping_method: order.shipping_method_name,
                    recipient_name: order.customer_name,
                    recipient_zip: order.shipping_postal_code,
                    declared_value_cents: order.total,
                  },
                });

              if (insertError) {
                throw new Error(`Insert shipment failed: ${insertError.message}`);
              }

              await supabaseShipping
                .from('shipping_draft_queue')
                .update({ status: 'done', processed_at: new Date().toISOString() })
                .eq('id', item.id);
              
              aggregatedTotals.shipping_drafts_created++;
              console.log(`[scheduler-tick] shipping queue: draft created for order ${item.order_id} (${item.provider})`);

            } catch (itemError) {
              const maxAttempts = 5;
              const newStatus = item.attempts + 1 >= maxAttempts ? 'failed' : 'pending';
              await supabaseShipping
                .from('shipping_draft_queue')
                .update({
                  status: newStatus,
                  error_message: String(itemError).substring(0, 500),
                  processed_at: newStatus === 'failed' ? new Date().toISOString() : null,
                })
                .eq('id', item.id);
              console.error(`[scheduler-tick] shipping queue: error processing ${item.order_id}:`, itemError);
            }
          }
        } else {
          console.log(`[scheduler-tick] shipping queue: no pending items`);
        }

        // Cleanup: remove done items older than 7 days
        const shippingCleanupDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        await supabaseShipping
          .from('shipping_draft_queue')
          .delete()
          .eq('status', 'done')
          .lt('processed_at', shippingCleanupDate);

      } catch (shippingQueueError) {
        console.error(`[scheduler-tick] shipping queue fatal error:`, shippingQueueError);
      }

      // ====================================================================
      // PHASE 2: Parallel dispatcher (independent tasks, only pass 1)
      // reconcile-payments, tracking-poll, process-scheduled-emails,
      // creative-process, media-social-publish-worker,
      // email-marketing-list-sync (hourly)
      // ALL run concurrently via Promise.allSettled
      // ====================================================================
      if (pass === 1) {
        // Hourly gate: only run email list sync if current minute is 0 (top of hour)
        const currentMinute = new Date().getMinutes();
        const shouldRunEmailListSync = currentMinute < 2; // 0 or 1 to account for timing drift

        const parallelTasks: Promise<{ ok: boolean; data?: any; error?: string }>[] = [
          // Task A: reconcile-payments
          callSubFunction(supabaseUrl, supabaseServiceKey, 'reconcile-payments', { limit: 20 }),
          // Task B: tracking-poll
          callSubFunction(supabaseUrl, supabaseServiceKey, 'tracking-poll', {}),
          // Task C: process-scheduled-emails
          callSubFunction(supabaseUrl, supabaseServiceKey, 'process-scheduled-emails', {}),
          // Task D: creative-process (poll_running)
          callSubFunction(supabaseUrl, supabaseServiceKey, 'creative-process', { poll_running: true }),
          // Task E: media-social-publish-worker
          callSubFunction(supabaseUrl, supabaseServiceKey, 'media-social-publish-worker', {}),
          // Task F: verify-payment-status (progressive gateway polling)
          callSubFunction(supabaseUrl, supabaseServiceKey, 'verify-payment-status', {}),
        ];

        // Task F: email-marketing-list-sync (hourly only)
        if (shouldRunEmailListSync) {
          console.log(`[scheduler-tick] Hourly email list sync is DUE (minute=${currentMinute})`);
          parallelTasks.push(
            callSubFunction(supabaseUrl, supabaseServiceKey, 'email-marketing-list-sync', {})
          );
        } else {
          console.log(`[scheduler-tick] Email list sync skipped (minute=${currentMinute}, next at :00)`);
          passStats.email_list_sync.skipped_not_due = true;
        }

        // Task G: fiscal-auto-create-drafts (CRON mode fallback — reconciliation)
        parallelTasks.push(
          callSubFunction(supabaseUrl, supabaseServiceKey, 'fiscal-auto-create-drafts', {})
        );

        // Task H: monitor-chargebacks (every 12 hours — at 00:00 and 12:00)
        const currentHour = new Date().getUTCHours();
        const shouldRunChargebackMonitor = (currentHour === 0 || currentHour === 12) && currentMinute < 2;
        if (shouldRunChargebackMonitor) {
          console.log(`[scheduler-tick] Chargeback monitor is DUE (hour=${currentHour}, minute=${currentMinute})`);
          parallelTasks.push(
            callSubFunction(supabaseUrl, supabaseServiceKey, 'monitor-chargebacks', {})
          );
        } else {
          console.log(`[scheduler-tick] Chargeback monitor skipped (hour=${currentHour}, next at 00:00 or 12:00 UTC)`);
        }

        console.log(`[scheduler-tick] Starting parallel phase (${parallelTasks.length} tasks)...`);
        const parallelStart = Date.now();

        const results = await Promise.allSettled(parallelTasks);
        const [reconcileResult, trackingResult, emailsResult, creativeResult, socialPublishResult] = results.slice(0, 5);
        // verify-payment-status is at index 5 (results logged but no stat tracking needed)
        const emailListSyncResult = shouldRunEmailListSync ? results[6] : undefined;
        const fiscalDraftsResultIndex = shouldRunEmailListSync ? 7 : 6;
        const fiscalDraftsResult = results[fiscalDraftsResultIndex];
        // monitor-chargebacks is the last item only when it ran
        const monitorChargebacksResult = shouldRunChargebackMonitor ? results[results.length - 1] : undefined;

        const parallelDuration = Date.now() - parallelStart;
        console.log(`[scheduler-tick] Parallel phase completed in ${parallelDuration}ms`);

        // Process reconcile-payments result
        if (reconcileResult.status === 'fulfilled' && reconcileResult.value.ok) {
          const data = reconcileResult.value.data;
          console.log(`[scheduler-tick] reconcile-payments result:`, data);
          passStats.reconcile_payments.checked = data.stats?.checked ?? 0;
          passStats.reconcile_payments.updated = data.stats?.updated ?? 0;
          passStats.reconcile_payments.unchanged = data.stats?.unchanged ?? 0;
          passStats.reconcile_payments.errors = data.stats?.errors ?? 0;
          aggregatedTotals.payments_reconciled += passStats.reconcile_payments.updated;
        } else {
          const error = reconcileResult.status === 'rejected' ? reconcileResult.reason : reconcileResult.value.error;
          console.error(`[scheduler-tick] reconcile-payments error:`, error);
          passStats.reconcile_payments.errors = 1;
        }

        // Process tracking-poll result
        if (trackingResult.status === 'fulfilled' && trackingResult.value.ok) {
          const data = trackingResult.value.data;
          console.log(`[scheduler-tick] tracking-poll result:`, data);
          passStats.tracking_poll.polled = data.shipments_checked ?? 0;
          passStats.tracking_poll.updated = data.shipments_updated ?? 0;
          passStats.tracking_poll.errors_count = data.errors ?? 0;
          aggregatedTotals.shipments_polled += passStats.tracking_poll.polled;
          aggregatedTotals.shipments_updated += passStats.tracking_poll.updated;
        } else {
          const error = trackingResult.status === 'rejected' ? trackingResult.reason : trackingResult.value.error;
          console.error(`[scheduler-tick] tracking-poll error:`, error);
          passStats.tracking_poll.errors_count = 1;
        }

        // Process scheduled-emails result
        if (emailsResult.status === 'fulfilled' && emailsResult.value.ok) {
          const data = emailsResult.value.data;
          console.log(`[scheduler-tick] process-scheduled-emails result:`, data);
          passStats.scheduled_emails.processed = data.stats?.processed ?? 0;
          passStats.scheduled_emails.sent = data.stats?.sent ?? 0;
          passStats.scheduled_emails.failed = data.stats?.failed ?? 0;
          passStats.scheduled_emails.skipped = data.stats?.skipped ?? 0;
          aggregatedTotals.scheduled_emails_sent += passStats.scheduled_emails.sent;
        } else {
          const error = emailsResult.status === 'rejected' ? emailsResult.reason : emailsResult.value.error;
          console.error(`[scheduler-tick] process-scheduled-emails error:`, error);
        }

        // Process creative-process result
        if (creativeResult.status === 'fulfilled' && creativeResult.value.ok) {
          const data = creativeResult.value.data;
          console.log(`[scheduler-tick] creative-process result:`, data);
          passStats.creative_poll.resumed = data.jobs?.length ?? 0;
        } else {
          const error = creativeResult.status === 'rejected' ? creativeResult.reason : creativeResult.value.error;
          console.error(`[scheduler-tick] creative-process error:`, error);
          passStats.creative_poll.errors = 1;
        }

        // Process media-social-publish-worker result
        if (socialPublishResult.status === 'fulfilled' && socialPublishResult.value.ok) {
          console.log(`[scheduler-tick] media-social-publish-worker result:`, socialPublishResult.value.data);
        } else {
          const error = socialPublishResult.status === 'rejected' ? socialPublishResult.reason : socialPublishResult.value.error;
          console.error(`[scheduler-tick] media-social-publish-worker error:`, error);
        }

        // Process fiscal-auto-create-drafts result
        if (fiscalDraftsResult && fiscalDraftsResult.status === 'fulfilled' && fiscalDraftsResult.value.ok) {
          const data = fiscalDraftsResult.value.data;
          console.log(`[scheduler-tick] fiscal-auto-create-drafts result:`, data);
          aggregatedTotals.fiscal_drafts_created += data.total_created ?? data.created ?? 0;
        } else if (fiscalDraftsResult) {
          const error = fiscalDraftsResult.status === 'rejected' ? fiscalDraftsResult.reason : fiscalDraftsResult.value?.error;
          console.error(`[scheduler-tick] fiscal-auto-create-drafts error:`, error);
        }

        // Process email-marketing-list-sync result (hourly)
        if (emailListSyncResult) {
          if (emailListSyncResult.status === 'fulfilled' && emailListSyncResult.value.ok) {
            const data = emailListSyncResult.value.data;
            console.log(`[scheduler-tick] email-marketing-list-sync result:`, data);
            passStats.email_list_sync.lists_synced = data.synced_lists ?? 0;
            passStats.email_list_sync.subscribers_synced = data.total_synced ?? 0;
            aggregatedTotals.email_lists_synced += passStats.email_list_sync.lists_synced;
            aggregatedTotals.email_subscribers_synced += passStats.email_list_sync.subscribers_synced;
          } else {
            const error = emailListSyncResult.status === 'rejected' ? emailListSyncResult.reason : emailListSyncResult.value.error;
            console.error(`[scheduler-tick] email-marketing-list-sync error:`, error);
            passStats.email_list_sync.errors = 1;
          }
        }

        // Process monitor-chargebacks result
        if (monitorChargebacksResult && monitorChargebacksResult.status === 'fulfilled' && monitorChargebacksResult.value.ok) {
          const data = monitorChargebacksResult.value.data;
          console.log(`[scheduler-tick] monitor-chargebacks result:`, data);
          passStats.monitor_chargebacks.approved_checked = data.approved_checked ?? 0;
          passStats.monitor_chargebacks.disputed_checked = data.disputed_checked ?? 0;
          passStats.monitor_chargebacks.chargebacks_detected = data.chargebacks_detected ?? 0;
          passStats.monitor_chargebacks.chargebacks_recovered = data.chargebacks_recovered ?? 0;
          passStats.monitor_chargebacks.chargebacks_lost = data.chargebacks_lost ?? 0;
          passStats.monitor_chargebacks.errors = data.errors ?? 0;
          aggregatedTotals.chargebacks_detected += data.chargebacks_detected ?? 0;
          aggregatedTotals.chargebacks_recovered += data.chargebacks_recovered ?? 0;
          aggregatedTotals.chargebacks_lost += data.chargebacks_lost ?? 0;
        } else if (monitorChargebacksResult) {
          const error = monitorChargebacksResult.status === 'rejected' ? monitorChargebacksResult.reason : monitorChargebacksResult.value?.error;
          console.error(`[scheduler-tick] monitor-chargebacks error:`, error);
          passStats.monitor_chargebacks.errors = 1;
        }
      }

      allPassStats.push(passStats);

      // Small delay between passes (only if more passes remain)
      if (pass < passes) {
        console.log(`[scheduler-tick] Waiting 25s before next pass...`);
        await new Promise(resolve => setTimeout(resolve, 25000));
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
