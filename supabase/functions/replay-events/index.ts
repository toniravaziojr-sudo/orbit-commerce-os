import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header and verify user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { tenant_id, days = 3 } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[replay-events] Starting for tenant ${tenant_id}, last ${days} days`);

    // Check if user is admin/owner of tenant
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .in('role', ['owner', 'admin'])
      .maybeSingle();

    if (!userRole) {
      return new Response(
        JSON.stringify({ success: false, error: 'Forbidden: admin/owner role required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate window
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - Math.min(days, 3)); // Max 3 days
    
    const stats = {
      events_found: 0,
      events_reset: 0,
      events_already_processed: 0,
      errors: 0,
    };

    // Find events in the window that are processed/ignored
    // We'll reset them to 'pending' so process-events can re-evaluate
    const { data: events, error: eventsError } = await supabase
      .from('events_inbox')
      .select('id, event_type, status, payload_normalized')
      .eq('tenant_id', tenant_id)
      .gte('occurred_at', windowStart.toISOString())
      .in('status', ['processed', 'ignored'])
      .order('occurred_at', { ascending: true });

    if (eventsError) {
      console.error('[replay-events] Error fetching events:', eventsError);
      throw eventsError;
    }

    stats.events_found = events?.length || 0;
    console.log(`[replay-events] Found ${stats.events_found} events in window`);

    if (!events || events.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          stats,
          message: 'Nenhum evento encontrado nos últimos 3 dias' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // For each event, check if notifications were actually sent
    // If not, reset to pending
    for (const event of events) {
      // Check if there are any notifications linked to this event that were sent
      const { data: notifications } = await supabase
        .from('notifications')
        .select('id, status')
        .eq('event_id', event.id);

      const hasSentNotifications = notifications?.some(n => n.status === 'sent');
      
      if (hasSentNotifications) {
        // Already sent, skip
        stats.events_already_processed++;
        continue;
      }

      // Check if there are failed/retrying notifications
      const hasFailedNotifications = notifications?.some(n => 
        n.status === 'failed' || n.status === 'retrying'
      );

      if (hasFailedNotifications) {
        // Reset failed notifications to scheduled
        await supabase
          .from('notifications')
          .update({ 
            status: 'scheduled', 
            next_attempt_at: new Date().toISOString(),
            attempt_count: 0,
            last_error: null,
          })
          .eq('event_id', event.id)
          .in('status', ['failed', 'retrying']);

        stats.events_reset++;
        console.log(`[replay-events] Reset failed notifications for event ${event.id}`);
        continue;
      }

      // No notifications at all - reset event to pending for reprocessing
      if (!notifications || notifications.length === 0) {
        await supabase
          .from('events_inbox')
          .update({ 
            status: 'pending',
            processed_at: null,
            processing_error: null,
          })
          .eq('id', event.id);

        stats.events_reset++;
        console.log(`[replay-events] Reset event ${event.id} to pending`);
      } else {
        // Has scheduled notifications, just update them
        await supabase
          .from('notifications')
          .update({ 
            next_attempt_at: new Date().toISOString(),
          })
          .eq('event_id', event.id)
          .eq('status', 'scheduled');

        stats.events_reset++;
      }
    }

    console.log(`[replay-events] Complete. Stats:`, stats);

    return new Response(
      JSON.stringify({ 
        success: true, 
        stats,
        message: `${stats.events_reset} evento(s) reprocessado(s)`,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[replay-events] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
