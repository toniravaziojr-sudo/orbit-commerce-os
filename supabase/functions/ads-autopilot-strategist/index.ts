import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { aiChatCompletion, resetAIRouterCache } from "../_shared/ai-router.ts";

// ===== VERSION =====
const VERSION = "v1.34.0"; // Smart filtering: all campaigns + only active adsets/ads + early exit for start trigger
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// ============ TYPES ============

interface AccountConfig {
  id: string;
  tenant_id: string;
  channel: string;
  ad_account_id: string;
  is_ai_enabled: boolean;
  budget_cents: number | null;
  budget_mode: string | null;
  target_roi: number | null;
  min_roi_cold: number | null;
  min_roi_warm: number | null;
  roas_scaling_threshold: number | null;
  user_instructions: string | null;
  strategy_mode: string | null;
  funnel_split_mode: string | null;
  funnel_splits: Record<string, number> | null;
  kill_switch: boolean | null;
  human_approval_mode: string | null;
  last_budget_adjusted_at: string | null;
}

type StrategistTrigger = "start" | "weekly" | "monthly" | "implement_approved_plan" | "implement_campaigns" | "revision";

// ============ HELPERS ============

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string) {
  return new Response(JSON.stringify({ success: false, error }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function safeDivide(a: number, b: number, fallback = 0): number {
  return b > 0 ? Math.round((a / b) * 100) / 100 : fallback;
}

function getNextSchedulingTime(): string {
  const now = new Date();
  const scheduleDate = new Date(now);
  const utcHour = now.getUTCHours();
  const brtHour = utcHour - 3 < 0 ? utcHour - 3 + 24 : utcHour - 3;

  if (brtHour >= 0 && brtHour < 4) {
    scheduleDate.setMinutes(scheduleDate.getMinutes() + 5);
  } else {
    if (brtHour >= 4) {
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }
    const randomMinute = 1 + Math.floor(Math.random() * 59);
    scheduleDate.setUTCHours(3, randomMinute, 0, 0);
  }
  return scheduleDate.toISOString();
}

// ============ STRATEGIST TOOLS ============

const STRATEGIST_TOOLS = [
  {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Cria nova campanha completa na plataforma de anúncios (Campanha + Conjunto + Anúncio). Será criada PAUSADA e AGENDADA para ativação em 00:01-04:00 BRT. TODOS os campos devem ser preenchidos como se estivesse configurando manualmente no Meta Ads Manager.",
      parameters: {
        type: "object",
        properties: {
          // --- NÍVEL CAMPANHA ---
          campaign_name: { type: "string", description: "Nome da campanha. Padrão: [AI] Objetivo | Produto | Público | Data" },
          objective: { type: "string", enum: ["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS", "OUTCOME_ENGAGEMENT", "OUTCOME_APP_PROMOTION"], description: "Objetivo da campanha Meta Ads" },
          special_ad_categories: { type: "array", items: { type: "string", enum: ["NONE", "CREDIT", "EMPLOYMENT", "HOUSING", "SOCIAL_ISSUES_ELECTIONS_POLITICS"] }, description: "Categorias especiais de anúncio. Use ['NONE'] se não aplicável." },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos (CBO — Campaign Budget Optimization)" },
          lifetime_budget_cents: { type: "number", description: "Orçamento vitalício em centavos (alternativa ao diário)" },
          bid_strategy: { type: "string", enum: ["LOWEST_COST_WITHOUT_CAP", "LOWEST_COST_WITH_BID_CAP", "COST_CAP", "MINIMUM_ROAS"], description: "Estratégia de lance. Padrão: LOWEST_COST_WITHOUT_CAP (menor custo automático)" },
          bid_amount_cents: { type: "number", description: "Limite de lance em centavos (apenas para BID_CAP ou COST_CAP)" },
          roas_avg_floor: { type: "number", description: "ROAS mínimo (apenas para MINIMUM_ROAS). Ex: 2.0 = 200%" },
          
          // --- NÍVEL CONJUNTO DE ANÚNCIOS ---
          adset_name: { type: "string", description: "Nome do conjunto de anúncios. Padrão: [AI] CJ - Público | Funil" },
          optimization_goal: { type: "string", enum: ["OFFSITE_CONVERSIONS", "LINK_CLICKS", "IMPRESSIONS", "REACH", "LANDING_PAGE_VIEWS", "VALUE", "LEAD_GENERATION", "QUALITY_LEAD", "ENGAGED_USERS"], description: "Objetivo de otimização do conjunto. OBRIGATÓRIO." },
          billing_event: { type: "string", enum: ["IMPRESSIONS", "LINK_CLICKS", "THRUPLAY"], description: "Evento de cobrança. Padrão: IMPRESSIONS" },
          conversion_event: { type: "string", enum: ["PURCHASE", "ADD_TO_CART", "INITIATED_CHECKOUT", "LEAD", "COMPLETE_REGISTRATION", "VIEW_CONTENT", "SEARCH", "ADD_PAYMENT_INFO", "ADD_TO_WISHLIST", "CONTACT", "SUBSCRIBE", "START_TRIAL"], description: "Evento de conversão do Pixel. OBRIGATÓRIO para campanhas de vendas/leads." },
          
          // --- TARGETING / PÚBLICO ---
          targeting_description: { type: "string", description: "Descrição textual do público-alvo para referência humana" },
          funnel_stage: { type: "string", enum: ["cold", "warm", "hot"], description: "Etapa do funil" },
          age_min: { type: "number", description: "Idade mínima. Padrão: 18" },
          age_max: { type: "number", description: "Idade máxima. Padrão: 65" },
          genders: { type: "array", items: { type: "number" }, description: "Gêneros: [0]=Todos, [1]=Masculino, [2]=Feminino" },
          geo_locations: { type: "object", description: "Localização geográfica. Ex: {countries: ['BR']} ou {regions: [{key: '3650'}], cities: [{key: '123456'}]}" },
          interests: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] }, description: "Interesses para segmentação detalhada" },
          behaviors: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] }, description: "Comportamentos para segmentação" },
          custom_audience_ids: { type: "array", items: { type: "string" }, description: "IDs de públicos personalizados para incluir" },
          excluded_audience_ids: { type: "array", items: { type: "string" }, description: "IDs de públicos personalizados para excluir" },
          lookalike_spec: { type: "object", description: "Especificação de Lookalike. Ex: {ratio: 0.03, country: 'BR', source_audience_id: '123'}" },
          
          // --- POSICIONAMENTOS ---
          publisher_platforms: { type: "array", items: { type: "string", enum: ["facebook", "instagram", "audience_network", "messenger"] }, description: "Plataformas. Omitir = Automático (Advantage+)" },
          position_types: { type: "array", items: { type: "string", enum: ["feed", "story", "reels", "right_hand_column", "instant_article", "marketplace", "video_feeds", "search", "instream_video", "reels_overlay", "explore", "profile_feed", "facebook_stories", "instagram_stories", "instagram_reels", "facebook_reels"] }, description: "Posições específicas. Omitir = Automático" },
          device_platforms: { type: "array", items: { type: "string", enum: ["mobile", "desktop"] }, description: "Dispositivos. Omitir = Todos" },
          
          // --- LINK & DESTINO ---
          destination_url: { type: "string", description: "URL de destino do anúncio. OBRIGATÓRIO. Use a URL real do produto ou landing page." },
          display_link: { type: "string", description: "Link exibido no anúncio (opcional, apenas visual)" },
          utm_params: { type: "object", description: "Parâmetros UTM. Ex: {source: 'meta', medium: 'paid', campaign: 'campanha-x'}" },
          
          // --- CRIATIVO / ANÚNCIO ---
          product_name: { type: "string", description: "Nome EXATO do produto do catálogo para esta campanha" },
          ad_name: { type: "string", description: "Nome do anúncio. Padrão: [AI] Ad - Produto | Variação" },
          ad_format: { type: "string", enum: ["SINGLE_IMAGE", "SINGLE_VIDEO", "CAROUSEL", "COLLECTION"], description: "Formato do anúncio" },
          primary_texts: { type: "array", items: { type: "string" }, description: "2-4 variações de Primary Text (copy principal). OBRIGATÓRIO ter no mínimo 2." },
          headlines: { type: "array", items: { type: "string" }, description: "2-4 variações de Headline. OBRIGATÓRIO ter no mínimo 2." },
          descriptions: { type: "array", items: { type: "string" }, description: "1-2 descrições curtas para o anúncio." },
          cta: { type: "string", enum: ["SHOP_NOW", "LEARN_MORE", "SIGN_UP", "BUY_NOW", "ORDER_NOW", "GET_OFFER", "SEND_WHATSAPP_MESSAGE", "CONTACT_US", "SUBSCRIBE", "DOWNLOAD", "WATCH_MORE", "BOOK_NOW", "APPLY_NOW"], description: "Call to Action" },

          // --- AGENDAMENTO ---
          start_time: { type: "string", description: "Data/hora de início (ISO 8601). Omitir = agendamento automático 00:01 BRT" },
          end_time: { type: "string", description: "Data/hora de término (ISO 8601). Omitir = sem data de término" },

          // --- META ---
          reasoning: { type: "string", description: "Justificativa com dados numéricos" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_name", "objective", "daily_budget_cents", "optimization_goal", "conversion_event", "targeting_description", "funnel_stage", "destination_url", "product_name", "primary_texts", "headlines", "reasoning", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_adset",
      description: "Cria novo conjunto de anúncios ADICIONAL dentro de uma campanha existente (para múltiplos públicos). Use quando a campanha já foi criada e você quer adicionar segmentações diferentes.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "ID da campanha pai (retornado no create_campaign)" },
          campaign_name: { type: "string", description: "Nome da campanha pai (fallback para busca)" },
          adset_name: { type: "string", description: "Nome do conjunto de anúncios" },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos (ABO — Ad Set Budget)" },
          lifetime_budget_cents: { type: "number", description: "Orçamento vitalício em centavos" },
          
          // --- OTIMIZAÇÃO ---
          optimization_goal: { type: "string", enum: ["OFFSITE_CONVERSIONS", "LINK_CLICKS", "IMPRESSIONS", "REACH", "LANDING_PAGE_VIEWS", "VALUE", "LEAD_GENERATION", "QUALITY_LEAD", "ENGAGED_USERS"], description: "Objetivo de otimização" },
          billing_event: { type: "string", enum: ["IMPRESSIONS", "LINK_CLICKS", "THRUPLAY"], description: "Evento de cobrança" },
          conversion_event: { type: "string", enum: ["PURCHASE", "ADD_TO_CART", "INITIATED_CHECKOUT", "LEAD", "COMPLETE_REGISTRATION", "VIEW_CONTENT", "SEARCH", "ADD_PAYMENT_INFO", "CONTACT", "SUBSCRIBE", "START_TRIAL"], description: "Evento de conversão do Pixel" },
          bid_amount_cents: { type: "number", description: "Limite de lance em centavos" },
          
          // --- TARGETING ---
          targeting_type: { type: "string", enum: ["cold_broad", "cold_interest", "warm_custom", "hot_remarketing", "lookalike"], description: "Tipo de segmentação" },
          targeting_description: { type: "string", description: "Descrição textual do público" },
          age_min: { type: "number" },
          age_max: { type: "number" },
          genders: { type: "array", items: { type: "number" } },
          geo_locations: { type: "object", description: "Localização. Ex: {countries: ['BR']}" },
          interests: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] } },
          behaviors: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] } },
          custom_audience_ids: { type: "array", items: { type: "string" }, description: "IDs de públicos personalizados" },
          excluded_audience_ids: { type: "array", items: { type: "string" }, description: "IDs de públicos para excluir" },
          lookalike_spec: { type: "object", description: "Spec de Lookalike" },
          
          // --- POSICIONAMENTOS ---
          publisher_platforms: { type: "array", items: { type: "string", enum: ["facebook", "instagram", "audience_network", "messenger"] } },
          position_types: { type: "array", items: { type: "string" } },
          device_platforms: { type: "array", items: { type: "string", enum: ["mobile", "desktop"] } },
          
          // --- DESTINO ---
          destination_url: { type: "string", description: "URL de destino dos anúncios deste conjunto" },
          
          // --- AGENDAMENTO ---
          start_time: { type: "string" },
          end_time: { type: "string" },
          
          // --- META ---
          reasoning: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_id", "adset_name", "targeting_type", "reasoning", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_creative",
      description: "Gera criativos (imagens) para uma campanha via IA generativa. OBRIGATÓRIO: product_name deve ser IDÊNTICO ao nome no catálogo (case-sensitive, sem abreviações). Se o nome não bater exatamente, a geração FALHARÁ.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string" },
          campaign_objective: { type: "string" },
          target_audience: { type: "string" },
          style_preference: { type: "string", enum: ["promotional", "product_natural", "person_interacting", "ugc_style"] },
          format: { type: "string", enum: ["1:1", "9:16", "16:9"] },
          variations: { type: "number", minimum: 1, maximum: 5 },
          funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test"], description: "Etapa do funil para o criativo. OBRIGATÓRIO para garantir criativos diferentes por funil. TOF=aquisição, BOF=remarketing, test=testes" },
          reasoning: { type: "string" },
        },
        required: ["product_name", "campaign_objective", "target_audience", "style_preference", "funnel_stage", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lookalike_audience",
      description: "Cria público Lookalike a partir de uma Custom Audience existente.",
      parameters: {
        type: "object",
        properties: {
          lookalike_name: { type: "string" },
          source_audience_id: { type: "string" },
          source_audience_name: { type: "string" },
          ratio: { type: "number", description: "Tamanho do Lookalike (0.01 a 0.10 = 1% a 10%)" },
          country: { type: "string", description: "País ISO 2-letter" },
          reasoning: { type: "string" },
        },
        required: ["lookalike_name", "source_audience_id", "source_audience_name", "ratio", "reasoning"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_budget",
      description: "Ajusta orçamento de campanha existente. Será AGENDADO para 00:01 BRT.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          current_budget_cents: { type: "number" },
          new_budget_cents: { type: "number" },
          change_pct: { type: "number" },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_id", "new_budget_cents", "change_pct", "reason", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "strategic_plan",
      description: "Emite plano estratégico DETALHADO e COMPLETO. Cada ação DEVE ter todos os campos preenchidos com dados específicos — NUNCA genéricos.",
      parameters: {
        type: "object",
        properties: {
          diagnosis: { 
            type: "string", 
            description: "Diagnóstico DETALHADO: campanhas ativas (nome, ROAS 7d/30d, CPA, orçamento), campanhas pausadas relevantes, orçamento utilizado vs disponível, tracking health, e análise de oportunidades. Mínimo 300 palavras." 
          },
          planned_actions: { 
            type: "array", 
            items: { 
              type: "object",
              properties: {
                action_type: { type: "string", enum: ["create_campaign", "adjust_budget", "pause_campaign", "test", "scale", "duplicate", "optimize"], description: "Tipo da ação" },
                campaign_type: { type: "string", enum: ["TOF", "MOF", "BOF", "Remarketing", "Teste", "Catálogo", "Duplicação"], description: "Tipo de campanha" },
                product_name: { type: "string", description: "Nome EXATO do produto do catálogo" },
                daily_budget_brl: { type: "number", description: "Orçamento diário TOTAL da campanha em R$" },
                target_audience: { type: "string", description: "Resumo do público-alvo principal (ex: Homens 30-65, Brasil)" },
                funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test"], description: "Etapa do funil" },
                objective: { type: "string", description: "Objetivo da campanha (ex: OUTCOME_SALES, OUTCOME_LEADS)" },
                performance_goal: { type: "string", enum: ["Maximizar Conversões", "Maximizar Valor das Conversões"], description: "Meta de desempenho do conjunto (como aparece no Meta Ads). Padrão: Maximizar Conversões" },
                conversion_location: { type: "string", enum: ["Site", "Site e App", "App", "Site e Loja Física"], description: "Local da conversão do conjunto. Padrão: Site" },
                attribution_model: { type: "string", enum: ["Padrão", "Incremental"], description: "Modelo de atribuição. Padrão: Padrão" },
                creatives_count: { type: "number", description: "Quantidade TOTAL de variações de criativos (mín 2, conta todas as variações de todos os conjuntos)" },
                copy_variations: { type: "number", description: "Quantidade de variações de copy (mín 2)" },
                rationale: { type: "string", description: "Justificativa detalhada para esta ação específica, com dados de suporte" },
                expected_roas: { type: "number", description: "ROAS esperado baseado em dados históricos" },
                placements: { type: "string", description: "Posicionamentos (ex: Feed, Stories, Reels, Advantage+)" },
                adsets: {
                  type: "array",
                  description: "OBRIGATÓRIO: Lista dos conjuntos de anúncios desta campanha. TOF deve ter ≥2 conjuntos com públicos distintos. Testes devem ter 1 conjunto por anúncio (ABO). BOF deve ter ≥2 conjuntos segmentados.",
                  items: {
                    type: "object",
                    properties: {
                      adset_name: { type: "string", description: "Nome do conjunto (ex: CJ1 - Broad | TOF)" },
                      audience_type: { type: "string", enum: ["broad", "interest", "lookalike", "custom", "retargeting"], description: "Tipo de audiência deste conjunto" },
                      audience_description: { type: "string", description: "Descrição do público deste conjunto (ex: Público amplo Homens 30-65 BR, LAL 1% compradores 180d, Visitantes 14d)" },
                      budget_brl: { type: "number", description: "Orçamento diário deste conjunto em R$ (ABO) — obrigatório em campanhas de teste; opcional em CBO" },
                      ads_count: { type: "number", description: "Número de anúncios neste conjunto" },
                    },
                    required: ["adset_name", "audience_type", "audience_description", "ads_count"],
                  },
                },
              },
              required: ["action_type", "campaign_type", "product_name", "daily_budget_brl", "target_audience", "funnel_stage", "rationale", "creatives_count", "adsets"],
            }, 
            description: "Lista de ações planejadas — OBRIGATÓRIO: cada campanha de create_campaign DEVE incluir o campo 'adsets' detalhando TODOS os conjuntos de anúncios com seus públicos. TOF ≥2 conjuntos, Teste = 1 conjunto por anúncio (ABO), BOF ≥2 conjuntos segmentados." 
          },
          budget_allocation: {
            type: "object",
            properties: {
              total_daily_brl: { type: "number", description: "Orçamento diário total em R$" },
              tof_pct: { type: "number", description: "% alocado para TOF (aquisição)" },
              bof_pct: { type: "number", description: "% alocado para BOF (remarketing)" },
              test_pct: { type: "number", description: "% alocado para testes" },
              tof_brl: { type: "number", description: "Valor em R$ para TOF" },
              bof_brl: { type: "number", description: "Valor em R$ para BOF" },
              test_brl: { type: "number", description: "Valor em R$ para testes" },
            },
            required: ["total_daily_brl", "tof_pct", "bof_pct", "test_pct", "tof_brl", "bof_brl", "test_brl"],
            description: "Alocação detalhada de orçamento por funil — DEVE somar 100% do budget disponível",
          },
          expected_results: { type: "string", description: "Projeção QUANTITATIVA de resultados: ROAS esperado por campanha, CPA alvo, conversões estimadas, receita projetada. Usar dados históricos como base." },
          risk_assessment: { type: "string", description: "Riscos específicos com probabilidade e mitigação para cada um" },
          timeline: { type: "string", description: "Cronograma detalhado: Dia 1 (o quê), Dia 2-3 (o quê), Semana 1 (review), etc." },
        },
        required: ["diagnosis", "planned_actions", "budget_allocation", "expected_results", "risk_assessment", "timeline"],
        additionalProperties: false,
      },
    },
  },
];

