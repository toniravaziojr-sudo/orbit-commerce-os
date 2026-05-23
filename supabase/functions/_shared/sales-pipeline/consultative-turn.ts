// ============================================================
// Pipeline F2 — Consultative Turn Detector (Bloco 3.6)
//
// Detecta TURNO CONSULTIVO: cliente descreveu sintoma/caso pessoal
// E (idealmente) pediu recomendação personalizada — possivelmente
// com foto. Esse tipo de turno EXIGE acolhida + 1 pergunta breve
// de qualificação ANTES de listar produto.
//
// Sintoma observado no Reg. #2:
//   Cliente: "boa tarde, tenho calvície na coroa há 2 anos, qual
//             tratamento mais indicado pra mim?" (+ foto)
//   IA: pulou direto pra listagem de 2 shampoos.
//   Esperado: "Boa tarde! Entendi seu caso. Pra recomendar o
//   tratamento certo, posso te perguntar [1 coisa]?".
//
// Sinais combinados (qualquer 2 dos 3 = consultivo):
//   - tem descrição de sintoma/dor pessoal ("tenho", "estou com",
//     "sofro com", "minha", "meu")
//   - tem solicitação de RECOMENDAÇÃO ("qual indicado pra mim?",
//     "o que vocês recomendam?", "qual melhor?")
//   - tem mídia anexada (foto/imagem)
//
// Saída: bloco de prompt a ser injetado em discovery/recommendation
// instruindo a IA a ACOLHER + perguntar 1 coisa antes de listar.
// ============================================================

export interface ConsultativeTurnSignals {
  hasSymptomDescription: boolean;
  hasRecommendationRequest: boolean;
  hasMediaAttachment: boolean;
  matchCount: number;
  isConsultative: boolean;
}

/**
 * Wrapper de compatibilidade. Delega ao detector universal sem vocabulário
 * fixo de cosmético. Caller pode preferir chamar detectConsultativeTurnUniversal
 * diretamente quando tiver tokens de dor do tenant ou sinais do TPR.
 */
export function detectConsultativeTurn(input: {
  customerMessage: string;
  hasMediaAttachment?: boolean;
}): ConsultativeTurnSignals {
  return detectConsultativeTurnUniversal({
    customerMessage: input.customerMessage,
    hasMediaAttachment: input.hasMediaAttachment,
  });
}

// ============================================================
// Onda 4 (Reg #2.18) — Detector universal (segment-agnostic)
//
// Quando o TPR (Reg #2.8) está disponível e classificou o turno via LLM,
// usamos seus sinais como fonte de verdade. Caso contrário, caímos numa
// versão dinâmica do detector que combina:
//   - cues universais de "caso pessoal" ("tenho", "estou com", "faz X tempo")
//   - tokens de dor declarados pelo tenant (painPoints do Resolver da Onda 1)
//   - padrões universais de pedido de recomendação
// Sem regex fixa de cabelo/calvície/queda/caspa.
// ============================================================

const UNIVERSAL_SYMPTOM_CUES = /\b(tenho|estou\s+com|t[ôo]\s+com|sofro\s+com|minha|meu|faz\s+\d+\s+(anos?|meses?|dias?)|h[áa]\s+\d+\s+(anos?|meses?))/i;

const UNIVERSAL_RECOMMENDATION_REQUEST = [
  /\b(qual|que)\s+([\w\sçãõéáíóúâêô]{0,30})?(mais\s+)?(indicado|recomendado|melhor)\s+(pra|para)\s+(mim|o\s+meu\s+caso|isso)/i,
  /\bo\s+que\s+(voc[êe]s?\s+)?(recomenda(m)?|indica(m)?|sugere(m)?)\s+(pra|para)\s+(mim|o\s+meu\s+caso|isso)?/i,
  /\b(pode|poderia)\s+(me\s+)?(indicar|recomendar|sugerir)/i,
  /\bme\s+ajuda(m)?\s+a\s+(escolher|decidir)/i,
];

export interface ConsultativeTurnUniversalInput {
  customerMessage: string;
  hasMediaAttachment?: boolean;
  /** Tokens de dor declarados pelo tenant (do Resolver de vocabulário). */
  tenantPainTokens?: string[];
  /** Quando true, prefere os sinais de TPR aos detectores regex. */
  tpr?: {
    source: "llm" | "fallback";
    described_symptom: boolean;
    requested_recommendation: boolean;
    is_consultative_turn: boolean;
  } | null;
}

