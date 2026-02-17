import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v5.4.0"; // Fix: strategy mode guardrails — AI must validate actions against config before proposing
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ============ TOOL DEFINITIONS ============

const TOOLS = [
  // ===== LEITURA: Campanhas e Performance =====
  {
    type: "function",
    function: {
      name: "get_campaign_performance",
      description: "Busca performance real das campanhas Meta (até 200 campanhas, ACTIVE primeiro). OBRIGATÓRIO antes de qualquer diagnóstico.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta de anúncios (opcional)" },
          status_filter: { type: "string", enum: ["ACTIVE", "PAUSED", "ALL"], description: "Filtrar por status (default: ALL, mas ACTIVE primeiro)" },
          days: { type: "number", description: "Janela de dias para métricas (default: 14, max: 30)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_campaign_details",
      description: "Drill-down em uma campanha específica: mostra todos os conjuntos e anúncios vinculados com métricas individuais.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "meta_campaign_id da campanha" },
        },
        required: ["campaign_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_performance_trend",
      description: "Time-series de uma campanha: gasto, conversões, ROAS por dia nos últimos N dias. Use para identificar tendências.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "meta_campaign_id" },
          days: { type: "number", description: "Janela em dias (default: 14, max: 30)" },
        },
        required: ["campaign_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_adset_performance",
      description: "Performance por conjunto de anúncios (AdSet) com métricas agregadas. Essencial para otimizar segmentação.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta (opcional)" },
          campaign_id: { type: "string", description: "Filtrar por campanha específica (opcional)" },
          status: { type: "string", enum: ["ACTIVE", "PAUSED", "ALL"], description: "Filtrar por status (default: ALL)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_ad_performance",
      description: "Performance por anúncio individual com criativos vinculados. Essencial para saber qual criativo performa melhor.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta (opcional)" },
          campaign_id: { type: "string", description: "Filtrar por campanha (opcional)" },
          adset_id: { type: "string", description: "Filtrar por conjunto (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ===== LEITURA: Contexto de Negócio =====
  {
    type: "function",
    function: {
      name: "get_store_context",
      description: "Busca contexto completo do negócio: nicho, público-alvo, domínio, URLs, ofertas ativas, categorias, margens. Use para entender o negócio antes de montar estratégias.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_products",
      description: "Busca produtos do catálogo da loja com imagens e margens. Use ANTES de gerar criativos ou criar campanhas.",
      parameters: {
        type: "object",
        properties: {
          search: { type: "string", description: "Buscar por nome (opcional)" },
          limit: { type: "number", description: "Quantidade (default 20, max 50)" },
          status: { type: "string", enum: ["active", "draft", "archived"], description: "Filtrar por status (default: active)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_images",
      description: "Busca todas as imagens de um produto específico (catálogo + Meu Drive). Use quando precisar das imagens reais do produto para criar criativos.",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "ID do produto" },
          product_name: { type: "string", description: "Nome do produto (para buscar no Drive)" },
        },
        required: ["product_id"],
        additionalProperties: false,
      },
    },
  },
  // ===== LEITURA: Criativos, Públicos, Tracking =====
  {
    type: "function",
    function: {
      name: "get_creative_assets",
      description: "Lista os criativos existentes (imagens/copy gerados).",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "ready", "active", "rejected"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_meta_adsets",
      description: "Lista conjuntos de anúncios Meta (até 100) com status, orçamento, segmentação e pixel.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta (opcional)" },
          status: { type: "string", enum: ["ACTIVE", "PAUSED", "DELETED"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_meta_ads",
      description: "Lista anúncios individuais Meta (até 100) com criativos vinculados.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_audiences",
      description: "Lista os públicos/audiências configurados.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["meta", "google"], description: "Canal (default: todos)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tracking_health",
      description: "Retorna saúde do pixel/rastreamento (Meta, Google, TikTok).",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ===== LEITURA: Autopilot =====
  {
    type: "function",
    function: {
      name: "get_autopilot_config",
      description: "Retorna configurações atuais da IA de Tráfego (globais e por conta).",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopilot_actions",
      description: "Lista ações executadas ou agendadas pela IA de Tráfego.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["scheduled", "executed", "failed", "pending_approval"], description: "Filtrar por status" },
          limit: { type: "number", description: "Quantidade (default 15)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopilot_insights",
      description: "Lista diagnósticos e insights gerados pela IA de Tráfego.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "resolved"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_autopilot_sessions",
      description: "Histórico de execuções da IA de Tráfego.",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Quantidade (default 10)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_experiments",
      description: "Lista testes A/B em andamento ou finalizados.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["draft", "running", "completed", "cancelled"], description: "Filtrar por status" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ===== LEITURA: Outros canais =====
  {
    type: "function",
    function: {
      name: "get_google_campaigns",
      description: "Busca campanhas e performance do Google Ads.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta Google Ads (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_tiktok_campaigns",
      description: "Busca campanhas e performance do TikTok Ads.",
      parameters: {
        type: "object",
        properties: {
          advertiser_id: { type: "string", description: "ID do advertiser TikTok (opcional)" },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  // ===== ESCRITA: Criativos e Campanhas =====
  {
    type: "function",
    function: {
      name: "trigger_creative_generation",
      description: "Gera textos/copies estratégicos para anúncios (headlines, roteiros). Para IMAGENS use generate_creative_image.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_creative_image",
      description: "Gera IMAGENS de criativos para anúncios via IA. Use quando precisar de artes visuais.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nome do produto do catálogo (obrigatório)" },
          channel: { type: "string", enum: ["meta", "google", "tiktok"], description: "Canal (default: meta)" },
          campaign_objective: { type: "string", enum: ["sales", "leads", "traffic", "awareness"], description: "Objetivo" },
          target_audience: { type: "string", description: "Descrição do público-alvo" },
          style_preference: { type: "string", enum: ["promotional", "product_natural", "person_interacting"], description: "Estilo visual" },
          format: { type: "string", enum: ["1:1", "9:16", "16:9"], description: "Formato (default: 1:1)" },
          variations: { type: "number", description: "Variações (1-4, default: 2)" },
        },
        required: ["product_name"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_meta_campaign",
      description: "Cria campanha COMPLETA no Meta Ads (Campanha → Conjunto → Anúncio). Criada PAUSADA, ativação agendada para 00:01-04:00 BRT.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string", description: "Nome do produto (obrigatório)" },
          campaign_name: { type: "string", description: "Nome da campanha (opcional)" },
          objective: { type: "string", enum: ["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"], description: "Objetivo (default: OUTCOME_SALES)" },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos (default: 3000)" },
          targeting_description: { type: "string", description: "Descrição do público-alvo" },
          funnel_stage: { type: "string", enum: ["cold", "warm", "hot"], description: "Estágio do funil" },
          ad_account_id: { type: "string", description: "ID da conta Meta (opcional)" },
        },
        required: ["product_name"],
        additionalProperties: false,
      },
    },
  },
  // ===== ESCRITA: Gerenciamento de Entidades (NOVO — Frente 4) =====
  {
    type: "function",
    function: {
      name: "toggle_entity_status",
      description: "Pausa ou reativa uma campanha, conjunto de anúncios ou anúncio no Meta Ads.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["campaign", "adset", "ad"], description: "Tipo da entidade" },
          entity_id: { type: "string", description: "ID da entidade na Meta (meta_campaign_id, meta_adset_id ou meta_ad_id)" },
          new_status: { type: "string", enum: ["ACTIVE", "PAUSED"], description: "Novo status" },
          ad_account_id: { type: "string", description: "ID da conta Meta (opcional, busca automática)" },
        },
        required: ["entity_type", "entity_id", "new_status"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_budget",
      description: "Altera o orçamento diário de uma campanha ou conjunto de anúncios existente no Meta.",
      parameters: {
        type: "object",
        properties: {
          entity_type: { type: "string", enum: ["campaign", "adset"], description: "Tipo (campanha ou conjunto)" },
          entity_id: { type: "string", description: "ID da entidade na Meta" },
          new_daily_budget_cents: { type: "number", description: "Novo orçamento diário em centavos (ex: 5000 = R$50)" },
          ad_account_id: { type: "string", description: "ID da conta Meta (opcional)" },
        },
        required: ["entity_type", "entity_id", "new_daily_budget_cents"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "duplicate_campaign",
      description: "Duplica uma campanha Meta existente: cria nova campanha com os mesmos conjuntos e anúncios, podendo alterar nome, orçamento ou público.",
      parameters: {
        type: "object",
        properties: {
          source_campaign_id: { type: "string", description: "meta_campaign_id da campanha a duplicar" },
          new_name: { type: "string", description: "Nome da nova campanha (opcional, auto-gerado se vazio)" },
          new_daily_budget_cents: { type: "number", description: "Novo orçamento diário em centavos (opcional, mantém o original)" },
          ad_account_id: { type: "string", description: "ID da conta Meta (opcional, busca automática)" },
        },
        required: ["source_campaign_id"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_adset_targeting",
      description: "Atualiza a segmentação (targeting) de um conjunto de anúncios existente no Meta. Pode alterar faixa etária, gênero, localização e interesses.",
      parameters: {
        type: "object",
        properties: {
          adset_id: { type: "string", description: "meta_adset_id do conjunto a atualizar" },
          age_min: { type: "number", description: "Idade mínima (13-65)" },
          age_max: { type: "number", description: "Idade máxima (13-65)" },
          genders: { type: "array", items: { type: "number" }, description: "Gêneros: [0]=todos, [1]=masculino, [2]=feminino" },
          geo_locations: { type: "object", description: "Localização: {countries: ['BR'], regions: [{key:'123'}], cities: [{key:'456'}]}" },
          interests: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } } }, description: "Interesses: [{id:'123', name:'Cosmetics'}]" },
          ad_account_id: { type: "string", description: "ID da conta Meta (opcional)" },
        },
        required: ["adset_id"],
        additionalProperties: false,
      },
    },
  },
  // ===== ESCRITA: Públicos Customizados =====
  {
    type: "function",
    function: {
      name: "create_custom_audience",
      description: "Cria um público personalizado no Meta a partir de dados de clientes (emails/telefones) ou de engajamento (pixel, vídeo, página). Retorna o ID do público criado.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Nome do público" },
          description: { type: "string", description: "Descrição do público" },
          source: { type: "string", enum: ["customer_list", "website", "engagement"], description: "Fonte do público (customer_list = upload de emails/tel, website = pixel, engagement = interações)" },
          subtype: { type: "string", enum: ["CUSTOM", "WEBSITE", "ENGAGEMENT", "LOOKALIKE"], description: "Subtipo Meta (default: CUSTOM)" },
          retention_days: { type: "number", description: "Dias de retenção para website/engagement (default: 30, max: 180)" },
          rule: { type: "object", description: "Regra para website audiences: {url_contains: 'string'} ou {event_name: 'Purchase'}" },
          ad_account_id: { type: "string", description: "ID da conta Meta (opcional)" },
        },
        required: ["name", "source"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lookalike_audience",
      description: "Cria um público semelhante (Lookalike) no Meta a partir de um público personalizado existente. Especifique o ratio (1-10%) e o país.",
      parameters: {
        type: "object",
        properties: {
          source_audience_id: { type: "string", description: "ID do público de origem (Custom Audience)" },
          name: { type: "string", description: "Nome do Lookalike (opcional, auto-gerado)" },
          country: { type: "string", description: "Código do país (default: BR)" },
          ratio: { type: "number", description: "Percentual de similaridade (0.01 a 0.20, default: 0.01 = 1%)" },
          ad_account_id: { type: "string", description: "ID da conta Meta (opcional)" },
        },
        required: ["source_audience_id"],
        additionalProperties: false,
      },
    },
  },
  // ===== ESCRITA: Autopilot Config =====
  {
    type: "function",
    function: {
      name: "update_autopilot_config",
      description: "Atualiza configurações da IA de Tráfego. Use APENAS quando o usuário pedir explicitamente.",
      parameters: {
        type: "object",
        properties: {
          ad_account_id: { type: "string", description: "ID da conta de anúncios" },
          channel: { type: "string", description: "Canal da conta" },
          updates: {
            type: "object",
            description: "Campos a atualizar",
            properties: {
              target_roi: { type: "number" },
              budget_cents: { type: "number" },
              strategy_mode: { type: "string", enum: ["conservative", "balanced", "aggressive"] },
              is_ai_enabled: { type: "boolean" },
              user_instructions: { type: "string" },
              human_approval_mode: { type: "string", enum: ["auto", "high_impact"] },
              chat_overrides: { type: "object", description: "Override via comando do chat. Inclua os campos sobrescritos com uma descrição. Ex: {budget_cents: 80000, reason: 'Lojista solicitou aumento para R$800/dia'}" },
            },
          },
        },
        required: ["ad_account_id", "channel", "updates"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_autopilot_analysis",
      description: "Dispara análise completa da IA de Tráfego. Só use quando solicitado.",
      parameters: {
        type: "object",
        properties: {
          channel: { type: "string", enum: ["meta", "google", "tiktok"], description: "Canal" },
        },
        required: ["channel"],
        additionalProperties: false,
      },
    },
  },
  // ===== UTILIDADES =====
  {
    type: "function",
    function: {
      name: "analyze_url",
      description: "Analisa conteúdo de uma URL (landing page, concorrente). Extrai texto e estrutura.",
      parameters: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL completa" },
        },
        required: ["url"],
        additionalProperties: false,
      },
    },
  },
];

// ============ TOOL EXECUTORS ============

async function executeTool(
  supabase: any,
  tenantId: string,
  toolName: string,
  args: any
): Promise<string> {
  try {
    switch (toolName) {
      case "get_campaign_performance":
        return await getCampaignPerformance(supabase, tenantId, args.ad_account_id, args.status_filter, args.days);
      case "get_campaign_details":
        return await getCampaignDetails(supabase, tenantId, args.campaign_id);
      case "get_performance_trend":
        return await getPerformanceTrend(supabase, tenantId, args.campaign_id, args.days);
      case "get_adset_performance":
        return await getAdsetPerformance(supabase, tenantId, args.ad_account_id, args.campaign_id, args.status);
      case "get_ad_performance":
        return await getAdPerformance(supabase, tenantId, args.ad_account_id, args.campaign_id, args.adset_id);
      case "get_store_context":
        return await getStoreContext(supabase, tenantId);
      case "get_products":
        return await getProducts(supabase, tenantId, args.search, args.limit, args.status);
      case "get_product_images":
        return await getProductImages(supabase, tenantId, args.product_id, args.product_name);
      case "get_creative_assets":
        return await getCreativeAssets(supabase, tenantId, args.status);
      case "get_meta_adsets":
        return await getMetaAdsets(supabase, tenantId, args.ad_account_id, args.status);
      case "get_meta_ads":
        return await getMetaAds(supabase, tenantId, args.ad_account_id);
      case "get_audiences":
        return await getAudiences(supabase, tenantId, args.channel);
      case "get_tracking_health":
        return await getTrackingHealth(supabase, tenantId);
      case "get_autopilot_config":
        return await getAutopilotConfig(supabase, tenantId, args.ad_account_id);
      case "get_autopilot_actions":
        return await getAutopilotActions(supabase, tenantId, args.status, args.limit);
      case "get_autopilot_insights":
        return await getAutopilotInsights(supabase, tenantId, args.status);
      case "get_autopilot_sessions":
        return await getAutopilotSessions(supabase, tenantId, args.limit);
      case "get_experiments":
        return await getExperiments(supabase, tenantId, args.status);
      case "get_google_campaigns":
        return await getGoogleCampaigns(supabase, tenantId, args.ad_account_id);
      case "get_tiktok_campaigns":
        return await getTikTokCampaigns(supabase, tenantId, args.advertiser_id);
      case "trigger_creative_generation":
        return await triggerCreativeGeneration(supabase, tenantId);
      case "generate_creative_image":
        return await generateCreativeImage(supabase, tenantId, args);
      case "create_meta_campaign":
        return await createMetaCampaign(supabase, tenantId, args);
      case "toggle_entity_status":
        return await toggleEntityStatus(supabase, tenantId, args);
      case "update_budget":
        return await updateBudget(supabase, tenantId, args);
      case "duplicate_campaign":
        return await duplicateCampaign(supabase, tenantId, args);
      case "update_adset_targeting":
        return await updateAdsetTargeting(supabase, tenantId, args);
      case "create_custom_audience":
        return await createCustomAudience(supabase, tenantId, args);
      case "create_lookalike_audience":
        return await createLookalikeAudience(supabase, tenantId, args);
      case "update_autopilot_config":
        return await updateAutopilotConfig(supabase, tenantId, args.ad_account_id, args.channel, args.updates);
      case "trigger_autopilot_analysis":
        return await triggerAutopilotAnalysis(supabase, tenantId, args.channel);
      case "analyze_url":
        return await analyzeUrl(args.url);
      default:
        return JSON.stringify({ error: `Ferramenta desconhecida: ${toolName}` });
    }
  } catch (err: any) {
    console.error(`[ads-chat][${VERSION}] Tool error (${toolName}):`, err);
    return JSON.stringify({ error: err.message || "Erro ao executar ferramenta" });
  }
}

// ============ TOOL IMPLEMENTATIONS ============

// --- Frente 1: getCampaignPerformance com limites corrigidos ---
async function getCampaignPerformance(supabase: any, tenantId: string, adAccountId?: string, statusFilter?: string, days?: number) {
  const dayWindow = Math.min(days || 14, 30);
  const sinceDate = new Date(Date.now() - dayWindow * 86400000).toISOString().split("T")[0];

  // Fetch ALL campaigns (up to 200), ACTIVE first
  const campQuery = supabase
    .from("meta_ad_campaigns")
    .select("meta_campaign_id, name, status, objective, daily_budget_cents, ad_account_id")
    .eq("tenant_id", tenantId)
    .order("status", { ascending: true }); // ACTIVE before PAUSED alphabetically
  if (adAccountId) campQuery.eq("ad_account_id", adAccountId);
  if (statusFilter && statusFilter !== "ALL") campQuery.eq("status", statusFilter);
  const { data: campaigns } = await campQuery.limit(200);

  // Fetch insights for the window
  const insightQuery = supabase
    .from("meta_ad_insights")
    .select("meta_campaign_id, spend_cents, impressions, clicks, conversions, conversion_value_cents, roas, ctr, cpc_cents, cpm_cents, date_start")
    .eq("tenant_id", tenantId)
    .gte("date_start", sinceDate);
  const { data: insights } = await insightQuery.limit(2000);

  const campMap: Record<string, any> = {};
  for (const c of (campaigns || [])) {
    campMap[c.meta_campaign_id] = {
      meta_campaign_id: c.meta_campaign_id,
      name: c.name, status: c.status, objective: c.objective,
      daily_budget: `R$ ${((c.daily_budget_cents || 0) / 100).toFixed(2)}`,
      ad_account_id: c.ad_account_id,
      spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, days_with_data: 0,
    };
  }

  for (const i of (insights || [])) {
    const c = campMap[i.meta_campaign_id];
    if (!c) continue;
    c.spend += (i.spend_cents || 0) / 100;
    c.impressions += i.impressions || 0;
    c.clicks += i.clicks || 0;
    c.conversions += i.conversions || 0;
    c.revenue += (i.conversion_value_cents || 0) / 100;
    c.days_with_data += 1;
  }

  const allCamps = Object.values(campMap);
  const activeCamps = allCamps.filter((c: any) => c.status === "ACTIVE");
  const pausedCamps = allCamps.filter((c: any) => c.status === "PAUSED");

  const formatCamp = (c: any) => ({
    ...c,
    spend: `R$ ${c.spend.toFixed(2)}`,
    revenue: `R$ ${c.revenue.toFixed(2)}`,
    roas: c.spend > 0 ? (c.revenue / c.spend).toFixed(2) : "N/A",
    cpa: c.conversions > 0 ? `R$ ${(c.spend / c.conversions).toFixed(2)}` : "N/A",
  });

  return JSON.stringify({
    summary: {
      total_campaigns: campaigns?.length || 0,
      active: activeCamps.length,
      paused: pausedCamps.length,
      period: `últimos ${dayWindow} dias`,
      total_spend: `R$ ${allCamps.reduce((s: number, c: any) => s + (typeof c.spend === 'number' ? c.spend : 0), 0).toFixed(2)}`,
    },
    active_campaigns: activeCamps.map(formatCamp),
    paused_campaigns_sample: pausedCamps.slice(0, 10).map(formatCamp),
    paused_total: pausedCamps.length,
  });
}

// --- Frente 3: get_campaign_details ---
async function getCampaignDetails(supabase: any, tenantId: string, campaignId: string) {
  // Campaign
  const { data: campaign } = await supabase
    .from("meta_ad_campaigns")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("meta_campaign_id", campaignId)
    .maybeSingle();

  if (!campaign) return JSON.stringify({ error: "Campanha não encontrada" });

  // AdSets
  const { data: adsets } = await supabase
    .from("meta_ad_adsets")
    .select("meta_adset_id, name, status, daily_budget_cents, targeting, pixel_id, optimization_goal")
    .eq("tenant_id", tenantId)
    .eq("meta_campaign_id", campaignId)
    .limit(50);

  // Ads
  const { data: ads } = await supabase
    .from("meta_ad_ads")
    .select("meta_ad_id, name, status, effective_status, meta_adset_id")
    .eq("tenant_id", tenantId)
    .eq("meta_campaign_id", campaignId)
    .limit(100);

  // Recent insights
  const fourteenDaysAgo = new Date(Date.now() - 14 * 86400000).toISOString().split("T")[0];
  const { data: insights } = await supabase
    .from("meta_ad_insights")
    .select("spend_cents, impressions, clicks, conversions, conversion_value_cents, date_start")
    .eq("tenant_id", tenantId)
    .eq("meta_campaign_id", campaignId)
    .gte("date_start", fourteenDaysAgo)
    .order("date_start", { ascending: false });

  const totalSpend = (insights || []).reduce((s: number, i: any) => s + (i.spend_cents || 0), 0) / 100;
  const totalConv = (insights || []).reduce((s: number, i: any) => s + (i.conversions || 0), 0);
  const totalRev = (insights || []).reduce((s: number, i: any) => s + (i.conversion_value_cents || 0), 0) / 100;

  return JSON.stringify({
    campaign: {
      name: campaign.name, status: campaign.status, objective: campaign.objective,
      daily_budget: `R$ ${((campaign.daily_budget_cents || 0) / 100).toFixed(2)}`,
      meta_campaign_id: campaign.meta_campaign_id,
    },
    performance_14d: {
      spend: `R$ ${totalSpend.toFixed(2)}`,
      conversions: totalConv,
      revenue: `R$ ${totalRev.toFixed(2)}`,
      roas: totalSpend > 0 ? (totalRev / totalSpend).toFixed(2) : "N/A",
    },
    adsets: (adsets || []).map((a: any) => ({
      meta_adset_id: a.meta_adset_id, name: a.name, status: a.status,
      daily_budget: a.daily_budget_cents ? `R$ ${(a.daily_budget_cents / 100).toFixed(2)}` : null,
      has_pixel: !!a.pixel_id, optimization_goal: a.optimization_goal,
      targeting_summary: a.targeting ? JSON.stringify(a.targeting).substring(0, 200) : null,
      ads: (ads || []).filter((ad: any) => ad.meta_adset_id === a.meta_adset_id).map((ad: any) => ({
        meta_ad_id: ad.meta_ad_id, name: ad.name, status: ad.status,
      })),
    })),
  });
}

// --- Frente 3: get_performance_trend ---
async function getPerformanceTrend(supabase: any, tenantId: string, campaignId: string, days?: number) {
  const dayWindow = Math.min(days || 14, 30);
  const sinceDate = new Date(Date.now() - dayWindow * 86400000).toISOString().split("T")[0];

  const { data: insights } = await supabase
    .from("meta_ad_insights")
    .select("date_start, spend_cents, impressions, clicks, conversions, conversion_value_cents, ctr, roas")
    .eq("tenant_id", tenantId)
    .eq("meta_campaign_id", campaignId)
    .gte("date_start", sinceDate)
    .order("date_start", { ascending: true })
    .limit(60);

  if (!insights || insights.length === 0) {
    return JSON.stringify({ error: "Sem dados de insights para esta campanha no período" });
  }

  // Aggregate by date
  const byDate: Record<string, any> = {};
  for (const i of insights) {
    const d = i.date_start;
    if (!byDate[d]) byDate[d] = { date: d, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    byDate[d].spend += (i.spend_cents || 0) / 100;
    byDate[d].impressions += i.impressions || 0;
    byDate[d].clicks += i.clicks || 0;
    byDate[d].conversions += i.conversions || 0;
    byDate[d].revenue += (i.conversion_value_cents || 0) / 100;
  }

  const daily = Object.values(byDate).map((d: any) => ({
    ...d,
    spend: `R$ ${d.spend.toFixed(2)}`,
    revenue: `R$ ${d.revenue.toFixed(2)}`,
    roas: d.spend > 0 ? (d.revenue / d.spend).toFixed(2) : "0",
    cpa: d.conversions > 0 ? `R$ ${(d.spend / d.conversions).toFixed(2)}` : "N/A",
  }));

  return JSON.stringify({ campaign_id: campaignId, period: `últimos ${dayWindow} dias`, daily_data: daily });
}

// --- Frente 3: get_adset_performance ---
async function getAdsetPerformance(supabase: any, tenantId: string, adAccountId?: string, campaignId?: string, status?: string) {
  const query = supabase
    .from("meta_ad_adsets")
    .select("meta_adset_id, meta_campaign_id, name, status, daily_budget_cents, lifetime_budget_cents, targeting, pixel_id, optimization_goal, bid_strategy, ad_account_id, created_at")
    .eq("tenant_id", tenantId)
    .order("status", { ascending: true });
  if (adAccountId) query.eq("ad_account_id", adAccountId);
  if (campaignId) query.eq("meta_campaign_id", campaignId);
  if (status && status !== "ALL") query.eq("status", status);
  const { data: adsets, error } = await query.limit(100);
  if (error) return JSON.stringify({ error: error.message });

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
      has_pixel: !!a.pixel_id, optimization_goal: a.optimization_goal,
      targeting_summary: a.targeting ? JSON.stringify(a.targeting).substring(0, 200) : null,
    })),
  });
}

// --- Frente 3: get_ad_performance ---
async function getAdPerformance(supabase: any, tenantId: string, adAccountId?: string, campaignId?: string, adsetId?: string) {
  const query = supabase
    .from("meta_ad_ads")
    .select("meta_ad_id, name, status, effective_status, meta_adset_id, meta_campaign_id, ad_account_id, created_at")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (adAccountId) query.eq("ad_account_id", adAccountId);
  if (campaignId) query.eq("meta_campaign_id", campaignId);
  if (adsetId) query.eq("meta_adset_id", adsetId);
  const { data: ads, error } = await query.limit(100);
  if (error) return JSON.stringify({ error: error.message });

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

// --- Frente 3: get_store_context ---
async function getStoreContext(supabase: any, tenantId: string) {
  // Store settings
  const { data: settings } = await supabase
    .from("store_settings")
    .select("store_name, store_description, logo_url, favicon_url, contact_email, contact_phone, social_links, seo_title, seo_description")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // Tenant info (domain, slug)
  const { data: tenant } = await supabase
    .from("tenants")
    .select("name, slug, custom_domain")
    .eq("id", tenantId)
    .single();

  // Categories
  const { data: categories } = await supabase
    .from("categories")
    .select("name, slug")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(20);

  // Active discounts
  const { data: discounts } = await supabase
    .from("discounts")
    .select("code, type, value, min_purchase, max_uses, starts_at, ends_at")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .limit(10);

  // Top 5 products by revenue (orders last 30d)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: topOrderItems } = await supabase
    .from("order_items")
    .select("product_id, quantity, unit_price, orders!inner(tenant_id, payment_status, created_at)")
    .eq("orders.tenant_id", tenantId)
    .eq("orders.payment_status", "paid")
    .gte("orders.created_at", thirtyDaysAgo)
    .limit(500);

  // Aggregate by product (values already in BRL, NOT cents)
  const prodRevenue: Record<string, { revenue: number; qty: number }> = {};
  for (const item of (topOrderItems || [])) {
    const pid = item.product_id;
    if (!prodRevenue[pid]) prodRevenue[pid] = { revenue: 0, qty: 0 };
    prodRevenue[pid].revenue += (item.unit_price || 0) * (item.quantity || 1);
    prodRevenue[pid].qty += item.quantity || 1;
  }
  const topProductIds = Object.entries(prodRevenue)
    .sort(([, a], [, b]) => b.revenue - a.revenue)
    .slice(0, 5)
    .map(([id]) => id);

  let topProducts: any[] = [];
  if (topProductIds.length > 0) {
    const { data: prods } = await supabase
      .from("products")
      .select("id, name, price, cost_price, compare_at_price")
      .in("id", topProductIds);
    topProducts = (prods || []).map((p: any) => ({
      name: p.name,
      price: `R$ ${(p.price || 0).toFixed(2)}`,
      cost_price: p.cost_price ? `R$ ${p.cost_price.toFixed(2)}` : null,
      margin_pct: p.cost_price && p.price ? `${(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%` : null,
      revenue_30d: `R$ ${(prodRevenue[p.id]?.revenue || 0).toFixed(2)}`,
      units_sold_30d: prodRevenue[p.id]?.qty || 0,
    }));
  }

  // Marketing integrations (pixel IDs)
  const { data: mktConfig } = await supabase
    .from("marketing_integrations")
    .select("meta_pixel_id, meta_enabled, google_measurement_id, google_enabled")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  const storeUrl = tenant?.custom_domain || (tenant?.slug ? `${tenant.slug}.comandocentral.com.br` : null);

  return JSON.stringify({
    store: {
      name: settings?.store_name || tenant?.name || "Loja",
      description: settings?.store_description || null,
      url: storeUrl,
      contact_email: settings?.contact_email,
      contact_phone: settings?.contact_phone,
      seo_title: settings?.seo_title,
      seo_description: settings?.seo_description,
    },
    categories: (categories || []).map((c: any) => c.name),
    active_offers: (discounts || []).map((d: any) => ({
      code: d.code, type: d.type, value: d.value,
      min_purchase: d.min_purchase ? `R$ ${(d.min_purchase / 100).toFixed(2)}` : null,
      ends_at: d.ends_at,
    })),
    top_products_by_revenue: topProducts,
    tracking: {
      meta_pixel: mktConfig?.meta_pixel_id || "Não configurado",
      meta_enabled: mktConfig?.meta_enabled || false,
      google_analytics: mktConfig?.google_measurement_id || "Não configurado",
    },
  });
}

// --- Frente 4: toggle_entity_status ---
async function toggleEntityStatus(supabase: any, tenantId: string, args: any) {
  const { entity_type, entity_id, new_status } = args;

  // Get Meta connection
  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn) return JSON.stringify({ success: false, error: "Meta não conectada" });

  const res = await fetch(`https://graph.facebook.com/v21.0/${entity_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: new_status, access_token: conn.access_token }),
  });
  const result = await res.json();

  if (result.error) {
    return JSON.stringify({ success: false, error: result.error.message });
  }

  // Update local DB
  const table = entity_type === "campaign" ? "meta_ad_campaigns" :
    entity_type === "adset" ? "meta_ad_adsets" : "meta_ad_ads";
  const idCol = entity_type === "campaign" ? "meta_campaign_id" :
    entity_type === "adset" ? "meta_adset_id" : "meta_ad_id";

  await supabase.from(table).update({ status: new_status, synced_at: new Date().toISOString() })
    .eq("tenant_id", tenantId).eq(idCol, entity_id);

  const statusLabel = new_status === "ACTIVE" ? "reativado" : "pausado";
  const typeLabel = entity_type === "campaign" ? "Campanha" : entity_type === "adset" ? "Conjunto" : "Anúncio";

  return JSON.stringify({ success: true, message: `${typeLabel} ${statusLabel} com sucesso.` });
}

// --- Frente 4: update_budget ---
async function updateBudget(supabase: any, tenantId: string, args: any) {
  const { entity_type, entity_id, new_daily_budget_cents } = args;

  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn) return JSON.stringify({ success: false, error: "Meta não conectada" });

  // Meta API uses daily_budget in the account currency's smallest unit
  const res = await fetch(`https://graph.facebook.com/v21.0/${entity_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ daily_budget: new_daily_budget_cents, access_token: conn.access_token }),
  });
  const result = await res.json();

  if (result.error) {
    return JSON.stringify({ success: false, error: result.error.message });
  }

  // Update local DB
  const table = entity_type === "campaign" ? "meta_ad_campaigns" : "meta_ad_adsets";
  const idCol = entity_type === "campaign" ? "meta_campaign_id" : "meta_adset_id";

  await supabase.from(table).update({ daily_budget_cents: new_daily_budget_cents, synced_at: new Date().toISOString() })
    .eq("tenant_id", tenantId).eq(idCol, entity_id);

  return JSON.stringify({
    success: true,
    message: `Orçamento atualizado para R$ ${(new_daily_budget_cents / 100).toFixed(2)}/dia.`,
  });
}

// --- Frente 4.3: duplicate_campaign ---
async function duplicateCampaign(supabase: any, tenantId: string, args: any) {
  const { source_campaign_id, new_name, new_daily_budget_cents } = args;

  // Get source campaign
  const { data: source } = await supabase
    .from("meta_ad_campaigns")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("meta_campaign_id", source_campaign_id)
    .maybeSingle();

  if (!source) return JSON.stringify({ success: false, error: "Campanha original não encontrada." });

  // Get Meta connection
  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token, metadata")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn) return JSON.stringify({ success: false, error: "Meta não conectada." });

  const adAccountId = args.ad_account_id || source.ad_account_id;
  const accountIdClean = adAccountId.replace("act_", "");
  const campName = new_name || `[Cópia] ${source.name} — ${new Date().toISOString().split("T")[0]}`;
  const dailyBudget = new_daily_budget_cents || source.daily_budget_cents || 3000;

  // Create new campaign PAUSED
  const campRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/campaigns`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: campName,
      objective: source.objective || "OUTCOME_SALES",
      status: "PAUSED",
      special_ad_categories: [],
      daily_budget: dailyBudget,
      access_token: conn.access_token,
    }),
  });
  const campData = await campRes.json();
  if (campData.error) return JSON.stringify({ success: false, error: `Falha ao criar campanha: ${campData.error.message}` });
  const newCampaignId = campData.id;

  // Save to local DB
  await supabase.from("meta_ad_campaigns").insert({
    tenant_id: tenantId, ad_account_id: adAccountId, meta_campaign_id: newCampaignId,
    name: campName, status: "PAUSED", objective: source.objective,
    daily_budget_cents: dailyBudget, synced_at: new Date().toISOString(),
  });

  // Get source adsets
  const { data: sourceAdsets } = await supabase
    .from("meta_ad_adsets")
    .select("meta_adset_id, name, daily_budget_cents, targeting, pixel_id, optimization_goal, bid_strategy")
    .eq("tenant_id", tenantId)
    .eq("meta_campaign_id", source_campaign_id)
    .limit(20);

  let adsetsCreated = 0;
  let adsCreated = 0;

  for (const adset of (sourceAdsets || [])) {
    // Get original adset details from Meta to copy targeting properly
    const adsetBody: any = {
      campaign_id: newCampaignId,
      name: `[Cópia] ${adset.name}`,
      status: "PAUSED",
      optimization_goal: adset.optimization_goal || "OFFSITE_CONVERSIONS",
      billing_event: "IMPRESSIONS",
      access_token: conn.access_token,
      targeting_automation: JSON.stringify({ advantage_audience: 0 }),
    };

    if (adset.daily_budget_cents) adsetBody.daily_budget = adset.daily_budget_cents;
    if (adset.targeting) adsetBody.targeting = JSON.stringify(adset.targeting);
    if (adset.pixel_id) {
      adsetBody.promoted_object = JSON.stringify({ pixel_id: adset.pixel_id, custom_event_type: "PURCHASE" });
    }
    if (adset.bid_strategy) adsetBody.bid_strategy = adset.bid_strategy;

    const adsetRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adsets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adsetBody),
    });
    const adsetData = await adsetRes.json();
    if (adsetData.error) {
      console.error(`[ads-chat][${VERSION}] Duplicate adset error:`, adsetData.error.message);
      continue;
    }
    adsetsCreated++;
    const newAdsetId = adsetData.id;

    // Save adset locally
    await supabase.from("meta_ad_adsets").insert({
      tenant_id: tenantId, ad_account_id: adAccountId, meta_adset_id: newAdsetId,
      meta_campaign_id: newCampaignId, name: `[Cópia] ${adset.name}`, status: "PAUSED",
      daily_budget_cents: adset.daily_budget_cents, targeting: adset.targeting,
      pixel_id: adset.pixel_id, optimization_goal: adset.optimization_goal,
      synced_at: new Date().toISOString(),
    });

    // Get source ads for this adset
    const { data: sourceAds } = await supabase
      .from("meta_ad_ads")
      .select("meta_ad_id, name")
      .eq("tenant_id", tenantId)
      .eq("meta_adset_id", adset.meta_adset_id)
      .limit(20);

    for (const ad of (sourceAds || [])) {
      // Get creative from original ad
      const adDetailsRes = await fetch(`https://graph.facebook.com/v21.0/${ad.meta_ad_id}?fields=creative{id}&access_token=${conn.access_token}`);
      const adDetails = await adDetailsRes.json();
      const creativeId = adDetails?.creative?.id;
      if (!creativeId) continue;

      const newAdBody: any = {
        name: `[Cópia] ${ad.name}`,
        adset_id: newAdsetId,
        creative: JSON.stringify({ creative_id: creativeId }),
        status: "PAUSED",
        access_token: conn.access_token,
      };

      const adRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/ads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newAdBody),
      });
      const adData = await adRes.json();
      if (adData.error) {
        console.error(`[ads-chat][${VERSION}] Duplicate ad error:`, adData.error.message);
        continue;
      }
      adsCreated++;

      await supabase.from("meta_ad_ads").insert({
        tenant_id: tenantId, ad_account_id: adAccountId, meta_ad_id: adData.id,
        meta_adset_id: newAdsetId, meta_campaign_id: newCampaignId,
        name: `[Cópia] ${ad.name}`, status: "PAUSED",
        synced_at: new Date().toISOString(),
      });
    }
  }

  // Schedule activation
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const now = new Date();
  const brtOffset = -3;
  const brtHour = (now.getUTCHours() + brtOffset + 24) % 24;
  let activateAt: Date;
  if (brtHour >= 0 && brtHour < 4) {
    activateAt = new Date(now.getTime() + (Math.random() * 60 + 5) * 60000);
  } else {
    const tomorrow = new Date(now);
    tomorrow.setUTCHours(3 - brtOffset, Math.floor(Math.random() * 59) + 1, 0, 0);
    if (tomorrow <= now) tomorrow.setDate(tomorrow.getDate() + 1);
    activateAt = tomorrow;
  }

  await supabase.from("ads_autopilot_actions").insert({
    tenant_id: tenantId, channel: "meta", action_type: "activate_campaign",
    status: "scheduled", confidence: "high",
    action_data: { meta_campaign_id: newCampaignId, campaign_name: campName, scheduled_for: activateAt.toISOString() },
    reasoning: `Ativação agendada da cópia de "${source.name}" para ${activateAt.toISOString()}`,
    session_id: crypto.randomUUID(),
  });

  return JSON.stringify({
    success: true,
    message: `Campanha duplicada com sucesso! "${campName}" criada com ${adsetsCreated} conjunto(s) e ${adsCreated} anúncio(s). Ativação agendada para a madrugada.`,
    new_campaign_id: newCampaignId,
    adsets_created: adsetsCreated,
    ads_created: adsCreated,
  });
}

