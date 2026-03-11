import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { getAIEndpoint, resetAIRouterCache, type AIEndpoint } from "../_shared/ai-router.ts";

// ===== VERSION =====
const VERSION = "v6.9.0"; // Port adset/ad performance tools to v2 executeToolDirect + purge pixel memories
// ====================

const AI_TIMEOUT_MS = 90000;
const GRAPH_VERSION = "v21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ======================================================================
// 1. INTENT CLASSIFICATION — Deterministic, no LLM dependency
// ======================================================================

type IntentCategory =
  | "performance"     // campaign/adset/ad metrics, ROAS, CPA, spend, conversions
  | "targeting"       // audiences, segmentation, interests, lookalikes, demographics
  | "campaigns_list"  // list/enumerate campaigns, adsets, ads
  | "store_context"   // products, categories, offers, store info
  | "autopilot"       // config, actions, sessions, insights, strategic plan
  | "write_meta"      // create/pause/activate/budget/duplicate on Meta
  | "write_google"    // Google Ads write operations
  | "write_tiktok"    // TikTok write operations
  | "creative"        // generate images, texts, creatives
  | "drive"           // browse/search Drive files
  | "strategic"       // strategy planning, campaign proposals, funnel design, audience strategy
  | "general";        // conversation, greetings, explanations

type IntentMode = "factual" | "strategic" | "conversational";

interface ClassifiedIntent {
  category: IntentCategory;
  mode: IntentMode;           // Replaces simple isFactual boolean
  isFactual: boolean;         // Backward compat — true when mode === "factual"
  isHybrid: boolean;          // True when message mixes factual query + strategic intent
  entities: {
    campaignIds?: string[];
    adsetIds?: string[];
    period?: string;
    channel?: string;
    productName?: string;
  };
  confidence: number;
}

function classifyIntent(message: string, history: any[]): ClassifiedIntent {
  const msg = message.toLowerCase().trim();
  const entities: ClassifiedIntent["entities"] = {};

  // Extract channel
  if (/\bmeta\b|facebook|instagram/i.test(msg)) entities.channel = "meta";
  else if (/\bgoogle\b/i.test(msg)) entities.channel = "google";
  else if (/\btiktok\b/i.test(msg)) entities.channel = "tiktok";

  // Extract period hints
  if (/últimos?\s+(\d+)\s+dias?/i.test(msg)) {
    const match = msg.match(/últimos?\s+(\d+)\s+dias?/i);
    entities.period = match ? `last_${match[1]}d` : undefined;
  } else if (/lifetime|desde\s+o\s+início|histórico\s+completo|máximo|total/i.test(msg)) {
    entities.period = "maximum";
  } else if (/esta\s+semana|últimos?\s+7/i.test(msg)) {
    entities.period = "last_7d";
  } else if (/este\s+mês|últimos?\s+30/i.test(msg)) {
    entities.period = "last_30d";
  }

  // ---- STRATEGIC / GENERATIVE (check BEFORE write patterns) ----
  // These are requests where the user wants the AI to PLAN, PROPOSE, or DESIGN
  // but NOT execute directly. The output should converge to the approval pipeline.
  // v6.7.0: Removed broad negative lookahead for query verbs (listar/mostrar/quais são).
  // Hybrid messages like "liste as campanhas e monte uma estratégia" now correctly route
  // to strategic mode — the AI will use its factual tools to gather data first, then propose.
  const strategicPatterns = /mont[ae]r?\s+(estratégia|plano|funil|estrutura)|propon?h?[ae]r?\s+(campanha|estratégia|plano|estrutura|teste)|suger[ie]r?\s+(campanha|estratégia|público|criativo|estrutura|teste)|plan[oe]?j[ae]r?\s+(campanha|funil|teste)|desenh[ae]r?\s+(campanha|funil|estratégia)|cri[ae]r?\s+(estratégia|plano|funil|estrutura)|defin[ie]r?\s+(estratégia|plano|público|teste)|quero\s+(uma?\s+)?(estratégia|plano|campanha|teste|funil)|preciso\s+(de\s+)?(uma?\s+)?(estratégia|plano|campanha)|nova\s+(estratégia|campanha|estrutura)|novas?\s+campanha[s]?\s+(para|de|com)|escal[ae]r?\s+vend|aumentar\s+(vend|roas|roi\b|resultado|conversões?|faturamento)|melhorar\s+(resultado|performance|desempenho|roas|roi\b|cpa\b|vendas?|conversões?|faturamento)|otimizar\s+(campanha|resultado|funil|roas|cpa\b|vendas?)/i;
  const queryVerbs = /list[ae]r?|mostr[ae]r?|quais\s+são|quanto|qual\s+(é|foi|era)|analis[ae]r?|ver\b|consult[ae]r?|compar[ae]r?|relat[oó]rio/i;

  if (strategicPatterns.test(msg)) {
    // Detect hybrid: strategic intent + query verbs coexisting
    const hasQueryVerbs = queryVerbs.test(msg);
    if (hasQueryVerbs) {
      console.log(`[ads-chat-v2] Hybrid detected: strategic patterns + query verbs. Routing strategic with factual pre-fetch.`);
    }
    return { category: "strategic", mode: "strategic", isFactual: false, isHybrid: hasQueryVerbs, entities, confidence: 0.9 };
  }

  // ---- Pattern matching (ordered by specificity) ----

  // DRILL-DOWN: adset/ad level analysis — MUST route to tool-calling path, NOT factual pre-resolution
  // The factual orchestrator only resolves campaign-level data. Adset/ad analysis needs live tool calls.
  if (/conjunto[s]?\s+de\s+anúncio|adset[s]?|anúncio[s]?\s+individual|por\s+conjunto|por\s+anúncio|nível\s+de\s+conjunto|nível\s+de\s+anúncio|drill[- ]?down|detalh[ae]r?\s+(campanha|conjunto|anúncio)|aprofund[ae]r?\s+(anális|campanha|conjunto)/i.test(msg) &&
      !/cri[ae]r?|paus[ae]r?|ativ[ae]r?|alter[ae]r?/i.test(msg)) {
    console.log(`[ads-chat-v2] Drill-down detected: routing to performance with tool-calling (NOT factual pre-resolution)`);
    return { category: "performance", mode: "conversational", isFactual: false, isHybrid: false, entities, confidence: 0.9 };
  }

  // TARGETING (highest priority for targeting queries)
  if (/targeting|segmentação|segmentacao|público[s]?\s+(personalizado|semelhante|custom|lookalike)|audiência|interesse[s]?|demografi|faixa\s+etári|gênero|localização|posicionamento/i.test(msg) &&
      !/cri[ae]r?\s+(público|audiência|lookalike)|atualiz/i.test(msg)) {
    return { category: "targeting", mode: "factual", isFactual: true, isHybrid: false, entities, confidence: 0.95 };
  }

  // PERFORMANCE (metrics-focused)
  if (/performance|desempenho|resultado[s]?|métrica[s]?|roas|roi\b|cpa\b|cpc\b|ctr\b|gasto|spend|conversão|conversões|conversao|receita|faturamento|vendas?\s+(d[aoe]s?\s+)?campanhas?|quanto\s+gastei|quanto\s+gast[ao]u|quanto\s+faturei|quanto\s+convert|melhor(es)?\s+campanha|pior(es)?\s+campanha|top\s+\d+|ranking|comparar?\s+campanha|como\s+(est[áa]o?|vão|andam?|foram?)\s+(as?\s+)?(minhas?\s+)?campanha|campanhas?\s+com\s+mais\s+(vend|convers|resultado|faturamento|gasto|roi|roas)|campanhas?\s+com\s+menor|campanhas?\s+com\s+melhor|campanhas?\s+com\s+pior|\d+\s+campanha[s]?\s+com\s+mais|liste?\s+(aqui\s+)?(as?\s+)?\d+\s+campanha|analise?\s+(todas?\s+)?(as?\s+)?campanha|analis[ae]r?\s+(todas?\s+)?(as?\s+)?campanha|relat[oó]rio|relatório\s+de\s+campanha/i.test(msg) &&
      !/cri[ae]r?|paus[ae]r?|ativ[ae]r?|alter[ae]r?/i.test(msg)) {
    return { category: "performance", mode: "factual", isFactual: true, isHybrid: false, entities, confidence: 0.9 };
  }

  // CAMPAIGNS LIST (enumerate entities)
  if ((/list[ae]r?\s+(as?\s+)?campanha|quais\s+(são\s+)?(as?\s+)?campanha|mostr[ae]r?\s+(as?\s+)?campanha|campanhas?\s+ativ[ao]s?|campanhas?\s+pausad[ao]s?|quantas?\s+campanha|list[ae]r?\s+(os?\s+)?conjunt|list[ae]r?\s+(os?\s+)?anúncio/i.test(msg) ||
      /consegu[ei]s?\s+(ver|consultar|acessar|listar|mostrar|buscar|puxar)\s+(as?\s+)?(minhas?\s+)?campanha/i.test(msg) ||
      /voc[eê]\s+(v[eê]|consegu[ei]|tem\s+acesso|pode\s+ver)\s+(as?\s+)?(minhas?\s+)?campanha/i.test(msg) ||
      /(ver|consultar|acessar|visualizar|checar|conferir)\s+(as?\s+)?(minhas?\s+)?campanha/i.test(msg) ||
      /me\s+mostr[ae]?\s+(as?\s+)?(minhas?\s+)?campanha/i.test(msg) ||
      /quero\s+ver\s+(as?\s+)?(minhas?\s+)?campanha/i.test(msg) ||
      /(minhas?\s+)?campanha[s]?\s+(ativ|pausad|do\s+meta|no\s+meta|na\s+meta|do\s+facebook|no\s+facebook)/i.test(msg)) &&
      !/cri[ae]r?|paus[ae]r?|ativ[ae]r?/i.test(msg)) {
    return { category: "campaigns_list", mode: "factual", isFactual: true, isHybrid: false, entities, confidence: 0.85 };
  }

  // ---- BULK ACTION ESCALATION (check BEFORE individual write patterns) ----
  // When the user requests multiple campaigns, adsets, or structural changes across products,
  // escalate to strategic mode to require approval — even if the language is "conversational".
  const bulkIndicators = [
    /cri[ae]r?\s+(\d+|várias?|múltiplas?|diversas?|todas?)\s+(campanha|conjunto|anúncio)/i,
    /campanha[s]?\s+(para\s+)?(cada|todos?|todas?|vários?|múltiplos?|diversos?)\s+(produto|categori|item)/i,
    /(para\s+)?(cada|todos?|todas?)\s+(produto|categori)\s+(cri|mont|faz|lanç)/i,
    /cri[ae]r?\s+campanha[s]?\s+.{0,30}\s+e\s+.{0,30}\s+e\s+/i, // "criar campanha X e Y e Z"
    /(\d{2,})\s*(campanha|conjunto|anúncio)/i, // 10+ campaigns/adsets
    /restrutur[ae]r?\s+(todo|toda|tudo|funil|estrutura)|reformul[ae]r?\s+(toda|todo|funil)/i,
    /escal[ae]r?\s+(todo|toda|tudo|todas?\s+campanha)/i,
  ];
  if (bulkIndicators.some(rx => rx.test(msg))) {
    return { category: "strategic", mode: "strategic", isFactual: false, isHybrid: false, entities, confidence: 0.92 };
  }

  // WRITE - META (direct execution requests — pause, activate, budget changes)
  if (/paus[ae]r?\s+(campanha|conjunto|anúncio)|ativ[ae]r?\s+(campanha|conjunto|anúncio)|reativ[ae]r?|alter[ae]r?\s+(orçamento|budget|segmentação)|duplic[ae]r?\s+campanha|aument[ae]r?\s+(orçamento|budget)|diminu[iae]r?\s+(orçamento|budget)/i.test(msg) &&
      !/google|tiktok/i.test(msg)) {
    return { category: "write_meta", mode: "conversational", isFactual: false, isHybrid: false, entities, confidence: 0.9 };
  }

  // "criar campanha" without strategic context = write_meta (single campaign creation)
  if (/cri[ae]r?\s+(campanha|conjunto|anúncio|público|audiência|lookalike)/i.test(msg) &&
      !/estratégia|plano|funil|estrutura|suger|propon|test[ae]r?|escal/i.test(msg) &&
      !/google|tiktok/i.test(msg)) {
    return { category: "write_meta", mode: "conversational", isFactual: false, isHybrid: false, entities, confidence: 0.85 };
  }

  // WRITE - GOOGLE
  if (/google/i.test(msg) && /cri[ae]r?|paus[ae]r?|ativ[ae]r?|alter[ae]r?|budget/i.test(msg)) {
    return { category: "write_google", mode: "conversational", isFactual: false, isHybrid: false, entities, confidence: 0.85 };
  }

  // WRITE - TIKTOK
  if (/tiktok/i.test(msg) && /cri[ae]r?|paus[ae]r?|ativ[ae]r?|alter[ae]r?|budget/i.test(msg)) {
    return { category: "write_tiktok", mode: "conversational", isFactual: false, isHybrid: false, entities, confidence: 0.85 };
  }

  // CREATIVE
  if (/gerar?\s+(arte|imagem|criativo|texto|copy|headline)|criativo[s]?|arte[s]?\s+para\s+anúncio/i.test(msg)) {
    return { category: "creative", mode: "conversational", isFactual: false, isHybrid: false, entities, confidence: 0.85 };
  }

  // AUTOPILOT
  if (/configuração|config|guardião|estrategista|plano\s+estratégico|ações?\s+da\s+ia|diagnóstico|insight|histórico\s+de\s+execuç|autopilot|teste[s]?\s+a\/?b|experiment/i.test(msg)) {
    return { category: "autopilot", mode: "factual", isFactual: true, isHybrid: false, entities, confidence: 0.8 };
  }

  // STORE CONTEXT
  if (/produto[s]?|catálogo|categoria[s]?|oferta[s]?|desconto[s]?|loja|negócio|nicho|pixel|rastreamento/i.test(msg) &&
      !/campanha|anúncio|criativo|gerar/i.test(msg)) {
    return { category: "store_context", mode: "factual", isFactual: true, isHybrid: false, entities, confidence: 0.75 };
  }

  // DRIVE
  if (/drive|arquivo[s]?|pasta[s]?|buscar?\s+no\s+drive|explorar?\s+drive|meu\s+drive/i.test(msg)) {
    return { category: "drive", mode: "conversational", isFactual: false, isHybrid: false, entities, confidence: 0.8 };
  }

  // ---- COMPOSITE SIGNAL DETECTION (v6.6.0) ----
  // Instead of matching exact phrases, combine independent signals:
  //   entities + verbs + filters/ranking + metrics
  // When 2+ signal categories fire together, route to factual/performance.
  {
    const sigEntities = /campanha[s]?|conjunto[s]?\s+de\s+anúncio|adset[s]?|anúncio[s]?|conta\s+de\s+anúncio/i.test(msg);
    const sigVerbs = /analis[ae]r?|list[ae]r?|mostr[ae]r?|ver\b|compar[ae]r?|relat[oó]rio|consult[ae]r?|busc[ae]r?|chec[ae]r?|confer[ie]r?|verific[ae]r?|resum[ie]r?|exib[ie]r?|avaliar?|inspecion/i.test(msg);
    const sigFilters = /\btop\b|\bmais\b|\bmenos\b|melhor|pior|exceto|sem\b|maior|menor|ranking|ordena|classific|primeiro|último|acima|abaixo|\d+\s+(campanha|conjunto|anúncio)/i.test(msg);
    const sigMetrics = /vend[ae]s?|convers[ãõ][oe]?[es]?|roas\b|roi\b|cpa\b|cpc\b|ctr\b|gasto|spend|resultado[s]?|faturamento|receita|impres[sõ]|clique[s]?|alcance|custo/i.test(msg);
    
    const signalCount = [sigEntities, sigVerbs, sigFilters, sigMetrics].filter(Boolean).length;
    
    // 2+ signals AND no write/action verbs → factual performance
    if (signalCount >= 2 && !/cri[ae]r?|paus[ae]r?|ativ[ae]r?|alter[ae]r?|duplic/i.test(msg)) {
      console.log(`[ads-chat-v2] Composite signal hit: entities=${sigEntities} verbs=${sigVerbs} filters=${sigFilters} metrics=${sigMetrics} (${signalCount}/4)`);
      return { category: "performance", mode: "factual", isFactual: true, isHybrid: false, entities, confidence: 0.82 };
    }
  }

  // GENERAL - conversation
  return { category: "general", mode: "conversational", isFactual: false, isHybrid: false, entities, confidence: 0.5 };
}

