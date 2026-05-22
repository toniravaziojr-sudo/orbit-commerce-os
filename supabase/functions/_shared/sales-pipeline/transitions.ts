// ============================================================
// Pipeline Básica IA — F2
// Regras de transição entre estados comerciais.
//
// Princípios (aprovados):
// 1. Última mensagem do cliente é prioridade máxima.
// 2. Saudação não vira venda direta.
// 3. Discovery limitado a 2 turnos consecutivos.
// 4. Cliente citou produto pelo nome → product_detail (mesmo vindo de greeting).
// 5. Sinal claro de compra → decision (sem requalificar).
// 6. Cliente em decision/checkout NÃO regride para discovery sem sinal explícito.
// 7. Mudança de assunto → seguir a última mensagem.
// 8. Pedido existente / pós-venda → support (fora do funil).
// ============================================================

import { STATE_RANK, type PipelineState } from "./states.ts";

export type TransitionReason =
  | "first_contact_pure_greeting"
  | "greeting_to_discovery_question"
  | "product_mentioned_by_name"
  | "informational_product_question_downgrade_to_product_detail"
  | "informational_product_question_downgrade_to_recommendation"
  | "buy_signal_detected"
  | "explicit_checkout_request"
  | "cart_active_or_added"
  | "checkout_link_generated"
  | "support_topic_detected"
  | "handoff_requested"
  | "discovery_limit_reached_advance_to_recommendation"
  | "pain_or_objective_declared_advance_to_recommendation"
  | "tool_advanced_state"
  | "no_change_keep_state"
  | "regression_blocked"
  // [F2-V2] Razões de referência por foco e intenção comparativa
  | "reference_resolved_by_focus_to_product_detail"
  | "compare_intent_with_focus"
  // [F2-V3] Rebaixamento estrutural por intenção do turno atual
  | "downgrade_pure_greeting_resets_state"
  | "downgrade_informative_question_to_product_detail"
  | "downgrade_informative_question_to_recommendation"
  | "downgrade_informative_question_to_discovery"
  | "downgrade_comparison_to_product_detail_with_focus"
  | "downgrade_comparison_to_recommendation_no_focus"
  | "data_provided_kept_checkout_with_active_cart"
  | "data_provided_ignored_no_active_cart"
  // [F2-V4] Recovery downgrade: conversa presa em product_detail sem foco real
  // de produto, e cliente pergunta algo genérico de família/objetivo OU desafia
  // a variedade do catálogo ("só tem essa?", "tem outras?").
  | "recovery_downgrade_product_detail_to_recommendation_family_question"
  | "recovery_downgrade_product_detail_to_recommendation_variety_challenge"
  | "variety_challenge_with_family_focus_to_recommendation"
  // [Eixo 1.8] Bloqueio: checkout_assist exige cart_id ativo
  | "no_cart_for_checkout";

// [F2-V3] Classificação canônica da intenção do turno ATUAL.
// Usada para forçar rebaixamento de estado avançado quando o cliente
// muda de assunto / volta a perguntar / só cumprimenta.
export type TurnIntent =
  | "pure_greeting"
  | "informative_question"
  | "product_named"
  | "comparison"
  | "purchase_intent"
  | "data_provided"
  | "support"
  // [F2-V4] Cliente desafia a variedade do catálogo: "só tem essa?",
  // "tem outras?", "essa é a única?", "tem mais opções?".
  // Sempre força resposta pela família/linha — nunca pelo item isolado.
  | "variety_challenge"
  // [F2-V4] Cliente faz pergunta genérica de família/objetivo
  // (ex.: "tem alguma loção pra crescer cabelo?", "vocês têm shampoo?")
  // sem citar produto específico. Deve ir para recommendation.
  | "family_or_objective_query"
  | "other";

export interface TurnIntentClassification {
  intent: TurnIntent;
  signals: {
    isPureGreeting: boolean;
    hasNamedProduct: boolean;
    hasFamilyMention: boolean;
    hasFocusReference: boolean;
    hasInformationalQuestion: boolean;
    hasCompareIntent: boolean;
    hasBuySignal: boolean;
    hasCheckoutRequest: boolean;
    hasSupportTopic: boolean;
    hasDataProvided: boolean;
    // [F2-V4]
    hasVarietyChallenge: boolean;
    hasFamilyOrObjectiveQuery: boolean;
  };
}

