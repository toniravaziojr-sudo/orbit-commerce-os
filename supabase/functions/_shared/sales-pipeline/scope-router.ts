// ============================================================
// Pipeline F2 — Frente 2 — Scope Router (11 intent buckets)
//
// Consolida o turno do cliente em UMA das 11 categorias de
// intenção que a pipeline reconhece como escopo. Frentes 3, 4 e 5
// vão ler `bucket` para decidir resposta institucional, defesa
// comercial e gate de continuidade — sem mais "muleta de
// descoberta" universal.
//
// Comportamento:
// - Se o TPR (LLM) já devolveu `intent_bucket`, usamos como fonte
//   primária (com normalização defensiva).
// - Caso o TPR não tenha devolvido (fallback regex, modelo antigo
//   sem o campo, JSON parcial), derivamos do conjunto de flags +
//   regex sobre a mensagem (camada determinística).
// - Sempre devolvemos um bucket válido. NUNCA null.
//
// Aditivo: nenhum efeito colateral. Frentes 3-5 consomem.
// ============================================================

import type { TurnClassification } from "./turn-pre-router.ts";

export type IntentBucket =
  | "social"            // saudação pura, small talk, "tudo bem?"
  | "product_question"  // pergunta sobre produto/família (uso, ingrediente, modo de aplicar)
  | "catalog_question"  // pergunta aberta de catálogo ("o que vocês têm?", "tem isso?")
  | "commercial_policy" // preço, frete, prazo, cupom, parcelamento, forma de pagamento
  | "institutional"     // loja física, horário, garantia, troca, devolução, segurança, sobre a marca
  | "post_sale"         // pedido em andamento, rastreio, defeito, atraso, NF
  | "objection"         // resistência ("caro", "não funciona pra mim", "tenho medo")
  | "hesitation"        // adiamento ("vou pensar", "depois eu vejo", "talvez")
  | "human_request"     // pedido explícito por humano/atendente
  | "out_of_scope"      // assunto fora do negócio (piada, política, etc.)
  | "open_discovery";   // sintoma/objetivo declarado SEM produto/família — único caso de descoberta consultiva

const VALID_BUCKETS: ReadonlySet<IntentBucket> = new Set([
  "social",
  "product_question",
  "catalog_question",
  "commercial_policy",
  "institutional",
  "post_sale",
  "objection",
  "hesitation",
  "human_request",
  "out_of_scope",
  "open_discovery",
]);

function normalizeBucket(value: unknown): IntentBucket | null {
  if (typeof value !== "string") return null;
  const v = value.trim().toLowerCase();
  return VALID_BUCKETS.has(v as IntentBucket) ? (v as IntentBucket) : null;
}

// ---------- Detectores determinísticos (usados quando TPR não classificou) ----------

const RE_HUMAN = /\b(falar\s+com\s+(humano|atendente|pessoa)|chama(r)?\s+(um|uma)?\s*(humano|atendente)|quero\s+(um|uma)?\s*atendente|n[ãa]o\s+(é|eh)\s+rob[ôo]|sair\s+do\s+rob[ôo])\b/i;

const RE_INSTITUTIONAL = /\b(loja\s+f[íi]sica|endere[çc]o|hor[áa]rio|aberto|fechado|funciona\s+(s[áa]bado|domingo|feriado)|garantia|troca|devolu[çc][ãa]o|reembolso|pol[íi]tica\s+(de\s+)?(troca|devolu[çc][ãa]o|privacidade)|seguran[çc]a|sobre\s+a\s+(loja|marca|empresa)|cnpj|raz[ãa]o\s+social)\b/i;

const RE_POST_SALE = /\b(meu\s+pedido|onde\s+est[áa]\s+(meu\s+)?pedido|c[óo]digo\s+de\s+rastreio|rastrear|c[óo]d(igo)?\s+de\s+postagem|n[ãa]o\s+chegou|atrasad[oa]|chegou\s+errado|veio\s+errado|veio\s+quebrad[oa]|defeito|com\s+defeito|problema\s+no\s+(produto|pedido)|nota\s+fiscal|nfe?\b|estornar|cancelar\s+pedido)\b/i;

const RE_COMMERCIAL_POLICY = /\b(quanto\s+custa|qual\s+(o\s+)?valor|qual\s+(o\s+)?pre[çc]o|frete|prazo\s+de\s+entrega|chega\s+em|cupom|desconto|parcelamento|parcelar|forma\s+de\s+pagamento|formas\s+de\s+pagamento|aceita\s+(pix|boleto|cart[ãa]o)|pix|boleto|cart[ãa]o)\b/i;

const RE_OBJECTION = /\b(t[áa]\s+caro|muito\s+caro|caro\s+demais|n[ãa]o\s+tenho\s+(esse|tanto)\s+dinheiro|n[ãa]o\s+vai\s+funcionar|n[ãa]o\s+acredito|tenho\s+medo|j[áa]\s+tentei\s+de\s+tudo|nada\s+funciona|n[ãa]o\s+confio|e\s+se\s+n[ãa]o\s+der\s+certo)\b/i;