// --- Frente 4.4: update_adset_targeting ---
async function updateAdsetTargeting(supabase: any, tenantId: string, args: any) {
  const { adset_id, age_min, age_max, genders, geo_locations, interests } = args;

  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn) return JSON.stringify({ success: false, error: "Meta não conectada." });

  // Build targeting object
  const targeting: any = {};
  if (age_min) targeting.age_min = Math.max(13, Math.min(65, age_min));
  if (age_max) targeting.age_max = Math.max(13, Math.min(65, age_max));
  if (genders) targeting.genders = genders;
  if (geo_locations) targeting.geo_locations = geo_locations;
  if (interests && interests.length > 0) {
    targeting.flexible_spec = [{ interests }];
  }

  if (Object.keys(targeting).length === 0) {
    return JSON.stringify({ success: false, error: "Nenhuma alteração de segmentação fornecida." });
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/${adset_id}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      targeting: JSON.stringify(targeting),
      access_token: conn.access_token,
    }),
  });
  const result = await res.json();

  if (result.error) {
    return JSON.stringify({ success: false, error: `Falha ao atualizar segmentação: ${result.error.message}` });
  }

  // Update local DB
  await supabase.from("meta_ad_adsets")
    .update({ targeting, synced_at: new Date().toISOString() })
    .eq("tenant_id", tenantId)
    .eq("meta_adset_id", adset_id);

  const changes: string[] = [];
  if (age_min || age_max) changes.push(`Idade: ${age_min || "?"}–${age_max || "?"}`);
  if (genders) changes.push(`Gênero: ${genders.includes(1) ? "M" : ""}${genders.includes(2) ? "F" : ""}${genders.includes(0) ? "Todos" : ""}`);
  if (geo_locations) changes.push("Localização atualizada");
  if (interests) changes.push(`${interests.length} interesse(s) definido(s)`);

  return JSON.stringify({
    success: true,
    message: `Segmentação do conjunto atualizada: ${changes.join(", ")}.`,
  });
}

