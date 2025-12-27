// =============================================
// MARKETING TRACKER
// Core tracking utilities for Meta/Google/TikTok
// Handles script injection, event dispatch, and deduplication
// =============================================

// Generate unique event ID for deduplication between client and server
export function generateEventId(): string {
  // Use timestamp + random for shorter IDs that still avoid collisions
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
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

export function injectMetaPixel(pixelId: string): void {
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

  window.fbq?.('init', pixelId);
  console.log('[MarketingTracker] Meta Pixel initialized:', pixelId);
}

export function trackMetaEvent(eventName: string, params?: Record<string, any>, eventId?: string): void {
  if (!window.fbq) return;

  const trackParams = eventId 
    ? { ...params, eventID: eventId }
    : params;

  if (eventName === 'PageView') {
    window.fbq('track', 'PageView');
  } else {
    window.fbq('track', eventName, trackParams);
  }
  
  console.log('[MarketingTracker] Meta event:', eventName, trackParams);
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
  if (window.gtag) return; // Already loaded

  // Load gtag.js
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  // Initialize dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  window.gtag = function() {
    window.dataLayer?.push(arguments);
  };

  window.gtag('js', new Date());
  
  // Configure GA4
  window.gtag('config', measurementId, {
    send_page_view: false, // We'll send page views manually for SPA
  });

  // Configure Google Ads if provided
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
  if (window.ttq) return; // Already loaded

  // TikTok Pixel base code
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

  const trackParams = eventId 
    ? { ...params, event_id: eventId }
    : params;

  window.ttq.track(eventName, trackParams);
  console.log('[MarketingTracker] TikTok event:', eventName, trackParams);
}

// =============================================
// UNIFIED TRACKER
// Dispatches events to all enabled providers
// =============================================

export interface MarketingConfig {
  meta_pixel_id?: string | null;
  meta_enabled?: boolean;
  google_measurement_id?: string | null;
  google_ads_conversion_id?: string | null;
  google_enabled?: boolean;
  tiktok_pixel_id?: string | null;
  tiktok_enabled?: boolean;
}

export class MarketingTracker {
  private config: MarketingConfig;
  private initialized = false;

  constructor(config: MarketingConfig) {
    this.config = config;
  }

