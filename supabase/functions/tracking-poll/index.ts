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

interface ShippingProviderRecord {
  provider: string;
  credentials: Record<string, unknown>;
  settings: Record<string, unknown>;
  is_enabled: boolean;
  supports_tracking?: boolean;
}

// ========== CONSTANTS =========

const POLL_INTERVAL_MINUTES = parseInt(Deno.env.get('TRACKING_POLL_INTERVAL_MINUTES') || '30', 10);
const MAX_SHIPMENTS_PER_RUN = parseInt(Deno.env.get('TRACKING_MAX_PER_RUN') || '50', 10);
const MAX_ERROR_COUNT = 10;
const BACKOFF_MULTIPLIER = 2;

// Correios API endpoints
const CORREIOS_AUTH_URL = 'https://api.correios.com.br/token/v1/autentica/cartaopostagem';
const CORREIOS_RASTRO_URL = 'https://api.correios.com.br/srorastro/v1/objetos';

// Mapping delivery_status to shipping_status enum (orders table)
// Orders uses: pending, processing, shipped, in_transit, out_for_delivery, delivered, returned, failed
const deliveryToShippingStatus: Record<DeliveryStatus, string> = {
  'label_created': 'processing',
  'posted': 'shipped',
  'in_transit': 'in_transit',
  'out_for_delivery': 'out_for_delivery',
  'delivered': 'delivered',
  'failed': 'failed',
  'returned': 'returned',
  'canceled': 'pending',
  'unknown': 'pending',
};

// ========== CORREIOS AUTH (Token ou OAuth2) =========

interface CorreiosToken {
  token: string;
  expiraEm: string;
}

// Token cache per tenant (in-memory, resets each invocation)
const tokenCache = new Map<string, { token: string; expiresAt: Date }>();

async function getCorreiosToken(
  credentials: Record<string, unknown>,
  tenantId: string
): Promise<string | null> {
  const authMode = credentials.auth_mode as string || 'oauth2';
  
  // Mode 1: Pre-generated token (CWS portal)
  if (authMode === 'token' || authMode === 'token_cws') {
    const preToken = credentials.token as string;
    if (preToken && preToken.length > 50) {
      console.log('[Correios] Using pre-generated token (CWS)');
      return preToken;
    }
    console.error('[Correios] Token mode selected but no valid token found');
    return null;
  }
  
  // Mode 2: OAuth2 (usuario/senha + cartão postagem)
  const usuario = credentials.usuario as string;
  const senha = credentials.senha as string;
  const cartaoPostagem = credentials.cartao_postagem as string;

  if (!usuario || !senha || !cartaoPostagem) {
    console.error('[Correios] Missing OAuth2 credentials (usuario, senha, cartao_postagem)');
    return null;
  }

  // Check cache
  const cached = tokenCache.get(tenantId);
  if (cached && cached.expiresAt > new Date()) {
    console.log('[Correios] Using cached token');
    return cached.token;
  }

  try {
    // Authenticate with cartão postagem
    const authString = btoa(`${usuario}:${senha}`);
    
    const response = await fetch(CORREIOS_AUTH_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${authString}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        numero: cartaoPostagem,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Correios] OAuth2 auth error:', response.status, errorText);
      return null;
    }

    const data: CorreiosToken = await response.json();
    
    // Cache token (expires in ~1 hour, cache for 50 min to be safe)
    const expiresAt = new Date(Date.now() + 50 * 60 * 1000);
    tokenCache.set(tenantId, { token: data.token, expiresAt });
    
    console.log('[Correios] OAuth2 token obtained successfully');
    return data.token;
  } catch (error) {
    console.error('[Correios] Token fetch error:', error);
    return null;
  }
}

// ========== ADAPTERS =========

