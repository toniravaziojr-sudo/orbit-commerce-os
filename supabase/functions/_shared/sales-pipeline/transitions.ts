// ============================================================
// Pipeline Básica IA — F2
// Regras de transição entre estados comerciais.
//
// Princípios (aprovados):
// 1. Última mensagem do cliente é prioridade máxima.
// 2. Saudação não vira venda direta.
// 3. Discovery limitado a 2 turnos consecutivos.
// 4. Cliente citou produto pelo nome → product_detail (mesmo vindo de greeting).
// 5. Sinal claro de compra → decision (sem requalificar).
// 6. Cliente em decision/checkout NÃO regride para discovery sem sinal explícito.
// 7. Mudança de assunto → seguir a última mensagem.
// 8. Pedido existente / pós-venda → support (fora do funil).
// ============================================================

import { STATE_RANK, type PipelineState } from "./states.ts";

export type TransitionReason =
  | "first_contact_pure_greeting"
  | "greeting_to_discovery_question"
  | "product_mentioned_by_name"
  | "buy_signal_detected"
  | "explicit_checkout_request"
  | "cart_active_or_added"
  | "checkout_link_generated"
  | "support_topic_detected"
  | "handoff_requested"
  | "discovery_limit_reached_advance_to_recommendation"
  | "tool_advanced_state"
  | "no_change_keep_state"
  | "regression_blocked";

export interface TransitionInput {
  current: PipelineState;
  message: string;
  isPureGreeting: boolean;
  hasActiveCart: boolean;
  hasCheckoutLink: boolean;
  toolsCalled: string[];
  // Contagem de turnos consecutivos em discovery (vinda do servidor).
  discoveryTurnsSoFar: number;
  // Catálogo conhecido — usado para detectar menção a produto pelo nome.
  productNamesHint?: string[];
}

export interface TransitionResult {
  next: PipelineState;
  reason: TransitionReason;
  // Marca quando a transição foi forçada por regra (não por tool).
  forced: boolean;
}

// ----------------------------------------------------------------
// Detectores leves (lex-based) — barato e determinístico.
// Em F3 dá pra promover para classifier mais robusto.
// ----------------------------------------------------------------

const BUY_SIGNAL_PATTERNS = [
  /\bquero\s+(comprar|levar|esse|essa|esses|essas|um|uma|o|a)\b/i,
  /\bvou\s+(levar|comprar|fechar|querer)\b/i,
  /\bpode\s+(adicionar|colocar|botar)\b/i,
  /\badiciona\s+(no\s+)?carrinho\b/i,
  /\bmanda\s+(o\s+)?link\b/i,
  /\bme\s+manda\s+(o\s+)?(link|pix)\b/i,
  /\bcomo\s+(eu\s+)?(pago|fa[çc]o\s+pra\s+pagar)\b/i,
  /\bfechar\s+(o\s+)?pedido\b/i,
  /\bfinaliza(r)?\b/i,
];

const SUPPORT_PATTERNS = [
  /\bmeu\s+pedido\b/i,
  /\bpedido\s+(n[ºo°]?\s*)?\d/i,
  /\brastrei(o|ar|amento)\b/i,
  /\bn[ãa]o\s+chegou\b/i,
  /\batraso\b/i,
  /\bcad[êe]\b.*\bpedido\b/i,
  /\bproblema\s+com\s+(o\s+)?pedido\b/i,
  /\bquero\s+trocar\b/i,
  /\bdevolver\b/i,
  /\breembolso\b/i,
];

const CHECKOUT_REQUEST_PATTERNS = [
  /\b(finaliza(r)?|fechar)\s+(a\s+)?compra\b/i,
  /\bme\s+manda\s+o\s+link\b/i,
  /\bgera\s+(o\s+)?link\b/i,
];

function mentionsProductByName(message: string, productNames: string[] = []): boolean {
  if (!message || !productNames.length) return false;
  const norm = message.toLowerCase();
  return productNames.some(name => {
    if (!name) return false;
    const n = name.toLowerCase().trim();
    if (n.length < 4) return false; // evita falso positivo com palavras curtas
    return norm.includes(n);
  });
}