// ============ PLATFORM LIMITS ============

const PLATFORM_LIMITS: Record<string, { max_change_pct: number; min_interval_hours: number }> = {
  meta: { max_change_pct: 20, min_interval_hours: 48 },
  google: { max_change_pct: 20, min_interval_hours: 168 },
  tiktok: { max_change_pct: 15, min_interval_hours: 48 },
};

function canAdjustBudget(config: AccountConfig): boolean {
  if (!config.last_budget_adjusted_at) return true;
  const limit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.meta;
  const lastAdj = new Date(config.last_budget_adjusted_at).getTime();
  const hoursSince = (Date.now() - lastAdj) / (1000 * 60 * 60);
  return hoursSince >= limit.min_interval_hours;
}

// ============ DEEP HISTORICAL INSIGHTS (Meta API) ============

interface DeepInsight {
  level: string; // "campaign" | "adset" | "ad"
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
  roas: number;
  cpa: number;
  ctr: number;
  frequency?: number;
  // Breakdowns
  placements?: Record<string, { spend: number; conversions: number; roas: number }>;
  creative_data?: any;
  targeting?: any;
  campaign_id?: string;
  adset_id?: string;
}

async function fetchDeepHistoricalInsights(
  supabase: any,
  tenantId: string,
  adAccountId: string
): Promise<{ campaigns: DeepInsight[]; adsets: DeepInsight[]; ads: DeepInsight[] } | null> {
  const GRAPH_API = "v21.0";

  // Helper to paginate through all Graph API results with rate-limit protection
  async function fetchAllPages(url: string, maxPages = 10, delayMs = 1500): Promise<any[]> {
    const allData: any[] = [];
    let nextUrl: string | null = url;
    let page = 0;
    while (nextUrl && page < maxPages) {
      if (page > 0) await new Promise(r => setTimeout(r, delayMs)); // Rate-limit delay
      const res = await fetch(nextUrl);
      const json = await res.json();
      if (json.error) {
        console.error(`[ads-autopilot-strategist][${VERSION}] Graph API pagination error:`, json.error.message);
        break;
      }
      allData.push(...(json.data || []));
      nextUrl = json.paging?.next || null;
      page++;
    }
    return allData;
  }
  
  // Get Meta connection
  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn?.access_token) {
    console.warn(`[ads-autopilot-strategist][${VERSION}] No Meta connection for deep insights`);
    return null;
  }

  const accountId = adAccountId.replace("act_", "");
  const token = conn.access_token;

  // Helper to fetch insights at a given level
  async function fetchLevelInsights(level: "campaign" | "adset" | "ad"): Promise<any[]> {
    const endpoint = level === "campaign" ? "campaigns" : level === "adset" ? "adsets" : "ads";
    const fieldsMap: Record<string, string> = {
      campaign: "id,name,status,effective_status,objective",
      adset: "id,name,status,effective_status,campaign_id,optimization_goal,daily_budget,lifetime_budget",
      ad: "id,name,status,effective_status,adset_id,campaign_id,creative{id,name,title,body}",
    };
    // Smaller page sizes to avoid "reduce data" errors; campaigns can use 200, deeper levels use 100
    const pageSize = level === "campaign" ? 200 : 100;
    // Ads have heavy creative subfields - use fewer pages
    const maxEntityPages = level === "ad" ? 5 : 8;
    const maxInsightPages = level === "campaign" ? 5 : 3;

    try {
      // Step 1: Get entities (with pagination + delay)
      const entitiesUrl = `https://graph.facebook.com/${GRAPH_API}/act_${accountId}/${endpoint}?fields=${fieldsMap[level]}&limit=${pageSize}&access_token=${token}`;
      const entities = await fetchAllPages(entitiesUrl, maxEntityPages, 2000);
      if (entities.length === 0) {
        console.warn(`[ads-autopilot-strategist][${VERSION}] No ${level} entities found`);
        return [];
      }
      console.log(`[ads-autopilot-strategist][${VERSION}] Fetched ${entities.length} ${level} entities`);

      // Delay between entity fetch and insights fetch to respect rate limits
      await new Promise(r => setTimeout(r, 3000));

      // Step 2: Get insights with date_preset=maximum (with pagination + delay)
      const insightFields = level === "campaign"
        ? "campaign_id,campaign_name,spend,impressions,clicks,actions,action_values,ctr,cpc,cpm,frequency"
        : level === "adset"
        ? "adset_id,adset_name,campaign_id,spend,impressions,clicks,actions,action_values,ctr,cpc,frequency"
        : "ad_id,ad_name,adset_id,campaign_id,spend,impressions,clicks,actions,action_values,ctr,cpc";
      const insightsUrl = `https://graph.facebook.com/${GRAPH_API}/act_${accountId}/insights?level=${level}&fields=${insightFields}&date_preset=maximum&limit=${pageSize}&access_token=${token}`;
      const insightsData = await fetchAllPages(insightsUrl, maxInsightPages, 2000);
      console.log(`[ads-autopilot-strategist][${VERSION}] Fetched ${insightsData.length} ${level} insight rows`);

      // Step 3: Get placement breakdown (only for campaign level to reduce API calls)
      let placementMap: Record<string, any[]> = {};
      if (level === "campaign") {
        await new Promise(r => setTimeout(r, 2000));
        const placementUrl = `https://graph.facebook.com/${GRAPH_API}/act_${accountId}/insights?level=${level}&fields=campaign_id,campaign_name,spend,impressions,clicks,actions,action_values&breakdowns=publisher_platform,platform_position&date_preset=maximum&limit=200&access_token=${token}`;
        const placData = await fetchAllPages(placementUrl, 3, 2000);
        for (const row of placData) {
          const key = row.campaign_id;
          if (!placementMap[key]) placementMap[key] = [];
          placementMap[key].push(row);
        }
      }

      // Merge insights with entities
      const insightsMap: Record<string, any> = {};
      for (const ins of insightsData) {
        const key = level === "campaign" ? ins.campaign_id : level === "adset" ? ins.adset_id : ins.ad_id;
        insightsMap[key] = ins;
      }

      const withInsights = entities.filter((e: any) => insightsMap[e.id]);
      console.log(`[ads-autopilot-strategist][${VERSION}] ${level}: ${withInsights.length}/${entities.length} entities have insights`);

      return entities.map((e: any) => ({
        ...e,
        insights: insightsMap[e.id] || null,
        placement_breakdown: placementMap[e.id] || null,
      }));
    } catch (err: any) {
      console.error(`[ads-autopilot-strategist][${VERSION}] fetchLevelInsights(${level}) error:`, err.message);
      return [];
    }
  }

  // Helper to extract conversions and revenue from Meta actions array
  function extractConversions(actions: any[]): { conversions: number; revenue: number } {
    let conversions = 0;
    let revenue = 0;
    if (!actions) return { conversions, revenue };
    for (const a of actions) {
      if (a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase") {
        conversions += parseInt(a.value || "0");
      }
    }
    return { conversions, revenue };
  }

  function extractRevenue(actionValues: any[]): number {
    if (!actionValues) return 0;
    for (const a of actionValues) {
      if (a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase") {
        return parseFloat(a.value || "0");
      }
    }
    return 0;
  }

  // Fetch levels SEQUENTIALLY to avoid rate limiting (each level makes multiple paginated calls)
  const rawCampaigns = await fetchLevelInsights("campaign");
  console.log(`[ads-autopilot-strategist][${VERSION}] Campaigns done, waiting before adsets...`);
  await new Promise(r => setTimeout(r, 5000)); // 5s cool-down between levels
  const rawAdsets = await fetchLevelInsights("adset");
  console.log(`[ads-autopilot-strategist][${VERSION}] Adsets done, waiting before ads...`);
  await new Promise(r => setTimeout(r, 5000)); // 5s cool-down between levels
  const rawAds = await fetchLevelInsights("ad");

  console.log(`[ads-autopilot-strategist][${VERSION}] Deep historical: ${rawCampaigns.length} campaigns, ${rawAdsets.length} adsets, ${rawAds.length} ads`);

  // Transform into structured insights
  function transformEntity(raw: any, level: string): DeepInsight {
    const ins = raw.insights || {};
    const spend = parseFloat(ins.spend || "0");
    const impressions = parseInt(ins.impressions || "0");
    const clicks = parseInt(ins.clicks || "0");
    const { conversions } = extractConversions(ins.actions);
    const revenue = extractRevenue(ins.action_values);
    const roas = spend > 0 ? Math.round((revenue / spend) * 100) / 100 : 0;
    const cpa = conversions > 0 ? Math.round((spend / conversions) * 100) / 100 : 0;
    const ctr = impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0;

    // Build placement breakdown
    let placements: Record<string, any> | undefined;
    if (raw.placement_breakdown) {
      placements = {};
      for (const row of raw.placement_breakdown) {
        const key = `${row.publisher_platform || "unknown"}_${row.platform_position || "unknown"}`;
        const pSpend = parseFloat(row.spend || "0");
        const { conversions: pConv } = extractConversions(row.actions);
        const pRevenue = extractRevenue(row.action_values);
        placements[key] = {
          spend: pSpend,
          conversions: pConv,
          roas: pSpend > 0 ? Math.round((pRevenue / pSpend) * 100) / 100 : 0,
        };
      }
    }

    return {
      level,
      id: raw.id,
      name: raw.name || ins[`${level}_name`] || "",
      status: raw.status || raw.effective_status || "",
      spend, impressions, clicks, conversions, roas, cpa, ctr,
      frequency: ins.frequency ? parseFloat(ins.frequency) : undefined,
      placements,
      creative_data: level === "ad" ? raw.creative : undefined,
      targeting: level === "adset" ? raw.targeting : undefined,
      campaign_id: raw.campaign_id,
      adset_id: raw.adset_id,
    };
  }

  return {
    campaigns: rawCampaigns.map((r: any) => transformEntity(r, "campaign")),
    adsets: rawAdsets.map((r: any) => transformEntity(r, "adset")),
    ads: rawAds.map((r: any) => transformEntity(r, "ad")),
  };
}

// ============ CONTEXT COLLECTOR ============