// Correios Adapter with OAuth2
async function fetchCorreiosEvents(
  trackingCode: string, 
  credentials: Record<string, unknown>,
  tenantId: string
): Promise<AdapterResult> {
  try {
    const token = await getCorreiosToken(credentials, tenantId);
    
    if (!token) {
      return { success: false, events: [], error: 'auth_failed' };
    }

    // Fetch tracking events
    const response = await fetch(
      `${CORREIOS_RASTRO_URL}/${trackingCode}?resultado=T`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
          'Accept-Language': 'pt-BR',
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Correios] API error:', response.status, errorText);
      
      // If 401, token might be invalid - clear cache
      if (response.status === 401) {
        tokenCache.delete(tenantId);
      }
      
      return { success: false, events: [], error: `api_error_${response.status}` };
    }

    const data = await response.json();
    const objetos = data.objetos || [];
    
    if (objetos.length === 0) {
      return { success: true, events: [] };
    }
    
    const objeto = objetos[0];
    const eventos = objeto.eventos || [];
    
    const events: TrackingEvent[] = eventos.map((e: Record<string, unknown>, idx: number) => {
      const dtHrCriado = e.dtHrCriado as string;
      const unidade = e.unidade as Record<string, unknown>;
      const descricao = e.descricao as string;
      
      return {
        provider_event_id: `correios_${trackingCode}_${dtHrCriado || idx}`,
        status: mapCorreiosStatus(e.codigo as string, e.tipo as string, descricao),
        description: descricao || 'Evento',
        location: formatCorreiosLocation(unidade),
        occurred_at: dtHrCriado || new Date().toISOString(),
      };
    });

    console.log(`[Correios] Found ${events.length} events for ${trackingCode}`);
    return { success: true, events };
  } catch (error) {
    console.error('[Correios] Fetch error:', error);
    return { success: false, events: [], error: 'fetch_error' };
  }
}

function mapCorreiosStatus(codigo: string, tipo: string, descricao?: string): DeliveryStatus {
  // Correios status codes mapping - comprehensive coverage
  // BDE = Entregue, OEC = Saiu para entrega, PO = Postado, etc.
  
  let mappedStatus: DeliveryStatus = 'unknown';
  
  // First check description for better mapping (sometimes codigo is empty or generic)
  if (descricao) {
    const desc = descricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    
    // DELIVERED - highest priority
    if (desc.includes('entregue ao destinatario') || 
        desc.includes('objeto entregue') || 
        desc.includes('entregue')) {
      return 'delivered';
    }
    
    // OUT FOR DELIVERY
    if (desc.includes('saiu para entrega') || 
        desc.includes('objeto saiu para entrega') ||
        desc.includes('out for delivery')) {
      return 'out_for_delivery';
    }
    
    // RETURNED
    if (desc.includes('devolvido ao remetente') ||
        desc.includes('objeto devolvido') ||
        desc.includes('em devolucao') ||
        desc.includes('devolvido')) {
      return 'returned';
    }
    
    // FAILED
    if (desc.includes('tentativa de entrega nao efetuada') ||
        desc.includes('destinatario ausente') ||
        desc.includes('endereco incorreto') ||
        desc.includes('endereco insuficiente') ||
        desc.includes('nao entregue') ||
        desc.includes('objeto nao entregue') ||
        desc.includes('falha na entrega')) {
      return 'failed';
    }
    
    // CANCELED
    if (desc.includes('postagem cancelada') ||
        desc.includes('objeto cancelado')) {
      return 'canceled';
    }
    
    // IN TRANSIT - check before POSTED since transit events come after posting
    if (desc.includes('encaminhado') || 
        desc.includes('objeto encaminhado') ||
        desc.includes('em transito') ||
        desc.includes('objeto em transferencia') ||
        desc.includes('saiu de') ||
        desc.includes('chegou em') ||
        desc.includes('recebido na unidade') ||
        desc.includes('objeto recebido') ||
        desc.includes('fiscalizacao aduaneira finalizada') ||
        desc.includes('liberado sem tributacao')) {
      return 'in_transit';
    }
    
    // POSTED - after checking transit
    if (desc.includes('objeto postado') || 
        desc.includes('objeto coletado') ||
        (desc.includes('postado') && !desc.includes('aguardando postagem'))) {
      return 'posted';
    }
    
    // LABEL CREATED - last check for description
    if (desc.includes('etiqueta') || 
        desc.includes('aguardando postagem') ||
        desc.includes('objeto aguardando') ||
        desc.includes('pre-postagem')) {
      return 'label_created';
    }
  }
  
  // Now check by codigo (fallback)
  if (codigo) {
    const code = codigo.toUpperCase();
    
    // Delivered
    if (['BDE', 'BDI'].includes(code)) {
      mappedStatus = 'delivered';
    }
    // Out for delivery
    else if (code === 'OEC') {
      mappedStatus = 'out_for_delivery';
    }
    // In transit
    else if (['LDI', 'RO', 'DO', 'PAR', 'OEI', 'FC', 'LDE'].includes(code)) {
      mappedStatus = 'in_transit';
    }
    // Posted
    else if (['PO', 'POI'].includes(code)) {
      mappedStatus = 'posted';
    }
    // Failed delivery attempt
    else if (['BDR', 'PMT'].includes(code)) {
      mappedStatus = 'failed';
    }
    // Returned
    else if (code === 'BLQ' && tipo === '70') {
      mappedStatus = 'returned';
    }
  }
  
  // Log unknown status for debugging (sanitized)
  if (mappedStatus === 'unknown' && (codigo || descricao)) {
    console.warn(`[Correios] Unmapped status - codigo: ${codigo || 'null'}, tipo: ${tipo || 'null'}, descricao: ${descricao?.substring(0, 50) || 'null'}`);
  }
  
  return mappedStatus;
}