// --- Frente 5: create_custom_audience ---
async function createCustomAudience(supabase: any, tenantId: string, args: any) {
  const { name, description, source, subtype, retention_days, rule } = args;

  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token, metadata")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn) return JSON.stringify({ success: false, error: "Meta não conectada." });

  const adAccounts = conn.metadata?.assets?.ad_accounts || [];
  const adAccountId = args.ad_account_id || adAccounts[0]?.id;
  if (!adAccountId) return JSON.stringify({ success: false, error: "Nenhuma conta de anúncios encontrada." });
  const accountIdClean = adAccountId.replace("act_", "");

  const body: any = {
    name,
    description: description || `Público criado via IA — ${source}`,
    access_token: conn.access_token,
  };

  if (source === "customer_list") {
    body.subtype = "CUSTOM";
    body.customer_file_source = "USER_PROVIDED_ONLY";
    // For customer_list, we create empty audience — users upload data later via Meta UI
  } else if (source === "website") {
    body.subtype = "WEBSITE";
    const retDays = Math.min(retention_days || 30, 180);
    const pixelData = await supabase.from("marketing_integrations").select("meta_pixel_id").eq("tenant_id", tenantId).maybeSingle();
    const pixelId = pixelData?.data?.meta_pixel_id;
    if (!pixelId) return JSON.stringify({ success: false, error: "Pixel Meta não configurado. Configure em Marketing → Integrações." });
    
    const ruleObj = rule?.event_name
      ? { event_sources: [{ id: pixelId, type: "pixel" }], retention_seconds: retDays * 86400, filter: { operator: "or", filters: [{ field: "event", operator: "eq", value: rule.event_name }] } }
      : rule?.url_contains
        ? { event_sources: [{ id: pixelId, type: "pixel" }], retention_seconds: retDays * 86400, filter: { operator: "or", filters: [{ field: "url", operator: "i_contains", value: rule.url_contains }] } }
        : { event_sources: [{ id: pixelId, type: "pixel" }], retention_seconds: retDays * 86400 };
    body.rule = JSON.stringify(ruleObj);
  } else if (source === "engagement") {
    body.subtype = "ENGAGEMENT";
    // Page engagement — requires page_id
    const pages = conn.metadata?.assets?.pages || [];
    const pageId = pages[0]?.id;
    if (!pageId) return JSON.stringify({ success: false, error: "Nenhuma Página do Facebook conectada." });
    body.rule = JSON.stringify({
      event_sources: [{ id: pageId, type: "page" }],
      retention_seconds: (retention_days || 30) * 86400,
    });
  }

  const res = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/customaudiences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json();

  if (result.error) {
    return JSON.stringify({ success: false, error: `Falha ao criar público: ${result.error.message}` });
  }

  // Save to local DB
  const { error: insertErr } = await supabase.from("meta_ad_audiences").insert({
    tenant_id: tenantId,
    ad_account_id: adAccountId,
    meta_audience_id: result.id,
    name,
    audience_type: source === "website" ? "website_custom" : source === "engagement" ? "engagement" : "customer_list",
    subtype: body.subtype || "CUSTOM",
    description: description || `Público criado via IA — ${source}`,
    synced_at: new Date().toISOString(),
  });
  if (insertErr) console.error(`[ads-chat][${VERSION}] Save audience error:`, insertErr.message);

  return JSON.stringify({
    success: true,
    message: `Público "${name}" criado com sucesso! O Meta pode levar algumas horas para popular este público.`,
    audience_id: result.id,
    source,
  });
}

