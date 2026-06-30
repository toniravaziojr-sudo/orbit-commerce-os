/**
 * shipping-register-manual
 * 
 * Registra remessa manual (código de rastreio inserido pelo lojista).
 * Usado quando a etiqueta foi comprada externamente (Frenet, Melhor Envio, etc).
 * Não chama API de transportadora, apenas salva no banco.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RegisterManualRequest {
  order_id: string;
  tracking_code: string;
  carrier: string;
}

Deno.serve(async (req) => {
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
      .select('id, tenant_id, status, tracking_code, shipping_service_name, shipping_service_code')
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
    // Normaliza carrier: "PAC"/"Sedex" são serviços dos Correios, não transportadoras
    let cleanCarrier = carrier.trim();
    let derivedService: string | null = null;
    let derivedServiceCode: string | null = null;
    const lc = cleanCarrier.toLowerCase();
    if (lc === 'pac' || lc === 'sedex') {
      derivedService = lc === 'pac' ? 'PAC' : 'Sedex';
      derivedServiceCode = lc === 'pac' ? '03298' : '03220';
      cleanCarrier = 'Correios';
    }
    const now = new Date().toISOString();

    // Update order with tracking info
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        tracking_code: cleanTrackingCode,
        shipping_carrier: cleanCarrier,
        shipping_service_name: order.shipping_service_name || derivedService,
        shipping_service_code: order.shipping_service_code || derivedServiceCode,
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

    // Resolver Pedido de Venda canônico (raiz, sem source_order_invoice_id)
    // para amarrar a remessa ao PV — regra: 1 PV = 1 objeto ativo.
    let resolvedPvId: string | null = null;
    try {
      const { data: pv } = await supabase
        .from('fiscal_invoices')
        .select('id')
        .eq('order_id', order_id)
        .eq('fiscal_stage', 'pedido_venda')
        .is('source_order_invoice_id', null)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      resolvedPvId = pv?.id ?? null;
    } catch (e) {
      console.warn('[shipping-register-manual] PV resolve fallback (sem PV):', e);
    }

    // Adotar rascunho existente do mesmo PV (ou do mesmo pedido) em vez de
    // criar nova linha. Anti-regressão: duplicação logística (incidente #658).
    let existingShipment: { id: string } | null = null;
    if (resolvedPvId) {
      const { data } = await supabase
        .from('shipments')
        .select('id')
        .eq('source_pedido_venda_id', resolvedPvId)
        .or('tracking_code.is.null,tracking_code.eq.')
        .not('delivery_status', 'in', '("canceled","returned","failed")')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      existingShipment = data ?? null;
    }
    if (!existingShipment) {
      const { data } = await supabase
        .from('shipments')
        .select('id')
        .eq('order_id', order_id)
        .or('tracking_code.is.null,tracking_code.eq.')
        .not('delivery_status', 'in', '("canceled","returned","failed")')
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      existingShipment = data ?? null;
    }

    let shipment: { id: string } | null = null;
    let shipmentError: unknown = null;

    if (existingShipment) {
      const { data: updated, error: updErr } = await supabase
        .from('shipments')
        .update({
          tenant_id: tenantId,
          order_id: order_id,
          source_pedido_venda_id: resolvedPvId ?? undefined,
          carrier: cleanCarrier,
          service_name: order.shipping_service_name || derivedService,
          service_code: order.shipping_service_code || derivedServiceCode,
          tracking_code: cleanTrackingCode,
          delivery_status: 'label_created',
          source: 'manual',
          manually_adjusted: true,
          last_status_at: now,
          next_poll_at: now,
          updated_at: now,
        })
        .eq('id', existingShipment.id)
        .select('id')
        .single();
      shipment = updated ?? null;
      shipmentError = updErr;
      console.log(`[shipping-register-manual] Adopted draft ${existingShipment.id} (PV=${resolvedPvId})`);
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from('shipments')
        .insert({
          tenant_id: tenantId,
          order_id: order_id,
          source_pedido_venda_id: resolvedPvId,
          carrier: cleanCarrier,
          service_name: order.shipping_service_name || derivedService,
          service_code: order.shipping_service_code || derivedServiceCode,
          tracking_code: cleanTrackingCode,
          delivery_status: 'label_created',
          source: 'manual',
          metadata: { registered_by: user.id, registered_at: now },
          last_status_at: now,
          next_poll_at: now,
        })
        .select('id')
        .single();
      shipment = inserted ?? null;
      shipmentError = insErr;
    }

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

    // WMS Pratika — envio combinado (NF + rastreio juntos), fire-and-forget.
    try {
      fetch(`${supabaseUrl}/functions/v1/wms-pratika-send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          action: 'send_combined',
          order_id: order_id,
          tenant_id: tenantId,
        }),
      }).catch(err => console.error('[shipping-register-manual] WMS Pratika error:', err));
    } catch (e) {
      console.error('[shipping-register-manual] Erro Pratika:', e);
    }

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

  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'shipping', action: 'register-manual' });
  }
});