async function collectStrategistContext(supabase: any, tenantId: string, configs: AccountConfig[], trigger?: StrategistTrigger) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  // Parallel data collection — DEEP CONTEXT
  const [
    productsRes,
    ordersRes,
    campaignsRes,
    insights30dRes,
    insights7dRes,
    adsetsRes,
    adsRes,
    audiencesRes,
    recentCreativesRes,
    recentActionsRes,
    experimentsRes,
    marketingRes,
    storeRes,
    tenantRes,
    storePagesRes,
    landingPagesRes,
    globalConfigRes,
    categoriesRes,
  ] = await Promise.all([
    supabase.from("products").select("id, name, slug, price, cost_price, status, stock_quantity, brand, short_description").eq("tenant_id", tenantId).eq("status", "active").order("name", { ascending: true }).limit(30),
    supabase.from("orders").select("id, total, status, payment_status, created_at").eq("tenant_id", tenantId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).limit(500),
    supabase.from("meta_ad_campaigns").select("meta_campaign_id, name, status, effective_status, objective, daily_budget_cents, ad_account_id").eq("tenant_id", tenantId).limit(200),
    supabase.from("meta_ad_insights").select("meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, date_start").eq("tenant_id", tenantId).gte("date_start", thirtyDaysAgo).limit(1000),
    supabase.from("meta_ad_insights").select("meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, date_start").eq("tenant_id", tenantId).gte("date_start", sevenDaysAgo).limit(500),
    supabase.from("meta_ad_adsets").select("meta_adset_id, name, status, effective_status, meta_campaign_id, daily_budget_cents, lifetime_budget_cents, optimization_goal, billing_event, bid_amount_cents, targeting, ad_account_id").eq("tenant_id", tenantId).limit(500),
    supabase.from("meta_ad_ads").select("meta_ad_id, name, status, effective_status, meta_adset_id, meta_campaign_id, ad_account_id, creative_id, creative_data").eq("tenant_id", tenantId).limit(500),
    supabase.from("meta_ad_audiences").select("meta_audience_id, name, audience_type, subtype, ad_account_id, approximate_count").eq("tenant_id", tenantId).limit(100),
    supabase.from("ads_creative_assets").select("id, channel, format, status, product_id, created_at").eq("tenant_id", tenantId).gte("created_at", sevenDaysAgo).limit(50),
    supabase.from("ads_autopilot_actions").select("action_type, action_data, status, channel, created_at").eq("tenant_id", tenantId).gte("created_at", sevenDaysAgo).limit(200),
    supabase.from("ads_autopilot_experiments").select("*").eq("tenant_id", tenantId).in("status", ["active", "completed"]).limit(20),
    supabase.from("marketing_integrations").select("meta_pixel_id").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("store_settings").select("store_name, store_description, seo_title, seo_description").eq("tenant_id", tenantId).maybeSingle(),
    supabase.from("tenants").select("name, slug, settings").eq("id", tenantId).single(),
    supabase.from("store_pages").select("title, slug, type, status, is_published, seo_title").eq("tenant_id", tenantId).eq("is_published", true).limit(30),
    supabase.from("ai_landing_pages").select("name, slug, status, is_published, seo_title, product_ids").eq("tenant_id", tenantId).eq("status", "active").limit(20),
    supabase.from("ads_autopilot_configs").select("*").eq("tenant_id", tenantId).eq("channel", "global").maybeSingle(),
    supabase.from("categories").select("name, slug").eq("tenant_id", tenantId).limit(30),
  ]);

  const products = productsRes.data || [];
  const orders = ordersRes.data || [];
  const campaigns = campaignsRes.data || [];
  const insights30d = insights30dRes.data || [];
  const insights7d = insights7dRes.data || [];
  const adsets = adsetsRes.data || [];
  const ads = adsRes.data || [];
  const audiences = audiencesRes.data || [];
  const recentCreatives = recentCreativesRes.data || [];
  const recentActions = recentActionsRes.data || [];
  const experiments = experimentsRes.data || [];
  const metaPixelId = marketingRes.data?.meta_pixel_id || null;
  const storeSettings = storeRes.data || null;
  const tenant = tenantRes.data || null;
  const storePages = storePagesRes.data || [];
  const landingPages = landingPagesRes.data || [];
  const globalConfig = globalConfigRes.data || null;
  const categories = categoriesRes.data || [];

  // Resolve store URL from tenant_domains (source of truth)
  const { data: domainRow } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenantId).eq("type", "custom").eq("is_primary", true).maybeSingle();
  const storeUrl = domainRow?.domain ? `https://${domainRow.domain}` : (tenant?.slug ? `https://${tenant.slug}.comandocentral.com.br` : null);
  const checkoutUrl = storeUrl ? `${storeUrl}/checkout` : null;

  // Fetch product images for top products
  const productIds = products.map((p: any) => p.id);
  const { data: productImages } = productIds.length > 0
    ? await supabase.from("product_images").select("product_id, image_url, sort_order").in("product_id", productIds).order("sort_order", { ascending: true })
    : { data: [] };
  const imagesByProduct: Record<string, string[]> = {};
  (productImages || []).forEach((img: any) => {
    if (!imagesByProduct[img.product_id]) imagesByProduct[img.product_id] = [];
    imagesByProduct[img.product_id].push(img.image_url);
  });

  // Build page links for the AI
  const pageLinks = storePages.map((p: any) => ({
    title: p.title,
    url: storeUrl ? `${storeUrl}/p/${p.slug}` : `/p/${p.slug}`,
    type: p.type,
  }));
  const lpLinks = landingPages.map((lp: any) => ({
    name: lp.name,
    url: storeUrl ? `${storeUrl}/lp/${lp.slug}` : `/lp/${lp.slug}`,
    products: lp.product_ids,
  }));

  // Compute per-campaign performance
  const buildPerf = (insights: any[]) => {
    const perf: Record<string, any> = {};
    for (const ins of insights) {
      const cid = ins.meta_campaign_id;
      if (!perf[cid]) perf[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, days: new Set() };
      perf[cid].spend += ins.spend_cents || 0;
      perf[cid].impressions += ins.impressions || 0;
      perf[cid].clicks += ins.clicks || 0;
      perf[cid].conversions += ins.conversions || 0;
      perf[cid].revenue += (ins.roas || 0) * (ins.spend_cents || 0);
      perf[cid].days.add(ins.date_start);
    }
    for (const cid of Object.keys(perf)) {
      const p = perf[cid];
      perf[cid] = {
        ...p, days: p.days.size,
        roas: safeDivide(p.revenue, p.spend),
        cpa_cents: safeDivide(p.spend, p.conversions),
        ctr_pct: safeDivide(p.clicks * 100, p.impressions),
      };
    }
    return perf;
  };

  const perf30d = buildPerf(insights30d);
  const perf7d = buildPerf(insights7d);

  // Campaign → account mapping
  const campaignAccountMap: Record<string, string> = {};
  for (const c of campaigns) {
    if (c.ad_account_id) campaignAccountMap[c.meta_campaign_id] = c.ad_account_id;
  }

  // Order stats
  const paidOrders = orders.filter((o: any) => o.payment_status === "paid" || o.status === "delivered");
  const orderStats = {
    total_30d: orders.length,
    paid_30d: paidOrders.length,
    revenue_cents_30d: paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
    avg_ticket_cents: paidOrders.length > 0 ? Math.round(paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0) / paidOrders.length) : 0,
  };

  // Creative cadence check — use all non-variant products (variant filtering via regex)
  const variantRegex = /\s*\(\d+x\)|\s*\(FLEX\)|\s*\(Dia\)|\s*\(Noite\)/i;
  const mainProducts = products.filter((p: any) => !variantRegex.test(p.name));
  const topProducts = mainProducts.slice(0, 8);
  const creativeCadence = topProducts.map((p: any) => ({
    product_id: p.id,
    product_name: p.name,
    creatives_this_week: recentCreatives.filter((c: any) => c.product_id === p.id).length,
    needs_more: recentCreatives.filter((c: any) => c.product_id === p.id).length < 3,
  }));

  // === DEEP HISTORICAL INSIGHTS (only for "start" trigger) ===
  let deepHistorical: Record<string, any> | null = null;
  if (trigger === "start") {
    console.log(`[ads-autopilot-strategist][${VERSION}] Fetching deep historical insights for start trigger...`);
    const accountIds = configs.map(c => c.ad_account_id);
    deepHistorical = {};
    for (const acctId of accountIds) {
      const result = await fetchDeepHistoricalInsights(supabase, tenantId, acctId);
      if (result) {
        deepHistorical[acctId] = result;
        console.log(`[ads-autopilot-strategist][${VERSION}] Deep historical for ${acctId}: ${result.campaigns.length} campaigns, ${result.adsets.length} adsets, ${result.ads.length} ads`);
      }
    }
  }

  return {
    products,
    categories,
    orderStats,
    campaigns,
    perf30d,
    perf7d,
    adsets,
    ads,
    audiences,
    campaignAccountMap,
    recentActions,
    experiments,
    creativeCadence,
    recentCreatives,
    metaPixelId,
    storeSettings,
    tenant,
    storeUrl,
    checkoutUrl,
    pageLinks,
    lpLinks,
    globalConfig,
    imagesByProduct,
    deepHistorical,
  };
}

// ============ BUILD STRATEGIST PROMPT ============

