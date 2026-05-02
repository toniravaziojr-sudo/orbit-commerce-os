// ============================================================
// Pipeline F2 — Output Gates — Reg #2.8
//
// Gates server-side determinísticos que LEEM o JSON do TPR e
// reescrevem/bloqueiam a resposta da IA quando ela viola regras
// duras. Latência zero (regex), porque o entendimento já foi feito
// pelo TPR.
// ============================================================

import type { TurnClassification } from "./turn-pre-router.ts";

// ----------------------------------------------------------------
// Price Scrubber
// Em estados pré-detalhe (greeting/discovery/recommendation), se o
// cliente NÃO perguntou preço, removemos qualquer linha que cite
// "R$", "frete", "frete grátis", desconto explícito ou nº de parcelas.
// ----------------------------------------------------------------

const PRICE_LINE_RE = /(^|\n)\s*[-•*]?\s*[^\n]*?(\bR\$\s*\d|\bfrete( gr[áa]tis)?\b|\bdesconto\s+de\s+\d|\b\d+x\s+(de|sem juros)|\bpre[çc]o\s*:|\bcusta\s+R\$|\bsai\s+por\s+R\$)[^\n]*/gi;
const PRICE_INLINE_RE = /\b(R\$\s*\d[\d.,]*|\bfrete\s+gr[áa]tis|\b\d+x\s+de\s+R\$\s*[\d.,]+)/gi;

export interface PriceScrubResult {
  scrubbed: boolean;
  before: string;
  after: string;
  reason: string;
}

const PRICE_TRIGGER_STATES = new Set(["greeting", "discovery", "recommendation"]);

export function scrubUnsolicitedPrice(input: {
  pipelineState: string;
  aiResponse: string;
  classification: TurnClassification;
}): PriceScrubResult {
  const { pipelineState, aiResponse, classification } = input;
  const noop: PriceScrubResult = { scrubbed: false, before: aiResponse, after: aiResponse, reason: "noop" };
  if (!aiResponse) return { ...noop, reason: "empty" };
  if (!PRICE_TRIGGER_STATES.has(pipelineState)) return { ...noop, reason: "state_allows_price" };
  if (classification.asked_about_price) return { ...noop, reason: "client_asked_price" };
  if (classification.asked_about_shipping) return { ...noop, reason: "client_asked_shipping" };
  if (classification.confirmed_purchase_intent) return { ...noop, reason: "purchase_intent_allows_price" };

  // Remove linhas inteiras que falam de preço/frete/desconto
  let after = aiResponse.replace(PRICE_LINE_RE, "$1");
  // Pequenas menções inline → tira só a expressão de preço
  after = after.replace(PRICE_INLINE_RE, "");
  // Limpa pontuação órfã / espaços duplicados / linhas em branco múltiplas
  after = after
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\n[ \t]+\n/g, "\n\n")
    .trim();

  if (after === aiResponse.trim()) return { ...noop, reason: "no_price_found" };
  if (after.length < Math.max(20, Math.floor(aiResponse.length * 0.3))) {
    // Se o scrubber comeria mais de 70% da resposta, é melhor regenerar
    // do que devolver coisa quebrada — mas como não regeneramos aqui, só
    // logamos e devolvemos a versão crua. Quem chama decide o que fazer.
    return { ...noop, reason: "scrub_too_aggressive_kept_original" };
  }

  return {
    scrubbed: true,
    before: aiResponse,
    after,
    reason: "removed_unsolicited_price_or_shipping",
  };
}

// ----------------------------------------------------------------
// Greeting Mirror Gate (Reg #5 — Saudação Formal)
//
// Regra de produto: TODA saudação responde no formato formal padrão:
//   "Olá[, Nome], [período], tudo bem? Como posso ajudar[ hoje]?"
//
// - "Olá" sempre (mesmo se cliente disse "Eai", "Opa").
// - Período: ecoa se cliente disse, senão calcula em BRT.
// - "tudo bem?" sempre presente.
// - "hoje" se cliente recorrente (>=1 mensagem anterior na conversa).
// - Nome só se conhecido E recorrente.
// ----------------------------------------------------------------

export interface GreetingGateResult {
  scrubbed: boolean;
  before: string;
  after: string;
  reason: string;
  mandatoryOpening: string;
}

/** Calcula período em BRT (UTC-3 fixo). 5–11h59 manhã · 12–17h59 tarde · resto noite. */
function computePeriodBRT(nowMs: number = Date.now()): "bom dia" | "boa tarde" | "boa noite" {
  const brtMs = nowMs - 3 * 60 * 60 * 1000;
  const hour = new Date(brtMs).getUTCHours();
  if (hour >= 5 && hour < 12) return "bom dia";
  if (hour >= 12 && hour < 18) return "boa tarde";
  return "boa noite";
}

