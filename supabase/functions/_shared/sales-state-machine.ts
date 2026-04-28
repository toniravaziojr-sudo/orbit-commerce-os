// ============================================================
// Pipeline Básica IA — F1 (Estabilização do Núcleo)
// Helpers da máquina de estado comercial (server-side, não prompt).
//
// Fonte de verdade do estado: `conversations.sales_state`.
// Whatsapp_carts permanece como estado complementar (espelho do carrinho real).
//
// Estados: greeting → discovery → recommendation → consideration →
//          decision → cart → checkout → post_sale
// Especiais: handoff (ramo terminal de escalada humana)
// ============================================================

export type SalesState =
  | "greeting"
  | "discovery"
  | "recommendation"
  | "consideration"
  | "decision"
  | "cart"
  | "checkout"
  | "post_sale"
  | "handoff";

export type Intent =
  | "greeting"
  | "question"
  | "buy"
  | "compare"
  | "objection"
  | "tracking"
  | "complaint"
  | "image_request"
  | "other";

export interface ImagePolicyContext {
  salesState: SalesState;
  intent: Intent;
  productAlreadySent: boolean;
  customerExplicitlyAsked: boolean;
}

export interface ImagePolicyResult {
  allowed: boolean;
  reason: string;
}

// ----------------------------------------------------------------
// Detecta saudação isolada (mensagem que é APENAS um cumprimento,
// sem conteúdo comercial nem pergunta).
// ----------------------------------------------------------------
const GREETING_TOKENS = [
  "oi", "ola", "olá", "eai", "e ai", "e aí",
  "bom dia", "boa tarde", "boa noite",
  "oie", "opa", "tudo bem", "tudo bom",
  "hey", "hi", "hello",
  "alo", "alô",
  "td bem", "tdb", "tudo certo", "como vai", "como esta", "como está"
];

// Tokens individuais que sozinhos são "ruído" comum em saudação concatenada
// ("oi, boa noite tudo bem?" → ["oi","boa","noite","tudo","bem"]).
const GREETING_FILLER_TOKENS = new Set([
  "bem", "bom", "boa", "noite", "tarde", "dia", "tudo", "td",
  "ai", "vai", "esta", "está", "certo", "como", "e",
]);

export function isPureGreeting(message: string): boolean {
  if (!message) return false;
  const norm = message
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (norm.length === 0) return true;
  if (norm.length > 40) return false; // mensagens longas não são "puras"

  // Match exato com algum token (após normalização)
  if (GREETING_TOKENS.some(t => norm === t)) return true;

  // Saudações concatenadas: "oi boa noite tudo bem", "ola bom dia tudo bem", etc.
  // Tokeniza e exige que TODO token seja saudação ou filler reconhecido.
  const tokens = norm.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  if (tokens.length <= 7) {
    const allGreeting = tokens.every(tok =>
      GREETING_TOKENS.some(g => g.split(" ").includes(tok))
      || GREETING_FILLER_TOKENS.has(tok)
    );
    if (allGreeting) return true;
  }

  return false;
}

// ----------------------------------------------------------------
// Detecta pedido EXPLÍCITO de imagem.
// Critério estrito: cliente precisa estar pedindo a foto do produto.
// ----------------------------------------------------------------
const IMAGE_REQUEST_PATTERNS = [
  /\bme\s*mostra(r)?\b.*(foto|imagem|fotinha)/i,
  /\bmanda(r)?\b.*(foto|imagem|fotinha)/i,
  /\bquero\s*ver\b.*(foto|imagem|produto)/i,
  /\btem\s*foto\b/i,
  /\btem\s*imagem\b/i,
  /\bmostra\s*a\s*(foto|imagem)\b/i,
  /\bmanda\s*a\s*(foto|imagem)\b/i,
  /\bcomo\s*(é|e)\s*a\s*(embalagem|cara|aparência|aparencia)\b/i,
];

export function isExplicitImageRequest(message: string): boolean {
  if (!message) return false;
  return IMAGE_REQUEST_PATTERNS.some(re => re.test(message));
}

