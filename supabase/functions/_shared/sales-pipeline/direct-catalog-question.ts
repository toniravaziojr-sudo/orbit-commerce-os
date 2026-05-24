// ============================================================
// Frente 2 — Catalog Probe responde direto a "kit / shampoo / balm"
// sem precisar de família em foco persistida.
//
// Quando o cliente pergunta diretamente sobre uma família ou kit
// ("qual o kit mais completo?", "tem shampoo?"), o `enforceFamilyBaseFirst`
// não deve forçar agregação por família-base e esconder kits — ele deve
// devolver o pool natural, mantendo "base antes de kit" apenas dentro
// de cada família individualmente.
//
// Esta função é PURA e determinística. Devolve dois sinais:
//  - directKitQuestion: cliente perguntou diretamente sobre kit/combo.
//  - directFamilyQuestion: cliente perguntou diretamente sobre uma família
//    sem outro contexto de objetivo/dor.
// ============================================================

const RE_KIT_DIRECT =
  /\b(qual|quais|tem|tem[\s-]?al(?:gum|guma)|me mostr|me indica|quero|preciso|melhor|mais (?:completo|barato|caro))\b[^?]{0,40}\b(kit|combo|conjunto|pacote)\b/i;

const RE_KIT_BARE =
  /^\s*(kit|combo|conjunto)s?\s*\??\s*$/i;

const FAMILY_DIRECT_TOKENS = [
  /\b(shampoo|sham\s*p[oô]o)\b/i,
  /\bbalm\b/i,
  /\blo[cç][aã]o\b/i,
  /\bcondicionador\b/i,
  /\bm[aá]scara\b/i,
  /\bcreme\b/i,
  /\bs[ée]rum\b/i,
  /\b[oó]leo\b/i,
];

const RE_DIRECT_FAMILY_QUESTION =
  /\b(tem|t[eé]m|voc[eê]s\s+t[eê]m|qual|quais|me\s+mostra|me\s+indica)\b/i;

export interface DirectCatalogQuestionInput {
  consolidatedText: string;
  intentBucket: string | null | undefined;
  declaredPain: string | null | undefined;
}

export interface DirectCatalogQuestionResult {
  directKitQuestion: boolean;
  directFamilyQuestion: boolean;
  reason: string;
}

export function detectDirectCatalogQuestion(
  input: DirectCatalogQuestionInput,
): DirectCatalogQuestionResult {
  const text = String(input.consolidatedText || "").trim();
  if (!text) {
    return { directKitQuestion: false, directFamilyQuestion: false, reason: "empty_text" };
  }

  // Se há dor declarada, não é pergunta direta de catálogo — é necessidade.
  if (input.declaredPain && String(input.declaredPain).trim()) {
    return { directKitQuestion: false, directFamilyQuestion: false, reason: "has_declared_pain" };
  }

  // Detecção de pergunta direta sobre KIT.
  const isKitBare = RE_KIT_BARE.test(text);
  const isKitDirect = RE_KIT_DIRECT.test(text);
  const directKit = isKitBare || isKitDirect;

  // Detecção de pergunta direta sobre FAMÍLIA sem objetivo.
  const hasInterrogative = RE_DIRECT_FAMILY_QUESTION.test(text);
  const familyHits = FAMILY_DIRECT_TOKENS.filter((re) => re.test(text)).length;
  const directFamily =
    !directKit &&
    hasInterrogative &&
    familyHits > 0 &&
    // Heurística: turno curto (até ~10 palavras) confirma pergunta direta sem narrativa.
    text.split(/\s+/).filter(Boolean).length <= 10;

  if (directKit) {
    return {
      directKitQuestion: true,
      directFamilyQuestion: false,
      reason: isKitBare ? "kit_bare" : "kit_question_direct",
    };
  }
  if (directFamily) {
    return {
      directKitQuestion: false,
      directFamilyQuestion: true,
      reason: "direct_family_question_short_turn",
    };
  }
  return { directKitQuestion: false, directFamilyQuestion: false, reason: "no_direct_signal" };
}
