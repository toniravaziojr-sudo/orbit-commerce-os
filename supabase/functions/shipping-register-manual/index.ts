/**
 * shipping-register-manual
 * 
 * Registra remessa manual (código de rastreio inserido pelo lojista).
 * Usado quando a etiqueta foi comprada externamente (Frenet, Melhor Envio, etc).
 * Não chama API de transportadora, apenas salva no banco.
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterManualRequest {
  order_id: string;
  tracking_code: string;
  carrier: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get tenant
    const { data: profile } = await supabase
      .from('profiles')
      .select('current_tenant_id')
      .eq('id', user.id)
      .single();

    if (!profile?.current_tenant_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tenantId = profile.current_tenant_id;

    // Parse request
    const body: RegisterManualRequest = await req.json();
    const { order_id, tracking_code, carrier } = body;

    if (!order_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'order_id é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!tracking_code || !tracking_code.trim()) {
      return new Response(
        JSON.stringify({ success: false, error: 'tracking_code é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!carrier) {
      return new Response(
        JSON.stringify({ success: false, error: 'carrier é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[shipping-register-manual] Registering manual shipment for order ${order_id}`);

    // Verify order exists and belongs to tenant
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id, tenant_id, status, tracking_code')
      .eq('id', order_id)
      .eq('tenant_id', tenantId)
      .single();

    if (orderError || !order) {
      return new Response(
        JSON.stringify({ success: false, error: 'Pedido não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (order.tracking_code) {
      return new Response(
        JSON.stringify({ success: false, error: 'Este pedido já possui código de rastreio' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cleanTrackingCode = tracking_code.trim().toUpperCase();
    const cleanCarrier = carrier.toLowerCase();
    const now = new Date().toISOString();

    // Update order with tracking info
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_code: cleanTrackingCode,
        shipping_carrier: cleanCarrier,
        shipping_status: 'label_created',
        status: 'shipped',
        shipped_at: now,
        updated_at: now,
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('[shipping-register-manual] Error updating order:', updateError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao atualizar pedido' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create shipment record
    const { data: shipment, error: shipmentError } = await supabase
      .from('shipments')
      .insert({
        tenant_id: tenantId,
        order_id: order_id,
        carrier: cleanCarrier,
        tracking_code: cleanTrackingCode,
        delivery_status: 'label_created',
        source: 'manual',
        metadata: {
          registered_by: user.id,
          registered_at: now,
        },
        last_status_at: now,
        // Set next poll to now so tracking starts checking
        next_poll_at: now,
      })
      .select()
      .single();

    if (shipmentError) {
      console.error('[shipping-register-manual] Error creating shipment:', shipmentError);
      // Order was updated, so we don't fail completely
    }

    // Log event in order_history
    await supabase
      .from('order_history')
      .insert({
        order_id: order_id,
        event_type: 'shipment_manual_registered',
        description: `Remessa manual registrada: ${cleanTrackingCode} (${cleanCarrier})`,
        metadata: {
          tracking_code: cleanTrackingCode,
          carrier: cleanCarrier,
          source: 'manual',
          shipment_id: shipment?.id,
        },
        created_by: user.id,
      });

    console.log(`[shipping-register-manual] Manual shipment registered for order ${order_id}: ${cleanTrackingCode}`);

    return new Response(
      JSON.stringify({
        success: true,
        tracking_code: cleanTrackingCode,
        carrier: cleanCarrier,
        shipment_id: shipment?.id,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[shipping-register-manual] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Erro interno' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
