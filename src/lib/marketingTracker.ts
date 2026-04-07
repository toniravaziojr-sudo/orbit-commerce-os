// =============================================
// MARKETING TRACKER
// Core tracking utilities for Meta/Google/TikTok
// Handles script injection, event dispatch, and deduplication
// =============================================
// Phase 4: external_id via visitorIdentity
// Phase 5: userData support in sendCapi for PII enrichment
// Phase 6: item_price in browser contents
// Phase 7: Retry with logging in sendServerEvent
// Phase 9: Advanced matching in fbq init

import { getTrackingIdentity, captureClickIds, getOrCreateVisitorId } from '@/lib/visitorIdentity';

// Generate unique event ID for deduplication between client and server
export function generateEventId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Generate a deterministic event ID for Purchase events.
 * Ensures browser, CAPI and ThankYou page all share the same event_id for dedup.
 */
export function generateDeterministicPurchaseEventId(
  mode: 'all_orders' | 'paid_only',
  orderId: string
): string {
  if (mode === 'paid_only') {
    return `purchase_paid_${orderId}`;
  }
  return `purchase_created_${orderId}`;
}

// SHA-256 hash for PII (email, phone) - used for advanced matching
export async function hashPII(value: string): Promise<string> {
  const normalized = value.toLowerCase().trim();
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Currency formatting for events
export function formatCurrency(value: number): string {
  return value.toFixed(2);
}

/**
 * Resolve the Meta content_id for a product.
 * Priority: meta_retailer_id > sku > id (UUID as last resort)
 */
export function resolveMetaContentId(product: {
  id: string;
  sku?: string;
  metaContentId?: string | null;
}): string {
  return product.metaContentId || product.sku || product.id;
}

// =============================================
// FBP/FBC CAPTURE (delegated to visitorIdentity)
// =============================================

// Re-export for backward compatibility
export { getFbp, getFbc } from '@/lib/visitorIdentity';

/**
 * Get both fbp and fbc for advanced matching
 */
export function getMetaIdentifiers(): { fbp: string | null; fbc: string | null; external_id: string | null } {
  const identity = getTrackingIdentity();
  return {
    fbp: identity.fbp,
    fbc: identity.fbc,
    external_id: identity.external_id,
  };
}

// Standard e-commerce event payload
export interface EcommerceEventData {
  event_id: string;
  event_name: string;
  currency?: string;
  value?: number;
  content_ids?: string[];
  content_type?: string;
  contents?: Array<{
    id: string;
    name?: string;
    quantity?: number;
    price?: number;
    category?: string;
  }>;
  content_name?: string;
  content_category?: string;
  num_items?: number;
  order_id?: string;
  search_query?: string;
  shipping_tier?: string;
  payment_method?: string;
}

// =============================================
// META PIXEL
// =============================================

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    _fbq?: any;
  }
}

