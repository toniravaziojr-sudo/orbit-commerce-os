// Checkout Session Management - Instrumentação para rastrear checkouts abandonados

const CHECKOUT_SESSION_KEY = 'cc_checkout_session';

/**
 * Get or create checkout session ID, scoped by tenant slug and cart signature
 * Persists in localStorage to survive page reloads
 */
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

export function getOrCreateCheckoutSessionId(tenantSlug: string): string {
  const storageKey = `${CHECKOUT_SESSION_KEY}_${tenantSlug}`;
  let sessionId = localStorage.getItem(storageKey);
  if (!sessionId) {
    sessionId = generateUUID();
    localStorage.setItem(storageKey, sessionId);
  }
  return sessionId;
}

export function getCheckoutSessionId(tenantSlug: string): string | null {
  const storageKey = `${CHECKOUT_SESSION_KEY}_${tenantSlug}`;
  return localStorage.getItem(storageKey);
}

export function clearCheckoutSessionId(tenantSlug: string): void {
  const storageKey = `${CHECKOUT_SESSION_KEY}_${tenantSlug}`;
  localStorage.removeItem(storageKey);
}

export interface CheckoutSessionParams {
  tenantSlug: string;
  cartItems?: unknown[];
  totalEstimated?: number;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  region?: string;
  step?: string;
}

export async function startCheckoutSession(params: CheckoutSessionParams): Promise<{ success: boolean; sessionId: string }> {
  const sessionId = getOrCreateCheckoutSessionId(params.tenantSlug);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/checkout-session-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tenant_slug: params.tenantSlug,
        customer_email: params.customerEmail?.toLowerCase().trim(),
        customer_phone: params.customerPhone?.replace(/\D/g, ''),
        customer_name: params.customerName,
        region: params.region,
        total_estimated: params.totalEstimated,
        items_snapshot: params.cartItems,
      }),
    });

    if (!response.ok) {
      console.error('[checkout-session] Start failed:', await response.text());
      return { success: false, sessionId };
    }

    console.log('[checkout-session] Session started:', sessionId);
    return { success: true, sessionId };
  } catch (error) {
    console.error('[checkout-session] Error starting session:', error);
    return { success: false, sessionId };
  }
}

export async function heartbeatCheckoutSession(params: CheckoutSessionParams): Promise<void> {
  const sessionId = getCheckoutSessionId(params.tenantSlug);
  if (!sessionId) return;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    await fetch(`${supabaseUrl}/functions/v1/checkout-session-heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tenant_slug: params.tenantSlug,
        customer_email: params.customerEmail?.toLowerCase().trim(),
        customer_phone: params.customerPhone?.replace(/\D/g, ''),
        customer_name: params.customerName,
        region: params.region,
        total_estimated: params.totalEstimated,
        items_snapshot: params.cartItems,
        step: params.step,
      }),
    });
  } catch (error) {
    console.error('[checkout-session] Heartbeat error:', error);
  }
}

export async function completeCheckoutSession(params: {
  tenantSlug: string;
  orderId: string;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<void> {
  const sessionId = getCheckoutSessionId(params.tenantSlug);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    await fetch(`${supabaseUrl}/functions/v1/checkout-session-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tenant_slug: params.tenantSlug,
        order_id: params.orderId,
        customer_email: params.customerEmail?.toLowerCase().trim(),
        customer_phone: params.customerPhone?.replace(/\D/g, ''),
      }),
    });

    // Limpar sessão após completar
    clearCheckoutSessionId(params.tenantSlug);
    console.log('[checkout-session] Session completed and cleared');
  } catch (error) {
    console.error('[checkout-session] Complete error:', error);
  }
}

/**
 * End checkout session (mark as abandoned) when user exits checkout page
 * Uses sendBeacon for reliable delivery even when page is closing
 */
export function endCheckoutSession(tenantSlug: string): void {
  const sessionId = getCheckoutSessionId(tenantSlug);
  if (!sessionId) {
    console.log('[checkout-session] No session to end');
    return;
  }

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/checkout-session-end`;
  const payload = JSON.stringify({
    session_id: sessionId,
    tenant_slug: tenantSlug,
  });

  // Try sendBeacon first (most reliable for page unload)
  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: 'application/json' });
    const sent = navigator.sendBeacon(url, blob);
    console.log('[checkout-session] Beacon sent:', sent);
    if (sent) return;
  }

  // Fallback to fetch with keepalive
  try {
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(err => console.error('[checkout-session] End fallback failed:', err));
  } catch (error) {
    console.error('[checkout-session] End error:', error);
  }
}