// ======================================================================
// 2. TOOL SUBSETS — Only relevant tools per intent
// ======================================================================

function getToolSubset(category: IntentCategory): any[] {
  switch (category) {
    case "performance":
      return [
        toolDef("get_campaign_performance", "Busca performance real de TODAS as campanhas Meta. DEFAULT: date_preset='maximum' (LIFETIME).", {
          ad_account_id: { type: "string", description: "ID da conta (opcional)" },
          status_filter: { type: "string", enum: ["ACTIVE", "PAUSED", "ALL"] },
          days: { type: "number", description: "Janela de dias (use APENAS para janelas curtas)" },
          date_preset: { type: "string", enum: ["maximum", "last_7d", "last_14d", "last_30d", "last_90d", "last_year"] },
        }),
        toolDef("get_campaign_details", "Drill-down de uma campanha: conjuntos e anúncios com métricas.", {
          campaign_id: { type: "string", description: "meta_campaign_id" },
        }, ["campaign_id"]),
        toolDef("get_performance_trend", "Time-series de campanha por dia.", {
          campaign_id: { type: "string", description: "meta_campaign_id" },
          days: { type: "number", description: "Janela em dias (default: 14, max: 30)" },
        }, ["campaign_id"]),
        toolDef("get_adset_performance", "Performance por conjunto de anúncios.", {
          ad_account_id: { type: "string" },
          campaign_id: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "PAUSED", "ALL"] },
        }),
        toolDef("get_ad_performance", "Performance por anúncio individual com criativos e métricas reais.", {
          ad_account_id: { type: "string" },
          campaign_id: { type: "string" },
          adset_id: { type: "string" },
        }),
      ];

    case "targeting":
      return [
        toolDef("get_meta_adsets", "Lista conjuntos de anúncios com status, orçamento, segmentação e pixel.", {
          ad_account_id: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "PAUSED", "DELETED"] },
          campaign_id: { type: "string" },
          live: { type: "boolean", description: "Se true, busca TODOS da API Meta com targeting completo" },
        }),
        toolDef("get_adset_targeting", "Busca targeting completo de adsets direto da Meta API.", {
          adset_ids: { type: "array", items: { type: "string" }, description: "Lista de IDs (máx 20)" },
          ad_account_id: { type: "string" },
        }, ["adset_ids"]),
        toolDef("get_audiences", "Lista públicos/audiências configurados.", {
          channel: { type: "string", enum: ["meta", "google"] },
        }),
      ];

    case "campaigns_list":
      return [
        toolDef("get_campaign_performance", "Busca campanhas com métricas. DEFAULT: date_preset='maximum'.", {
          ad_account_id: { type: "string" },
          status_filter: { type: "string", enum: ["ACTIVE", "PAUSED", "ALL"] },
          date_preset: { type: "string", enum: ["maximum", "last_7d", "last_14d", "last_30d"] },
        }),
        toolDef("get_meta_adsets", "Lista conjuntos de anúncios.", {
          ad_account_id: { type: "string" },
          status: { type: "string", enum: ["ACTIVE", "PAUSED", "DELETED"] },
          campaign_id: { type: "string" },
        }),
        toolDef("get_meta_ads", "Lista anúncios Meta com criativos.", {
          ad_account_id: { type: "string" },
        }),
      ];

    case "store_context":
      return [
        toolDef("get_store_context", "Contexto completo do negócio.", {}),
        toolDef("get_products", "Busca produtos do catálogo.", {
          search: { type: "string" },
          limit: { type: "number" },
          status: { type: "string", enum: ["active", "draft", "archived"] },
        }),
        toolDef("get_tracking_health", "Saúde do pixel/rastreamento.", {}),
      ];

    case "autopilot":
      return [
        toolDef("get_autopilot_config", "Configurações da IA de Tráfego.", { ad_account_id: { type: "string" } }),
        toolDef("get_autopilot_actions", "Ações executadas/agendadas pela IA.", {
          status: { type: "string", enum: ["scheduled", "executed", "failed", "pending_approval"] },
          limit: { type: "number" },
        }),
        toolDef("get_autopilot_insights", "Diagnósticos e insights.", { status: { type: "string", enum: ["open", "resolved"] } }),
        toolDef("get_autopilot_sessions", "Histórico de execuções.", { limit: { type: "number" } }),
        toolDef("get_strategic_plan", "Plano estratégico mais recente.", {
          status: { type: "string", enum: ["pending_approval", "approved", "rejected", "superseded", "executed"] },
        }),
        toolDef("get_experiments", "Testes A/B.", { status: { type: "string", enum: ["draft", "running", "completed", "cancelled"] } }),
      ];

    // STRATEGIC: AI gets read tools + context tools to gather info, plus the strategic plan creation tool
    case "strategic":
      return [
        toolDef("get_campaign_performance", "Ver campanhas existentes para base de diagnóstico.", {
          status_filter: { type: "string", enum: ["ACTIVE", "PAUSED", "ALL"] },
          date_preset: { type: "string", enum: ["maximum", "last_7d", "last_14d", "last_30d"] },
        }),
        toolDef("get_store_context", "Contexto do negócio (nicho, público, produtos).", {}),
        toolDef("get_products", "Busca produtos para selecionar para campanha.", { search: { type: "string" }, limit: { type: "number" } }),
        toolDef("get_product_images", "Busca imagens de produto.", { product_id: { type: "string" }, product_name: { type: "string" } }, ["product_id"]),
        toolDef("get_autopilot_insights", "Diagnósticos e insights recentes.", { status: { type: "string", enum: ["open", "resolved"] } }),
        toolDef("get_tracking_health", "Saúde do rastreamento.", {}),
        toolDef("get_audiences", "Públicos existentes para referência.", { channel: { type: "string", enum: ["meta", "google"] } }),
        toolDef("submit_strategic_proposal", "Submete uma proposta estratégica para aprovação do lojista. A proposta será renderizada como cards visuais de aprovação. SEMPRE use esta ferramenta quando tiver uma proposta pronta.", {
          diagnosis: { type: "string", description: "Diagnóstico situacional completo (mínimo 300 palavras)" },
          planned_actions: {
            type: "array",
            description: "Lista de ações propostas (campanhas, ajustes, criativos)",
            items: {
              type: "object",
              properties: {
                action_type: { type: "string", enum: ["create_campaign", "adjust_budget", "pause_campaign", "activate_campaign", "create_audience", "create_creative", "restructure_funnel", "create_test"] },
                campaign_name: { type: "string", description: "Nome descritivo da campanha/ação" },
                objective: { type: "string", description: "Objetivo (ex: OUTCOME_SALES, OUTCOME_LEADS)" },
                funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test"], description: "Etapa do funil" },
                daily_budget_brl: { type: "number", description: "Orçamento diário em R$" },
                reasoning: { type: "string", description: "Racional estratégico desta ação" },
                expected_impact: { type: "string", description: "Impacto esperado" },
                confidence: { type: "string", enum: ["high", "medium", "low"] },
                adsets: {
                  type: "array",
                  description: "Conjuntos de anúncios planejados",
                  items: {
                    type: "object",
                    properties: {
                      adset_name: { type: "string" },
                      audience_type: { type: "string", enum: ["broad", "interest", "lookalike", "custom", "retargeting", "abo_test"] },
                      audience_description: { type: "string" },
                      budget_brl: { type: "number" },
                      ads_count: { type: "number" },
                    },
                    required: ["adset_name", "audience_type", "audience_description"],
                  },
                },
                product_name: { type: "string" },
                creative_direction: { type: "string", description: "Direção criativa para os anúncios" },
              },
              required: ["action_type", "campaign_name", "reasoning"],
            },
          },
          total_daily_budget_brl: { type: "number", description: "Orçamento diário total proposto" },
          strategy_summary: { type: "string", description: "Resumo executivo da estratégia (1-2 parágrafos)" },
          risks: { type: "array", items: { type: "string" }, description: "Riscos identificados" },
        }, ["diagnosis", "planned_actions", "strategy_summary"]),
      ];

    case "write_meta":
      return [
        toolDef("get_campaign_performance", "Ver campanhas antes de modificar.", {
          status_filter: { type: "string", enum: ["ACTIVE", "PAUSED", "ALL"] },
        }),
        toolDef("get_products", "Busca produtos.", { search: { type: "string" }, limit: { type: "number" } }),
        toolDef("get_product_images", "Busca imagens de um produto.", {
          product_id: { type: "string" }, product_name: { type: "string" },
        }, ["product_id"]),
        toolDef("create_meta_campaign", "Cria campanha COMPLETA no Meta Ads. Criada PAUSADA.", {
          product_name: { type: "string" }, campaign_name: { type: "string" },
          objective: { type: "string", enum: ["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"] },
          daily_budget_cents: { type: "number" }, targeting_description: { type: "string" },
          funnel_stage: { type: "string", enum: ["cold", "warm", "hot"] }, ad_account_id: { type: "string" },
        }, ["product_name"]),
        toolDef("toggle_entity_status", "Pausa ou reativa entidade Meta.", {
          entity_type: { type: "string", enum: ["campaign", "adset", "ad"] },
          entity_id: { type: "string" }, new_status: { type: "string", enum: ["ACTIVE", "PAUSED"] },
          ad_account_id: { type: "string" },
        }, ["entity_type", "entity_id", "new_status"]),
        toolDef("update_budget", "Altera orçamento diário.", {
          entity_type: { type: "string", enum: ["campaign", "adset"] },
          entity_id: { type: "string" }, new_daily_budget_cents: { type: "number" },
          ad_account_id: { type: "string" },
        }, ["entity_type", "entity_id", "new_daily_budget_cents"]),
        toolDef("duplicate_campaign", "Duplica campanha Meta.", {
          source_campaign_id: { type: "string" }, new_name: { type: "string" },
          new_daily_budget_cents: { type: "number" }, ad_account_id: { type: "string" },
        }, ["source_campaign_id"]),
        toolDef("update_adset_targeting", "Atualiza segmentação de adset.", {
          adset_id: { type: "string" }, age_min: { type: "number" }, age_max: { type: "number" },
          genders: { type: "array", items: { type: "number" } },
          geo_locations: { type: "object" },
          interests: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } } },
          ad_account_id: { type: "string" },
        }, ["adset_id"]),
        toolDef("create_custom_audience", "Cria público personalizado.", {
          name: { type: "string" }, description: { type: "string" },
          source: { type: "string", enum: ["customer_list", "website", "engagement"] },
          subtype: { type: "string", enum: ["CUSTOM", "WEBSITE", "ENGAGEMENT", "LOOKALIKE"] },
          retention_days: { type: "number" }, rule: { type: "object" }, ad_account_id: { type: "string" },
        }, ["name", "source"]),
        toolDef("create_lookalike_audience", "Cria público semelhante.", {
          source_audience_id: { type: "string" }, name: { type: "string" },
          country: { type: "string" }, ratio: { type: "number" }, ad_account_id: { type: "string" },
        }, ["source_audience_id"]),
        toolDef("generate_creative_image", "Gera IMAGENS de criativos via IA.", {
          product_name: { type: "string" }, channel: { type: "string", enum: ["meta", "google", "tiktok"] },
          campaign_objective: { type: "string", enum: ["sales", "leads", "traffic", "awareness"] },
          target_audience: { type: "string" }, style_preference: { type: "string", enum: ["promotional", "product_natural", "person_interacting"] },
          format: { type: "string", enum: ["1:1", "9:16", "16:9"] }, variations: { type: "number" },
          funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test", "leads"] },
        }, ["product_name"]),
        toolDef("persist_user_command", "Persiste comando/override do lojista.", {
          campaign_key: { type: "string" }, original_text: { type: "string" },
          parsed_intent: { type: "string" }, requested_changes: { type: "object" },
          detected_conflicts: { type: "array", items: { type: "string" } },
          requires_confirmation: { type: "boolean" }, ad_account_id: { type: "string" },
        }, ["campaign_key", "original_text", "parsed_intent", "requires_confirmation"]),
        toolDef("confirm_user_command", "Confirma comando pendente.", {
          campaign_key: { type: "string" },
        }, ["campaign_key"]),
      ];

    case "write_google":
      return [
        toolDef("get_google_campaigns", "Busca campanhas Google Ads.", {
          ad_account_id: { type: "string" }, status_filter: { type: "string", enum: ["ENABLED", "PAUSED", "ALL"] },
          days: { type: "number" },
        }),
        toolDef("create_google_campaign", "Cria campanha Google Ads.", {
          product_name: { type: "string" }, campaign_name: { type: "string" },
          campaign_type: { type: "string", enum: ["SEARCH", "PERFORMANCE_MAX", "SHOPPING", "DISPLAY"] },
          daily_budget_micros: { type: "number" }, bidding_strategy: { type: "string" },
          keywords: { type: "array", items: { type: "object" } }, headlines: { type: "array", items: { type: "string" } },
          descriptions: { type: "array", items: { type: "string" } }, final_url: { type: "string" },
          ad_account_id: { type: "string" }, funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test"] },
        }, ["product_name"]),
        toolDef("toggle_google_entity_status", "Pausa/reativa entidade Google.", {
          entity_type: { type: "string", enum: ["campaign", "adgroup", "ad", "keyword"] },
          entity_id: { type: "string" }, new_status: { type: "string", enum: ["ENABLED", "PAUSED"] },
          ad_account_id: { type: "string" },
        }, ["entity_type", "entity_id", "new_status", "ad_account_id"]),
        toolDef("update_google_budget", "Altera budget Google.", {
          campaign_id: { type: "string" }, new_budget_micros: { type: "number" }, ad_account_id: { type: "string" },
        }, ["campaign_id", "new_budget_micros", "ad_account_id"]),
        toolDef("get_google_adgroups", "Lista grupos de anúncios Google.", { ad_account_id: { type: "string" }, campaign_id: { type: "string" } }),
        toolDef("get_google_keywords", "Lista keywords Google.", { ad_account_id: { type: "string" }, adgroup_id: { type: "string" } }),
        toolDef("get_google_ads", "Lista anúncios Google.", { ad_account_id: { type: "string" }, adgroup_id: { type: "string" } }),
      ];

    case "write_tiktok":
      return [
        toolDef("get_tiktok_campaigns", "Busca campanhas TikTok.", { advertiser_id: { type: "string" }, days: { type: "number" } }),
        toolDef("create_tiktok_campaign", "Cria campanha TikTok.", {
          product_name: { type: "string" }, campaign_name: { type: "string" },
          objective_type: { type: "string", enum: ["WEB_CONVERSIONS", "PRODUCT_SALES", "TRAFFIC", "REACH"] },
          budget_cents: { type: "number" }, optimization_goal: { type: "string" },
          conversion_event: { type: "string" }, funnel_stage: { type: "string" },
          ad_account_id: { type: "string" },
        }, ["product_name", "budget_cents"]),
        toolDef("toggle_tiktok_entity_status", "Pausa/reativa TikTok.", {
          entity_type: { type: "string", enum: ["campaign", "adgroup", "ad"] },
          entity_id: { type: "string" }, new_status: { type: "string", enum: ["ENABLE", "DISABLE"] },
          advertiser_id: { type: "string" },
        }, ["entity_type", "entity_id", "new_status", "advertiser_id"]),
        toolDef("update_tiktok_budget", "Altera budget TikTok.", {
          entity_type: { type: "string", enum: ["campaign", "adgroup"] },
          entity_id: { type: "string" }, budget_cents: { type: "number" }, advertiser_id: { type: "string" },
        }, ["entity_type", "entity_id", "budget_cents", "advertiser_id"]),
      ];

    case "creative":
      return [
        toolDef("get_products", "Busca produtos.", { search: { type: "string" }, limit: { type: "number" } }),
        toolDef("get_product_images", "Busca imagens de produto.", { product_id: { type: "string" }, product_name: { type: "string" } }, ["product_id"]),
        toolDef("get_creative_assets", "Lista criativos existentes.", { status: { type: "string", enum: ["draft", "ready", "active", "rejected"] } }),
        toolDef("generate_creative_image", "Gera imagens via IA.", {
          product_name: { type: "string" }, format: { type: "string", enum: ["1:1", "9:16", "16:9"] },
          variations: { type: "number" }, funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test", "leads"] },
        }, ["product_name"]),
        toolDef("trigger_creative_generation", "Gera textos/copies.", {}),
        toolDef("search_drive_files", "Busca arquivos no Drive.", { query: { type: "string" }, file_type: { type: "string", enum: ["image", "video", "all"] } }, ["query"]),
      ];

    case "drive":
      return [
        toolDef("browse_drive", "Navega pastas do Drive.", { folder_id: { type: "string" }, file_type: { type: "string", enum: ["image", "video", "all"] } }),
        toolDef("search_drive_files", "Busca arquivos no Drive.", { query: { type: "string" }, file_type: { type: "string", enum: ["image", "video", "all"] }, limit: { type: "number" } }, ["query"]),
      ];

    case "general":
    default:
      return [
        toolDef("get_campaign_performance", "Ver campanhas.", { status_filter: { type: "string", enum: ["ACTIVE", "PAUSED", "ALL"] } }),
        toolDef("get_store_context", "Contexto do negócio.", {}),
        toolDef("get_products", "Ver catálogo.", { search: { type: "string" }, limit: { type: "number" } }),
        toolDef("get_autopilot_config", "Configurações da IA.", { ad_account_id: { type: "string" } }),
      ];
  }
}