export function injectMetaPixel(pixelId: string, advancedMatchingData?: Record<string, string>): void {
  if (!pixelId || typeof window === 'undefined') return;
  if (window.fbq) return; // Already loaded

  // Meta Pixel base code
  (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function() {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode?.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  // Phase 9: Advanced Matching - pass hashed user data in init if available
  if (advancedMatchingData && Object.keys(advancedMatchingData).length > 0) {
    window.fbq?.('init', pixelId, advancedMatchingData);
    console.log('[MarketingTracker] Meta Pixel initialized with advanced matching:', pixelId);
  } else {
    window.fbq?.('init', pixelId);
    console.log('[MarketingTracker] Meta Pixel initialized:', pixelId);
  }
}

export function trackMetaEvent(eventName: string, params?: Record<string, any>, eventId?: string): void {
  if (!window.fbq) return;

  const options = eventId ? { eventID: eventId } : undefined;

  if (eventName === 'PageView') {
    if (options) {
      window.fbq('track', 'PageView', {}, options);
    } else {
      window.fbq('track', 'PageView');
    }
  } else {
    if (options) {
      window.fbq('track', eventName, params || {}, options);
    } else {
      window.fbq('track', eventName, params);
    }
  }
  
  console.log('[MarketingTracker] Meta event:', eventName, params, eventId ? `(eventID: ${eventId})` : '');
}

// =============================================
// GOOGLE ANALYTICS 4 / GTAG
// =============================================

declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export function injectGoogleTag(measurementId: string, adsConversionId?: string): void {
  if (!measurementId || typeof window === 'undefined') return;
  if (window.gtag) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer?.push(arguments);
  };

  window.gtag('js', new Date());
  window.gtag('config', measurementId, { send_page_view: false });

  if (adsConversionId) {
    window.gtag('config', adsConversionId);
  }

  console.log('[MarketingTracker] Google Tag initialized:', measurementId, adsConversionId || '');
}

export function trackGoogleEvent(eventName: string, params?: Record<string, any>): void {
  if (!window.gtag) return;
  window.gtag('event', eventName, params);
  console.log('[MarketingTracker] Google event:', eventName, params);
}

// =============================================
// TIKTOK PIXEL
// =============================================

declare global {
  interface Window {
    ttq?: any;
    TiktokAnalyticsObject?: string;
  }
}

export function injectTikTokPixel(pixelId: string): void {
  if (!pixelId || typeof window === 'undefined') return;
  if (window.ttq) return;

  (function(w: any, d: any, t: any) {
    w.TiktokAnalyticsObject = t;
    const ttq = w[t] = w[t] || [];
    ttq.methods = ['page', 'track', 'identify', 'instances', 'debug', 'on', 'off', 'once', 'ready', 'alias', 'group', 'enableCookie', 'disableCookie'];
    ttq.setAndDefer = function(t: any, e: any) {
      t[e] = function() {
        t.push([e].concat(Array.prototype.slice.call(arguments, 0)));
      };
    };
    for (let i = 0; i < ttq.methods.length; i++) {
      ttq.setAndDefer(ttq, ttq.methods[i]);
    }
    ttq.instance = function(t: any) {
      const e = ttq._i[t] || [];
      for (let n = 0; n < ttq.methods.length; n++) {
        ttq.setAndDefer(e, ttq.methods[n]);
      }
      return e;
    };
    ttq.load = function(e: any, n?: any) {
      const i = 'https://analytics.tiktok.com/i18n/pixel/events.js';
      ttq._i = ttq._i || {};
      ttq._i[e] = [];
      ttq._i[e]._u = i;
      ttq._t = ttq._t || {};
      ttq._t[e] = +new Date();
      ttq._o = ttq._o || {};
      ttq._o[e] = n || {};
      const o = document.createElement('script');
      o.type = 'text/javascript';
      o.async = true;
      o.src = i + '?sdkid=' + e + '&lib=' + t;
      const a = document.getElementsByTagName('script')[0];
      a.parentNode?.insertBefore(o, a);
    };
    ttq.load(pixelId);
    ttq.page();
  })(window, document, 'ttq');

  console.log('[MarketingTracker] TikTok Pixel initialized:', pixelId);
}

export function trackTikTokEvent(eventName: string, params?: Record<string, any>, eventId?: string): void {
  if (!window.ttq) return;
  const trackParams = eventId ? { ...params, event_id: eventId } : params;
  window.ttq.track(eventName, trackParams);
  console.log('[MarketingTracker] TikTok event:', eventName, trackParams);
}

// =============================================
// UNIFIED TRACKER
// =============================================

export interface MarketingConfig {
  meta_pixel_id?: string | null;
  meta_enabled?: boolean;
  google_measurement_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_enabled?: boolean;
  tiktok_pixel_id?: string | null;
  tiktok_enabled?: boolean;
  tenantId?: string;
}

// Phase 7: Fire-and-forget server-side CAPI event with 1 retry
// v8.20.0: Hybrid transport strategy
//   - Lead, InitiateCheckout: fetch + keepalive (no redirect risk)
//   - Purchase: fetch + keepalive primary, sendBeacon text/plain fallback
//   - All other events: fetch + keepalive
// v8.25.0: Wait for _fbp cookie (created by Meta Pixel script) with timeout
// Increased to 5s to maximize fbp capture on slow connections
// Returns fbp value or null if not available within timeout
function waitForFbp(timeoutMs: number = 5000): Promise<string | null> {
  return new Promise((resolve) => {
    // Check immediately
    const identity = getTrackingIdentity();
    if (identity.fbp) {
      resolve(identity.fbp);
      return;
    }
    // Poll every 250ms up to timeout
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 250;
      const id = getTrackingIdentity();
      if (id.fbp) {
        clearInterval(interval);
        resolve(id.fbp);
      } else if (elapsed >= timeoutMs) {
        clearInterval(interval);
        console.warn('[MarketingTracker] _fbp cookie not available after', timeoutMs, 'ms — sending CAPI without it');
        resolve(null);
      }
    }, 250);
  });
}

