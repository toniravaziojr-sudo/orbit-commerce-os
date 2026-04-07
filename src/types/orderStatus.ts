/**
 * Status Types for Orders
 * 
 * These types are the canonical source of truth for all order-related statuses.
 * Modules (Fiscal, Notificações, etc.) should import and use these types via "API interna".
 * 
 * === FLUXO DO STATUS DO PEDIDO (coluna "Status") ===
 * 
 * 1. awaiting_confirmation  → Pedido criado, aguardando pagamento
 * 2. ready_to_invoice        → Pagamento aprovado, pronto para emitir NF (automático)
 * 3. invoice_pending_sefaz   → NF submetida à SEFAZ, aguardando resposta
 * 4. invoice_authorized      → SEFAZ aprovou, NF enviada ao cliente
 * 5. invoice_issued          → NF impressa, sendo preparada para envio
 * 6. dispatched              → Pacote despachado
 * 7. completed               → Pedido chegou ao destino (concluído)
 * 8. returning               → NF de devolução emitida
 * 9. payment_expired         → Pedido não pago que expirou
 * 10. invoice_rejected       → SEFAZ rejeitou a NF
 * 11. invoice_cancelled      → NF cancelada após autorização
 * 12. chargeback_detected    → Chargeback detectado — em análise (NOVO v2026-04-07)
 * 13. chargeback_lost        → Chargeback perdido — pedido estornado (NOVO v2026-04-07)
 * 
 * Colunas Envio e Pagamento: independentes, sem mudança.
 */

// ==========================================
// ORDER STATUS (Status do Pedido - Trabalho Interno)
// ==========================================
export type OrderStatus = 
  | 'awaiting_confirmation'    // Aguardando confirmação - Pedido não pago
  | 'ready_to_invoice'         // Pronto para emitir NF - Pagamento confirmado
  | 'invoice_pending_sefaz'    // Pendente SEFAZ - NF submetida
  | 'invoice_authorized'       // NF Autorizada - SEFAZ aprovou, enviada ao cliente
  | 'invoice_issued'           // NF Emitida - Impressa, preparando envio
  | 'dispatched'               // Despachado - Pacote despachado
  | 'completed'                // Concluído - Chegou ao destino
  | 'returning'                // Em devolução - NF de devolução emitida
  | 'payment_expired'          // Pagamento expirado - Não pago, expirou
  | 'invoice_rejected'         // NF Rejeitada - SEFAZ rejeitou
  | 'invoice_cancelled'        // NF Cancelada - Cancelada pós-autorização
  | 'chargeback_detected'      // Chargeback detectado - Em análise
  | 'chargeback_lost'          // Chargeback perdido - Estornado por disputa
  | 'chargeback_recovered';    // Chargeback recuperado - Resolvido a favor da loja

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color?: string;
}> = {
  awaiting_confirmation: { label: 'Aguardando confirmação', variant: 'outline' },
  ready_to_invoice: { label: 'Pronto para emitir NF', variant: 'secondary' },
  invoice_pending_sefaz: { label: 'Pendente SEFAZ', variant: 'outline' },
  invoice_authorized: { label: 'NF Autorizada', variant: 'default' },
  invoice_issued: { label: 'NF Emitida', variant: 'default' },
  dispatched: { label: 'Despachado', variant: 'default' },
  completed: { label: 'Concluído', variant: 'default' },
  returning: { label: 'Em devolução', variant: 'destructive' },
  payment_expired: { label: 'Pagamento expirado', variant: 'destructive' },
  invoice_rejected: { label: 'NF Rejeitada', variant: 'destructive' },
  invoice_cancelled: { label: 'NF Cancelada', variant: 'destructive' },
  chargeback_detected: { label: 'Chargeback detectado', variant: 'outline', color: 'text-yellow-700' },
  chargeback_lost: { label: 'Chargeback perdido', variant: 'destructive' },
  chargeback_recovered: { label: 'Chargeback recuperado', variant: 'default', color: 'text-green-700' },
};

// ==========================================
// PAYMENT STATUS (Status de Pagamento)
// ==========================================
export type PaymentStatus = 
  | 'awaiting_payment'  // Aguardando pagamento
  | 'paid'              // Pago
  | 'declined'          // Recusado
  | 'cancelled'         // Cancelado
  | 'refunded'          // Estornado
  | 'under_review';     // Em análise — chargeback em andamento

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  awaiting_payment: { label: 'Aguardando pagamento', variant: 'outline' },
  paid: { label: 'Pago', variant: 'default' },
  declined: { label: 'Recusado', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  refunded: { label: 'Estornado', variant: 'destructive' },
  under_review: { label: 'Em análise', variant: 'outline', color: 'text-yellow-700' },
};

