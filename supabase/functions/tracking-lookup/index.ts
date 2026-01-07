import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackingEvent {
  id: string;
  status: string;
  description: string;
  location: string | null;
  occurred_at: string;
}

interface ShipmentResult {
  tracking_code: string;
  carrier: string;
  delivery_status: string;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
  order_number: string;
  events: TrackingEvent[];
}

interface LookupRequest {
  tenant_id: string;
  tracking_code?: string;
  customer_name?: string;
  customer_email?: string;
}

// Status labels for display
const STATUS_LABELS: Record<string, string> = {
  label_created: 'Etiqueta criada',
  posted: 'Postado',
  in_transit: 'Em trânsito',
  out_for_delivery: 'Saiu para entrega',
  delivered: 'Entregue',
  failed: 'Tentativa de entrega',
  returned: 'Devolvido',
  canceled: 'Cancelado',
  unknown: 'Aguardando atualização',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, serviceRoleKey);
    
    const body: LookupRequest = await req.json();
    const { tenant_id, tracking_code, customer_name, customer_email } = body;

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: 'tenant_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let shipments: ShipmentResult[] = [];

    // Mode 1: Lookup by tracking code
    if (tracking_code) {
      console.log(`[tracking-lookup] Looking up by tracking code: ${tracking_code}`);
      
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select(`
          id,
          tracking_code,
          carrier,
          delivery_status,
          estimated_delivery_at,
          delivered_at,
          order_id,
          orders!inner (
            order_number
          )
        `)
        .eq('tenant_id', tenant_id)
        .ilike('tracking_code', tracking_code.trim())
        .limit(1);

      if (shipmentError) {
        console.error('[tracking-lookup] Shipment query error:', shipmentError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar rastreio' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (shipmentData && shipmentData.length > 0) {
        const shipment = shipmentData[0] as any;
        
        // Get events for this shipment
        const { data: eventsData } = await supabase
          .from('shipment_events')
          .select('id, status, description, location, occurred_at')
          .eq('shipment_id', shipment.id)
          .order('occurred_at', { ascending: false });

        shipments.push({
          tracking_code: shipment.tracking_code,
          carrier: shipment.carrier,
          delivery_status: shipment.delivery_status,
          estimated_delivery_at: shipment.estimated_delivery_at,
          delivered_at: shipment.delivered_at,
          order_number: shipment.orders?.order_number || '',
          events: (eventsData || []).map((e: any) => ({
            id: e.id,
            status: e.status,
            description: e.description || STATUS_LABELS[e.status] || e.status,
            location: e.location,
            occurred_at: e.occurred_at,
          })),
        });
      }
    }
    // Mode 2: Lookup by customer name + email
    else if (customer_name && customer_email) {
      console.log(`[tracking-lookup] Looking up by customer: ${customer_email}`);
      
      // Find orders by customer email and name (case-insensitive)
      const { data: ordersData, error: ordersError } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          customer_name,
          customer_email
        `)
        .eq('tenant_id', tenant_id)
        .ilike('customer_email', customer_email.trim())
        .order('created_at', { ascending: false })
        .limit(10);

      if (ordersError) {
        console.error('[tracking-lookup] Orders query error:', ordersError);
        return new Response(
          JSON.stringify({ error: 'Erro ao buscar pedidos' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Filter by customer name (case-insensitive partial match)
      const normalizedName = customer_name.toLowerCase().trim();
      const matchingOrders = (ordersData || []).filter((o: any) => 
        o.customer_name?.toLowerCase().includes(normalizedName)
      );

      if (matchingOrders.length > 0) {
        const orderIds = matchingOrders.map((o: any) => o.id);
        
        // Get shipments for these orders
        const { data: shipmentsData } = await supabase
          .from('shipments')
          .select('id, tracking_code, carrier, delivery_status, estimated_delivery_at, delivered_at, order_id')
          .eq('tenant_id', tenant_id)
          .in('order_id', orderIds)
          .order('created_at', { ascending: false });

        for (const shipment of shipmentsData || []) {
          // Get events for each shipment
          const { data: eventsData } = await supabase
            .from('shipment_events')
            .select('id, status, description, location, occurred_at')
            .eq('shipment_id', shipment.id)
            .order('occurred_at', { ascending: false });

          const order = matchingOrders.find((o: any) => o.id === shipment.order_id);
          
          shipments.push({
            tracking_code: shipment.tracking_code,
            carrier: shipment.carrier,
            delivery_status: shipment.delivery_status,
            estimated_delivery_at: shipment.estimated_delivery_at,
            delivered_at: shipment.delivered_at,
            order_number: order?.order_number || '',
            events: (eventsData || []).map((e: any) => ({
              id: e.id,
              status: e.status,
              description: e.description || STATUS_LABELS[e.status] || e.status,
              location: e.location,
              occurred_at: e.occurred_at,
            })),
          });
        }
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Informe o código de rastreio OU nome e email' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[tracking-lookup] Found ${shipments.length} shipment(s)`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        shipments,
        status_labels: STATUS_LABELS,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[tracking-lookup] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