// ----------------------------------------------------------------
// Política de envio de imagem (F1 — conservadora):
// SÓ permite envio se UMA das condições for verdadeira:
//   1) Cliente pediu explicitamente
//   2) Estado da venda é consideration ou decision
// PROIBIDO em greeting / discovery / recommendation, exceto pedido explícito.
// E sempre proibido se já foi enviado para esse produto.
// ----------------------------------------------------------------
export function evaluateImagePolicy(ctx: ImagePolicyContext): ImagePolicyResult {
  if (ctx.productAlreadySent) {
    return { allowed: false, reason: "image_already_sent_for_product" };
  }

  if (ctx.customerExplicitlyAsked) {
    return { allowed: true, reason: "customer_explicit_request" };
  }

  if (ctx.salesState === "consideration" || ctx.salesState === "decision") {
    return { allowed: true, reason: "advanced_sales_stage" };
  }

  if (ctx.salesState === "greeting" || ctx.salesState === "discovery") {
    return {
      allowed: false,
      reason: `image_blocked_in_${ctx.salesState}_stage`,
    };
  }

  // recommendation, cart, checkout, post_sale, handoff: bloqueado por default,
  // só passa via pedido explícito (já tratado acima).
  return { allowed: false, reason: `image_not_allowed_in_${ctx.salesState}` };
}

// ----------------------------------------------------------------
// Próximo estado sugerido (server-side). Estado SÓ AVANÇA por padrão.
// Regressão exige sinal explícito (não tratado nesta F1, fica para F2).
// ----------------------------------------------------------------
const STATE_RANK: Record<SalesState, number> = {
  greeting: 0,
  discovery: 1,
  recommendation: 2,
  consideration: 3,
  decision: 4,
  cart: 5,
  checkout: 6,
  post_sale: 7,
  handoff: 99,
};

export interface StateTransitionInput {
  current: SalesState;
  intent: Intent;
  toolsCalled: string[];
  hasActiveCart: boolean;
  hasCheckoutLink: boolean;
}

export function nextSalesState(input: StateTransitionInput): SalesState {
  const { current, intent, toolsCalled, hasActiveCart, hasCheckoutLink } = input;

  // Handoff é terminal e tem prioridade
  if (toolsCalled.includes("request_human_handoff") || intent === "complaint") {
    return "handoff";
  }

  // Se o checkout foi gerado, avança para checkout
  if (hasCheckoutLink || toolsCalled.includes("generate_checkout_link")) {
    return rankAdvance(current, "checkout");
  }

  // Se item entrou no carrinho
  if (hasActiveCart || toolsCalled.includes("add_to_cart")) {
    return rankAdvance(current, "cart");
  }

  // Se tools de detalhe foram chamadas, está em consideration
  if (toolsCalled.includes("get_product_details") || toolsCalled.includes("get_product_variants")) {
    return rankAdvance(current, "consideration");
  }

  // Se search_products foi chamada, está em recommendation
  if (toolsCalled.includes("search_products") || toolsCalled.includes("recommend_related_products")) {
    return rankAdvance(current, "recommendation");
  }

  // Se cliente está em greeting e fez uma pergunta de necessidade, vai para discovery
  if (current === "greeting" && intent !== "greeting" && intent !== "other") {
    return "discovery";
  }

  return current;
}

function rankAdvance(current: SalesState, target: SalesState): SalesState {
  return STATE_RANK[target] > STATE_RANK[current] ? target : current;
}

// ----------------------------------------------------------------
// Hash determinístico curto da resposta (anti-repetição)
// [Eixo 1.4] Normalização robusta:
//   - lowercase
//   - remove acentos
//   - remove tudo que não é [a-z0-9 ]
//   - colapsa espaços
//   - corta nos primeiros 80 chars (prefixo é o "abre" da resposta — é o que
//     dá a sensação de "ela tá respondendo a mesma coisa de novo")
// Mantém assinatura async/Promise<string> para compatibilidade.
// ----------------------------------------------------------------
function normalizeForHash(content: string): string {
  return content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")        // acentos
    .replace(/[^a-z0-9 ]+/g, " ")           // pontuação/emoji/símbolos → espaço
    .replace(/\s+/g, " ")                   // colapsa
    .trim()
    .slice(0, 80);                          // prefixo "abre"
}

export async function hashResponse(content: string): Promise<string> {
  const normalized = normalizeForHash(content);
  const data = new TextEncoder().encode(normalized);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 12)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ----------------------------------------------------------------
// Detecta se a mensagem é uma pergunta de qualificação repetida
// (ajuda anti-loop). Lista mínima na F1, expandida em F3.
// ----------------------------------------------------------------
const QUALIFICATION_QUESTIONS = [
  /o que voc[ée] (procura|busca|deseja|quer)/i,
  /como posso (ajudar|te ajudar)/i,
  /em que posso ajud/i,
  /qual (o|a) seu (objetivo|necessidade|interesse)/i,
];

export function isQualificationQuestion(text: string): boolean {
  if (!text) return false;
  return QUALIFICATION_QUESTIONS.some(re => re.test(text));
}
