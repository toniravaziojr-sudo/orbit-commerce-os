import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ========== TYPES =========

type DeliveryStatus = 
  | 'label_created' 
  | 'posted' 
  | 'in_transit' 
  | 'out_for_delivery' 
  | 'delivered' 
  | 'failed' 
  | 'returned' 
  | 'canceled' 
  | 'unknown';

interface ShipmentRecord {
  id: string;
  tenant_id: string;
  order_id: string;
  carrier: string;
  tracking_code: string;
  delivery_status: DeliveryStatus;
  last_status_at: string;
  next_poll_at: string | null;
  poll_error_count: number;
}

interface TrackingEvent {
  status: DeliveryStatus;
  description: string;
  location?: string;
  occurred_at: string;
  provider_event_id?: string;
}

interface AdapterResult {
  success: boolean;
  events: TrackingEvent[];
  error?: string;
}

interface TenantCredentials {
  carrier: string;
  credentials: Record<string, unknown>;
  is_enabled: boolean;
}

// ========== CONSTANTS =========

const POLL_INTERVAL_MINUTES = parseInt(Deno.env.get('TRACKING_POLL_INTERVAL_MINUTES') || '30', 10);
const MAX_SHIPMENTS_PER_RUN = parseInt(Deno.env.get('TRACKING_MAX_PER_RUN') || '50', 10);
const MAX_ERROR_COUNT = 10;
const BACKOFF_MULTIPLIER = 2;

// Mapping shipping_status enum to delivery_status
const deliveryToShippingStatus: Record<DeliveryStatus, string> = {
  'label_created': 'pending',
  'posted': 'shipped',
  'in_transit': 'shipped',
  'out_for_delivery': 'shipped',
  'delivered': 'delivered',
  'failed': 'pending',
  'returned': 'pending',
  'canceled': 'pending',
  'unknown': 'pending',
};

// ========== ADAPTERS =========

// Correios Adapter (requires credentials)
async function fetchCorreiosEvents(
  trackingCode: string, 
  credentials: Record<string, unknown>
): Promise<AdapterResult> {
  try {
    const usuario = credentials.usuario as string;
    const senha = credentials.senha as string;
    const token = credentials.token as string;
    
    if (!usuario || !token) {
      return { success: false, events: [], error: 'missing_credentials' };
    }

    // Correios API Rastro v2
    const response = await fetch(
      `https://api.correios.com.br/srorastro/v1/objetos/${trackingCode}?resultado=T`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Correios] API error:', response.status, errorText);
      return { success: false, events: [], error: `api_error_${response.status}` };
    }

    const data = await response.json();
    const eventos = data.objetos?.[0]?.eventos || [];
    
    const events: TrackingEvent[] = eventos.map((e: Record<string, unknown>, idx: number) => ({
      provider_event_id: `correios_${trackingCode}_${idx}`,
      status: mapCorreiosStatus(e.codigo as string, e.tipo as string),
      description: e.descricao as string || 'Evento',
      location: formatCorreiosLocation(e.unidade as Record<string, unknown>),
      occurred_at: e.dtHrCriado as string || new Date().toISOString(),
    }));

    return { success: true, events };
  } catch (error) {
    console.error('[Correios] Fetch error:', error);
    return { success: false, events: [], error: 'fetch_error' };
  }
}

function mapCorreiosStatus(codigo: string, tipo: string): DeliveryStatus {
  // Mapping based on Correios status codes
  // https://www.correios.com.br/atendimento/developers/arquivos/manual-rastro-objetos
  if (codigo === 'BDE' && tipo === '01') return 'delivered'; // Entregue
  if (codigo === 'BDE' && tipo === '23') return 'delivered'; // Entregue
  if (codigo === 'OEC') return 'out_for_delivery'; // Saiu para entrega
  if (codigo === 'LDI' || codigo === 'RO') return 'in_transit'; // Em trânsito
  if (codigo === 'PAR' || codigo === 'PO') return 'posted'; // Postado
  if (codigo === 'BDR' || codigo === 'BDI') return 'failed'; // Tentativa de entrega falha
  if (codigo === 'BLQ') return 'failed'; // Bloqueado
  if (codigo === 'LDE') return 'returned'; // Devolvido
  return 'in_transit';
}

function formatCorreiosLocation(unidade: Record<string, unknown> | undefined): string {
  if (!unidade) return '';
  const cidade = unidade.cidade as string || '';
  const uf = unidade.uf as string || '';
  return [cidade, uf].filter(Boolean).join(' - ');
}

