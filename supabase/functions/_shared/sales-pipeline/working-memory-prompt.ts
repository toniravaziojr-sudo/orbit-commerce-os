// ============================================================
// Pipeline F2 — Onda 3 — Working Memory Prompt Block
//
// Constrói o bloco de contexto que injeta a memória persistente
// (conversation_sales_state) dentro do systemPrompt — sem reescrever
// os prompts por estado. É um bloco aditivo que vai em
// `contextualBlocks` do buildPromptForState.
//
// Objetivo:
//   - Lembrar a IA da dor declarada (não esquecer motivo original).
//   - Evitar reapresentar produtos / famílias já apresentados.
//   - Evitar repetir perguntas-âncora já feitas (anti-repetição).
//   - Limitar upsell a no máximo 1 oferta por conversa.
//   - Sinalizar o estágio comercial vigente.
//
// Também expõe utilitários para extração de perguntas pós-resposta
// (extractAnchorQuestions) e detecção de famílias/produtos
// apresentados na resposta da IA (já fazemos via tool_calls; aqui
// fica o helper textual de fallback).
// ============================================================

import type { ConversationSalesState, SalesStage } from "./working-memory.ts";
import { hashQuestion, getFocusSnapshot } from "./working-memory.ts";

const STAGE_LABEL: Record<SalesStage, string> = {
  social_only: "Apenas socializando — cliente cumprimentou, ainda sem demanda comercial",
  exploring: "Explorando — cliente ainda não declarou dor nem produto",
  needs_known: "Necessidade conhecida — já há dor/objetivo declarado, hora de recomendar",
  evaluating: "Avaliando — cliente está analisando produto(s) específico(s)",
  buying_intent: "Intenção de compra — cliente sinalizou que quer comprar",
  closing: "Fechamento — cliente pediu link/forma de pagamento",
  post_sale: "Pós-venda / suporte — atender dúvida sem reabrir vitrine",
};

export interface BuildWorkingMemoryBlockArgs {
  state: ConversationSalesState;
  // Limite duro de upsell por conversa. Default 1.
  maxUpsell?: number;
}

/**
 * Monta o bloco de contexto de working memory que é injetado no prompt.
 * Retorna string vazia quando não há nada relevante a lembrar (cliente
 * novo sem histórico) — evita poluir o prompt à toa.
 */
export function buildWorkingMemoryPromptBlock(args: BuildWorkingMemoryBlockArgs): string {
  const { state, maxUpsell = 1 } = args;
  const lines: string[] = [];

  lines.push("### MEMÓRIA DA CONVERSA (persistente — use para NÃO repetir)");
  lines.push(`- Estágio comercial atual: ${state.stage} — ${STAGE_LABEL[state.stage]}`);

  if (state.customer_declared_pain) {
    lines.push(
      `- Dor/objetivo já declarado pelo cliente: "${state.customer_declared_pain}". ` +
        `NUNCA peça de novo o motivo dele estar buscando — você já sabe.`
    );
  }

  if (state.customer_named_families.length > 0) {
    lines.push(
      `- Famílias que o cliente JÁ citou: ${state.customer_named_families.join(", ")}. ` +
        `Mantenha o foco nessas famílias.`
    );
  }

  if (state.presented_families.length > 0) {
    lines.push(
      `- Famílias que VOCÊ já apresentou: ${state.presented_families.join(", ")}. ` +
        `Não reapresente como novidade — aprofunde, compare ou avance no funil.`
    );
  }

  if (state.presented_product_ids.length > 0) {
    lines.push(
      `- Produtos já apresentados nesta conversa (IDs): ${state.presented_product_ids
        .slice(-12)
        .join(", ")}. ` +
        `Evite reapresentar os MESMOS produtos. Se precisar reforçar, retome citando como "como te falei antes".`
    );
  }

  // [Reg #2.10] Focus Snapshot — produtos canônicos em foco/oferta.
  const focus = getFocusSnapshot(state);
  if (focus) {
    lines.push(
      `- 🔒 PRODUTOS EM FOCO (TRAVADOS): ${focus.names.join(" + ")} ` +
        `(IDs: ${focus.product_ids.join(", ")}${focus.kit_id ? ` | kit_id: ${focus.kit_id}` : ""}). ` +
        `Estes são EXATAMENTE os produtos da oferta atual. ` +
        `🚫 NÃO chame search_products para reabrir vitrine — esses IDs já estão definidos. ` +
        `Se o cliente pedir oferta/desconto/link, use APENAS estes IDs. ` +
        `Se o cliente pedir 'fechar/gerar link': chame add_to_cart com cada ID acima (se já não estiver no carrinho) e depois generate_checkout_link.`
    );
  }

  if (state.asked_question_hashes.length > 0) {
    lines.push(
      `- Você já fez ${state.asked_question_hashes.length} pergunta(s) nesta conversa. ` +
        `NÃO repita a mesma pergunta com palavras diferentes. Se o cliente não respondeu, ` +
        `assuma a melhor recomendação possível com o que já tem e siga.`
    );
  }

  if (state.upsell_offered_count >= maxUpsell || state.upsell_declined) {
    lines.push(
      `- Upsell/cross-sell: JÁ ofertado (${state.upsell_offered_count}x)${
        state.upsell_declined ? " e recusado" : ""
      }. NÃO ofereça novo upsell nesta conversa.`
    );
  } else {
    lines.push(
      `- Upsell/cross-sell ainda disponível (limite ${maxUpsell - state.upsell_offered_count} oferta). ` +
        `Use APENAS se houver gancho natural — nunca empurre.`
    );
  }

  if (state.last_greeting_at) {
    lines.push(
      `- Você já cumprimentou nesta conversa (em ${state.last_greeting_at}). ` +
        `Não repita "bom dia / boa tarde / boa noite" — vá direto ao ponto.`
    );
  }

  return lines.join("\n");
}

// ------------------------------------------------------------
// Extração de perguntas-âncora da resposta da IA
// ------------------------------------------------------------

/**
 * Extrai perguntas-âncora (frases interrogativas) de uma resposta da IA.
 * Filtra perguntas muito curtas (<12 chars) para evitar "tudo bem?",
 * "posso?" e similares que não são perguntas de qualificação.
 */
export function extractAnchorQuestions(text: string): string[] {
  if (!text) return [];
  // Captura segmentos terminados em ? respeitando pontuação anterior.
  const matches = text.match(/[^.!?\n]{8,240}\?/g) || [];
  const cleaned = matches
    .map((q) => q.trim())
    .filter((q) => q.length >= 12)
    // Remove perguntas reflexivas curtas comuns
    .filter((q) => !/^(tudo bem|posso|certo|ok|né|hein|sim|não)\??$/i.test(q));
  // Dedupe por hash
  const seen = new Set<string>();
  const result: string[] = [];
  for (const q of cleaned) {
    const h = hashQuestion(q);
    if (!seen.has(h)) {
      seen.add(h);
      result.push(q);
    }
  }
  return result;
}

/**
 * Helper: gera lista de hashes prontos para gravação no patch.
 */
export function questionsToHashes(questions: string[]): string[] {
  return questions.map(hashQuestion);
}
