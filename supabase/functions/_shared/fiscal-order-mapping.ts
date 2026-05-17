// =====================================================================
// FISCAL ORDER MAPPING — Helper compartilhado
// Mapeia dados comerciais do pedido (transporte + pagamento) para os
// códigos SEFAZ usados no Pedido de Venda fiscal e na NF-e.
//
// Usado por:
//   - supabase/functions/fiscal-create-draft (criação manual)
//   - supabase/functions/fiscal-auto-create-drafts (automação de pedidos pagos)
//
// Fonte de verdade: documentos fiscais (Layer 3)
//   - docs/especificacoes/erp/erp-fiscal.md
//   - docs/especificacoes/fiscal/campos-nfe-referencia.md
// =====================================================================

/**
 * Mapeia order.payment_method → tPag SEFAZ (Meio de Pagamento).
 * Códigos oficiais SEFAZ (Tabela tPag):
 *   01 Dinheiro, 02 Cheque, 03 Cartão de Crédito, 04 Cartão de Débito,
 *   05 Crédito loja, 10 Vale Alimentação, 15 Boleto Bancário,
 *   16 Depósito, 17 Pix, 18 Transferência bancária, 19 Cashback,
 *   90 Sem pagamento, 99 Outros
 */
export function mapPaymentMethodToSefaz(paymentMethod: string | null | undefined): {
  pagamento_meio: string;
  pagamento_indicador: number; // 0 = à vista, 1 = a prazo
} {
  const method = String(paymentMethod || '').toLowerCase().trim();

  switch (method) {
    case 'pix':
      return { pagamento_meio: '17', pagamento_indicador: 0 };
    case 'boleto':
    case 'boleto_bancario':
      return { pagamento_meio: '15', pagamento_indicador: 1 };
    case 'credit_card':
    case 'cartao_credito':
    case 'credito':
      return { pagamento_meio: '03', pagamento_indicador: 1 };
    case 'debit_card':
    case 'cartao_debito':
    case 'debito':
      return { pagamento_meio: '04', pagamento_indicador: 0 };
    case 'dinheiro':
    case 'cash':
      return { pagamento_meio: '01', pagamento_indicador: 0 };
    case 'transferencia':
    case 'transfer':
      return { pagamento_meio: '18', pagamento_indicador: 0 };
    default:
      return { pagamento_meio: '99', pagamento_indicador: 0 };
  }
}

/**
 * Mapeia transporte do pedido → modalidade SEFAZ + transportadora.
 * Códigos modalidade_frete SEFAZ:
 *   0 Por conta do Remetente (CIF)
 *   1 Por conta do Destinatário (FOB)
 *   2 Por conta de Terceiros
 *   3 Transporte Próprio por conta do Remetente
 *   4 Transporte Próprio por conta do Destinatário
 *   9 Sem ocorrência de transporte
 *
 * Regra de negócio:
 *   - Sem frete (free_shipping=true ou shipping_total=0 e sem endereço): 9
 *   - Frete grátis com envio (free_shipping=true e há transportadora): 0 (loja absorve)
 *   - Loja envia (qualquer transportadora definida): 0 (CIF)
 *   - Sem dados suficientes: 0 (default seguro — loja envia)
 */
export function mapShippingToSefaz(order: {
  free_shipping?: boolean | null;
  shipping_total?: number | null;
  shipping_carrier?: string | null;
  shipping_method_name?: string | null;
  shipping_service_name?: string | null;
  shipping_street?: string | null;
}): {
  modalidade_frete: string;
  transportadora_nome: string | null;
} {
  const hasShippingAddress = !!order.shipping_street;
  const carrier =
    order.shipping_carrier ||
    order.shipping_service_name ||
    order.shipping_method_name ||
    null;

  // Sem endereço de entrega: provavelmente retirada / sem transporte
  if (!hasShippingAddress) {
    return { modalidade_frete: '9', transportadora_nome: null };
  }

  // Tem endereço → loja envia (CIF), com ou sem cobrança de frete
  return {
    modalidade_frete: '0',
    transportadora_nome: carrier,
  };
}

/**
 * Bloco completo de dados auto-herdados do pedido para o draft fiscal.
 * Retorna apenas os campos que devem ser gravados em fiscal_invoices.
 */
export function buildFiscalOrderInheritance(order: {
  total?: number | null;
  payment_method?: string | null;
  free_shipping?: boolean | null;
  shipping_total?: number | null;
  shipping_carrier?: string | null;
  shipping_method_name?: string | null;
  shipping_service_name?: string | null;
  shipping_street?: string | null;
}) {
  const payment = mapPaymentMethodToSefaz(order.payment_method);
  const shipping = mapShippingToSefaz(order);

  return {
    // Pagamento
    pagamento_meio: payment.pagamento_meio,
    pagamento_indicador: payment.pagamento_indicador,
    pagamento_valor: Number(order.total || 0),
    // Transporte
    modalidade_frete: shipping.modalidade_frete,
    transportadora_nome: shipping.transportadora_nome,
  };
}
