// Edge Function: checkout-session-end
// Marks checkout session as abandoned immediately when user exits the page

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.json();
    const { session_id, tenant_slug } = body;

    console.log('[checkout-session-end] Received:', { session_id, tenant_slug });

    if (!session_id) {
      return new Response(
        JSON.stringify({ error: 'session_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tenant_slug) {
      return new Response(
        JSON.stringify({ error: 'tenant_slug is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Resolve tenant by slug
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenant_slug)
      .maybeSingle();

    if (tenantError || !tenant) {
      console.error('[checkout-session-end] Tenant not found:', tenant_slug, tenantError);
      return new Response(
        JSON.stringify({ error: 'Tenant not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = tenant.id;

    // Find and update the session
    const { data: session, error: sessionError } = await supabase
      .from('checkout_sessions')
      .select('id, status, order_id')
      .eq('id', session_id)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (sessionError) {
      console.error('[checkout-session-end] Error finding session:', sessionError);
      return new Response(
        JSON.stringify({ error: 'Database error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!session) {
      console.log('[checkout-session-end] Session not found:', session_id);
      return new Response(
        JSON.stringify({ success: false, reason: 'session_not_found' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Only mark as abandoned if:
    // 1. Status is 'active'
    // 2. No order_id (not converted)
    if (session.status !== 'active') {
      console.log('[checkout-session-end] Session not active, skipping:', session.status);
      return new Response(
        JSON.stringify({ success: true, action: 'skipped', reason: 'not_active' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (session.order_id) {
      console.log('[checkout-session-end] Session has order_id, skipping');
      return new Response(
        JSON.stringify({ success: true, action: 'skipped', reason: 'has_order' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Mark as abandoned
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('checkout_sessions')
      .update({
        status: 'abandoned',
        abandoned_at: now,
        last_seen_at: now,
        updated_at: now,
      })
      .eq('id', session_id)
      .eq('tenant_id', tenantId);

    if (updateError) {
      console.error('[checkout-session-end] Error updating session:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update session' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[checkout-session-end] Session marked as abandoned:', session_id);

    // Emit checkout.abandoned event
    const idempotencyKey = `checkout_abandoned:${session_id}`;
    const { error: eventError } = await supabase
      .from('events_inbox')
      .upsert({
        tenant_id: tenantId,
        event_type: 'checkout.abandoned',
        idempotency_key: idempotencyKey,
        provider: 'internal',
        payload_normalized: {
          session_id: session_id,
          abandoned_at: now,
        },
        status: 'pending',
        occurred_at: now,
      }, {
        onConflict: 'idempotency_key',
        ignoreDuplicates: true,
      });

    if (eventError) {
      console.error('[checkout-session-end] Error emitting event:', eventError);
      // Don't fail the request, event emission is best-effort
    } else {
      console.log('[checkout-session-end] Event emitted:', idempotencyKey);
    }

    return new Response(
      JSON.stringify({ success: true, action: 'abandoned', session_id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[checkout-session-end] Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