export function detectConsultativeTurnUniversal(
  input: ConsultativeTurnUniversalInput,
): ConsultativeTurnSignals {
  const text = input.customerMessage || "";
  const hasMediaAttachment = !!input.hasMediaAttachment;

  // 1) Caminho preferido: TPR via LLM (Reg #2.8). Source-of-truth única.
  if (input.tpr && input.tpr.source === "llm") {
    const matchCount =
      (input.tpr.described_symptom ? 1 : 0) +
      (input.tpr.requested_recommendation ? 1 : 0) +
      (hasMediaAttachment ? 1 : 0);
    return {
      hasSymptomDescription: input.tpr.described_symptom,
      hasRecommendationRequest: input.tpr.requested_recommendation,
      hasMediaAttachment,
      matchCount,
      isConsultative: input.tpr.is_consultative_turn || matchCount >= 2,
    };
  }

  // 2) Fallback dinâmico universal: cues "caso pessoal" + tokens de dor do tenant.
  const tenantTokens = (input.tenantPainTokens || []).filter((t) => t && t.length >= 3);
  const tenantPainRegex = tenantTokens.length
    ? new RegExp(`\\b(${tenantTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i")
    : null;

  const personalCue = UNIVERSAL_SYMPTOM_CUES.test(text);
  const tenantPainHit = tenantPainRegex ? tenantPainRegex.test(text) : false;
  // Sintoma = cue pessoal junto com algum token de dor (do tenant) OU
  // cue pessoal isolado já é forte o suficiente como sinal consultivo.
  const hasSymptomDescription = personalCue || tenantPainHit;

  const hasRecommendationRequest = UNIVERSAL_RECOMMENDATION_REQUEST.some((re) => re.test(text));

  const matchCount =
    (hasSymptomDescription ? 1 : 0) +
    (hasRecommendationRequest ? 1 : 0) +
    (hasMediaAttachment ? 1 : 0);

  return {
    hasSymptomDescription,
    hasRecommendationRequest,
    hasMediaAttachment,
    matchCount,
    isConsultative: matchCount >= 2,
  };

/**
 * Bloco de contexto a ser injetado no prompt quando detectamos
 * turno consultivo. Vai DEPOIS dos blocos de estado, então tem
 * precedência sobre "vai recomendar produto agora".
 */
export function buildConsultativeTurnBlock(signals: ConsultativeTurnSignals): string | null {
  if (!signals.isConsultative) return null;

  const parts: string[] = [];
  if (signals.hasSymptomDescription) parts.push("descrição do caso/sintoma");
  if (signals.hasRecommendationRequest) parts.push("pedido de recomendação personalizada");
  if (signals.hasMediaAttachment) parts.push("foto anexada");

  return [
    "### TURNO CONSULTIVO DETECTADO (REGRA DE COMPORTAMENTO)",
    `O cliente trouxe ${parts.join(" + ")}. Esse é um turno de CONSULTORIA, não de catálogo.`,
    "",
    "FORMATO OBRIGATÓRIO desta resposta, em 1 mensagem curta, NESTA ORDEM:",
    "  1) ACOLHIDA em 1 linha — espelhe o que ele trouxe (ex.: \"Entendi seu caso\",",
    "     \"Recebi sua foto, dá pra ter uma ideia\", \"Esse cenário dá pra resolver\").",
    "  2) UMA pergunta curta de qualificação (escolha A ou B):",
    "     A) qual o objetivo principal: tratar / prevenir / repor",
    "     B) há quanto tempo ele percebe / se já usou algo antes",
    "     Escolha SÓ A OU B — nunca as duas. Pergunta única, frase curta.",
    "  3) Termine deixando claro que vai recomendar logo em seguida",
    "     (ex.: \"Com isso eu já te indico o caminho certo.\").",
    "",
    "É PROIBIDO neste turno:",
    "- Listar 2 ou 3 produtos sem antes acolher.",
    "- Citar preço, R$, frete ou desconto.",
    "- Mandar imagem de produto.",
    "- Pedir nome, email, CPF, CEP ou outro dado pessoal.",
    "- Usar \"Como posso te ajudar?\" ou variantes corporativas.",
    "",
    "Na PRÓXIMA mensagem (depois da resposta do cliente), aí sim você",
    "chama search_products com pain_hint e apresenta a recomendação.",
  ].join("\n");
}