function toolDef(name: string, description: string, properties: Record<string, any>, required: string[] = []): any {
  return {
    type: "function",
    function: {
      name,
      description,
      parameters: { type: "object", properties, required, additionalProperties: false },
    },
  };
}

// ======================================================================
// 3. FACTUAL ORCHESTRATOR — Pre-resolve data for factual queries
// ======================================================================

interface FactualContext {
  resolvedData: Record<string, any>;
  dataSource: string;
  steps: string[];
}

async function orchestrateFactualQuery(
  supabase: any,
  tenantId: string,
  intent: ClassifiedIntent,
  adAccountId?: string,
  sendProgress?: (label: string) => Promise<void>,
): Promise<FactualContext | null> {
  if (!intent.isFactual) return null;

  const ctx: FactualContext = { resolvedData: {}, dataSource: "cache", steps: [] };

  try {
    switch (intent.category) {
      case "performance":
        return await orchestratePerformance(supabase, tenantId, intent, adAccountId, sendProgress, ctx);
      case "targeting":
        return await orchestrateTargeting(supabase, tenantId, intent, adAccountId, sendProgress, ctx);
      case "campaigns_list":
        return await orchestrateCampaignsList(supabase, tenantId, intent, adAccountId, sendProgress, ctx);
      case "store_context":
        return await orchestrateStoreContext(supabase, tenantId, sendProgress, ctx);
      case "autopilot":
        return null; // Let AI handle with tools
      default:
        return null;
    }
  } catch (err) {
    console.error(`[ads-chat-v2][${VERSION}] Orchestration error:`, err);
    return null;
  }
}