function buildStrategistPrompt(trigger: StrategistTrigger, config: AccountConfig, context: any) {
  // Filter campaigns for this account
  const accountCampaignIds = Object.entries(context.campaignAccountMap || {})
    .filter(([_, acctId]) => acctId === config.ad_account_id)
    .map(([campId]) => campId);

  const accountCampaigns = context.campaigns.filter((c: any) =>
    accountCampaignIds.includes(c.meta_campaign_id) || c.ad_account_id === config.ad_account_id
  );

  const activeCampaigns = accountCampaigns.filter((c: any) => c.status === "ACTIVE");
  const pausedCampaigns = accountCampaigns.filter((c: any) => c.status === "PAUSED");

  const accountAdsets = context.adsets.filter((as: any) => as.ad_account_id === config.ad_account_id);
  const accountAudiences = context.audiences.filter((a: any) => a.ad_account_id === config.ad_account_id);

  const minRoiCold = config.min_roi_cold || 0.8;
  const minRoiWarm = config.min_roi_warm || 1.5;
  const targetRoi = config.target_roi;
  const roasThreshold = config.roas_scaling_threshold;
  const platformLimit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.meta;
  const budgetAdjustable = canAdjustBudget(config);

  // Build campaign data with perf
  const campaignData = accountCampaigns.map((c: any) => {
    const p30 = context.perf30d[c.meta_campaign_id] || {};
    const p7 = context.perf7d[c.meta_campaign_id] || {};
    return {
      id: c.meta_campaign_id, name: c.name, status: c.status,
      effective_status: c.effective_status, objective: c.objective,
      budget_cents: c.daily_budget_cents,
      perf_30d: p30.days ? { roas: p30.roas, cpa: p30.cpa_cents, spend: p30.spend, conversions: p30.conversions, ctr: p30.ctr_pct, days: p30.days } : null,
      perf_7d: p7.days ? { roas: p7.roas, cpa: p7.cpa_cents, spend: p7.spend, conversions: p7.conversions, ctr: p7.ctr_pct, days: p7.days } : null,
    };
  });

  // Creative cadence for this account's products
  const creativeCadence = context.creativeCadence || [];

  // Weekly actions summary
  const weeklyActions = context.recentActions.filter((a: any) => a.action_data?.ad_account_id === config.ad_account_id);
  const actionsSummary = {
    pauses: weeklyActions.filter((a: any) => a.action_type === "pause_campaign" && a.status === "executed").length,
    budget_adjustments: weeklyActions.filter((a: any) => a.action_type === "adjust_budget").length,
    campaigns_created: weeklyActions.filter((a: any) => a.action_type === "create_campaign").length,
    creatives_generated: weeklyActions.filter((a: any) => a.action_type === "generate_creative").length,
  };

  let triggerInstruction = "";
  switch (trigger) {
    case "start":
      triggerInstruction = `## TRIGGER: PRIMEIRA ATIVAÇÃO (Planejamento Estratégico com Análise Histórica Completa)
Nesta fase, você DEVE emitir APENAS um strategic_plan. NÃO crie campanhas, criativos ou públicos agora.
O usuário precisa APROVAR o plano antes de qualquer implementação.

## ANÁLISE HISTÓRICA PROFUNDA (PERÍODO MÁXIMO)
Você recebeu dados históricos COMPLETOS da conta de anúncios (período máximo disponível na Meta).
Esses dados incluem métricas por campanha, por conjunto de anúncios (público/audiência) e por anúncio individual,
além de breakdowns por posicionamento (Feed, Reels, Stories, etc.).

**ANÁLISE OBRIGATÓRIA POR TIPO DE CAMPANHA:**
1. **Público Frio (TOF/Aquisição):**
   - Quais PÚBLICOS (audiences/adsets) tiveram melhor ROAS e CPA historicamente?
   - Quais CRIATIVOS (ads) converteram mais? Que tipo de copy/headline funcionou?
   - Quais POSICIONAMENTOS (Feed, Reels, Stories) trouxeram mais conversões com menor CPA?
   - Quais produtos tiveram melhor performance em TOF?

2. **Remarketing (BOF):**
   - Quais segmentos de remarketing (visitantes, ATC, IC) converteram melhor?
   - Quais criativos e copys funcionaram melhor para remarketing?
   - Qual o ROAS médio histórico de remarketing?

3. **Testes:**
   - Quais testes A/B foram realizados? Resultados?
   - O que aprendemos sobre o que funciona e o que não funciona?

**DIAGNÓSTICO BASEADO EM DADOS HISTÓRICOS (OBRIGATÓRIO):**
No campo diagnosis do plano, inclua OBRIGATORIAMENTE:
- Top 5 públicos que mais converteram (nome, ROAS, CPA, conversões)
- Top 5 criativos/anúncios que mais converteram (nome, métricas)
- Top 3 posicionamentos que mais converteram (plataforma_posição, ROAS)
- Campanhas pausadas que tiveram bom desempenho (oportunidades de reativação/duplicação)
- Campanhas que falharam (o que evitar)

Seu plano estratégico DEVE incluir:
1. **Diagnóstico**: Análise histórica COMPLETA da conta (ver acima) + situação atual
2. **Ações Planejadas** (lista DETALHADA e ESPECÍFICA):
   - Para CADA campanha a criar: tipo (TOF/Teste/Remarketing/Duplicação), produto específico, orçamento diário, público-alvo
   - PRIORIZE replicar os públicos e formatos que HISTORICAMENTE converteram melhor
   - Campanhas de TESTE: mínimo 3 produtos diferentes, com criativos variados
   - Campanhas de DUPLICAÇÃO de vencedores: para escalar o que já funciona
   - Campanha de REMARKETING: segmentada por temperatura
   - Quantidade de copies por campanha: mínimo 2-4 variações de Primary Text + Headlines
3. **Alocação de Orçamento**: Distribuição clara entre funis (cold, remarketing, tests)
4. **Resultados Esperados**: Projeção realista baseada nos DADOS HISTÓRICOS REAIS
5. **Riscos**: O que pode dar errado

{{DEEP_HISTORICAL_DATA}}

REGRAS:
- O plano DEVE utilizar 100% do orçamento disponível (R$ ${((config.budget_cents || 0) / 100).toFixed(2)}/dia)
- NÃO use create_campaign, generate_creative ou qualquer outra ferramenta além de strategic_plan
- Seja ESPECÍFICO: nomes de produtos reais, valores exatos de orçamento, públicos detalhados
- Base TODAS as decisões nos dados históricos — não "invente" estratégias sem evidência`;
      break;
    case "weekly":
      triggerInstruction = `## TRIGGER: REVISÃO SEMANAL (Sábado → implementação Domingo 00:01)
Pipeline em 5 fases — execute TODAS:
1. **PLANNING**: Revise performance 7d vs 30d. Emita strategic_plan com diagnóstico.
2. **CRIATIVOS**: Verifique cadência criativa (mín 3/semana por top product). Gere faltantes.
3. **PÚBLICOS**: Avalie se Lookalikes existentes performam. Sugira novos se necessário.
4. **MONTAGEM**: Proponha novas campanhas se há oportunidade (ROAS > threshold + budget disponível).
5. **PUBLICAÇÃO**: Ajuste budgets (agendados para 00:01). Novas campanhas PAUSADAS → ativação agendada.

FOCO SEMANAL: Otimização incremental. Não reestruture tudo.`;
      break;
    case "monthly":
      triggerInstruction = `## TRIGGER: REVISÃO MENSAL (Dia 1 → planejamento do próximo mês)
ATENÇÃO: Use EXCLUSIVAMENTE os dados dos últimos 30 dias para esta análise. NÃO consulte dados históricos mais antigos.

Você DEVE emitir um strategic_plan com o PLANO PARA O PRÓXIMO MÊS. Mesmo que a conclusão seja manter o plano atual,
você DEVE emitir um novo plano estratégico justificando a manutenção com dados dos últimos 30 dias.

Análise OBRIGATÓRIA dos últimos 30 dias:
1. **DIAGNÓSTICO MENSAL**: 
   - Performance de CADA campanha ativa nos últimos 30d (ROAS, CPA, conversões, gasto)
   - Performance de CADA conjunto de anúncios (quais públicos converteram melhor?)
   - Performance de CADA anúncio (quais criativos/copys tiveram melhor CTR e conversão?)
   - Comparação com mês anterior (se disponível): melhorou ou piorou?
   - ROI real, custo por aquisição, ticket médio
2. **CRIATIVOS**: Identifique criativos com >30d (fadiga criativa). Proponha renovação.
3. **PÚBLICOS**: Reavalie TODOS os públicos. Expire Lookalikes com ROAS < mínimo. Proponha novos.
4. **CAMPANHAS**: Reestruturação se necessário. Proponha novas campanhas por funil.
5. **ORÇAMENTO**: Redistribuição de verba baseada nos resultados do mês.

O PLANO DEVE conter:
- Ações específicas para o próximo mês (criar, pausar, escalar, testar)
- Redistribuição de orçamento se necessário
- Metas quantitativas para o próximo mês (ROAS alvo, CPA alvo, conversões esperadas)
- Testes propostos para o mês seguinte

REGRA: Mesmo que tudo esteja funcionando bem, SEMPRE emita um strategic_plan — pode ser para MANTER a estratégia atual,
mas com justificativa baseada em dados e ajustes incrementais (ex: escalar vencedores, pausar perdedores).`;
      break;
    case "implement_approved_plan":
      // Phase 1: ONLY generate creatives and audiences — campaigns come in Phase 2
      triggerInstruction = `## TRIGGER: IMPLEMENTAÇÃO DE PLANO APROVADO — FASE 1 (CRIATIVOS E PÚBLICOS)
O usuário APROVOU o Plano Estratégico abaixo. Esta é a FASE 1: preparação de ativos.

{{APPROVED_PLAN_CONTENT}}

## CRIATIVOS JÁ EXISTENTES (NÃO GERAR DUPLICADOS!)
{{EXISTING_CREATIVES_INVENTORY}}

NESTA FASE VOCÊ DEVE:
1. **PRIMEIRO**: Verificar os criativos já existentes listados acima
   - Se já existir um criativo pronto (status=ready, com URL) para o produto + funnel_stage + formato desejado → NÃO gere novo, REUTILIZE
   - Gere novos criativos (generate_creative) APENAS para combinações (produto × funnel_stage × formato) que NÃO existam no inventário acima
2. Para criativos que precisam ser gerados:
   - Mínimo 2 variações por produto (estilos diferentes: ugc_style, product_natural, person_interacting)
   - Formatos: 9:16 para Stories/Reels + 1:1 para Feed
   - OBRIGATÓRIO: funnel_stage diferente para cada uso! Gere criativos SEPARADOS para TOF e BOF
   - Criativos de TOF (aquisição): estilo chamativo, gancho de atenção, produto em destaque
   - Criativos de BOF (remarketing): estilo diferente, foco em benefícios complementares, prova social
3. Criar públicos Lookalike (create_lookalike_audience) se o plano especificar

NESTA FASE VOCÊ NÃO DEVE:
- NÃO use create_campaign — campanhas serão criadas na FASE 2 (após criativos ficarem prontos)
- NÃO use create_adset — será feito na FASE 2
- NÃO use strategic_plan — o plano já foi aprovado
- NÃO use adjust_budget — será feito na FASE 2

A FASE 2 será disparada AUTOMATICAMENTE quando todos os criativos estiverem prontos.`;
      break;
    case "implement_campaigns":
      // Phase 2: Create campaigns WITH creative URLs already available
      triggerInstruction = `## TRIGGER: IMPLEMENTAÇÃO DE PLANO APROVADO — FASE 2 (CAMPANHAS)
Todos os criativos da Fase 1 estão PRONTOS. Agora é hora de criar as campanhas.

{{APPROVED_PLAN_CONTENT}}

CRIATIVOS DISPONÍVEIS (já gerados na Fase 1):
{{AVAILABLE_CREATIVES}}

NESTA FASE VOCÊ DEVE:
1. Criar TODAS as campanhas do plano aprovado usando create_campaign
   - CADA campanha DEVE ter entre 2 e 4 primary_texts (variações de copy)
   - CADA campanha DEVE ter entre 2 e 4 headlines
   - Copys devem atacar ângulos DIFERENTES (benefício, objeção, prova social, urgência)
   - Headlines curtas e diretas (máx 40 chars)
   - Inclua descriptions e CTA adequado
2. Criar ad sets (create_adset) para segmentações dentro das campanhas

REGRAS ESTRUTURAIS (INVIOLÁVEIS):
- **REMARKETING vs TOF**: Copys e criativos de remarketing DEVEM ser DIFERENTES dos de venda direta. O público já viu os anúncios TOF. Use ângulos: objeção, urgência, prova social, benefícios complementares.
- **CAMPANHAS DE TESTE**: Cada anúncio em seu PRÓPRIO adset (1:1). Use ABO (budget no adset, NÃO no nível de campanha). Budget dividido igualmente entre variações.
- **VENDA DIRETA (TOF)**: Criar MÚLTIPLOS adsets com públicos DIFERENTES (broad, interesses, lookalikes). Anúncios podem repetir entre adsets, mas targeting DEVE variar. Mínimo 2 adsets.
3. Ajustar budgets (adjust_budget) de campanhas existentes, se o plano pedir

REGRAS CRÍTICAS:
- Use EXATAMENTE os produtos do plano para cada campanha/funil
- O orçamento TOTAL do plano deve ser RESPEITADO — verba ociosa é proibida
- Tudo criado PAUSADO. Ativações agendadas para 00:01-04:00 BRT
- Aumentos de budget limitados a +20% por campanha existente
- NUNCA use copy genérica como "Conheça nosso produto" — seja específico
- destination_url: Use URL com SLUG do produto (não UUID)

NESTA FASE VOCÊ NÃO DEVE:
- NÃO use generate_creative — criativos já foram gerados
- NÃO use strategic_plan — o plano já foi aprovado`;
      break;
  }

  const storeName = context.storeSettings?.store_name || context.tenant?.name || "Loja";
  const storeDescription = context.storeSettings?.store_description || context.storeSettings?.seo_description || "";
  const categoryNames = context.categories?.map((c: any) => c.name).join(", ") || "";

  const system = `Você é o Motor Estrategista do Autopilot de Tráfego — focado em CRESCIMENTO ESTRATÉGICO.

## LOJA / MARCA
- Nome: ${storeName}
- Descrição: ${storeDescription || "Não informada"}
- URL da Loja: ${context.storeUrl || "Não configurada"}
- URL de Checkout: ${context.checkoutUrl || "Não configurada"}
- Categorias: ${categoryNames || "Nenhuma"}

## CONTA DE ANÚNCIOS: ${config.ad_account_id} (${config.channel})
- Orçamento: R$ ${((config.budget_cents || 0) / 100).toFixed(2)} / ${config.budget_mode || "monthly"}
- ROI Mín Frio: ${minRoiCold}x | ROI Mín Quente: ${minRoiWarm}x | ROI Alvo: ${targetRoi || "N/D"}x
- ROAS Scaling: ${roasThreshold ? roasThreshold + "x" : "Não definido"}
- Estratégia: ${config.strategy_mode || "balanced"}
- Splits de Funil: ${config.funnel_splits ? `Frio=${(config.funnel_splits as any).cold || 0}%, Remarketing=${(config.funnel_splits as any).remarketing || 0}%, Testes=${(config.funnel_splits as any).tests || 0}%, Leads=${(config.funnel_splits as any).leads || 0}%` : "AI decides"}
- Limite de ajuste: ±${platformLimit.max_change_pct}% a cada ${platformLimit.min_interval_hours}h
- Pode ajustar budget agora: ${budgetAdjustable ? "SIM" : "NÃO"}
- Modo aprovação: ${config.human_approval_mode || "approve_high_impact"}

## CONFIGURAÇÃO GLOBAL DO AUTOPILOT
${context.globalConfig ? `- Habilitado: ${context.globalConfig.is_enabled ? "SIM" : "NÃO"}
- Modelo AI: ${context.globalConfig.ai_model || "default"}
- Objetivo global: ${context.globalConfig.objective || "N/D"}
- Instruções globais: ${context.globalConfig.user_instructions || "Nenhuma"}` : "Sem configuração global"}

## INSTRUÇÕES ESTRATÉGICAS DO USUÁRIO
${config.user_instructions || "Nenhuma instrução adicional."}

## LINKS E DESTINOS DISPONÍVEIS
- Páginas da Loja: ${context.pageLinks?.length > 0 ? context.pageLinks.map((p: any) => `${p.title} (${p.url})`).join(", ") : "Nenhuma publicada"}
- Landing Pages IA: ${context.lpLinks?.length > 0 ? context.lpLinks.map((lp: any) => `${lp.name} (${lp.url})`).join(", ") : "Nenhuma"}

## REGRAS DO ESTRATEGISTA
- Analise TODO o contexto antes de tomar decisões: produtos, público, campanhas ativas, métricas, links disponíveis e instruções do usuário
- NUNCA delete campanhas/ad sets/anúncios (proibição permanente)
- Campanhas criadas sempre PAUSADAS — ativação agendada para 00:01-04:00 BRT
- Use CBO (Campaign Budget Optimization) por padrão
- Criativos: mínimo 3 variações/semana por top product
- Experimentos: exigem 3x CPA Target spend, 5 dias, 20 cliques ou 5 conversões
- Promoção: variante com CPA < 80% do controle ou ROAS > 120% por 3+ dias → promover
- Responda SEMPRE em Português do Brasil
- Cada tool call deve ter justificativa numérica
- Use os links reais da loja (landing pages, páginas) como destino dos anúncios
- Considere as categorias de produtos e o posicionamento da marca ao criar copys

## REGRAS DE CONFIGURAÇÃO COMPLETA (OBRIGATÓRIAS em create_campaign)
Cada create_campaign é uma campanha COMPLETA no Meta Ads. Você DEVE preencher TODOS os campos abaixo como se estivesse configurando manualmente:

### Nível Campanha:
- campaign_name: Nome descritivo seguindo padrão [AI] Objetivo | Produto | Público | Data
- objective: Objetivo da campanha (OUTCOME_SALES para e-commerce, OUTCOME_LEADS para captação)
- daily_budget_cents: Orçamento diário (CBO)
- special_ad_categories: ["NONE"] na maioria dos casos

### Nível Conjunto (Configurações OBRIGATÓRIAS — como no Meta Ads Manager):
- adset_name: Nome do conjunto (padrão: [AI] CJ - Público | Funil)
- optimization_goal: OBRIGATÓRIO. Use OFFSITE_CONVERSIONS para vendas, LINK_CLICKS para tráfego, LEAD_GENERATION para leads
- billing_event: IMPRESSIONS (padrão) ou LINK_CLICKS
- conversion_event: OBRIGATÓRIO para vendas (PURCHASE) ou leads (LEAD). Sem isso o pixel não otimiza!
- conversion_location: Local da conversão — "Site" para e-commerce (padrão). Nunca "Site e App" a menos que tenha app.
- performance_goal: Meta de desempenho — "Maximizar Conversões" (padrão) ou "Maximizar Valor das Conversões" para ROAS
- attribution_model: Modelo de atribuição — "Padrão" (padrão) ou "Incremental"

IMPORTANTE: No planned_actions do plano estratégico, inclua OBRIGATORIAMENTE: performance_goal, conversion_location e attribution_model para cada ação. Essas são as configurações reais do Conjunto de Anúncios que o lojista precisa validar.

### Targeting:
- geo_locations: Sempre definir. Default: {countries: ["BR"]}
- age_min / age_max: Faixa etária adequada ao produto
- genders: [0]=Todos, [1]=Masculino, [2]=Feminino
- interests: Usar IDs reais de interesses do Meta (disponíveis nos públicos da conta)
- custom_audience_ids / excluded_audience_ids: Usar IDs reais de públicos da conta

### Posicionamentos:
- publisher_platforms: Omitir para Automático (Advantage+), ou especificar ["facebook","instagram"]
- position_types: Omitir para Automático, ou especificar ["feed","story","reels"]

### Link & Destino:
- destination_url: OBRIGATÓRIO. URL real do produto, landing page ou loja. NUNCA deixar vazio!
- display_link: Link visual exibido no anúncio (opcional)
- utm_params: Sempre incluir para rastreamento. Ex: {source:"meta", medium:"paid", campaign:"nome"}

### Criativo:
- ad_name: Nome do anúncio
- ad_format: SINGLE_IMAGE (padrão), SINGLE_VIDEO, CAROUSEL ou COLLECTION
- primary_texts: 2-4 variações com ângulos DIFERENTES (benefício, objeção, prova social, urgência)
- headlines: 2-4 variações curtas (máx 40 chars)
- descriptions: 1-2 descrições curtas
- cta: Call to Action adequado (SHOP_NOW para e-commerce, LEARN_MORE para awareness)

### REGRAS CRÍTICAS:
- NUNCA use copy genérica como "Conheça nosso produto" — seja específico sobre o produto e benefícios
- destination_url DEVE ser uma URL real da loja — use os links disponíveis acima
- conversion_event é OBRIGATÓRIO para campanhas de vendas — sem ele o pixel não registra compras
- Se não souber os IDs de interesses, use targeting_type broad (segmentação ampla) — é melhor que inventar IDs

## REGRAS DE COMPLETUDE DO PLANO
- Na primeira ativação, o plano estratégico DEVE cobrir 100% do orçamento disponível
- Tipos de campanha a considerar: TOF (aquisição), Remarketing (catálogo ou custom), Testes (criativos/produtos), Duplicação de vencedores
- Cada campanha planejada deve ter: produto específico, orçamento diário, público-alvo, tipo de funil
- Proibido criar campanhas de remarketing com apenas 1 anúncio — mínimo 2 variações

## REGRAS ESTRUTURAIS OBRIGATÓRIAS (INVIOLÁVEIS)

### 1. CRIATIVOS DIFERENTES POR FUNIL (NÃO REUTILIZAR)
- Campanhas de REMARKETING (BOF/MOF) NUNCA devem usar os mesmos criativos e copys das campanhas de VENDA DIRETA (TOF)
- Motivo: O público de remarketing já viu os anúncios de aquisição. Se virem o mesmo criativo/copy, a taxa de conversão cai drasticamente.
- Na prática: Ao gerar criativos (generate_creative), use funnel_stage="tof" para aquisição e funnel_stage="bof" para remarketing
- Copys de remarketing devem abordar: objeções ("ainda pensando?"), urgência ("últimas unidades"), prova social, benefícios complementares
- Copys de aquisição (TOF) devem abordar: gancho de atenção, benefício principal, curiosidade, transformação
- NUNCA copie primary_texts ou headlines de campanhas TOF para campanhas BOF — escreva copys NOVAS com ângulos diferentes

### 2. CAMPANHAS DE TESTE: 1 CONJUNTO POR ANÚNCIO (ABO) — OBRIGATÓRIO no campo adsets[]
- Em campanhas de TESTE, cada anúncio DEVE estar em seu próprio conjunto de anúncios (Ad Set)
- Use ABO (Ad Set Budget Optimization) em vez de CBO para forçar orçamento igual por anúncio
- Motivo: Evita que a Meta concentre o orçamento em um único anúncio, invalidando o teste
- Se o teste tem 3 variações e budget de R$ 125, cada adset terá R$ 41,67/dia
- NO PLANO (planned_actions): declare CADA conjunto individualmente no array adsets[], com budget_brl = budget_total ÷ nº variações
- Exemplo: adsets = [{adset_name: "CJ1 - Fast Upgrade Ângulo A", ads_count: 1, budget_brl: 41.67}, {adset_name: "CJ2 - Shampoo Ângulo B", ads_count: 1, budget_brl: 41.67}, ...]

### 3. VENDA DIRETA (NÃO-TESTE): MÚLTIPLOS PÚBLICOS — OBRIGATÓRIO no campo adsets[]
- Campanhas de venda direta (TOF, não-teste) DEVEM ter múltiplos conjuntos de anúncios com PÚBLICOS DIFERENTES
- Os anúncios podem ser os mesmos em cada conjunto, mas os públicos (targeting) devem ser diferentes
- Motivo: Testar qual público converte melhor para o mesmo produto, ampliando o alcance qualificado
- Públicos sugeridos: Broad (amplo), Interesses específicos, Lookalikes, Custom Audiences
- Mínimo de 2 conjuntos por campanha de venda direta, idealmente 3-4 quando há budget suficiente
- Use os públicos disponíveis na conta (Custom Audiences, Lookalikes) como base para segmentação
- NO PLANO (planned_actions): declare CADA conjunto no array adsets[], com audience_type e audience_description específicos
- Exemplo: adsets = [{adset_name: "CJ1 - Broad", audience_type: "broad", audience_description: "Homens 30-65 BR sem segmentação", ads_count: 3}, {adset_name: "CJ2 - LAL 1% compradores", audience_type: "lookalike", audience_description: "Lookalike 1% COMPRA 180D", ads_count: 3}]

### 3b. REMARKETING (BOF): SEGMENTOS SEPARADOS — OBRIGATÓRIO no campo adsets[]
- Campanhas de remarketing DEVEM ter conjuntos separados por temperatura de audiência
- Exemplo de adsets: Visitantes 14d (mais frio), ATC 7d (quente), IC 7d (mais quente) — EXCLUINDO compradores recentes
- NO PLANO (planned_actions): declare cada segmento como um conjunto separado no array adsets[]

### 4. URL DE DESTINO (destination_url)
- SEMPRE use a URL real do produto (ex: loja.exemplo.com/produto/slug-do-produto)
- NUNCA use UUIDs na URL — use o slug do produto
- Se não houver URL da loja configurada, use o caminho relativo (/produto/slug)
- Inclua UTM params para rastreamento correto

${triggerInstruction}

## NEGÓCIO
- Ticket Médio: R$ ${(context.orderStats.avg_ticket_cents).toFixed(2)}
- Pedidos 30d: ${context.orderStats.paid_30d} (receita: R$ ${(context.orderStats.revenue_cents_30d).toFixed(2)})
- Catálogo Completo (${context.products.length} produtos ativos):
${context.products.map((p: any) => `  • ${p.name} — R$${Number(p.price).toFixed(2)}${p.cost_price ? ` (margem ~${Math.round(((p.price - p.cost_price) / p.price) * 100)}%)` : ""}${p.stock_quantity != null ? ` [estoque: ${p.stock_quantity}]` : ""}`).join("\n")}

⚠️ IMPORTANTE: A prioridade de produtos para campanhas é definida EXCLUSIVAMENTE pelo Prompt Estratégico do lojista (user_instructions). NÃO use a ordem do catálogo acima como indicador de importância. O catálogo é apenas referência de preços e estoque.`;

  // Build ads data per account
  const accountAds = context.ads?.filter((a: any) => a.ad_account_id === config.ad_account_id) || [];

  // === COMPACT TABULAR FORMAT (v1.33.0) ===
  // Instead of JSON, use TSV-like format to fit ALL data in fewer tokens
  
  // Helper: format currency from cents
  const fmtCents = (v: any) => v != null ? (Number(v) / 100).toFixed(2) : "-";
  const fmtNum = (v: any) => v != null ? String(v) : "-";
  const fmtPct = (v: any) => v != null ? Number(v).toFixed(2) + "%" : "-";
  
  // CAMPAIGNS - ALL of them in compact format
  const campaignHeaders = "ID | Nome | Status | EffStatus | Objetivo | Budget/dia | ROAS30d | CPA30d | Spend30d | Conv30d | CTR30d | ROAS7d | CPA7d | Spend7d | Conv7d";
  const campaignRows = campaignData.map((c: any) => {
    const p30 = c.perf_30d || {};
    const p7 = c.perf_7d || {};
    return `${c.id} | ${c.name} | ${c.status} | ${c.effective_status} | ${c.objective || "-"} | ${fmtCents(c.budget_cents)} | ${fmtNum(p30.roas)} | ${fmtCents(p30.cpa)} | ${fmtNum(p30.spend)} | ${fmtNum(p30.conversions)} | ${fmtPct(p30.ctr)} | ${fmtNum(p7.roas)} | ${fmtCents(p7.cpa)} | ${fmtNum(p7.spend)} | ${fmtNum(p7.conversions)}`;
  }).join("\n");

  // ADSETS - Smart filter: ALL from active campaigns + top from paused (v1.34.0)
  const activeCampaignIds = new Set(activeCampaigns.map((c: any) => c.meta_campaign_id || c.id));
  const activeAdsets = accountAdsets.filter((as: any) => activeCampaignIds.has(as.meta_campaign_id));
  const pausedAdsets = accountAdsets.filter((as: any) => !activeCampaignIds.has(as.meta_campaign_id));
  // Keep top 50 paused adsets by name relevance (most recent usually)
  const selectedPausedAdsets = pausedAdsets.slice(0, 50);
  const filteredAdsets = [...activeAdsets, ...selectedPausedAdsets];
  
  const adsetHeaders = "ID | Nome | Status | EffStatus | CampaignID | BudgetDia | BudgetLife | OptGoal | BillingEvt | BidCents";
  const adsetRows = filteredAdsets.map((as: any) => 
    `${as.meta_adset_id} | ${as.name} | ${as.status} | ${as.effective_status} | ${as.meta_campaign_id} | ${fmtCents(as.daily_budget_cents)} | ${fmtCents(as.lifetime_budget_cents)} | ${as.optimization_goal || "-"} | ${as.billing_event || "-"} | ${fmtNum(as.bid_amount_cents)}`
  ).join("\n");

  // ADS - Smart filter: ALL from active campaigns + top from paused (v1.34.0)
  const activeAdsetIds = new Set(activeAdsets.map((as: any) => as.meta_adset_id));
  const activeAds = accountAds.filter((ad: any) => activeAdsetIds.has(ad.meta_adset_id) || activeCampaignIds.has(ad.meta_campaign_id));
  const pausedAds = accountAds.filter((ad: any) => !activeAdsetIds.has(ad.meta_adset_id) && !activeCampaignIds.has(ad.meta_campaign_id));
  const selectedPausedAds = pausedAds.slice(0, 50);
  const filteredAds = [...activeAds, ...selectedPausedAds];
  
  const adHeaders = "ID | Nome | Status | EffStatus | AdSetID | CampaignID";
  const adRows = filteredAds.map((ad: any) => 
    `${ad.meta_ad_id} | ${ad.name} | ${ad.status} | ${ad.effective_status} | ${ad.meta_adset_id} | ${ad.meta_campaign_id}`
  ).join("\n");

  // AUDIENCES - ALL
  const audienceHeaders = "ID | Nome | Tipo | Subtipo | Tamanho";
  const audienceRows = accountAudiences.map((a: any) => 
    `${a.meta_audience_id} | ${a.name} | ${a.audience_type || "-"} | ${a.subtype || "-"} | ${fmtNum(a.approximate_count)}`
  ).join("\n");

  // PRODUCTS - compact
  const productRows = context.products.slice(0, 20).map((p: any) => {
    const margin = p.cost_price ? Math.round(((p.price - p.cost_price) / p.price) * 100) : null;
    const imgs = ((context.imagesByProduct || {})[p.id] || []).slice(0, 2);
    const url = context.storeUrl ? `${context.storeUrl}/produto/${p.slug || p.id}` : null;
    return `• ${p.name} — R$${Number(p.price).toFixed(2)}${margin ? ` (margem ~${margin}%)` : ""}${p.stock_quantity != null ? ` [est:${p.stock_quantity}]` : ""} | ${p.brand || "-"} | ${url || "-"}${imgs.length ? ` | imgs: ${imgs.join(", ")}` : ""}`;
  }).join("\n");

  const user = `## CAMPANHAS (${campaignData.length} total: ${activeCampaigns.length} ativas, ${pausedCampaigns.length} pausadas)
${campaignHeaders}
${campaignRows}

## CONJUNTOS DE ANÚNCIOS (${filteredAdsets.length} exibidos de ${accountAdsets.length} total — ${activeAdsets.length} em campanhas ativas)
⚠️ Quando campanha não tem budget/dia, o orçamento está no nível do conjunto (ABO). Verifique antes de concluir falta de orçamento.
${adsetHeaders}
${adsetRows}

## ANÚNCIOS (${filteredAds.length} exibidos de ${accountAds.length} total — ${activeAds.length} em campanhas ativas)
${adHeaders}
${adRows}

## PÚBLICOS DISPONÍVEIS (${accountAudiences.length})
${audienceHeaders}
${audienceRows}

## PRODUTOS DO CATÁLOGO (${context.products.length})
${productRows}

## CADÊNCIA DE CRIATIVOS (últimos 7d)
${JSON.stringify(creativeCadence, null, 2)}

## AÇÕES DA SEMANA
Pausas: ${actionsSummary.pauses} | Ajustes budget: ${actionsSummary.budget_adjustments} | Campanhas criadas: ${actionsSummary.campaigns_created} | Criativos gerados: ${actionsSummary.creatives_generated}

## EXPERIMENTOS ATIVOS
${context.experiments.filter((e: any) => e.status === "active").length > 0 ? JSON.stringify(context.experiments.filter((e: any) => e.status === "active"), null, 2) : "Nenhum"}

Execute o pipeline completo de 5 fases. Use strategic_plan para o diagnóstico, depois as tools operacionais.`;

  return { system, user };
}

