// ============================================================
// Fase C — Turn Completeness Detector (Reg #2.13)
// Determinístico, sem LLM, <5ms.
// Context-aware: avalia o TURNO AGREGADO (não a mensagem isolada),
// considerando produto/família em foco quando disponível.
// ============================================================

export type TurnCompleteness =
  | "complete_actionable"      // 0ms
  | "short_but_understandable" // 1500-2500ms
  | "incomplete_or_fragmented"; // 5000ms

export interface BufferedMessage {
  id: string;
  text: string | null;
  media_type?: string | null;        // "image" | "audio" | "video" | "document" | null
  media_caption?: string | null;
  created_at: string;
}

export interface CompletenessContext {
  productFocus?: string | null;
  familyFocus?: string | null;
  hasOpenCart?: boolean;
  hasActiveOffer?: boolean;
  conversationStage?: string | null; // greeting | discovery | recommendation | product_detail | decision | checkout_assist
  hasVisionTool?: boolean;
  /**
   * [Onda 5 — Reg #2.18] Tokens de dor/objetivo declarados pelo tenant
   * (derivados de Visão da IA + descrição da categoria + dicionário do
   * negócio). Quando fornecido, complementa o regex cosmético legado para
   * tornar a detecção de "actionable" segment-agnostic. Manter o legado
   * preserva o comportamento atual no Respeite o Homem mesmo se vier vazio.
   */
  tenantPainTokens?: string[];
}

export interface CompletenessResult {
  completeness: TurnCompleteness;
  debounceMs: number;
  reason: string;
  aggregatedText: string;
  hasMediaWithoutCaption: boolean;
}

// Saudações isoladas
const GREETING_ONLY = /^\s*(oi+|ol[áa]|opa|e[ai]|bom\s*dia|boa\s*tarde|boa\s*noite|tudo\s*bem|hey|hello|hi)[\s!.?]*$/i;

// Termos soltos sem verbo (sintoma/dor sem pergunta)
const LOOSE_TERM = /^\s*[a-záéíóúâêôãõç]{3,20}\s*[!.]?\s*$/i;

// Frases suspensas (terminam em conjunção/etc.)
const SUSPENDED = /(\.{2,}|\b(e|mas|então|tipo|ou seja|porque|aí|assim)\s*[!.?]?\s*$)/i;

// Declarativas curtas sem pergunta
const VAGUE_INTENT = /^\s*(tenho\s+uma?\s+d[úu]vida|me\s+ajuda|preciso\s+de\s+ajuda|queria\s+saber)\s*[!.?]*\s*$/i;

// Imperativos / pedidos diretos (geralmente actionable se houver contexto)
const DIRECT_REQUEST = /\b(me\s+manda|pode\s+mandar|envia|manda\s+o\s+link|quero\s+comprar|finalizar|fechar\s+pedido|me\s+passa\s+o\s+link)\b/i;

// Perguntas com palavra-chave forte
const STRONG_Q_PRICE = /\b(quanto\s+custa|qual\s+(o\s+)?pre[çc]o|valor)\b.*\?/i;
const STRONG_Q_SHIPPING = /\b(frete|entrega|prazo|chega\s+em\s+quanto)\b.*\?/i;
const STRONG_Q_RECOMMEND = /\b(qual\s+(você\s+)?(recomend|me\s+indica|serve|melhor)|o\s+que\s+(você\s+)?(indica|recomend))\b/i;
// Referência anafórica universal (sem vocabulário fixo de família).
const STRONG_Q_PRODUCT_REF = /\b(tem\s+(esse|esta|este|isso|aquele|aquela)|essa?\s+(produto|item|kit|combo|op[çc][aã]o)|isso\s+a[íi])\b.*\?/i;

// Pergunta clara explícita sobre família/produto: "tem <substantivo> (pra|para|de|contra) ...".
// Universal — a classificação real da família vem do classifier do tenant a jusante.
const Q_ABOUT_PRODUCT_FAMILY = /\btem\s+(algum\s+|alguma\s+|um\s+|uma\s+)?[a-zà-ú]{3,20}\s+(pra|para|de|contra)\b/i;

