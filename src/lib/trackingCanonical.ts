// =============================================
// TRACKING CANONICAL LAYER
// Provider-agnostic event model + adapters
// All events pass through here before reaching Meta/Google/TikTok
// =============================================

import { getTrackingIdentity, getClickIds, hasTrackingConsent } from '@/lib/visitorIdentity';

// =============================================
// CANONICAL EVENT MODEL
// =============================================

export interface TrackingUserData {
  email?: string;
  phone?: string;
  name?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export interface TrackingContentItem {
  id: string;           // Meta content_id (resolved via meta_retailer_id > sku > uuid)
  sku?: string;
  name?: string;
  price?: number;
  quantity: number;
  category?: string;
}

export interface TrackingEvent {
  event_name: string;
  event_id: string;
  occurred_at: string;          // ISO timestamp
  event_source_url: string;
  source: 'browser' | 'server' | 'webhook';

  // Identity
  anonymous_id: string | null;  // _sf_vid
  fbp: string | null;
  fbc: string | null;
  ttclid: string | null;
  gclid: string | null;

  // PII (optional, for CAPI)
  user_data?: TrackingUserData;

  // E-commerce
  custom_data?: {
    value?: number;
    currency?: string;
    content_ids?: string[];
    content_type?: string;
    contents?: TrackingContentItem[];
    content_name?: string;
    content_category?: string;
    num_items?: number;
    order_id?: string;
    search_string?: string;
    shipping_tier?: string;
    payment_method?: string;
  };

  // Consent
  consent_granted: boolean;
}

// =============================================
// EVENT BUILDER
// =============================================

/**
 * Build a canonical TrackingEvent from the browser context.
 * All provider-specific adapters consume this format.
 */
export function buildTrackingEvent(params: {
  event_name: string;
  event_id: string;
  user_data?: TrackingUserData;
  custom_data?: TrackingEvent['custom_data'];
}): TrackingEvent {
  const identity = getTrackingIdentity();
  const clickIds = getClickIds();

  return {
    event_name: params.event_name,
    event_id: params.event_id,
    occurred_at: new Date().toISOString(),
    event_source_url: typeof window !== 'undefined' ? window.location.href : '',
    source: 'browser',

    anonymous_id: identity.external_id,
    fbp: identity.fbp,
    fbc: identity.fbc,
    ttclid: clickIds.ttclid,
    gclid: clickIds.gclid,

    user_data: params.user_data,
    custom_data: params.custom_data,

    consent_granted: hasTrackingConsent(),
  };
}

// =============================================
// META ADAPTER
// =============================================

/**
 * Convert canonical event to Meta browser (fbq) params.
 */
export function toMetaBrowserPayload(event: TrackingEvent): {
  params: Record<string, any>;
  options: { eventID: string };
} {
  const params: Record<string, any> = {};

  if (event.custom_data) {
    const cd = event.custom_data;
    if (cd.content_ids) params.content_ids = cd.content_ids;
    if (cd.content_type) params.content_type = cd.content_type;
    if (cd.value !== undefined) params.value = cd.value;
    if (cd.currency) params.currency = cd.currency;
    if (cd.content_name) params.content_name = cd.content_name;
    if (cd.content_category) params.content_category = cd.content_category;
    if (cd.num_items !== undefined) params.num_items = cd.num_items;
    if (cd.shipping_tier) params.shipping_tier = cd.shipping_tier;
    if (cd.search_string) params.search_string = cd.search_string;
    if (cd.contents) {
      params.contents = cd.contents.map(c => ({
        id: c.id,
        quantity: c.quantity,
        item_price: c.price, // Phase 6: include item_price in browser
      }));
    }
  }

  return {
    params,
    options: { eventID: event.event_id },
  };
}

/**
 * Convert canonical event to Meta CAPI payload (for edge function).
 */
export function toMetaCapiPayload(event: TrackingEvent): {
  event_name: string;
  event_id: string;
  event_source_url: string;
  user_data: Record<string, any>;
  custom_data?: Record<string, any>;
} {
  const userData: Record<string, any> = {
    fbp: event.fbp || undefined,
    fbc: event.fbc || undefined,
    external_id: event.anonymous_id || undefined,
  };

  if (event.user_data) {
    if (event.user_data.email) userData.email = event.user_data.email;
    if (event.user_data.phone) userData.phone = event.user_data.phone;
    if (event.user_data.name) userData.name = event.user_data.name;
    if (event.user_data.city) userData.city = event.user_data.city;
    if (event.user_data.state) userData.state = event.user_data.state;
    if (event.user_data.zip) userData.zip = event.user_data.zip;
  }

  const customData: Record<string, any> = {};
  if (event.custom_data) {
    const cd = event.custom_data;
    if (cd.value !== undefined) customData.value = cd.value;
    if (cd.currency) customData.currency = cd.currency;
    if (cd.content_ids) customData.content_ids = cd.content_ids;
    if (cd.content_type) customData.content_type = cd.content_type;
    if (cd.content_name) customData.content_name = cd.content_name;
    if (cd.content_category) customData.content_category = cd.content_category;
    if (cd.num_items !== undefined) customData.num_items = cd.num_items;
    if (cd.order_id) customData.order_id = cd.order_id;
    if (cd.search_string) customData.search_string = cd.search_string;
    if (cd.shipping_tier) customData.shipping_tier = cd.shipping_tier;
    if (cd.payment_method) customData.payment_method = cd.payment_method;
    if (cd.contents) {
      customData.contents = cd.contents.map(c => ({
        id: c.id,
        quantity: c.quantity,
        item_price: c.price,
      }));
    }
  }

  return {
    event_name: event.event_name,
    event_id: event.event_id,
    event_source_url: event.event_source_url,
    user_data: userData,
    custom_data: Object.keys(customData).length > 0 ? customData : undefined,
  };
}

// =============================================
// GOOGLE ADAPTER (Future - stub)
// =============================================

export function toGooglePayload(event: TrackingEvent): Record<string, any> {
  // Stub for future Google Ads/GA4 integration
  const params: Record<string, any> = {};
  if (event.custom_data) {
    if (event.custom_data.value !== undefined) params.value = event.custom_data.value;
    if (event.custom_data.currency) params.currency = event.custom_data.currency;
    if (event.custom_data.order_id) params.transaction_id = event.custom_data.order_id;
  }
  return params;
}

// =============================================
// TIKTOK ADAPTER (Future - stub)
// =============================================

export function toTikTokPayload(event: TrackingEvent): Record<string, any> {
  // Stub for future TikTok integration
  const params: Record<string, any> = {};
  if (event.event_id) params.event_id = event.event_id;
  if (event.custom_data) {
    if (event.custom_data.value !== undefined) params.value = event.custom_data.value;
    if (event.custom_data.currency) params.currency = event.custom_data.currency;
  }
  return params;
}
