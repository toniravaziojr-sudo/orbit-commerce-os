import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getMemoryContext } from "../_shared/ai-memory.ts";
import { getAIEndpoint, resetAIRouterCache, type AIEndpoint } from "../_shared/ai-router.ts";

// ===== VERSION =====
const VERSION = "v6.0.0"; // Factual orchestration architecture
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
  | "general";        // conversation, greetings, explanations

interface ClassifiedIntent {
  category: IntentCategory;
  isFactual: boolean;       // true = needs data fetching before AI response
  entities: {               // extracted entities from message
    campaignIds?: string[];
    adsetIds?: string[];
    period?: string;
    channel?: string;
    productName?: string;
  };
  confidence: number;       // 0-1
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

  // ---- Pattern matching (ordered by specificity) ----

  // TARGETING (highest priority for targeting queries)
  if (/targeting|segmentação|segmentacao|público[s]?\s+(personalizado|semelhante|custom|lookalike)|audiência|interesse[s]?|demografi|faixa\s+etári|gênero|localização|posicionamento/i.test(msg) &&
      !/cri[ae]r?\s+(público|audiência|lookalike)|atualiz/i.test(msg)) {
    return { category: "targeting", isFactual: true, entities, confidence: 0.95 };
  }

  // PERFORMANCE (metrics-focused)
  if (/performance|desempenho|resultado[s]?|métrica[s]?|roas|roi\b|cpa\b|cpc\b|ctr\b|gasto|spend|conversão|conversões|conversao|receita|faturamento|vendas?\s+(d[aoe]s?\s+)?campanhas?|quanto\s+gastei|quanto\s+gast[ao]u|quanto\s+faturei|quanto\s+convert|melhor(es)?\s+campanha|pior(es)?\s+campanha|top\s+\d+|ranking|comparar?\s+campanha/i.test(msg) &&
      !/cri[ae]r?|paus[ae]r?|ativ[ae]r?|alter[ae]r?/i.test(msg)) {
    return { category: "performance", isFactual: true, entities, confidence: 0.9 };
  }

  // CAMPAIGNS LIST (enumerate entities)
  if (/list[ae]r?\s+(as?\s+)?campanha|quais\s+(são\s+)?(as?\s+)?campanha|mostr[ae]r?\s+(as?\s+)?campanha|campanhas?\s+ativ[ao]s?|campanhas?\s+pausad[ao]s?|quantas?\s+campanha|list[ae]r?\s+(os?\s+)?conjunt|list[ae]r?\s+(os?\s+)?anúncio/i.test(msg) &&
      !/cri[ae]r?|paus[ae]r?|ativ[ae]r?/i.test(msg)) {
    return { category: "campaigns_list", isFactual: true, entities, confidence: 0.85 };
  }

  // WRITE - META
  if (/cri[ae]r?\s+(campanha|conjunto|anúncio|público|audiência|lookalike)|paus[ae]r?\s+(campanha|conjunto|anúncio)|ativ[ae]r?\s+(campanha|conjunto|anúncio)|reativ[ae]r?|alter[ae]r?\s+(orçamento|budget|segmentação)|duplic[ae]r?\s+campanha|aument[ae]r?\s+(orçamento|budget)|diminu[iae]r?\s+(orçamento|budget)/i.test(msg) &&
      !/google|tiktok/i.test(msg)) {
    return { category: "write_meta", isFactual: false, entities, confidence: 0.9 };
  }

  // WRITE - GOOGLE
  if (/google/i.test(msg) && /cri[ae]r?|paus[ae]r?|ativ[ae]r?|alter[ae]r?|budget/i.test(msg)) {
    return { category: "write_google", isFactual: false, entities, confidence: 0.85 };
  }

  // WRITE - TIKTOK
  if (/tiktok/i.test(msg) && /cri[ae]r?|paus[ae]r?|ativ[ae]r?|alter[ae]r?|budget/i.test(msg)) {
    return { category: "write_tiktok", isFactual: false, entities, confidence: 0.85 };
  }

  // CREATIVE
  if (/gerar?\s+(arte|imagem|criativo|texto|copy|headline)|criativo[s]?|arte[s]?\s+para\s+anúncio/i.test(msg)) {
    return { category: "creative", isFactual: false, entities, confidence: 0.85 };
  }

  // AUTOPILOT
  if (/configuração|config|guardião|estrategista|plano\s+estratégico|ações?\s+da\s+ia|diagnóstico|insight|histórico\s+de\s+execuç|autopilot|teste[s]?\s+a\/?b|experiment/i.test(msg)) {
    return { category: "autopilot", isFactual: true, entities, confidence: 0.8 };
  }

  // STORE CONTEXT
  if (/produto[s]?|catálogo|categoria[s]?|oferta[s]?|desconto[s]?|loja|negócio|nicho|pixel|rastreamento/i.test(msg) &&
      !/campanha|anúncio|criativo|gerar/i.test(msg)) {
    return { category: "store_context", isFactual: true, entities, confidence: 0.75 };
  }