const RE_HESITATION = /\b(vou\s+pensar|depois\s+eu\s+vejo|deixa\s+eu\s+pensar|talvez|quem\s+sabe|mais\s+pra\s+frente|outro\s+dia|n[ãa]o\s+(é|eh)\s+agora|por\s+enquanto\s+n[ãa]o)\b/i;

const RE_OUT_OF_SCOPE = /\b(piada|futebol|pol[íi]tica|presidente|namorad[ao]|que\s+horas\s+s[ãa]o|tempo\s+(hoje|amanh[ãa])|previs[ãa]o\s+do\s+tempo)\b/i;

const RE_CATALOG_OPEN = /\b(o\s+que\s+voc[êe]s?\s+(tem|t[êe]m|vendem)|quais\s+(produtos|itens)|tem\s+(algum|uma|um)\b|me\s+mostra\s+o\s+cat[áa]logo|lista\s+de\s+produtos)\b/i;

// ---------- Função principal ----------

export interface ScopeRouterInput {
  classification: TurnClassification;
  message: string;
  // Caso futuro: hasCart, hasOpenOrder, etc. — Frentes posteriores podem
  // refinar (ex.: pos_venda só faz sentido com pedido aberto).
}

export interface ScopeRouterResult {
  bucket: IntentBucket;
  source: "tpr" | "deterministic";
  // Confiança qualitativa — usada apenas em log/debug.
  confidence: "high" | "medium" | "low";
  reason: string;
}

export function routeScope(input: ScopeRouterInput): ScopeRouterResult {
  const { classification: tpr, message } = input;
  const text = (message || "").trim();

  // 1) Se o TPR já devolveu intent_bucket válido (Frente 2 — schema novo), usar.
  const fromTpr = normalizeBucket((tpr as any).intent_bucket);
  if (fromTpr && tpr.source === "llm") {
    return {
      bucket: fromTpr,
      source: "tpr",
      confidence: "high",
      reason: "tpr_llm_classified",
    };
  }

  // 2) Derivação determinística a partir das flags do TPR + regex sobre a mensagem.
  //    Ordem importa: humano > pós-venda > institucional > política comercial >
  //    objeção/hesitação > fora de escopo > pergunta de produto > pergunta de
  //    catálogo > social > descoberta aberta.

  if (RE_HUMAN.test(text)) {
    return { bucket: "human_request", source: "deterministic", confidence: "high", reason: "regex_human" };
  }

  if (tpr.is_support_topic || RE_POST_SALE.test(text)) {
    return { bucket: "post_sale", source: "deterministic", confidence: "high", reason: "tpr_support_or_regex_post_sale" };
  }

  if (RE_INSTITUTIONAL.test(text)) {
    return { bucket: "institutional", source: "deterministic", confidence: "high", reason: "regex_institutional" };
  }

  if (
    tpr.asked_about_price ||
    tpr.asked_about_shipping ||
    tpr.asked_about_payment_or_link ||
    RE_COMMERCIAL_POLICY.test(text)
  ) {
    return { bucket: "commercial_policy", source: "deterministic", confidence: "high", reason: "tpr_price_shipping_or_regex_policy" };
  }

  if (RE_OBJECTION.test(text)) {
    return { bucket: "objection", source: "deterministic", confidence: "medium", reason: "regex_objection" };
  }

  if (RE_HESITATION.test(text)) {
    return { bucket: "hesitation", source: "deterministic", confidence: "medium", reason: "regex_hesitation" };
  }

  if (RE_OUT_OF_SCOPE.test(text) && !tpr.described_symptom && !tpr.mentioned_product_family && !tpr.mentioned_product_name) {
    return { bucket: "out_of_scope", source: "deterministic", confidence: "medium", reason: "regex_out_of_scope" };
  }

  // Pergunta sobre produto/família específico
  if (tpr.mentioned_product_name || tpr.mentioned_product_family) {
    return { bucket: "product_question", source: "deterministic", confidence: "medium", reason: "tpr_product_or_family" };
  }

  // Pergunta de catálogo aberta
  if (RE_CATALOG_OPEN.test(text)) {
    return { bucket: "catalog_question", source: "deterministic", confidence: "medium", reason: "regex_catalog_open" };
  }

  // Saudação pura / social
  if (tpr.is_pure_greeting || tpr.asked_how_are_you) {
    return { bucket: "social", source: "deterministic", confidence: "high", reason: "tpr_pure_greeting" };
  }

  // Sintoma/objetivo sem produto/família → único caso legítimo de descoberta consultiva
  if (tpr.described_symptom || tpr.requested_recommendation || tpr.is_consultative_turn) {
    return { bucket: "open_discovery", source: "deterministic", confidence: "high", reason: "tpr_symptom_or_recommendation" };
  }

  // Fallback final — mensagem curta sem sinais. Trata como social (não como
  // descoberta) para evitar muleta. Frentes 3-5 cuidam do roteiro.
  return { bucket: "social", source: "deterministic", confidence: "low", reason: "no_signal_default_social" };
}

export function isSalesBucket(bucket: IntentBucket): boolean {
  return (
    bucket === "product_question" ||
    bucket === "catalog_question" ||
    bucket === "commercial_policy" ||
    bucket === "open_discovery"
  );
}