export interface TransitionInput {
  current: PipelineState;
  message: string;
  isPureGreeting: boolean;
  hasActiveCart: boolean;
  hasCheckoutLink: boolean;
  toolsCalled: string[];
  // Contagem de turnos consecutivos em discovery (vinda do servidor).
  discoveryTurnsSoFar: number;
  // Catálogo conhecido — usado para detectar menção a produto pelo nome.
  productNamesHint?: string[];
  // [F2-V2] Foco persistido na conversa — usado para resolver "esse/ele/eles"
  // e para detectar intenção comparativa sobre os itens já em foco.
  familyFocus?: string | null;
  lastFocusedProductName?: string | null;
  // [F2-V3] Sinal de intenção de compra recente (últimos N minutos).
  // Usado para evitar que `data_provided` sozinho preserve checkout em
  // conversa contaminada por estado legado.
  recentPurchaseIntent?: boolean;
}

export interface TransitionResult {
  next: PipelineState;
  reason: TransitionReason;
  // Marca quando a transição foi forçada por regra (não por tool).
  forced: boolean;
  // [F2-V3] Intenção do turno classificada (auditoria/log).
  turnIntent?: TurnIntent;
  // [F2-V3] Razão estrutural quando houve rebaixamento por intenção do turno.
  downgradeReason?: TransitionReason | null;
}

// ----------------------------------------------------------------
// Detectores leves (lex-based) — barato e determinístico.
// Em F3 dá pra promover para classifier mais robusto.
// ----------------------------------------------------------------

const BUY_SIGNAL_PATTERNS = [
  /\bquero\s+(comprar|levar|esse|essa|esses|essas|um|uma|o|a)\b/i,
  /\bvou\s+(levar|comprar|fechar|querer)\b/i,
  /\bpode\s+(adicionar|colocar|botar)\b/i,
  /\badiciona\s+(no\s+)?carrinho\b/i,
  /\bmanda\s+(o\s+)?link\b/i,
  /\bme\s+manda\s+(o\s+)?(link|pix)\b/i,
  /\bcomo\s+(eu\s+)?(pago|fa[çc]o\s+pra\s+pagar)\b/i,
  /\bfechar\s+(o\s+)?pedido\b/i,
  /\bfinaliza(r)?\b/i,
];

const SUPPORT_PATTERNS = [
  /\bmeu\s+pedido\b/i,
  /\bpedido\s+(n[ºo°]?\s*)?\d/i,
  /\brastrei(o|ar|amento)\b/i,
  /\bn[ãa]o\s+chegou\b/i,
  /\batraso\b/i,
  /\bcad[êe]\b.*\bpedido\b/i,
  /\bproblema\s+com\s+(o\s+)?pedido\b/i,
  /\bquero\s+trocar\b/i,
  /\bdevolver\b/i,
  /\breembolso\b/i,
];

const CHECKOUT_REQUEST_PATTERNS = [
  /\b(finaliza(r)?|fechar)\s+(a\s+)?compra\b/i,
  // [Reg #2.10] "manda/envia/gera o link" — com ou sem "me", com ou sem artigo.
  // Inclui também "pode mandar/enviar/gerar (o) link" e "manda/envia (o) link pra mim".
  /\b(me\s+)?(manda|envia|envie|mande|gera|gere)\s+(o\s+)?link\b/i,
  /\bpode\s+(mandar|enviar|gerar|finalizar)\s+(o\s+)?(link|pedido|checkout)\b/i,
  /\bgera\s+(o\s+)?link\b/i,
];

// Sinais de DOR/OBJETIVO declarados pelo cliente — quando aparecem, a IA
// já tem informação suficiente para recomendar (não cabe nova rodada de
// discovery genérica). Lista é ampla de propósito: cobre família "shampoo",
// "creme", "loção" + termos de queda/calvície/prevenção/caspa/oleosidade.
// Em F3 isso pode virar classifier; aqui é heurística determinística.
const PAIN_OR_OBJECTIVE_PATTERNS: RegExp[] = [
  // Categoria geral + qualquer continuação ("shampoo para X", "creme pra Y")
  /\b(shampoo|condicionador|cream|cr[eê]me|lo[çc][ãa]o|balm|s[eé]rum|t[ôo]nico|m[áa]scara|gel|sabonete|kit|combo)\b[^.?!]{2,}/i,
  // Dores explícitas — cabelo / couro cabeludo
  /\bcalv[íi]cie\b/i,
  /\bqueda\b/i,
  /\bcaindo\b/i,
  /\bfalha(s)?\s+(na\s+)?(coroa|cabe[çc]a|cabelo)\b/i,
  /\bcoroa\s+(falha|aberta|rala)\b/i,
  /\brala(r|ndo)?\b/i,
  /\bcaspa\b/i,
  /\bseborr[eé]ia\b/i,
  /\boleosidade\b/i,
  /\bcabelo\s+(oleoso|seco|fino|ralo)\b/i,
  /\bcouro\s+cabeludo\b/i,
  // Objetivos
  /\bpreven(ir|[çc][ãa]o|tivo)\b/i,
  /\btratar\b/i,
  /\btratamento\b/i,
  /\bcrescer|crescimento|fortalecer|fortalecimento\b/i,
  // Pele / pós-banho
  /\bp[óo]s[\s-]banho\b/i,
];