  // DRIVE
  if (/drive|arquivo[s]?|pasta[s]?|buscar?\s+no\s+drive|explorar?\s+drive|meu\s+drive/i.test(msg)) {
    return { category: "drive", isFactual: false, entities, confidence: 0.8 };
  }

  // GENERAL - conversation
  return { category: "general", isFactual: false, entities, confidence: 0.5 };
}

// ======================================================================
// 2. TOOL SUBSETS — Only relevant tools per intent
// ======================================================================

// Import full tool definitions from ads-chat (we reference by name, execute via the same executeTool)
// For Phase 1.1, we define minimal tool schemas per category

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
        toolDef("get_adset_targeting", "Busca targeting completo de adsets direto da Meta API. Retorna: públicos, lookalikes, interesses, idade, gênero, geo, posicionamentos.", {
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
      // Minimal read-only tools for general conversation
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
  dataSource: string; // "live" | "cache" | "hybrid"
  steps: string[];    // For SSE progress reporting
}

async function orchestrateFactualQuery(
  supabase: any,
  tenantId: string,
  intent: ClassifiedIntent,
  adAccountId?: string,
  sendProgress?: (label: string) => Promise<void>,
): Promise<FactualContext | null> {
  // Only orchestrate for factual intents
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
        // Autopilot data is always from DB, no live fetch needed
        return null; // Let AI handle with tools
      default:
        return null;
    }
  } catch (err) {
    console.error(`[ads-chat-v2][${VERSION}] Orchestration error:`, err);
    return null; // Fallback: let AI use tools
  }
}