interface FormalGreetingContext {
  period: "bom dia" | "boa tarde" | "boa noite";
  isRecurring: boolean;
  customerName: string | null;
}

function buildFormalOpening(ctx: FormalGreetingContext): string {
  const helloPart = ctx.customerName ? `Olá, ${ctx.customerName}` : "Olá";
  return `${helloPart}, ${ctx.period}, tudo bem?`;
}

function buildFormalCloser(ctx: FormalGreetingContext): string {
  return ctx.isRecurring ? "Como posso ajudar hoje?" : "Como posso ajudar?";
}

export function gateGreetingMirror(input: {
  pipelineState: string;
  aiResponse: string;
  classification: TurnClassification;
  isRecurring?: boolean;
  customerName?: string | null;
  nowMs?: number;
}): GreetingGateResult {
  const { pipelineState, aiResponse, classification: c } = input;

  const period: "bom dia" | "boa tarde" | "boa noite" =
    c.greeting_period || computePeriodBRT(input.nowMs);
  const isRecurring = !!input.isRecurring;
  const customerName = isRecurring && input.customerName
    ? input.customerName.trim().split(/\s+/)[0]
    : null;

  const ctx: FormalGreetingContext = { period, isRecurring, customerName };
  const mandatoryOpening = buildFormalOpening(ctx);
  const closer = buildFormalCloser(ctx);

  const noop: GreetingGateResult = {
    scrubbed: false,
    before: aiResponse,
    after: aiResponse,
    reason: "noop",
    mandatoryOpening,
  };
  if (pipelineState !== "greeting") return { ...noop, reason: "not_greeting_state" };
  if (!aiResponse) return { ...noop, reason: "empty_response" };

  const head = aiResponse.toLowerCase().slice(0, 100);
  const periodOk = head.includes(period);
  const reciprocityOk = /\btudo\s+(bem|sim|certo|tranquilo)\b/.test(head);

  if (periodOk && reciprocityOk) return { ...noop, reason: "already_formal" };

  // [Reg #2.13] Strip iterativo (até 3x) de saudações degeneradas/gírias.
  const degeneratedHeadRe =
    /^\s*(oi|ol[áa]|opa|eai|e\s+ai|salve|hey|hello|hi|al[ôo]|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+(bem|sim|certo)[^.!?\n]*[.!?]?\s*)([.!?,\n]|$)/i;
  let stripped = aiResponse;
  for (let i = 0; i < 3; i++) {
    const m = degeneratedHeadRe.exec(stripped);
    if (!m) break;
    stripped = stripped.slice(m[0].length).trimStart();
  }

  const head2 = `${mandatoryOpening} ${closer}`;
  const after = (stripped ? `${head2} ${stripped}` : head2)
    .replace(/[ \t]{2,}/g, " ")
    .trim();
  if (after === aiResponse) return { ...noop, reason: "rewrite_no_change" };

  return {
    scrubbed: true,
    before: aiResponse,
    after,
    reason: `prepended_formal_${period}${isRecurring ? "_recurring" : ""}`,
    mandatoryOpening,
  };
}

// ----------------------------------------------------------------
// [Reg #2.10] Greeting Mirror Fallback — sem depender do TPR.
// Mesma regra formal, calcula período em BRT se ausente.
// ----------------------------------------------------------------

const PERIOD_WORDS: Record<string, "bom dia" | "boa tarde" | "boa noite"> = {
  "bom dia": "bom dia",
  "boa tarde": "boa tarde",
  "boa noite": "boa noite",
};

const HOW_ARE_YOU_RE = /\btudo\s+(bem|bom|certo|tranquilo|joia|jóia)\b|\bcomo\s+(vai|est[áa])\b|\bbeleza\??\b/i;

export function gateGreetingMirrorFallback(input: {
  pipelineState: string;
  aiResponse: string;
  customerMessage: string;
  isRecurring?: boolean;
  customerName?: string | null;
}): GreetingGateResult {
  const { pipelineState, aiResponse, customerMessage } = input;
  const lc = (customerMessage || "").toLowerCase();
  let period: "bom dia" | "boa tarde" | "boa noite" | null = null;
  for (const w of Object.keys(PERIOD_WORDS)) {
    if (lc.includes(w)) { period = PERIOD_WORDS[w]; break; }
  }
  const askedHow = HOW_ARE_YOU_RE.test(lc);

  return gateGreetingMirror({
    pipelineState,
    aiResponse,
    classification: {
      greeting_period: period,
      asked_how_are_you: askedHow,
    } as TurnClassification,
    isRecurring: input.isRecurring,
    customerName: input.customerName,
  });
}

