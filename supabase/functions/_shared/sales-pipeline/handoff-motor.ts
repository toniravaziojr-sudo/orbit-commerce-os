// ============================================================
// Pipeline F2 — Handoff Motor (Reg #2.17 — Fase 2)
//
// Motor único de decisão de escalada para humano. Substitui a lógica
// dispersa em ai-support-chat/index.ts onde 4+ caminhos paralelos
// (classifier de intenção, regras custom, palavras-chave, ausência
// de evidência RAG) chamavam `shouldHandoff = true` cada um por si,
// alguns ignorando o classificador e gerando o bug C2 (purchase_intent
// + handoff no mesmo turno).
//
// Princípio: TODA fonte propõe um voto. O motor decide UMA vez,
// aplicando o veto comercial (Fase 1) de forma centralizada e
// emitindo um log estruturado para auditoria.
//
// Doc: docs/especificacoes/ia/modo-vendas-whatsapp.md
// ============================================================

import {
  type PainSymptomSignal,
  shouldVetoComplaintHandoff,
} from "./pain-symptom-detector.ts";

export type HandoffSource =
  | "intent_complaint_high_urgency"
  | "intent_aggressive_sentiment"
  | "intent_requires_action"
  | "intent_support_action"
  | "rag_no_evidence"
  | "ai_rule_transfer"
  | "handoff_keyword"
  | "explicit_client_request"
  | "knowledge_insufficient"
  | "other";

export interface HandoffVote {
  source: HandoffSource;
  reason: string;
  // Pedido explícito do cliente para falar com humano. Quando true,
  // NUNCA é vetado pelo motor comercial (cliente é soberano).
  isExplicitClientRequest?: boolean;
  // Reclamação real de pedido (entrega, defeito, reembolso, etc).
  // Quando true, sinal vale mesmo com purchase_intent ou pain.
  isLegitimateComplaint?: boolean;
}

export interface HandoffDecisionInput {
  intent?: string | null;
  painSignal: PainSymptomSignal;
  votes: HandoffVote[];
  // Se o tenant explicitou agressividade do cliente como handoff duro.
  aggressiveSentiment?: boolean;
}

export interface HandoffDecision {
  shouldHandoff: boolean;
  finalReason: string;
  vetoed: boolean;
  vetoReason: string | null;
  winningVote: HandoffVote | null;
  // Auditoria completa: todas as fontes que propuseram, na ordem.
  votes: HandoffVote[];
}

/**
 * Motor de votação. Cada fonte propõe; nada decide isolado.
 */
export class HandoffMotor {
  private votes: HandoffVote[] = [];

  propose(vote: HandoffVote): void {
    this.votes.push(vote);
  }

  hasAnyVote(): boolean {
    return this.votes.length > 0;
  }

  getVotes(): HandoffVote[] {
    return [...this.votes];
  }

  /**
   * Decide o handoff aplicando o veto comercial de forma centralizada.
   *
   * Hierarquia de prioridade dos votos:
   *   1) Pedido explícito do cliente — nunca vetado.
   *   2) Reclamação legítima de pedido — nunca vetada.
   *   3) Agressividade explícita do cliente — não vetada.
   *   4) Demais votos — sujeitos ao veto comercial (purchase_intent ou
   *      pain_symptom puro vetam).
   */
  decide(input: Omit<HandoffDecisionInput, "votes">): HandoffDecision {
    const allVotes = [...this.votes];

    if (allVotes.length === 0) {
      return {
        shouldHandoff: false,
        finalReason: "",
        vetoed: false,
        vetoReason: null,
        winningVote: null,
        votes: allVotes,
      };
    }

    // 1) Pedido explícito do cliente vence sempre.
    const explicit = allVotes.find((v) => v.isExplicitClientRequest);
    if (explicit) {
      return {
        shouldHandoff: true,
        finalReason: explicit.reason,
        vetoed: false,
        vetoReason: null,
        winningVote: explicit,
        votes: allVotes,
      };
    }

    // 2) Reclamação legítima de pedido vence (não é dor de produto).
    const legitimate = allVotes.find((v) => v.isLegitimateComplaint);
    if (legitimate) {
      return {
        shouldHandoff: true,
        finalReason: legitimate.reason,
        vetoed: false,
        vetoReason: null,
        winningVote: legitimate,
        votes: allVotes,
      };
    }

    // 3) Reclamação real de pedido detectada pelo signal — também vence.
    if (input.painSignal.isOrderComplaint) {
      const complaintVote = allVotes[0];
      return {
        shouldHandoff: true,
        finalReason: complaintVote.reason,
        vetoed: false,
        vetoReason: null,
        winningVote: complaintVote,
        votes: allVotes,
      };
    }

    // 4) Veto comercial: dor de produto OU intenção de compra
    //    bloqueiam handoff por reclamação/agressividade leve/etc.
    const veto = shouldVetoComplaintHandoff({
      intent: input.intent ?? null,
      signal: input.painSignal,
    });

    if (veto.veto) {
      return {
        shouldHandoff: false,
        finalReason: "",
        vetoed: true,
        vetoReason: veto.reason,
        winningVote: null,
        votes: allVotes,
      };
    }

    // 5) Sem veto — primeiro voto não-vetado vence.
    const winner = allVotes[0];
    return {
      shouldHandoff: true,
      finalReason: winner.reason,
      vetoed: false,
      vetoReason: null,
      winningVote: winner,
      votes: allVotes,
    };
  }
}

/**
 * Serializa a decisão em uma linha de log estruturado para auditoria.
 */
export function formatHandoffDecisionLog(
  decision: HandoffDecision,
  context: { intent?: string | null; painSignal: PainSymptomSignal },
): string {
  const sources = decision.votes.map((v) => v.source).join(",");
  return (
    `[handoff-motor] decision=${decision.shouldHandoff ? "HANDOFF" : "BOT"} ` +
    `vetoed=${decision.vetoed}${decision.vetoReason ? `(${decision.vetoReason})` : ""} ` +
    `winner=${decision.winningVote?.source ?? "none"} ` +
    `intent=${context.intent ?? "null"} ` +
    `pain=${context.painSignal.isProductPainSymptom} ` +
    `complaint=${context.painSignal.isOrderComplaint} ` +
    `votes=[${sources}] ` +
    `pain_terms=[${context.painSignal.matchedPainTerms.join(",")}] ` +
    `complaint_terms=[${context.painSignal.matchedComplaintTerms.join(",")}]`
  );
}