function sendServerEvent(tenantId: string, payload: {
  event_name: string;
  event_id: string;
  event_source_url?: string;
  user_data?: Record<string, any>;
  custom_data?: Record<string, any>;
}): void {
  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  if (!projectId) return;

  const url = `https://${projectId}.supabase.co/functions/v1/marketing-capi-track`;

  // v8.21.1: Wait for _fbp on ALL Meta events (not just early ones)
  // This ensures identity coverage across the entire funnel
  const needsFbpWait = true;

  const doSend = (resolvedFbp: string | null) => {
    // Phase 4: Include external_id + identity
    const metaIds = getMetaIdentifiers();
    
    // Phase 10: Include stored advanced matching PII
    let storedEmail: string | undefined;
    let storedPhone: string | undefined;
    try {
      storedEmail = localStorage.getItem('_sf_am_em') || undefined;
      storedPhone = localStorage.getItem('_sf_am_ph') || undefined;
    } catch {}

    const userData = {
      ...(payload.user_data || {}),
      fbp: resolvedFbp || metaIds.fbp || undefined,
      fbc: metaIds.fbc || undefined,
      external_id: metaIds.external_id || undefined,
      ...(storedEmail && !payload.user_data?.email ? { email: storedEmail } : {}),
      ...(storedPhone && !payload.user_data?.phone ? { phone: storedPhone } : {}),
    };

    const body = JSON.stringify({
      tenant_id: tenantId,
      event_name: payload.event_name,
      event_id: payload.event_id,
      event_source_url: payload.event_source_url || window.location.href,
      user_data: userData,
      custom_data: payload.custom_data,
    });

    const headers = {
      'Content-Type': 'application/json',
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '',
    };

    const doFetch = (attempt: number) => {
      fetch(url, { method: 'POST', headers, body, keepalive: true })
        .then(response => {
          if (!response.ok && attempt === 1) {
            console.warn(`[MarketingTracker] CAPI ${payload.event_name} failed (attempt ${attempt}), retrying in 3s...`);
            setTimeout(() => doFetch(2), 3000);
          } else if (!response.ok) {
            console.warn(`[MarketingTracker] CAPI ${payload.event_name} failed after retry (event_id: ${payload.event_id})`);
          } else {
            console.log(`[MarketingTracker] CAPI ${payload.event_name} sent via fetch (attempt ${attempt}, event_id: ${payload.event_id})`);
          }
        })
        .catch(err => {
          if (attempt === 1) {
            console.warn(`[MarketingTracker] CAPI network error for ${payload.event_name}, retrying...`);
            setTimeout(() => doFetch(2), 3000);
          } else {
            if (payload.event_name === 'Purchase' && typeof navigator !== 'undefined' && navigator.sendBeacon) {
              const beaconUrl = `${url}?apikey=${encodeURIComponent(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || '')}`;
              const blob = new Blob([body], { type: 'text/plain' });
              const sent = navigator.sendBeacon(beaconUrl, blob);
              console.warn(`[MarketingTracker] CAPI Purchase fetch failed, beacon fallback: ${sent ? 'queued' : 'FAILED'} (event_id: ${payload.event_id})`);
            } else {
              console.warn(`[MarketingTracker] CAPI ${payload.event_name} failed after retry:`, err);
            }
          }
        });
    };

    doFetch(1);
  };

  if (needsFbpWait) {
    waitForFbp(3000).then(doSend);
  } else {
    doSend(null);
  }
}

export class MarketingTracker {
  private config: MarketingConfig;
  private initialized = false;

  constructor(config: MarketingConfig) {
    this.config = config;
  }

