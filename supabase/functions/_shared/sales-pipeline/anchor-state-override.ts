// ============================================================
// Frente 1 (plano de correção pós-Frentes B–E) —
// Âncora vira override de estado.
//
// Promove a Âncora do Turno (Frente E) de bloco de prompt para
// DECISÃO de roteamento. Quando há sinal real (dor declarada,
// pergunta direta de catálogo, família em foco persistida ou
// menção a kit/combo), o estado é forçado para `recommendation`
// — eliminando o caminho legítimo da muleta de discovery.
//
// Critérios de bloqueio (não força):
//  - Reflexo determinístico já alterou o estado neste turno.
//  - Estado atual já é avançado (recommendation, product_detail,
//    decision, checkout_assist, support, handoff).
//  - Bucket é não-vendas/terminal (post_sale, human_request,
//    institutional, objection, hesitation, out_of_scope, social).
//
// Aditivo: se nenhum critério positivo dispara, devolve null.
// ============================================================

import type { PipelineState } from "./states.ts";
import type { IntentBucket } from "./scope-router.ts";

export interface AnchorStateOverrideInput {
  currentState: PipelineState;
  bucket: IntentBucket | null | undefined;
  declaredPain: string | null | undefined;
  familyFocus: string | null | undefined;
  mentionedFamily: boolean;
  mentionedProduct: boolean;
  consolidatedText: string;
  reflexAlreadyOverrodeState: boolean;
}

export interface AnchorStateOverrideResult {
  forcedState: PipelineState | null;
  reason: string;
}

// Detecta menção determinística a "kit"/"combo" — usado para
// destravar B4.1 ("qual o kit mais completo?") mesmo sem família
// em foco persistida.
const RE_KIT_OR_COMBO = /\b(kit|combo|conjunto|pacote|completo)\b/i;

const NON_SALES_OR_TERMINAL_BUCKETS: ReadonlySet<IntentBucket> = new Set<IntentBucket>([
  "post_sale",
  "human_request",
  "institutional",
  "objection",
  "hesitation",
  "out_of_scope",
  "social",
]);

const ELIGIBLE_STATES: ReadonlySet<PipelineState> = new Set<PipelineState>([
  "greeting",
  "discovery",
]);

export function anchorStateOverride(
  input: AnchorStateOverrideInput,
): AnchorStateOverrideResult {
  const {
    currentState,
    bucket,
    declaredPain,
    familyFocus,
    mentionedFamily,
    mentionedProduct,
    consolidatedText,
    reflexAlreadyOverrodeState,
  } = input;

  if (reflexAlreadyOverrodeState) {
    return { forcedState: null, reason: "reflex_already_overrode" };
  }
  if (!ELIGIBLE_STATES.has(currentState)) {
    return { forcedState: null, reason: `state_not_eligible:${currentState}` };
  }
  if (bucket && NON_SALES_OR_TERMINAL_BUCKETS.has(bucket)) {
    return { forcedState: null, reason: `bucket_blocked:${bucket}` };
  }

  const hasPain = !!(declaredPain && declaredPain.toString().trim().length > 0);
  const hasFamily = !!(familyFocus && familyFocus.toString().trim().length > 0);
  const text = (consolidatedText || "").toString();
  const mentionsKit = RE_KIT_OR_COMBO.test(text);

  // Caso 1 — Dor declarada (anterior ou neste turno).
  // Resolve B6.3-T1 ("queda") e B6.2.
  if (hasPain) {
    return { forcedState: "recommendation", reason: "declared_pain" };
  }

  // Caso 2 — Pergunta direta de catálogo ("vocês têm shampoo?",
  // "tem balm?", "qual o kit mais completo?"). Resolve B3.1 e B4.1.
  if (bucket === "catalog_question") {
    return { forcedState: "recommendation", reason: "catalog_question" };
  }

  // Caso 3 — Pergunta sobre produto/família com sinal claro
  // (mencionou família, mencionou produto ou usou "kit/combo").
  if (
    bucket === "product_question" &&
    (mentionedFamily || mentionedProduct || mentionsKit)
  ) {
    return {
      forcedState: "recommendation",
      reason: "product_question_with_family_or_kit",
    };
  }

  // Caso 4 — Menção a kit/combo em qualquer bucket de vendas, mesmo
  // sem família em foco. Cobre B4.1 quando o TPR não classifica como
  // catalog_question.
  if (mentionsKit && (!bucket || bucket === "open_discovery")) {
    return { forcedState: "recommendation", reason: "kit_mention_universal" };
  }

  // Caso 5 — Família em foco persistida e cliente segue em discovery.
  // Evita reabertura de qualificação após família já decidida.
  if (hasFamily && currentState === "discovery") {
    return { forcedState: "recommendation", reason: "family_focus_persisted" };
  }

  return { forcedState: null, reason: "no_anchor_signal" };
}
