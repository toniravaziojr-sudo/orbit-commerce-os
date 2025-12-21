import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-tenant-id, x-webhook-secret',
};

// SHA-256 hash function (full 64-char hex for secret validation, truncated for idempotency)
async function generateHash(data: string, truncate = false): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const fullHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return truncate ? fullHash.substring(0, 32) : fullHash;
}

// Extract provider event ID from common webhook patterns
function extractProviderEventId(payload: Record<string, unknown>, provider: string): string | null {
  // Common patterns for webhook event IDs
  const idFields = [
    'id', 'event_id', 'eventId', 'webhook_id', 'webhookId',
    'transaction_id', 'transactionId', 'charge_id', 'chargeId',
    'order_id', 'orderId', 'reference_id', 'referenceId',
  ];

  for (const field of idFields) {
    if (payload[field] && typeof payload[field] === 'string') {
      return payload[field] as string;
    }
  }

  // Check nested data object (common pattern)
  if (payload.data && typeof payload.data === 'object') {
    const data = payload.data as Record<string, unknown>;
    for (const field of idFields) {
      if (data[field] && typeof data[field] === 'string') {
        return data[field] as string;
      }
    }
  }

  return null;
}

// Normalize payload to extract common fields
function normalizePayload(payload: Record<string, unknown>, provider: string): Record<string, unknown> {
  const normalized: Record<string, unknown> = {
    raw_refs: {
      provider,
      provider_event_id: extractProviderEventId(payload, provider),
    },
  };

  // Try to extract event type
  const eventTypeFields = ['type', 'event', 'event_type', 'eventType', 'action'];
  for (const field of eventTypeFields) {
    if (payload[field] && typeof payload[field] === 'string') {
      normalized.event_type = `${provider}.${payload[field]}`;
      break;
    }
  }

  // Try to extract subject (order/customer reference)
  const orderIdFields = ['order_id', 'orderId', 'order', 'pedido_id'];
  const customerIdFields = ['customer_id', 'customerId', 'customer', 'cliente_id'];

  for (const field of orderIdFields) {
    const value = payload[field] || (payload.data as Record<string, unknown>)?.[field];
    if (value) {
      normalized.subject = { type: 'order', id: String(value) };
      break;
    }
  }

  if (!normalized.subject) {
    for (const field of customerIdFields) {
      const value = payload[field] || (payload.data as Record<string, unknown>)?.[field];
      if (value) {
        normalized.subject = { type: 'customer', id: String(value) };
        break;
      }
    }
  }

  return normalized;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Extract provider from path: /webhooks-external/:provider or /webhooks/external/:provider
    let provider = pathParts[pathParts.length - 1];
    if (provider === 'webhooks-external' || provider === 'external') {
      provider = 'unknown';
    }

    console.log('[webhooks-external] Received webhook for provider:', provider);

    // Get auth headers
    const tenantId = req.headers.get('x-tenant-id');
    const webhookSecret = req.headers.get('x-webhook-secret');

    if (!tenantId) {
      console.error('[webhooks-external] Missing x-tenant-id header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing x-tenant-id header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!webhookSecret) {
      console.error('[webhooks-external] Missing x-webhook-secret header');
      return new Response(
        JSON.stringify({ success: false, error: 'Missing x-webhook-secret header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Calculate SHA-256 hash of the provided secret
    const secretHash = await generateHash(webhookSecret);
    console.log('[webhooks-external] Validating secret hash for provider:', provider);

    // Validate webhook secret by comparing hash
    const { data: secretRecord, error: secretError } = await supabase
      .from('webhook_secrets')
      .select('id, is_enabled, secret_hash')
      .eq('tenant_id', tenantId)
      .eq('provider', provider)
      .maybeSingle();

    if (secretError) {
      console.error('[webhooks-external] Error checking secret:', secretError);
      throw secretError;
    }

    if (!secretRecord) {
      console.error('[webhooks-external] No webhook config for tenant/provider:', { tenantId, provider });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Compare hash (timing-safe comparison via string equality after hash)
    if (secretRecord.secret_hash !== secretHash) {
      console.error('[webhooks-external] Invalid secret hash for tenant/provider:', { tenantId, provider });
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid credentials' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!secretRecord.is_enabled) {
      console.error('[webhooks-external] Webhook disabled for tenant/provider:', { tenantId, provider });
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook integration disabled' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse payload
    let payload: Record<string, unknown>;
    try {
      payload = await req.json();
    } catch {
      console.error('[webhooks-external] Invalid JSON payload');
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid JSON payload' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[webhooks-external] Payload received:', JSON.stringify(payload).substring(0, 500));

    // Generate idempotency key
    const providerEventId = extractProviderEventId(payload, provider);
    let idempotencyKey: string;
    
    if (providerEventId) {
      idempotencyKey = `${provider}:${providerEventId}`;
    } else {
      // Fallback: hash of body + provider + tenant (truncated for readability)
      const hashInput = `${tenantId}:${provider}:${JSON.stringify(payload)}`;
      idempotencyKey = `${provider}:hash:${await generateHash(hashInput, true)}`;
    }

    console.log('[webhooks-external] Generated idempotency_key:', idempotencyKey);

    // Check for duplicate
    const { data: existingEvent, error: checkError } = await supabase
      .from('events_inbox')
      .select('id, status')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (checkError) {
      console.error('[webhooks-external] Error checking existing event:', checkError);
      throw checkError;
    }

    if (existingEvent) {
      console.log('[webhooks-external] Duplicate webhook detected:', existingEvent.id);
      return new Response(
        JSON.stringify({
          success: true,
          duplicate: true,
          event_id: existingEvent.id,
          message: 'Webhook already processed (idempotency)',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Normalize payload
    const normalizedPayload = normalizePayload(payload, provider);
    const eventType = (normalizedPayload.event_type as string) || `${provider}.webhook`;

    // Insert event
    const { data: newEvent, error: insertError } = await supabase
      .from('events_inbox')
      .insert({
        tenant_id: tenantId,
        provider: `external:${provider}`,
        event_type: eventType,
        occurred_at: new Date().toISOString(),
        payload_raw: payload,
        payload_normalized: normalizedPayload,
        idempotency_key: idempotencyKey,
        status: 'new',
      })
      .select('id, status')
      .single();

    if (insertError) {
      console.error('[webhooks-external] Error inserting event:', insertError);
      throw insertError;
    }

    console.log('[webhooks-external] Event created successfully:', newEvent.id);

    return new Response(
      JSON.stringify({
        success: true,
        duplicate: false,
        event_id: newEvent.id,
        status: newEvent.status,
        message: 'Webhook received and processed',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    console.error('[webhooks-external] Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