// --- Frente 5: create_lookalike_audience ---
async function createLookalikeAudience(supabase: any, tenantId: string, args: any) {
  const { source_audience_id, country, ratio } = args;

  const { data: conn } = await supabase
    .from("marketplace_connections")
    .select("access_token, metadata")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();

  if (!conn) return JSON.stringify({ success: false, error: "Meta não conectada." });

  const adAccounts = conn.metadata?.assets?.ad_accounts || [];
  const adAccountId = args.ad_account_id || adAccounts[0]?.id;
  if (!adAccountId) return JSON.stringify({ success: false, error: "Nenhuma conta de anúncios encontrada." });
  const accountIdClean = adAccountId.replace("act_", "");

  const safeRatio = Math.max(0.01, Math.min(ratio || 0.01, 0.20));
  const pctLabel = `${Math.round(safeRatio * 100)}%`;
  const audienceName = args.name || `Lookalike ${pctLabel} — ${country || "BR"} — ${new Date().toISOString().split("T")[0]}`;

  const body = {
    name: audienceName,
    origin_audience_id: source_audience_id,
    lookalike_spec: JSON.stringify({
      type: "similarity",
      country: country || "BR",
      ratio: safeRatio,
    }),
    access_token: conn.access_token,
  };

  const res = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/customaudiences`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await res.json();

  if (result.error) {
    return JSON.stringify({ success: false, error: `Falha ao criar Lookalike: ${result.error.message}` });
  }

  // Save to local DB
  const { error: insertErr } = await supabase.from("meta_ad_audiences").insert({
    tenant_id: tenantId,
    ad_account_id: adAccountId,
    meta_audience_id: result.id,
    name: audienceName,
    audience_type: "lookalike",
    subtype: "LOOKALIKE",
    description: `Lookalike ${pctLabel} — ${country || "BR"}`,
    synced_at: new Date().toISOString(),
  });
  if (insertErr) console.error(`[ads-chat][${VERSION}] Save lookalike error:`, insertErr.message);

  return JSON.stringify({
    success: true,
    message: `Público semelhante "${audienceName}" (${pctLabel}) criado! O Meta leva de 1 a 24 horas para popular o público.`,
    audience_id: result.id,
    ratio: safeRatio,
  });
}

// --- Existing tools (kept) ---

async function getProducts(supabase: any, tenantId: string, search?: string, limit?: number, status?: string) {
  const safeLimit = Math.min(limit || 20, 50);
  const query = supabase
    .from("products")
    .select("id, name, price, compare_at_price, cost_price, status, description, sku, stock_quantity, created_at")
    .eq("tenant_id", tenantId)
    .eq("status", status || "active")
    .order("created_at", { ascending: false })
    .limit(safeLimit);
  if (search) query.ilike("name", `%${search}%`);
  const { data: products, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  const productIds = (products || []).map((p: any) => p.id);
  let imageMap: Record<string, string[]> = {};
  if (productIds.length > 0) {
    const { data: imgs } = await supabase.from("product_images").select("product_id, url, sort_order").in("product_id", productIds).order("sort_order", { ascending: true });
    for (const img of (imgs || [])) {
      if (!imageMap[img.product_id]) imageMap[img.product_id] = [];
      imageMap[img.product_id].push(img.url);
    }
  }

  return JSON.stringify({
    total: products?.length || 0,
    // Prices are stored in BRL (NOT cents)
    products: (products || []).map((p: any) => ({
      id: p.id, name: p.name,
      price_brl: `R$ ${(p.price || 0).toFixed(2)}`,
      compare_at_price_brl: p.compare_at_price ? `R$ ${p.compare_at_price.toFixed(2)}` : null,
      cost_price_brl: p.cost_price ? `R$ ${p.cost_price.toFixed(2)}` : null,
      margin_pct: p.cost_price && p.price ? `${(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%` : null,
      status: p.status, sku: p.sku, stock: p.stock_quantity,
      description: p.description?.substring(0, 200) || "",
      images: imageMap[p.id] || [],
    })),
  });
}

// --- get_product_images: Fetch product images from catalog + Drive ---
async function getProductImages(supabase: any, tenantId: string, productId: string, productName?: string) {
  // 1. Get catalog images from product_images table
  // Query by product_id only (tenant isolation guaranteed via product ownership)
  const { data: catalogImages, error: imgErr } = await supabase
    .from("product_images")
    .select("url, alt_text, is_primary, sort_order")
    .eq("product_id", productId)
    .order("sort_order", { ascending: true });
  if (imgErr) return JSON.stringify({ error: imgErr.message });

  // 2. Get product name if not provided
  let name = productName;
  if (!name) {
    const { data: prod } = await supabase.from("products").select("name").eq("id", productId).single();
    name = prod?.name;
  }

  // 3. Search Drive for images in "Imagens de Produtos" folder
  let driveImages: any[] = [];
  const { data: driveFolder } = await supabase
    .from("files")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("is_folder", true)
    .eq("filename", "Imagens de Produtos")
    .maybeSingle();

  if (driveFolder) {
    const { data: driveFiles } = await supabase
      .from("files")
      .select("id, filename, storage_path, mime_type")
      .eq("tenant_id", tenantId)
      .eq("folder_id", driveFolder.id)
      .eq("is_folder", false)
      .ilike("mime_type", "image/%")
      .limit(20);

    // Also check for product-specific subfolder
    const { data: productFolder } = await supabase
      .from("files")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("folder_id", driveFolder.id)
      .eq("is_folder", true)
      .ilike("filename", `%${(name || "").substring(0, 30)}%`)
      .maybeSingle();

    if (productFolder) {
      const { data: subFiles } = await supabase
        .from("files")
        .select("id, filename, storage_path, mime_type")
        .eq("tenant_id", tenantId)
        .eq("folder_id", productFolder.id)
        .eq("is_folder", false)
        .ilike("mime_type", "image/%")
        .limit(20);
      driveImages = [...(driveFiles || []), ...(subFiles || [])];
    } else {
      driveImages = driveFiles || [];
    }
  }

  // Build public URLs for drive images
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const driveImageUrls = driveImages.map((f: any) => ({
    filename: f.filename,
    url: f.storage_path ? `${supabaseUrl}/storage/v1/object/public/media-assets/${f.storage_path}` : null,
    source: "drive",
  })).filter((d: any) => d.url);

  return JSON.stringify({
    product_name: name,
    catalog_images: (catalogImages || []).map((img: any) => ({
      url: img.url,
      alt: img.alt_text,
      is_primary: img.is_primary,
    })),
    drive_images: driveImageUrls,
    total: (catalogImages?.length || 0) + driveImageUrls.length,
    tip: driveImageUrls.length === 0 ? "Nenhuma imagem encontrada no Meu Drive. Considere criar a pasta 'Imagens de Produtos' no Meu Drive e adicionar as fotos dos produtos lá." : null,
  });
}

async function getCreativeAssets(supabase: any, tenantId: string, status?: string) {
  // 1) Internal creative assets (generated by AI)
  const query = supabase.from("ads_creative_assets")
    .select("id, headline, copy_text, format, status, angle, channel, asset_url, storage_path, created_at")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20);
  if (status) query.eq("status", status);
  const { data: internalAssets } = await query;

  // 2) Meta synced creatives (from meta_ad_creatives table — real ads running on Meta)
  const { data: metaCreatives } = await supabase.from("meta_ad_creatives")
    .select("id, meta_creative_id, name, title, body, call_to_action_type, link_url, image_url, thumbnail_url, ad_account_id, synced_at")
    .eq("tenant_id", tenantId).order("synced_at", { ascending: false }).limit(30);

  const internalList = (internalAssets || []).map((a: any) => ({
    id: a.id, source: "internal", headline: a.headline, copy: a.copy_text?.substring(0, 100),
    format: a.format, status: a.status, angle: a.angle, channel: a.channel,
    has_image: !!(a.asset_url || a.storage_path), created_at: a.created_at,
  }));

  const metaList = (metaCreatives || []).map((c: any) => ({
    id: c.id, source: "meta", meta_creative_id: c.meta_creative_id,
    headline: c.title || c.name, copy: c.body?.substring(0, 100),
    cta: c.call_to_action_type, link_url: c.link_url,
    has_image: !!(c.image_url || c.thumbnail_url),
    image_url: c.image_url || c.thumbnail_url,
    synced_at: c.synced_at,
  }));

  return JSON.stringify({
    total_internal: internalList.length,
    total_meta: metaList.length,
    total: internalList.length + metaList.length,
    internal_assets: internalList,
    meta_creatives: metaList,
  });
}

async function getMetaAdsets(supabase: any, tenantId: string, adAccountId?: string, status?: string) {
  const query = supabase.from("meta_ad_adsets")
    .select("id, meta_adset_id, name, status, daily_budget_cents, lifetime_budget_cents, targeting, pixel_id, ad_account_id, optimization_goal, bid_strategy, created_at")
    .eq("tenant_id", tenantId).order("status", { ascending: true }).limit(100);
  if (adAccountId) query.eq("ad_account_id", adAccountId);
  if (status) query.eq("status", status);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  const active = (data || []).filter((a: any) => a.status === "ACTIVE");
  const paused = (data || []).filter((a: any) => a.status === "PAUSED");

  return JSON.stringify({
    total: data?.length || 0, active: active.length, paused: paused.length,
    adsets: (data || []).map((a: any) => ({
      name: a.name, status: a.status, meta_adset_id: a.meta_adset_id,
      daily_budget: a.daily_budget_cents ? `R$ ${(a.daily_budget_cents / 100).toFixed(2)}` : null,
      has_pixel: !!a.pixel_id, optimization_goal: a.optimization_goal,
      targeting_summary: a.targeting ? JSON.stringify(a.targeting).substring(0, 200) : null,
    })),
  });
}

async function getMetaAds(supabase: any, tenantId: string, adAccountId?: string) {
  const query = supabase.from("meta_ad_ads")
    .select("id, meta_ad_id, name, status, effective_status, meta_adset_id, meta_campaign_id, ad_account_id, created_at")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(100);
  if (adAccountId) query.eq("ad_account_id", adAccountId);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });

  const adIds = (data || []).map((a: any) => a.meta_ad_id).filter(Boolean);
  let creatives: any[] = [];
  if (adIds.length > 0) {
    const { data: cData } = await supabase.from("meta_ad_creatives").select("meta_ad_id, name, title, body, image_url, thumbnail_url, call_to_action_type").eq("tenant_id", tenantId).in("meta_ad_id", adIds);
    creatives = cData || [];
  }
  const creativeMap: Record<string, any> = {};
  for (const c of creatives) creativeMap[c.meta_ad_id] = c;

  return JSON.stringify({
    total: data?.length || 0,
    ads: (data || []).map((a: any) => {
      const cr = creativeMap[a.meta_ad_id];
      return {
        name: a.name, status: a.status, effective_status: a.effective_status, meta_ad_id: a.meta_ad_id,
        creative: cr ? { title: cr.title, body: cr.body?.substring(0, 100), cta: cr.call_to_action_type, has_image: !!cr.image_url } : null,
      };
    }),
  });
}

async function getAudiences(supabase: any, tenantId: string, channel?: string) {
  const result: any = {};
  if (!channel || channel === "meta") {
    let { data } = await supabase.from("meta_ad_audiences").select("id, name, audience_type, subtype, approximate_count, ad_account_id, created_at").eq("tenant_id", tenantId).limit(50);
    
    // Auto-sync if local cache is empty — audiences likely exist on Meta but were never synced
    if (!data || data.length === 0) {
      console.log(`[ads-chat][${VERSION}] meta_ad_audiences empty, triggering inline sync`);
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const syncRes = await fetch(`${supabaseUrl}/functions/v1/meta-ads-audiences`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({ tenant_id: tenantId, action: "sync" }),
        });
        const syncResult = await syncRes.json();
        console.log(`[ads-chat][${VERSION}] Audiences sync result:`, JSON.stringify(syncResult));
        
        // Re-query after sync
        const { data: refreshed } = await supabase.from("meta_ad_audiences").select("id, name, audience_type, subtype, approximate_count, ad_account_id, created_at").eq("tenant_id", tenantId).limit(50);
        data = refreshed;
      } catch (e) {
        console.error(`[ads-chat][${VERSION}] Audiences inline sync failed:`, e);
      }
    }
    
    result.meta = (data || []).map((a: any) => ({ name: a.name, type: a.audience_type, subtype: a.subtype, size: a.approximate_count }));
  }
  if (!channel || channel === "google") {
    const { data } = await supabase.from("google_ad_audiences").select("id, name, audience_type, size_estimate, ad_account_id, created_at").eq("tenant_id", tenantId).limit(50);
    result.google = (data || []).map((a: any) => ({ name: a.name, type: a.audience_type, size: a.size_estimate }));
  }
  return JSON.stringify(result);
}

async function getTrackingHealth(supabase: any, tenantId: string) {
  const { data, error } = await supabase.from("ads_tracking_health").select("channel, status, indicators, alerts, ad_account_id, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(10);
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ total: data?.length || 0, tracking: data || [] });
}

async function getAutopilotConfig(supabase: any, tenantId: string, adAccountId?: string) {
  const { data: globalConfigs } = await supabase.from("ads_autopilot_configs").select("*").eq("tenant_id", tenantId);
  const accQuery = supabase.from("ads_autopilot_account_configs").select("*").eq("tenant_id", tenantId);
  if (adAccountId) accQuery.eq("ad_account_id", adAccountId);
  const { data: accountConfigs } = await accQuery;

  return JSON.stringify({
    global: (globalConfigs || []).map((g: any) => ({
      channel: g.channel, is_enabled: g.is_enabled, kill_switch: g.kill_switch,
      budget: `R$ ${((g.budget_cents || 0) / 100).toFixed(2)}/dia`,
      total_budget: g.total_budget_cents ? `R$ ${(g.total_budget_cents / 100).toFixed(2)}` : null,
      objective: g.objective, strategy_mode: g.strategy_mode,
      human_approval_mode: g.human_approval_mode, funnel_splits: g.funnel_splits,
      user_instructions: g.user_instructions?.substring(0, 300),
      last_analysis: g.last_analysis_at, total_actions: g.total_actions_executed,
    })),
    accounts: (accountConfigs || []).map((a: any) => ({
      ad_account_id: a.ad_account_id, channel: a.channel,
      is_ai_enabled: a.is_ai_enabled, kill_switch: a.kill_switch,
      budget: `R$ ${((a.budget_cents || 0) / 100).toFixed(2)}/dia`,
      target_roi: a.target_roi, strategy_mode: a.strategy_mode,
      human_approval_mode: a.human_approval_mode, funnel_splits: a.funnel_splits,
      user_instructions: a.user_instructions?.substring(0, 300),
    })),
  });
}

async function getAutopilotActions(supabase: any, tenantId: string, status?: string, limit?: number) {
  const query = supabase.from("ads_autopilot_actions")
    .select("id, action_type, channel, status, reasoning, confidence, error_message, executed_at, created_at, action_data")
    .eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit || 15);
  if (status) query.eq("status", status);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: data?.length || 0,
    actions: (data || []).map((a: any) => ({
      action_type: a.action_type, channel: a.channel, status: a.status,
      reasoning: a.reasoning?.substring(0, 200), confidence: a.confidence,
      error: a.error_message, campaign_name: a.action_data?.campaign_name,
      daily_budget: a.action_data?.daily_budget_cents ? `R$ ${(a.action_data.daily_budget_cents / 100).toFixed(2)}` : null,
      executed_at: a.executed_at, created_at: a.created_at,
    })),
  });
}

async function getAutopilotInsights(supabase: any, tenantId: string, status?: string) {
  const query = supabase.from("ads_autopilot_insights").select("id, title, body, category, priority, sentiment, status, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(15);
  if (status) query.eq("status", status);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ total: data?.length || 0, insights: data || [] });
}

async function getAutopilotSessions(supabase: any, tenantId: string, limit?: number) {
  const { data, error } = await supabase.from("ads_autopilot_sessions").select("id, channel, trigger_type, motor_type, actions_planned, actions_executed, actions_rejected, cost_credits, duration_ms, created_at, insights_generated").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(limit || 10);
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: data?.length || 0,
    sessions: (data || []).map((s: any) => ({
      channel: s.channel, trigger: s.trigger_type, motor: s.motor_type,
      planned: s.actions_planned, executed: s.actions_executed, rejected: s.actions_rejected,
      credits: s.cost_credits, duration_ms: s.duration_ms, ran_at: s.created_at,
    })),
  });
}

async function getExperiments(supabase: any, tenantId: string, status?: string) {
  const query = supabase.from("ads_autopilot_experiments").select("id, hypothesis, variable_type, channel, status, start_at, end_at, budget_cents, results, winner_variant_id, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(15);
  if (status) query.eq("status", status);
  const { data, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({
    total: data?.length || 0,
    experiments: (data || []).map((e: any) => ({
      hypothesis: e.hypothesis, variable: e.variable_type, channel: e.channel,
      status: e.status, budget: e.budget_cents ? `R$ ${(e.budget_cents / 100).toFixed(2)}` : null,
      has_winner: !!e.winner_variant_id, start: e.start_at, end: e.end_at,
    })),
  });
}

async function getGoogleCampaigns(supabase: any, tenantId: string, adAccountId?: string) {
  const query = supabase.from("google_ad_campaigns").select("id, google_campaign_id, name, status, campaign_type, daily_budget_cents, ad_account_id, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(30);
  if (adAccountId) query.eq("ad_account_id", adAccountId);
  const { data: campaigns, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ total: campaigns?.length || 0, campaigns: campaigns || [] });
}

async function getTikTokCampaigns(supabase: any, tenantId: string, advertiserId?: string) {
  const query = supabase.from("tiktok_ad_campaigns").select("id, tiktok_campaign_id, campaign_name, status, objective_type, budget_cents, advertiser_id, created_at").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(30);
  if (advertiserId) query.eq("advertiser_id", advertiserId);
  const { data: campaigns, error } = await query;
  if (error) return JSON.stringify({ error: error.message });
  return JSON.stringify({ total: campaigns?.length || 0, campaigns: campaigns || [] });
}

async function updateAutopilotConfig(supabase: any, tenantId: string, adAccountId: string, channel: string, updates: any) {
  if (!adAccountId || !channel) return JSON.stringify({ error: "ad_account_id e channel são obrigatórios" });
  const safeFields: Record<string, any> = {};
  const allowed = ["target_roi", "budget_cents", "strategy_mode", "is_ai_enabled", "user_instructions", "human_approval_mode"];
  for (const key of allowed) { if (updates[key] !== undefined) safeFields[key] = updates[key]; }
  
  // Handle chat overrides — records user commands that override system rules
  if (updates.chat_overrides) {
    // Merge with existing overrides
    const { data: existing } = await supabase.from("ads_autopilot_account_configs")
      .select("chat_overrides")
      .eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).eq("channel", channel)
      .maybeSingle();
    
    const currentOverrides = existing?.chat_overrides || {};
    const newOverrides = {
      ...currentOverrides,
      ...updates.chat_overrides,
      _last_override_at: new Date().toISOString(),
      _override_count: (currentOverrides._override_count || 0) + 1,
    };
    safeFields.chat_overrides = newOverrides;
  }
  
  if (Object.keys(safeFields).length === 0) return JSON.stringify({ error: "Nenhum campo válido" });
  safeFields.updated_at = new Date().toISOString();
  const { error } = await supabase.from("ads_autopilot_account_configs").update(safeFields).eq("tenant_id", tenantId).eq("ad_account_id", adAccountId).eq("channel", channel);
  if (error) return JSON.stringify({ error: error.message });
  
  const overrideApplied = updates.chat_overrides ? " (via comando do lojista — prioridade máxima)" : "";
  return JSON.stringify({ success: true, message: `Configurações atualizadas com sucesso${overrideApplied}.` });
}

// --- Creative generation (kept) ---
async function triggerCreativeGeneration(supabase: any, tenantId: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ads-autopilot-creative-generate`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ tenant_id: tenantId }),
    });
    const result = await response.text();
    let parsed; try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }
    return JSON.stringify({ success: response.ok, message: response.ok ? "Geração de textos criativos disparada." : `Falha (HTTP ${response.status})`, details: parsed });
  } catch (err: any) { return JSON.stringify({ success: false, error: err.message }); }
}

