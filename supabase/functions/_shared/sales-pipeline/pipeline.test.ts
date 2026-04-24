// ============================================================
// Pipeline Básica IA — F2 — Sub-fase 1.6
// Testes Deno determinísticos do núcleo lógico do pipeline.
// Cobre: states, transitions, tool-filter, variant-gate.
//
// Rodar:  deno test supabase/functions/_shared/sales-pipeline/pipeline.test.ts
// ============================================================

import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

import {
  PIPELINE_STATES,
  STATE_RANK,
  normalizeLegacyState,
  toLegacyState,
} from "./states.ts";
import { decideNextState } from "./transitions.ts";
import { TOOLS_BY_STATE, filterToolsForState, isToolAllowedInState } from "./tool-filter.ts";
import { evaluateVariantGate, buildProductFocus, readProductFocus } from "./variant-gate.ts";

// ---------- helpers ----------
const baseInput = {
  current: "greeting" as const,
  message: "",
  isPureGreeting: false,
  hasActiveCart: false,
  hasCheckoutLink: false,
  toolsCalled: [] as string[],
  discoveryTurnsSoFar: 0,
  productNamesHint: [] as string[],
};

// ============================================================
// states.ts
// ============================================================
Deno.test("states: PIPELINE_STATES contém os 8 estados oficiais", () => {
  assertEquals(PIPELINE_STATES.length, 8);
  assert(PIPELINE_STATES.includes("greeting"));
  assert(PIPELINE_STATES.includes("checkout_assist"));
  assert(PIPELINE_STATES.includes("handoff"));
});

Deno.test("states: STATE_RANK garante anti-regressão (greeting < discovery < ... < checkout_assist)", () => {
  assert(STATE_RANK.greeting < STATE_RANK.discovery);
  assert(STATE_RANK.discovery < STATE_RANK.recommendation);
  assert(STATE_RANK.recommendation < STATE_RANK.product_detail);
  assert(STATE_RANK.product_detail < STATE_RANK.decision);
  assert(STATE_RANK.decision < STATE_RANK.checkout_assist);
  assert(STATE_RANK.support > STATE_RANK.checkout_assist);
  assert(STATE_RANK.handoff > STATE_RANK.support);
});

Deno.test("states: normalizeLegacyState mapeia legados corretamente", () => {
  assertEquals(normalizeLegacyState("consideration"), "product_detail");
  assertEquals(normalizeLegacyState("cart"), "checkout_assist");
  assertEquals(normalizeLegacyState("checkout"), "checkout_assist");
  assertEquals(normalizeLegacyState("post_sale"), "support");
  assertEquals(normalizeLegacyState("greeting"), "greeting");
  assertEquals(normalizeLegacyState(null), "greeting");
  assertEquals(normalizeLegacyState("xyz_invalid"), "greeting");
});

Deno.test("states: toLegacyState volta ao vocabulário antigo", () => {
  assertEquals(toLegacyState("product_detail"), "consideration");
  assertEquals(toLegacyState("checkout_assist"), "checkout");
  assertEquals(toLegacyState("support"), "post_sale");
  assertEquals(toLegacyState("discovery"), "discovery");
});

// ============================================================
// transitions.ts
// ============================================================
Deno.test("transitions: handoff por tool é terminal e prevalece", () => {
  const r = decideNextState({
    ...baseInput,
    current: "decision",
    toolsCalled: ["request_human_handoff"],
    message: "quero comprar",
  });
  assertEquals(r.next, "handoff");
  assertEquals(r.reason, "handoff_requested");
  assert(r.forced);
});

Deno.test("transitions: tópico de pedido existente força support", () => {
  const r = decideNextState({
    ...baseInput,
    current: "discovery",
    message: "cadê meu pedido?",
  });
  assertEquals(r.next, "support");
  assertEquals(r.reason, "support_topic_detected");
});

Deno.test("transitions: sinal de compra avança para decision (vindo de greeting)", () => {
  const r = decideNextState({
    ...baseInput,
    current: "greeting",
    message: "quero comprar esse",
  });
  assertEquals(r.next, "decision");
  assertEquals(r.reason, "buy_signal_detected");
});

Deno.test("transitions: cliente cita produto pelo nome → product_detail", () => {
  const r = decideNextState({
    ...baseInput,
    current: "greeting",
    message: "queria saber mais sobre o Shampoo Premium Black",
    productNamesHint: ["Shampoo Premium Black", "Creme Hidratante"],
  });
  assertEquals(r.next, "product_detail");
  assertEquals(r.reason, "product_mentioned_by_name");
});

Deno.test("transitions: dor declarada em greeting/discovery → recommendation", () => {
  const r = decideNextState({
    ...baseInput,
    current: "discovery",
    message: "queria um shampoo para calvície",
  });
  assertEquals(r.next, "recommendation");
  assertEquals(r.reason, "pain_or_objective_declared_advance_to_recommendation");
});