// ----------------------------------------------------------------
// [Reg #2.11] Enforce Checkout URL In Text
// Garante que, se a tool generate_checkout_link foi chamada com sucesso
// e devolveu uma URL, ela apareça textualmente na resposta final.
// Antes ficava só na "narrativa" da LLM ("aqui está o link...") sem URL.
// Latência zero; idempotente; não duplica se a URL já estiver no texto.
// ----------------------------------------------------------------

export interface CheckoutUrlGateResult {
  scrubbed: boolean;
  before: string;
  after: string;
  reason: string;
  url: string | null;
}

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

export function enforceCheckoutUrlInText(input: {
  aiResponse: string;
  toolResults: Array<{ tool: string; parsed: unknown }>;
}): CheckoutUrlGateResult {
  const { aiResponse, toolResults } = input;
  const noop: CheckoutUrlGateResult = {
    scrubbed: false,
    before: aiResponse,
    after: aiResponse,
    reason: "noop",
    url: null,
  };

  // Pega o ÚLTIMO checkout_url bem-sucedido (caso a tool tenha sido
  // chamada várias vezes no mesmo turno).
  let url: string | null = null;
  for (let i = toolResults.length - 1; i >= 0; i--) {
    const r = toolResults[i];
    if (r.tool !== "generate_checkout_link") continue;
    const p = r.parsed as Record<string, unknown> | null;
    if (p && typeof p === "object" && p.success === true && typeof p.checkout_url === "string") {
      url = p.checkout_url as string;
      break;
    }
  }

  if (!url) return { ...noop, reason: "no_checkout_url_in_tool_results" };
  if (!aiResponse) {
    // Resposta vazia: substitui pelo link mínimo.
    return {
      scrubbed: true,
      before: aiResponse,
      after: `Segue o link do pagamento:\n${url}`,
      reason: "injected_url_into_empty_response",
      url,
    };
  }

  // Se a URL exata já está no texto, ok.
  if (aiResponse.includes(url)) return { ...noop, reason: "url_already_in_text", url };

  // Se a IA colou OUTRA URL (não deveria), substitui pela correta.
  const otherUrlMatch = URL_RE.exec(aiResponse);
  if (otherUrlMatch && otherUrlMatch[0] !== url) {
    const after = aiResponse.replace(URL_RE, url);
    return {
      scrubbed: true,
      before: aiResponse,
      after,
      reason: "replaced_wrong_url",
      url,
    };
  }

  // Caso comum: IA narrou "aqui está o link" sem colar a URL.
  // Anexa a URL ao final, em linha separada.
  const sep = aiResponse.endsWith("\n") ? "" : "\n\n";
  const after = `${aiResponse}${sep}${url}`;
  return {
    scrubbed: true,
    before: aiResponse,
    after,
    reason: "appended_missing_url",
    url,
  };
}

// ----------------------------------------------------------------
// [Frente 3 — Reg #2.16] Enforce Close On Confirmed Intent
//
// Detecta o loop "Posso gerar o link?" quando o cliente JÁ confirmou
// fechamento. Se TPR.confirmed_purchase_intent OU asked_about_payment_or_link,
// E a resposta da IA contém pergunta confirmatória de fechamento,
// E nenhuma generate_checkout_link foi chamada com sucesso este turno
// → marca como duplicata semântica para forçar regeneração com tool_choice.
//
// NÃO reescreve o texto (a IA precisa rodar de novo com força). Apenas
// sinaliza ao orquestrador. Latência zero.
// ----------------------------------------------------------------

export interface CloseLoopGateResult {
  loopDetected: boolean;
  reason: string;
  matchedPattern: string | null;
}

const CLOSE_CONFIRMATION_QUESTION_RE =
  /\b(posso\s+(gerar|mandar|enviar|finalizar|seguir)\s+(o\s+)?(link|pedido|fechamento|com)|quer\s+que\s+eu\s+(gere|mande|envie|finalize|fa[çc]a)\s+(o\s+)?(link|pedido|fechamento)|confirma\s+(que|se)\s+(quer|vai|posso)|posso\s+seguir\s+com\s+(o\s+)?(pedido|fechamento)|vamos\s+fechar\??\s*$|conseguiu\s+pegar\s+os\s+dados)\b/i;