// Loggi Adapter (placeholder - requires API setup)
async function fetchLoggiEvents(
  trackingCode: string,
  credentials: Record<string, unknown>
): Promise<AdapterResult> {
  try {
    const companyId = credentials.company_id as string;
    const apiKey = credentials.api_key as string;

    if (!companyId || !apiKey) {
      return { success: false, events: [], error: 'missing_credentials' };
    }

    // Loggi API v1
    const response = await fetch(
      `https://api.loggi.com/v1/companies/${companyId}/packages/${trackingCode}/tracking`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Loggi] API error:', response.status, errorText);
      return { success: false, events: [], error: `api_error_${response.status}` };
    }

    const data = await response.json();
    const trackingList = data.tracking || [];
    
    const events: TrackingEvent[] = trackingList.map((e: Record<string, unknown>, idx: number) => ({
      provider_event_id: `loggi_${trackingCode}_${idx}`,
      status: mapLoggiStatus(e.status as string),
      description: e.description as string || 'Evento',
      location: e.location as string || '',
      occurred_at: e.timestamp as string || new Date().toISOString(),
    }));

    return { success: true, events };
  } catch (error) {
    console.error('[Loggi] Fetch error:', error);
    return { success: false, events: [], error: 'fetch_error' };
  }
}

function mapLoggiStatus(status: string): DeliveryStatus {
  const statusMap: Record<string, DeliveryStatus> = {
    'created': 'label_created',
    'picked_up': 'posted',
    'in_transit': 'in_transit',
    'out_for_delivery': 'out_for_delivery',
    'delivered': 'delivered',
    'failed': 'failed',
    'returned': 'returned',
    'cancelled': 'canceled',
  };
  return statusMap[status?.toLowerCase()] || 'unknown';
}

// Fallback adapter (no provider available)
function noProviderAdapter(carrier: string): AdapterResult {
  console.log(`[NoProvider] No adapter available for carrier: ${carrier}`);
  return { 
    success: true, 
    events: [],
    error: 'no_provider_adapter'
  };
}

// ========== MAIN LOGIC =========

async function getCredentialsForTenant(
  supabase: any,
  tenantId: string,
  carrier: string
): Promise<TenantCredentials | null> {
  const normalizedCarrier = carrier.toLowerCase().trim();
  
  const { data, error } = await supabase
    .from('tenant_shipping_integrations')
    .select('carrier, credentials, is_enabled')
    .eq('tenant_id', tenantId)
    .ilike('carrier', normalizedCarrier)
    .single();

  if (error || !data) {
    return null;
  }

  return data as TenantCredentials;
}

async function fetchTrackingEvents(
  carrier: string,
  trackingCode: string,
  credentials: Record<string, unknown> | null
): Promise<AdapterResult> {
  const normalizedCarrier = carrier.toLowerCase().trim();

  if (normalizedCarrier.includes('correios') || normalizedCarrier.includes('correio')) {
    if (!credentials) return noProviderAdapter(carrier);
    return fetchCorreiosEvents(trackingCode, credentials);
  }

  if (normalizedCarrier.includes('loggi')) {
    if (!credentials) return noProviderAdapter(carrier);
    return fetchLoggiEvents(trackingCode, credentials);
  }

  // Other carriers - no adapter yet
  return noProviderAdapter(carrier);
}

