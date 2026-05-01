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
// Greeting Mirror Gate (corrige o bug AND/OR do greeting-scrub.ts)
// LE direto do TPR (greeting_period + asked_how_are_you) — não usa regex.
// ----------------------------------------------------------------

export interface GreetingGateResult {
  scrubbed: boolean;
  before: string;
  after: string;
  reason: string;
  mandatoryOpening: string;
}

function buildOpeningFromTPR(c: TurnClassification): string {
  const parts: string[] = [];
  if (c.greeting_period) {
    parts.push(c.greeting_period.charAt(0).toUpperCase() + c.greeting_period.slice(1));
  }
  if (c.asked_how_are_you) {
    if (parts.length) parts[parts.length - 1] = parts[parts.length - 1] + ", tudo bem?";
    else parts.push("Tudo bem?");
  } else if (parts.length) {
    parts[parts.length - 1] = parts[parts.length - 1] + "!";
  }
  return parts.join("");
}

export function gateGreetingMirror(input: {
  pipelineState: string;
  aiResponse: string;
  classification: TurnClassification;
}): GreetingGateResult {
  const { pipelineState, aiResponse, classification: c } = input;
  const mandatoryOpening = buildOpeningFromTPR(c);
  const noop: GreetingGateResult = {
    scrubbed: false,
    before: aiResponse,
    after: aiResponse,
    reason: "noop",
    mandatoryOpening,
  };
  if (pipelineState !== "greeting") return { ...noop, reason: "not_greeting_state" };
  if (!mandatoryOpening) return { ...noop, reason: "no_greeting_to_mirror" };
  if (!aiResponse) return { ...noop, reason: "empty_response" };

  const head = aiResponse.toLowerCase().slice(0, 80);
  const periodOk = c.greeting_period ? head.includes(c.greeting_period) : true;
  const reciprocityOk = c.asked_how_are_you
    ? /\btudo\s+(bem|sim|certo|tranquilo)\b|\be\s+(com\s+)?voc[êe]\??/.test(head)
    : true;
  // CORREÇÃO do bug AND/OR: AGORA exige os DOIS quando os dois sinais
  // estão presentes.
  if (periodOk && reciprocityOk) return { ...noop, reason: "already_mirrors_correctly" };

  // Reescreve abertura: remove "Oi!"/"Olá!" degenerado e antepõe a saudação espelhada
  const degeneratedHeadRe =
    /^\s*(oi|ol[áa]|opa|hey|hello|hi|tudo\s+(bem|sim|certo)[^.!?\n]*[.!?]?\s*)([.!?\n]|$)/i;
  let stripped = aiResponse;
  const m = degeneratedHeadRe.exec(stripped);
  if (m) stripped = stripped.slice(m[0].length).trimStart();

  let opening = mandatoryOpening.trim();
  if (!/[.!?]$/.test(opening)) opening += "!";
  const after = (stripped ? `${opening} ${stripped}` : opening).replace(/[ \t]{2,}/g, " ").trim();
  if (after === aiResponse) return { ...noop, reason: "rewrite_no_change" };

  return {
    scrubbed: true,
    before: aiResponse,
    after,
    reason: `prepended_${c.greeting_period || "greeting"}${c.asked_how_are_you ? "_with_reciprocity" : ""}`,
    mandatoryOpening,
  };
}

// ----------------------------------------------------------------
// [Reg #2.10] Greeting Mirror Fallback — sem depender do TPR.
// Detecta direto na mensagem do cliente o período do dia e a pergunta
// "tudo bem?". Usado quando TPR.source !== 'llm' (timeout, rate limit,
// fallback regex). Antes, sem TPR, o gate não rodava e a saudação
// degenerada ("Oi!" pra "Boa tarde") passava.
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
}): GreetingGateResult {
  const { pipelineState, aiResponse, customerMessage } = input;
  const lc = (customerMessage || "").toLowerCase();
  let period: "bom dia" | "boa tarde" | "boa noite" | null = null;
  for (const w of Object.keys(PERIOD_WORDS)) {
    if (lc.includes(w)) { period = PERIOD_WORDS[w]; break; }
  }
  const askedHow = HOW_ARE_YOU_RE.test(lc);

  // Reusa gateGreetingMirror passando uma classification sintética
  return gateGreetingMirror({
    pipelineState,
    aiResponse,
    classification: {
      // só os 2 campos lidos pelo gate
      greeting_period: period,
      asked_how_are_you: askedHow,
    } as TurnClassification,
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