export function enforceCloseOnConfirmedIntent(input: {
  aiResponse: string;
  classification: TurnClassification;
  toolResults: Array<{ tool: string; parsed: unknown }>;
}): CloseLoopGateResult {
  const { aiResponse, classification: c, toolResults } = input;
  const noop: CloseLoopGateResult = { loopDetected: false, reason: "noop", matchedPattern: null };
  if (!aiResponse) return { ...noop, reason: "empty_response" };

  const clientConfirmed = !!(c?.confirmed_purchase_intent || c?.asked_about_payment_or_link);
  if (!clientConfirmed) return { ...noop, reason: "client_did_not_confirm" };

  // Se a tool de checkout foi chamada com sucesso este turno, não é loop.
  const checkoutCalledOk = toolResults.some((r) => {
    if (r.tool !== "generate_checkout_link") return false;
    const p = r.parsed as Record<string, unknown> | null;
    return !!(p && typeof p === "object" && p.success === true && typeof p.checkout_url === "string");
  });
  if (checkoutCalledOk) return { ...noop, reason: "checkout_link_generated_ok" };

  // Se a resposta JÁ contém uma URL http(s), provavelmente o link foi entregue
  // via outro caminho — não bloqueia.
  if (/https?:\/\/[^\s]+/i.test(aiResponse)) return { ...noop, reason: "url_already_in_text" };

  const m = CLOSE_CONFIRMATION_QUESTION_RE.exec(aiResponse);
  if (!m) return { ...noop, reason: "no_confirmation_question" };

  return {
    loopDetected: true,
    reason: "client_confirmed_but_ai_asked_again",
    matchedPattern: m[0],
  };
}

// ----------------------------------------------------------------
// [Reg #9] Enforce Promise Without Action
//
// Detecta quando a IA prometeu gerar/mandar o link ("tô gerando…",
// "vou gerar o link", "preparando seu link") SEM ter chamado a tool
// generate_checkout_link com sucesso neste turno. Marca como loop
// para forçar regeneração com tool_choice (mesma rede de segurança
// do enforceCloseOnConfirmedIntent — Reg #2.16).
//
// NÃO reescreve o texto. Apenas sinaliza ao orquestrador.
// ----------------------------------------------------------------

const PROMISE_LINK_RE =
  /\b(t[ôo] gerando|estou gerando|vou gerar (o )?link|gerando (o |seu )?link|preparando (o |seu )?link|aguarde (um|s[óo]) (instante|momento)[^.\n]*link|j[áa] (vou|t[ôo]) gerando|j[áa] (vou|t[ôo]) mandando o link|deixa eu gerar (o )?link|vou (te )?mandar (o )?link)\b/i;

export interface PromiseWithoutActionResult {
  loopDetected: boolean;
  reason: string;
  matchedPattern: string | null;
}

export function enforcePromiseWithoutAction(input: {
  aiResponse: string;
  toolResults: Array<{ tool: string; parsed: unknown }>;
}): PromiseWithoutActionResult {
  const { aiResponse, toolResults } = input;
  const noop: PromiseWithoutActionResult = { loopDetected: false, reason: "noop", matchedPattern: null };
  if (!aiResponse) return { ...noop, reason: "empty_response" };

  const checkoutCalledOk = toolResults.some((r) => {
    if (r.tool !== "generate_checkout_link") return false;
    const p = r.parsed as Record<string, unknown> | null;
    return !!(p && typeof p === "object" && p.success === true && typeof p.checkout_url === "string");
  });
  if (checkoutCalledOk) return { ...noop, reason: "checkout_link_generated_ok" };

  // Se já tem URL no texto, link foi entregue por outro caminho.
  if (/https?:\/\/[^\s]+/i.test(aiResponse)) return { ...noop, reason: "url_already_in_text" };

  const m = PROMISE_LINK_RE.exec(aiResponse);
  if (!m) return { ...noop, reason: "no_promise_pattern" };

  return {
    loopDetected: true,
    reason: "ai_promised_link_without_calling_tool",
    matchedPattern: m[0],
  };
}

// ----------------------------------------------------------------
// [Reg #9] Enforce No Checkout Data Ask
//
// Em recommendation/decision/checkout_assist, se a IA pede CEP / CPF /
// email / endereço / forma de pagamento pelo WhatsApp e a tool
// generate_checkout_link existe, marcamos como loop. Esses dados são
// preenchidos pelo cliente NA PÁGINA de checkout — não devem ser
// pedidos pelo WhatsApp.
// ----------------------------------------------------------------