async function orchestratePerformance(
  supabase: any, tenantId: string, intent: ClassifiedIntent,
  adAccountId: string | undefined, sendProgress: any, ctx: FactualContext,
): Promise<FactualContext> {
  // Step 1: Get Meta connection
  await sendProgress?.("Verificando conexão Meta");
  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token, metadata")
    .eq("tenant_id", tenantId).eq("marketplace", "meta").eq("is_active", true).maybeSingle();

  if (!conn?.access_token) {
    // Fallback to cache
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

  // Step 2: Fetch campaigns live
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

  // Step 3: Fetch insights
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

  // Step 4: Merge campaigns + insights
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
  // Step 1: Get adset IDs from cache (fast)
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

  // Step 2: Fetch live targeting for active adsets
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
          // Sync to cache
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

    // Format targeting
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
    // Use cached targeting
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
  // Reuse performance orchestrator but with lighter data
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

// --- Format targeting into human-readable structure (shared with ads-chat) ---
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
// 4. SYSTEM PROMPT — Compact factual prompt (data already resolved)
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
- Se algo está faltando nos dados, diga "esta informação não está disponível"
- Sugira próximos passos baseados nos dados`;
}

function buildConversationalSystemPrompt(storeName: string, context: any): string {
  // Lighter version of the full system prompt, for non-factual queries
  return `Você é o Gestor de Tráfego IA da loja "${storeName}".

## REGRA SUPREMA: HONESTIDADE ABSOLUTA
- Nunca invente dados. Se não sabe, diga.
- Se uma ferramenta retorna erro, informe o erro real.
- NUNCA finja que está processando algo que não está.

## REGRA: EXECUTE, NÃO PEÇA PERMISSÃO
- NUNCA termine resposta com "Posso seguir?" ou "Quer que eu faça?"
- EXECUTE PRIMEIRO, REPORTE DEPOIS.
- Única exceção: override de regras de segurança.

## REGRA: SEQUÊNCIA PARA CAMPANHAS
- NUNCA chame generate_creative_image e create_meta_campaign na mesma rodada.
- Máximo 2 campanhas por rodada.

## COMUNICAÇÃO
- Fale em Português BR
- Use Markdown
- Nunca exponha IDs técnicos, nomes de ferramentas ou termos internos
- Seja proativo: sugira ações

${context?.storeUrl ? `**URL da loja**: ${context.storeUrl}` : ""}
${context?.products ? `\n**Produtos**: ${context.products.map((p: any) => p.name).join(", ")}` : ""}`;
}

// ======================================================================
// 5. TOOL EXECUTOR — Delegates to ads-chat edge function
// ======================================================================

async function executeTool(supabase: any, tenantId: string, toolName: string, args: any, chatSessionId?: string, strategyRunId?: string): Promise<string> {
  // Call the original ads-chat function's executeTool via internal HTTP call
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
      // If ads-chat doesn't support _internal_tool_call yet, execute common tools directly
      return await executeToolDirect(supabase, tenantId, toolName, args);
    }

    return await response.text();
  } catch {
    // Fallback: execute directly for common read tools
    return await executeToolDirect(supabase, tenantId, toolName, args);
  }
}

// Direct execution for common read tools (no dependency on ads-chat internals)
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
      default:
        return JSON.stringify({ error: `Ferramenta '${toolName}' não disponível no modo direto. Use o chat padrão.` });
    }
  } catch (err: any) {
    return JSON.stringify({ error: err.message || "Erro ao executar ferramenta" });
  }
}

// ======================================================================
// 6. SSE PROGRESS LABELS
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
};

// ======================================================================
// 7. MAIN HANDLER
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

    // Chat session for action logging
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
    console.log(`[ads-chat-v2][${VERSION}] Intent: ${intent.category} (factual=${intent.isFactual}, confidence=${intent.confidence})`);

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
        // Get store name for prompts
        const { data: storeSettings } = await supabase.from("store_settings")
          .select("store_name").eq("tenant_id", tenant_id).maybeSingle();
        const storeName = storeSettings?.store_name || "Loja";

        // Images require multimodal model
        const hasImages = attachments?.some((a: any) => a.mimeType?.startsWith("image/"));
        const modelToUse = hasImages ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";

        resetAIRouterCache();
        const endpoint = await getAIEndpoint(modelToUse, { supabaseUrl, supabaseServiceKey });
        console.log(`[ads-chat-v2][${VERSION}] AI provider: ${endpoint.provider} (${endpoint.model})`);

        // ===== FACTUAL PATH: Backend orchestrates data, AI only interprets =====
        if (intent.isFactual && intent.confidence >= 0.7) {
          await sendProgress("Identificando escopo da consulta");
          const factualCtx = await orchestrateFactualQuery(supabase, tenant_id, intent, ad_account_id, sendProgress);

          if (factualCtx && Object.keys(factualCtx.resolvedData).length > 0) {
            // Data resolved — send to AI for interpretation only (no tools needed)
            await sendProgress("Gerando resposta");
            const factualPrompt = buildFactualSystemPrompt(storeName, factualCtx.resolvedData, factualCtx.dataSource);

            // Inject memory
            let memoryCtx = "";
            try {
              memoryCtx = await getMemoryContext(supabase, tenant_id, user.id, "ads_chat");
            } catch { /* ok */ }

            const factualMessages: any[] = [
              { role: "system", content: factualPrompt + memoryCtx },
              // Include last few messages for conversational context
              ...history.slice(-4).map((m: any) => ({
                role: m.role, content: m.content || "",
              })),
            ];

            // Stream AI response (no tools needed — data already resolved)
            const aiResponse = await fetch(endpoint.url, {
              method: "POST",
              headers: { Authorization: `Bearer ${endpoint.apiKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({ model: endpoint.model, messages: factualMessages, stream: true }),
            });

            if (!aiResponse.ok) {
              throw new Error(`AI error: ${aiResponse.status}`);
            }

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
                try {
                  const parsed = JSON.parse(jsonStr);
                  const delta = parsed.choices?.[0]?.delta?.content;
                  if (delta) fullContent += delta;
                } catch { /* partial */ }
              }
            }

            // Save response
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

        // ===== CONVERSATIONAL PATH: AI with subset tools =====
        await sendProgress("Analisando");

        // Build messages
        const tools = getToolSubset(intent.category);
        console.log(`[ads-chat-v2][${VERSION}] Tool subset: ${intent.category} (${tools.length} tools)`);

        // Inject memory
        let memoryCtx = "";
        try {
          memoryCtx = await getMemoryContext(supabase, tenant_id, user.id, "ads_chat");
        } catch { /* ok */ }

        // Collect minimal context
        const { data: tenantInfo } = await supabase.from("tenants").select("slug").eq("id", tenant_id).single();
        const { data: tenantDomain } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenant_id).eq("type", "custom").eq("is_primary", true).maybeSingle();
        const storeUrl = tenantDomain?.domain || (tenantInfo?.slug ? `${tenantInfo.slug}.shops.comandocentral.com.br` : null);

        const systemPrompt = buildConversationalSystemPrompt(storeName, { storeUrl });
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
          const MAX_TOOL_ROUNDS = 5;
          let currentToolCalls = toolCalls;
          let loopMessages = [...aiMessages];

          for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
            const toolNames = currentToolCalls.map((t: any) => t.function.name);
            console.log(`[ads-chat-v2][${VERSION}] Tool round ${round + 1}: ${toolNames.join(", ")}`);

            for (const name of [...new Set(toolNames)]) {
              await sendProgress(TOOL_PROGRESS_LABELS[name] || "Processando");
            }

            // Build assistant message
            loopMessages.push({
              role: "assistant", content: "",
              tool_calls: currentToolCalls.map((tc: any) => ({
                id: tc.id, type: "function",
                function: { name: tc.function.name, arguments: tc.function.arguments },
              })),
            });

            // Execute tools in parallel
            const toolPromises = currentToolCalls.map(async (tc: any) => {
              let args = {};
              try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty */ }
              const result = await executeTool(supabase, tenant_id, tc.function.name, args, chatSessionId, chatStrategyRunId);
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

            await sendProgress("Pensando");

            // Next AI call
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

              // Final text
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
        const directContent = firstChoice.message?.content;
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