function detectPainOrObjective(message: string): boolean {
  if (!message) return false;
  return PAIN_OR_OBJECTIVE_PATTERNS.some(re => re.test(message));
}

function mentionsProductByName(message: string, productNames: string[] = []): boolean {
  return extractMentionedProductName(message, productNames) !== null;
}

// [F2-V2] Retorna o nome do produto mencionado nominalmente, se houver.
// Prefere o match mais longo (mais específico).
export function extractMentionedProductName(
  message: string,
  productNames: string[] = [],
): string | null {
  if (!message || !productNames.length) return null;
  const norm = message.toLowerCase();
  let best: string | null = null;
  for (const name of productNames) {
    if (!name) continue;
    const n = name.toLowerCase().trim();
    if (n.length < 4) continue;
    if (norm.includes(n)) {
      if (!best || n.length > best.length) best = name;
    }
  }
  return best;
}

function detectBuySignal(message: string): boolean {
  if (!message) return false;
  return BUY_SIGNAL_PATTERNS.some(re => re.test(message));
}

function detectSupportTopic(message: string): boolean {
  if (!message) return false;
  return SUPPORT_PATTERNS.some(re => re.test(message));
}

function detectCheckoutRequest(message: string): boolean {
  if (!message) return false;
  return CHECKOUT_REQUEST_PATTERNS.some(re => re.test(message));
}

// [F2-V2] Detector de intenção comparativa explícita.
// Quando dispara junto com foco já existente, vamos para product_detail
// (modo comparação injetado via contextualBlocks pelo caller) sem reembaralhar
// a vitrine de recomendação.
const COMPARE_INTENT_PATTERNS: RegExp[] = [
  /\b(diferen[çc]a|diferen[çc]as)\b/i,
  /\b(compar(a|ar|e|ando)|comparativo)\b/i,
  /\bqual\s+(o\s+)?melhor\b/i,
  /\bqual\s+(é\s+)?(o|a)\s+melhor\b/i,
  /\bqual\s+(eu\s+)?(devo|escolho)\b/i,
  /\bentre\s+(eles|elas|esses|essas)\b/i,
];
export function detectCompareIntent(message: string): boolean {
  if (!message) return false;
  return COMPARE_INTENT_PATTERNS.some(re => re.test(message));
}

// [F2-V2] Detector de referência anafórica ("esse/ele/eles/esse shampoo").
// Não basta a palavra solta; exigimos contexto curto OU acompanhada de família.
const ANAPHORIC_REFERENCE_PATTERNS: RegExp[] = [
  /\b(esse|essa|esses|essas|este|esta|estes|estas)\s+(shampoo|condicionador|cr[eê]me|lo[çc][ãa]o|balm|s[eé]rum|t[ôo]nico|m[áa]scara|gel|sabonete|kit|combo|produto|item)\b/i,
  /^\s*(ele|ela|eles|elas|esse|essa|esses|essas)\b\s*[?.!,]?\s*$/i,
  /\b(me\s+(conta|fala|diz|explica)\s+(mais\s+)?(sobre\s+)?(ele|ela|esse|essa))\b/i,
  /\b(quanto\s+custa\s+(ele|ela|esse|essa))\b/i,
];
export function detectAnaphoricReference(message: string): boolean {
  if (!message) return false;
  const trimmed = message.trim();
  if (trimmed.length > 80) {
    return ANAPHORIC_REFERENCE_PATTERNS.slice(0, 1).some(re => re.test(trimmed));
  }
  return ANAPHORIC_REFERENCE_PATTERNS.some(re => re.test(trimmed));
}

