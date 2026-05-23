// ============================================================
// Frente 4 — Continuity Gate
// (Frente B do plano endurecido pós-Rodada 2: thanks terminal +
//  ruído social + sinal de presença, todos universais.)
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
  // [Frente B] Texto consolidado do turno do cliente (já normalizado pelo
  // Turn Orchestrator). Usado para detecção universal de thanks/despedida,
  // ruído social ("kkk", "haha") e ping de presença ("alô", "tem alguém aí?").
  consolidatedText?: string;
  // [Frente B] Bucket do scope-router (Frente 2). Quando "social", reforçamos
  // o detector universal contra venda forçada.
  intentBucket?: string | null;
}

export interface ContinuityGateResult {
  promptBlock: string | null;
  reason: string;
}

// ---------- Detectores universais (Frente B) ----------
// Importante: vocabulário universal de PT-BR — não há nada cosmético/segmentado.

// Thanks / despedida: aparece sozinho ou cercado de pontuação. Se o turno
// inteiro é uma destas formas (até ~4 tokens), tratamos como terminal.
const THANKS_FAREWELL_RE =
  /^[\s\p{P}]*(vlw|valeu|valeuu+|obrigad[oa]+|brigad[oa]+|brig[ãa]o|tmj|t[ãa]+ ?mais|t[êe]+ ?mais|tch[au]+|abra[çc]o[ss]?|fal[ôo]u|fechou|[ée] n[óo]is|gratid[ãa]o|agrade[çc]o|thanks|thx)[\s\p{P}!.\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]*$/iu;

// Ruído social: risadas e onomatopeias soltas. Aceita variações longas.
// Cobre: kkk+, kk, haha+, hehe+, huhu+, rs, rsrs+, hue+, kkkkkjkjk, e emoji-only.
const SOCIAL_NOISE_RE =
  /^[\s\p{P}]*(k{2,}|(ha){2,}|(he){2,}|(hu){2,}|rs+|(hue){2,}|aff+|ah+|oh+|uh+|hum+|hmm+|opa+|eita+|nossa+|caraca+)[\s\p{P}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]*$/iu;

// Emoji-only (sem palavras): conta como ruído social.
const EMOJI_ONLY_RE =
  /^[\s\p{P}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{200D}\u{FE0F}]+$/u;

// Sinal de presença: cliente perguntando se tem alguém atendendo.
// Universal — não tem componente segmentado.
const PRESENCE_PING_RE =
  /\b(tem\s+algu[ée]m\s+a[íi]|algu[ée]m\s+a[íi]|al[ôo]+\s*\?*$|al[ôo]+\s+algu[ée]m|cad[êe]\s+(voc[êe]|algu[ée]m)|t[áa]\s+a[íi]\s*\?|ainda\s+t[áa]\s+a[íi]|t[ôo]\s+esperando|algu[ée]m\s+atende|ningu[ée]m\s+responde|me\s+responde\s+a[íi])\b/iu;

function tokenCount(s: string): number {
  const c = s.trim().replace(/\s+/g, " ");
  if (!c) return 0;
  return c.split(" ").filter(Boolean).length;
}

export function isThanksOrFarewell(text: string): boolean {
  if (!text) return false;
  const tokens = tokenCount(text);
  if (tokens > 4) return false;
  return THANKS_FAREWELL_RE.test(text.trim());
}

export function isSocialNoise(text: string): boolean {
  if (!text) return false;
  const tokens = tokenCount(text);
  if (tokens > 3) return false;
  if (SOCIAL_NOISE_RE.test(text.trim())) return true;
  // emoji-only só se não tem letra/dígito
  if (/[\p{L}\p{N}]/u.test(text)) return false;
  return EMOJI_ONLY_RE.test(text.trim());
}

export function isPresencePing(text: string): boolean {
  if (!text) return false;
  const tokens = tokenCount(text);
  if (tokens > 8) return false;
  return PRESENCE_PING_RE.test(text.trim());
}

// ---------- Função principal ----------