async function orchestratePerformance(
  supabase: any, tenantId: string, intent: ClassifiedIntent,
  adAccountId: string | undefined, sendProgress: any, ctx: FactualContext,
): Promise<FactualContext> {
  await sendProgress?.("Verificando conexão Meta");
  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token, metadata")
    .eq("tenant_id", tenantId).eq("marketplace", "meta").eq("is_active", true).maybeSingle();

  if (!conn?.access_token) {
    await sendProgress?.("Buscando campanhas no cache");
    const { data: campaigns } = await supabase
      .from("meta_ad_campaigns")
      .select("meta_campaign_id, name, status, objective, daily_budget_cents, ad_account_id")
      .eq("tenant_id", tenantId).order("status", { ascending: true }).limit(500);
    ctx.resolvedData.campaigns = campaigns || [];
    ctx.dataSource = "cache";
    ctx.steps.push("campaigns_from_cache");
    return ctx;
  }

  const accounts = adAccountId ? [adAccountId] : (conn.metadata?.assets?.ad_accounts || []).map((a: any) => a.id || a);
  if (accounts.length === 0) {
    ctx.resolvedData.error = "Nenhuma conta de anúncios encontrada";
    return ctx;
  }

  await sendProgress?.("Buscando campanhas na Meta API");
  const allCampaigns: any[] = [];
  for (const accountId of accounts.slice(0, 3)) {
    const cleanId = String(accountId).replace("act_", "");
    try {
      let url: string | null = `https://graph.facebook.com/${GRAPH_VERSION}/act_${cleanId}/campaigns?fields=id,name,status,effective_status,objective,daily_budget,lifetime_budget&limit=500&access_token=${conn.access_token}`;
      while (url) {
        const response = await fetch(url);
        if (!response.ok) break;
        const result = await response.json();
        for (const camp of (result.data || [])) {
          allCampaigns.push({
            id: camp.id, name: camp.name,
            status: camp.effective_status || camp.status,
            objective: camp.objective,
            daily_budget_cents: camp.daily_budget ? Math.round(parseFloat(camp.daily_budget)) : 0,
            ad_account_id: `act_${cleanId}`,
          });
        }
        url = result.paging?.next || null;
      }
    } catch (err) {
      console.error(`[ads-chat-v2][${VERSION}] Live campaign fetch error:`, err);
    }
  }
  ctx.steps.push(`campaigns_live:${allCampaigns.length}`);
  await sendProgress?.(`${allCampaigns.length} campanhas encontradas`);

  const useLifetime = !intent.entities.period || intent.entities.period === "maximum";
  const presetDays: Record<string, number> = { last_7d: 7, last_14d: 14, last_30d: 30, last_90d: 90 };
  const sinceDate = useLifetime ? undefined : new Date(Date.now() - (presetDays[intent.entities.period || ""] || 30) * 86400000).toISOString().split("T")[0];

  await sendProgress?.("Coletando métricas de performance");
  const allInsights: any[] = [];
  const purchaseTypes = ["omni_purchase", "purchase", "offsite_conversion.fb_pixel_purchase", "offsite_conversion.custom.purchase", "onsite_conversion.purchase", "onsite_web_purchase", "onsite_web_app_purchase", "web_in_store_purchase"];

  for (const accountId of accounts.slice(0, 3)) {
    const cleanId = String(accountId).replace("act_", "");
    const timeParam = useLifetime ? `date_preset=maximum` : `time_range={"since":"${sinceDate}","until":"${new Date().toISOString().split("T")[0]}"}`;
    let url: string | null = `https://graph.facebook.com/${GRAPH_VERSION}/act_${cleanId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,actions,action_values&level=campaign&${timeParam}&limit=500&access_token=${conn.access_token}`;

    let pageCount = 0;
    while (url && pageCount < 15) {
      pageCount++;
      try {
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 429) {
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          break;
        }
        const result = await response.json();
        for (const row of (result.data || [])) {
          let conversions = 0, convValue = 0;
          for (const a of (row.actions || [])) {
            if (purchaseTypes.includes(a.action_type)) {
              const val = parseInt(a.value || "0");
              if (val > conversions) conversions = val;
            }
          }
          for (const a of (row.action_values || [])) {
            if (purchaseTypes.includes(a.action_type)) {
              const val = parseFloat(a.value || "0");
              if (val > convValue) convValue = val;
            }
          }
          allInsights.push({
            meta_campaign_id: row.campaign_id,
            campaign_name: row.campaign_name,
            spend_cents: Math.round(parseFloat(row.spend || "0") * 100),
            impressions: parseInt(row.impressions || "0"),
            clicks: parseInt(row.clicks || "0"),
            conversions, conversion_value_cents: Math.round(convValue * 100),
          });
        }
        url = result.paging?.next || null;
        if (url) await new Promise(r => setTimeout(r, 2000));
      } catch { break; }
    }
  }
  ctx.steps.push(`insights_live:${allInsights.length}`);
  await sendProgress?.(`${allInsights.length} registros de métricas coletados`);

  await sendProgress?.("Consolidando resultado");
  const campMap: Record<string, any> = {};
  for (const c of allCampaigns) {
    campMap[c.id] = { ...c, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
  }
  for (const i of allInsights) {
    if (!campMap[i.meta_campaign_id]) {
      campMap[i.meta_campaign_id] = {
        id: i.meta_campaign_id, name: i.campaign_name || `Campaign ${i.meta_campaign_id}`,
        status: "UNKNOWN", objective: null, daily_budget_cents: 0,
        spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0,
      };
    }
    const c = campMap[i.meta_campaign_id];
    if (i.campaign_name && (c.name === `Campaign ${i.meta_campaign_id}` || !c.name)) c.name = i.campaign_name;
    c.spend += (i.spend_cents || 0) / 100;
    c.impressions += i.impressions || 0;
    c.clicks += i.clicks || 0;
    c.conversions += i.conversions || 0;
    c.revenue += (i.conversion_value_cents || 0) / 100;
  }

  const all = Object.values(campMap);
  const active = all.filter((c: any) => c.status === "ACTIVE");
  const paused = all.filter((c: any) => c.status === "PAUSED");
  const formatCamp = (c: any) => ({
    ...c,
    spend: `R$ ${c.spend.toFixed(2)}`, revenue: `R$ ${c.revenue.toFixed(2)}`,
    roas: c.spend > 0 ? (c.revenue / c.spend).toFixed(2) : "N/A",
    cpa: c.conversions > 0 ? `R$ ${(c.spend / c.conversions).toFixed(2)}` : "N/A",
    daily_budget: `R$ ${((c.daily_budget_cents || 0) / 100).toFixed(2)}`,
  });

  ctx.resolvedData = {
    summary: {
      total_campaigns: all.length, active: active.length, paused: paused.length,
      period: useLifetime ? "lifetime (desde o início)" : `últimos ${presetDays[intent.entities.period || ""] || 30} dias`,
      data_source: "meta_api_live",
      total_spend: `R$ ${all.reduce((s: number, c: any) => s + c.spend, 0).toFixed(2)}`,
      total_revenue: `R$ ${all.reduce((s: number, c: any) => s + c.revenue, 0).toFixed(2)}`,
      total_conversions: all.reduce((s: number, c: any) => s + c.conversions, 0),
    },
    active_campaigns: active.map(formatCamp),
    paused_campaigns: paused.map(formatCamp),
  };
  ctx.dataSource = "live";
  return ctx;
}