  initialize(): void {
    if (this.initialized || typeof window === 'undefined') return;

    // Inject all enabled pixels
    if (this.config.meta_enabled && this.config.meta_pixel_id) {
      injectMetaPixel(this.config.meta_pixel_id);
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
  }

  // Track page view - call on route change
  trackPageView(url?: string): void {
    const eventId = generateEventId();
    const pageUrl = url || window.location.href;

    // Meta
    if (this.config.meta_enabled) {
      trackMetaEvent('PageView', undefined, eventId);
    }

    // Google
    if (this.config.google_enabled) {
      trackGoogleEvent('page_view', {
        page_location: pageUrl,
        page_title: document.title,
      });
    }

    // TikTok - page() is called automatically, but we can track again for SPA
    if (this.config.tiktok_enabled && window.ttq) {
      window.ttq.page();
    }
  }

  // Track product view
  trackViewContent(product: {
    id: string;
    name: string;
    price: number;
    currency?: string;
    category?: string;
  }): void {
    const eventId = generateEventId();
    const currency = product.currency || 'BRL';

    // Meta
    if (this.config.meta_enabled) {
      trackMetaEvent('ViewContent', {
        content_ids: [product.id],
        content_name: product.name,
        content_type: 'product',
        content_category: product.category,
        value: product.price,
        currency,
      }, eventId);
    }

    // Google
    if (this.config.google_enabled) {
      trackGoogleEvent('view_item', {
        currency,
        value: product.price,
        items: [{
          item_id: product.id,
          item_name: product.name,
          item_category: product.category,
          price: product.price,
          quantity: 1,
        }],
      });
    }

    // TikTok
    if (this.config.tiktok_enabled) {
      trackTikTokEvent('ViewContent', {
        content_id: product.id,
        content_name: product.name,
        content_type: 'product',
        content_category: product.category,
        value: product.price,
        currency,
      }, eventId);
    }
  }

  // Track add to cart
  trackAddToCart(item: {
    id: string;
    name: string;
    price: number;
    quantity: number;
    currency?: string;
    category?: string;
  }): void {
    const eventId = generateEventId();
    const currency = item.currency || 'BRL';
    const value = item.price * item.quantity;

    // Meta
    if (this.config.meta_enabled) {
      trackMetaEvent('AddToCart', {
        content_ids: [item.id],
        content_name: item.name,
        content_type: 'product',
        content_category: item.category,
        value,
        currency,
        contents: [{
          id: item.id,
          quantity: item.quantity,
        }],
      }, eventId);
    }

    // Google
    if (this.config.google_enabled) {
      trackGoogleEvent('add_to_cart', {
        currency,
        value,
        items: [{
          item_id: item.id,
          item_name: item.name,
          item_category: item.category,
          price: item.price,
          quantity: item.quantity,
        }],
      });
    }

    // TikTok
    if (this.config.tiktok_enabled) {
      trackTikTokEvent('AddToCart', {
        content_id: item.id,
        content_name: item.name,
        content_type: 'product',
        content_category: item.category,
        quantity: item.quantity,
        value,
        currency,
      }, eventId);
    }
  }

  // Track initiate checkout
  trackInitiateCheckout(cart: {
    items: Array<{ id: string; name: string; price: number; quantity: number; category?: string }>;
    value: number;
    currency?: string;
  }): void {
    const eventId = generateEventId();
    const currency = cart.currency || 'BRL';

    // Meta
    if (this.config.meta_enabled) {
      trackMetaEvent('InitiateCheckout', {
        content_ids: cart.items.map(i => i.id),
        content_type: 'product',
        value: cart.value,
        currency,
        num_items: cart.items.reduce((sum, i) => sum + i.quantity, 0),
        contents: cart.items.map(i => ({
          id: i.id,
          quantity: i.quantity,
        })),
      }, eventId);
    }

    // Google
    if (this.config.google_enabled) {
      trackGoogleEvent('begin_checkout', {
        currency,
        value: cart.value,
        items: cart.items.map(i => ({
          item_id: i.id,
          item_name: i.name,
          item_category: i.category,
          price: i.price,
          quantity: i.quantity,
        })),
      });
    }

    // TikTok
    if (this.config.tiktok_enabled) {
      trackTikTokEvent('InitiateCheckout', {
        content_ids: cart.items.map(i => i.id),
        content_type: 'product',
        value: cart.value,
        currency,
        quantity: cart.items.reduce((sum, i) => sum + i.quantity, 0),
      }, eventId);
    }
  }

  // Track purchase - client side (server-side also sends this for reliability)
  trackPurchase(order: {
    order_id: string;
    value: number;
    currency?: string;
    items: Array<{ id: string; name: string; price: number; quantity: number; category?: string }>;
  }): void {
    const eventId = generateEventId();
    const currency = order.currency || 'BRL';

    // Store event_id for server-side deduplication
    try {
      sessionStorage.setItem(`purchase_event_${order.order_id}`, eventId);
    } catch (e) {
      // Storage not available
    }

    // Meta
    if (this.config.meta_enabled) {
      trackMetaEvent('Purchase', {
        content_ids: order.items.map(i => i.id),
        content_type: 'product',
        value: order.value,
        currency,
        num_items: order.items.reduce((sum, i) => sum + i.quantity, 0),
        contents: order.items.map(i => ({
          id: i.id,
          quantity: i.quantity,
        })),
      }, eventId);
    }

    // Google
    if (this.config.google_enabled) {
      trackGoogleEvent('purchase', {
        transaction_id: order.order_id,
        currency,
        value: order.value,
        items: order.items.map(i => ({
          item_id: i.id,
          item_name: i.name,
          item_category: i.category,
          price: i.price,
          quantity: i.quantity,
        })),
      });
    }

    // TikTok
    if (this.config.tiktok_enabled) {
      trackTikTokEvent('CompletePayment', {
        content_ids: order.items.map(i => i.id),
        content_type: 'product',
        value: order.value,
        currency,
        quantity: order.items.reduce((sum, i) => sum + i.quantity, 0),
      }, eventId);
    }
  }

  // Track search
  trackSearch(query: string): void {
    const eventId = generateEventId();

    // Meta
    if (this.config.meta_enabled) {
      trackMetaEvent('Search', {
        search_string: query,
      }, eventId);
    }

    // Google
    if (this.config.google_enabled) {
      trackGoogleEvent('search', {
        search_term: query,
      });
    }

    // TikTok
    if (this.config.tiktok_enabled) {
      trackTikTokEvent('Search', {
        query,
      }, eventId);
    }
  }

  // Track category view
  trackViewCategory(category: {
    id: string;
    name: string;
    productIds?: string[];
  }): void {
    const eventId = generateEventId();

    // Meta - ViewCategory is a custom event
    if (this.config.meta_enabled) {
      trackMetaEvent('ViewCategory', {
        content_category: category.name,
        content_ids: category.productIds || [],
        content_type: 'product_group',
      }, eventId);
    }

    // Google - view_item_list
    if (this.config.google_enabled) {
      trackGoogleEvent('view_item_list', {
        item_list_id: category.id,
        item_list_name: category.name,
      });
    }

    // TikTok
    if (this.config.tiktok_enabled) {
      trackTikTokEvent('ViewContent', {
        content_id: category.id,
        content_name: category.name,
        content_type: 'product_group',
      }, eventId);
    }
  }

  // Track lead - when customer fills personal info
  trackLead(customer: {
    email?: string;
    phone?: string;
    name?: string;
    value?: number;
    currency?: string;
  }): void {
    const eventId = generateEventId();
    const currency = customer.currency || 'BRL';

    // Meta
    if (this.config.meta_enabled) {
      trackMetaEvent('Lead', {
        value: customer.value || 0,
        currency,
      }, eventId);
    }

    // Google - generate_lead
    if (this.config.google_enabled) {
      trackGoogleEvent('generate_lead', {
        value: customer.value || 0,
        currency,
      });
    }

    // TikTok
    if (this.config.tiktok_enabled) {
      trackTikTokEvent('SubmitForm', {
        value: customer.value || 0,
        currency,
      }, eventId);
    }
  }

  // Track shipping info added
  trackAddShippingInfo(shipping: {
    value: number;
    currency?: string;
    shippingTier: string;
    items: Array<{ id: string; name: string; price: number; quantity: number; category?: string }>;
  }): void {
    const eventId = generateEventId();
    const currency = shipping.currency || 'BRL';

    // Meta - custom event
    if (this.config.meta_enabled) {
      trackMetaEvent('AddShippingInfo', {
        content_ids: shipping.items.map(i => i.id),
        content_type: 'product',
        value: shipping.value,
        currency,
        shipping_tier: shipping.shippingTier,
        contents: shipping.items.map(i => ({
          id: i.id,
          quantity: i.quantity,
        })),
      }, eventId);
    }

    // Google - add_shipping_info
    if (this.config.google_enabled) {
      trackGoogleEvent('add_shipping_info', {
        currency,
        value: shipping.value,
        shipping_tier: shipping.shippingTier,
        items: shipping.items.map(i => ({
          item_id: i.id,
          item_name: i.name,
          item_category: i.category,
          price: i.price,
          quantity: i.quantity,
        })),
      });
    }

    // TikTok
    if (this.config.tiktok_enabled) {
      trackTikTokEvent('AddShippingInfo', {
        content_ids: shipping.items.map(i => i.id),
        content_type: 'product',
        value: shipping.value,
        currency,
      }, eventId);
    }
  }

  // Track payment info added
  trackAddPaymentInfo(payment: {
    value: number;
    currency?: string;
    paymentMethod: string;
    items: Array<{ id: string; name: string; price: number; quantity: number; category?: string }>;
  }): void {
    const eventId = generateEventId();
    const currency = payment.currency || 'BRL';

    // Meta - AddPaymentInfo standard event
    if (this.config.meta_enabled) {
      trackMetaEvent('AddPaymentInfo', {
        content_ids: payment.items.map(i => i.id),
        content_type: 'product',
        value: payment.value,
        currency,
        contents: payment.items.map(i => ({
          id: i.id,
          quantity: i.quantity,
        })),
      }, eventId);
    }

    // Google - add_payment_info
    if (this.config.google_enabled) {
      trackGoogleEvent('add_payment_info', {
        currency,
        value: payment.value,
        payment_type: payment.paymentMethod,
        items: payment.items.map(i => ({
          item_id: i.id,
          item_name: i.name,
          item_category: i.category,
          price: i.price,
          quantity: i.quantity,
        })),
      });
    }

    // TikTok
    if (this.config.tiktok_enabled) {
      trackTikTokEvent('AddPaymentInfo', {
        content_ids: payment.items.map(i => i.id),
        content_type: 'product',
        value: payment.value,
        currency,
      }, eventId);
    }
  }
}