// [F2-V2] Detector de família mencionada. Usado para atualizar familyFocus
// quando o cliente diz "shampoo", "loção", "creme" sozinho ou com modificador.
// [Reg #17.x] Vocabulário ampliado: além das famílias base, cobrir variações
// muito comuns que estavam caindo em fallback ("loção pós-barba", "after-shave",
// "pomada", "óleo", "barba", "hidratante"). Famílias específicas redirecionam
// para a família-mãe quando faz sentido (ex.: pós-barba/after-shave → loção).
const FAMILY_TOKENS: Array<{ family: string; pattern: RegExp }> = [
  { family: "shampoo", pattern: /\bshampoo(s)?\b/i },
  { family: "condicionador", pattern: /\bcondicionador(es)?\b/i },
  { family: "creme", pattern: /\bcr[eê]me(s)?\b/i },
  // pós-barba / after-shave entram como "locao" (família-mãe)
  { family: "locao", pattern: /\b(p[óo]s[\s-]?barba|after[\s-]?shave|lo[çc][ãa]o|loc(o|õ)es)\b/i },
  { family: "balm", pattern: /\bbalm(s)?\b/i },
  { family: "serum", pattern: /\bs[eé]rum(s)?\b/i },
  { family: "tonico", pattern: /\bt[ôo]nico(s)?\b/i },
  { family: "mascara", pattern: /\bm[áa]scara(s)?\b/i },
  { family: "gel", pattern: /\bgel(s)?\b/i },
  { family: "sabonete", pattern: /\bsabonete(s)?\b/i },
  { family: "pomada", pattern: /\bpomada(s)?\b/i },
  { family: "oleo", pattern: /\b[óo]leo(s)?\b/i },
  { family: "hidratante", pattern: /\bhidratante(s)?\b/i },
  { family: "barba", pattern: /\bbarba\b/i },
  { family: "desodorante", pattern: /\bdesodorante(s)?\b/i },
  { family: "kit", pattern: /\bkit(s)?\b/i },
  { family: "combo", pattern: /\bcombo(s)?\b/i },
  { family: "perfume", pattern: /\bperfume(s)?\b/i },
];
export function detectFamilyMentioned(message: string): string | null {
  if (!message) return null;
  for (const entry of FAMILY_TOKENS) {
    if (entry.pattern.test(message)) return entry.family;
  }
  return null;
}

// [F2-CATALOG-FIX] Algumas linhas comerciais equivalem ao mesmo "tipo" pedido
// pelo cliente, mesmo com nomenclatura diferente no catálogo.
// Ex.: cliente pede "loção" e o tenant trabalha com loção + balm pós-banho
// como duas opções tópicas do mesmo caso de uso. Isso NÃO muda a regra de
// cobertura cruzada de frete (que continua por mesma linha/produto-base), apenas
// evita esconder uma opção relevante na vitrine inicial por rótulo de família.
export function getCatalogFamilyAliases(family: string | null | undefined): string[] {
  switch (family) {
    case "locao":
      return ["locao", "balm"];
    case "balm":
      return ["balm", "locao"];
    default:
      return family ? [family] : [];
  }
}

const INFORMATIONAL_PRODUCT_QUESTION_PATTERNS: RegExp[] = [
  /\b(funciona|funciona\s+mesmo)\b/i,
  /\b([ée]\s+)?bom\s+mesmo\b/i,
  /\bvale\s+a\s+pena\b/i,
  /\b(pra|para)\s+que\s+serve\b/i,
  /\bcomo\s+funciona\b/i,
  /\bcomo\s+usar\b/i,
  /\bqual\s+(a\s+)?diferen[çc]a\b/i,
  /\bquais?\s+(as\s+)?diferen[çc]as\b/i,
  /\bdiferen[çc]a\s+entre\b/i,
  /\bme\s+explica\b/i,
];

export function detectInformationalProductQuestion(message: string): boolean {
  if (!message) return false;
  return INFORMATIONAL_PRODUCT_QUESTION_PATTERNS.some(re => re.test(message));
}

