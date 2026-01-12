/**
 * Status Types for Orders
 * 
 * These types are the canonical source of truth for all order-related statuses.
 * Modules (Fiscal, Notificações, etc.) should import and use these types via "API interna".
 */

// ==========================================
// ORDER STATUS (Status do Pedido)
// ==========================================
export type OrderStatus = 
  | 'pending'       // Pendente - Pedido gerado e não pago
  | 'approved'      // Aprovado - Pedido pago/confirmado
  | 'dispatched'    // Despachado - Pedido com etiqueta gerada
  | 'shipping'      // A caminho - Pedido enviado
  | 'completed'     // Concluído - Pedido entregue
  | 'cancelled'     // Cancelado - Pedido cancelado por falta de pagamento
  | 'returned'      // Devolvido - Pedido enviado mas devolvido
  | 'refunded';     // Estornado - Pagamento estornado

export const ORDER_STATUS_CONFIG: Record<OrderStatus, { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  color?: string;
}> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  approved: { label: 'Aprovado', variant: 'default' },
  dispatched: { label: 'Despachado', variant: 'default' },
  shipping: { label: 'A caminho', variant: 'default' },
  completed: { label: 'Concluído', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  returned: { label: 'Devolvido', variant: 'destructive' },
  refunded: { label: 'Estornado', variant: 'destructive' },
};

// ==========================================
// PAYMENT STATUS (Status de Pagamento)
// ==========================================
export type PaymentStatus = 
  | 'awaiting_payment'  // Aguardando pagamento - Pedido gerado e não pago
  | 'paid'              // Pago - Pedido pago/confirmado
  | 'declined'          // Recusado - Pagamento recusado via cartão
  | 'cancelled'         // Cancelado - Pagamento expirado ou cancelado
  | 'refunded';         // Estornado - Pagamento estornado ao cliente

export const PAYMENT_STATUS_CONFIG: Record<PaymentStatus, { 
  label: string; 
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
}> = {
  awaiting_payment: { label: 'Aguardando pagamento', variant: 'outline' },
  paid: { label: 'Pago', variant: 'default' },
  declined: { label: 'Recusado', variant: 'destructive' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  refunded: { label: 'Estornado', variant: 'destructive' },
};

// ==========================================
// SHIPPING STATUS (Status de Envio)
// ==========================================
export type ShippingStatus = 
  | 'awaiting_shipment'  // Aguardando envio - Pedido pago, aguardando NF
  | 'label_generated'    // Etiqueta gerada - NF emitida e etiqueta gerada
  | 'shipped'            // Enviado - Pedido postado
  | 'in_transit'         // Em trânsito - Primeira atualização do percurso
  | 'arriving'           // Chegando - Em rota de entrega
  | 'delivered'          // Entregue - Pedido entregue ao destinatário
  | 'problem'            // Problema no envio - Extraviado, perdido, etc
  | 'awaiting_pickup'    // Aguardando retirada - Aguardando retirada na agência
  | 'returning'          // Em devolução - Pedido em devolução
  | 'returned';          // Devolvido - Pedido chegou ao remetente

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
// ==========================================

// Map old order status values to new ones
export const LEGACY_ORDER_STATUS_MAP: Record<string, OrderStatus> = {
  pending: 'pending',
  awaiting_payment: 'pending',
  paid: 'approved',
  processing: 'approved',
  shipped: 'shipping',
  in_transit: 'shipping',
  delivered: 'completed',
  cancelled: 'cancelled',
  returned: 'returned',
};

// Map old payment status values to new ones
export const LEGACY_PAYMENT_STATUS_MAP: Record<string, PaymentStatus> = {
  pending: 'awaiting_payment',
  processing: 'awaiting_payment',
  approved: 'paid',
  declined: 'declined',
  refunded: 'refunded',
  cancelled: 'cancelled',
};

// Map old shipping status values to new ones
export const LEGACY_SHIPPING_STATUS_MAP: Record<string, ShippingStatus> = {
  pending: 'awaiting_shipment',
  processing: 'label_generated',
  shipped: 'shipped',
  in_transit: 'in_transit',
  out_for_delivery: 'arriving',
  delivered: 'delivered',
  returned: 'returned',
  failed: 'problem',
};

// Utility functions to normalize status from DB
export function normalizeOrderStatus(status: string | null): OrderStatus {
  if (!status) return 'pending';
  return LEGACY_ORDER_STATUS_MAP[status] || 'pending';
}

export function normalizePaymentStatus(status: string | null): PaymentStatus {
  if (!status) return 'awaiting_payment';
  return LEGACY_PAYMENT_STATUS_MAP[status] || 'awaiting_payment';
}

export function normalizeShippingStatus(status: string | null): ShippingStatus {
  if (!status) return 'awaiting_shipment';
  return LEGACY_SHIPPING_STATUS_MAP[status] || 'awaiting_shipment';
}