async function generateCreativeImage(supabase: any, tenantId: string, args: any) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const { data: products } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId).eq("status", "active");
    const product = (products || []).find((p: any) => p.name.toLowerCase().includes((args.product_name || "").toLowerCase())) || products?.[0];
    if (!product) return JSON.stringify({ success: false, error: "Produto não encontrado no catálogo." });

    let productImageUrl: string | null = null;
    const { data: prodImgs } = await supabase.from("product_images").select("url").eq("product_id", product.id).order("position", { ascending: true }).limit(1);
    if (prodImgs?.[0]?.url) productImageUrl = prodImgs[0].url;

    const response = await fetch(`${supabaseUrl}/functions/v1/ads-autopilot-creative`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        tenant_id: tenantId, channel: args.channel || "meta", product_id: product.id, product_name: product.name,
        product_image_url: productImageUrl, campaign_objective: args.campaign_objective || "sales",
        target_audience: args.target_audience, style_preference: args.style_preference || "promotional",
        format: args.format || "1:1", variations: Math.min(args.variations || 2, 4),
      }),
    });
    const result = await response.text();
    let parsed; try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }
    if (!response.ok || !parsed?.success) return JSON.stringify({ success: false, error: `Falha ao gerar imagens (HTTP ${response.status})`, details: parsed });
    return JSON.stringify({ success: true, message: `Geração de ${args.variations || 2} imagem(ns) disparada para "${product.name}".`, job_id: parsed?.data?.job_id });
  } catch (err: any) { return JSON.stringify({ success: false, error: err.message }); }
}