// ----------------------------------------------------------------
// [F2-V3] Detector de "data_provided" — cliente mandou nome/CPF/CEP/email
// espontaneamente. Não é compra explícita; só preserva checkout se houver
// carrinho ativo + intenção recente de compra.
// ----------------------------------------------------------------
const DATA_PROVIDED_PATTERNS: RegExp[] = [
  /\bcpf[:\s]*\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/i,
  /\bcep[:\s]*\d{5}-?\d{3}\b/i,
  /\b\d{5}-?\d{3}\b/, // CEP solto
  /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, // CPF solto
  /\bmeu\s+(nome|email|e-mail|cpf|cep|endere[çc]o)\s+[ée]\b/i,
  /\bemail[:\s]*[\w.+-]+@[\w.-]+\.[a-z]{2,}/i,
];
function detectDataProvided(message: string): boolean {
  if (!message) return false;
  return DATA_PROVIDED_PATTERNS.some(re => re.test(message));
}

// ----------------------------------------------------------------
// [F2-V4] Detector de "variety challenge" — cliente desafia variedade do
// catálogo. Sempre força resposta pela família/linha (recommendation).
// ----------------------------------------------------------------
const VARIETY_CHALLENGE_PATTERNS: RegExp[] = [
  /\bs[óo]\s+tem\s+(essa|esse|esses|essas|isso|isso\s+a[ií])\b/i,
  /\b[ée]\s+(s[óo]|a\s+[uú]nica?)\b/i,
  /\bessa?\s+[ée]\s+a\s+[uú]nica?\b/i,
  /\btem\s+(outras?|outros|mais|alguma\s+outra|algum\s+outro)\b/i,
  /\bmais\s+(op[çc][ãa]o|op[çc][õo]es)\b/i,
  /\boutras?\s+op[çc][õo]es\b/i,
  /\bquais?\s+(s[ãa]o\s+)?(as\s+)?op[çc][õo]es\b/i,
  /\bn[ãa]o\s+tem\s+(outra|outro|mais)\b/i,
];
export function detectVarietyChallenge(message: string): boolean {
  if (!message) return false;
  return VARIETY_CHALLENGE_PATTERNS.some(re => re.test(message));
}

// ----------------------------------------------------------------
// [F2-V4] Detector de pergunta genérica de família/objetivo
// ("você tem alguma loção?", "vocês têm shampoo pra queda?",
//  "tem algum creme?"). Não cita produto pelo nome.
// ----------------------------------------------------------------
const FAMILY_OR_OBJECTIVE_QUERY_PATTERNS: RegExp[] = [
  /\b(voc[êe]s?|tem|tem\s+algum[ao]?)\s+/i, // gatilho largo, refinado abaixo
];
export function detectFamilyOrObjectiveQuery(
  message: string,
  hasFamilyMention: boolean,
  hasPainOrObjective: boolean,
  hasNamedProduct: boolean,
): boolean {
  if (!message) return false;
  if (hasNamedProduct) return false;
  if (!hasFamilyMention && !hasPainOrObjective) return false;
  // Exige um verbo/pergunta de existência ou desejo de busca.
  const hasQuery = /\b(tem|t[eê]m|voc[êe]s?\s+t[eê]m|procuro|preciso|queria|quero\s+(ver|saber|conhecer))\b/i.test(message)
    || /\?$/.test(message.trim())
    || /\balgum[ao]?\b/i.test(message);
  return hasQuery;
}

