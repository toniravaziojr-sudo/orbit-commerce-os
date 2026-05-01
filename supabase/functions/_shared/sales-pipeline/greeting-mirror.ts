// ============================================================
// Pipeline F2 — Greeting Mirror (Frente 8 — Saudação Formal)
//
// REGRA DE PRODUTO (Reg #5, 01/mai/2026):
// A IA SEMPRE responde de forma formal, sem gírias, mesmo que o
// cliente abra com "Eai", "Opa", "Salve". Mapeamento:
//   "eai", "opa", "salve", "hey", "oi"  → "Olá"
//   "olá"                                → "Olá"
//   (sem saudação verbal)                → "Olá"
//
// Período do dia:
// - Se o cliente disse "bom dia/boa tarde/boa noite", ECOA o que ele disse.
// - Se NÃO disse, calculamos pelo horário em BRT (America/Sao_Paulo).
//
// "Tudo bem?":
// - SEMPRE incluir na primeira saudação do turno (mesmo se o cliente não perguntou).
// - Linguagem formal padrão.
//
// Cliente recorrente (já apareceu no histórico recente da conversa):
// - "Como posso ajudar HOJE?" em vez de "Como posso ajudar?"
// - Se conhecemos o nome, usar "Olá, [Nome]!" — caso contrário só "Olá".
//
// O tenant pode futuramente sobrescrever via ai_support_config.greeting_style
// (formal | casual). Padrão = formal.
// ============================================================

function normalize(s: string): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[!?.,;:]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface GreetingEcho {
  hasGreeting: boolean;
  /** Período detectado/calculado — sempre presente. */
  period: "bom dia" | "boa tarde" | "boa noite";
  /** Se o cliente DISSE o período (true) ou se calculamos pelo horário (false). */
  periodEchoed: boolean;
  askedHowAreYou: boolean;
  /** Cliente recorrente — usa "hoje" no fechamento. */
  isRecurring: boolean;
  /** Nome a usar (apenas se conhecido E recorrente). */
  customerName: string | null;
  /** Frase literal que a IA DEVE usar para começar a resposta. */
  mandatoryOpening: string;
}

export interface GreetingEchoOptions {
  /** Cliente já apareceu no histórico recente (>=1 mensagem anterior). */
  isRecurring?: boolean;
  /** Primeiro nome do cliente, se conhecido (usar só com isRecurring=true). */
  customerName?: string | null;
  /** Override de horário em ms (testes). Padrão: Date.now(). */
  nowMs?: number;
}

/**
 * Calcula o período do dia em BRT (America/Sao_Paulo, UTC-3).
 *  5h–11h59 → bom dia
 * 12h–17h59 → boa tarde
 * 18h–4h59  → boa noite
 */
export function computePeriodBRT(nowMs: number = Date.now()): "bom dia" | "boa tarde" | "boa noite" {
  // BRT é UTC-3 fixo (Brasil não usa horário de verão desde 2019).
  const brtMs = nowMs - 3 * 60 * 60 * 1000;
  const hour = new Date(brtMs).getUTCHours();
  if (hour >= 5 && hour < 12) return "bom dia";
  if (hour >= 12 && hour < 18) return "boa tarde";
  return "boa noite";
}

export function detectGreetingEcho(
  userMessage: string,
  opts: GreetingEchoOptions = {},
): GreetingEcho {
  const text = normalize(userMessage);

  // Período: ecoa se o cliente disse, senão calcula pelo horário BRT.
  let period: GreetingEcho["period"];
  let periodEchoed = false;
  if (/\bbom dia\b/.test(text)) {
    period = "bom dia";
    periodEchoed = true;
  } else if (/\bboa tarde\b/.test(text)) {
    period = "boa tarde";
    periodEchoed = true;
  } else if (/\bboa noite\b/.test(text)) {
    period = "boa noite";
    periodEchoed = true;
  } else {
    period = computePeriodBRT(opts.nowMs);
  }

  // Detecta saudação verbal do cliente (não importa qual — sempre vira "Olá").
  const hasVerbalGreeting =
    /\b(ola|oi|opa|eai|e ai|salve|hey|hello|hi|alo|alô)\b/.test(text);

  const askedHowAreYou =
    /\b(tudo bem|tudo bom|td bem|td bom|tudo certo|como vai|como esta|como voce esta|beleza|blz)\b/.test(text);

  const hasGreeting = hasVerbalGreeting || periodEchoed || askedHowAreYou;

  const isRecurring = !!opts.isRecurring;
  const customerName = isRecurring && opts.customerName ? opts.customerName.trim().split(/\s+/)[0] : null;

  // Monta saudação formal padrão: "Olá[, Nome], [período], tudo bem?"
  const helloPart = customerName ? `Olá, ${customerName}` : "Olá";
  const mandatoryOpening = `${helloPart}, ${period}, tudo bem?`;

  return {
    hasGreeting,
    period,
    periodEchoed,
    askedHowAreYou,
    isRecurring,
    customerName,
    mandatoryOpening,
  };
}

// Bloco de contexto a ser injetado no prompt do estado greeting.
// Vai DEPOIS do guardrail, então tem precedência sobre tudo.
export function buildGreetingMirrorBlock(echo: GreetingEcho): string | null {
  if (!echo.hasGreeting) return null;

  const closer = echo.isRecurring
    ? "Como posso ajudar hoje?"
    : "Como posso ajudar?";

  return [
    "### ABERTURA OBRIGATÓRIA DESTE TURNO (REGRA MECÂNICA — TOM FORMAL)",
    `Sua resposta DEVE começar LITERALMENTE com:`,
    ``,
    `  "${echo.mandatoryOpening}"`,
    ``,
    `Depois, encerre com EXATAMENTE: "${closer}"`,
    "",
    "É PROIBIDO:",
    "- Usar gírias como 'Eai', 'Opa', 'Salve', 'Beleza', 'Tranquilo', mesmo se o cliente usou.",
    "- Trocar 'Olá' por 'Oi' (sempre 'Olá' — tom formal padrão).",
    `- Trocar o período do dia ('${echo.period}' está correto para o horário atual em BRT).`,
    "- Omitir 'tudo bem?'.",
    "- Adicionar perguntas extras antes do fechamento (ex: 'Me conta o que procura?').",
    "",
    "Exemplo do formato final esperado:",
    `  "${echo.mandatoryOpening} ${closer}"`,
  ].join("\n");
}
