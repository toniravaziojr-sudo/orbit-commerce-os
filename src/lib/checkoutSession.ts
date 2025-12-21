// Checkout Session Management - Instrumentação para rastrear checkouts abandonados

const CHECKOUT_SESSION_KEY = 'cc_checkout_session';

/**
 * Generate a valid UUID v4
 */
function generateUUID(): string {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback: generate a valid UUID v4 format
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Get storage key for checkout session
 * Uses host as primary key for custom domains
 */
function getStorageKey(): string {
  const host = window.location.host.toLowerCase().replace(/^www\./, '');
  return `${CHECKOUT_SESSION_KEY}_${host}`;
}

/**
 * Get or create checkout session ID
 */
export function getOrCreateCheckoutSessionId(): string {
  const storageKey = getStorageKey();
  let sessionId = localStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = generateUUID();
    localStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
}

export function getCheckoutSessionId(): string | null {
  const storageKey = getStorageKey();
  return localStorage.getItem(storageKey);
}

export function clearCheckoutSessionId(): void {
  const storageKey = getStorageKey();
  localStorage.removeItem(storageKey);
}

/**
 * Get common headers - use text/plain to avoid CORS preflight
 * This makes the request a "simple request" that doesn't trigger preflight
 */
function getSimpleHeaders(): Record<string, string> {
  return {
    'Content-Type': 'text/plain',
  };
}

export interface CheckoutSessionParams {
  tenantSlug?: string;
  cartItems?: unknown[];
  totalEstimated?: number;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  region?: string;
  step?: string;
}

export async function startCheckoutSession(params: CheckoutSessionParams): Promise<{ success: boolean; sessionId: string }> {
  const sessionId = getOrCreateCheckoutSessionId();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  
  if (!supabaseUrl) {
    return { success: false, sessionId };
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/checkout-session-start`, {
      method: 'POST',
      headers: getSimpleHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        tenant_slug: params.tenantSlug || undefined,
        customer_email: params.customerEmail?.toLowerCase().trim(),
        customer_phone: params.customerPhone?.replace(/\D/g, ''),
        customer_name: params.customerName,
        region: params.region,
        total_estimated: params.totalEstimated,
        items_snapshot: params.cartItems,
        store_host: window.location.host,
      }),
    });

    if (!response.ok) {
      return { success: false, sessionId };
    }

    await response.json();
    return { success: true, sessionId };
  } catch (error) {
    console.error('[checkout-session] Start error:', error);
    return { success: false, sessionId };
  }
}

export async function heartbeatCheckoutSession(params: CheckoutSessionParams): Promise<void> {
  const sessionId = getCheckoutSessionId();
  if (!sessionId) return;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    await fetch(`${supabaseUrl}/functions/v1/checkout-session-heartbeat`, {
      method: 'POST',
      headers: getSimpleHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        tenant_slug: params.tenantSlug || undefined,
        customer_email: params.customerEmail?.toLowerCase().trim(),
        customer_phone: params.customerPhone?.replace(/\D/g, ''),
        customer_name: params.customerName,
        region: params.region,
        total_estimated: params.totalEstimated,
        items_snapshot: params.cartItems,
        step: params.step,
        store_host: window.location.host,
      }),
    });
  } catch (error) {
    console.error('[checkout-session] Heartbeat error:', error);
  }
}

export async function completeCheckoutSession(params: {
  tenantSlug?: string;
  orderId: string;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<void> {
  const sessionId = getCheckoutSessionId();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    await fetch(`${supabaseUrl}/functions/v1/checkout-session-complete`, {
      method: 'POST',
      headers: getSimpleHeaders(),
      body: JSON.stringify({
        session_id: sessionId,
        tenant_slug: params.tenantSlug || undefined,
        order_id: params.orderId,
        customer_email: params.customerEmail?.toLowerCase().trim(),
        customer_phone: params.customerPhone?.replace(/\D/g, ''),
        store_host: window.location.host,
      }),
    });

    // Limpar sessão após completar
    clearCheckoutSessionId();
    console.log('[checkout-session] Session completed and cleared');
  } catch (error) {
    console.error('[checkout-session] Complete error:', error);
  }
}

/**
 * End checkout session (mark as abandoned) when user exits checkout page
 * Uses sendBeacon with text/plain for reliable delivery without CORS preflight
 */
export function endCheckoutSession(): void {
  const sessionId = getCheckoutSessionId();
  if (!sessionId) return;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  if (!supabaseUrl) return;

  const url = `${supabaseUrl}/functions/v1/checkout-session-end`;
  const payload = JSON.stringify({
    session_id: sessionId,
    store_host: window.location.host,
  });

  // Use sendBeacon with text/plain (no CORS preflight)
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'text/plain' });
    navigator.sendBeacon(url, blob);
    return;
  }

  // Fallback: fetch with keepalive
  fetch(url, {
    method: 'POST',
    headers: getSimpleHeaders(),
    body: payload,
    keepalive: true,
  }).catch(() => {});
}