// ----------------------------------------------------------------
// [F2-V3] Classificador canônico da intenção do turno atual.
// Função pura — não toca estado. Usada pelo resolver para aplicar
// rebaixamento estrutural antes da máquina de estados clássica.
// ----------------------------------------------------------------
export function classifyTurnIntent(
  message: string,
  ctx: {
    isPureGreeting: boolean;
    productNamesHint?: string[];
    familyFocus?: string | null;
    lastFocusedProductName?: string | null;
  },
): TurnIntentClassification {
  const msg = message || "";
  const hasNamedProduct = mentionsProductByName(msg, ctx.productNamesHint || []);
  const hasFamilyMention = !!detectFamilyMentioned(msg);
  const hasAnaphoricReference = detectAnaphoricReference(msg);
  const hasFocusReference = !!(ctx.lastFocusedProductName || ctx.familyFocus || hasNamedProduct || hasAnaphoricReference);
  const hasInformationalQuestion = detectInformationalProductQuestion(msg);
  const hasCompareIntent = detectCompareIntent(msg);
  const hasBuySignal = detectBuySignal(msg);
  const hasCheckoutRequest = detectCheckoutRequest(msg);
  const hasSupportTopic = detectSupportTopic(msg);
  const hasDataProvided = detectDataProvided(msg);
  const hasPainOrObjective = detectPainOrObjective(msg);
  const hasVarietyChallenge = detectVarietyChallenge(msg);
  const hasFamilyOrObjectiveQuery = detectFamilyOrObjectiveQuery(
    msg,
    hasFamilyMention,
    hasPainOrObjective,
    hasNamedProduct,
  );

  let intent: TurnIntent = "other";
  // Ordem importa: support > purchase > variety_challenge > comparison >
  // product_named > family_or_objective_query > informative > data > greeting > other
  // variety_challenge tem precedência sobre product_named porque é meta-pergunta
  // sobre o catálogo, não sobre o item.
  if (hasSupportTopic) intent = "support";
  else if (hasBuySignal || hasCheckoutRequest) intent = "purchase_intent";
  else if (hasVarietyChallenge) intent = "variety_challenge";
  else if (hasCompareIntent) intent = "comparison";
  else if (hasNamedProduct) intent = "product_named";
  else if (hasFamilyOrObjectiveQuery) intent = "family_or_objective_query";
  else if (hasInformationalQuestion && (hasFocusReference || hasFamilyMention)) intent = "informative_question";
  else if (hasDataProvided) intent = "data_provided";
  else if (ctx.isPureGreeting) intent = "pure_greeting";

  return {
    intent,
    signals: {
      isPureGreeting: ctx.isPureGreeting,
      hasNamedProduct,
      hasFamilyMention,
      hasFocusReference,
      hasInformationalQuestion,
      hasCompareIntent,
      hasBuySignal,
      hasCheckoutRequest,
      hasSupportTopic,
      hasDataProvided,
      hasVarietyChallenge,
      hasFamilyOrObjectiveQuery,
    },
  };
}