// ==========================================
// SHIPPING STATUS (Status de Envio) — SEM MUDANÇA
// ==========================================
export type ShippingStatus = 
  | 'awaiting_shipment'  // Aguardando envio
  | 'label_generated'    // Etiqueta gerada
  | 'shipped'            // Enviado
  | 'in_transit'         // Em trânsito
  | 'arriving'           // Chegando
  | 'delivered'          // Entregue
  | 'problem'            // Problema no envio
  | 'awaiting_pickup'    // Aguardando retirada
  | 'returning'          // Em devolução
  | 'returned';          // Devolvido

export const SHIPPING_STATUS_CONFIG: Record<ShippingStatus, { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  awaiting_shipment: { label: 'Aguardando envio', variant: 'outline' },
  label_generated: { label: 'Etiqueta gerada', variant: 'secondary' },
  shipped: { label: 'Enviado', variant: 'default' },
  in_transit: { label: 'Em trânsito', variant: 'default' },
  arriving: { label: 'Chegando', variant: 'default' },
  delivered: { label: 'Entregue', variant: 'default' },
  problem: { label: 'Problema no envio', variant: 'destructive' },
  awaiting_pickup: { label: 'Aguardando retirada', variant: 'outline' },
  returning: { label: 'Em devolução', variant: 'destructive' },
  returned: { label: 'Devolvido', variant: 'destructive' },
};

// ==========================================
// LEGACY MAPPINGS (for backward compatibility)
// Maps old DB enum values to new OrderStatus display values
// ==========================================

export const LEGACY_ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  // New values (identity)
  awaiting_confirmation: 'awaiting_confirmation',
  ready_to_invoice: 'ready_to_invoice',
  invoice_pending_sefaz: 'invoice_pending_sefaz',
  invoice_authorized: 'invoice_authorized',
  invoice_issued: 'invoice_issued',
  dispatched: 'dispatched',
  completed: 'completed',
  returning: 'returning',
  payment_expired: 'payment_expired',
  invoice_rejected: 'invoice_rejected',
  invoice_cancelled: 'invoice_cancelled',
  chargeback_detected: 'chargeback_detected',
  chargeback_lost: 'chargeback_lost',
  chargeback_recovered: 'chargeback_recovered',
  // Legacy values → new values
  pending: 'awaiting_confirmation',
  awaiting_payment: 'awaiting_confirmation',
  paid: 'ready_to_invoice',
  processing: 'ready_to_invoice',
  shipped: 'dispatched',
  in_transit: 'dispatched',
  delivered: 'completed',
  cancelled: 'payment_expired',
  returned: 'returning',
  // Extra old values
  approved: 'ready_to_invoice',
  refunded: 'payment_expired',
};

export const LEGACY_PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  pending: 'awaiting_payment',
  processing: 'awaiting_payment',
  approved: 'paid',
  declined: 'declined',
  refunded: 'refunded',
  cancelled: 'cancelled',
  // Identity
  awaiting_payment: 'awaiting_payment',
  paid: 'paid',
  under_review: 'under_review',
  // Legacy chargeback status → new under_review
  chargeback_requested: 'under_review',
};

export const LEGACY_SHIPPING_STATUS_MAP: Record<string, ShippingStatus> = {
  pending: 'awaiting_shipment',
  processing: 'label_generated',
  shipped: 'shipped',
  in_transit: 'in_transit',
  out_for_delivery: 'arriving',
  delivered: 'delivered',
  returned: 'returned',
  failed: 'problem',
  // Identity
  awaiting_shipment: 'awaiting_shipment',
  label_generated: 'label_generated',
  arriving: 'arriving',
  problem: 'problem',
  awaiting_pickup: 'awaiting_pickup',
  returning: 'returning',
};

// Utility functions to normalize status from DB
export function normalizeOrderStatus(status: string | null): OrderStatus {
  if (!status) return 'awaiting_confirmation';
  return LEGACY_ORDER_STATUS_MAP[status] || 'awaiting_confirmation';
}

export function normalizePaymentStatus(status: string | null): PaymentStatus {
  if (!status) return 'awaiting_payment';
  return LEGACY_PAYMENT_STATUS_MAP[status] || 'awaiting_payment';
}

export function normalizeShippingStatus(status: string | null): ShippingStatus {
  if (!status) return 'awaiting_shipment';
  return LEGACY_SHIPPING_STATUS_MAP[status] || 'awaiting_shipment';
}