function formatCorreiosLocation(unidade: Record<string, unknown> | undefined): string {
  if (!unidade) return '';
  const endereco = unidade.endereco as Record<string, unknown>;
  if (endereco) {
    const cidade = endereco.cidade as string || '';
    const uf = endereco.uf as string || '';
    return [cidade, uf].filter(Boolean).join(' - ');
  }
  const nome = unidade.nome as string || '';
  return nome;
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

    // Loggi API (placeholder - needs real implementation)
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
      description: (e.description as string) || 'Evento',
      location: (e.location as string) || '',
      occurred_at: (e.timestamp as string) || new Date().toISOString(),
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

// ========== CARRIER INFERENCE ==========

function inferCarrierFromTrackingCode(trackingCode: string): string {
  if (!trackingCode) return 'unknown';
  const code = trackingCode.toUpperCase().trim();
  
  // Correios: termina com BR
  if (code.endsWith('BR')) {
    return 'correios';
  }
  
  // Loggi: começa com BLI
  if (code.startsWith('BLI')) {
    return 'loggi';
  }
  
  return 'unknown';
}

// ========== MAIN LOGIC =========

interface ProviderCheckResult {
  credentials: ShippingProviderRecord | null;
  isActive: boolean;
  supportsTracking: boolean;
  skipReason?: string;
}

async function getProviderForShipment(
  supabase: any,
  tenantId: string,
  carrier: string,
  trackingCode: string
): Promise<ProviderCheckResult> {
  // Normalize carrier name
  let normalizedCarrier = carrier?.toLowerCase().trim() || '';
  
  // Map common variations
  if (normalizedCarrier.includes('correios') || normalizedCarrier.includes('correio')) {
    normalizedCarrier = 'correios';
  } else if (normalizedCarrier.includes('loggi')) {
    normalizedCarrier = 'loggi';
  } else if (normalizedCarrier === '' || normalizedCarrier === 'unknown') {
    // Infer from tracking code pattern
    normalizedCarrier = inferCarrierFromTrackingCode(trackingCode);
    console.log(`[TrackingPoll] Inferred carrier from tracking code ${trackingCode}: ${normalizedCarrier}`);
  }
  
  if (normalizedCarrier === 'unknown') {
    return {
      credentials: null,
      isActive: false,
      supportsTracking: false,
      skipReason: 'carrier_unknown',
    };
  }

  // Query shipping_providers
  const { data, error } = await supabase
    .from('shipping_providers')
    .select('provider, credentials, settings, is_enabled, supports_tracking')
    .eq('tenant_id', tenantId)
    .eq('provider', normalizedCarrier)
    .single();

  if (error || !data) {
    return {
      credentials: null,
      isActive: false,
      supportsTracking: false,
      skipReason: 'provider_not_configured',
    };
  }

  if (!data.is_enabled) {
    return {
      credentials: null,
      isActive: false,
      supportsTracking: false,
      skipReason: 'provider_disabled',
    };
  }

  if (!data.supports_tracking) {
    return {
      credentials: null,
      isActive: true,
      supportsTracking: false,
      skipReason: 'tracking_not_supported',
    };
  }

  return {
    credentials: {
      provider: String(data.provider || ''),
      credentials: data.credentials as Record<string, unknown>,
      settings: (data.settings as Record<string, unknown>) || {},
      is_enabled: Boolean(data.is_enabled),
    },
    isActive: true,
    supportsTracking: true,
  };
}

async function fetchTrackingEvents(
  carrier: string,
  trackingCode: string,
  credentials: ShippingProviderRecord | null,
  tenantId: string
): Promise<AdapterResult> {
  const normalizedCarrier = carrier.toLowerCase().trim();

  // Correios
  if (normalizedCarrier.includes('correios') || normalizedCarrier.includes('correio')) {
    if (!credentials || !credentials.is_enabled) {
      return noProviderAdapter(carrier);
    }
    return fetchCorreiosEvents(trackingCode, credentials.credentials, tenantId);
  }

  // Loggi
  if (normalizedCarrier.includes('loggi')) {
    if (!credentials || !credentials.is_enabled) {
      return noProviderAdapter(carrier);
    }
    return fetchLoggiEvents(trackingCode, credentials.credentials);
  }

  // Other carriers - no adapter yet
  return noProviderAdapter(carrier);
}

async function processShipment(
  supabase: any,
  shipment: ShipmentRecord,
  credentials: ShippingProviderRecord | null
): Promise<{ updated: boolean; newStatus?: DeliveryStatus; error?: string }> {
  const { id, tenant_id, order_id, carrier, tracking_code, delivery_status } = shipment;
  
  const result = await fetchTrackingEvents(
    carrier, 
    tracking_code, 
    credentials,
    tenant_id
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

  // Insert new events (idempotent via unique constraint on shipment_id + provider_event_id)
  // Sort events by occurred_at descending to find the most recent
  const sortedEvents = [...result.events].sort((a, b) => 
    new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
  );
  
  // The most recent event determines the current status
  const mostRecentEvent = sortedEvents[0];
  let lastEventStatus = mostRecentEvent?.status || delivery_status;
  let lastEventAt = mostRecentEvent?.occurred_at || shipment.last_status_at;
  
  console.log(`[ProcessShipment] Most recent event: status=${lastEventStatus}, occurred_at=${lastEventAt}, events_count=${result.events.length}`);

  for (const event of result.events) {
    // Skip events without provider_event_id (can't dedupe them properly)
    if (!event.provider_event_id) {
      console.log('[ProcessShipment] Skipping event without provider_event_id');
      continue;
    }
    
    // Check if event already exists before inserting
    const { data: existingEvent } = await supabase
      .from('shipment_events')
      .select('id')
      .eq('shipment_id', id)
      .eq('provider_event_id', event.provider_event_id)
      .maybeSingle();
    
    if (!existingEvent) {
      // Insert new event
      const { error: insertError } = await supabase
        .from('shipment_events')
        .insert({
          tenant_id,
          shipment_id: id,
          status: event.status,
          description: event.description,
          location: event.location || null,
          occurred_at: event.occurred_at,
          provider_event_id: event.provider_event_id,
        });

      if (insertError) {
        // Ignore duplicate key errors (23505)
        if (!insertError.code || insertError.code !== '23505') {
          console.error('[ProcessShipment] Insert event error:', insertError);
        }
      } else {
        console.log(`[ProcessShipment] Inserted event: ${event.status} for shipment ${id}`);
      }
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
    } else {
      console.log(`[ProcessShipment] Emitted shipment.status_changed event for ${id}: ${delivery_status} -> ${lastEventStatus}`);
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
      .not('delivery_status', 'in', '("delivered","returned","canceled")')
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

    // Cache provider check results per tenant+carrier
    const providerCache = new Map<string, ProviderCheckResult>();

    for (const shipment of shipments) {
      try {
        const carrierNormalized = (shipment.carrier || '').toLowerCase();
        const cacheKey = `${shipment.tenant_id}_${carrierNormalized || inferCarrierFromTrackingCode(shipment.tracking_code)}`;
        
        if (!providerCache.has(cacheKey)) {
          const result = await getProviderForShipment(
            supabase, 
            shipment.tenant_id, 
            shipment.carrier, 
            shipment.tracking_code
          );
          providerCache.set(cacheKey, result);
        }

        const providerResult = providerCache.get(cacheKey)!;
        
        // Check if provider is disabled or doesn't support tracking
        if (providerResult.skipReason) {
          console.log(`[TrackingPoll] Skipping shipment ${shipment.id}: ${providerResult.skipReason}`);
          
          // Update shipment with skip reason and reschedule
          const backoffMinutes = POLL_INTERVAL_MINUTES * 4; // Longer backoff for disabled providers
          await supabase
            .from('shipments')
            .update({
              last_polled_at: new Date().toISOString(),
              next_poll_at: new Date(Date.now() + backoffMinutes * 60 * 1000).toISOString(),
              last_poll_error: providerResult.skipReason,
            })
            .eq('id', shipment.id);
          
          // Register event for audit
          await supabase
            .from('shipment_events')
            .insert({
              tenant_id: shipment.tenant_id,
              shipment_id: shipment.id,
              status: shipment.delivery_status,
              description: `Polling skipped: ${providerResult.skipReason}`,
              occurred_at: new Date().toISOString(),
              provider_event_id: `skip_${shipment.id}_${Date.now()}`,
            });
          
          stats.noAdapter++;
          continue;
        }

        const result = await processShipment(supabase, shipment as ShipmentRecord, providerResult.credentials);

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