  // Phase 5: sendCapi now accepts userData for PII enrichment
  private sendCapi(eventName: string, eventId: string, customData?: Record<string, any>, userData?: Record<string, any>): void {
    if (!this.config.meta_enabled || !this.config.tenantId) return;
    sendServerEvent(this.config.tenantId, {
      event_name: eventName,
      event_id: eventId,
      custom_data: customData,
      user_data: userData,
    });
  }

  initialize(): void {
    if (this.initialized || typeof window === 'undefined') return;

    // Phase 4: Capture click IDs + ensure visitor ID exists
    captureClickIds();
    getOrCreateVisitorId();

    // Phase 4: getFbc to capture fbclid from URL
    const identity = getTrackingIdentity();

    // Inject all enabled pixels
    if (this.config.meta_enabled && this.config.meta_pixel_id) {
      // Phase 9: Try to get advanced matching data from cookies/session
      const advancedMatchingData = this.getAdvancedMatchingData();
      injectMetaPixel(this.config.meta_pixel_id, advancedMatchingData);
    }

    if (this.config.google_enabled && this.config.google_measurement_id) {
      injectGoogleTag(
        this.config.google_measurement_id,
        this.config.google_ads_conversion_id || undefined
      );
    }

    if (this.config.tiktok_enabled && this.config.tiktok_pixel_id) {
      injectTikTokPixel(this.config.tiktok_pixel_id);
    }

    this.initialized = true;
    
    console.log('[MarketingTracker] Initialized with config:', this.config);
    console.log('[MarketingTracker] Identity - external_id:', identity.external_id, 'fbp:', identity.fbp, 'fbc:', identity.fbc);
  }

  // Phase 9: Get hashed user data for advanced matching (from session/cookies)
  private getAdvancedMatchingData(): Record<string, string> | undefined {
    try {
      // Check localStorage first (persistent), then sessionStorage (legacy fallback)
      const storedEmail = localStorage.getItem('_sf_am_em') || sessionStorage.getItem('_sf_am_em');
      const storedPhone = localStorage.getItem('_sf_am_ph') || sessionStorage.getItem('_sf_am_ph');
      if (!storedEmail && !storedPhone) return undefined;

      const data: Record<string, string> = {};
      if (storedEmail) data.em = storedEmail; // Already hashed
      if (storedPhone) data.ph = storedPhone; // Already hashed
      return data;
    } catch {
      return undefined;
    }
  }

