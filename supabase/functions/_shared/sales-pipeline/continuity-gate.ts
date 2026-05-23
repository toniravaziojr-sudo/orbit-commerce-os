// ============================================================
// Frente 4 — Continuity Gate
//
// Gera um bloco de instrução curta para o prompt quando o turno
// já tem contexto acumulado (família declarada, produto em foco,
// múltiplos turnos de descoberta) — para evitar que a IA volte a
// perguntar de forma genérica/aberta como se a conversa começasse
// agora.
//
// Aditivo: se nenhuma condição dispara, retorna { promptBlock: null }.
// Não substitui o prompt do estado, só anexa via contextualBlocks.
// ============================================================

import type { PipelineState } from "./states.ts";

export interface ContinuityGateInput {
  pipelineState: PipelineState | string;
  previousDiscoveryTurns: number;        // turnos consecutivos em discovery ANTES deste turno
  familyFocus: string | null;            // família persistida (ex.: "shampoo")
  lastFocusedProductName: string | null; // último produto em foco
  hasActiveCart: boolean;
}

export interface ContinuityGateResult {
  promptBlock: string | null;
  reason: string;
}

export function buildContinuityBlock(input: ContinuityGateInput): ContinuityGateResult {
  const {
    pipelineState,
    previousDiscoveryTurns,
    familyFocus,
    lastFocusedProductName,
    hasActiveCart,
  } = input;

  const lines: string[] = [];
  const reasons: string[] = [];

  // 1. Anti-loop de descoberta
  if (
    (pipelineState === "discovery" || pipelineState === "greeting") &&
    previousDiscoveryTurns >= 1
  ) {
    lines.push(
      "Você JÁ fez perguntas abertas de descoberta nos turnos anteriores. " +
      "PROIBIDO repetir variações de \"o que você está procurando?\", " +
      "\"prefere ver opções ou algo específico?\", \"me conta o que precisa\", " +
      "\"qual seu objetivo?\". " +
      "Aja: ou apresente 1-2 opções concretas do catálogo com base no que já foi dito, " +
      "ou peça UMA única informação específica que ainda falta (ex.: tipo de cabelo, " +
      "tamanho, faixa de preço) — nunca repita pergunta aberta genérica."
    );
    reasons.push("discovery_loop");
  }

  // 2. Família persistente — não reabrir família do zero
  if (familyFocus && pipelineState !== "support" && pipelineState !== "handoff") {
    lines.push(
      `A família/categoria de interesse já está estabelecida nesta conversa: "${familyFocus}". ` +
      `Mantenha o foco nessa família — não pergunte "qual categoria você procura?" nem " ` +
      `mude de assunto sem o cliente pedir. Se o cliente trocar de tema explicitamente, aí sim siga ele.`
    );
    reasons.push("family_focus_active");
  }

  // 3. Produto em foco — não reabrir do zero
  if (
    lastFocusedProductName &&
    (pipelineState === "product_detail" ||
      pipelineState === "decision" ||
      pipelineState === "recommendation")
  ) {
    lines.push(
      `Produto em foco recente: "${lastFocusedProductName}". ` +
      `Não recomende algo aleatório — continue a partir desse produto (detalhes, dúvidas, comparação) ` +
      `a menos que o cliente peça outra coisa.`
    );
    reasons.push("product_focus_active");
  }

  // 4. Carrinho ativo + ainda em descoberta = sintoma de erro de roteamento;
  // o reflex deterministic já trata, mas reforçamos no prompt.
  if (
    hasActiveCart &&
    (pipelineState === "discovery" || pipelineState === "greeting" || pipelineState === "recommendation")
  ) {
    lines.push(
      "Já existe carrinho ativo nesta conversa. NÃO volte a perguntas de descoberta. " +
      "Foque em fechar (CEP, frete, finalização) ou tirar dúvidas pontuais sobre o produto no carrinho."
    );
    reasons.push("cart_active_in_discovery_state");
  }

  if (lines.length === 0) {
    return { promptBlock: null, reason: "noop" };
  }

  const promptBlock =
    "🔁 CONTINUIDADE DA CONVERSA (Frente 4):\n" +
    lines.map((l) => `- ${l}`).join("\n");

  return { promptBlock, reason: reasons.join("+") };
}