function detectBuySignal(message: string): boolean {
  if (!message) return false;
  return BUY_SIGNAL_PATTERNS.some(re => re.test(message));
}

function detectSupportTopic(message: string): boolean {
  if (!message) return false;
  return SUPPORT_PATTERNS.some(re => re.test(message));
}

function detectCheckoutRequest(message: string): boolean {
  if (!message) return false;
  return CHECKOUT_REQUEST_PATTERNS.some(re => re.test(message));
}

// ----------------------------------------------------------------
// Decisão da próxima transição — ordem de prioridade importa.
// ----------------------------------------------------------------
export function decideNextState(input: TransitionInput): TransitionResult {
  const { current, message, isPureGreeting, hasActiveCart, hasCheckoutLink, toolsCalled, discoveryTurnsSoFar, productNamesHint } = input;

  // 0. Handoff é terminal — se foi solicitado por tool, prevalece.
  if (toolsCalled.includes("request_human_handoff")) {
    return { next: "handoff", reason: "handoff_requested", forced: true };
  }

  // 1. Tópico de pedido existente → support (sai do funil).
  if (detectSupportTopic(message)) {
    return { next: "support", reason: "support_topic_detected", forced: true };
  }

  // 2. Checkout efetivo — link gerado ou explicitamente pedido.
  if (hasCheckoutLink || toolsCalled.includes("generate_checkout_link")) {
    return { next: "checkout_assist", reason: "checkout_link_generated", forced: false };
  }
  if (detectCheckoutRequest(message)) {
    return { next: "checkout_assist", reason: "explicit_checkout_request", forced: true };
  }

  // 3. Carrinho ativo ou item adicionado neste turno.
  if (hasActiveCart || toolsCalled.includes("add_to_cart")) {
    // Carrinho ativo NÃO regride para discovery, mas pode ir para decision/checkout.
    return advanceTo(current, "checkout_assist", "cart_active_or_added");
  }

  // 4. Sinal claro de compra → decision (mesmo vindo de greeting/discovery).
  if (detectBuySignal(message)) {
    return advanceTo(current, "decision", "buy_signal_detected");
  }

  // 5. Cliente citou produto pelo nome → product_detail.
  if (mentionsProductByName(message, productNamesHint || [])) {
    return advanceTo(current, "product_detail", "product_mentioned_by_name");
  }

  // 6. Tools de detalhe foram chamadas → product_detail.
  if (toolsCalled.includes("get_product_details") || toolsCalled.includes("get_product_variants")) {
    return advanceTo(current, "product_detail", "tool_advanced_state");
  }

  // 7. Tools de busca foram chamadas → recommendation.
  if (toolsCalled.includes("search_products") || toolsCalled.includes("recommend_related_products")) {
    return advanceTo(current, "recommendation", "tool_advanced_state");
  }

  // 8. Discovery com limite atingido → força recommendation.
  if (current === "discovery" && discoveryTurnsSoFar >= 2) {
    return { next: "recommendation", reason: "discovery_limit_reached_advance_to_recommendation", forced: true };
  }

  // 9. Saída natural de greeting com pergunta de necessidade.
  if (current === "greeting" && !isPureGreeting && message.trim().length > 0) {
    return { next: "discovery", reason: "greeting_to_discovery_question", forced: false };
  }

  // 10. Saudação pura mantém greeting.
  if (current === "greeting" && isPureGreeting) {
    return { next: "greeting", reason: "first_contact_pure_greeting", forced: false };
  }

  return { next: current, reason: "no_change_keep_state", forced: false };
}

// Anti-regressão: só avança se o rank do alvo for ≥ atual, ou se for forçado.
function advanceTo(current: PipelineState, target: PipelineState, reason: TransitionReason): TransitionResult {
  if (STATE_RANK[target] >= STATE_RANK[current]) {
    return { next: target, reason, forced: false };
  }
  // Caso de regressão silenciosa bloqueada — mantém estado atual.
  return { next: current, reason: "regression_blocked", forced: false };
}