  // Track page view
  trackPageView(url?: string): void {
    const eventId = generateEventId();
    const pageUrl = url || window.location.href;

    if (this.config.meta_enabled) {
      trackMetaEvent('PageView', undefined, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('page_view', {
        page_location: pageUrl,
        page_title: document.title,
      });
    }

    if (this.config.tiktok_enabled && window.ttq) {
      window.ttq.page();
    }

    this.sendCapi('PageView', eventId);
  }

  // Track product view
  trackViewContent(product: {
    id: string;
    sku?: string;
    metaContentId?: string | null;
    name: string;
    price: number;
    currency?: string;
    category?: string;
  }): void {
    const eventId = generateEventId();
    const currency = product.currency || 'BRL';
    const metaId = resolveMetaContentId(product);

    if (this.config.meta_enabled) {
      trackMetaEvent('ViewContent', {
        content_ids: [metaId],
        content_name: product.name,
        content_type: 'product',
        content_category: product.category,
        value: product.price,
        currency,
      }, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('view_item', {
        currency,
        value: product.price,
        items: [{
          item_id: product.sku || product.id,
          item_name: product.name,
          item_category: product.category,
          price: product.price,
          quantity: 1,
        }],
      });
    }

    if (this.config.tiktok_enabled) {
      trackTikTokEvent('ViewContent', {
        content_id: product.sku || product.id,
        content_name: product.name,
        content_type: 'product',
        content_category: product.category,
        value: product.price,
        currency,
      }, eventId);
    }

    this.sendCapi('ViewContent', eventId, {
      content_ids: [metaId],
      content_name: product.name,
      content_type: 'product',
      content_category: product.category,
      value: product.price,
      currency,
    });
  }

  // Track add to cart — Phase 6: item_price in browser contents
  trackAddToCart(item: {
    id: string;
    sku?: string;
    metaContentId?: string | null;
    name: string;
    price: number;
    quantity: number;
    currency?: string;
    category?: string;
  }): void {
    const eventId = generateEventId();
    const currency = item.currency || 'BRL';
    const value = item.price * item.quantity;
    const metaId = resolveMetaContentId(item);

    if (this.config.meta_enabled) {
      trackMetaEvent('AddToCart', {
        content_ids: [metaId],
        content_name: item.name,
        content_type: 'product',
        content_category: item.category,
        value,
        currency,
        contents: [{
          id: metaId,
          quantity: item.quantity,
          item_price: item.price, // Phase 6
        }],
      }, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('add_to_cart', {
        currency,
        value,
        items: [{
          item_id: item.sku || item.id,
          item_name: item.name,
          item_category: item.category,
          price: item.price,
          quantity: item.quantity,
        }],
      });
    }

    if (this.config.tiktok_enabled) {
      trackTikTokEvent('AddToCart', {
        content_id: item.sku || item.id,
        content_name: item.name,
        content_type: 'product',
        content_category: item.category,
        quantity: item.quantity,
        value,
        currency,
      }, eventId);
    }

    this.sendCapi('AddToCart', eventId, {
      content_ids: [metaId],
      content_name: item.name,
      content_type: 'product',
      content_category: item.category,
      value,
      currency,
      contents: [{ id: metaId, quantity: item.quantity, item_price: item.price }],
    });
  }

  // Track initiate checkout — Phase 6: item_price in browser contents
  trackInitiateCheckout(cart: {
    items: Array<{ id: string; sku?: string; metaContentId?: string | null; name: string; price: number; quantity: number; category?: string }>;
    value: number;
    currency?: string;
  }): void {
    const eventId = generateEventId();
    const currency = cart.currency || 'BRL';

    if (this.config.meta_enabled) {
      trackMetaEvent('InitiateCheckout', {
        content_ids: cart.items.map(i => resolveMetaContentId(i)),
        content_type: 'product',
        value: cart.value,
        currency,
        num_items: cart.items.reduce((sum, i) => sum + i.quantity, 0),
        contents: cart.items.map(i => ({
          id: resolveMetaContentId(i),
          quantity: i.quantity,
          item_price: i.price, // Phase 6
        })),
      }, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('begin_checkout', {
        currency,
        value: cart.value,
        items: cart.items.map(i => ({
          item_id: i.sku || i.id,
          item_name: i.name,
          item_category: i.category,
          price: i.price,
          quantity: i.quantity,
        })),
      });
    }

    if (this.config.tiktok_enabled) {
      trackTikTokEvent('InitiateCheckout', {
        content_ids: cart.items.map(i => i.sku || i.id),
        content_type: 'product',
        value: cart.value,
        currency,
        quantity: cart.items.reduce((sum, i) => sum + i.quantity, 0),
      }, eventId);
    }

    this.sendCapi('InitiateCheckout', eventId, {
      content_ids: cart.items.map(i => resolveMetaContentId(i)),
      content_type: 'product',
      value: cart.value,
      currency,
      num_items: cart.items.reduce((sum, i) => sum + i.quantity, 0),
      contents: cart.items.map(i => ({ id: resolveMetaContentId(i), quantity: i.quantity, item_price: i.price })),
    });
  }

  // Track purchase — Phase 2: accepts external event_id, Phase 5: accepts userData, Phase 6: item_price
  trackPurchase(order: {
    order_id: string;
    value: number;
    currency?: string;
    items: Array<{ id: string; sku?: string; metaContentId?: string | null; name: string; price: number; quantity: number; category?: string }>;
    event_id?: string;  // Phase 2: deterministic event_id
    userData?: { email?: string; phone?: string; name?: string; city?: string; state?: string; zip?: string }; // Phase 5
  }): void {
    const eventId = order.event_id || generateEventId();
    const currency = order.currency || 'BRL';

    // Store event_id for server-side deduplication
    try {
      sessionStorage.setItem(`purchase_event_${order.order_id}`, eventId);
    } catch {}

    if (this.config.meta_enabled) {
      trackMetaEvent('Purchase', {
        content_ids: order.items.map(i => resolveMetaContentId(i)),
        content_type: 'product',
        value: order.value,
        currency,
        num_items: order.items.reduce((sum, i) => sum + i.quantity, 0),
        contents: order.items.map(i => ({
          id: resolveMetaContentId(i),
          quantity: i.quantity,
          item_price: i.price, // Phase 6
        })),
      }, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('purchase', {
        transaction_id: order.order_id,
        currency,
        value: order.value,
        items: order.items.map(i => ({
          item_id: i.sku || i.id,
          item_name: i.name,
          item_category: i.category,
          price: i.price,
          quantity: i.quantity,
        })),
      });
    }

    if (this.config.tiktok_enabled) {
      trackTikTokEvent('CompletePayment', {
        content_ids: order.items.map(i => i.sku || i.id),
        content_type: 'product',
        value: order.value,
        currency,
        quantity: order.items.reduce((sum, i) => sum + i.quantity, 0),
      }, eventId);
    }

    // Phase 5: Include PII userData in CAPI
    this.sendCapi('Purchase', eventId, {
      content_ids: order.items.map(i => resolveMetaContentId(i)),
      content_type: 'product',
      value: order.value,
      currency,
      num_items: order.items.reduce((sum, i) => sum + i.quantity, 0),
      contents: order.items.map(i => ({ id: resolveMetaContentId(i), quantity: i.quantity, item_price: i.price })),
      order_id: order.order_id,
    }, order.userData);

    // Phase 9: Store hashed email/phone for advanced matching on next page load
    if (order.userData?.email || order.userData?.phone) {
      this.storeAdvancedMatchingData(order.userData.email, order.userData.phone);
    }
  }

  // Phase 9: Store hashed PII for advanced matching
  private async storeAdvancedMatchingData(email?: string, phone?: string): Promise<void> {
    try {
      if (email) {
        const hashed = await hashPII(email);
        // Store in both localStorage (persistent across sessions) and sessionStorage (legacy compat)
        localStorage.setItem('_sf_am_em', hashed);
        sessionStorage.setItem('_sf_am_em', hashed);
      }
      if (phone) {
        const hashed = await hashPII(phone);
        localStorage.setItem('_sf_am_ph', hashed);
        sessionStorage.setItem('_sf_am_ph', hashed);
      }
    } catch {}
  }

  trackSearch(query: string): void {
    const eventId = generateEventId();

    if (this.config.meta_enabled) {
      trackMetaEvent('Search', { search_string: query }, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('search', { search_term: query });
    }

    if (this.config.tiktok_enabled) {
      trackTikTokEvent('Search', { query }, eventId);
    }

    this.sendCapi('Search', eventId, { search_string: query });
  }

  trackViewCategory(category: {
    id: string;
    name: string;
    productIds?: string[];
  }): void {
    const eventId = generateEventId();

    if (this.config.meta_enabled) {
      trackMetaEvent('ViewCategory', {
        content_category: category.name,
        content_ids: category.productIds || [],
        content_type: 'product_group',
      }, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('view_item_list', {
        item_list_id: category.id,
        item_list_name: category.name,
      });
    }

    if (this.config.tiktok_enabled) {
      trackTikTokEvent('ViewContent', {
        content_id: category.id,
        content_name: category.name,
        content_type: 'product_group',
      }, eventId);
    }

    this.sendCapi('ViewCategory', eventId, {
      content_category: category.name,
      content_ids: category.productIds || [],
      content_type: 'product_group',
    });
  }

  // Phase 5: Lead already sends PII — keeping as-is
  trackLead(customer: {
    email?: string;
    phone?: string;
    name?: string;
    value?: number;
    currency?: string;
  }): void {
    const eventId = generateEventId();
    const currency = customer.currency || 'BRL';

    if (this.config.meta_enabled) {
      trackMetaEvent('Lead', {
        value: customer.value || 0,
        currency,
      }, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('generate_lead', {
        value: customer.value || 0,
        currency,
      });
    }

    if (this.config.tiktok_enabled) {
      trackTikTokEvent('SubmitForm', {
        value: customer.value || 0,
        currency,
      }, eventId);
    }

    this.sendCapi('Lead', eventId, {
      value: customer.value || 0,
      currency,
    }, {
      email: customer.email,
      phone: customer.phone,
      name: customer.name,
    });
  }

  // Phase 5: AddShippingInfo now accepts userData, Phase 6: item_price in browser
  trackAddShippingInfo(shipping: {
    value: number;
    currency?: string;
    shippingTier: string;
    items: Array<{ id: string; sku?: string; metaContentId?: string | null; name: string; price: number; quantity: number; category?: string }>;
    userData?: { email?: string; phone?: string; name?: string; city?: string; state?: string; zip?: string };
  }): void {
    const eventId = generateEventId();
    const currency = shipping.currency || 'BRL';

    if (this.config.meta_enabled) {
      trackMetaEvent('AddShippingInfo', {
        content_ids: shipping.items.map(i => resolveMetaContentId(i)),
        content_type: 'product',
        value: shipping.value,
        currency,
        shipping_tier: shipping.shippingTier,
        contents: shipping.items.map(i => ({
          id: resolveMetaContentId(i),
          quantity: i.quantity,
          item_price: i.price, // Phase 6
        })),
      }, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('add_shipping_info', {
        currency,
        value: shipping.value,
        shipping_tier: shipping.shippingTier,
        items: shipping.items.map(i => ({
          item_id: i.sku || i.id,
          item_name: i.name,
          item_category: i.category,
          price: i.price,
          quantity: i.quantity,
        })),
      });
    }

    if (this.config.tiktok_enabled) {
      trackTikTokEvent('AddShippingInfo', {
        content_ids: shipping.items.map(i => i.sku || i.id),
        content_type: 'product',
        value: shipping.value,
        currency,
      }, eventId);
    }

    // Phase 5: Include PII in CAPI
    this.sendCapi('AddShippingInfo', eventId, {
      content_ids: shipping.items.map(i => resolveMetaContentId(i)),
      content_type: 'product',
      value: shipping.value,
      currency,
      shipping_tier: shipping.shippingTier,
      contents: shipping.items.map(i => ({ id: resolveMetaContentId(i), quantity: i.quantity, item_price: i.price })),
    }, shipping.userData);
  }

  // Phase 5: AddPaymentInfo now accepts userData, Phase 6: item_price in browser
  trackAddPaymentInfo(payment: {
    value: number;
    currency?: string;
    paymentMethod: string;
    items: Array<{ id: string; sku?: string; metaContentId?: string | null; name: string; price: number; quantity: number; category?: string }>;
    userData?: { email?: string; phone?: string; name?: string; city?: string; state?: string; zip?: string };
  }): void {
    const eventId = generateEventId();
    const currency = payment.currency || 'BRL';

    if (this.config.meta_enabled) {
      trackMetaEvent('AddPaymentInfo', {
        content_ids: payment.items.map(i => resolveMetaContentId(i)),
        content_type: 'product',
        value: payment.value,
        currency,
        contents: payment.items.map(i => ({
          id: resolveMetaContentId(i),
          quantity: i.quantity,
          item_price: i.price, // Phase 6
        })),
      }, eventId);
    }

    if (this.config.google_enabled) {
      trackGoogleEvent('add_payment_info', {
        currency,
        value: payment.value,
        payment_type: payment.paymentMethod,
        items: payment.items.map(i => ({
          item_id: i.sku || i.id,
          item_name: i.name,
          item_category: i.category,
          price: i.price,
          quantity: i.quantity,
        })),
      });
    }

    if (this.config.tiktok_enabled) {
      trackTikTokEvent('AddPaymentInfo', {
        content_ids: payment.items.map(i => i.sku || i.id),
        content_type: 'product',
        value: payment.value,
        currency,
      }, eventId);
    }

    // Phase 5: Include PII in CAPI
    this.sendCapi('AddPaymentInfo', eventId, {
      content_ids: payment.items.map(i => resolveMetaContentId(i)),
      content_type: 'product',
      value: payment.value,
      currency,
      payment_method: payment.paymentMethod,
      contents: payment.items.map(i => ({ id: resolveMetaContentId(i), quantity: i.quantity, item_price: i.price })),
    }, payment.userData);
  }
}