async function createMetaCampaign(supabase: any, tenantId: string, args: any) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const headers = { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` };

  try {
    const { data: products } = await supabase.from("products").select("id, name").eq("tenant_id", tenantId).eq("status", "active");
    const product = (products || []).find((p: any) => p.name.toLowerCase().includes((args.product_name || "").toLowerCase())) || products?.[0];
    if (!product) return JSON.stringify({ success: false, error: "Produto não encontrado no catálogo." });

    const { data: conn } = await supabase.from("marketplace_connections").select("access_token, metadata").eq("tenant_id", tenantId).eq("marketplace", "meta").eq("is_active", true).maybeSingle();
    if (!conn) return JSON.stringify({ success: false, error: "Meta não conectada." });

    const adAccounts = conn.metadata?.assets?.ad_accounts || [];
    const adAccountId = args.ad_account_id || adAccounts[0]?.id;
    if (!adAccountId) return JSON.stringify({ success: false, error: "Nenhuma conta de anúncios Meta encontrada." });

    // Find creative image
    let creativeImageUrl: string | null = null;
    let creativeHeadline: string | null = null;
    let creativeCopy: string | null = null;

    const { data: creativeAssets } = await supabase.from("ads_creative_assets").select("id, asset_url, storage_path, headline, copy_text, cta_type, product_id").eq("tenant_id", tenantId).eq("product_id", product.id).in("status", ["ready", "draft"]).order("created_at", { ascending: false }).limit(5);
    if (creativeAssets?.length) {
      const best = creativeAssets.find((c: any) => c.asset_url) || creativeAssets[0];
      creativeImageUrl = best.asset_url || null;
      creativeHeadline = best.headline || null;
      creativeCopy = best.copy_text || null;
      if (!creativeImageUrl && best.storage_path) {
        const { data: signedData } = await supabase.storage.from("files").createSignedUrl(best.storage_path, 86400 * 30);
        if (signedData?.signedUrl) creativeImageUrl = signedData.signedUrl;
      }
    }

    // Fallback: Drive folder
    if (!creativeImageUrl) {
      const { data: folder } = await supabase.from("files").select("id").eq("tenant_id", tenantId).eq("filename", "Gestor de Tráfego IA").eq("is_folder", true).maybeSingle();
      if (folder) {
        const { data: driveFiles } = await supabase.from("files").select("id, url, storage_path, filename").eq("tenant_id", tenantId).eq("folder_id", folder.id).eq("is_folder", false).order("created_at", { ascending: false }).limit(5);
        const imageFile = (driveFiles || []).find((f: any) => f.url || f.storage_path);
        if (imageFile) {
          creativeImageUrl = imageFile.url || null;
          if (!creativeImageUrl && imageFile.storage_path) {
            const { data: signedData } = await supabase.storage.from("files").createSignedUrl(imageFile.storage_path, 86400 * 30);
            if (signedData?.signedUrl) creativeImageUrl = signedData.signedUrl;
          }
        }
      }
    }

    // Fallback: product image
    if (!creativeImageUrl) {
      const { data: prodImages } = await supabase.from("product_images").select("url").eq("product_id", product.id).order("position", { ascending: true }).limit(1);
      if (prodImages?.[0]?.url) creativeImageUrl = prodImages[0].url;
    }

    if (!creativeImageUrl) return JSON.stringify({ success: false, error: "Nenhum criativo ou imagem disponível. Gere artes primeiro." });

    // Pixel
    const { data: mktIntegration } = await supabase.from("marketing_integrations").select("meta_pixel_id").eq("tenant_id", tenantId).maybeSingle();
    const pixelId = mktIntegration?.meta_pixel_id || null;
    const pages = conn.metadata?.assets?.pages || [];
    const pageId = pages[0]?.id || null;
    const accountIdClean = adAccountId.replace("act_", "");

    // Upload image hash
    const imageHashResult = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adimages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: creativeImageUrl, access_token: conn.access_token }),
    });
    const imageHashData = await imageHashResult.json();
    const imageHash = imageHashData?.images?.[Object.keys(imageHashData?.images || {})[0]]?.hash;
    if (!imageHash) return JSON.stringify({ success: false, error: "Falha ao enviar imagem para o Meta.", details: imageHashData?.error?.message });

    // Create creative
    const objective = args.objective || "OUTCOME_SALES";
    const creativeBody: any = { name: `[AI] ${product.name} - ${new Date().toISOString().split("T")[0]}`, access_token: conn.access_token };
    if (pageId) {
      creativeBody.object_story_spec = { page_id: pageId, link_data: { image_hash: imageHash, message: creativeCopy || `Conheça ${product.name}! Aproveite agora.`, name: creativeHeadline || product.name, call_to_action: { type: objective === "OUTCOME_SALES" ? "SHOP_NOW" : "LEARN_MORE" } } };
    } else {
      creativeBody.image_hash = imageHash; creativeBody.title = creativeHeadline || product.name; creativeBody.body = creativeCopy || `Conheça ${product.name}!`;
    }
    const creativeResult = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adcreatives`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(creativeBody) });
    const creativeData = await creativeResult.json();
    if (creativeData.error) return JSON.stringify({ success: false, error: `Falha ao criar criativo: ${creativeData.error.message}` });
    const metaCreativeId = creativeData.id;

    // Create Campaign PAUSED
    const campName = args.campaign_name || `[AI] ${objective === "OUTCOME_SALES" ? "Vendas" : "Tráfego"} | ${product.name} | ${new Date().toISOString().split("T")[0]}`;
    const dailyBudgetCents = args.daily_budget_cents || 3000;
    const campResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-campaigns`, { method: "POST", headers, body: JSON.stringify({ tenant_id: tenantId, action: "create", ad_account_id: adAccountId, name: campName, objective, daily_budget_cents: dailyBudgetCents, status: "PAUSED", bid_strategy: "LOWEST_COST_WITHOUT_CAP" }) });
    const campResult = await campResponse.text(); let campParsed: any; try { campParsed = JSON.parse(campResult); } catch { campParsed = { raw: campResult }; }
    if (!campParsed?.success) return JSON.stringify({ success: false, error: `Falha ao criar campanha: ${campParsed?.error || "Erro desconhecido"}` });
    const metaCampaignId = campParsed.data?.meta_campaign_id;

    // Create AdSet PAUSED
    const funnelStage = args.funnel_stage || "cold";
    const adsetName = `[AI] ${funnelStage} | ${args.targeting_description || "Brasil 18-65"} | ${product.name}`.substring(0, 200);
    const adsetBody: any = { tenant_id: tenantId, action: "create", ad_account_id: adAccountId, meta_campaign_id: metaCampaignId, name: adsetName, targeting: { geo_locations: { countries: ["BR"] }, age_min: 18, age_max: 65 }, status: "PAUSED" };
    if (pixelId && (objective === "OUTCOME_SALES" || objective === "OUTCOME_LEADS")) {
      adsetBody.promoted_object = { pixel_id: pixelId, custom_event_type: objective === "OUTCOME_SALES" ? "PURCHASE" : "LEAD" };
    }
    const adsetResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-adsets`, { method: "POST", headers, body: JSON.stringify(adsetBody) });
    const adsetResult = await adsetResponse.text(); let adsetParsed: any; try { adsetParsed = JSON.parse(adsetResult); } catch { adsetParsed = { raw: adsetResult }; }
    const metaAdsetId = adsetParsed?.data?.meta_adset_id || null;

    // Create Ad PAUSED
    let metaAdId: string | null = null;
    if (metaAdsetId && metaCreativeId) {
      const adResponse = await fetch(`${supabaseUrl}/functions/v1/meta-ads-ads`, { method: "POST", headers, body: JSON.stringify({ tenant_id: tenantId, action: "create", ad_account_id: adAccountId, meta_adset_id: metaAdsetId, meta_campaign_id: metaCampaignId, name: `[AI] ${product.name} - Criativo 1`, creative_id: metaCreativeId, status: "PAUSED" }) });
      const adResult = await adResponse.text(); let adParsed: any; try { adParsed = JSON.parse(adResult); } catch { adParsed = { raw: adResult }; }
      metaAdId = adParsed?.data?.meta_ad_id || null;
    }

    // Schedule activation
    const now = new Date();
    const scheduleDate = new Date(now);
    const utcHour = now.getUTCHours();
    const brtHour = utcHour - 3 < 0 ? utcHour - 3 + 24 : utcHour - 3;
    if (brtHour >= 0 && brtHour < 4) { scheduleDate.setMinutes(scheduleDate.getMinutes() + 5); }
    else { if (brtHour >= 4) scheduleDate.setDate(scheduleDate.getDate() + 1); scheduleDate.setUTCHours(3, 1 + Math.floor(Math.random() * 59), 0, 0); }

    await supabase.from("ads_autopilot_actions").insert({
      tenant_id: tenantId, session_id: crypto.randomUUID(), channel: "meta", action_type: "activate_campaign",
      action_data: { campaign_id: metaCampaignId, adset_id: metaAdsetId, ad_id: metaAdId, ad_account_id: adAccountId, campaign_name: campName, product_name: product.name, creative_id: metaCreativeId, scheduled_for: scheduleDate.toISOString(), daily_budget_cents: dailyBudgetCents, created_by: "ads_chat" },
      reasoning: `Campanha criada via Chat IA para "${product.name}". Ativação agendada.`, status: "scheduled",
      action_hash: `chat_activate_${metaCampaignId}_${Date.now()}`,
    });

    return JSON.stringify({
      success: true,
      message: `Campanha completa criada para "${product.name}"! Será ativada automaticamente na próxima janela (00:01-04:00 BRT).`,
      data: { campaign: { id: metaCampaignId, name: campName }, adset: { id: metaAdsetId, name: adsetName }, ad: { id: metaAdId }, daily_budget: `R$ ${(dailyBudgetCents / 100).toFixed(2)}` },
    });
  } catch (err: any) { return JSON.stringify({ success: false, error: err.message }); }
}

async function triggerAutopilotAnalysis(supabase: any, tenantId: string, channel: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/ads-autopilot-analyze`, {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ tenant_id: tenantId, channel, trigger_type: "manual" }),
    });
    const result = await response.text();
    let parsed; try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }
    return JSON.stringify({ success: response.ok, message: response.ok ? `Análise (${channel}) disparada.` : `Falha (HTTP ${response.status})`, details: parsed });
  } catch (err: any) { return JSON.stringify({ success: false, error: err.message }); }
}

async function analyzeUrl(url: string): Promise<string> {
  const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
  if (!FIRECRAWL_API_KEY) return JSON.stringify({ error: "Análise de URLs não configurada." });
  try {
    const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST", headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
    });
    const result = await response.text();
    let parsed; try { parsed = JSON.parse(result); } catch { parsed = { raw: result }; }
    if (!response.ok) return JSON.stringify({ error: `Falha (HTTP ${response.status})`, details: parsed });
    const markdown = parsed?.data?.markdown || "";
    const metadata = parsed?.data?.metadata || {};
    return JSON.stringify({ success: true, url, title: metadata.title || "", description: metadata.description || "", content: markdown.length > 3000 ? markdown.substring(0, 3000) + "\n\n[...truncado]" : markdown });
  } catch (err: any) { return JSON.stringify({ error: err.message }); }
}

// ============ CONTEXT COLLECTOR (Frente 1+2: Enriched) ============

async function collectBaseContext(supabase: any, tenantId: string, scope: string, adAccountId?: string, channel?: string) {
  const context: any = {};

  // Tenant + store_settings
  const { data: tenant } = await supabase.from("tenants").select("name, slug, custom_domain").eq("id", tenantId).single();
  context.storeName = tenant?.name || "Loja";
  context.storeUrl = tenant?.custom_domain || (tenant?.slug ? `${tenant.slug}.comandocentral.com.br` : null);

  const { data: settings } = await supabase.from("store_settings").select("store_name, store_description").eq("tenant_id", tenantId).maybeSingle();
  if (settings?.store_description) context.storeDescription = settings.store_description;

  // Account configs
  const configQuery = supabase.from("ads_autopilot_account_configs")
    .select("channel, ad_account_id, is_ai_enabled, budget_cents, target_roi, strategy_mode, funnel_splits, user_instructions, roas_scaling_threshold, min_roi_cold, min_roi_warm, chat_overrides, human_approval_mode, budget_mode")
    .eq("tenant_id", tenantId);
  if (scope === "account" && adAccountId) configQuery.eq("ad_account_id", adAccountId);
  const { data: configs } = await configQuery;
  context.accountConfigs = configs || [];
  const activeConfig = (configs || []).find((c: any) => c.is_ai_enabled && c.ad_account_id === adAccountId);
  context.userInstructions = activeConfig?.user_instructions || (configs || [])?.[0]?.user_instructions || null;

  // Orders 30d
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data: orders } = await supabase.from("orders").select("total, payment_status").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo);
  const paid = (orders || []).filter((o: any) => o.payment_status === "paid");
  // Orders total is already in BRL (NOT cents)
  context.orderStats = {
    paid: paid.length,
    revenue_brl: paid.reduce((s: number, o: any) => s + (o.total || 0), 0).toFixed(2),
    avg_ticket_brl: paid.length ? (paid.reduce((s: number, o: any) => s + (o.total || 0), 0) / paid.length).toFixed(2) : "0",
  };

  // Products (top 10) — prices already in BRL (NOT cents)
  const { data: products } = await supabase.from("products").select("id, name, price, cost_price, status, description").eq("tenant_id", tenantId).eq("status", "active").order("created_at", { ascending: false }).limit(10);
  
  // Fetch images for these products
  const productIds = (products || []).map((p: any) => p.id);
  let productImageMap: Record<string, string[]> = {};
  let allProductImageRows: any[] = [];
  if (productIds.length > 0) {
    const { data: imgs } = await supabase.from("product_images").select("id, product_id, url, is_primary, sort_order").in("product_id", productIds).order("sort_order", { ascending: true });
    allProductImageRows = imgs || [];
    for (const img of allProductImageRows) {
      if (!productImageMap[img.product_id]) productImageMap[img.product_id] = [];
      productImageMap[img.product_id].push(img.url);
    }
  }
  
  context.products = (products || []).map((p: any) => ({
    id: p.id, name: p.name,
    price_brl: `R$ ${(p.price || 0).toFixed(2)}`,
    cost_price_brl: p.cost_price ? `R$ ${p.cost_price.toFixed(2)}` : null,
    margin_pct: p.cost_price && p.price ? `${(((p.price - p.cost_price) / p.price) * 100).toFixed(0)}%` : null,
    description: p.description?.substring(0, 120) || "",
    images: productImageMap[p.id] || [],
    has_images: (productImageMap[p.id] || []).length > 0,
  }));
  
  // Ensure "Imagens de Produtos" folder exists in Drive + sync existing product images
  try {
    const { data: existingFolder } = await supabase.from("files").select("id").eq("tenant_id", tenantId).eq("is_folder", true).eq("filename", "Imagens de Produtos").maybeSingle();
    let folderId = existingFolder?.id || null;
    
    if (!folderId) {
      const { data: newFolder } = await supabase.from("files").insert({
        tenant_id: tenantId,
        filename: "Imagens de Produtos",
        original_name: "Imagens de Produtos",
        is_folder: true,
        is_system_folder: false,
        metadata: { source: "ads_chat", system_managed: true, description: "Pasta padrão para imagens dos produtos usadas pela IA de tráfego" },
      }).select("id").single();
      folderId = newFolder?.id || null;
      console.log(`[ads-chat][${VERSION}] Created 'Imagens de Produtos' folder in Drive: ${folderId}`);
    }
    
    // Sync: copy existing product images to Drive folder (fire-and-forget, non-blocking)
    if (folderId && allProductImageRows && allProductImageRows.length > 0) {
      // Check which images are already registered in this folder
      const { data: existingFiles } = await supabase.from("files")
        .select("storage_path")
        .eq("tenant_id", tenantId)
        .eq("folder_id", folderId)
        .eq("is_folder", false)
        .limit(500);
      
      const existingPaths = new Set((existingFiles || []).map((f: any) => f.storage_path));
      
      // Find images not yet in the folder
      const newImages: any[] = [];
      for (const img of allProductImageRows) {
        if (!img.url) continue;
        // Use URL as storage_path reference to avoid duplicates
        const refPath = `product_image_ref:${img.product_id}:${img.id || img.url.slice(-40)}`;
        if (existingPaths.has(refPath)) continue;
        
        // Find product name for this image
        const product = products?.find((p: any) => p.id === img.product_id);
        const productName = product?.name || "Produto";
        
        newImages.push({
          tenant_id: tenantId,
          folder_id: folderId,
          filename: `${productName} - ${img.position || 1}.${(img.url || "").split(".").pop()?.split("?")[0] || "jpg"}`,
          original_name: `${productName} - imagem ${img.position || 1}`,
          storage_path: refPath,
          mime_type: "image/jpeg",
          is_folder: false,
          is_system_folder: false,
          metadata: {
            source: "product_catalog",
            system_managed: true,
            url: img.url,
            product_id: img.product_id,
            product_name: productName,
          },
        });
      }
      
      if (newImages.length > 0) {
        const { error: syncErr } = await supabase.from("files").insert(newImages);
        if (syncErr) {
          console.error(`[ads-chat][${VERSION}] Error syncing product images to Drive:`, syncErr);
        } else {
          console.log(`[ads-chat][${VERSION}] Synced ${newImages.length} product images to Drive folder`);
        }
      }
    }
  } catch (e) {
    console.error(`[ads-chat][${VERSION}] Error creating/syncing Drive folder (non-blocking):`, e);
  }

  // Categories
  const { data: categories } = await supabase.from("categories").select("name").eq("tenant_id", tenantId).eq("is_active", true).limit(10);
  context.categories = (categories || []).map((c: any) => c.name);

  // Active offers (quick check)
  const { data: discounts } = await supabase.from("discounts").select("code, type, value").eq("tenant_id", tenantId).eq("is_active", true).limit(5);
  context.activeOffers = (discounts || []).map((d: any) => `${d.code} (${d.type}: ${d.value})`);

  // Fire-and-forget sync if data might be stale (Frente 1.3)
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const syncHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${serviceKey}` };

    // Check last sync time from campaigns
    const { data: lastSync } = await supabase.from("meta_ad_campaigns").select("synced_at").eq("tenant_id", tenantId).order("synced_at", { ascending: false }).limit(1);
    const lastSyncTime = lastSync?.[0]?.synced_at ? new Date(lastSync[0].synced_at).getTime() : 0;
    const oneHourAgo = Date.now() - 3600000;

    if (lastSyncTime < oneHourAgo) {
      console.log(`[ads-chat][${VERSION}] Data stale (last sync: ${lastSync?.[0]?.synced_at || 'never'}), triggering fire-and-forget sync`);
      // Fire and forget — don't await
      fetch(`${supabaseUrl}/functions/v1/meta-ads-campaigns`, { method: "POST", headers: syncHeaders, body: JSON.stringify({ tenant_id: tenantId, action: "sync" }) }).catch(() => {});
      fetch(`${supabaseUrl}/functions/v1/meta-ads-insights`, { method: "POST", headers: syncHeaders, body: JSON.stringify({ tenant_id: tenantId, action: "sync", date_preset: "last_30d" }) }).catch(() => {});
      fetch(`${supabaseUrl}/functions/v1/meta-ads-adsets`, { method: "POST", headers: syncHeaders, body: JSON.stringify({ tenant_id: tenantId, action: "sync" }) }).catch(() => {});
      fetch(`${supabaseUrl}/functions/v1/meta-ads-creatives`, { method: "POST", headers: syncHeaders, body: JSON.stringify({ tenant_id: tenantId, action: "sync" }) }).catch(() => {});
      fetch(`${supabaseUrl}/functions/v1/meta-ads-audiences`, { method: "POST", headers: syncHeaders, body: JSON.stringify({ tenant_id: tenantId, action: "sync" }) }).catch(() => {});
    }
  } catch (e) {
    console.error(`[ads-chat][${VERSION}] Sync trigger error (non-blocking):`, e);
  }

  return context;
}

