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
      tenant_id,
      customer_email,
      customer_phone,
      customer_name,
      region,
      total_estimated,
      items_snapshot,
      step,
    } = body;

    if (!session_id) {
      return new Response(JSON.stringify({ error: 'session_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[checkout-session-heartbeat] Heartbeat for session ${session_id}`);

    // Atualizar last_seen_at e dados do cliente
    const updateData: Record<string, unknown> = {
      last_seen_at: new Date().toISOString(),
    };

    // Atualizar campos opcionais se fornecidos
    if (customer_email) updateData.customer_email = customer_email;
    if (customer_phone) updateData.customer_phone = customer_phone;
    if (customer_name) updateData.customer_name = customer_name;
    if (region) updateData.region = region;
    if (total_estimated !== undefined) updateData.total_estimated = total_estimated;
    if (items_snapshot) updateData.items_snapshot = items_snapshot;
    if (step) updateData.metadata = { step };

    const { data, error } = await supabase
      .from('checkout_sessions')
      .update(updateData)
      .eq('id', session_id)
      .eq('tenant_id', tenant_id)
      .eq('status', 'active') // Só atualiza se ainda active
      .select('id, status')
      .single();

    if (error) {
      // Pode não existir ou já ter sido convertido/abandonado
      console.log(`[checkout-session-heartbeat] Session ${session_id} not found or not active`);
      return new Response(JSON.stringify({ 
        success: false, 
        session_id,
        reason: 'session_not_active',
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[checkout-session-heartbeat] Session ${session_id} heartbeat recorded`);

    return new Response(JSON.stringify({ 
      success: true, 
      session_id: data.id,
      status: data.status,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[checkout-session-heartbeat] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
