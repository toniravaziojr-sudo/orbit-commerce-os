// ============================================================
// Pipeline F2 — Greeting Scrub (Bloco 3.3)
//
// Rede de segurança SERVER-SIDE para reciprocidade de saudação.
// O `greeting-mirror.ts` injeta a abertura literal no prompt, mas o
// modelo às vezes ignora e abre só com "Oi!" quando o cliente disse
// "boa noite". Aqui detectamos a quebra e reescrevemos a abertura
// SEM regenerar (custo zero, latência zero).
//
// Aplica APENAS quando:
//   1. estado da pipeline é "greeting"
//   2. mensagem do cliente contém saudação com período do dia
//      OU pergunta "tudo bem?"
//   3. resposta da IA NÃO espelha o que o cliente disse
//
// Estratégia: prepend da abertura mecânica (`mandatoryOpening`) +
// remoção do "Oi!"/"Olá!" inicial degenerado, preservando o resto.
// ============================================================

import { detectGreetingEcho, type GreetingEcho } from "./greeting-mirror.ts";

export interface GreetingScrubResult {
  scrubbed: boolean;
  before: string;
  after: string;
  reason: string;
  echo: GreetingEcho;
}

function normalizeStart(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Verifica se a abertura da resposta da IA já espelha minimamente
 * o período do dia ou o "tudo bem?" perguntado pelo cliente.
 *
 * Conservador de propósito: se o período aparece nas primeiras 50
 * letras da resposta, considera espelhado (mesmo que invertido na
 * ordem) e NÃO mexe.
 */
function alreadyMirrors(response: string, echo: GreetingEcho): boolean {
  const head = normalizeStart(response).slice(0, 60);

  // Se o cliente usou período, exigir que o período apareça no início
  if (echo.period) {
    if (!head.includes(echo.period)) return false;
  }

  // Se o cliente perguntou "tudo bem", exigir reciprocidade explícita
  if (echo.askedHowAreYou) {
    const reciprocates =
      /\btudo\s+(bem|sim|certo|tranquilo)\b/.test(head) ||
      /\be\s+(com\s+)?voc[êe]\??/.test(head) ||
      /\be\s+contigo\??/.test(head);
    if (!reciprocates) return false;
  }

  return true;
}

/**
 * Reescreve a abertura preservando o "miolo" da resposta da IA.
 * Remove "Oi!"/"Olá!"/"Olá," degenerado do início (se houver) e
 * antepõe a abertura literal espelhada do cliente.
 */
function rewriteOpening(response: string, echo: GreetingEcho): string {
  if (!echo.mandatoryOpening) return response;

  // Remove até a primeira pontuação forte (.!?\n) se for um "Oi!" ou
  // "Olá! Tudo bem?" degenerado — esses padrões cabem em até ~25 chars.
  let stripped = response;
  const degeneratedHeadRe =
    /^\s*(oi|ol[áa]|opa|hey|hello|hi|tudo\s+(bem|sim|certo)[^.!?\n]*[.!?]?\s*)([.!?\n]|$)/i;
  const m = degeneratedHeadRe.exec(stripped);
  if (m) {
    stripped = stripped.slice(m[0].length).trimStart();
  }

  // Garante que mandatoryOpening termina em pontuação
  let opening = echo.mandatoryOpening.trim();
  if (!/[.!?]$/.test(opening)) opening += "!";

  // Junta com 1 espaço, evita pontuação dupla
  if (stripped) {
    return `${opening} ${stripped}`.replace(/[ \t]{2,}/g, " ").trim();
  }
  return opening;
}

/**
 * Função principal. Recebe a mensagem do cliente, a resposta crua
 * da IA, e o estado da pipeline. Retorna a resposta corrigida quando
 * fizer sentido — caso contrário devolve igual.
 */
export function scrubGreetingReciprocity(input: {
  pipelineState: string;
  customerMessage: string;
  aiResponse: string;
}): GreetingScrubResult {
  const { pipelineState, customerMessage, aiResponse } = input;

  const baseResult: GreetingScrubResult = {
    scrubbed: false,
    before: aiResponse,
    after: aiResponse,
    reason: "noop",
    echo: {
      hasGreeting: false,
      period: null,
      hello: null,
      askedHowAreYou: false,
      mandatoryOpening: "",
    },
  };

  if (pipelineState !== "greeting") return { ...baseResult, reason: "not_greeting_state" };
  if (!customerMessage || !aiResponse) return { ...baseResult, reason: "empty_input" };

  const echo = detectGreetingEcho(customerMessage);
  baseResult.echo = echo;

  if (!echo.hasGreeting || !echo.mandatoryOpening) {
    return { ...baseResult, reason: "no_greeting_to_mirror" };
  }

  if (alreadyMirrors(aiResponse, echo)) {
    return { ...baseResult, reason: "already_mirrors" };
  }

  const after = rewriteOpening(aiResponse, echo);
  if (after === aiResponse) return { ...baseResult, reason: "rewrite_no_change" };

  return {
    scrubbed: true,
    before: aiResponse,
    after,
    reason: `rewrote_opening_to_mirror_${echo.period || echo.hello || "greeting"}`,
    echo,
  };
}
