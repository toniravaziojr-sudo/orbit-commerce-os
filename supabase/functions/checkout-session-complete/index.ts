// ============================================
// CHECKOUT SESSION COMPLETE - Marks session as converted/recovered
// Resolves tenant by slug (secure, server-side)
// ============================================

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

    const body = await req.json();
    const { 
      session_id, 
      tenant_slug,
      tenant_id: legacyTenantId, 
      order_id, 
      customer_email, 
      customer_phone 
    } = body;

    if (!order_id) {
      return new Response(JSON.stringify({ error: 'order_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve tenant_id from slug (secure) or use legacy tenant_id
    let tenantId = legacyTenantId;
    
    if (tenant_slug) {
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenant_slug)
        .single();

      if (tenantError || !tenant) {
        console.error('[checkout-session-complete] Tenant not found for slug:', tenant_slug);
        return new Response(JSON.stringify({ error: 'Tenant not found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      tenantId = tenant.id;
    }

    if (!tenantId) {
      return new Response(JSON.stringify({ error: 'tenant_slug or tenant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[checkout-session-complete] Completing session for order ${order_id}`);

    const now = new Date().toISOString();
    let sessionFound = false;
    let wasAbandoned = false;
    let matchedSessionId: string | null = null;

    // Tentar encontrar por session_id primeiro
    if (session_id) {
      const { data: session } = await supabase
        .from('checkout_sessions')
        .select('id, status')
        .eq('id', session_id)
        .eq('tenant_id', tenantId)
        .single();

      if (session) {
        sessionFound = true;
        matchedSessionId = session.id;
        wasAbandoned = session.status === 'abandoned';

        const newStatus = wasAbandoned ? 'recovered' : 'converted';
        const updateData: Record<string, unknown> = {
          status: newStatus,
          order_id,
          converted_at: now,
        };
        if (wasAbandoned) {
          updateData.recovered_at = now;
        }

        await supabase
          .from('checkout_sessions')
          .update(updateData)
          .eq('id', session_id);

        console.log(`[checkout-session-complete] Session ${session_id} marked as ${newStatus}`);
      }
    }

    // Fallback: buscar por email/phone se session_id não encontrado
    if (!sessionFound && (customer_email || customer_phone)) {
      let query = supabase
        .from('checkout_sessions')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .in('status', ['active', 'abandoned'])
        .is('order_id', null)
        .order('started_at', { ascending: false })
        .limit(1);

      if (customer_email) {
        query = query.eq('customer_email', customer_email.toLowerCase().trim());
      } else if (customer_phone) {
        query = query.eq('customer_phone', customer_phone.replace(/\D/g, ''));
      }

      const { data: sessions } = await query;

      if (sessions && sessions.length > 0) {
        const session = sessions[0];
        sessionFound = true;
        matchedSessionId = session.id;
        wasAbandoned = session.status === 'abandoned';

        const newStatus = wasAbandoned ? 'recovered' : 'converted';
        const updateData: Record<string, unknown> = {
          status: newStatus,
          order_id,
          converted_at: now,
        };
        if (wasAbandoned) {
          updateData.recovered_at = now;
        }

        await supabase
          .from('checkout_sessions')
          .update(updateData)
          .eq('id', session.id);

        console.log(`[checkout-session-complete] Session ${session.id} (by email/phone) marked as ${newStatus}`);
      }
    }

    // Emitir evento checkout.completed
    if (sessionFound && matchedSessionId) {
      try {
        const idempotencyKey = `checkout.completed:${order_id}`;
        await supabase
          .from('events_inbox')
          .insert({
            tenant_id: tenantId,
            event_type: 'checkout.completed',
            idempotency_key: idempotencyKey,
            provider: 'internal',
            payload_raw: { session_id: matchedSessionId, order_id },
            payload_normalized: { 
              session_id: matchedSessionId, 
              order_id,
              was_recovered: wasAbandoned,
            },
            status: 'pending',
          });
        console.log(`[checkout-session-complete] Event checkout.completed emitted`);
      } catch (eventError) {
        // Ignorar erro de duplicidade
        console.log(`[checkout-session-complete] Event already exists or error:`, eventError);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      session_found: sessionFound,
      session_id: matchedSessionId,
      was_recovered: wasAbandoned,
      order_id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[checkout-session-complete] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