// ----------------------------------------------------------------
// Decisão da próxima transição — ordem de prioridade importa.
// ----------------------------------------------------------------
export function decideNextState(input: TransitionInput): TransitionResult {
  const { current, message, isPureGreeting, hasActiveCart, hasCheckoutLink, toolsCalled, discoveryTurnsSoFar, productNamesHint, familyFocus, lastFocusedProductName, recentPurchaseIntent } = input;

  // [F2-V3] Classificação canônica do turno (usada pelas regras de rebaixamento).
  const turnClass = classifyTurnIntent(message, {
    isPureGreeting,
    productNamesHint,
    familyFocus,
    lastFocusedProductName,
  });
  const turnIntent = turnClass.intent;
  const { hasNamedProduct, hasFamilyMention, hasFocusReference, hasCompareIntent, hasInformationalQuestion } = turnClass.signals;
  const isInformationalProductQuestion =
    (hasInformationalQuestion || hasCompareIntent) && (hasFocusReference || hasFamilyMention);

  // 0. Handoff é terminal — se foi solicitado por tool, prevalece.
  if (toolsCalled.includes("request_human_handoff")) {
    return { next: "handoff", reason: "handoff_requested", forced: true, turnIntent };
  }

  // 1. Tópico de pedido existente → support (sai do funil).
  if (turnIntent === "support") {
    return { next: "support", reason: "support_topic_detected", forced: true, turnIntent };
  }

  // ============================================================
  // [F2-V3] BLOCO DE REBAIXAMENTO ESTRUTURAL POR INTENÇÃO DO TURNO
  // Aplica ANTES das regras clássicas. Vence contexto antigo
  // (sales_state legado, family_focus, last_pending_action, customer_data).
  // ============================================================

  // R1. Saudação pura → SEMPRE rebaixa para greeting, ignora estado anterior.
  if (turnIntent === "pure_greeting") {
    return {
      next: "greeting",
      reason: "downgrade_pure_greeting_resets_state",
      forced: true,
      turnIntent,
      downgradeReason: "downgrade_pure_greeting_resets_state",
    };
  }

  // ============================================================
  // [F2-V4] R1b. VARIETY CHALLENGE — "só tem essa?", "tem outras?"
  // Sempre força recommendation pela família/linha.
  // - Se há familyFocus persistido → mantém família e busca outras opções dela.
  // - Se há lastFocusedProductName mas sem familyFocus → caller infere família
  //   pelo nome (via getCatalogFamilyAliases).
  // - Sem nada → recommendation genérica.
  // NUNCA responde pelo item isolado (resolve "só tem essa?" travado em product_detail).
  // ============================================================
  if (turnIntent === "variety_challenge") {
    const downgrade = current === "product_detail"
      ? "recovery_downgrade_product_detail_to_recommendation_variety_challenge" as const
      : null;
    if (familyFocus || lastFocusedProductName) {
      return {
        next: "recommendation",
        reason: "variety_challenge_with_family_focus_to_recommendation",
        forced: true,
        turnIntent,
        downgradeReason: downgrade,
      };
    }
    return {
      next: "recommendation",
      reason: "recovery_downgrade_product_detail_to_recommendation_variety_challenge",
      forced: true,
      turnIntent,
      downgradeReason: downgrade,
    };
  }

  // ============================================================
  // [F2-V4] R1c. FAMILY OR OBJECTIVE QUERY — pergunta genérica de
  // família/objetivo sem citar produto pelo nome
  // ("você tem alguma loção pra crescer cabelo?", "vocês têm shampoo?").
  // Vai para recommendation (vitrine curta da família/objetivo),
  // mesmo se a conversa estava contaminada em product_detail.
  // Resolve o caso clássico do recovery downgrade.
  // ============================================================
  if (turnIntent === "family_or_objective_query") {
    return {
      next: "recommendation",
      reason: "recovery_downgrade_product_detail_to_recommendation_family_question",
      forced: true,
      turnIntent,
      downgradeReason: current === "product_detail"
        ? "recovery_downgrade_product_detail_to_recommendation_family_question"
        : null,
    };
  }

  // R2. Comparação:
  //  - com foco existente (lastFocusedProductName OU familyFocus) → product_detail (modo comparação)
  //  - sem foco → recommendation
  if (turnIntent === "comparison") {
    if (lastFocusedProductName || familyFocus) {
      return {
        next: "product_detail",
        reason: "downgrade_comparison_to_product_detail_with_focus",
        forced: true,
        turnIntent,
        downgradeReason: "downgrade_comparison_to_product_detail_with_focus",
      };
    }
    return {
      next: "recommendation",
      reason: "downgrade_comparison_to_recommendation_no_focus",
      forced: true,
      turnIntent,
      downgradeReason: "downgrade_comparison_to_recommendation_no_focus",
    };
  }

  // R3. Pergunta informativa:
  //  - com foco em produto específico → product_detail
  //  - com família mencionada/em foco mas sem produto específico → recommendation
  //  - sem nenhum foco → discovery
  if (turnIntent === "informative_question") {
    if (lastFocusedProductName || hasNamedProduct) {
      return {
        next: "product_detail",
        reason: "downgrade_informative_question_to_product_detail",
        forced: true,
        turnIntent,
        downgradeReason: "downgrade_informative_question_to_product_detail",
      };
    }
    if (familyFocus || hasFamilyMention) {
      return {
        next: "recommendation",
        reason: "downgrade_informative_question_to_recommendation",
        forced: true,
        turnIntent,
        downgradeReason: "downgrade_informative_question_to_recommendation",
      };
    }
    return {
      next: "discovery",
      reason: "downgrade_informative_question_to_discovery",
      forced: true,
      turnIntent,
      downgradeReason: "downgrade_informative_question_to_discovery",
    };
  }

  // R4. data_provided sozinho:
  //  - SÓ preserva checkout_assist se houver carrinho ativo OU intenção recente de compra.
  //  - Caso contrário (conversa contaminada) ignora e segue o fluxo natural abaixo.
  if (turnIntent === "data_provided") {
    if (hasActiveCart || recentPurchaseIntent) {
      return {
        next: "checkout_assist",
        reason: "data_provided_kept_checkout_with_active_cart",
        forced: true,
        turnIntent,
        downgradeReason: null,
      };
    }
    // Sem carrinho/intenção: trata como neutro, deixa cair nas regras clássicas
    // (que provavelmente vão para greeting/discovery).
    // Loga o ignore para auditoria via downgradeReason.
  }

  // ============================================================
  // [F2-V3] Compatibilidade — regra antiga 1b (informativa) preservada
  // como fallback quando a classificação não cobriu o caso (defesa em
  // profundidade).
  // ============================================================
  if (isInformationalProductQuestion) {
    if (hasFocusReference) {
      return {
        next: "product_detail",
        reason: "informational_product_question_downgrade_to_product_detail",
        forced: true,
        turnIntent,
      };
    }
    if (hasFamilyMention) {
      return {
        next: "recommendation",
        reason: "informational_product_question_downgrade_to_recommendation",
        forced: true,
        turnIntent,
      };
    }
  }

  // 2. Checkout efetivo — link gerado ou explicitamente pedido.
  if (hasCheckoutLink || toolsCalled.includes("generate_checkout_link")) {
    return { next: "checkout_assist", reason: "checkout_link_generated", forced: false, turnIntent };
  }
  if (detectCheckoutRequest(message)) {
    return { next: "checkout_assist", reason: "explicit_checkout_request", forced: true, turnIntent };
  }

  // 3. Carrinho ativo ou item adicionado neste turno.
  if (hasActiveCart || toolsCalled.includes("add_to_cart")) {
    const r = advanceTo(current, "checkout_assist", "cart_active_or_added");
    return { ...r, turnIntent };
  }

  // 4. Sinal claro de compra → decision (mesmo vindo de greeting/discovery).
  if (turnIntent === "purchase_intent") {
    const r = advanceTo(current, "decision", "buy_signal_detected");
    return { ...r, turnIntent };
  }

  // 5. Cliente citou produto pelo nome → product_detail (PRIORIDADE MÁXIMA).
  if (hasNamedProduct) {
    const r = advanceTo(current, "product_detail", "product_mentioned_by_name");
    return { ...r, turnIntent };
  }

  // [F2-V2] 5b. Intenção comparativa COM foco existente → product_detail
  if (hasCompareIntent && (lastFocusedProductName || familyFocus)) {
    const r = advanceTo(current, "product_detail", "compare_intent_with_focus");
    return { ...r, turnIntent };
  }

  // [F2-V2] 5c. Referência anafórica + foco existente → product_detail
  if (detectAnaphoricReference(message) && (lastFocusedProductName || familyFocus)) {
    const r = advanceTo(current, "product_detail", "reference_resolved_by_focus_to_product_detail");
    return { ...r, turnIntent };
  }

  // 6. Tools de detalhe foram chamadas → product_detail.
  if (toolsCalled.includes("get_product_details") || toolsCalled.includes("get_product_variants")) {
    const r = advanceTo(current, "product_detail", "tool_advanced_state");
    return { ...r, turnIntent };
  }

  // 7. Tools de busca foram chamadas → recommendation.
  if (toolsCalled.includes("search_products") || toolsCalled.includes("recommend_related_products")) {
    const r = advanceTo(current, "recommendation", "tool_advanced_state");
    return { ...r, turnIntent };
  }

  // 8a. Dor/objetivo declarada em greeting/discovery → recommendation.
  if ((current === "greeting" || current === "discovery") && detectPainOrObjective(message)) {
    return {
      next: "recommendation",
      reason: "pain_or_objective_declared_advance_to_recommendation",
      forced: true,
      turnIntent,
    };
  }

  // 8b. Discovery com limite atingido → força recommendation.
  if (current === "discovery" && discoveryTurnsSoFar >= 2) {
    return { next: "recommendation", reason: "discovery_limit_reached_advance_to_recommendation", forced: true, turnIntent };
  }

  // 9. Saída natural de greeting com pergunta de necessidade.
  if (current === "greeting" && !isPureGreeting && message.trim().length > 0) {
    return { next: "discovery", reason: "greeting_to_discovery_question", forced: false, turnIntent };
  }

  // 10. Saudação pura mantém greeting (já coberta em R1, mas mantém compat).
  if (current === "greeting" && isPureGreeting) {
    return { next: "greeting", reason: "first_contact_pure_greeting", forced: false, turnIntent };
  }

  // [F2-V3] Caso especial: data_provided que caiu até aqui (sem carrinho/intenção)
  // — registra o ignore para auditoria.
  if (turnIntent === "data_provided") {
    return {
      next: current,
      reason: "data_provided_ignored_no_active_cart",
      forced: false,
      turnIntent,
      downgradeReason: "data_provided_ignored_no_active_cart",
    };
  }

  return { next: current, reason: "no_change_keep_state", forced: false, turnIntent };
}


// Anti-regressão: só avança se o rank do alvo for ≥ atual, ou se for forçado.
function advanceTo(current: PipelineState, target: PipelineState, reason: TransitionReason): TransitionResult {
  if (STATE_RANK[target] >= STATE_RANK[current]) {
    return { next: target, reason, forced: false };
  }
  // Caso de regressão silenciosa bloqueada — mantém estado atual.
  return { next: current, reason: "regression_blocked", forced: false };
}
