// ============================================================
// Pipeline F2 — Greeting Mirror
//
// Extrai os tokens de saudação da última mensagem do cliente
// (período do dia + saudação informal + "tudo bem?") e monta a
// ABERTURA OBRIGATÓRIA que a IA precisa usar literalmente.
//
// Por que mecânico: o modelo (Gemini Flash) frequentemente
// "resume" a saudação e descarta o "boa noite". Em vez de pedir
// gentileza, calculamos a string e mandamos a IA começar com ela.
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
  period: "bom dia" | "boa tarde" | "boa noite" | null;
  hello: "oi" | "olá" | null;
  askedHowAreYou: boolean;
  // Frase literal que a IA DEVE usar para começar a resposta.
  mandatoryOpening: string;
}

export function detectGreetingEcho(userMessage: string): GreetingEcho {
  const text = normalize(userMessage);

  let period: GreetingEcho["period"] = null;
  if (/\bbom dia\b/.test(text)) period = "bom dia";
  else if (/\bboa tarde\b/.test(text)) period = "boa tarde";
  else if (/\bboa noite\b/.test(text)) period = "boa noite";

  let hello: GreetingEcho["hello"] = null;
  if (/\bola\b/.test(text)) hello = "olá";
  else if (/\b(oi|opa|eai|e ai|hey|hello)\b/.test(text)) hello = "oi";

  const askedHowAreYou =
    /\b(tudo bem|tudo bom|td bem|td bom|tudo certo|como vai|como esta|como voce esta|beleza|blz)\b/.test(text);

  const hasGreeting = !!(period || hello || askedHowAreYou);

  // Monta a abertura literal preservando a ordem natural: oi → período → tudo bem
  const parts: string[] = [];
  if (hello && period) {
    // "Oi, boa noite" / "Olá, bom dia"
    parts.push(`${capitalize(hello)}, ${period}`);
  } else if (period) {
    parts.push(capitalize(period));
  } else if (hello) {
    parts.push(capitalize(hello));
  }

  let opening = parts.join("");
  if (askedHowAreYou) {
    opening = opening ? `${opening}, tudo bem?` : "Tudo bem?";
  } else if (opening) {
    opening = `${opening}!`;
  }

  return {
    hasGreeting,
    period,
    hello,
    askedHowAreYou,
    mandatoryOpening: opening,
  };
}

function capitalize(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Bloco de contexto a ser injetado no prompt do estado greeting.
// Vai DEPOIS do guardrail, então tem precedência sobre tudo.
export function buildGreetingMirrorBlock(echo: GreetingEcho): string | null {
  if (!echo.hasGreeting || !echo.mandatoryOpening) return null;

  return [
    "### ABERTURA OBRIGATÓRIA DESTE TURNO (REGRA MECÂNICA)",
    `O cliente usou esta saudação. Sua resposta DEVE começar LITERALMENTE com:`,
    ``,
    `  "${echo.mandatoryOpening}"`,
    ``,
    "Depois desse início obrigatório, complete com UMA frase curta convidando",
    'o cliente a contar o que precisa (ex: "Me conta, como posso te ajudar?",',
    '"Me diz o que você procura, estou aqui pra ajudar.").',
    "",
    "É PROIBIDO:",
    "- Trocar a saudação por outra (ex: cliente disse 'boa noite' → você responder só 'Oi!').",
    "- Omitir o período do dia se o cliente usou um.",
    "- Omitir o 'tudo bem?' se o cliente perguntou.",
    "- Usar 'Como posso te ajudar hoje?' ou variações corporativas.",
    "",
    "Exemplo do formato final esperado:",
    `  "${echo.mandatoryOpening} Me conta, como posso te ajudar?"`,
  ].join("\n");
}
