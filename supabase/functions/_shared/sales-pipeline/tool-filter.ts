// ============================================================
// Pipeline Básica IA — F2
// Filtro de tools por estado comercial.
//
// REGRA: a IA só enxerga o subconjunto de tools relevante para o estado atual.
// Isso evita que o modelo chame add_to_cart na saudação ou volte a buscar
// produto quando o cliente já decidiu comprar.
//
// Mapa aprovado pelo usuário (F2):
//   greeting          → nenhuma
//   discovery         → search_products, list_categories*
//   recommendation    → search_products, get_product_details
//   product_detail    → get_product_details, check_stock*, send_product_image
//   decision          → add_to_cart, get_product_details, check_stock*, apply_coupon
//   checkout_assist   → view_cart, generate_checkout_link, apply_coupon
//   support           → lookup_order*, request_human_handoff
//   handoff           → request_human_handoff
//
// (*) Tools "lógicas" que ainda não existem como entrada própria no agente:
//     - list_categories  → fica para F3 (hoje cai em search_products genérico)
//     - check_stock      → coberto por get_product_details (campo stock_quantity)
//     - lookup_order     → fica para F3 (hoje cai em lookup_customer + handoff)
// ============================================================

import type { PipelineState } from "./states.ts";

// Tools REAIS já implementadas no ai-support-chat (SALES_TOOLS).
// Quando uma tool "lógica" do mapa F2 ainda não existe, mapeamos para a
// tool real mais próxima e registramos a lacuna para F3.
export const TOOLS_BY_STATE: Record<PipelineState, string[]> = {
  greeting: [],

  discovery: [
    "search_products",
    // list_categories → cai em search_products até F3
  ],

  recommendation: [
    "search_products",
    "get_product_details",
    "recommend_related_products",
  ],

  product_detail: [
    "get_product_details",
    "get_product_variants",
    "send_product_image",
    // check_stock coberto por get_product_details
  ],

  decision: [
    "add_to_cart",
    "get_product_details",
    "get_product_variants",
    "apply_coupon",
    "check_coupon",
  ],

  checkout_assist: [
    "view_cart",
    "remove_from_cart",
    "generate_checkout_link",
    "apply_coupon",
    "check_coupon",
    "lookup_customer",
    "save_customer_data",
    "update_customer_record",
    "calculate_shipping",
    "check_upsell_offers",
    "check_customer_coupon_eligibility",
  ],

  support: [
    "lookup_customer",
    "request_human_handoff",
    // lookup_order fica para F3
  ],

  handoff: [
    "request_human_handoff",
  ],
};

// Filtra a lista completa de tools disponíveis e retorna SÓ as permitidas.
// Mantém a definição original da tool (schema, parameters etc.).
export function filterToolsForState<T extends { type: string; function: { name: string } }>(
  allTools: T[],
  state: PipelineState
): T[] {
  const allowed = new Set(TOOLS_BY_STATE[state] || []);
  if (allowed.size === 0) return [];
  return allTools.filter(t => allowed.has(t.function.name));
}

// Verifica se uma tool específica é permitida no estado atual.
// Usado para bloquear tool_calls que escapem do filtro (defesa em profundidade).
export function isToolAllowedInState(toolName: string, state: PipelineState): boolean {
  const allowed = TOOLS_BY_STATE[state] || [];
  return allowed.includes(toolName);
}
