// ============================================================
// Pipeline F2 — Onda 2 — Stage Machine
//
// Máquina dos 7 estágios comerciais persistidos em
// conversation_sales_state.stage. Decide o próximo estágio a partir
// da combinação:
//   - estágio anterior (working memory)
//   - classificação do TPR (turn-pre-router)
//
// Também mapeia cada estágio comercial para um PipelineState existente
// (greeting/discovery/recommendation/product_detail/decision/
// checkout_assist/support/handoff) para reaproveitar o tool-filter e
// os prompts já em produção. Isso evita reescrever tudo na Onda 2.
// ============================================================

import type { PipelineState } from "./states.ts";
import type { TurnClassification } from "./turn-pre-router.ts";
import type { SalesStage } from "./working-memory.ts";

// Rank usado só para impedir regressão silenciosa (ex.: cair de
// closing → exploring no meio de um fechamento).
const STAGE_RANK: Record<SalesStage, number> = {
  social_only: 0,
  exploring: 1,
  needs_known: 2,
  evaluating: 3,
  buying_intent: 4,
  closing: 5,
  post_sale: 9,
};

/**
 * Mapeamento estágio comercial → PipelineState (prompt + tool-filter).
 * Chave técnica da Onda 2: NÃO reescrevemos tool-filter. Reusamos.
 */
export const STAGE_TO_PIPELINE_STATE: Record<SalesStage, PipelineState> = {
  social_only:   "greeting",
  exploring:     "discovery",
  needs_known:   "recommendation",
  evaluating:    "product_detail",
  buying_intent: "decision",
  closing:       "checkout_assist",
  post_sale:     "support",
};

export interface DecideStageInput {
  current: SalesStage;
  tpr: TurnClassification;
  // Sinais já consolidados na working memory (evitam regressão de fase).
  hasPresentedProducts: boolean;
  hasDeclaredPain: boolean;
  // Permite handoff humano explícito vindo de outras camadas.
  forceHandoff?: boolean;
}

export interface DecideStageOutput {
  next: SalesStage;
  pipelineState: PipelineState;
  reason: string;
  regressed: boolean;
}

/**
 * Decide o próximo estágio comercial.
 * Regras (curto e auditável):
 *   1. forceHandoff → support
 *   2. is_support_topic → post_sale
 *   3. asked_about_payment_or_link OU confirmed_purchase_intent → closing
 *   4. confirmed_purchase_intent (sem link ainda) → buying_intent
 *   5. mentioned_product_name (cliente citou produto) → evaluating
 *   6. described_symptom OU declared_objective OU hasDeclaredPain → needs_known
 *   7. is_pure_greeting + sem dor + sem produto → social_only (1 vez)
 *   8. caso contrário → exploring (default)
 *
 * Anti-regressão: se o estágio decidido tem rank menor que o atual E
 * não há sinal forte de que o cliente "voltou" no funil (ex.: dúvida
 * nova, mudança de produto), preserva o estágio atual.
 */
export function decideStage(input: DecideStageInput): DecideStageOutput {
  const { current, tpr, hasPresentedProducts, hasDeclaredPain, forceHandoff } = input;

  let next: SalesStage = current;
  let reason = "kept";

  if (forceHandoff) {
    return {
      next: "post_sale",
      pipelineState: "handoff",
      reason: "force_handoff",
      regressed: false,
    };
  }

  if (tpr.is_support_topic) {
    next = "post_sale";
    reason = "tpr.is_support_topic";
  } else if (tpr.asked_about_payment_or_link || tpr.confirmed_purchase_intent) {
    // Distinção fina: se já pediu link/pagamento → closing.
    // Se só "quero" → buying_intent.
    if (tpr.asked_about_payment_or_link) {
      next = "closing";
      reason = "tpr.asked_about_payment_or_link";
    } else {
      next = "buying_intent";
      reason = "tpr.confirmed_purchase_intent";
    }
  } else if (tpr.mentioned_product_name) {
    next = "evaluating";
    reason = "tpr.mentioned_product_name";
  } else if (
    tpr.described_symptom ||
    tpr.declared_objective ||
    tpr.requested_recommendation ||
    hasDeclaredPain
  ) {
    next = "needs_known";
    reason = "tpr.symptom_or_objective_or_recommendation";
  } else if (tpr.is_pure_greeting && !hasDeclaredPain && !hasPresentedProducts) {
    next = "social_only";
    reason = "tpr.is_pure_greeting";
  } else {
    next = "exploring";
    reason = "default_exploring";
  }

  // Anti-regressão: se o novo rank é menor E não houve sinal explícito
  // de retorno (ex.: nova dor, novo produto), preserva o atual.
  const regressing = STAGE_RANK[next] < STAGE_RANK[current];
  const explicitRollback =
    tpr.is_support_topic || // suporte é exceção legítima
    tpr.described_symptom || // nova dor é retorno legítimo
    tpr.mentioned_product_name; // troca de produto é retorno legítimo

  if (regressing && !explicitRollback) {
    return {
      next: current,
      pipelineState: STAGE_TO_PIPELINE_STATE[current],
      reason: `${reason}_blocked_regression(${current}<-${next})`,
      regressed: true,
    };
  }

  return {
    next,
    pipelineState: STAGE_TO_PIPELINE_STATE[next],
    reason,
    regressed: false,
  };
}
