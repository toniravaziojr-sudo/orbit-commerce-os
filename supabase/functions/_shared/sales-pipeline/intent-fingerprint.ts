// ============================================================
// Pipeline F2 — Intent Fingerprint (Bloco 3.4)
//
// Anti-repetição por FAMÍLIA SEMÂNTICA, não por hash exato.
//
// Problema: o anti-repetição atual hasheia os primeiros 80 chars
// normalizados. "Posso separar pra você?" e "Deixo separado pra
// você?" geram hashes diferentes — mesma intenção, hashes distintos
// → loop não é detectado.
//
// Solução: classificar a intenção do turno da IA em uma família
// canônica e gerar o fingerprint a partir dela. Quando duas
// respostas consecutivas caem na MESMA família → tratar como
// duplicata (regenerar/suprimir).
//
// Famílias cobertas (a IA repete TIPO esses padrões):
//   - reserve_offer        ("posso separar/reservar/garantir/deixar separado")
//   - confirm_close        ("posso finalizar/gerar o link/quer fechar")
//   - generic_help         ("como posso te ajudar?", "em que posso ajudar?")
//   - bundle_upsell_ask    ("quer ver o combo?", "tem o pack de 3, quer ver?")
//   - data_request         ("me passa seu nome?", "qual seu CEP?")
//   - generic_qualify      ("o que você procura?", "qual seu objetivo?")
//   - opening_greeting     ("oi", "olá")
//
// Fingerprint final = `${family}|${prefixHash80}`. Se a próxima
// resposta cai na mesma family E o prefixHash mudou (ou seja, o
// modelo trocou as palavras mas a intenção é a mesma), tratamos
// como duplicata semântica.
// ============================================================

export type IntentFamily =
  | "reserve_offer"
  | "confirm_close"
  | "generic_help"
  | "bundle_upsell_ask"
  | "data_request"
  | "generic_qualify"
  | "opening_greeting"
  | "other";

const FAMILY_PATTERNS: Array<{ family: IntentFamily; patterns: RegExp[] }> = [
  {
    family: "reserve_offer",
    patterns: [
      /\bposso\s+(separar|reservar|garantir|deixar\s+separad[oa])/i,
      /\b(deixo|deixar|j[áa]\s+deixo)\s+separad[oa]\s+pra/i,
      /\b(quer|posso)\s+(que\s+eu\s+)?(reservar|separar|garantir)/i,
      /\bvou\s+(deixar|separar|reservar)\s+(esse|essa|isso|aquele|aquela)/i,
      /\bmantenho\s+(a\s+)?(quantidade|reserva)/i,
    ],
  },
  {
    family: "confirm_close",
    patterns: [
      /\bposso\s+(finalizar|gerar|mandar|enviar)\s+(o\s+)?(link|pedido)/i,
      /\bquer\s+que\s+eu\s+(finalize|gere|mande|envie)\s+(o\s+)?(link|pedido)/i,
      /\bconfirma\s+(que|se)\s+(quer|vai)\s+(fechar|levar)/i,
      /\bposso\s+seguir\s+com\s+(o\s+)?(pedido|fechamento)/i,
      /\bvamos\s+fechar\??\s*$/i,
    ],
  },
  {
    family: "bundle_upsell_ask",
    patterns: [
      /\b(quer|prefere)\s+(ver\s+)?(o\s+)?(combo|kit|pack)\s+(de\s+)?(2|3|6)/i,
      /\btem\s+o\s+(combo|kit|pack)\s+(de\s+)?(2|3|6)[^.?!]{0,30}quer\s+ver/i,
      /\bsai\s+mais\s+em\s+conta\s+(no|com)\s+(combo|kit|pack)/i,
    ],
  },
  {
    family: "data_request",
    patterns: [
      /\bme\s+(passa|manda|fala|diz)\s+(seu|o\s+seu)\s+(nome|email|cpf|cep|telefone|whats)/i,
      /\bqual\s+(o\s+)?seu\s+(nome|email|cpf|cep|telefone|endere[çc]o)/i,
      /\bpreciso\s+(do\s+)?(seu|do)\s+(nome|email|cpf|cep|telefone|endere[çc]o)/i,
    ],
  },
  {
    family: "generic_qualify",
    patterns: [
      /\bo\s+que\s+voc[êe]\s+(procura|busca|deseja|quer|precisa)\b/i,
      /\bqual\s+(o\s+)?seu\s+(objetivo|necessidade|interesse|caso)/i,
      /\b(pra|para)\s+(qual|que)\s+(objetivo|finalidade|uso|caso)/i,
    ],
  },
  {
    family: "generic_help",
    patterns: [
      /\bcomo\s+posso\s+(te\s+)?ajudar/i,
      /\bem\s+que\s+posso\s+(ajudar|te\s+ajudar|ser\s+[úu]til)/i,
      /\bestou\s+aqui\s+(pra|para)\s+(te\s+)?ajudar(\??)\s*$/i,
    ],
  },
  {
    family: "opening_greeting",
    patterns: [
      /^\s*(oi|ol[áa]|opa|bom\s+dia|boa\s+tarde|boa\s+noite|hey|hello|hi)[!,.\s]*$/i,
    ],
  },
];

export function classifyIntentFamily(response: string): IntentFamily {
  if (!response || typeof response !== "string") return "other";
  for (const { family, patterns } of FAMILY_PATTERNS) {
    if (patterns.some((re) => re.test(response))) return family;
  }
  return "other";
}

function normalizePrefix(content: string): string {
  return content
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

/**
 * Fingerprint semântico: family + hash do prefixo.
 * Permite detectar:
 *   - mesma família + prefixo diferente → duplicata semântica
 *   - mesma família + mesmo prefixo → duplicata exata (já era pego)
 */
export async function fingerprintResponse(content: string): Promise<{
  family: IntentFamily;
  prefixHash: string;
  fingerprint: string;
}> {
  const family = classifyIntentFamily(content);
  const normalized = normalizePrefix(content);
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalized));
  const prefixHash = Array.from(new Uint8Array(buf))
    .slice(0, 8)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return {
    family,
    prefixHash,
    fingerprint: `${family}|${prefixHash}`,
  };
}

/**
 * Compara família atual com lista de famílias dos N turnos anteriores
 * da IA. Se houver MATCH em algum dos últimos 2 turnos → duplicata
 * semântica. (Famílias "other" e "opening_greeting" nunca disparam
 * — são genéricas demais; usamos só o hash exato pra esses.)
 */
export function isSemanticDuplicate(
  currentFamily: IntentFamily,
  recentFamilies: IntentFamily[],
): { duplicate: boolean; reason: string } {
  if (currentFamily === "other" || currentFamily === "opening_greeting") {
    return { duplicate: false, reason: "non_actionable_family" };
  }
  // Olha apenas os 2 últimos turnos da IA
  const recent = recentFamilies.slice(-2);
  if (recent.includes(currentFamily)) {
    return {
      duplicate: true,
      reason: `semantic_repeat_family_${currentFamily}`,
    };
  }
  return { duplicate: false, reason: "fresh_family" };
}
