// ============================================================
// Pipeline Básica IA — F2 (Progressão Comercial)
// Máquina de estados e tipos canônicos.
// ============================================================
//
// Estados oficiais da F2 (alinhados com sales-state-machine.ts da F1):
// - greeting           → recepção / primeira interação do turno
// - discovery          → qualificação enxuta (máx 2 turnos)
// - recommendation     → apresentar até 3 opções
// - product_detail     → cliente citou produto pelo nome → falar daquele produto
// - decision           → intenção de compra clara → avançar
// - checkout_assist    → carrinho ativo / link / pagamento
// - support            → assunto pós-venda (pedido existente) → fora do funil
// - handoff            → escalada humana (terminal)
//
// Os 4 últimos estados da F1 (cart/checkout/post_sale) ficam mapeados:
//   cart       → checkout_assist
//   checkout   → checkout_assist
//   post_sale  → support
// ============================================================

export type PipelineState =
  | "greeting"
  | "discovery"
  | "recommendation"
  | "product_detail"
  | "decision"
  | "checkout_assist"
  | "support"
  | "handoff";

export const PIPELINE_STATES: PipelineState[] = [
  "greeting",
  "discovery",
  "recommendation",
  "product_detail",
  "decision",
  "checkout_assist",
  "support",
  "handoff",
];

// Rank usado para evitar regressão silenciosa.
// Suporte e handoff são ramos terminais (rank alto).
export const STATE_RANK: Record<PipelineState, number> = {
  greeting: 0,
  discovery: 1,
  recommendation: 2,
  product_detail: 3,
  decision: 4,
  checkout_assist: 5,
  support: 90,
  handoff: 99,
};

// Mapeia estados legados da F1 (sales_state coluna) para os estados da F2.
export function normalizeLegacyState(raw: string | null | undefined): PipelineState {
  if (!raw) return "greeting";
  const s = String(raw).toLowerCase().trim();
  switch (s) {
    case "consideration":
      return "product_detail";
    case "cart":
    case "checkout":
      return "checkout_assist";
    case "post_sale":
      return "support";
    case "greeting":
    case "discovery":
    case "recommendation":
    case "product_detail":
    case "decision":
    case "checkout_assist":
    case "support":
    case "handoff":
      return s as PipelineState;
    default:
      return "greeting";
  }
}

// Volta para o vocabulário antigo só na hora de gravar em conversations.sales_state
// (mantém compatibilidade com a coluna existente sem migração).
export function toLegacyState(state: PipelineState): string {
  switch (state) {
    case "product_detail":
      return "consideration";
    case "checkout_assist":
      return "checkout";
    case "support":
      return "post_sale";
    default:
      return state;
  }
}
