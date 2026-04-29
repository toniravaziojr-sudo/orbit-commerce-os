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

const SYMPTOM_PATTERNS = [
  /\btenho\s+(calv[íi]cie|queda|caspa|seborr[eé]ia|oleosidade|cabelo\s+(seco|fino|ralo|oleoso))/i,
  /\bestou\s+com\s+(queda|calv[íi]cie|caspa|cabelo\s+(seco|oleoso|caindo))/i,
  /\bsofro\s+com\s+(queda|calv[íi]cie|caspa|cabelo)/i,
  /\b(minha|meu)\s+(cabelo|couro|coroa|barba|pele)\b[^.?!]{0,60}(cai|caindo|ralo|fino|oleoso|seco|com\s+caspa|fal(ha|hando))/i,
  /\b(faz|h[áa])\s+\d+\s+(anos?|meses)\s+(que|com)\b/i,
  /\b(coroa|entradas)\s+(rala|aberta|falha|ralinha|come[çc]ando\s+a)/i,
];

const RECOMMENDATION_REQUEST_PATTERNS = [
  /\bqual\s+(o\s+)?(tratamento|produto|shampoo|loca[cç][aã]o|combo)\s+(mais\s+)?(indicado|recomendado|melhor)\s+(pra|para)\s+(mim|o\s+meu\s+caso)/i,
  /\bo\s+que\s+(voc[êe]s?\s+)?(recomenda(m)?|indica(m)?|sugere(m)?)\s+(pra|para)\s+(mim|o\s+meu\s+caso)/i,
  /\bqual\s+(o\s+)?(melhor|mais\s+(indicado|recomendado))\s+(pro|para\s+o)\s+meu\s+caso/i,
  /\bme\s+ajuda(m)?\s+a\s+(escolher|decidir)/i,
  /\b(pode|poderia)\s+(me\s+)?(indicar|recomendar|sugerir)/i,
];

export interface ConsultativeTurnSignals {
  hasSymptomDescription: boolean;
  hasRecommendationRequest: boolean;
  hasMediaAttachment: boolean;
  matchCount: number;
  isConsultative: boolean;
}

export function detectConsultativeTurn(input: {
  customerMessage: string;
  hasMediaAttachment?: boolean;
}): ConsultativeTurnSignals {
  const text = input.customerMessage || "";
  const hasMediaAttachment = !!input.hasMediaAttachment;

  const hasSymptomDescription = SYMPTOM_PATTERNS.some((re) => re.test(text));
  const hasRecommendationRequest = RECOMMENDATION_REQUEST_PATTERNS.some((re) => re.test(text));
  const matchCount =
    (hasSymptomDescription ? 1 : 0) +
    (hasRecommendationRequest ? 1 : 0) +
    (hasMediaAttachment ? 1 : 0);

  // 2 dos 3 sinais = consultivo
  const isConsultative = matchCount >= 2;

  return {
    hasSymptomDescription,
    hasRecommendationRequest,
    hasMediaAttachment,
    matchCount,
    isConsultative,
  };
}

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
    "     \"Recebi sua foto, dá pra ter uma ideia\", \"Esse tipo de queda dá pra tratar bem\").",
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