Deno.test("transitions: discovery limit (>=2 turnos) força recommendation", () => {
  const r = decideNextState({
    ...baseInput,
    current: "discovery",
    message: "ok",
    discoveryTurnsSoFar: 2,
  });
  assertEquals(r.next, "recommendation");
  assertEquals(r.reason, "discovery_limit_reached_advance_to_recommendation");
});

Deno.test("transitions: saudação pura mantém greeting", () => {
  const r = decideNextState({
    ...baseInput,
    current: "greeting",
    message: "oi",
    isPureGreeting: true,
  });
  assertEquals(r.next, "greeting");
  assertEquals(r.reason, "first_contact_pure_greeting");
});

Deno.test("transitions: anti-regressão — checkout_assist NÃO regride para discovery por add_to_cart", () => {
  const r = decideNextState({
    ...baseInput,
    current: "checkout_assist",
    toolsCalled: ["add_to_cart"],
    hasActiveCart: true,
    message: "adiciona mais um",
  });
  // checkout_assist tem rank igual ao alvo → mantém
  assertEquals(r.next, "checkout_assist");
});

Deno.test("transitions: regressão silenciosa bloqueada (decision não volta para discovery por search)", () => {
  const r = decideNextState({
    ...baseInput,
    current: "decision",
    toolsCalled: ["search_products"],
    message: "tem outros?",
  });
  // search_products tentaria recommendation (rank<decision) → bloqueado
  assertEquals(r.next, "decision");
  assertEquals(r.reason, "regression_blocked");
});

Deno.test("transitions: link de checkout gerado força checkout_assist", () => {
  const r = decideNextState({
    ...baseInput,
    current: "decision",
    hasCheckoutLink: true,
    message: "show",
  });
  assertEquals(r.next, "checkout_assist");
  assertEquals(r.reason, "checkout_link_generated");
});

// ============================================================
// tool-filter.ts
// ============================================================
Deno.test("tool-filter: greeting não libera nenhuma tool", () => {
  assertEquals(TOOLS_BY_STATE.greeting.length, 0);
  const tools = [{ type: "function", function: { name: "search_products" } }];
  assertEquals(filterToolsForState(tools, "greeting").length, 0);
});

Deno.test("tool-filter: decision libera add_to_cart e bloqueia search_products", () => {
  assert(isToolAllowedInState("add_to_cart", "decision"));
  assert(!isToolAllowedInState("search_products", "decision"));
});

Deno.test("tool-filter: handoff só libera request_human_handoff", () => {
  assertEquals(TOOLS_BY_STATE.handoff, ["request_human_handoff"]);
  assert(!isToolAllowedInState("add_to_cart", "handoff"));
});

Deno.test("tool-filter: filterToolsForState preserva schema original", () => {
  const tools = [
    { type: "function", function: { name: "search_products", parameters: { x: 1 } } },
    { type: "function", function: { name: "add_to_cart" } },
  ];
  const filtered = filterToolsForState(tools, "discovery");
  assertEquals(filtered.length, 1);
  assertEquals(filtered[0].function.name, "search_products");
  // schema preservado
  assertEquals((filtered[0].function as any).parameters, { x: 1 });
});

// ============================================================
// variant-gate.ts
// ============================================================
Deno.test("variant-gate: variante explícita no tool_call sempre vence", () => {
  const r = evaluateVariantGate({
    product_id: "p1",
    product_has_variants: true,
    commercial_has_mandatory_variants: true,
    current_focus: null,
    explicit_variant_id: "v123",
  });
  assertEquals(r.status, "ok_already_resolved");
  assertEquals(r.variant_id, "v123");
});

Deno.test("variant-gate: foco persistido para o mesmo produto não pergunta de novo", () => {
  const r = evaluateVariantGate({
    product_id: "p1",
    product_has_variants: true,
    commercial_has_mandatory_variants: null,
    current_focus: {
      product_id: "p1",
      variant_id: "v9",
      variant_label: "Tamanho M",
      resolved_at: new Date().toISOString(),
      source: "user_selection",
    },
  });
  assertEquals(r.status, "ok_already_resolved");
  assertEquals(r.variant_id, "v9");
});

Deno.test("variant-gate: payload comercial 'não obrigatório' supera estrutural", () => {
  const r = evaluateVariantGate({
    product_id: "p1",
    product_has_variants: true,
    commercial_has_mandatory_variants: false, // cérebro disse: não pergunta
    current_focus: null,
  });
  assertEquals(r.status, "ok_no_variant_needed");
  assertEquals(r.reason, "commercial_payload_says_not_mandatory");
});