const CHECKOUT_DATA_ASK_RE =
  /\b(qual (o |seu |teu )?(cep|endere[çc]o|cpf|e-?mail)|me (passa|envia|manda|d[áa]) (o |seu |teu )?(cep|cpf|endere[çc]o|e-?mail)|qual (a |sua )?forma de pagamento|como (voc[êe] )?(prefere|quer|deseja) pagar|cart[ãa]o ou pix|pix ou (cart[ãa]o|boleto)|pagamento (em )?(pix|boleto|cart[ãa]o)\?|prefere (pix|boleto|cart[ãa]o))\b/i;

const CHECKOUT_DATA_STATES = new Set(["recommendation", "decision", "checkout_assist", "product_detail"]);

export interface CheckoutDataAskResult {
  loopDetected: boolean;
  reason: string;
  matchedPattern: string | null;
}

export function enforceNoCheckoutDataAsk(input: {
  pipelineState: string;
  aiResponse: string;
  generateCheckoutAvailable: boolean;
}): CheckoutDataAskResult {
  const { pipelineState, aiResponse, generateCheckoutAvailable } = input;
  const noop: CheckoutDataAskResult = { loopDetected: false, reason: "noop", matchedPattern: null };
  if (!aiResponse) return { ...noop, reason: "empty_response" };
  if (!CHECKOUT_DATA_STATES.has(pipelineState)) return { ...noop, reason: "state_not_eligible" };
  if (!generateCheckoutAvailable) return { ...noop, reason: "generate_checkout_link_unavailable" };

  const m = CHECKOUT_DATA_ASK_RE.exec(aiResponse);
  if (!m) return { ...noop, reason: "no_data_ask_pattern" };

  return {
    loopDetected: true,
    reason: "ai_asked_checkout_data_via_whatsapp",
    matchedPattern: m[0],
  };
}

// ----------------------------------------------------------------
// [Reg #10] Strip Forbidden Vocative
//
// Quando o handler decidiu suprimir vocativo (nome corporativo ou
// placeholder genérico tipo "Cliente de teste"), o LLM ainda pode
// ignorar a instrução e cuspir "Fechado, Cliente, ..." ou "Olá,
// Teste, tudo bem?". Este scrubber remove de forma determinística
// essas ocorrências do texto antes de persistir/enviar.
//
// NÃO regenera. Apenas regrava removendo o vocativo.
// ----------------------------------------------------------------

export interface VocativeScrubResult {
  scrubbed: boolean;
  before: string;
  after: string;
  reason: string;
  removedTokens: string[];
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function stripForbiddenVocative(input: {
  aiResponse: string;
  forbiddenTokens: string[];
}): VocativeScrubResult {
  const { aiResponse } = input;
  const forbidden = (input.forbiddenTokens || [])
    .map((t) => (t || "").trim())
    .filter((t) => t.length >= 2 && t.length <= 30);

  const noop: VocativeScrubResult = {
    scrubbed: false, before: aiResponse, after: aiResponse,
    reason: "noop", removedTokens: [],
  };
  if (!aiResponse || forbidden.length === 0) return { ...noop, reason: "empty_or_no_tokens" };

  const removed: string[] = [];
  let after = aiResponse;
  for (const tok of forbidden) {
    const t = escapeRegex(tok);
    // 1) Vocativo no MEIO: ", Cliente,"  ou  ", Cliente."  ou  ", Cliente!"
    const midRe = new RegExp(`,\\s*${t}\\b\\s*([,.!?;:])`, "gi");
    // 2) Vocativo APÓS abridor: "Olá, Cliente," / "Fechado, Cliente." / "Bom dia, Cliente!"
    const openRe = new RegExp(
      `\\b(Ol[áa]|Oi|Opa|Eai|Hey|Hello|Bom\\s+dia|Boa\\s+tarde|Boa\\s+noite|Fechado|Beleza|Show|Perfeito|Claro|Combinado)\\b\\s*,\\s*${t}\\b\\s*[,.!?]?`,
      "gi"
    );
    let mutated = after;
    mutated = mutated.replace(midRe, "$1");
    mutated = mutated.replace(openRe, (_m, opener) => `${opener},`);
    // 3) Vocativo isolado no início: "Cliente, ..." => apaga "Cliente, "
    const startRe = new RegExp(`^\\s*${t}\\b\\s*[,.!?:]\\s*`, "i");
    mutated = mutated.replace(startRe, "");
    if (mutated !== after) {
      removed.push(tok);
      after = mutated;
    }
  }

  // Limpeza final
  after = after
    .replace(/[ \t]{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .replace(/\s+,/g, ",")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (after === aiResponse.trim()) return { ...noop, reason: "no_vocative_match" };
  return {
    scrubbed: true,
    before: aiResponse,
    after,
    reason: `stripped_vocative_${removed.join("|")}`,
    removedTokens: removed,
  };
}