async function orchestrateTargeting(
  supabase: any, tenantId: string, intent: ClassifiedIntent,
  adAccountId: string | undefined, sendProgress: any, ctx: FactualContext,
): Promise<FactualContext> {
  await sendProgress?.("Buscando conjuntos no cache");
  const query = supabase.from("meta_ad_adsets")
    .select("meta_adset_id, name, status, meta_campaign_id, daily_budget_cents, targeting, optimization_goal")
    .eq("tenant_id", tenantId).order("status", { ascending: true }).limit(100);
  if (adAccountId) query.eq("ad_account_id", adAccountId);
  const { data: adsets } = await query;

  if (!adsets || adsets.length === 0) {
    ctx.resolvedData = { total: 0, adsets: [], note: "Nenhum conjunto encontrado no cache. Sincronize os dados primeiro." };
    ctx.dataSource = "cache";
    return ctx;
  }

  ctx.steps.push(`adsets_cache:${adsets.length}`);
  await sendProgress?.(`${adsets.length} conjuntos encontrados`);

  const activeAdsets = adsets.filter((a: any) => a.status === "ACTIVE");
  const adsetsToFetch = activeAdsets.length > 0 ? activeAdsets : adsets.slice(0, 20);
  const adsetIds = adsetsToFetch.map((a: any) => a.meta_adset_id).slice(0, 20);

  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token")
    .eq("tenant_id", tenantId).eq("marketplace", "meta").eq("is_active", true).maybeSingle();

  if (conn?.access_token && adsetIds.length > 0) {
    await sendProgress?.(`Buscando targeting de ${adsetIds.length} conjuntos na Meta API`);
    const targetingResults: any[] = [];
    let fetched = 0;

    for (const adsetId of adsetIds) {
      try {
        const url = `https://graph.facebook.com/${GRAPH_VERSION}/${adsetId}?fields=id,name,status,effective_status,targeting,campaign_id,optimization_goal,daily_budget,lifetime_budget&access_token=${conn.access_token}`;
        const response = await fetch(url);
        if (!response.ok) {
          if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get("Retry-After") || "5");
            await new Promise(r => setTimeout(r, retryAfter * 1000));
            const retryRes = await fetch(url);
            if (retryRes.ok) {
              const data = await retryRes.json();
              if (!data.error) targetingResults.push(data);
            }
          }
          continue;
        }
        const data = await response.json();
        if (!data.error) {
          targetingResults.push(data);
          supabase.from("meta_ad_adsets").upsert({
            tenant_id: tenantId, meta_adset_id: data.id,
            meta_campaign_id: data.campaign_id, name: data.name,
            status: data.effective_status || data.status,
            targeting: data.targeting, optimization_goal: data.optimization_goal,
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,meta_adset_id" }).then(() => {}).catch(() => {});
        }
        fetched++;
        if (fetched % 5 === 0) {
          await sendProgress?.(`Carregando targeting ${fetched}/${adsetIds.length}`);
        }
      } catch { /* continue */ }
    }
    ctx.steps.push(`targeting_live:${targetingResults.length}`);
    ctx.dataSource = "hybrid";

    ctx.resolvedData = {
      total: adsets.length,
      active: activeAdsets.length,
      fetched_targeting: targetingResults.length,
      adsets: targetingResults.map((a: any) => ({
        adset_id: a.id, name: a.name,
        status: a.effective_status || a.status,
        campaign_id: a.campaign_id,
        optimization_goal: a.optimization_goal,
        targeting: formatTargetingDetails(a.targeting || {}),
      })),
    };
  } else {
    ctx.resolvedData = {
      total: adsets.length,
      active: activeAdsets.length,
      data_source: "cache",
      adsets: adsets.map((a: any) => ({
        adset_id: a.meta_adset_id, name: a.name, status: a.status,
        campaign_id: a.meta_campaign_id,
        targeting: a.targeting ? formatTargetingDetails(a.targeting) : { note: "Targeting não disponível no cache" },
      })),
    };
    ctx.dataSource = "cache";
  }

  return ctx;
}

async function orchestrateCampaignsList(
  supabase: any, tenantId: string, intent: ClassifiedIntent,
  adAccountId: string | undefined, sendProgress: any, ctx: FactualContext,
): Promise<FactualContext> {
  return await orchestratePerformance(supabase, tenantId, intent, adAccountId, sendProgress, ctx);
}

async function orchestrateStoreContext(
  supabase: any, tenantId: string, sendProgress: any, ctx: FactualContext,
): Promise<FactualContext> {
  await sendProgress?.("Carregando contexto da loja");
  const [settingsRes, productsRes, categoriesRes] = await Promise.all([
    supabase.from("store_settings").select("store_name, store_description, contact_email").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("products").select("id, name, price, cost_price, status").eq("tenant_id", tenantId).eq("status", "active").limit(20),
    supabase.from("categories").select("name").eq("tenant_id", tenantId).eq("is_active", true).limit(20),
  ]);

  ctx.resolvedData = {
    store: settingsRes.data || {},
    products: (productsRes.data || []).map((p: any) => ({
      name: p.name, price: `R$ ${(p.price || 0).toFixed(2)}`,
      margin: p.cost_price && p.price ? `${(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%` : null,
    })),
    categories: (categoriesRes.data || []).map((c: any) => c.name),
  };
  ctx.dataSource = "cache";
  return ctx;
}

function formatTargetingDetails(targeting: any) {
  if (!targeting) return null;
  const result: any = {};
  if (targeting.custom_audiences?.length) result.custom_audiences = targeting.custom_audiences.map((a: any) => ({ id: a.id, name: a.name }));
  if (targeting.excluded_custom_audiences?.length) result.excluded_audiences = targeting.excluded_custom_audiences.map((a: any) => ({ id: a.id, name: a.name }));
  if (targeting.geo_locations) {
    const geo = targeting.geo_locations;
    result.geo = {};
    if (geo.countries?.length) result.geo.countries = geo.countries;
    if (geo.regions?.length) result.geo.regions = geo.regions.map((r: any) => r.name || r.key);
    if (geo.cities?.length) result.geo.cities = geo.cities.map((c: any) => `${c.name} (${c.radius || 0}km)`);
  }
  if (targeting.age_min || targeting.age_max) result.age = `${targeting.age_min || 18}-${targeting.age_max || 65}+`;
  if (targeting.genders?.length) result.gender = targeting.genders.map((g: number) => g === 1 ? "Masculino" : g === 2 ? "Feminino" : "Todos");
  if (targeting.flexible_spec?.length) {
    const interests: string[] = [], behaviors: string[] = [];
    for (const spec of targeting.flexible_spec) {
      if (spec.interests) interests.push(...spec.interests.map((i: any) => i.name));
      if (spec.behaviors) behaviors.push(...spec.behaviors.map((b: any) => b.name));
    }
    if (interests.length) result.interests = interests;
    if (behaviors.length) result.behaviors = behaviors;
  }
  if (targeting.publisher_platforms?.length) result.placements = targeting.publisher_platforms;
  return Object.keys(result).length > 0 ? result : { note: "Targeting aberto (Advantage+/sem restrições)" };
}

// ======================================================================
// 4. SYSTEM PROMPTS — Separate prompts per mode
// ======================================================================

function buildFactualSystemPrompt(storeName: string, factualData: any, dataSource: string): string {
  return `Você é o Gestor de Tráfego IA da loja "${storeName}".

## DADOS PRÉ-RESOLVIDOS (fonte: ${dataSource})
Os dados abaixo foram coletados pelo sistema ANTES desta chamada. Eles são REAIS e VERIFICADOS.
Apresente-os ao lojista de forma clara, organizada e objetiva. NÃO invente dados adicionais.

\`\`\`json
${JSON.stringify(factualData, null, 2).substring(0, 15000)}
\`\`\`

## REGRAS
- Apresente os dados de forma clara com Markdown
- Use nomes EXATOS das campanhas — nunca abrevie ou modifique
- Calcule e destaque métricas-chave (ROAS, CPA, CTR)
- Separe campanhas ativas e pausadas
- Se os dados indicam limitações (fonte: cache, dados parciais), informe
- Fale em Português BR, como gestor de tráfego profissional
- NUNCA mostre IDs técnicos — use nomes
- NUNCA invente dados que não estão no JSON acima
- Se algo está faltando nos dados, diga "esta informação não está disponível neste nível de consulta — posso detalhar por conjunto de anúncios se quiser"
- Sugira próximos passos baseados nos dados
- NUNCA afirme que "o pixel está com problema" ou que "dados estão comprometidos" a menos que os dados acima contenham explicitamente essa informação
- Memórias persistentes são contexto auxiliar, NÃO são fatos atuais verificados — nunca as apresente como verdade absoluta`;
}

function buildStrategicSystemPrompt(storeName: string, context: any): string {
  const hybridInstructions = context?.isHybrid ? `
## MODO HÍBRIDO ATIVO
O lojista pediu tanto consulta de dados quanto planejamento/proposta na mesma mensagem.
FLUXO OBRIGATÓRIO:
1. PRIMEIRO: Use as ferramentas de leitura para coletar os dados solicitados (ex: listar campanhas, performance, etc.)
2. SEGUNDO: Apresente os dados de forma clara e organizada para o lojista
3. TERCEIRO: Use esses dados como base para montar a proposta estratégica
4. QUARTO: Chame \`submit_strategic_proposal\` com a proposta completa

NÃO pule a etapa de apresentação dos dados. O lojista quer VER os dados E receber uma proposta.
` : '';

  return `Você é o Gestor de Tráfego IA da loja "${storeName}".
Você está no MODO ESTRATÉGICO: o lojista quer que você analise o contexto, monte ou proponha uma estratégia.
${hybridInstructions}
## FLUXO OBRIGATÓRIO
1. Use as ferramentas de leitura (get_campaign_performance, get_store_context, get_products, etc.) para coletar contexto real
2. Analise o cenário atual com base nos dados coletados
3. Monte uma proposta estruturada
4. OBRIGATORIAMENTE chame a ferramenta \`submit_strategic_proposal\` com a proposta completa

## REGRAS ESTRATÉGICAS INVIOLÁVEIS
- **Campanhas de Teste (ABO):** 1 AdSet = 1 Anúncio. Orçamento no AdSet. Mínimo 2 variações.
- **Campanhas de Venda (TOF):** Mínimo 2 AdSets com públicos distintos (Broad + LAL/Interesses/Custom).
- **Remarketing (BOF):** Criativos OBRIGATORIAMENTE diferentes de TOF. AdSets por temperatura.
- **Multiplicidade:** 2-4 variações de criativos/textos por proposta.

## REGRA: NUNCA EXECUTAR DIRETO
- Você NÃO pode criar campanhas diretamente neste modo
- Você DEVE usar \`submit_strategic_proposal\` para gerar um artefato de aprovação
- O lojista vai revisar, ajustar e aprovar antes de qualquer execução
- Toda proposta entra como "pending_approval" no sistema

## COMUNICAÇÃO
- Fale em Português BR
- Use Markdown
- Seja proativo e estratégico
- Explique o racional antes de propor
- Calcule distribuição de verba por etapa de funil

${context?.storeUrl ? `**URL da loja**: ${context.storeUrl}` : ""}`;
}

function buildConversationalSystemPrompt(storeName: string, context: any): string {
  return `Você é o Gestor de Tráfego IA da loja "${storeName}".

## REGRA SUPREMA: HONESTIDADE ABSOLUTA
- Nunca invente dados. Se não sabe, diga.
- Se uma ferramenta retorna erro, informe o erro real.
- NUNCA finja que está processando algo que não está.
- NUNCA afirme que "o pixel está com problema" ou que "dados estão comprometidos" a menos que uma ferramenta retorne essa informação explicitamente.
- Memórias persistentes são contexto auxiliar, NÃO fatos verificados — nunca as apresente como verdade absoluta sobre o estado atual do sistema.
- Se o lojista pede dados de nível inferior (conjuntos, anúncios), USE as ferramentas disponíveis (get_adset_performance, get_ad_performance). NUNCA diga que não tem acesso.

## REGRA: DRILL-DOWN = ANÁLISE FACTUAL COM TOOLS
Quando o lojista pede detalhamento de conjuntos de anúncios ou anúncios individuais:
- Isso é uma ANÁLISE FACTUAL, não conversa livre.
- Você DEVE chamar as ferramentas de leitura (get_campaign_details, get_adset_performance, get_ad_performance, get_meta_adsets) para obter os dados reais.
- NUNCA responda com opinião ou texto genérico sem antes consultar os dados via tools.
- Apresente os dados de forma estruturada (tabela/lista) com métricas reais.
- Só depois dos dados apresentados, adicione análise e sugestões baseadas nos números.
- Se o turno anterior listou campanhas, use os IDs/nomes dessas campanhas como contexto para buscar adsets — NÃO peça ao lojista repetir informação já fornecida.

## REGRA: EXECUTE, NÃO PEÇA PERMISSÃO
- NUNCA termine resposta com "Posso seguir?" ou "Quer que eu faça?"
- EXECUTE PRIMEIRO, REPORTE DEPOIS.
- Única exceção: override de regras de segurança.

## REGRA: SEQUÊNCIA PARA CAMPANHAS
- NUNCA chame generate_creative_image e create_meta_campaign na mesma rodada.
- Máximo 2 campanhas por rodada.

## REGRA: LIMITE DE AÇÕES DIRETAS
- Se o lojista pedir mais de 2 campanhas, mais de 3 adsets, ou ações para múltiplos produtos ao mesmo tempo, NÃO execute direto.
- Nesse caso, informe que ações em lote exigem uma proposta estruturada e peça para ele solicitar uma estratégia.
- Ações unitárias (1 campanha, 1 pausa, 1 ajuste de budget) podem executar normalmente.

## COMUNICAÇÃO
- Fale em Português BR
- Use Markdown
- Nunca exponha IDs técnicos, nomes de ferramentas ou termos internos
- Seja proativo: sugira ações

${context?.storeUrl ? `**URL da loja**: ${context.storeUrl}` : ""}
${context?.products ? `\n**Produtos**: ${context.products.map((p: any) => p.name).join(", ")}` : ""}`;
}