export function buildContinuityBlock(input: ContinuityGateInput): ContinuityGateResult {
  const {
    pipelineState,
    previousDiscoveryTurns,
    familyFocus,
    lastFocusedProductName,
    hasActiveCart,
    consolidatedText,
    intentBucket,
  } = input;

  const lines: string[] = [];
  const reasons: string[] = [];
  const text = (consolidatedText || "").trim();

  // ── [Frente B] Prioridade 1: Thanks/despedida = terminal ──
  // Se o cliente acabou de agradecer/despedir, PROIBIDO reabrir discovery
  // ou fazer pergunta de venda nova. O turno é fechamento cordial leve.
  if (text && isThanksOrFarewell(text)) {
    lines.push(
      "O cliente acabou de AGRADECER ou se DESPEDIR. Este turno é TERMINAL: " +
      "responda com fechamento cordial CURTO (1 linha) e, no MÁXIMO, um gancho LEVE " +
      'do tipo "qualquer coisa, me chama" — sem pergunta direta de venda, sem reabrir descoberta, ' +
      'sem pedir mais informação. PROIBIDO usar variações de "tá buscando algo?", ' +
      '"posso te ajudar com mais alguma coisa?", "quer ver as opções?". ' +
      "Se houver carrinho ativo, pode mencionar UMA vez que o link de pagamento segue ativo, sem insistir."
    );
    reasons.push("thanks_or_farewell_terminal");
  }

  // ── [Frente B] Prioridade 2: Ruído social puro ──
  // "kkk", "haha", "rs", emoji solto: NUNCA assumir nicho/dor, NUNCA empurrar
  // venda. Resposta leve, no tom, em UMA linha, devolvendo a bola sem pressão.
  if (text && isSocialNoise(text)) {
    lines.push(
      "O cliente mandou apenas RUÍDO SOCIAL (risada, onomatopeia ou emoji solto). " +
      "Responda LEVE e CURTO (1 linha), no mesmo tom, sem assumir nenhuma dor, nicho, " +
      "produto ou família. PROIBIDO emendar pergunta de venda forçada, PROIBIDO assumir que " +
      "o cliente quer alguma categoria específica. Se ele estava em meio a uma conversa " +
      "ativa, devolva a bola para a última coisa que ESTAVA sendo tratada — não invente assunto novo."
    );
    reasons.push("social_noise");
  }

  // ── [Frente B] Prioridade 3: Sinal de presença ──
  // "tem alguém aí?", "alô?", "ainda tá aí?": afirmar presença ANTES de qualquer
  // outra coisa. Tom acolhedor, em 1 linha. Reflexo determinístico cobre o
  // override de estado; este bloco garante o tom da resposta.
  if (text && isPresencePing(text)) {
    lines.push(
      "O cliente está perguntando se tem ALGUÉM ATENDENDO (ping de presença). " +
      'A primeira coisa da resposta DEVE confirmar presença em UMA linha curta tipo ' +
      '"tô aqui sim!" ou "oi, tô aqui!". Só depois oferecer ajuda em 1 linha curta. ' +
      "PROIBIDO devolver pergunta de descoberta genérica antes de confirmar presença, " +
      'PROIBIDO usar a muleta "Me conta o que você precisa que eu já te indico".'
    );
    reasons.push("presence_ping");
  }

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
      `Mantenha o foco nessa família — não pergunte "qual categoria você procura?" nem ` +
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

  // [Frente B] Reforço quando bucket é "social" mas não caiu em thanks/noise/presence:
  // proíbe a IA de empurrar venda forçada nesse turno.
  if (intentBucket === "social" && reasons.length === 0) {
    lines.push(
      "Bucket do turno: SOCIAL puro (saudação ou small talk). " +
      "Resposta LEVE em 1–2 linhas. Não force pergunta de venda nem assuma nicho. " +
      "Se ainda não há contexto, abra discovery de forma neutra (sem viés de família) — " +
      "lembrando que o catálogo do tenant pode ter várias famílias e o cliente não declarou nenhuma."
    );
    reasons.push("social_bucket_no_signal");
  }

  if (lines.length === 0) {
    return { promptBlock: null, reason: "noop" };
  }

  const promptBlock =
    "🔁 CONTINUIDADE DA CONVERSA (Frente 4):\n" +
    lines.map((l) => `- ${l}`).join("\n");

  return { promptBlock, reason: reasons.join("+") };
}
