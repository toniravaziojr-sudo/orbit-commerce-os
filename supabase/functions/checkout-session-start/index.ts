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
      cart_id,
      customer_id,
      customer_email,
      customer_phone,
      customer_name,
      region,
      total_estimated,
      items_snapshot,
      utm,
      metadata,
    } = body;

    // Validação obrigatória
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

    console.log(`[checkout-session-start] Starting session ${session_id} for tenant ${tenant_id}`);

    // Verificar se sessão já existe
    const { data: existing } = await supabase
      .from('checkout_sessions')
      .select('id, status')
      .eq('id', session_id)
      .eq('tenant_id', tenant_id)
      .single();

    if (existing) {
      // Se já existe, atualizar last_seen_at e dados do cliente
      const updateData: Record<string, unknown> = {
        last_seen_at: new Date().toISOString(),
      };

      // Atualizar campos opcionais se fornecidos
      if (customer_email) updateData.customer_email = customer_email;
      if (customer_phone) updateData.customer_phone = customer_phone;
      if (customer_name) updateData.customer_name = customer_name;
      if (customer_id) updateData.customer_id = customer_id;
      if (region) updateData.region = region;
      if (total_estimated !== undefined) updateData.total_estimated = total_estimated;
      if (items_snapshot) updateData.items_snapshot = items_snapshot;

      const { error: updateError } = await supabase
        .from('checkout_sessions')
        .update(updateData)
        .eq('id', session_id);

      if (updateError) {
        console.error('[checkout-session-start] Update error:', updateError);
        throw updateError;
      }

      console.log(`[checkout-session-start] Session ${session_id} updated`);
      return new Response(JSON.stringify({ 
        success: true, 
        session_id, 
        action: 'updated',
        status: existing.status,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Criar nova sessão
    const { data: newSession, error: insertError } = await supabase
      .from('checkout_sessions')
      .insert({
        id: session_id,
        tenant_id,
        cart_id,
        customer_id,
        customer_email,
        customer_phone,
        customer_name,
        region,
        total_estimated,
        items_snapshot: items_snapshot || [],
        utm: utm || {},
        metadata: metadata || {},
        status: 'active',
        started_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('[checkout-session-start] Insert error:', insertError);
      throw insertError;
    }

    console.log(`[checkout-session-start] Session ${session_id} created`);

    return new Response(JSON.stringify({ 
      success: true, 
      session_id: newSession.id,
      action: 'created',
      status: 'active',
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[checkout-session-start] Error:', error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