// ======================================================================
// 5. STRATEGIC PROPOSAL HANDLER — Converge to approval pipeline
// ======================================================================

async function handleStrategicProposal(
  supabase: any,
  tenantId: string,
  args: any,
  chatSessionId: string,
  strategyRunId: string,
  channel: string,
): Promise<string> {
  try {
    const { diagnosis, planned_actions, total_daily_budget_brl, strategy_summary, risks } = args;

    if (!planned_actions || !Array.isArray(planned_actions) || planned_actions.length === 0) {
      return JSON.stringify({ error: "Proposta vazia. Inclua pelo menos uma ação planejada." });
    }

    // Create a strategic plan action in the approval pipeline (same as Strategist motor)
    const planAction = {
      tenant_id: tenantId,
      session_id: chatSessionId,
      channel: channel || "meta",
      action_type: "strategic_plan",
      status: "pending_approval",
      reasoning: diagnosis?.substring(0, 5000) || "Proposta gerada via Chat Estratégico",
      expected_impact: strategy_summary?.substring(0, 2000) || "",
      confidence: "medium",
      action_data: {
        source: "ads_chat_v2_strategic",
        strategy_run_id: strategyRunId,
        diagnosis: diagnosis?.substring(0, 10000),
        planned_actions: planned_actions.map((action: any) => ({
          action_type: action.action_type,
          campaign_name: action.campaign_name,
          objective: action.objective,
          funnel_stage: action.funnel_stage,
          daily_budget_brl: action.daily_budget_brl,
          reasoning: action.reasoning,
          expected_impact: action.expected_impact,
          confidence: action.confidence || "medium",
          product_name: action.product_name,
          creative_direction: action.creative_direction,
          adsets: (action.adsets || []).map((adset: any) => ({
            adset_name: adset.adset_name,
            audience_type: adset.audience_type,
            audience_description: adset.audience_description,
            budget_brl: adset.budget_brl,
            ads_count: adset.ads_count || 1,
          })),
        })),
        total_daily_budget_brl: total_daily_budget_brl,
        risks: risks || [],
      },
    };

    const { data: inserted, error: insertErr } = await supabase
      .from("ads_autopilot_actions")
      .insert(planAction as any)
      .select("id")
      .single();

    if (insertErr) {
      console.error(`[ads-chat-v2][${VERSION}] Failed to insert strategic proposal:`, insertErr);
      return JSON.stringify({ error: `Erro ao salvar proposta: ${insertErr.message}` });
    }

    // Update session with planned actions count
    await supabase.from("ads_autopilot_sessions")
      .update({ actions_planned: planned_actions.length })
      .eq("id", chatSessionId);

    return JSON.stringify({
      success: true,
      proposal_id: inserted.id,
      status: "pending_approval",
      actions_count: planned_actions.length,
      total_daily_budget_brl,
      message: `Proposta estratégica criada com ${planned_actions.length} ações. O lojista pode revisá-la e aprová-la na aba de aprovações.`,
    });
  } catch (err: any) {
    console.error(`[ads-chat-v2][${VERSION}] Strategic proposal error:`, err);
    return JSON.stringify({ error: err.message || "Erro ao processar proposta estratégica" });
  }
}

// ======================================================================
// 6. TOOL EXECUTOR — Delegates to ads-chat edge function or executes directly
// ======================================================================

