// Checkout Session Management - Instrumentação para rastrear checkouts abandonados

const CHECKOUT_SESSION_KEY = 'checkout_session_id';

export function getOrCreateCheckoutSessionId(): string {
  let sessionId = localStorage.getItem(CHECKOUT_SESSION_KEY);
  if (!sessionId) {
    sessionId = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem(CHECKOUT_SESSION_KEY, sessionId);
  }
  return sessionId;
}

export function clearCheckoutSessionId(): void {
  localStorage.removeItem(CHECKOUT_SESSION_KEY);
}

export async function startCheckoutSession(params: {
  tenantId: string;
  cartId?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  region?: string;
  totalEstimated?: number;
  itemsSnapshot?: unknown[];
}): Promise<{ success: boolean; sessionId: string }> {
  const sessionId = getOrCreateCheckoutSessionId();
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/checkout-session-start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tenant_id: params.tenantId,
        cart_id: params.cartId,
        customer_email: params.customerEmail?.toLowerCase().trim(),
        customer_phone: params.customerPhone?.replace(/\D/g, ''),
        customer_name: params.customerName,
        region: params.region,
        total_estimated: params.totalEstimated,
        items_snapshot: params.itemsSnapshot,
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

export async function heartbeatCheckoutSession(params: {
  tenantId: string;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  region?: string;
  totalEstimated?: number;
  itemsSnapshot?: unknown[];
  step?: string;
}): Promise<void> {
  const sessionId = localStorage.getItem(CHECKOUT_SESSION_KEY);
  if (!sessionId) return;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    await fetch(`${supabaseUrl}/functions/v1/checkout-session-heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tenant_id: params.tenantId,
        customer_email: params.customerEmail?.toLowerCase().trim(),
        customer_phone: params.customerPhone?.replace(/\D/g, ''),
        customer_name: params.customerName,
        region: params.region,
        total_estimated: params.totalEstimated,
        items_snapshot: params.itemsSnapshot,
        step: params.step,
      }),
    });
  } catch (error) {
    console.error('[checkout-session] Heartbeat error:', error);
  }
}

export async function completeCheckoutSession(params: {
  tenantId: string;
  orderId: string;
  customerEmail?: string;
  customerPhone?: string;
}): Promise<void> {
  const sessionId = localStorage.getItem(CHECKOUT_SESSION_KEY);
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

  try {
    await fetch(`${supabaseUrl}/functions/v1/checkout-session-complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        session_id: sessionId,
        tenant_id: params.tenantId,
        order_id: params.orderId,
        customer_email: params.customerEmail?.toLowerCase().trim(),
        customer_phone: params.customerPhone?.replace(/\D/g, ''),
      }),
    });

    // Limpar sessão após completar
    clearCheckoutSessionId();
    console.log('[checkout-session] Session completed and cleared');
  } catch (error) {
    console.error('[checkout-session] Complete error:', error);
  }
}