// ============ SYSTEM PROMPT (Frente 5: Regras obrigatórias) ============

function buildSystemPrompt(scope: string, adAccountId?: string, channel?: string, context?: any) {
  const scopeDesc = scope === "account"
    ? `Focado na conta ${adAccountId} (${channel || "multi-channel"}).`
    : "Visão global de todas as contas.";

  const configs = context?.accountConfigs || [];
  const configSummary = configs.map((c: any) =>
    `- ${c.channel} / ${c.ad_account_id}: IA ${c.is_ai_enabled ? "ON" : "OFF"}, Budget R$ ${((c.budget_cents || 0) / 100).toFixed(2)}/dia, ROI alvo ${c.target_roi || "N/D"}, Modo: ${c.strategy_mode || "balanced"}, Splits: ${JSON.stringify(c.funnel_splits || {})}, ROAS escala: ${c.roas_scaling_threshold || "N/D"}, ROI mín frio: ${c.min_roi_cold || "N/D"}, ROI mín quente: ${c.min_roi_warm || "N/D"}`
  ).join("\n");

  // Determine active strategy mode for rules injection
  const activeConfig = configs.find((c: any) => c.ad_account_id === adAccountId) || configs[0];
  const strategyMode = activeConfig?.strategy_mode || "balanced";

  const productsList = (context?.products || []).map((p: any) =>
    `- ${p.name} (${p.price_brl}${p.margin_pct ? `, margem ${p.margin_pct}` : ""}${p.has_images ? `, ${p.images.length} imagem(ns)` : ", SEM IMAGEM"}) ${p.description ? `— ${p.description}` : ""}`
  ).join("\n");

  const categoriesList = (context?.categories || []).join(", ");
  const offersList = (context?.activeOffers || []).join(", ");

  const userInstructionsBlock = context?.userInstructions
    ? `\n## INSTRUÇÕES ESTRATÉGICAS DO LOJISTA (SEGUIR À RISCA)\n${context.userInstructions}\n`
    : "";

  return `Você é o Gestor de Tráfego IA da loja "${context?.storeName}". ${scopeDesc}
${context?.storeDescription ? `\n**Sobre a loja**: ${context.storeDescription}` : ""}
${context?.storeUrl ? `**URL da loja**: ${context.storeUrl}` : ""}

## REGRA SUPREMA: HONESTIDADE ABSOLUTA (DADOS vs MARKETING)
- Você NUNCA mente, inventa ou alucina DADOS REAIS (métricas, preços, nomes de produtos, estatísticas de vendas, contagem de campanhas).
- Se NÃO SABE algo, diga "Não tenho essa informação agora."
- Se NÃO PODE fazer algo, diga "Não consigo fazer isso diretamente."
- NUNCA finja que está processando algo que não está executando de fato.
- NUNCA invente nomes de produtos, preços ou descrições de catálogo — use APENAS o catálogo real.
- Se uma ferramenta retorna erro, informe o erro real.
- **NUNCA invente estatísticas sobre a loja** (ex: "5 mil clientes já compraram", "92% de satisfação") — se não veio de uma ferramenta ou do contexto, NÃO EXISTE.
- **NUNCA peça ao lojista para verificar dados** que você já possui. Se o preço está no catálogo, ele está correto — apresente com confiança.
- **NUNCA exponha dúvidas sobre seus próprios dados** — se os dados vieram de uma ferramenta, confie neles.

### CRIATIVIDADE DE MARKETING (PERMITIDO E INCENTIVADO)
- Você PODE e DEVE ser criativo ao sugerir textos de anúncios, headlines, descrições publicitárias, chamadas de ação (CTAs) e conceitos de campanha.
- Você PODE inventar frases de efeito, slogans, ângulos de venda e narrativas persuasivas para uso em anúncios.
- Você PODE sugerir benefícios emocionais, criar urgência e usar gatilhos mentais em textos publicitários.
- A diferença é clara: **dados sobre a loja = verdade absoluta** | **textos de marketing = criatividade livre**.
- Exemplo PROIBIDO: "Já vendemos 5 mil unidades" (dado inventado sobre a loja)
- Exemplo PERMITIDO: "Descubra o segredo que está transformando rotinas" (texto criativo para anúncio)

## REGRA OBRIGATÓRIA: BUSCAR DADOS ANTES DE DIAGNOSTICAR (ANTI-ALUCINAÇÃO)
**ANTES de fazer QUALQUER diagnóstico, estratégia ou análise, você DEVE obrigatoriamente:**
1. Chamar **get_campaign_performance** para ver o estado REAL das campanhas (ativas vs pausadas, métricas)
2. Chamar **get_adset_performance** para ver conjuntos de anúncios ativos
3. Chamar **get_tracking_health** para verificar saúde do pixel
4. Chamar **get_autopilot_config** para verificar as configurações manuais (modo de estratégia, ROI, budget, funil)

**NUNCA confie apenas no contexto base** — ele pode ter dados limitados. Sempre consulte as ferramentas.

Quando o usuário pedir "estratégia", "diagnóstico", "análise", "plano" ou propuser mudanças de orçamento, chame TODAS essas ferramentas ANTES de responder.

**REGRA ANTI-CONTRADIÇÃO**: Quando você lê as configurações e identifica o modo de estratégia, suas propostas DEVEM respeitar esse modo. Se o lojista pede algo que viola o modo configurado, avise e peça confirmação.

## REGRA: PRIORIZAR CAMPANHAS ATIVAS
- Sempre liste campanhas ATIVAS primeiro, com destaque
- Separe claramente: "**Campanhas Ativas (N)**" vs "**Campanhas Pausadas (N)**"
- Nunca diga que "todas as campanhas estão pausadas" sem antes verificar com get_campaign_performance

## REGRA CRÍTICA DE COMUNICAÇÃO — LINGUAGEM AMIGÁVEL AO LOJISTA
Você conversa com o DONO DA LOJA, NÃO com um desenvolvedor.
NUNCA exponha termos técnicos internos. Use SEMPRE a linguagem da interface.
**NUNCA mostre IDs (UUIDs)** na resposta — use SEMPRE o nome do produto, campanha, conta, etc.
**NUNCA exponha nomes de ferramentas** (ex: get_products, trigger_creative_generation) — descreva a ação em linguagem natural.

### Mapeamento obrigatório de termos (SEMPRE substituir):
| ❌ NUNCA diga | ✅ Diga assim |
|--------------|--------------|
| autopilot_config | configurações da IA de tráfego |
| trigger_creative_generation | gerar textos para anúncios |
| generate_creative_image | gerar artes para anúncios |
| create_meta_campaign | criar campanha no Meta |
| get_campaign_performance | ver performance das campanhas |
| get_campaign_details | ver detalhes da campanha |
| get_performance_trend | ver tendência de performance |
| get_adset_performance | ver performance dos conjuntos |
| get_ad_performance | ver performance dos anúncios |
| get_store_context | ver contexto do negócio |
| get_autopilot_actions | ver ações da IA |
| get_autopilot_insights | ver diagnósticos |
| get_autopilot_sessions | ver histórico de execuções |
| update_autopilot_config | atualizar configurações da IA |
| trigger_autopilot_analysis | rodar análise |
| get_creative_assets | ver criativos existentes |
| get_tracking_health | verificar saúde do pixel |
| get_experiments | ver testes A/B |
| get_meta_adsets | ver conjuntos de anúncios |
| get_meta_ads | ver anúncios |
| get_audiences | ver públicos |
| get_products | ver catálogo |
| toggle_entity_status | pausar/reativar |
| update_budget | alterar orçamento |
| duplicate_campaign | duplicar campanha |
| update_adset_targeting | alterar segmentação |
| create_custom_audience | criar público personalizado |
| create_lookalike_audience | criar público semelhante |
| edge function | sistema interno |
| tenant_id | loja |
| kill_switch | botão de emergência |
| human_approval_mode | modo de aprovação |
| ROAS | retorno sobre investimento |
| funnel_splits | divisão de funil |

### Regra de navegação:
Use os nomes dos menus: "Marketing → Tráfego Pago", "Galeria de Criativos", "Meu Drive", etc.

## SISTEMA DE OVERRIDE POR COMANDO (PRIORIDADE MÁXIMA)

**REGRA CRÍTICA**: O lojista tem autoridade TOTAL sobre a IA via chat. Quando ele dá uma ORDEM direta que contradiz configurações existentes (orçamento, ROI, estratégia, etc.), você DEVE:

1. **Identificar a ordem**: Reconhecer que o pedido sobrepõe uma regra/configuração existente.
2. **Avisar e pedir confirmação**: Explique claramente qual regra será sobreposta, o valor atual e o novo valor desejado. Use um formato claro:
   > ⚠️ **Atenção**: Isso altera a configuração atual.
   > - **Regra atual**: Orçamento R$ 500/dia
   > - **Novo valor solicitado**: R$ 800/dia
   > 
   > Essa mudança será aplicada **acima das regras automáticas** e a IA passará a respeitar este novo valor como verdade absoluta.
   > 
   > **Confirma a alteração?**
3. **Após confirmação**: Execute a alteração usando \`update_autopilot_config\` com o campo \`chat_overrides\` e aplique imediatamente. A IA passa a tratar o valor do override como **prioridade máxima**, acima de qualquer configuração de tela.
4. **Registro**: Toda alteração via override fica registrada no campo \`chat_overrides\` da configuração da conta, com timestamp e descrição.

### Campos passíveis de override via chat:
- \`budget_cents\` — Orçamento diário
- \`target_roi\` — Meta de ROI/ROAS
- \`strategy_mode\` — Modo de estratégia (conservador/equilibrado/agressivo)
- \`is_ai_enabled\` — Ligar/desligar IA
- \`human_approval_mode\` — Modo de aprovação
- \`user_instructions\` — Instruções estratégicas

### Exemplos de ordens que ativam o override:
- "Aumenta o orçamento para R$ 800"
- "Coloca o ROI mínimo em 3"
- "Muda a estratégia para agressiva"
- "Desliga a IA nessa conta"
- "Ignora o limite de orçamento e coloca R$ 2000/dia"

**NUNCA aplique um override sem confirmação explícita do lojista.**

## REGRA CRÍTICA: VALIDAÇÃO DE CONFIGURAÇÕES ANTES DE AGIR

**ANTES de propor ou executar QUALQUER ação de budget, criação de campanha ou mudança estrutural, você DEVE:**
1. Verificar o **strategy_mode** ativo (conservative/balanced/aggressive) nas configurações
2. Verificar o **budget_cents** configurado para a conta
3. Verificar as **metas de ROI** (target_roi, min_roi_cold, min_roi_warm)
4. Verificar as **regras de funil** (funnel_splits)
5. Comparar a ação proposta com essas configurações

**Se a ação proposta CONTRADIZ as configurações manuais, você DEVE:**
- ⚠️ Avisar explicitamente qual regra seria violada
- Mostrar o valor configurado vs o valor proposto
- Explicar o risco
- Pedir confirmação ANTES de executar
- Se confirmado, usar o sistema de Override

### MODO DE ESTRATÉGIA ATIVO: ${strategyMode.toUpperCase()}

#### Regras por modo de estratégia:

**CONSERVATIVE (Conservador)**:
- Ajustes de orçamento: máximo ±10% a cada 72h
- Criação de novas campanhas: somente após 14+ dias de dados históricos
- Duplicação de campanhas preferida sobre aumento de budget
- Pausa imediata se ROI < 80% da meta por 3 dias
- Foco em proteger o que já funciona

**BALANCED (Equilibrado)** — PADRÃO:
- Ajustes de orçamento: máximo ±20% a cada 48-72h
- Novas campanhas permitidas após 7+ dias de dados
- Distribuição de risco: espalhar orçamento entre diferentes frentes (Prospecção, Remarketing, Testes) em vez de concentrar em uma única campanha
- Duplicar campanhas vencedoras para escalar em vez de aumentar budget direto
- Pausa se ROI < meta por 7 dias consecutivos

**AGGRESSIVE (Agressivo)**:
- Ajustes de orçamento: até ±40% a cada 24-48h
- Novas campanhas permitidas imediatamente
- Concentração de orçamento em campanhas vencedoras permitida
- Pausa somente se ROI < 50% da meta por 5 dias
- Foco em escala rápida

### Exemplo de violação e aviso obrigatório:
Se modo = BALANCED e o lojista pede "coloca R$420 na CJ3 que está com R$66":
> ⚠️ **Atenção: essa ação viola o modo Equilibrado.**
> - **Regra**: Ajustes máximos de ±20% por ciclo (48-72h)
> - **Budget atual**: R$ 66,00/dia
> - **Aumento solicitado**: R$ 420,00/dia (+536%)
> - **Risco**: Reset da fase de aprendizado da campanha
> 
> **Alternativa recomendada no modo Equilibrado:**
> 1. Subir CJ3 para R$ 80 (+20%)
> 2. Criar nova campanha duplicada com R$ 200/dia
> 3. Distribuir o restante em Remarketing e Testes
> 
> Quer que eu siga o modo Equilibrado ou prefere forçar o aumento direto (isso ativará um Override)?

## O QUE VOCÊ PODE FAZER
- **Ver performance** real de campanhas, conjuntos e anúncios (Meta, Google, TikTok)
- **Drill-down**: ver detalhes de uma campanha específica com todos conjuntos/anúncios
- **Tendências**: ver performance dia a dia de uma campanha (time-series)
- **Contexto do negócio**: ver nicho, categorias, ofertas ativas, margens, top produtos
- **Pausar/Reativar** campanhas, conjuntos ou anúncios no Meta
- **Alterar orçamento** de campanhas e conjuntos existentes
- **Duplicar campanhas** existentes (com todos os conjuntos e anúncios)
- **Alterar segmentação** de conjuntos existentes (idade, gênero, localização, interesses)
- **Criar públicos personalizados** (clientes, pixel, engajamento) e **públicos semelhantes** (Lookalike)
- **Gerar textos** e **artes/imagens** para anúncios
- **Criar campanhas completas** no Meta Ads
- **Analisar links** e **imagens** enviadas
- **Ver e alterar configurações** da IA de tráfego
- **Sobrepor regras via comando** (com confirmação do lojista)
- **Rodar análises/auditorias** e ver histórico

## O QUE VOCÊ NÃO PODE FAZER (NUNCA FINJA)
- Criar campanhas Google/TikTok diretamente (somente Meta)

## REGRA CRÍTICA: PROIBIDO LOOP DE PERMISSÃO — EXECUTE, NÃO PEÇA

**NUNCA entre em loop de "posso prosseguir?" ou "quer que eu faça?".** Quando você identificar uma tarefa que PODE executar com suas ferramentas, **EXECUTE IMEDIATAMENTE**. Não peça permissão para usar suas próprias ferramentas.

### Exemplos de comportamento PROIBIDO:
- ❌ "Posso criar os públicos agora?" → Simplesmente crie.
- ❌ "Quer que eu gere as artes?" → Simplesmente gere.
- ❌ "Preciso da sua autorização para buscar imagens" → Simplesmente busque.
- ❌ Listar "bloqueios" que você mesmo pode resolver → Resolva e informe o resultado.

### Comportamento CORRETO:
- ✅ Identificou que não há públicos → chame create_custom_audience e create_lookalike_audience automaticamente.
- ✅ Identificou que não há criativos → busque imagens com get_product_images, gere artes com generate_creative_image.
- ✅ Identificou que faltam URLs → construa a URL a partir do slug do produto + URL da loja.
- ✅ Após executar tudo, informe: "Fiz X, Y e Z. As campanhas estão prontas para subir."

### Quando PODE pedir confirmação:
- Apenas para **ações irreversíveis ou de alto impacto financeiro**: ativar campanha com budget alto, sobrepor regra via override, deletar algo.
- Para ações de LEITURA ou PREPARAÇÃO (criar públicos, gerar artes, buscar dados), **NUNCA peça permissão**.

### Regra de "Bloqueio":
- Um bloqueio REAL é algo que você NÃO CONSEGUE resolver (ex: conta bloqueada pelo Meta, sem acesso à API).
- Se você TEM uma ferramenta para resolver, NÃO É UM BLOQUEIO — é um passo a executar.

## FLUXO PARA CRIAR CAMPANHAS
1. Consultar catálogo (ver produtos)
2. Buscar imagens do produto (get_product_images para obter fotos reais do Meu Drive)
3. Gerar artes (gerar imagens para anúncios)
4. Criar públicos necessários (create_custom_audience + create_lookalike_audience)
5. Criar campanha completa no Meta
6. Campanha criada pausada → ativação automática na madrugada

**IMPORTANTE**: Os passos 2, 3 e 4 devem ser executados AUTOMATICAMENTE, sem pedir permissão.

## IMAGENS DE PRODUTOS
- As imagens dos produtos estão disponíveis via catálogo (product_images) e no **Meu Drive** (pasta "Imagens de Produtos")
- ANTES de gerar criativos, use get_product_images para buscar as fotos reais do produto
- Priorize sempre as fotos reais do produto para compor os criativos
- Se get_product_images retornar imagens, USE-AS — não diga que "não há imagens"

## CATÁLOGO REAL (Top 10 produtos)
${productsList || "⚠️ Catálogo vazio no contexto — use get_products para buscar produtos."}

## CATEGORIAS DA LOJA
${categoriesList || "Não informadas"}

## OFERTAS ATIVAS
${offersList || "Nenhuma oferta ativa no momento"}
${userInstructionsBlock}
## CONTEXTO ATUAL
### Configurações da IA de Tráfego
${configSummary || "Nenhuma conta configurada."}

### Vendas (30d)
- Pedidos pagos: ${context?.orderStats?.paid || 0}
- Receita: R$ ${context?.orderStats?.revenue_brl || "0.00"}
- Ticket médio: R$ ${context?.orderStats?.avg_ticket_brl || "0.00"}

## ESTILO DE RESPOSTA
- Respostas diretas, objetivas, em Português BR
- Use Markdown
- Fale como gestor de tráfego profissional conversando com o dono da loja
- Seja proativo: sugira ações
- Baseie respostas nos dados REAIS consultados
- Se catálogo vazio, consulte get_products ANTES de responder
- Referencie produtos pelo nome real`;
}