// Caption ambíguo (3-15 chars sem verbo)
function isAmbiguousCaption(caption: string | null | undefined): boolean {
  if (!caption) return false;
  const t = caption.trim();
  if (t.length === 0) return true;
  if (t.length < 4) return true;
  if (LOOSE_TERM.test(t) && !/\?/.test(t)) return true;
  return false;
}

function buildAggregatedText(messages: BufferedMessage[]): string {
  return messages
    .map((m) => {
      const txt = (m.text ?? "").trim();
      const cap = (m.media_caption ?? "").trim();
      if (m.media_type) {
        const mediaTag = `[mídia: ${m.media_type}${cap ? ` legenda: ${cap}` : " sem legenda"}]`;
        return txt ? `${mediaTag} ${txt}` : mediaTag;
      }
      return txt;
    })
    .filter(Boolean)
    .join(" | ");
}

/**
 * Classifica o TURNO AGREGADO (todas as mensagens do buffer).
 * Recalculado a cada nova mensagem.
 */
export function classifyTurnCompleteness(
  messages: BufferedMessage[],
  ctx: CompletenessContext = {},
): CompletenessResult {
  const aggregatedText = buildAggregatedText(messages);
  const hasContext = !!(ctx.productFocus || ctx.familyFocus || ctx.hasOpenCart || ctx.hasActiveOffer);

  // Mídia sem legenda em alguma das mensagens, sem vision tool
  const mediaNoCaption = messages.some(
    (m) => m.media_type && !(m.media_caption?.trim() || m.text?.trim()),
  );
  const mediaAmbiguous = messages.some(
    (m) => m.media_type && isAmbiguousCaption(m.media_caption ?? m.text ?? ""),
  );

  // Última mensagem é a "ponta" do turno; classificação semântica usa ela + agregado
  const last = messages[messages.length - 1];
  const lastText = ((last?.text ?? "") + " " + (last?.media_caption ?? "")).trim();

  // ---- Mídia sem legenda → incompleto, espera complemento (5s) ----
  if (mediaNoCaption && !ctx.hasVisionTool) {
    return {
      completeness: "incomplete_or_fragmented",
      debounceMs: 5000,
      reason: "media_without_caption",
      aggregatedText,
      hasMediaWithoutCaption: true,
    };
  }

  if (mediaAmbiguous && !ctx.hasVisionTool) {
    return {
      completeness: "short_but_understandable",
      debounceMs: 3000,
      reason: "media_ambiguous_caption",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  // ---- Saudação isolada (sem outras mensagens com conteúdo real) ----
  const realContentMsgs = messages.filter((m) => {
    const t = ((m.text ?? "") + " " + (m.media_caption ?? "")).trim();
    return t && !GREETING_ONLY.test(t);
  });

  if (realContentMsgs.length === 0) {
    // Só saudações
    return {
      completeness: "incomplete_or_fragmented",
      debounceMs: 5000,
      reason: "greeting_only",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  // ---- Avaliação no AGREGADO (saudação + pergunta clara = completa) ----
  const aggLower = aggregatedText.toLowerCase();

  // Sinais fortes de actionable
  const isPriceQ = STRONG_Q_PRICE.test(aggLower);
  const isShippingQ = STRONG_Q_SHIPPING.test(aggLower);
  const isRecommendQ = STRONG_Q_RECOMMEND.test(aggLower);
  const isProductRefQ = STRONG_Q_PRODUCT_REF.test(aggLower);
  const isProductFamilyQ = Q_ABOUT_PRODUCT_FAMILY.test(aggLower);
  const isDirectRequest = DIRECT_REQUEST.test(aggLower);

  // Preço/frete só são complete_actionable COM contexto (produto/família/oferta em foco)
  if ((isPriceQ || isShippingQ || isProductRefQ) && hasContext) {
    return {
      completeness: "complete_actionable",
      debounceMs: 0,
      reason: "context_aware_actionable",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  // [Onda 5 — Reg #2.18] Construtor universal de regex de dor: mescla regex
  // legado (mantido para paridade com Respeite o Homem) com tokens de dor
  // declarados pelo tenant via Resolver. Sem flag — adicionar tokens é
  // sempre seguro (ampliam, não substituem).
  const LEGACY_PAIN_RE = /\b(entradas?|calv|queda|cresc|caspa|seborr|oleos|ressec|fios?|cabel)/i;
  const tenantTokens = (ctx.tenantPainTokens || [])
    .map((t) => (t || "").trim().toLowerCase())
    .filter((t) => t.length >= 3);
  const tenantPainRe = tenantTokens.length
    ? new RegExp(`\\b(${tenantTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "i")
    : null;
  const matchesPain = (txt: string) => LEGACY_PAIN_RE.test(txt) || (tenantPainRe ? tenantPainRe.test(txt) : false);

  // Recomendação contextualizada (com sintoma OU foco) é actionable
  if (isRecommendQ && (hasContext || matchesPain(aggLower))) {
    return {
      completeness: "complete_actionable",
      debounceMs: 0,
      reason: "recommend_with_symptom_or_focus",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  // Pedido direto + contexto/intenção clara
  if (isDirectRequest && (hasContext || /\b(comprar|pedido|fechar|checkout|carrinho)/i.test(aggLower))) {
    return {
      completeness: "complete_actionable",
      debounceMs: 0,
      reason: "direct_request_with_context",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  // Pergunta sobre família com sintoma já é actionable mesmo sem foco prévio
  if (isProductFamilyQ && /\b(pra|para|de|contra)\b/i.test(aggLower) && matchesPain(aggLower)) {
    return {
      completeness: "complete_actionable",
      debounceMs: 0,
      reason: "product_family_with_symptom",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  // Preço/frete SEM contexto → short (espera o cliente especificar)
  if (isPriceQ || isShippingQ || isProductRefQ) {
    return {
      completeness: "short_but_understandable",
      debounceMs: 2000,
      reason: "price_or_shipping_without_context",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  // ---- Fragmentos: termo solto, frase suspensa, intenção vaga ----
  for (const m of realContentMsgs) {
    const t = ((m.text ?? "") + " " + (m.media_caption ?? "")).trim();
    if (VAGUE_INTENT.test(t) || SUSPENDED.test(t)) {
      // Se o agregado tem outras mensagens com conteúdo real, pode estar perto de fechar
      if (realContentMsgs.length >= 2) {
        return {
          completeness: "short_but_understandable",
          debounceMs: 2000,
          reason: "fragment_but_aggregated_has_more",
          aggregatedText,
          hasMediaWithoutCaption: false,
        };
      }
      return {
        completeness: "incomplete_or_fragmented",
        debounceMs: 5000,
        reason: "vague_intent_or_suspended",
        aggregatedText,
        hasMediaWithoutCaption: false,
      };
    }
  }

  // Termos soltos isolados (1 palavra única sem verbo, sem ?)
  if (
    realContentMsgs.length === 1 &&
    LOOSE_TERM.test(realContentMsgs[0].text ?? "") &&
    !/\?/.test(realContentMsgs[0].text ?? "")
  ) {
    return {
      completeness: "incomplete_or_fragmented",
      debounceMs: 5000,
      reason: "single_loose_term",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  // ---- Pergunta curta com produto/atributo (entre 2-6 palavras com '?') ----
  const lastWordCount = lastText.split(/\s+/).filter(Boolean).length;
  if (/\?/.test(lastText) && lastWordCount <= 6) {
    return {
      completeness: "short_but_understandable",
      debounceMs: 1800,
      reason: "short_question",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  // ---- Default: frase declarativa razoável → short ----
  if (lastWordCount >= 3) {
    return {
      completeness: "short_but_understandable",
      debounceMs: 1500,
      reason: "default_short",
      aggregatedText,
      hasMediaWithoutCaption: false,
    };
  }

  return {
    completeness: "incomplete_or_fragmented",
    debounceMs: 5000,
    reason: "default_incomplete",
    aggregatedText,
    hasMediaWithoutCaption: false,
  };
}

/** Tools que ALTERAM estado e exigem freshness check antes de executar */
export const SIDE_EFFECT_TOOLS = new Set<string>([
  "add_to_cart",
  "remove_from_cart",
  "update_cart_item",
  "apply_coupon",
  "remove_coupon",
  "generate_checkout_link",
  "create_checkout_link",
  "request_human_handoff",
  "transfer_to_human",
  "create_order",
  "send_payment_link",
]);

export function isSideEffectTool(name: string): boolean {
  return SIDE_EFFECT_TOOLS.has(name);
}
