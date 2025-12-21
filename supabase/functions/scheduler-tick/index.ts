import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
  };
  passes: TickStats[];
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const tickStartedAt = new Date().toISOString();
  console.log(`[scheduler-tick] Starting tick at ${tickStartedAt}`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
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
      };

      // --- Pass 1: Call process-events ---
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

      // --- Pass 2: Call run-notifications ---
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
