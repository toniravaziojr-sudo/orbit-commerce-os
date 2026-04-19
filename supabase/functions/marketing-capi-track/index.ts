// ============================================
// MARKETING CAPI TRACK - Generic server-side Meta CAPI forwarder
// Receives any marketing event from client and forwards to Meta Conversions API
// Uses same event_id as browser pixel for automatic deduplication
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendMetaCapiEvents, getMetaCapiConfig, resolveMetaContentId } from "../_shared/meta-capi-sender.ts";
import type { MetaCapiEvent } from "../_shared/meta-capi-sender.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Supported Meta standard events
const VALID_EVENTS = new Set([
  'PageView',
  'ViewContent',
  'ViewCategory',
  'AddToCart',
  'InitiateCheckout',
  'Lead',
  'AddShippingInfo',
  'AddPaymentInfo',
  'Purchase',
  'Search',
  'CompleteRegistration',
  'Subscribe',
  'Contact',
]);

interface TrackRequest {
  tenant_id: string;
  event_name: string;
  event_id: string;
  event_source_url?: string;
  // User data (will be hashed server-side)
  user_data?: {
    email?: string;
    phone?: string;
    // v8.27.0: Pre-hashed PII (already SHA-256). Used to enrich
    // ViewContent/AddToCart with PII captured in earlier Lead/Purchase.
    email_hashed?: string;
    phone_hashed?: string;
    name?: string;
    city?: string;
    state?: string;
    zip?: string;
    external_id?: string;
    fbp?: string;
    fbc?: string;
    gender?: string;
    date_of_birth?: string;
    client_ip_from_browser?: string;
  };
  // Custom data (event-specific)
  custom_data?: {
    value?: number;
    currency?: string;
    content_ids?: string[];
    content_type?: string;
    contents?: Array<{ id: string; quantity: number; item_price?: number }>;
    content_name?: string;
    content_category?: string;
    num_items?: number;
    order_id?: string;
    search_string?: string;
    shipping_tier?: string;
    payment_method?: string;
    status?: string;
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // v8.20.0: Accept text/plain payloads (from sendBeacon fallback)
    const contentType = req.headers.get('content-type') || '';
    let payload: TrackRequest;
    if (contentType.includes('text/plain')) {
      const text = await req.text();
      payload = JSON.parse(text);
    } else {
      payload = await req.json();
    }

    // Validate required fields
    if (!payload.tenant_id || !payload.event_name || !payload.event_id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: tenant_id, event_name, event_id',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate event name
    if (!VALID_EVENTS.has(payload.event_name)) {
      return new Response(JSON.stringify({
        success: false,
        error: `Invalid event_name: ${payload.event_name}`,
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get Meta config for tenant
    const config = await getMetaCapiConfig(supabase, payload.tenant_id);
    if (!config) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'No Meta config' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!config.meta_enabled || !config.meta_capi_enabled) {
      return new Response(JSON.stringify({ success: true, skipped: true, reason: 'Meta CAPI not enabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // v8.26.0: Prefer client-reported IP (browser knows real IP), fall back to headers
    const clientIpFromBrowser = payload.user_data?.client_ip_from_browser || null;
    const headerIp = 
      req.headers.get('cf-connecting-ip')?.trim() ||
      req.headers.get('true-client-ip')?.trim() ||
      req.headers.get('x-real-ip')?.trim() ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-envoy-external-address')?.trim() ||
      null;
    // Use browser-reported IP if available (solves shared proxy IP issue)
    const clientIp = clientIpFromBrowser || headerIp;
    const clientUserAgent = req.headers.get('user-agent') || null;

    // Diagnostic log for IP tracking
    if (payload.event_name === 'PageView') {
      const isV6 = clientIp && clientIp.includes(':');
      console.log(`[marketing-capi-track] PageView IP diagnostic: selected=${clientIp?.substring(0, 30)}, format=${isV6 ? 'IPv6' : 'IPv4'}, ua=${clientUserAgent?.substring(0, 50)}`);
    }

    // Split name into first/last
    const nameParts = payload.user_data?.name?.trim().split(/\s+/) || [];
    const firstName = nameParts[0] || undefined;
    const lastName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : undefined;

    // Build CAPI event
    const event: MetaCapiEvent = {
      event_name: payload.event_name,
      event_id: payload.event_id,
      event_source_url: payload.event_source_url,
      action_source: 'website',
      user_data: {
        email: payload.user_data?.email,
        phone: payload.user_data?.phone,
        first_name: firstName,
        last_name: lastName,
        city: payload.user_data?.city,
        state: payload.user_data?.state,
        zip: payload.user_data?.zip,
        country: 'br',
        external_id: payload.user_data?.external_id,
        client_ip_address: clientIp || undefined,
        client_user_agent: clientUserAgent || undefined,
        fbp: payload.user_data?.fbp,
        fbc: payload.user_data?.fbc,
        gender: payload.user_data?.gender,
        date_of_birth: payload.user_data?.date_of_birth,
      },
      custom_data: payload.custom_data ? {
        value: payload.custom_data.value,
        currency: payload.custom_data.currency || 'BRL',
        content_ids: payload.custom_data.content_ids,
        content_type: payload.custom_data.content_type,
        contents: payload.custom_data.contents,
        content_name: payload.custom_data.content_name,
        content_category: payload.custom_data.content_category,
        num_items: payload.custom_data.num_items,
        order_id: payload.custom_data.order_id,
        search_string: payload.custom_data.search_string,
        shipping_tier: payload.custom_data.shipping_tier,
        payment_method: payload.custom_data.payment_method,
        status: payload.custom_data.status,
      } : undefined,
    };

    // Send to Meta CAPI
    const result = await sendMetaCapiEvents(config, [event], {
      supabase,
      tenant_id: payload.tenant_id,
    });

    console.log(`[marketing-capi-track] ${payload.event_name} (event_id: ${payload.event_id}) → ${result.success ? 'OK' : 'FAIL'}`);

    // v8.26.0: Return detected IP so browser can use it for subsequent events
    return new Response(JSON.stringify({ ...result, detected_ip: headerIp }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[marketing-capi-track] Error:', message);
    return new Response(JSON.stringify({ success: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