// ============ EXECUTE TOOL CALLS ============

async function executeToolCall(
  supabase: any,
  tenantId: string,
  sessionId: string,
  config: AccountConfig,
  tc: any,
  context: any
): Promise<{ status: string; data?: any }> {
  const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
  const toolName = tc.function.name;
  const isAutoMode = config.human_approval_mode === "auto";

  if (toolName === "strategic_plan") {
    // Build preview text from structured actions
    const actionsPreview = (args.planned_actions || []).map((a: any) => {
      if (typeof a === "string") return `• ${a}`;
      return `• [${a.campaign_type || "Ação"}] ${a.product_name || ""} — R$ ${a.daily_budget_brl || "?"}/dia — ${a.target_audience || ""} (${a.rationale || ""})`;
    }).join("\n");
    const planBody = args.diagnosis + "\n\n**Ações Planejadas:**\n" + actionsPreview + "\n\n**Resultados Esperados:** " + (args.expected_results || "") + "\n\n**Riscos:** " + (args.risk_assessment || "");
    
    return {
      status: "pending_approval",
      data: {
        type: "strategic_plan",
        ad_account_id: config.ad_account_id,
        diagnosis: args.diagnosis,
        planned_actions: args.planned_actions,
        expected_results: args.expected_results,
        risk_assessment: args.risk_assessment,
        timeline: args.timeline,
        budget_allocation: args.budget_allocation,
        preview: {
          headline: "Plano Estratégico — Motor Estrategista",
          copy_text: planBody,
          targeting_summary: `${(args.planned_actions || []).length} ações planejadas`,
        },
      },
    };
  }

  if (toolName === "generate_creative") {
    // v1.20.0: STRICT matching — NO fallback to products[0] to prevent wrong product images
    const topProduct = context.products.find((p: any) => p.name.trim() === (args.product_name || "").trim());
    if (!topProduct) {
      console.error(`[ads-autopilot-strategist][${VERSION}] generate_creative: produto "${args.product_name}" NÃO encontrado no catálogo. Rejeitando para evitar imagem genérica.`);
      return { status: "failed", data: { error: `Produto "${args.product_name}" não encontrado no catálogo. Use o nome EXATO do catálogo.` } };
    }

    // v1.28.0: DEDUP — Check if we already have ready creatives for this product + funnel_stage + format
    const requestedFunnel = args.funnel_stage || "tof";
    const requestedFormat = args.format || "1:1";
    
    const { data: existingCreatives } = await supabase
      .from("ads_creative_assets")
      .select("id, asset_url, format, funnel_stage, angle, created_at")
      .eq("tenant_id", tenantId)
      .eq("product_id", topProduct.id)
      .eq("status", "ready")
      .eq("funnel_stage", requestedFunnel)
      .not("asset_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(10);

    // Filter by format if specified (some may have different formats)
    const matchingCreatives = (existingCreatives || []).filter((c: any) => 
      !requestedFormat || c.format === requestedFormat || !c.format
    );

    if (matchingCreatives.length >= (args.variations || 3)) {
      console.log(`[ads-autopilot-strategist][${VERSION}] DEDUP: Found ${matchingCreatives.length} existing creatives for "${topProduct.name}" (${requestedFunnel}/${requestedFormat}). Skipping generation.`);
      return { 
        status: "executed", 
        data: { 
          reused: true, 
          reused_count: matchingCreatives.length,
          product_name: topProduct.name,
          creative_urls: matchingCreatives.map((c: any) => c.asset_url),
          message: `Reutilizados ${matchingCreatives.length} criativos existentes para "${topProduct.name}" (${requestedFunnel}). Nenhuma geração necessária.`
        } 
      };
    }

    // Resolve product image URL
    let productImageUrl: string | null = null;
    if (topProduct.images) {
      const images = Array.isArray(topProduct.images) ? topProduct.images : [];
      const firstImg = images[0];
      productImageUrl = typeof firstImg === "string" ? firstImg : (firstImg as any)?.url || null;
    }

    // Calculate how many NEW variations are actually needed
    const existingCount = matchingCreatives.length;
    const neededVariations = Math.max(1, (args.variations || 3) - existingCount);
    
    if (existingCount > 0) {
      console.log(`[ads-autopilot-strategist][${VERSION}] PARTIAL REUSE: ${existingCount} existing, generating ${neededVariations} more for "${topProduct.name}" (${requestedFunnel}/${requestedFormat})`);
    }

    try {
      const { data: creativeResult, error: creativeErr } = await supabase.functions.invoke("ads-autopilot-creative", {
        body: {
          tenant_id: tenantId,
          session_id: sessionId,
          channel: config.channel,
          product_id: topProduct.id,
          product_name: topProduct.name,
          product_image_url: productImageUrl,
          campaign_objective: args.campaign_objective,
          target_audience: args.target_audience,
          style_preference: args.style_preference || "promotional",
          format: requestedFormat,
          variations: neededVariations,
          funnel_stage: requestedFunnel,
        },
      });
      if (creativeErr) throw creativeErr;
      return { 
        status: "executed", 
        data: { 
          creative_job_id: creativeResult?.data?.job_id, 
          product_name: topProduct.name,
          reused_count: existingCount,
          new_count: neededVariations,
        } 
      };
    } catch (err: any) {
      return { status: "failed", data: { error: err.message } };
    }
  }

  if (toolName === "create_lookalike_audience") {
    try {
      // v1.18.0: Dedup — check if a LAL with same source + ratio + country already exists
      const safeRatio = args.ratio || 0.05;
      const safeCountry = args.country || "BR";
      const { data: existingAudiences } = await supabase
        .from("meta_ad_audiences")
        .select("id, meta_audience_id, name, lookalike_spec")
        .eq("tenant_id", tenantId)
        .eq("ad_account_id", config.ad_account_id)
        .eq("audience_type", "lookalike");

      const existingMatch = (existingAudiences || []).find((a: any) => {
        const spec = a.lookalike_spec;
        if (!spec) return false;
        return spec.source === args.source_audience_id 
          && Math.abs((spec.ratio || 0) - safeRatio) < 0.005
          && (spec.country || "BR") === safeCountry;
      });

      if (existingMatch) {
        console.log(`[ads-autopilot-strategist][${VERSION}] LAL dedup: "${existingMatch.name}" (${existingMatch.meta_audience_id}) already exists for source=${args.source_audience_id} ratio=${safeRatio}`);
        return { status: "executed", data: { lookalike_audience_id: existingMatch.meta_audience_id, deduplicated: true, existing_name: existingMatch.name } };
      }

      const metaConn = await supabase
        .from("marketplace_connections")
        .select("access_token")
        .eq("tenant_id", tenantId)
        .eq("marketplace", "meta")
        .eq("is_active", true)
        .maybeSingle();

      if (!metaConn?.data?.access_token) throw new Error("Meta não conectada");

      const accountId = config.ad_account_id.replace("act_", "");
      const lalRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountId}/customaudiences`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: args.lookalike_name,
          subtype: "LOOKALIKE",
          origin_audience_id: args.source_audience_id,
          lookalike_spec: JSON.stringify({ type: "similarity", ratio: safeRatio, country: safeCountry }),
          access_token: metaConn.data.access_token,
        }),
      });
      const lalResult = await lalRes.json();
      if (lalResult.error) throw new Error(lalResult.error.message);

      await supabase.from("meta_ad_audiences").upsert({
        tenant_id: tenantId,
        meta_audience_id: lalResult.id,
        ad_account_id: config.ad_account_id,
        name: args.lookalike_name,
        audience_type: "lookalike",
        subtype: "LOOKALIKE",
        description: `LAL ${(safeRatio * 100).toFixed(0)}% de ${args.source_audience_name}`,
        lookalike_spec: { ratio: safeRatio, country: safeCountry, source: args.source_audience_id },
        synced_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,meta_audience_id" });

      return { status: "executed", data: { lookalike_audience_id: lalResult.id } };
    } catch (err: any) {
      return { status: "failed", data: { error: err.message } };
    }
  }

  if (toolName === "create_campaign") {
    // v1.12.0: Enrich campaign action with resolved product data
    console.log(`[ads-autopilot-strategist][${VERSION}] create_campaign → pending_approval (always)`);
    
    // v1.14.0: STRICT EXACT match only — no fuzzy, no startsWith, no includes
    // User is responsible for providing the exact product name in strategic prompt
    const matchedProduct = args.product_name 
      ? context.products.find((p: any) => p.name.trim() === args.product_name.trim()) 
      : args.product_id 
        ? context.products.find((p: any) => p.id === args.product_id)
        : null;
    
    if (args.product_name && !matchedProduct) {
      console.warn(`[ads-autopilot-strategist][${VERSION}] ⚠️ EXACT match failed for product_name="${args.product_name}". No fuzzy fallback — user must provide exact name.`);
    }

    // Resolve product image
    let productImageUrl: string | null = null;
    if (matchedProduct) {
      const prodImages = (context.imagesByProduct || {})[matchedProduct.id] || [];
      productImageUrl = prodImages[0]?.url || prodImages[0] || null;
    }

    // Format price correctly — price is already in BRL, NOT cents (ads-data-scaling-standards)
    const productPriceDisplay = matchedProduct?.price ? `R$ ${Number(matchedProduct.price).toFixed(2)}` : null;

    return { 
      status: "pending_approval", 
      data: { 
        ...args, 
        ad_account_id: config.ad_account_id,
        product_id: matchedProduct?.id || args.product_id || null,
        product_name: matchedProduct?.name || args.product_name || null,
        product_price: matchedProduct?.price || null,
        preview: {
          campaign_name: args.campaign_name,
          objective: args.objective,
          daily_budget_cents: args.daily_budget_cents,
          daily_budget_display: `R$ ${((args.daily_budget_cents || 0) / 100).toFixed(2)}/dia`,
          lifetime_budget_cents: args.lifetime_budget_cents || null,
          bid_strategy: args.bid_strategy || "LOWEST_COST_WITHOUT_CAP",
          bid_amount_cents: args.bid_amount_cents || null,
          roas_avg_floor: args.roas_avg_floor || null,
          special_ad_categories: args.special_ad_categories || ["NONE"],

          // Adset-level
          adset_name: args.adset_name || args.campaign_name?.replace("[AI]", "[AI] CJ -"),
          optimization_goal: args.optimization_goal || "OFFSITE_CONVERSIONS",
          billing_event: args.billing_event || "IMPRESSIONS",
          conversion_event: args.conversion_event || null,

          // Targeting
          targeting_description: args.targeting_description,
          targeting_summary: args.targeting_description,
          funnel_stage: args.funnel_stage,
          age_min: args.age_min || 18,
          age_max: args.age_max || 65,
          age_range: `${args.age_min || 18}-${args.age_max || 65}`,
          genders: args.genders || [0],
          geo_locations: args.geo_locations || { countries: ["BR"] },
          interests: args.interests || [],
          behaviors: args.behaviors || [],
          custom_audience_ids: args.custom_audience_ids || [],
          excluded_audience_ids: args.excluded_audience_ids || [],
          lookalike_spec: args.lookalike_spec || null,

          // Placements
          publisher_platforms: args.publisher_platforms || null, // null = Advantage+
          position_types: args.position_types || null,
          device_platforms: args.device_platforms || null,

          // Link & destination
          destination_url: args.destination_url || null,
          display_link: args.display_link || null,
          utm_params: args.utm_params || null,

          // Creative
          headline: args.headlines?.[0] || args.campaign_name,
          headlines: args.headlines || [],
          copy_text: args.primary_texts?.[0] || null,
          primary_texts: args.primary_texts || [],
          descriptions: args.descriptions || [],
          cta_type: args.cta || null,
          ad_name: args.ad_name || null,
          ad_format: args.ad_format || "SINGLE_IMAGE",

          // Product
          product_name: matchedProduct?.name || args.product_name || null,
          product_price: matchedProduct?.price || null,
          product_price_display: productPriceDisplay,
          product_image: productImageUrl,

          // Scheduling
          start_time: args.start_time || null,
          end_time: args.end_time || null,
        },
      } 
    };
  }

  if (toolName === "create_adset") {
    // v1.8.0: ALWAYS require approval for adset creation
    console.log(`[ads-autopilot-strategist][${VERSION}] create_adset → pending_approval (always)`);
    return { 
      status: "pending_approval", 
      data: { 
        ...args, 
        ad_account_id: config.ad_account_id,
        preview: {
          adset_name: args.adset_name,
          targeting_type: args.targeting_type,
          targeting_description: args.targeting_description || null,
          daily_budget_cents: args.daily_budget_cents,
          daily_budget_display: args.daily_budget_cents ? `R$ ${(args.daily_budget_cents / 100).toFixed(2)}/dia` : null,
          lifetime_budget_cents: args.lifetime_budget_cents || null,
          optimization_goal: args.optimization_goal || "OFFSITE_CONVERSIONS",
          billing_event: args.billing_event || "IMPRESSIONS",
          conversion_event: args.conversion_event || null,
          bid_amount_cents: args.bid_amount_cents || null,
          age_min: args.age_min || 18,
          age_max: args.age_max || 65,
          age_range: `${args.age_min || 18}-${args.age_max || 65}`,
          genders: args.genders || [0],
          geo_locations: args.geo_locations || { countries: ["BR"] },
          interests: args.interests || [],
          behaviors: args.behaviors || [],
          custom_audience_ids: args.custom_audience_ids || [],
          excluded_audience_ids: args.excluded_audience_ids || [],
          lookalike_spec: args.lookalike_spec || null,
          publisher_platforms: args.publisher_platforms || null,
          position_types: args.position_types || null,
          device_platforms: args.device_platforms || null,
          destination_url: args.destination_url || null,
          start_time: args.start_time || null,
          end_time: args.end_time || null,
        },
      } 
    };
  }

  if (toolName === "adjust_budget") {
    const changePct = Math.abs(args.change_pct || 0);
    const platformLimit = PLATFORM_LIMITS[config.channel] || PLATFORM_LIMITS.meta;

    if (changePct > platformLimit.max_change_pct) {
      return { status: "rejected", data: { reason: `Ajuste de ${args.change_pct}% excede limite de ±${platformLimit.max_change_pct}%` } };
    }
    if (!canAdjustBudget(config)) {
      return { status: "rejected", data: { reason: `Intervalo mínimo de ${platformLimit.min_interval_hours}h não atingido` } };
    }

    const scheduledFor = getNextSchedulingTime();
    return {
      status: "scheduled",
      data: {
        campaign_id: args.campaign_id,
        new_budget_cents: args.new_budget_cents,
        change_pct: args.change_pct,
        scheduled_for: scheduledFor,
        ad_account_id: config.ad_account_id,
      },
    };
  }

  return { status: "unknown", data: { tool: toolName } };
}

// ============ RUN STRATEGIST FOR TENANT ============

async function runStrategistForTenant(supabase: any, tenantId: string, trigger: StrategistTrigger, targetAccountId?: string | null, revisionFeedback?: string | null, body?: any) {
  const startTime = Date.now();
  console.log(`[ads-autopilot-strategist][${VERSION}] Starting ${trigger} for tenant ${tenantId}${targetAccountId ? ` (account: ${targetAccountId})` : ""}`);

  // Get account configs
  let query = supabase
    .from("ads_autopilot_account_configs")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("is_ai_enabled", true);

  // If targeting a specific account, filter to just that one
  if (targetAccountId) {
    query = query.eq("ad_account_id", targetAccountId);
  }

  const { data: configs } = await query;

  const activeConfigs = (configs || []).filter((c: any) => !c.kill_switch) as AccountConfig[];
  if (activeConfigs.length === 0) {
    return { trigger, accounts: 0, message: "No active accounts" };
  }

  // Collect deep context
  const context = await collectStrategistContext(supabase, tenantId, activeConfigs, trigger);

  // Create strategist session
  const { data: session } = await supabase
    .from("ads_autopilot_sessions")
    .insert({
      tenant_id: tenantId,
      channel: "global",
      trigger_type: `strategist_${trigger}`,
      motor_type: "strategist",
      context_snapshot: { trigger, accounts: activeConfigs.map(a => a.ad_account_id) },
    })
    .select("id")
    .single();

  const sessionId = session!.id;
  let totalPlanned = 0;
  let totalExecuted = 0;
  let totalRejected = 0;

  // If implementing approved plan OR campaigns phase, fetch the plan content
  let approvedPlanContent = "";
  if (trigger === "implement_approved_plan" || trigger === "implement_campaigns") {
    const { data: planActions } = await supabase
      .from("ads_autopilot_actions")
      .select("action_data, reasoning")
      .eq("tenant_id", tenantId)
      .eq("action_type", "strategic_plan")
      .in("status", ["approved", "executed"])
      .order("created_at", { ascending: false })
      .limit(1);

    if (planActions && planActions.length > 0) {
      const plan = planActions[0].action_data || {};
      const diagnosis = plan.diagnosis || "";
      const plannedActions = (plan.planned_actions || []).map((a: string, i: number) => `${i + 1}. ${a}`).join("\n");
      const expectedResults = plan.expected_results || "";
      const budgetAllocation = plan.budget_allocation ? JSON.stringify(plan.budget_allocation, null, 2) : "";
      
      approvedPlanContent = `### PLANO APROVADO PELO USUÁRIO (SEGUIR À RISCA):

**Diagnóstico:**
${diagnosis}

**Ações Planejadas (executar na ordem):**
${plannedActions}

**Resultados Esperados:**
${expectedResults}

${budgetAllocation ? `**Alocação de Orçamento:**\n${budgetAllocation}` : ""}`;
      
      console.log(`[ads-autopilot-strategist][${VERSION}] Approved plan loaded: ${(plan.planned_actions || []).length} actions`);
    } else {
      console.warn(`[ads-autopilot-strategist][${VERSION}] No approved plan found, falling back to general context`);
    }
  }

  // v1.28.0: Load ALL existing creatives for Phase 1 (reuse inventory) and Phase 2 (available URLs)
  let existingCreativesInventory = "";
  if (trigger === "implement_approved_plan" || trigger === "weekly" || trigger === "monthly" || trigger === "start") {
    // Fetch ALL ready creatives for this tenant (not just from a specific session)
    const { data: allCreatives } = await supabase
      .from("ads_creative_assets")
      .select("id, product_id, asset_url, format, status, funnel_stage, angle, session_id, created_at")
      .eq("tenant_id", tenantId)
      .eq("status", "ready")
      .not("asset_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (allCreatives && allCreatives.length > 0) {
      // Also check which creatives are already linked to active Meta ads
      const { data: activeAds } = await supabase
        .from("meta_ad_ads")
        .select("creative_id")
        .eq("tenant_id", tenantId)
        .in("effective_status", ["ACTIVE", "PENDING_REVIEW", "PREAPPROVED"]);
      
      const usedCreativeIds = new Set((activeAds || []).map((a: any) => a.creative_id).filter(Boolean));
      
      // Map product names
      const productIds = [...new Set(allCreatives.map((c: any) => c.product_id).filter(Boolean))];
      const { data: creativeProducts } = productIds.length > 0
        ? await supabase.from("products").select("id, name").in("id", productIds)
        : { data: [] };
      const prodNameMap: Record<string, string> = {};
      (creativeProducts || []).forEach((p: any) => { prodNameMap[p.id] = p.name; });

      const lines = allCreatives.map((c: any) => {
        const inUse = usedCreativeIds.has(c.id) ? "🟢 EM USO" : "⚪ DISPONÍVEL";
        const age = Math.floor((Date.now() - new Date(c.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return `- [${inUse}] Produto: ${prodNameMap[c.product_id] || "Multi-produto"} | Funil: ${c.funnel_stage || "N/A"} | Formato: ${c.format || "N/A"} | Ângulo: ${c.angle || "N/A"} | Idade: ${age}d | URL: ${c.asset_url}`;
      });
      
      const available = allCreatives.filter((c: any) => !usedCreativeIds.has(c.id)).length;
      existingCreativesInventory = `Total: ${allCreatives.length} criativos (${available} disponíveis para reutilização, ${usedCreativeIds.size} em uso na Meta)\n\n${lines.join("\n")}`;
      
      console.log(`[ads-autopilot-strategist][${VERSION}] Creative inventory: ${allCreatives.length} total, ${available} available, ${usedCreativeIds.size} in use`);
    } else {
      existingCreativesInventory = "Nenhum criativo existente. Todos precisam ser gerados do zero.";
      console.log(`[ads-autopilot-strategist][${VERSION}] No existing creatives found`);
    }
  }

  // For implement_campaigns (Phase 2): load available creative URLs
  let availableCreativesText = "";
  if (trigger === "implement_campaigns") {
    const sourceSessionId = body?.source_session_id;
    let creativeQuery = supabase
      .from("ads_creative_assets")
      .select("id, product_id, asset_url, format, status, meta")
      .eq("tenant_id", tenantId)
      .eq("status", "ready")
      .not("asset_url", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);
    
    if (sourceSessionId) {
      creativeQuery = creativeQuery.eq("session_id", sourceSessionId);
    }

    const { data: readyCreatives } = await creativeQuery;
    
    if (readyCreatives && readyCreatives.length > 0) {
      // Map creatives to product names
      const productIds = [...new Set(readyCreatives.map((c: any) => c.product_id).filter(Boolean))];
      const { data: creativeProducts } = productIds.length > 0
        ? await supabase.from("products").select("id, name").in("id", productIds)
        : { data: [] };
      const prodNameMap: Record<string, string> = {};
      (creativeProducts || []).forEach((p: any) => { prodNameMap[p.id] = p.name; });

      availableCreativesText = readyCreatives.map((c: any) => 
        `- Produto: ${prodNameMap[c.product_id] || "N/A"} | Formato: ${c.format || "N/A"} | URL: ${c.asset_url}`
      ).join("\n");
      
      console.log(`[ads-autopilot-strategist][${VERSION}] Phase 2: ${readyCreatives.length} creatives available`);
    } else {
      availableCreativesText = "Nenhum criativo encontrado — use imagens do catálogo como fallback.";
      console.warn(`[ads-autopilot-strategist][${VERSION}] Phase 2: No ready creatives found`);
    }
  }

  // === REVISION: fetch rejected plan + feedback to guide new analysis ===
  let revisionContext = "";
  const revisionActionType = body?.revision_action_type || null;
  const revisionActionData = body?.revision_action_data || null;
  
  // Collect names of other pending campaigns that should NOT be touched
  const otherPendingCampaigns = body?.other_pending_campaigns || [];
  
  // Also fetch pending campaigns from DB for extra safety
  if (trigger === "revision") {
    const { data: dbPending } = await supabase
      .from("ads_autopilot_actions")
      .select("id, action_type, action_data")
      .eq("tenant_id", tenantId)
      .eq("status", "pending_approval")
      .eq("action_type", "create_campaign");
    
    if (dbPending) {
      for (const p of dbPending) {
        const name = (p.action_data as any)?.campaign_name || (p.action_data as any)?.preview?.campaign_name;
        if (name && !otherPendingCampaigns.includes(name)) {
          otherPendingCampaigns.push(name);
        }
      }
    }
  }

  if (trigger === "revision" && revisionFeedback) {
    // Scoped revision: only regenerate the specific rejected action
    if (revisionActionType === "create_campaign" && revisionActionData) {
      const campaignName = revisionActionData.campaign_name || "campanha";
      const productName = revisionActionData.product_name || "";
      const funnelStage = revisionActionData.funnel_stage || "";
      
      // Build list of campaigns to NOT recreate
      const protectedList = otherPendingCampaigns
        .filter((n: string) => n !== campaignName)
        .map((n: string) => `  - "${n}"`)
        .join("\n");
      
      revisionContext = `### REVISÃO ESPECÍFICA — APENAS UMA CAMPANHA

O usuário pediu ajuste APENAS na campanha "${campaignName}"${productName ? ` (produto: ${productName})` : ""}${funnelStage ? ` (funil: ${funnelStage})` : ""}.

Feedback do usuário: "${revisionFeedback}"

**REGRA ABSOLUTA — VIOLAÇÃO RESULTA EM FALHA TOTAL:**
1. Você DEVE criar APENAS UMA nova campanha (create_campaign) substituindo a campanha "${campaignName}" rejeitada
2. NÃO gere um novo plano estratégico (strategic_plan)
3. NÃO recrie NEM modifique outras campanhas
4. Siga LITERALMENTE o feedback do usuário — se ele pedir campanha de catálogo, crie campanha de catálogo
5. Se o feedback mencionar tipo específico (catálogo, remarketing, etc.), use o objective_type correspondente
6. Mantenha o mesmo produto/funil a menos que o feedback peça mudança explícita
7. Gere novos criativos APENAS se o feedback pedir — caso contrário, reutilize existentes
${protectedList ? `\n**CAMPANHAS EXISTENTES (NÃO TOCAR — já estão pendentes de aprovação):**\n${protectedList}` : ""}

Se o usuário pedir "campanha de catálogo", use:
- objective_type: "OUTCOME_PRODUCT_CATALOG_SALES"
- Inclua TODOS os produtos relevantes no targeting`;

      console.log(`[ads-autopilot-strategist][${VERSION}] Scoped revision for campaign "${campaignName}" feedback: ${revisionFeedback.substring(0, 100)}`);
    } else if (revisionActionType === "strategic_plan") {
      // Full plan revision — fetch previous plan
      const { data: rejectedPlans } = await supabase
        .from("ads_autopilot_actions")
        .select("action_data, reasoning")
        .eq("tenant_id", tenantId)
        .eq("action_type", "strategic_plan")
        .eq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(1);

      const prevDiagnosis = rejectedPlans?.[0]?.reasoning || "";
      revisionContext = `### REVISÃO DO PLANO ESTRATÉGICO

O plano anterior foi rejeitado com o seguinte feedback:
"${revisionFeedback}"

**Diagnóstico do plano anterior (para referência, NÃO repetir erros):**
${prevDiagnosis.substring(0, 2000)}

**INSTRUÇÕES:** Gere um NOVO plano estratégico incorporando obrigatoriamente o feedback do usuário. Mantenha o diagnóstico base mas ajuste a estratégia conforme solicitado.`;

      console.log(`[ads-autopilot-strategist][${VERSION}] Full plan revision with feedback: ${revisionFeedback.substring(0, 100)}`);
    } else {
      // Generic revision fallback
      const { data: rejectedPlans } = await supabase
        .from("ads_autopilot_actions")
        .select("action_data, reasoning")
        .eq("tenant_id", tenantId)
        .eq("status", "rejected")
        .order("created_at", { ascending: false })
        .limit(1);

      const prevDiagnosis = rejectedPlans?.[0]?.reasoning || "";
      revisionContext = `### REVISÃO SOLICITADA PELO USUÁRIO

Feedback: "${revisionFeedback}"

**Contexto anterior:** ${prevDiagnosis.substring(0, 1000)}

**REGRA:** Ajuste APENAS o que o feedback pede. NÃO recrie tudo do zero.`;

      console.log(`[ads-autopilot-strategist][${VERSION}] Generic revision with feedback: ${revisionFeedback.substring(0, 100)}`);
    }
  }

  // Analyze each account with full pipeline
  for (const config of activeConfigs) {
    const prompt = buildStrategistPrompt(trigger, config, context);
    
    // Inject approved plan content into the prompt if available
    if (approvedPlanContent) {
      prompt.system = prompt.system.replace("{{APPROVED_PLAN_CONTENT}}", approvedPlanContent);
    } else if (revisionContext) {
      prompt.system = prompt.system.replace("{{APPROVED_PLAN_CONTENT}}", revisionContext);
    } else {
      prompt.system = prompt.system.replace("{{APPROVED_PLAN_CONTENT}}", "Nenhum plano específico encontrado. Use o contexto disponível para decidir os produtos e estratégias.");
    }

    // Inject deep historical data for start trigger
    if (context.deepHistorical && context.deepHistorical[config.ad_account_id]) {
      const dh = context.deepHistorical[config.ad_account_id];
      // Sort by conversions desc to find top performers
      const topCampaigns = [...dh.campaigns].filter((c: any) => c.conversions > 0).sort((a: any, b: any) => b.conversions - a.conversions).slice(0, 10);
      const topAdsets = [...dh.adsets].filter((a: any) => a.conversions > 0).sort((a: any, b: any) => b.roas - a.roas).slice(0, 15);
      const topAds = [...dh.ads].filter((a: any) => a.conversions > 0).sort((a: any, b: any) => b.conversions - a.conversions).slice(0, 15);
      
      // Build placement summary across all campaigns
      const placementAgg: Record<string, { spend: number; conversions: number; revenue: number }> = {};
      for (const c of dh.campaigns) {
        if (c.placements) {
          for (const [key, val] of Object.entries(c.placements as Record<string, any>)) {
            if (!placementAgg[key]) placementAgg[key] = { spend: 0, conversions: 0, revenue: 0 };
            placementAgg[key].spend += val.spend || 0;
            placementAgg[key].conversions += val.conversions || 0;
            placementAgg[key].revenue += (val.roas || 0) * (val.spend || 0);
          }
        }
      }
      const topPlacements = Object.entries(placementAgg)
        .map(([k, v]) => ({ placement: k, ...v, roas: v.spend > 0 ? Math.round((v.revenue / v.spend) * 100) / 100 : 0 }))
        .filter(p => p.conversions > 0)
        .sort((a, b) => b.roas - a.roas)
        .slice(0, 10);

      const deepText = `## DADOS HISTÓRICOS COMPLETOS DA CONTA (PERÍODO MÁXIMO)
### Top Campanhas por Conversões (todas, incluindo pausadas):
${topCampaigns.map((c: any) => `- ${c.name} [${c.status}] — ROAS: ${c.roas}x | CPA: R$${c.cpa.toFixed(2)} | Conversões: ${c.conversions} | Gasto: R$${c.spend.toFixed(2)} | CTR: ${c.ctr}%`).join("\n") || "Nenhuma campanha com conversões"}

### Top Conjuntos de Anúncios por ROAS (públicos que mais converteram):
${topAdsets.map((a: any) => `- ${a.name} [${a.status}] — ROAS: ${a.roas}x | CPA: R$${a.cpa.toFixed(2)} | Conversões: ${a.conversions} | Gasto: R$${a.spend.toFixed(2)}${a.targeting ? ` | Targeting: ${JSON.stringify(a.targeting).substring(0, 200)}` : ""}`).join("\n") || "Nenhum adset com conversões"}

### Top Anúncios por Conversões (criativos/copys que mais converteram):
${topAds.map((a: any) => {
        const cr = a.creative_data || {};
        return `- ${a.name} [${a.status}] — ROAS: ${a.roas}x | CPA: R$${a.cpa.toFixed(2)} | Conversões: ${a.conversions} | CTR: ${a.ctr}%${cr.title ? ` | Headline: "${cr.title}"` : ""}${cr.body ? ` | Copy: "${(cr.body || "").substring(0, 150)}"` : ""}${cr.call_to_action_type ? ` | CTA: ${cr.call_to_action_type}` : ""}`;
      }).join("\n") || "Nenhum anúncio com conversões"}

### Top Posicionamentos por ROAS:
${topPlacements.map(p => `- ${p.placement} — ROAS: ${p.roas}x | Conversões: ${p.conversions} | Gasto: R$${p.spend.toFixed(2)}`).join("\n") || "Sem dados de posicionamento"}

### Resumo Geral da Conta (período máximo):
- Total de campanhas: ${dh.campaigns.length} (${dh.campaigns.filter((c: any) => c.status === "ACTIVE").length} ativas, ${dh.campaigns.filter((c: any) => c.status === "PAUSED").length} pausadas)
- Total de conjuntos: ${dh.adsets.length}
- Total de anúncios: ${dh.ads.length}
- Gasto total histórico: R$ ${dh.campaigns.reduce((s: number, c: any) => s + c.spend, 0).toFixed(2)}
- Conversões totais históricas: ${dh.campaigns.reduce((s: number, c: any) => s + c.conversions, 0)}`;

      prompt.system = prompt.system.replace("{{DEEP_HISTORICAL_DATA}}", deepText);
    } else {
      prompt.system = prompt.system.replace("{{DEEP_HISTORICAL_DATA}}", "Dados históricos profundos não disponíveis. Baseie-se nos dados de 7d e 30d disponíveis.");
    }

    // Inject existing creatives inventory for Phase 1 and other triggers
    if (existingCreativesInventory) {
      prompt.system = prompt.system.replace("{{EXISTING_CREATIVES_INVENTORY}}", existingCreativesInventory);
    } else {
      prompt.system = prompt.system.replace("{{EXISTING_CREATIVES_INVENTORY}}", "Nenhum criativo existente encontrado.");
    }

    // Inject available creatives for Phase 2
    if (availableCreativesText) {
      prompt.system = prompt.system.replace("{{AVAILABLE_CREATIVES}}", availableCreativesText);
    } else {
      prompt.system = prompt.system.replace("{{AVAILABLE_CREATIVES}}", "Nenhum criativo pré-gerado disponível.");
    }

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      resetAIRouterCache();

      console.log(`[ads-autopilot-strategist][${VERSION}] Using aiChatCompletion with auto-fallback (Gemini → OpenAI → Lovable)`);

      // === MULTI-ROUND EXECUTION LOOP ===
      const MAX_ROUNDS = 8; // Safety limit to prevent infinite loops
      let round = 0;
      let allAiText = "";
      
      // Build tool set based on trigger
      const isScopedRevision = trigger === "revision" && revisionActionType === "create_campaign";
      const allowedTools = trigger === "implement_approved_plan" 
        ? STRATEGIST_TOOLS.filter((t: any) => ["generate_creative", "create_lookalike_audience"].includes(t.function?.name))
        : trigger === "implement_campaigns"
        ? STRATEGIST_TOOLS.filter((t: any) => ["create_campaign", "create_adset", "adjust_budget"].includes(t.function?.name))
        : trigger === "start"
        ? STRATEGIST_TOOLS.filter((t: any) => t.function?.name === "strategic_plan")
        : isScopedRevision
        ? STRATEGIST_TOOLS.filter((t: any) => ["create_campaign", "create_adset", "generate_creative", "create_lookalike_audience"].includes(t.function?.name))
        : STRATEGIST_TOOLS;

      // Messages history for multi-round conversation
      const messages: any[] = [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user },
      ];

      // Track generated creative URLs per product for linking to campaign actions
      const creativeUrlsByProduct: Record<string, string> = {};

      while (round < MAX_ROUNDS) {
        round++;
        console.log(`[ads-autopilot-strategist][${VERSION}] Round ${round}/${MAX_ROUNDS} for account ${config.ad_account_id}`);

        // Force tool calling on first round for triggers that MUST produce a tool call
        const forceToolChoice = round === 1 && (trigger === "start" || trigger === "implement_approved_plan" || trigger === "implement_campaigns")
          ? "required"
          : "auto";

        const aiResponse = await aiChatCompletion("google/gemini-2.5-flash", {
          messages,
          tools: allowedTools,
          tool_choice: forceToolChoice,
        }, {
          supabaseUrl,
          supabaseServiceKey,
          logPrefix: `[ads-autopilot-strategist][${VERSION}][R${round}]`,
        });

        if (!aiResponse.ok) {
          const errText = await aiResponse.text();
          console.error(`[ads-autopilot-strategist][${VERSION}] AI error round ${round}: ${aiResponse.status} ${errText}`);
          break;
        }

        const aiResult = await aiResponse.json();
        const assistantMessage = aiResult.choices?.[0]?.message;
        if (!assistantMessage) break;

        const toolCalls = assistantMessage.tool_calls || [];
        const aiText = assistantMessage.content || "";
        allAiText += (aiText ? `\n--- Round ${round} ---\n${aiText}` : "");

        // If no tool calls, AI is done
        if (toolCalls.length === 0) {
          console.log(`[ads-autopilot-strategist][${VERSION}] Round ${round}: No tool calls, AI finished`);
          break;
        }

        console.log(`[ads-autopilot-strategist][${VERSION}] Round ${round}: ${toolCalls.length} tool calls`);

        // Add assistant message to history (with tool calls)
        // FIX v1.27.0: Gemini rejects content: null — ensure it's always a string
        const sanitizedAssistant = { ...assistantMessage, content: assistantMessage.content || "" };
        messages.push(sanitizedAssistant);

        // Process each tool call and collect results
        const toolResults: any[] = [];
        for (const tc of toolCalls) {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          totalPlanned++;

          // Execute the tool
          const result = await executeToolCall(supabase, tenantId, sessionId, config, tc, context);

          // Track creative URLs from generate_creative results
          if (tc.function.name === "generate_creative" && result.status === "executed") {
            const productName = args.product_name;
            // v1.20.0: STRICT matching — NO fallback to prevent wrong product URL tracking
            const matchedProduct = context.products.find((p: any) => p.name.trim() === (productName || "").trim());
            if (matchedProduct) {
              const { data: latestAsset } = await supabase
                .from("ads_creative_assets")
                .select("asset_url")
                .eq("tenant_id", tenantId)
                .eq("session_id", sessionId)
                .eq("product_id", matchedProduct.id)
                .not("asset_url", "is", null)
                .order("created_at", { ascending: false })
                .limit(1);
              if (latestAsset?.[0]?.asset_url) {
                creativeUrlsByProduct[productName] = latestAsset[0].asset_url;
              }
            }
          }

          // Get campaign name for logging
          const campaignName = context.campaigns.find((c: any) => c.meta_campaign_id === args.campaign_id)?.name || args.campaign_name || null;

          // For create_campaign, try to attach the creative_url from the same session
          let creativeUrl: string | null = null;
          if (tc.function.name === "create_campaign") {
            for (const [prodName, url] of Object.entries(creativeUrlsByProduct)) {
              if (args.campaign_name?.includes(prodName) || args.targeting_description?.includes(prodName) || args.product_name === prodName) {
                creativeUrl = url;
                break;
              }
            }
            if (!creativeUrl) {
              const { data: sessionAsset } = await supabase
                .from("ads_creative_assets")
                .select("asset_url")
                .eq("tenant_id", tenantId)
                .eq("session_id", sessionId)
                .not("asset_url", "is", null)
                .order("created_at", { ascending: false })
                .limit(1);
              creativeUrl = sessionAsset?.[0]?.asset_url || null;
            }
          }

          // Record action in DB
          const actionRecord: any = {
            tenant_id: tenantId,
            session_id: sessionId,
            channel: config.channel,
            action_type: tc.function.name,
            action_data: { 
              ...args, 
              ...(result.data || {}), 
              ad_account_id: config.ad_account_id, 
              campaign_name: campaignName,
              ...(creativeUrl ? { creative_url: creativeUrl } : {}),
            },
            reasoning: args.reasoning || args.reason || args.diagnosis || "",
            confidence: String(args.confidence || "0.8"),
            status: result.status,
            action_hash: `${sessionId}_${tc.function.name}_${config.ad_account_id}_${totalPlanned}`,
          };

          if (result.status === "executed" || result.status === "scheduled") {
            actionRecord.executed_at = new Date().toISOString();
            if (tc.function.name === "adjust_budget") {
              actionRecord.rollback_data = { previous_budget_cents: args.current_budget_cents };
            }
            totalExecuted++;
          } else if (result.status === "rejected") {
            actionRecord.rejection_reason = result.data?.reason || "Rejeitado pelo sistema";
            totalRejected++;
          } else if (result.status === "failed") {
            actionRecord.error_message = result.data?.error || "Erro desconhecido";
          }

          // DEDUP RULE: Before inserting a new strategic_plan, supersede any existing pending ones
          if (tc.function.name === "strategic_plan" && result.status === "pending_approval") {
            // Intra-session dedup: skip if we already inserted a strategic_plan in THIS session
            const { data: sameSessionPlans } = await supabase
              .from("ads_autopilot_actions")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("session_id", sessionId)
              .eq("action_type", "strategic_plan")
              .eq("status", "pending_approval")
              .limit(1);
            
            if (sameSessionPlans && sameSessionPlans.length > 0) {
              console.log(`[ads-autopilot-strategist][${VERSION}] Skipping duplicate strategic_plan in same session`);
              toolResults.push({
                tool_call_id: tc.id,
                role: "tool",
                content: JSON.stringify({ status: "skipped", reason: "Duplicate strategic_plan in same session" }),
              });
              continue;
            }

            // Cross-session dedup: supersede old pending plans from OTHER sessions
            const { data: existingPlans, error: fetchErr } = await supabase
              .from("ads_autopilot_actions")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("action_type", "strategic_plan")
              .eq("status", "pending_approval")
              .neq("session_id", sessionId);
            
            if (!fetchErr && existingPlans && existingPlans.length > 0) {
              const oldPlanIds = existingPlans.map((p: any) => p.id);
              console.log(`[ads-autopilot-strategist][${VERSION}] Superseding ${oldPlanIds.length} old pending strategic_plan(s)`);
              await supabase
                .from("ads_autopilot_actions")
                .update({ status: "superseded", rejection_reason: "Substituído por novo plano estratégico" })
                .in("id", oldPlanIds);
            }
          }

          const { error: insertErr } = await supabase.from("ads_autopilot_actions").insert(actionRecord);
          if (insertErr) console.error(`[ads-autopilot-strategist][${VERSION}] Action insert error:`, insertErr);

          // Collect tool result for the next round
          toolResults.push({
            tool_call_id: tc.id,
            role: "tool",
            content: JSON.stringify({ status: result.status, ...result.data }),
          });
        }

        // Add tool results to messages for the next round
        for (const tr of toolResults) {
          messages.push(tr);
        }

        console.log(`[ads-autopilot-strategist][${VERSION}] Round ${round} complete: ${toolCalls.length} tools processed, continuing...`);
        
        // v1.34.0: Early exit for start trigger — only needs one strategic_plan, no need for R2
        if (trigger === "start" && toolCalls.some((tc: any) => tc.function.name === "strategic_plan")) {
          console.log(`[ads-autopilot-strategist][${VERSION}] Start trigger: strategic_plan produced, exiting loop early`);
          break;
        }
      }

      if (round >= MAX_ROUNDS) {
        console.warn(`[ads-autopilot-strategist][${VERSION}] Hit MAX_ROUNDS (${MAX_ROUNDS}) for account ${config.ad_account_id}`);
      }

      // ===== POST-PROCESSING: Link creative URLs to campaign actions =====
      try {
        const { data: pendingCampaigns } = await supabase
          .from("ads_autopilot_actions")
          .select("id, action_data")
          .eq("tenant_id", tenantId)
          .eq("session_id", sessionId)
          .eq("action_type", "create_campaign")
          .eq("status", "pending_approval");

        for (const campaign of (pendingCampaigns || [])) {
          const cData = campaign.action_data as Record<string, any> || {};
          const cPreview = cData.preview || {};
          if (cData.creative_url || cPreview.creative_url) continue;

          const productId = cData.product_id || cPreview.product_id;
          let resolvedUrl: string | null = null;

          if (productId) {
            const { data: asset } = await supabase
              .from("ads_creative_assets")
              .select("asset_url")
              .eq("tenant_id", tenantId)
              .eq("product_id", productId)
              .not("asset_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(1);
            resolvedUrl = asset?.[0]?.asset_url || null;
          }

          if (!resolvedUrl) {
            const { data: sessionAsset } = await supabase
              .from("ads_creative_assets")
              .select("asset_url")
              .eq("tenant_id", tenantId)
              .eq("session_id", sessionId)
              .not("asset_url", "is", null)
              .order("created_at", { ascending: false })
              .limit(1);
            resolvedUrl = sessionAsset?.[0]?.asset_url || null;
          }

          if (!resolvedUrl && productId) {
            const { data: prodImg } = await supabase
              .from("product_images")
              .select("url")
              .eq("product_id", productId)
              .order("sort_order", { ascending: true })
              .limit(1);
            resolvedUrl = prodImg?.[0]?.url || null;
          }

          if (resolvedUrl) {
            const updatedData = { ...cData, creative_url: resolvedUrl, preview: { ...cPreview, creative_url: resolvedUrl } };
            await supabase.from("ads_autopilot_actions").update({ action_data: updatedData }).eq("id", campaign.id);
            console.log(`[ads-autopilot-strategist][${VERSION}] Post-process: linked creative_url to campaign ${campaign.id}`);
          }
        }
      } catch (ppErr: any) {
        console.error(`[ads-autopilot-strategist][${VERSION}] Post-process creative linking error (non-blocking):`, ppErr.message);
      }

      // Save per-account session detail
      if (allAiText || totalPlanned > 0) {
        await supabase.from("ads_autopilot_sessions").insert({
          tenant_id: tenantId,
          channel: config.channel,
          trigger_type: `strategist_${trigger}`,
          motor_type: "strategist",
          ai_response_raw: allAiText,
          actions_planned: totalPlanned,
          actions_executed: totalExecuted,
          actions_rejected: totalRejected,
          context_snapshot: { ad_account_id: config.ad_account_id, trigger, rounds: round },
        });
      }

      console.log(`[ads-autopilot-strategist][${VERSION}] Account ${config.ad_account_id}: ${totalPlanned} planned, ${totalExecuted} executed, ${totalRejected} rejected (${round} rounds)`);
    } catch (err: any) {
      console.error(`[ads-autopilot-strategist][${VERSION}] Account ${config.ad_account_id} error:`, err.message);
    }
  }

  // Update main session
  const durationMs = Date.now() - startTime;
  await supabase
    .from("ads_autopilot_sessions")
    .update({
      actions_planned: totalPlanned,
      actions_executed: totalExecuted,
      actions_rejected: totalRejected,
      duration_ms: durationMs,
    })
    .eq("id", sessionId);

  console.log(`[ads-autopilot-strategist][${VERSION}] ${trigger} completed: ${activeConfigs.length} accounts, ${totalPlanned} planned, ${totalExecuted} executed, ${totalRejected} rejected in ${durationMs}ms`);

  return {
    trigger,
    session_id: sessionId,
    accounts: activeConfigs.length,
    actions: { planned: totalPlanned, executed: totalExecuted, rejected: totalRejected },
    duration_ms: durationMs,
  };
}

// ============ MAIN ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-strategist][${VERSION}] Request received`);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const tenantId = body.tenant_id;
    const trigger = (body.trigger || "weekly") as StrategistTrigger;
    const targetAccountId = body.target_account_id || null;
    const revisionFeedback = body.revision_feedback || null;

    // Cron mode: run for all tenants with active accounts
    if (!tenantId) {
      const { data: activeConfigs } = await supabase
        .from("ads_autopilot_account_configs")
        .select("tenant_id")
        .eq("is_ai_enabled", true)
        .is("kill_switch", false);

      const tenantIds = [...new Set((activeConfigs || []).map((c: any) => c.tenant_id))];
      console.log(`[ads-autopilot-strategist][${VERSION}] Cron ${trigger}: ${tenantIds.length} tenants`);

      const results: any[] = [];
      for (const tid of tenantIds) {
        try {
          const result = await runStrategistForTenant(supabase, tid, trigger);
          results.push({ tenant_id: tid, ...result });
        } catch (err: any) {
          results.push({ tenant_id: tid, error: err.message });
          console.error(`[ads-autopilot-strategist][${VERSION}] Error for tenant ${tid}:`, err.message);
        }
      }

      return ok({ trigger, tenants_processed: results.length, results });
    }

    // Manual invocation (with optional account filter)
    const result = await runStrategistForTenant(supabase, tenantId, trigger, targetAccountId, revisionFeedback, body);
    return ok(result);
  } catch (err: any) {
    console.error(`[ads-autopilot-strategist][${VERSION}] Fatal:`, err.message);
    return fail(err.message || "Erro interno");
  }
});
