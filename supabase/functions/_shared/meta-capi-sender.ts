// =============================================
// META CAPI SENDER - Shared helper for server-side
// Conversions API event dispatch from any edge function
// =============================================

interface MetaCapiConfig {
  meta_pixel_id: string;
  meta_access_token: string;
  meta_capi_enabled: boolean;
  meta_enabled: boolean;
}

interface MetaUserData {
  email?: string;
  phone?: string;
  first_name?: string;
  last_name?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
  external_id?: string;
  client_ip_address?: string;
  client_user_agent?: string;
  fbp?: string;
  fbc?: string;
  // Gender: 'f' or 'm'
  gender?: string;
  // Date of birth: YYYYMMDD format
  date_of_birth?: string;
}

interface MetaContentItem {
  id: string;
  quantity: number;
  item_price?: number;
  delivery_category?: string;
}

interface MetaCustomData {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_type?: string;
  contents?: MetaContentItem[];
  content_name?: string;
  content_category?: string;
  num_items?: number;
  order_id?: string;
  search_string?: string;
  shipping_tier?: string;
  payment_method?: string;
  predicted_ltv?: number;
  status?: string;
  // Any extra custom properties
  [key: string]: unknown;
}

export interface MetaCapiEvent {
  event_name: string;
  event_id?: string;
  event_time?: number;
  event_source_url?: string;
  action_source?: 'website' | 'app' | 'email' | 'phone_call' | 'chat' | 'physical_store' | 'system_generated' | 'other';
  user_data: MetaUserData;
  custom_data?: MetaCustomData;
  opt_out?: boolean;
  data_processing_options?: string[];
  data_processing_options_country?: number;
  data_processing_options_state?: number;
}

// Hash value for Meta CAPI (SHA-256, lowercase, trimmed)
async function hashForMeta(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (!normalized) return null;
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Normalize phone for Meta (digits only, with country code)
function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (!digits || digits.length < 10) return null;
  // Add Brazil country code if not present
  if (digits.length === 10 || digits.length === 11) {
    return '55' + digits;
  }
  return digits;
}

// Split full name into first and last
function splitName(fullName: string | undefined): { first: string | null; last: string | null } {
  if (!fullName) return { first: null, last: null };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { first: null, last: null };
  return {
    first: parts[0] || null,
    last: parts.length > 1 ? parts.slice(1).join(' ') : null,
  };
}

/**
 * Build hashed user_data payload for Meta CAPI
 * Accepts raw PII and returns hashed values per Meta spec
 */
async function buildHashedUserData(userData: MetaUserData): Promise<Record<string, unknown>> {
  const hashed: Record<string, unknown> = {};

  // Email (em) - hash required
  if (userData.email) {
    const h = await hashForMeta(userData.email);
    if (h) hashed.em = [h];
  }

  // Phone (ph) - normalize and hash
  if (userData.phone) {
    const normalized = normalizePhone(userData.phone);
    if (normalized) {
      const h = await hashForMeta(normalized);
      if (h) hashed.ph = [h];
    }
  }

  // First name (fn)
  if (userData.first_name) {
    const h = await hashForMeta(userData.first_name);
    if (h) hashed.fn = [h];
  }

  // Last name (ln)
  if (userData.last_name) {
    const h = await hashForMeta(userData.last_name);
    if (h) hashed.ln = [h];
  }

  // City (ct)
  if (userData.city) {
    const h = await hashForMeta(userData.city);
    if (h) hashed.ct = [h];
  }

  // State (st) - 2 letter code
  if (userData.state) {
    const h = await hashForMeta(userData.state);
    if (h) hashed.st = [h];
  }

  // Zip code (zp)
  if (userData.zip) {
    const h = await hashForMeta(userData.zip.replace(/\D/g, ''));
    if (h) hashed.zp = [h];
  }

  // Country (country)
  if (userData.country) {
    const h = await hashForMeta(userData.country);
    if (h) hashed.country = [h];
  } else {
    // Default to Brazil
    const h = await hashForMeta('br');
    if (h) hashed.country = [h];
  }

  // Gender (ge)
  if (userData.gender) {
    const h = await hashForMeta(userData.gender);
    if (h) hashed.ge = [h];
  }

  // Date of birth (db)
  if (userData.date_of_birth) {
    const h = await hashForMeta(userData.date_of_birth);
    if (h) hashed.db = [h];
  }

  // External ID
  if (userData.external_id) {
    const h = await hashForMeta(userData.external_id);
    if (h) hashed.external_id = [h];
  }

  // Non-hashed fields
  if (userData.client_ip_address) hashed.client_ip_address = userData.client_ip_address;
  if (userData.client_user_agent) hashed.client_user_agent = userData.client_user_agent;
  if (userData.fbp) hashed.fbp = userData.fbp;
  if (userData.fbc) hashed.fbc = userData.fbc;

  return hashed;
}