async function processShipment(
  supabase: any,
  shipment: ShipmentRecord,
  credentials: TenantCredentials | null
): Promise<{ updated: boolean; newStatus?: DeliveryStatus; error?: string }> {
  const { id, tenant_id, order_id, carrier, tracking_code, delivery_status } = shipment;
  
  const result = await fetchTrackingEvents(
    carrier, 
    tracking_code, 
    credentials?.credentials || null
  );

  if (!result.success) {
    // Increment error count and set backoff
    const newErrorCount = (shipment.poll_error_count || 0) + 1;
    const backoffMinutes = POLL_INTERVAL_MINUTES * Math.pow(BACKOFF_MULTIPLIER, Math.min(newErrorCount, 5));
    
    await supabase
      .from('shipments')
      .update({
        last_polled_at: new Date().toISOString(),
        next_poll_at: new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString(),
        poll_error_count: newErrorCount,
        last_poll_error: result.error || 'unknown_error',
      })
      .eq('id', id);

    return { updated: false, error: result.error };
  }

  if (result.events.length === 0) {
    // No new events, just update poll time
    await supabase
      .from('shipments')
      .update({
        last_polled_at: new Date().toISOString(),
        next_poll_at: new Date(Date.now() + POLL_INTERVAL_MINUTES * 60 * 1000).toISOString(),
        poll_error_count: 0,
        last_poll_error: result.error === 'no_provider_adapter' ? result.error : null,
      })
      .eq('id', id);

    return { updated: false };
  }

  // Insert new events (idempotent via unique constraint on provider_event_id)
  let lastEventStatus = delivery_status;
  let lastEventAt = shipment.last_status_at;

  for (const event of result.events) {
    const { error: insertError } = await supabase
      .from('shipment_events')
      .upsert({
        tenant_id,
        shipment_id: id,
        status: event.status,
        description: event.description,
        location: event.location || null,
        occurred_at: event.occurred_at,
        provider_event_id: event.provider_event_id || null,
      }, {
        onConflict: 'shipment_id,provider_event_id',
        ignoreDuplicates: true,
      });

    if (insertError) {
      console.error('[ProcessShipment] Insert event error:', insertError);
    }

    // Track the most recent event
    if (new Date(event.occurred_at) >= new Date(lastEventAt)) {
      lastEventStatus = event.status;
      lastEventAt = event.occurred_at;
    }
  }

  // Check if status actually changed
  const statusChanged = lastEventStatus !== delivery_status;

  // Update shipment
  const shipmentUpdate: Record<string, unknown> = {
    last_polled_at: new Date().toISOString(),
    next_poll_at: new Date(Date.now() + POLL_INTERVAL_MINUTES * 60 * 1000).toISOString(),
    poll_error_count: 0,
    last_poll_error: null,
    delivery_status: lastEventStatus,
    last_status_at: lastEventAt,
  };

  // Set delivered_at if status is delivered
  if (lastEventStatus === 'delivered') {
    shipmentUpdate.delivered_at = lastEventAt;
  }

  await supabase
    .from('shipments')
    .update(shipmentUpdate)
    .eq('id', id);

  // Update order shipping_status
  const shippingStatus = deliveryToShippingStatus[lastEventStatus] || 'pending';
  const orderUpdate: Record<string, unknown> = {
    shipping_status: shippingStatus,
  };
  
  if (lastEventStatus === 'delivered') {
    orderUpdate.delivered_at = lastEventAt;
  }

  await supabase
    .from('orders')
    .update(orderUpdate)
    .eq('id', order_id);

  // If status changed, emit canonical event for notifications
  if (statusChanged) {
    const idempotencyKey = `shipment_status_${id}_${delivery_status}_${lastEventStatus}`;
    
    const { error: eventError } = await supabase
      .from('events_inbox')
      .insert({
        tenant_id,
        provider: 'internal',
        event_type: 'shipment.status_changed',
        idempotency_key: idempotencyKey,
        occurred_at: lastEventAt,
        payload_normalized: {
          shipment_id: id,
          order_id,
          tracking_code,
          carrier,
          old_status: delivery_status,
          new_status: lastEventStatus,
          last_event: result.events[result.events.length - 1] || null,
        },
        status: 'pending',
      });

    if (eventError) {
      // Check if it's a duplicate (expected due to idempotency)
      if (!eventError.message?.includes('duplicate')) {
        console.error('[ProcessShipment] Emit event error:', eventError);
      }
    }
  }

  return { updated: statusChanged, newStatus: statusChanged ? lastEventStatus : undefined };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const stats = {
    total: 0,
    processed: 0,
    updated: 0,
    errors: 0,
    noAdapter: 0,
  };

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch active shipments due for polling
    // Active = not delivered, not returned, not canceled
    // Due = next_poll_at <= now() or null
    const now = new Date().toISOString();
    
    const { data: shipments, error: fetchError } = await supabase
      .from('shipments')
      .select('id, tenant_id, order_id, carrier, tracking_code, delivery_status, last_status_at, next_poll_at, poll_error_count')
      .not('delivery_status', 'in', '(\"delivered\",\"returned\",\"canceled\")')
      .not('tracking_code', 'is', null)
      .or(`next_poll_at.is.null,next_poll_at.lte.${now}`)
      .lt('poll_error_count', MAX_ERROR_COUNT)
      .order('next_poll_at', { ascending: true, nullsFirst: true })
      .limit(MAX_SHIPMENTS_PER_RUN);

    if (fetchError) {
      console.error('[TrackingPoll] Fetch shipments error:', fetchError);
      throw new Error('Failed to fetch shipments');
    }

    if (!shipments || shipments.length === 0) {
      console.log('[TrackingPoll] No shipments due for polling');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No shipments to poll',
        stats,
        duration_ms: Date.now() - startTime 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    stats.total = shipments.length;
    console.log(`[TrackingPoll] Processing ${shipments.length} shipments`);

    // Cache credentials per tenant+carrier
    const credentialsCache = new Map<string, TenantCredentials | null>();

    for (const shipment of shipments) {
      try {
        const cacheKey = `${shipment.tenant_id}_${shipment.carrier.toLowerCase()}`;
        
        if (!credentialsCache.has(cacheKey)) {
          const creds = await getCredentialsForTenant(supabase, shipment.tenant_id, shipment.carrier);
          credentialsCache.set(cacheKey, creds);
        }

        const credentials = credentialsCache.get(cacheKey) || null;
        const result = await processShipment(supabase, shipment as ShipmentRecord, credentials);

        stats.processed++;
        
        if (result.updated) {
          stats.updated++;
          console.log(`[TrackingPoll] Shipment ${shipment.id} updated: ${shipment.delivery_status} -> ${result.newStatus}`);
        }
        
        if (result.error) {
          if (result.error === 'no_provider_adapter') {
            stats.noAdapter++;
          } else {
            stats.errors++;
          }
        }
      } catch (error) {
        stats.errors++;
        console.error(`[TrackingPoll] Error processing shipment ${shipment.id}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[TrackingPoll] Completed in ${duration}ms:`, stats);

    return new Response(JSON.stringify({ 
      success: true, 
      stats,
      duration_ms: duration 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[TrackingPoll] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ 
      success: false, 
      error: errorMessage,
      stats,
      duration_ms: Date.now() - startTime 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