// ============ BUILD MULTIMODAL USER MESSAGE ============

function buildUserMessage(message: string, attachments?: any[]) {
  if (!attachments || attachments.length === 0) {
    return { role: "user", content: message };
  }
  const content: any[] = [];
  if (message) content.push({ type: "text", text: message });
  for (const att of attachments) {
    if (att.mimeType?.startsWith("image/")) {
      content.push({ type: "image_url", image_url: { url: att.url } });
    } else {
      content.push({ type: "text", text: `[Arquivo: ${att.filename} (${att.mimeType || "desconhecido"})]` });
    }
  }
  return { role: "user", content };
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-chat][${VERSION}] Request received`);

  let body: any;

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader || "" } } });
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
      const { data: conv, error: convErr } = await supabase.from("ads_chat_conversations").insert({ tenant_id, scope: scope || "global", ad_account_id: ad_account_id || null, channel: channel || null, title: (message || "Anexo").substring(0, 60), created_by: user.id }).select("id").single();
      if (convErr) throw convErr;
      convId = conv.id;
    }

    // Save user message
    await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "user", content: message || null, attachments: attachments?.length > 0 ? attachments : null });

    // Load conversation history (last 15)
    const { data: allHistory } = await supabase.from("ads_chat_messages").select("role, content, attachments").eq("conversation_id", convId).not("content", "is", null).order("created_at", { ascending: false }).limit(15);
    const history = (allHistory || []).reverse();

    // Collect context (enriched — Frente 2)
    const context = await collectBaseContext(supabase, tenant_id, scope, ad_account_id, channel);
    const systemPrompt = buildSystemPrompt(scope, ad_account_id, channel, context);

    // Build AI messages
    const aiMessages: any[] = [{ role: "system", content: systemPrompt }];
    for (let i = 0; i < history.length; i++) {
      const m = history[i];
      if (i === history.length - 1 && m.role === "user" && m.attachments) {
        aiMessages.push(buildUserMessage(m.content || "", m.attachments));
      } else {
        aiMessages.push({ role: m.role, content: m.content });
      }
    }

    const hasImages = attachments?.some((a: any) => a.mimeType?.startsWith("image/"));
    const modelToUse = hasImages ? "google/gemini-2.5-pro" : "google/gemini-3-flash-preview";

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Step 1: Non-streaming call WITH tools (45s timeout)
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 45000);

    let initialResult: any;
    try {
      const initialResponse = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: modelToUse, messages: aiMessages, tools: TOOLS, stream: false }),
        signal: abortController.signal,
      });
      clearTimeout(timeoutId);

      if (!initialResponse.ok) {
        const errText = await initialResponse.text();
        console.error(`[ads-chat][${VERSION}] AI error: ${initialResponse.status} ${errText}`);
        if (initialResponse.status === 429 || initialResponse.status === 402) {
          const errorMsg = initialResponse.status === 429 ? "Rate limit exceeded" : "Credits required";
          await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: `⚠️ Erro temporário: ${errorMsg}. Tente novamente.` });
          return new Response(JSON.stringify({ error: errorMsg }), { status: initialResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        throw new Error(`AI gateway error: ${initialResponse.status}`);
      }
      initialResult = await initialResponse.json();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        const timeoutMsg = "⚠️ O processamento demorou mais que o esperado. Tente criar uma **nova conversa**.";
        await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: timeoutMsg });
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: timeoutMsg } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(sseData, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Conversation-Id": convId } });
      }
      throw err;
    }

    const firstChoice = initialResult.choices?.[0];
    if (!firstChoice) throw new Error("Empty AI response");

    const toolCalls = firstChoice.message?.tool_calls;

    if (toolCalls && toolCalls.length > 0) {
      // ===== MULTI-ROUND TOOL CALL LOOP (v5.3.7) =====
      // The AI can call tools multiple times (read first, then write) across up to 5 rounds.
      // Each round: execute tool calls → feed results back to model WITH tools → repeat until text response.
      const MAX_TOOL_ROUNDS = 5;
      let currentToolCalls = toolCalls;
      let loopMessages = [...aiMessages];
      
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        console.log(`[ads-chat][${VERSION}] Tool round ${round + 1}: ${currentToolCalls.map((t: any) => t.function.name).join(", ")}`);
        
        // Build assistant message with tool_calls
        const assistantMsg: any = { role: "assistant", content: null, tool_calls: currentToolCalls.map((tc: any) => ({ id: tc.id, type: "function", function: { name: tc.function.name, arguments: tc.function.arguments } })) };
        loopMessages.push(assistantMsg);
        
        // Execute each tool call and build tool result messages
        for (const tc of currentToolCalls) {
          let args = {};
          try { args = JSON.parse(tc.function.arguments || "{}"); } catch { /* empty */ }
          const result = await executeTool(supabase, tenant_id, tc.function.name, args);
          
          // Save tool call to DB
          await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: null, tool_calls: [{ id: tc.id, function: { name: tc.function.name, arguments: tc.function.arguments } }] });
          
          // Add tool result message in OpenAI format
          loopMessages.push({ role: "tool", tool_call_id: tc.id, content: result });
        }
        
        // Call AI again WITH tools so it can decide to call more tools or respond
        const nextAbort = new AbortController();
        const nextTimeout = setTimeout(() => nextAbort.abort(), 45000);
        
        let nextResult: any;
        try {
          const nextResponse = await fetch(LOVABLE_AI_URL, {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: modelToUse, messages: loopMessages, tools: TOOLS, stream: false }),
            signal: nextAbort.signal,
          });
          clearTimeout(nextTimeout);
          if (!nextResponse.ok) {
            const errText = await nextResponse.text();
            console.error(`[ads-chat][${VERSION}] AI round ${round + 1} error: ${nextResponse.status} ${errText}`);
            throw new Error(`AI error round ${round + 1}: ${nextResponse.status}`);
          }
          nextResult = await nextResponse.json();
        } catch (err: any) {
          clearTimeout(nextTimeout);
          if (err.name === "AbortError") {
            const timeoutMsg = "⚠️ O processamento demorou mais que o esperado. Tente novamente.";
            await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: timeoutMsg });
            const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: timeoutMsg } }] })}\n\ndata: [DONE]\n\n`;
            return new Response(sseData, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Conversation-Id": convId } });
          }
          throw err;
        }
        
        const nextChoice = nextResult.choices?.[0];
        const nextToolCalls = nextChoice?.message?.tool_calls;
        
        if (nextToolCalls && nextToolCalls.length > 0) {
          // More tools to call — continue loop
          currentToolCalls = nextToolCalls;
          continue;
        }
        
        // No more tool calls — stream final text response
        const finalContent = nextChoice?.message?.content;
        if (finalContent) {
          await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: finalContent });
          if ((history || []).length <= 1) {
            await supabase.from("ads_chat_conversations").update({ title: (message || "").substring(0, 60), updated_at: new Date().toISOString() }).eq("id", convId);
          }
          const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: finalContent } }] })}\n\ndata: [DONE]\n\n`;
          return new Response(sseData, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Conversation-Id": convId } });
        }
        
        // If neither tools nor content, break
        break;
      }
      
      // Fallback: if loop exhausted without final text, do a streaming call
      console.log(`[ads-chat][${VERSION}] Tool loop exhausted after ${MAX_TOOL_ROUNDS} rounds, streaming final response`);
      const finalStream = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model: "google/gemini-3-flash-preview", messages: loopMessages, stream: true }),
      });
      if (!finalStream.ok) throw new Error(`Final stream error: ${finalStream.status}`);
      return streamAndSave(finalStream, supabase, convId, tenant_id, message || "Anexo", history);
    }

    // No tool calls — direct text
    const directContent = firstChoice.message?.content;
    if (directContent) {
      await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id, role: "assistant", content: directContent });
      const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: directContent } }] })}\n\ndata: [DONE]\n\n`;
      return new Response(sseData, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Conversation-Id": convId } });
    }

    // Fallback stream
    const streamResponse = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: modelToUse, messages: aiMessages, stream: true }),
    });
    if (!streamResponse.ok) throw new Error(`Stream error: ${streamResponse.status}`);
    return streamAndSave(streamResponse, supabase, convId, tenant_id, message || "Anexo", history);
  } catch (e: any) {
    console.error(`[ads-chat][${VERSION}] Error:`, e);
    try {
      const errMsg = `⚠️ Ocorreu um erro: ${e.message || "Erro interno"}. Tente novamente.`;
      if (body?.conversation_id || body?.tenant_id) {
        const sseData = `data: ${JSON.stringify({ choices: [{ delta: { content: errMsg } }] })}\n\ndata: [DONE]\n\n`;
        return new Response(sseData, { headers: { ...corsHeaders, "Content-Type": "text/event-stream" } });
      }
    } catch { /* ignore */ }
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// ============ STREAM & SAVE ============

function streamAndSave(aiResponse: Response, supabase: any, convId: string, tenantId: string, userMessage: string, history: any[] | null) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const decoder = new TextDecoder();
  let fullContent = "";

  (async () => {
    try {
      const reader = aiResponse.body!.getReader();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        await writer.write(value);
        buffer += decoder.decode(value, { stream: true });
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
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
      if (fullContent) {
        await supabase.from("ads_chat_messages").insert({ conversation_id: convId, tenant_id: tenantId, role: "assistant", content: fullContent });
        if ((history || []).length <= 1) {
          await supabase.from("ads_chat_conversations").update({ title: userMessage.substring(0, 60), updated_at: new Date().toISOString() }).eq("id", convId);
        }
      }
    } catch (e) {
      console.error(`[ads-chat][${VERSION}] Stream error:`, e);
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, { headers: { ...corsHeaders, "Content-Type": "text/event-stream", "X-Conversation-Id": convId } });
}