Deno.test("variant-gate: produto sem variantes → ok", () => {
  const r = evaluateVariantGate({
    product_id: "p1",
    product_has_variants: false,
    commercial_has_mandatory_variants: null,
    current_focus: null,
  });
  assertEquals(r.status, "ok_no_variant_needed");
});

Deno.test("variant-gate: única variante ativa → resolve automático", () => {
  const r = evaluateVariantGate({
    product_id: "p1",
    product_has_variants: true,
    commercial_has_mandatory_variants: null,
    current_focus: null,
    active_variants: [{ id: "v1", label: "Único" }],
  });
  assertEquals(r.status, "ok_single_variant");
  assertEquals(r.variant_id, "v1");
});

Deno.test("variant-gate: múltiplas variantes sem resolução → ask_variant", () => {
  const r = evaluateVariantGate({
    product_id: "p1",
    product_has_variants: true,
    commercial_has_mandatory_variants: true,
    current_focus: null,
    active_variants: [
      { id: "v1", label: "P" },
      { id: "v2", label: "M" },
    ],
  });
  assertEquals(r.status, "ask_variant");
  assertEquals(r.reason, "commercial_payload_marks_variants_mandatory");
});

Deno.test("variant-gate: foco de OUTRO produto não vale para o atual", () => {
  const r = evaluateVariantGate({
    product_id: "p_atual",
    product_has_variants: true,
    commercial_has_mandatory_variants: true,
    current_focus: {
      product_id: "p_outro",
      variant_id: "vX",
      variant_label: null,
      resolved_at: new Date().toISOString(),
      source: "user_selection",
    },
    active_variants: [
      { id: "v1", label: "A" },
      { id: "v2", label: "B" },
    ],
  });
  assertEquals(r.status, "ask_variant");
});

// Sub-fase 1.3 — anti-regressão do contrato curado de variante (Pacote H/J)
Deno.test("variant-gate (1.3): payload obrigatório + 1 única variante → auto-resolve (não pergunta)", () => {
  // Mesmo se o cérebro disse "venda só fecha com escolha", se só existe 1 opção
  // ativa, NÃO faz sentido perguntar. Auto-resolve com source=single_variant.
  const r = evaluateVariantGate({
    product_id: "p1",
    product_has_variants: true,
    commercial_has_mandatory_variants: true,
    current_focus: null,
    active_variants: [{ id: "v_unica", label: "Tamanho único" }],
  });
  assertEquals(r.status, "ok_single_variant");
  assertEquals(r.variant_id, "v_unica");
});

Deno.test("variant-gate (1.3): payload obrigatório + múltiplas variantes → ask_variant com motivo curado", () => {
  // Cenário canônico do Pacote H: "Pergunte qual numeração antes de fechar."
  const r = evaluateVariantGate({
    product_id: "p_calcado",
    product_has_variants: true,
    commercial_has_mandatory_variants: true,
    current_focus: null,
    active_variants: [
      { id: "v38", label: "38" },
      { id: "v39", label: "39" },
      { id: "v40", label: "40" },
    ],
  });
  assertEquals(r.status, "ask_variant");
  assertEquals(r.reason, "commercial_payload_marks_variants_mandatory");
});

Deno.test("variant-gate (1.3): payload ausente (null) + múltiplas variantes → ask_variant pelo sinal estrutural", () => {
  // Quando o cérebro ainda não rodou para o produto, caímos no fallback estrutural.
  const r = evaluateVariantGate({
    product_id: "p_novo",
    product_has_variants: true,
    commercial_has_mandatory_variants: null,
    current_focus: null,
    active_variants: [
      { id: "vA", label: "A" },
      { id: "vB", label: "B" },
    ],
  });
  assertEquals(r.status, "ask_variant");
  assertEquals(r.reason, "product_has_variants_and_no_resolution");
});

Deno.test("variant-gate: buildProductFocus preenche timestamp e source", () => {
  const f = buildProductFocus({
    product_id: "p1",
    variant_id: "v1",
    variant_label: "Azul",
    source: "single_variant",
  });
  assertEquals(f.product_id, "p1");
  assertEquals(f.source, "single_variant");
  assert(f.resolved_at.length > 0);
});

Deno.test("variant-gate: readProductFocus tolera metadata inválido", () => {
  assertEquals(readProductFocus(null), null);
  assertEquals(readProductFocus({}), null);
  assertEquals(readProductFocus({ product_focus: "lixo" }), null);
  assertEquals(readProductFocus({ product_focus: { product_id: 123 } }), null);

  const ok = readProductFocus({
    product_focus: {
      product_id: "p1",
      variant_id: "v1",
      variant_label: "Azul",
      resolved_at: "2026-01-01T00:00:00Z",
      source: "user_selection",
    },
  });
  assertEquals(ok?.product_id, "p1");
  assertEquals(ok?.source, "user_selection");
});
