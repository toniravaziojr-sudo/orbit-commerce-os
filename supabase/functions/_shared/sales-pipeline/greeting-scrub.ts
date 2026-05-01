// ============================================================
// Pipeline F2 — Greeting Scrub (Reg #5 — Saudação Formal)
//
// Rede de segurança SERVER-SIDE para a saudação formal padrão.
// O `greeting-mirror.ts` injeta a abertura literal no prompt, mas o
// modelo às vezes ignora e abre só com "Oi!" / "Olá tudo bem?". Aqui
// detectamos a quebra e reescrevemos a abertura SEM regenerar
// (custo zero, latência zero).
//
// Aplica APENAS quando:
//   1. estado da pipeline é "greeting"
//   2. há mensagem do cliente E resposta da IA
//   3. resposta da IA NÃO contém o período do dia esperado
//      OU NÃO inclui "tudo bem?"
//
// Estratégia: prepend da abertura mecânica (`mandatoryOpening`) +
// remoção do "Oi!"/"Olá!" inicial degenerado, preservando o resto.
// ============================================================

import { detectGreetingEcho, type GreetingEcho, type GreetingEchoOptions } from "./greeting-mirror.ts";

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
 * Verifica se a abertura da resposta da IA já contém o período do
 * dia E o "tudo bem?". Conservador: olha as primeiras 80 letras
 * (cabem "Olá, [Nome], boa tarde, tudo bem?" + folga).
 */
function alreadyMirrors(response: string, echo: GreetingEcho): boolean {
  const head = normalizeStart(response).slice(0, 80);

  // Período sempre presente no echo (formal). Exigir no início.
  if (!head.includes(echo.period)) return false;

  // "tudo bem?" sempre obrigatório no padrão formal.
  const reciprocates = /\btudo\s+(bem|sim|certo|tranquilo)\b/.test(head);
  if (!reciprocates) return false;

  return true;
}

/**
 * Reescreve a abertura preservando o "miolo" da resposta da IA.
 * Remove "Oi!"/"Olá!"/"Eai!" degenerado do início (até 3 iterações
 * para pegar saudações encadeadas) e antepõe a abertura formal.
 */
function rewriteOpening(response: string, echo: GreetingEcho): string {
  if (!echo.mandatoryOpening) return response;

  let stripped = response;
  const degeneratedHeadRe =
    /^\s*(oi|ol[áa]|opa|eai|e\s+ai|salve|hey|hello|hi|al[ôo]|bom\s+dia|boa\s+tarde|boa\s+noite|tudo\s+(bem|sim|certo)[^.!?\n]*[.!?]?\s*)([.!?,\n]|$)/i;

  // Iterativo (até 3x) para remover saudações encadeadas tipo "Oi! Tudo bem? Olá!"
  for (let i = 0; i < 3; i++) {
    const m = degeneratedHeadRe.exec(stripped);
    if (!m) break;
    stripped = stripped.slice(m[0].length).trimStart();
  }

  let opening = echo.mandatoryOpening.trim();
  if (!/[.!?]$/.test(opening)) opening += "!";

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
  isRecurring?: boolean;
  customerName?: string | null;
}): GreetingScrubResult {
  const { pipelineState, customerMessage, aiResponse, isRecurring, customerName } = input;

  const opts: GreetingEchoOptions = { isRecurring, customerName };
  const echoFallback = detectGreetingEcho(customerMessage || "", opts);

  const baseResult: GreetingScrubResult = {
    scrubbed: false,
    before: aiResponse,
    after: aiResponse,
    reason: "noop",
    echo: echoFallback,
  };

  if (pipelineState !== "greeting") return { ...baseResult, reason: "not_greeting_state" };
  if (!customerMessage || !aiResponse) return { ...baseResult, reason: "empty_input" };

  const echo = detectGreetingEcho(customerMessage, opts);
  baseResult.echo = echo;

  if (!echo.hasGreeting) {
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
    reason: `rewrote_opening_to_formal_${echo.period}`,
    echo,
  };
}