/**
 * Send one or more events to Meta Conversions API
 * Returns { success, events_received, error }
 */
export async function sendMetaCapiEvents(
  config: MetaCapiConfig,
  events: MetaCapiEvent[],
  options?: {
    test_event_code?: string;
    /** Supabase client for logging (optional) */
    supabase?: any;
    tenant_id?: string;
  }
): Promise<{ success: boolean; events_received?: number; error?: string; fbtrace_id?: string }> {
  // Guard checks
  if (!config.meta_enabled || !config.meta_capi_enabled) {
    return { success: true, error: 'Meta CAPI not enabled, skipping' };
  }

  if (!config.meta_pixel_id || !config.meta_access_token) {
    return { success: false, error: 'Missing Meta Pixel ID or Access Token' };
  }

  // Build event payloads
  const eventPayloads = await Promise.all(events.map(async (event) => {
    const hashedUserData = await buildHashedUserData(event.user_data);
    
    const payload: Record<string, unknown> = {
      event_name: event.event_name,
      event_time: event.event_time || Math.floor(Date.now() / 1000),
      event_id: event.event_id || crypto.randomUUID(),
      action_source: event.action_source || 'website',
      user_data: hashedUserData,
    };

    if (event.event_source_url) payload.event_source_url = event.event_source_url;
    if (event.custom_data && Object.keys(event.custom_data).length > 0) {
      payload.custom_data = event.custom_data;
    }
    if (event.opt_out) payload.opt_out = true;
    if (event.data_processing_options) {
      payload.data_processing_options = event.data_processing_options;
      payload.data_processing_options_country = event.data_processing_options_country;
      payload.data_processing_options_state = event.data_processing_options_state;
    }

    return payload;
  }));

  const requestBody: Record<string, unknown> = {
    data: eventPayloads,
  };

  if (options?.test_event_code) {
    requestBody.test_event_code = options.test_event_code;
  }

  // Send to Meta
  const metaUrl = `https://graph.facebook.com/v21.0/${config.meta_pixel_id}/events?access_token=${config.meta_access_token}`;

  try {
    const eventNames = events.map(e => e.event_name).join(', ');
    console.log(`[meta-capi] Sending ${eventNames} (${events.length} events) to Meta CAPI`);

    const response = await fetch(metaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseData = await response.json();

    // Log to marketing_events_log if supabase client provided
    if (options?.supabase && options?.tenant_id) {
      for (const event of events) {
        try {
          await options.supabase.from('marketing_events_log').insert({
            tenant_id: options.tenant_id,
            provider: 'meta',
            event_name: event.event_name,
            event_id: event.event_id || 'unknown',
            event_source: 'server',
            event_data: {
              custom_data: event.custom_data || null,
              action_source: event.action_source || 'website',
              user_data_keys: Object.keys(event.user_data).filter(k => (event.user_data as any)[k]),
            },
            provider_status: response.ok ? 'sent' : 'failed',
            provider_response: responseData,
            provider_error: response.ok ? null : JSON.stringify(responseData),
            sent_at: new Date().toISOString(),
          });
        } catch (logErr) {
          console.warn('[meta-capi] Failed to log event:', logErr);
        }
      }
    }

    if (!response.ok) {
      console.error('[meta-capi] Error from Meta:', responseData);

      // Update error status
      if (options?.supabase && options?.tenant_id) {
        const errorMsg = responseData?.error?.error_user_msg || responseData?.error?.message || 'Unknown error';
        await options.supabase
          .from('marketing_integrations')
          .update({ meta_last_error: errorMsg, meta_status: 'error' })
          .eq('tenant_id', options.tenant_id);
      }

      return {
        success: false,
        error: responseData?.error?.message || `HTTP ${response.status}`,
        fbtrace_id: responseData?.fbtrace_id,
      };
    }

    console.log(`[meta-capi] Success: ${responseData.events_received} events received, fbtrace_id: ${responseData.fbtrace_id}`);

    // Update success status
    if (options?.supabase && options?.tenant_id) {
      await options.supabase
        .from('marketing_integrations')
        .update({
          meta_last_error: null,
          meta_status: 'active',
          meta_last_test_at: new Date().toISOString(),
        })
        .eq('tenant_id', options.tenant_id);
    }

    return {
      success: true,
      events_received: responseData.events_received,
      fbtrace_id: responseData.fbtrace_id,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[meta-capi] Exception:', message);
    return { success: false, error: message };
  }
}

/**
 * Helper: Resolve Meta content_id for a product
 * Priority: meta_retailer_id > sku > product_id (UUID as last resort)
 */
export function resolveMetaContentId(item: {
  product_id?: string;
  id?: string;
  sku?: string;
  meta_retailer_id?: string | null;
}, logContext?: string): string {
  if (item.meta_retailer_id) return item.meta_retailer_id;
  if (item.sku) return item.sku;
  // Fallback to UUID — log this so we have visibility
  const fallbackId = item.product_id || item.id || '';
  if (fallbackId) {
    console.warn(`[meta-capi] content_id UUID fallback used for product ${fallbackId}${logContext ? ` (${logContext})` : ''} — consider adding SKU or meta_retailer_id`);
  }
  return fallbackId;
}

/**
 * Helper: Get Meta config for a tenant from DB
 */
export async function getMetaCapiConfig(
  supabase: any,
  tenantId: string
): Promise<MetaCapiConfig | null> {
  const { data, error } = await supabase
    .from('marketing_integrations')
    .select('meta_pixel_id, meta_access_token, meta_capi_enabled, meta_enabled')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (error || !data) return null;
  return data as MetaCapiConfig;
}

/**
 * Convenience: Send a single Purchase event via CAPI
 * Includes all recommended parameters per Meta docs
 */
export async function sendCapiPurchase(
  supabase: any,
  tenantId: string,
  params: {
    order_id: string;
    order_number?: string;
    value: number;
    currency?: string;
    items: Array<{
      product_id: string;
      sku?: string;
      meta_retailer_id?: string | null;
      name: string;
      price: number;
      quantity: number;
    }>;
    customer: {
      email?: string;
      phone?: string;
      name?: string;
      city?: string;
      state?: string;
      zip?: string;
      external_id?: string;
    };
    event_id?: string;
    event_source_url?: string;
    fbp?: string;
    fbc?: string;
    client_ip_address?: string;
    client_user_agent?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const config = await getMetaCapiConfig(supabase, tenantId);
  if (!config) {
    console.log('[meta-capi] No Meta config found for tenant:', tenantId);
    return { success: true }; // Not an error, just not configured
  }

  if (!config.meta_enabled || !config.meta_capi_enabled) {
    console.log('[meta-capi] Meta CAPI not enabled for tenant:', tenantId);
    return { success: true };
  }

  const { first, last } = splitName(params.customer.name);
  const currency = params.currency || 'BRL';

  const contentIds = params.items.map(i => resolveMetaContentId(i, 'Purchase'));
  const contents = params.items.map(i => ({
    id: resolveMetaContentId(i, 'Purchase'),
    quantity: i.quantity,
    item_price: i.price,
  }));
  const numItems = params.items.reduce((sum, i) => sum + i.quantity, 0);

  const event: MetaCapiEvent = {
    event_name: 'Purchase',
    event_id: params.event_id || crypto.randomUUID(),
    event_source_url: params.event_source_url,
    action_source: 'website',
    user_data: {
      email: params.customer.email,
      phone: params.customer.phone,
      first_name: first || undefined,
      last_name: last || undefined,
      city: params.customer.city,
      state: params.customer.state,
      zip: params.customer.zip,
      country: 'br',
      external_id: params.customer.external_id,
      client_ip_address: params.client_ip_address,
      client_user_agent: params.client_user_agent,
      fbp: params.fbp,
      fbc: params.fbc,
    },
    custom_data: {
      value: params.value,
      currency,
      content_ids: contentIds,
      content_type: 'product',
      contents,
      num_items: numItems,
      order_id: params.order_number || params.order_id,
    },
  };

  return sendMetaCapiEvents(config, [event], {
    supabase,
    tenant_id: tenantId,
  });
}

/**
 * Convenience: Send a single Lead event via CAPI
 */
export async function sendCapiLead(
  supabase: any,
  tenantId: string,
  params: {
    customer: {
      email?: string;
      phone?: string;
      name?: string;
      city?: string;
      state?: string;
      zip?: string;
    };
    value?: number;
    currency?: string;
    event_id?: string;
    event_source_url?: string;
    fbp?: string;
    fbc?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const config = await getMetaCapiConfig(supabase, tenantId);
  if (!config || !config.meta_enabled || !config.meta_capi_enabled) {
    return { success: true };
  }

  const { first, last } = splitName(params.customer.name);

  const event: MetaCapiEvent = {
    event_name: 'Lead',
    event_id: params.event_id || crypto.randomUUID(),
    event_source_url: params.event_source_url,
    action_source: 'website',
    user_data: {
      email: params.customer.email,
      phone: params.customer.phone,
      first_name: first || undefined,
      last_name: last || undefined,
      city: params.customer.city,
      state: params.customer.state,
      zip: params.customer.zip,
      country: 'br',
      fbp: params.fbp,
      fbc: params.fbc,
    },
    custom_data: {
      value: params.value || 0,
      currency: params.currency || 'BRL',
    },
  };

  return sendMetaCapiEvents(config, [event], { supabase, tenant_id: tenantId });
}

/**
 * Convenience: Send InitiateCheckout via CAPI
 */
export async function sendCapiInitiateCheckout(
  supabase: any,
  tenantId: string,
  params: {
    items: Array<{
      product_id: string;
      sku?: string;
      meta_retailer_id?: string | null;
      name: string;
      price: number;
      quantity: number;
    }>;
    value: number;
    currency?: string;
    customer?: {
      email?: string;
      phone?: string;
      name?: string;
    };
    event_id?: string;
    event_source_url?: string;
    fbp?: string;
    fbc?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const config = await getMetaCapiConfig(supabase, tenantId);
  if (!config || !config.meta_enabled || !config.meta_capi_enabled) {
    return { success: true };
  }

  const { first, last } = splitName(params.customer?.name);
  const currency = params.currency || 'BRL';

  const contentIds = params.items.map(i => resolveMetaContentId(i));
  const contents = params.items.map(i => ({
    id: resolveMetaContentId(i),
    quantity: i.quantity,
    item_price: i.price,
  }));
  const numItems = params.items.reduce((sum, i) => sum + i.quantity, 0);

  const event: MetaCapiEvent = {
    event_name: 'InitiateCheckout',
    event_id: params.event_id || crypto.randomUUID(),
    event_source_url: params.event_source_url,
    action_source: 'website',
    user_data: {
      email: params.customer?.email,
      phone: params.customer?.phone,
      first_name: first || undefined,
      last_name: last || undefined,
      country: 'br',
      fbp: params.fbp,
      fbc: params.fbc,
    },
    custom_data: {
      value: params.value,
      currency,
      content_ids: contentIds,
      content_type: 'product',
      contents,
      num_items: numItems,
    },
  };

  return sendMetaCapiEvents(config, [event], { supabase, tenant_id: tenantId });
}
