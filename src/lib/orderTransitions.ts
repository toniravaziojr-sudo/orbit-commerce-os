/**
 * Espelho client-side da máquina de estados de Pedidos.
 * Fonte de verdade: supabase/functions/core-orders/index.ts
 * 
 * Uso: detectar se uma transição é "natural" (segue o fluxo)
 * ou "override" (precisa confirmação admin).
 * 
 * IMPORTANTE: Este arquivo é apenas para a UI saber se deve
 * mostrar o dialog de confirmação. A validação real ocorre
 * no servidor (core-orders), que é a única fonte de verdade.
 */

export const ORDER_TRANSITIONS: Record<string, string[]> = {
  awaiting_confirmation: ['ready_to_invoice', 'payment_expired'],
  ready_to_invoice: ['invoice_pending_sefaz', 'invoice_rejected', 'payment_expired'],
  invoice_pending_sefaz: ['invoice_authorized', 'invoice_rejected'],
  invoice_authorized: ['invoice_issued', 'invoice_cancelled'],
  invoice_issued: ['dispatched', 'invoice_cancelled'],
  dispatched: ['completed', 'returning'],
  completed: ['returning'],
  returning: [],
  payment_expired: [],
  cancelled_by_user: [],
  invoice_rejected: ['ready_to_invoice'],
  invoice_cancelled: [],
  chargeback_detected: ['chargeback_lost', 'ready_to_invoice', 'invoice_issued', 'dispatched', 'completed'],
  chargeback_lost: [],
  pending: ['awaiting_confirmation', 'ready_to_invoice', 'paid', 'cancelled', 'payment_expired'],
  awaiting_payment: ['awaiting_confirmation', 'ready_to_invoice', 'paid', 'cancelled', 'payment_expired'],
  paid: ['ready_to_invoice', 'processing', 'dispatched', 'cancelled'],
  processing: ['ready_to_invoice', 'dispatched', 'shipped', 'cancelled'],
  shipped: ['dispatched', 'in_transit', 'delivered', 'completed', 'cancelled'],
  in_transit: ['dispatched', 'delivered', 'completed', 'returned'],
  delivered: ['completed', 'returned', 'returning'],
  cancelled: ['payment_expired'],
  returned: ['returning'],
};

export const PAYMENT_TRANSITIONS: Record<string, string[]> = {
  awaiting_payment: ['paid', 'declined', 'cancelled'],
  paid: ['refunded', 'under_review'],
  declined: ['awaiting_payment', 'cancelled'],
  cancelled: [],
  refunded: [],
  under_review: ['paid', 'refunded'],
};

export const SHIPPING_TRANSITIONS: Record<string, string[]> = {
  awaiting_shipment: ['label_generated', 'problem'],
  label_generated: ['shipped', 'problem'],
  shipped: ['in_transit', 'problem'],
  in_transit: ['arriving', 'delivered', 'problem', 'awaiting_pickup'],
  arriving: ['delivered', 'problem'],
  delivered: ['returning'],
  problem: ['awaiting_shipment', 'returning', 'returned'],
  awaiting_pickup: ['delivered', 'returning'],
  returning: ['returned'],
  returned: [],
};

export function isNaturalTransition(
  transitions: Record<string, string[]>,
  from: string,
  to: string,
): boolean {
  if (from === to) return true;
  const allowed = transitions[from];
  return Array.isArray(allowed) && allowed.includes(to);
}
