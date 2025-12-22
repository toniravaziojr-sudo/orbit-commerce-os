// =============================================
// SHIPMENT INGEST - Ingestão de rastreio do Bling ou manual
// Endpoint seguro para receber tracking_code e atualizar/criar shipment
// =============================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Mapeamento de status externos para status interno
const STATUS_MAP: Record<string, string> = {
  // Bling / Correios / Loggi statuses
  'etiqueta_gerada': 'label_created',
  'label_created': 'label_created',
  'postado': 'posted',
  'posted': 'posted',
  'coletado': 'posted',
  'em_transito': 'in_transit',
  'in_transit': 'in_transit',
  'saiu_para_entrega': 'out_for_delivery',
  'out_for_delivery': 'out_for_delivery',
  'entregue': 'delivered',
  'delivered': 'delivered',
  'falha_entrega': 'failed',
  'failed': 'failed',
  'devolvido': 'returned',
  'returned': 'returned',
  'cancelado': 'canceled',
  'canceled': 'canceled',
};

function normalizeStatus(externalStatus: string): string {
  const normalized = STATUS_MAP[externalStatus.toLowerCase().trim()];
  return normalized || 'unknown';
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log("[shipment-ingest] Received payload:", JSON.stringify(body));

    const {
      order_id,
      order_number,
      tenant_id,
      tracking_code,
      carrier,
      status,
      source = 'manual',
      source_id,
      metadata = {},
    } = body;

    // Validação básica
    if (!tracking_code || !carrier) {
      return new Response(
        JSON.stringify({ success: false, error: "tracking_code e carrier são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!order_id && !order_number) {
      return new Response(
        JSON.stringify({ success: false, error: "order_id ou order_number é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar pedido
    let orderQuery = supabase.from('orders').select('id, tenant_id, order_number');
    
    if (order_id) {
      orderQuery = orderQuery.eq('id', order_id);
    } else {
      orderQuery = orderQuery.eq('order_number', order_number);
    }

    if (tenant_id) {
      orderQuery = orderQuery.eq('tenant_id', tenant_id);
    }

    const { data: order, error: orderError } = await orderQuery.single();

    if (orderError || !order) {
      console.error("[shipment-ingest] Order not found:", orderError);
      return new Response(
        JSON.stringify({ success: false, error: "Pedido não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const resolvedTenantId = order.tenant_id;
    const resolvedOrderId = order.id;
    const deliveryStatus = normalizeStatus(status || 'label_created');

    console.log(`[shipment-ingest] Processing shipment for order ${order.order_number}, tracking: ${tracking_code}`);

    // Verificar se já existe remessa com mesmo order_id + tracking_code (idempotência)
    const { data: existingShipment } = await supabase
      .from('shipments')
      .select('id, delivery_status, last_status_at')
      .eq('order_id', resolvedOrderId)
      .eq('tracking_code', tracking_code)
      .single();

    let shipmentId: string;
    let isNew = false;

    if (existingShipment) {
      // Atualizar apenas se o status mudou
      if (existingShipment.delivery_status !== deliveryStatus) {
        const { error: updateError } = await supabase
          .from('shipments')
          .update({
            delivery_status: deliveryStatus,
            last_status_at: new Date().toISOString(),
            carrier,
            metadata,
            ...(deliveryStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
          })
          .eq('id', existingShipment.id);

        if (updateError) {
          console.error("[shipment-ingest] Error updating shipment:", updateError);
          throw updateError;
        }

        console.log(`[shipment-ingest] Updated shipment ${existingShipment.id} to status ${deliveryStatus}`);
      } else {
        console.log(`[shipment-ingest] Shipment ${existingShipment.id} already has status ${deliveryStatus}, skipping`);
      }

      shipmentId = existingShipment.id;
    } else {
      // Criar nova remessa
      const { data: newShipment, error: insertError } = await supabase
        .from('shipments')
        .insert({
          tenant_id: resolvedTenantId,
          order_id: resolvedOrderId,
          carrier,
          tracking_code,
          delivery_status: deliveryStatus,
          last_status_at: new Date().toISOString(),
          source,
          source_id,
          metadata,
          ...(deliveryStatus === 'delivered' ? { delivered_at: new Date().toISOString() } : {}),
        })
        .select('id')
        .single();

      if (insertError) {
        console.error("[shipment-ingest] Error creating shipment:", insertError);
        throw insertError;
      }

      shipmentId = newShipment.id;
      isNew = true;

      console.log(`[shipment-ingest] Created new shipment ${shipmentId} for order ${order.order_number}`);
    }

    // Registrar evento de rastreio
    const { error: eventError } = await supabase
      .from('shipment_events')
      .insert({
        tenant_id: resolvedTenantId,
        shipment_id: shipmentId,
        status: deliveryStatus,
        description: `Status atualizado: ${deliveryStatus}`,
        occurred_at: new Date().toISOString(),
        raw_payload: body,
      });

    if (eventError) {
      console.error("[shipment-ingest] Error creating shipment event:", eventError);
      // Não falhar por causa de erro no evento
    }

    // Atualizar também o pedido principal (para manter compatibilidade)
    const orderUpdate: Record<string, any> = {
      tracking_code,
      shipping_carrier: carrier,
    };

    // Mapear delivery_status para shipping_status do pedido
    const shippingStatusMap: Record<string, string> = {
      'label_created': 'processing',
      'posted': 'shipped',
      'in_transit': 'in_transit',
      'out_for_delivery': 'out_for_delivery',
      'delivered': 'delivered',
      'failed': 'failed',
      'returned': 'returned',
    };

    const newShippingStatus = shippingStatusMap[deliveryStatus];
    if (newShippingStatus) {
      orderUpdate.shipping_status = newShippingStatus;
    }

    if (deliveryStatus === 'posted' || deliveryStatus === 'in_transit') {
      orderUpdate.shipped_at = new Date().toISOString();
    }

    if (deliveryStatus === 'delivered') {
      orderUpdate.delivered_at = new Date().toISOString();
    }

    const { error: orderUpdateError } = await supabase
      .from('orders')
      .update(orderUpdate)
      .eq('id', resolvedOrderId);

    if (orderUpdateError) {
      console.error("[shipment-ingest] Error updating order:", orderUpdateError);
      // Não falhar por causa de erro na atualização do pedido
    }

    // Registrar histórico no pedido
    await supabase.from('order_history').insert({
      order_id: resolvedOrderId,
      action: isNew ? 'shipment_created' : 'shipment_updated',
      description: `Rastreio ${tracking_code} (${carrier}): ${deliveryStatus}`,
      new_value: { tracking_code, carrier, delivery_status: deliveryStatus },
    });

    return new Response(
      JSON.stringify({
        success: true,
        shipment_id: shipmentId,
        is_new: isNew,
        delivery_status: deliveryStatus,
        order_number: order.order_number,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error("[shipment-ingest] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});