async function executeTool(supabase: any, tenantId: string, toolName: string, args: any, chatSessionId: string, strategyRunId: string, channel?: string): Promise<string> {
  // Handle strategic proposal tool locally
  if (toolName === "submit_strategic_proposal") {
    return await handleStrategicProposal(supabase, tenantId, args, chatSessionId, strategyRunId, channel || "meta");
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ads-chat`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        _internal_tool_call: true,
        tenant_id: tenantId,
        tool_name: toolName,
        tool_args: args,
        session_id: chatSessionId,
        strategy_run_id: strategyRunId,
      }),
    });

    if (!response.ok) {
      return await executeToolDirect(supabase, tenantId, toolName, args);
    }

    return await response.text();
  } catch {
    return await executeToolDirect(supabase, tenantId, toolName, args);
  }
}

async function executeToolDirect(supabase: any, tenantId: string, toolName: string, args: any): Promise<string> {
  try {
    switch (toolName) {
      case "get_autopilot_config": {
        const { data: globalConfigs } = await supabase.from("ads_autopilot_configs").select("*").eq("tenant_id", tenantId);
        const accQuery = supabase.from("ads_autopilot_account_configs").select("*").eq("tenant_id", tenantId);
        if (args.ad_account_id) accQuery.eq("ad_account_id", args.ad_account_id);
        const { data: accountConfigs } = await accQuery;
        return JSON.stringify({ global: globalConfigs || [], accounts: accountConfigs || [] });
      }
      case "get_autopilot_actions": {
        const q = supabase.from("ads_autopilot_actions").select("id, action_type, channel, status, reasoning, confidence, error_message, executed_at, created_at, action_data").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(args.limit || 15);
        if (args.status) q.eq("status", args.status);
        const { data } = await q;
        return JSON.stringify({ total: data?.length || 0, actions: data || [] });
      }
      case "get_autopilot_insights": {
        const q = supabase.from("ads_autopilot_insights").select("id, title, body, category, priority, sentiment, status, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(15);
        if (args.status) q.eq("status", args.status);
        const { data } = await q;
        return JSON.stringify({ total: data?.length || 0, insights: data || [] });
      }
      case "get_autopilot_sessions": {
        const { data } = await supabase.from("ads_autopilot_sessions").select("id, channel, trigger_type, motor_type, actions_planned, actions_executed, actions_rejected, cost_credits, duration_ms, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(args.limit || 10);
        return JSON.stringify({ total: data?.length || 0, sessions: data || [] });
      }
      case "get_strategic_plan": {
        let q = supabase.from("ads_autopilot_actions").select("*").eq("tenant_id", tenantId).eq("action_type", "strategic_plan").order("created_at", { ascending: false }).limit(1);
        if (args.status) q = q.eq("status", args.status);
        const { data } = await q;
        if (!data?.length) return JSON.stringify({ found: false, message: "Nenhum plano estratégico encontrado" });
        return JSON.stringify({ found: true, plan: data[0] });
      }
      case "get_experiments": {
        const q = supabase.from("ads_autopilot_experiments").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(15);
        if (args.status) q.eq("status", args.status);
        const { data } = await q;
        return JSON.stringify({ total: data?.length || 0, experiments: data || [] });
      }
      case "get_store_context": {
        const { data: settings } = await supabase.from("store_settings").select("store_name, store_description, contact_email").eq("tenant_id", tenantId).maybeSingle();
        return JSON.stringify({ store: settings || {} });
      }
      case "get_products": {
        const limit = Math.min(args.limit || 20, 50);
        const q = supabase.from("products").select("id, name, price, cost_price, status, sku, stock_quantity").eq("tenant_id", tenantId).eq("status", args.status || "active").order("created_at", { ascending: false }).limit(limit);
        if (args.search) q.ilike("name", `%${args.search}%`);
        const { data } = await q;
        return JSON.stringify({ total: data?.length || 0, products: data || [] });
      }
      case "get_tracking_health": {
        const { data } = await supabase.from("ads_tracking_health").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10);
        return JSON.stringify({ total: data?.length || 0, tracking: data || [] });
      }
      case "get_creative_assets": {
        const q = supabase.from("ads_creative_assets").select("id, headline, copy_text, format, status, angle, channel, asset_url, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20);
        if (args.status) q.eq("status", args.status);
        const { data } = await q;
        return JSON.stringify({ total: data?.length || 0, assets: data || [] });
      }
      case "get_audiences": {
        const { data } = await supabase.from("meta_ad_audiences").select("id, name, audience_type, subtype, approximate_count").eq("tenant_id", tenantId).limit(50);
        return JSON.stringify({ meta: data || [] });
      }
      case "get_meta_ads": {
        const q = supabase.from("meta_ad_ads").select("meta_ad_id, name, status, effective_status, meta_adset_id, meta_campaign_id, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100);
        if (args.ad_account_id) q.eq("ad_account_id", args.ad_account_id);
        const { data } = await q;
        return JSON.stringify({ total: data?.length || 0, ads: data || [] });
      }
      case "get_adset_performance": {
        const query = supabase
          .from("meta_ad_adsets")
          .select("meta_adset_id, meta_campaign_id, name, status, daily_budget_cents, lifetime_budget_cents, targeting, pixel_id, optimization_goal, bid_strategy, ad_account_id, created_at")
          .eq("tenant_id", tenantId)
          .order("status", { ascending: true });
        if (args.ad_account_id) query.eq("ad_account_id", args.ad_account_id);
        if (args.campaign_id) query.eq("meta_campaign_id", args.campaign_id);
        if (args.status && args.status !== "ALL") query.eq("status", args.status);
        const { data: adsets, error: adsErr } = await query.limit(100);
        if (adsErr) return JSON.stringify({ error: adsErr.message });

        // Get campaign names for context
        const campIds = [...new Set((adsets || []).map((a: any) => a.meta_campaign_id).filter(Boolean))];
        let campNames: Record<string, string> = {};
        if (campIds.length > 0) {
          const { data: camps } = await supabase
            .from("meta_ad_campaigns")
            .select("meta_campaign_id, name")
            .eq("tenant_id", tenantId)
            .in("meta_campaign_id", campIds);
          for (const c of (camps || [])) campNames[c.meta_campaign_id] = c.name;
        }

        const activeAdsets = (adsets || []).filter((a: any) => a.status === "ACTIVE");
        const pausedAdsets = (adsets || []).filter((a: any) => a.status === "PAUSED");

        return JSON.stringify({
          total: adsets?.length || 0,
          active: activeAdsets.length,
          paused: pausedAdsets.length,
          adsets: (adsets || []).slice(0, 50).map((a: any) => ({
            meta_adset_id: a.meta_adset_id, name: a.name, status: a.status,
            campaign_name: campNames[a.meta_campaign_id] || a.meta_campaign_id,
            daily_budget: a.daily_budget_cents ? `R$ ${(a.daily_budget_cents / 100).toFixed(2)}` : null,
            lifetime_budget: a.lifetime_budget_cents ? `R$ ${(a.lifetime_budget_cents / 100).toFixed(2)}` : null,
            has_pixel: !!a.pixel_id, optimization_goal: a.optimization_goal,
            bid_strategy: a.bid_strategy,
            targeting_summary: a.targeting ? JSON.stringify(a.targeting).substring(0, 200) : null,
          })),
        });
      }
      case "get_ad_performance": {
        const adQuery = supabase
          .from("meta_ad_ads")
          .select("meta_ad_id, name, status, effective_status, meta_adset_id, meta_campaign_id, ad_account_id, created_at")
          .eq("tenant_id", tenantId)
          .order("created_at", { ascending: false });
        if (args.ad_account_id) adQuery.eq("ad_account_id", args.ad_account_id);
        if (args.campaign_id) adQuery.eq("meta_campaign_id", args.campaign_id);
        if (args.adset_id) adQuery.eq("meta_adset_id", args.adset_id);
        const { data: ads, error: adErr } = await adQuery.limit(100);
        if (adErr) return JSON.stringify({ error: adErr.message });

        // Creatives
        const adIds = (ads || []).map((a: any) => a.meta_ad_id).filter(Boolean);
        let creativeMap: Record<string, any> = {};
        if (adIds.length > 0) {
          const { data: cData } = await supabase
            .from("meta_ad_creatives")
            .select("meta_ad_id, name, title, body, image_url, thumbnail_url, call_to_action_type")
            .eq("tenant_id", tenantId)
            .in("meta_ad_id", adIds);
          for (const c of (cData || [])) creativeMap[c.meta_ad_id] = c;
        }

        const activeAds = (ads || []).filter((a: any) => a.status === "ACTIVE");

        return JSON.stringify({
          total: ads?.length || 0,
          active: activeAds.length,
          ads: (ads || []).slice(0, 50).map((a: any) => {
            const cr = creativeMap[a.meta_ad_id];
            return {
              meta_ad_id: a.meta_ad_id, name: a.name, status: a.status, effective_status: a.effective_status,
              adset_id: a.meta_adset_id, campaign_id: a.meta_campaign_id,
              creative: cr ? { title: cr.title, body: cr.body?.substring(0, 100), cta: cr.call_to_action_type, has_image: !!cr.image_url } : null,
            };
          }),
        });
      }
      default:
        return JSON.stringify({ error: `Ferramenta '${toolName}' não disponível no modo direto. Use o chat padrão.` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || "Erro ao executar ferramenta" });
  }
}

// ======================================================================
// 7. SSE PROGRESS LABELS
// ======================================================================

const TOOL_PROGRESS_LABELS: Record<string, string> = {
  get_campaign_performance: "Consultando campanhas",
  get_campaign_details: "Analisando campanha",
  get_performance_trend: "Buscando tendências",
  get_adset_performance: "Analisando conjuntos",
  get_ad_performance: "Analisando anúncios",
  get_tracking_health: "Verificando pixel",
  get_autopilot_config: "Lendo configurações",
  get_products: "Consultando catálogo",
  get_product_images: "Buscando imagens",
  get_store_context: "Carregando contexto",
  get_autopilot_actions: "Verificando ações",
  get_autopilot_insights: "Lendo diagnósticos",
  get_autopilot_sessions: "Verificando histórico",
  get_strategic_plan: "Lendo plano estratégico",
  get_creative_assets: "Buscando criativos",
  get_experiments: "Verificando testes",
  get_audiences: "Consultando públicos",
  get_meta_adsets: "Listando conjuntos",
  get_adset_targeting: "Analisando targeting",
  get_meta_ads: "Listando anúncios",
  create_meta_campaign: "Criando campanha Meta",
  create_google_campaign: "Criando campanha Google",
  create_tiktok_campaign: "Criando campanha TikTok",
  generate_creative_image: "Gerando arte",
  trigger_creative_generation: "Gerando textos",
  update_budget: "Ajustando orçamento",
  toggle_entity_status: "Alterando status",
  duplicate_campaign: "Duplicando campanha",
  create_custom_audience: "Criando público",
  create_lookalike_audience: "Criando público semelhante",
  browse_drive: "Explorando Drive",
  search_drive_files: "Buscando no Drive",
  submit_strategic_proposal: "Gerando proposta para aprovação",
};

// ======================================================================
// 8. MAIN HANDLER
// ======================================================================

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-chat-v2][${VERSION}] ${req.method} request received`);

  let body: any;
  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader || "" } } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    body = await req.json();
    const { conversation_id, message, tenant_id, scope, ad_account_id, channel, attachments } = body;

    if (!tenant_id || (!message && (!attachments || attachments.length === 0))) {
      return new Response(JSON.stringify({ error: "Missing tenant_id or message" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create or get conversation
    let convId = conversation_id;
    if (!convId) {
      const { data: conv, error: convErr } = await supabase.from("ads_chat_conversations").insert({
        tenant_id, scope: scope || "global", ad_account_id: ad_account_id || null,
        channel: channel || null, title: (message || "Anexo").substring(0, 60), created_by: user.id,
      }).select("id").single();
      if (convErr) throw convErr;
      convId = conv.id;
    }

    const chatStrategyRunId = crypto.randomUUID();
    const { data: chatSession } = await supabase.from("ads_autopilot_sessions").insert({
      tenant_id, channel: channel || "meta", trigger_type: "chat",
      motor_type: "chat_v2", actions_planned: 0, actions_executed: 0, actions_rejected: 0, cost_credits: 0,
      strategy_run_id: chatStrategyRunId,
    }).select("id").single();
    const chatSessionId = chatSession?.id || crypto.randomUUID();

    // Save user message
    await supabase.from("ads_chat_messages").insert({
      conversation_id: convId, tenant_id, role: "user",
      content: message || null, attachments: attachments?.length > 0 ? attachments : null,
    });

    // Load conversation history
    const { data: allHistory } = await supabase.from("ads_chat_messages")
      .select("role, content, attachments")
      .eq("conversation_id", convId).not("content", "is", null)
      .order("created_at", { ascending: false }).limit(15);
    const history = (allHistory || []).reverse();

    // ===== STEP 1: Classify intent =====
    const intent = classifyIntent(message || "", history);
    console.log(`[ads-chat-v2][${VERSION}] Intent: ${intent.category} mode=${intent.mode} hybrid=${intent.isHybrid} (confidence=${intent.confidence})`);

    // ===== STEP 2: Setup SSE stream =====
    const { readable, writable } = new TransformStream();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    const sendProgress = async (label: string) => {
      const event = `data: ${JSON.stringify({ type: "progress", label })}\n\n`;
      await writer.write(encoder.encode(event));
    };

    // ===== STEP 3: Process in background =====
    (async () => {
      try {
        const { data: storeSettings } = await supabase.from("store_settings")
          .select("store_name").eq("tenant_id", tenant_id).maybeSingle();
        const storeName = storeSettings?.store_name || "Loja";

        const hasImages = attachments?.some((a: any) => a.mimeType?.startsWith("image/"));
        const modelToUse = hasImages ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";

        resetAIRouterCache();
        const endpoint = await getAIEndpoint(modelToUse, { supabaseUrl, supabaseServiceKey });
        console.log(`[ads-chat-v2][${VERSION}] AI provider: ${endpoint.provider} (${endpoint.model})`);

        // ===== FACTUAL PATH: Backend orchestrates data, AI only interprets =====
        if (intent.mode === "factual" && intent.confidence >= 0.7) {
          await sendProgress("Identificando escopo da consulta");
          const factualCtx = await orchestrateFactualQuery(supabase, tenant_id, intent, ad_account_id, sendProgress);

          if (factualCtx && Object.keys(factualCtx.resolvedData).length > 0) {
            await sendProgress("Gerando resposta");
            const factualPrompt = buildFactualSystemPrompt(storeName, factualCtx.resolvedData, factualCtx.dataSource);

            let memoryCtx = "";
            try { memoryCtx = await getMemoryContext(supabase, tenant_id, user.id, "ads_chat"); } catch { /* ok */ }

            const factualMessages: any[] = [
              { role: "system", content: factualPrompt + memoryCtx },
              ...history.slice(-4).map((m: any) => ({ role: m.role, content: m.content || "" })),
            ];

            const aiResponse = await fetch(endpoint.url, {
              method: "POST",
              headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: endpoint.model, messages: factualMessages, stream: true }),
            });

            if (!aiResponse.ok) throw new Error(`AI error: ${aiResponse.status}`);

            const reader = aiResponse.body!.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              await writer.write(value);
              const chunk = decoder.decode(value, { stream: true });
              for (const line of chunk.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const jsonStr = line.slice(6).trim();
                if (jsonStr === "[DONE]") continue;
                try { const parsed = JSON.parse(jsonStr); const delta = parsed.choices?.[0]?.delta?.content; if (delta) fullContent += delta; } catch { /* partial */ }
              }
            }

            if (fullContent) {
              await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: fullContent });
              if ((history || []).length <= 1) {
                await supabase.from("ads_chat_conversations").update({ title: (message || "").substring(0, 60), updated_at: new Date().toISOString() }).eq("id", convId);
              }
            }

            await writer.close();
            return;
          }
          // If orchestration returned null or empty data, fall through to conversational path with tools
        }

        // ===== STRATEGIC PATH: AI gathers context then submits structured proposal =====
        // ===== CONVERSATIONAL PATH: AI with subset tools =====
        const isStrategicMode = intent.mode === "strategic";
        if (isStrategicMode && intent.isHybrid) {
          await sendProgress("Modo híbrido — coletando dados antes de propor estratégia");
        } else if (isStrategicMode) {
          await sendProgress("Modo estratégico — analisando contexto");
        } else {
          await sendProgress("Analisando");
        }

        const tools = getToolSubset(intent.category);
        console.log(`[ads-chat-v2][${VERSION}] Mode: ${intent.mode}, Tool subset: ${intent.category} (${tools.length} tools)`);

        let memoryCtx = "";
        try { memoryCtx = await getMemoryContext(supabase, tenant_id, user.id, "ads_chat"); } catch { /* ok */ }

        const { data: tenantInfo } = await supabase.from("tenants").select("slug").eq("id", tenant_id).single();
        const { data: tenantDomain } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenant_id).eq("type", "custom").eq("is_primary", true).maybeSingle();
        const storeUrl = tenantDomain?.domain || (tenantInfo?.slug ? `${tenantInfo.slug}.shops.comandocentral.com.br` : null);

        // Choose system prompt based on mode
        const systemPrompt = isStrategicMode
          ? buildStrategicSystemPrompt(storeName, { storeUrl, isHybrid: intent.isHybrid })
          : buildConversationalSystemPrompt(storeName, { storeUrl });

        const aiMessages: any[] = [{ role: "system", content: systemPrompt + memoryCtx }];

        for (let i = 0; i < history.length; i++) {
          const m = history[i];
          if (i === history.length - 1 && m.role === "user" && m.attachments) {
            const content: any[] = [];
            if (m.content) content.push({ type: "text", text: m.content });
            for (const att of m.attachments) {
              if (att.mimeType?.startsWith("image/")) {
                content.push({ type: "image_url", image_url: { url: att.url } });
              }
            }
            aiMessages.push({ role: "user", content });
          } else {
            aiMessages.push({ role: m.role, content: m.content || "" });
          }
        }

        // Initial AI call with tools
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), AI_TIMEOUT_MS);

        const initialResponse = await fetch(endpoint.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: endpoint.model, messages: aiMessages, tools, tool_choice: "auto", stream: false }),
          signal: abortController.signal,
        });
        clearTimeout(timeoutId);

        if (!initialResponse.ok) {
          const errText = await initialResponse.text();
          throw new Error(`AI error: ${initialResponse.status} ${errText.substring(0, 200)}`);
        }

        const initialResult = await initialResponse.json();
        const firstChoice = initialResult.choices?.[0];
        if (!firstChoice) throw new Error("Empty AI response");

        const toolCalls = firstChoice.message?.tool_calls;

        if (toolCalls && toolCalls.length > 0) {
          // ===== TOOL CALL LOOP =====
          const MAX_TOOL_ROUNDS = isStrategicMode ? 8 : 5; // Strategic gets more rounds for data gathering + proposal
          let currentToolCalls = toolCalls;
          let loopMessages = [...aiMessages];

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const toolNames = currentToolCalls.map((t: any) => t.function.name);
            console.log(`[ads-chat-v2][${VERSION}] Tool round ${round + 1}: ${toolNames.join(", ")}`);

            for (const name of [...new Set(toolNames)]) {
              await sendProgress(TOOL_PROGRESS_LABELS[name] || "Processando");
            }

            loopMessages.push({
              role: "assistant", content: "",
              tool_calls: currentToolCalls.map((tc: any) => ({
                id: tc.id, type: "function",
                function: { name: tc.function.name, arguments: tc.function.arguments },
              })),
            });

            const toolPromises = currentToolCalls.map(async (tc: any) => {
              let args = {};
              try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty */ }
              const result = await executeTool(supabase, tenant_id, tc.function.name, args, chatSessionId, chatStrategyRunId, channel);
              return { tc_id: tc.id, result };
            });
            const toolResults = await Promise.allSettled(toolPromises);
            for (const res of toolResults) {
              if (res.status === "fulfilled") {
                loopMessages.push({ role: "tool", tool_call_id: res.value.tc_id, content: res.value.result });
              } else {
                const idx = toolResults.indexOf(res);
                const tcId = currentToolCalls[idx]?.id || "unknown";
                loopMessages.push({ role: "tool", tool_call_id: tcId, content: JSON.stringify({ error: res.reason?.message || "Tool execution failed" }) });
              }
            }

            await sendProgress(isStrategicMode ? "Elaborando estratégia" : "Pensando");

            const nextAbort = new AbortController();
            const nextTimeout = setTimeout(() => nextAbort.abort(), AI_TIMEOUT_MS);
            try {
              const nextResponse = await fetch(endpoint.url, {
                method: "POST",
                headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({ model: endpoint.model, messages: loopMessages, tools, stream: false }),
                signal: nextAbort.signal,
              });
              clearTimeout(nextTimeout);
              if (!nextResponse.ok) throw new Error(`AI round ${round + 1} error: ${nextResponse.status}`);
              const nextResult = await nextResponse.json();
              const nextChoice = nextResult.choices?.[0];
              const nextToolCalls = nextChoice?.message?.tool_calls;

              if (nextToolCalls?.length > 0) {
                currentToolCalls = nextToolCalls;
                continue;
              }

              const finalContent = nextChoice?.message?.content;
              if (finalContent) {
                await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: finalContent });
                if ((history || []).length <= 1) {
                  await supabase.from("ads_chat_conversations").update({ title: (message || "").substring(0, 60), updated_at: new Date().toISOString() }).eq("id", convId);
                }
                await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: finalContent } }] })}\n\ndata: [DONE]\n\n`));
                await writer.close();
                return;
              }
              break;
            } catch (err: any) {
              clearTimeout(nextTimeout);
              if (err.name === "AbortError") {
                const msg = "⚠️ O processamento demorou mais que o esperado. Tente novamente.";
                await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: msg });
                await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: msg } }] })}\n\ndata: [DONE]\n\n`));
                await writer.close();
                return;
              }
              throw err;
            }
          }

          // Loop exhausted — stream final
          await sendProgress("Finalizando resposta");
          const finalStream = await fetch(endpoint.url, {
            method: "POST",
            headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: endpoint.model, messages: loopMessages, stream: true }),
          });
          if (finalStream.ok) {
            const reader = finalStream.body!.getReader();
            const decoder = new TextDecoder();
            let fullContent = "";
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              await writer.write(value);
              const chunk = decoder.decode(value, { stream: true });
              for (const line of chunk.split("\n")) {
                if (!line.startsWith("data: ")) continue;
                const j = line.slice(6).trim();
                if (j === "[DONE]") continue;
                try { const p = JSON.parse(j); const d = p.choices?.[0]?.delta?.content; if (d) fullContent += d; } catch {}
              }
            }
            if (fullContent) {
              await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: fullContent });
            }
          }
          await writer.close();
          return;
        }

        // No tool calls — direct text response
        // ===== ANTI-FILLER DEFENSIVE RETRY (v6.3.0) =====
        // If intent expected tools but AI responded with text only, retry once with tool_choice=required
        const directContent = firstChoice.message?.content;
        const shouldRetry = directContent && intent.category !== "general" && (
          // AI claims it can't access something the tools cover
          /não\s+(consigo|posso|tenho)\s+(acesso|acessar|consultar|ver|buscar)/i.test(directContent) ||
          /não\s+é\s+possível\s+(acessar|consultar|ver)/i.test(directContent) ||
          /ferramenta[s]?\s+(não\s+)?(disponíve[il]s?|acessíve[il]s?)/i.test(directContent) ||
          /infelizmente.{0,40}(não|sem)\s+(acesso|ferramenta|possibilidade)/i.test(directContent) ||
          // Filler promises without action
          /aguarde\s+(enquanto|enquanto\s+eu)/i.test(directContent) ||
          /vou\s+(começar|criar|gerar|preparar|buscar|consultar|verificar)/i.test(directContent) ||
          /estou\s+(preparando|criando|gerando|buscando|consultando)/i.test(directContent)
        );

        if (shouldRetry) {
          console.log(`[ads-chat-v2][${VERSION}] Anti-filler: retrying with tool_choice=required (category=${intent.category})`);
          await sendProgress("Reprocessando consulta");
          try {
            const retryResponse = await fetch(endpoint.url, {
              method: "POST",
              headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                model: endpoint.model,
                messages: [
                  ...aiMessages,
                  { role: "assistant", content: directContent },
                  { role: "user", content: "Você tem as ferramentas necessárias disponíveis. Use-as agora para atender minha solicitação. NÃO diga que não consegue — execute a ferramenta." },
                ],
                tools,
                tool_choice: "required",
                stream: false,
              }),
            });
            if (retryResponse.ok) {
              const retryResult = await retryResponse.json();
              const retryToolCalls = retryResult.choices?.[0]?.message?.tool_calls;
              if (retryToolCalls?.length > 0) {
                // Execute tool calls from retry
                let retryMessages = [
                  ...aiMessages,
                  { role: "assistant", content: "", tool_calls: retryToolCalls.map((tc: any) => ({ id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments } })) },
                ];
                const retryToolPromises = retryToolCalls.map(async (tc: any) => {
                  let args = {};
                  try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty */ }
                  await sendProgress(TOOL_PROGRESS_LABELS[tc.function.name] || "Processando");
                  const result = await executeTool(supabase, tenant_id, tc.function.name, args, chatSessionId, chatStrategyRunId, channel);
                  return { tc_id: tc.id, result };
                });
                const retryToolResults = await Promise.allSettled(retryToolPromises);
                for (const res of retryToolResults) {
                  if (res.status === "fulfilled") {
                    retryMessages.push({ role: "tool", tool_call_id: res.value.tc_id, content: res.value.result });
                  }
                }
                await sendProgress("Gerando resposta");
                const finalRetryResp = await fetch(endpoint.url, {
                  method: "POST",
                  headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ model: endpoint.model, messages: retryMessages, stream: true }),
                });
                if (finalRetryResp.ok) {
                  const reader = finalRetryResp.body!.getReader();
                  const decoder = new TextDecoder();
                  let fullContent = "";
                  while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    await writer.write(value);
                    const chunk = decoder.decode(value, { stream: true });
                    for (const line of chunk.split("\n")) {
                      if (!line.startsWith("data: ")) continue;
                      const j = line.slice(6).trim();
                      if (j === "[DONE]") continue;
                      try { const p = JSON.parse(j); const d = p.choices?.[0]?.delta?.content; if (d) fullContent += d; } catch {}
                    }
                  }
                  if (fullContent) {
                    await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: fullContent });
                    if ((history || []).length <= 1) {
                      await supabase.from("ads_chat_conversations").update({ title: (message || "").substring(0, 60), updated_at: new Date().toISOString() }).eq("id", convId);
                    }
                  }
                  await writer.close();
                  return;
                }
              }
            }
          } catch (retryErr) {
            console.error(`[ads-chat-v2][${VERSION}] Anti-filler retry failed:`, retryErr);
          }
          // Retry failed — fall through to send original content
        }

        if (directContent) {
          await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: directContent });
          if ((history || []).length <= 1) {
            await supabase.from("ads_chat_conversations").update({ title: (message || "").substring(0, 60), updated_at: new Date().toISOString() }).eq("id", convId);
          }
          await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: directContent } }] })}\n\ndata: [DONE]\n\n`));
          await writer.close();
          return;
        }

        // Fallback stream
        const streamResponse = await fetch(endpoint.url, {
          method: "POST",
          headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({ model: endpoint.model, messages: aiMessages, stream: true }),
        });
        if (streamResponse.ok) {
          const reader = streamResponse.body!.getReader();
          let fullContent = "";
          const decoder = new TextDecoder();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
            const chunk = decoder.decode(value, { stream: true });
            for (const line of chunk.split("\n")) {
              if (!line.startsWith("data: ")) continue;
              const j = line.slice(6).trim();
              if (j === "[DONE]") continue;
              try { const p = JSON.parse(j); const d = p.choices?.[0]?.delta?.content; if (d) fullContent += d; } catch {}
            }
          }
          if (fullContent) {
            await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: fullContent });
          }
        }
        await writer.close();
      } catch (e: any) {
        console.error(`[ads-chat-v2][${VERSION}] Error:`, e);
        const errMsg = `⚠️ Erro: ${e.message || "Erro interno"}. Tente novamente.`;
        try {
          await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: errMsg });
          await writer.write(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n\ndata: [DONE]\n\n`));
        } catch { /* ignore */ }
        try { await writer.close(); } catch { /* already closed */ }
      }
    })();

    return new Response(readable, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Conversation-Id": convId },
    });
  } catch (e: any) {
    console.error(`[ads-chat-v2][${VERSION}] Fatal error:`, e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
