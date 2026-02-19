import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.5.1"; // fix imagesByProduct scope leak in buildStrategistPrompt
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

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

type StrategistTrigger = "start" | "weekly" | "monthly";

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
      description: "Cria nova campanha na plataforma de anúncios. Será criada PAUSADA e AGENDADA para ativação em 00:01-04:00 BRT.",
      parameters: {
        type: "object",
        properties: {
          campaign_name: { type: "string", description: "Nome da campanha. Padrão: [AI] Objetivo | Público | Data" },
          objective: { type: "string", enum: ["OUTCOME_SALES", "OUTCOME_LEADS", "OUTCOME_TRAFFIC", "OUTCOME_AWARENESS"] },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos" },
          targeting_description: { type: "string", description: "Descrição do público-alvo" },
          funnel_stage: { type: "string", enum: ["cold", "warm", "hot"] },
          reasoning: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_name", "objective", "daily_budget_cents", "targeting_description", "funnel_stage", "reasoning", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_adset",
      description: "Cria novo conjunto de anúncios dentro de uma campanha existente.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string" },
          adset_name: { type: "string" },
          daily_budget_cents: { type: "number" },
          targeting_type: { type: "string", enum: ["cold_broad", "cold_interest", "warm_custom", "hot_remarketing", "lookalike"] },
          age_min: { type: "number" },
          age_max: { type: "number" },
          genders: { type: "array", items: { type: "number" } },
          interests: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] } },
          custom_audience_id: { type: "string" },
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
      description: "Gera criativos (imagens) para uma campanha via IA generativa. Mínimo 3 variações/semana para top products.",
      parameters: {
        type: "object",
        properties: {
          product_name: { type: "string" },
          campaign_objective: { type: "string" },
          target_audience: { type: "string" },
          style_preference: { type: "string", enum: ["promotional", "product_natural", "person_interacting", "ugc_style"] },
          format: { type: "string", enum: ["1:1", "9:16", "16:9"] },
          variations: { type: "number", minimum: 1, maximum: 5 },
          reasoning: { type: "string" },
        },
        required: ["product_name", "campaign_objective", "target_audience", "style_preference", "reasoning"],
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
      description: "Emite plano estratégico detalhado com diagnóstico, ações planejadas e previsão de resultados.",
      parameters: {
        type: "object",
        properties: {
          diagnosis: { type: "string", description: "Diagnóstico da situação atual" },
          planned_actions: { type: "array", items: { type: "string" }, description: "Lista de ações planejadas" },
          expected_results: { type: "string", description: "Previsão de resultados esperados" },
          risk_assessment: { type: "string", description: "Análise de riscos" },
          timeline: { type: "string", description: "Cronograma de implementação" },
          budget_allocation: { type: "object", description: "Alocação de orçamento proposta" },
        },
        required: ["diagnosis", "planned_actions", "expected_results", "risk_assessment"],
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

// ============ CONTEXT COLLECTOR ============

async function collectStrategistContext(supabase: any, tenantId: string, configs: AccountConfig[]) {
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
    supabase.from("products").select("id, name, price, cost_price, status, stock_quantity, brand, short_description").eq("tenant_id", tenantId).eq("status", "active").order("price", { ascending: false }).limit(20),
    supabase.from("orders").select("id, total, status, payment_status, created_at").eq("tenant_id", tenantId).gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()).limit(500),
    supabase.from("meta_ad_campaigns").select("meta_campaign_id, name, status, effective_status, objective, daily_budget_cents, ad_account_id").eq("tenant_id", tenantId).limit(200),
    supabase.from("meta_ad_insights").select("meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, date_start").eq("tenant_id", tenantId).gte("date_start", thirtyDaysAgo).limit(1000),
    supabase.from("meta_ad_insights").select("meta_campaign_id, impressions, clicks, spend_cents, conversions, roas, date_start").eq("tenant_id", tenantId).gte("date_start", sevenDaysAgo).limit(500),
    supabase.from("meta_ad_adsets").select("meta_adset_id, name, status, effective_status, meta_campaign_id, daily_budget_cents, ad_account_id").eq("tenant_id", tenantId).limit(500),
    supabase.from("meta_ad_ads").select("meta_ad_id, name, status, effective_status, meta_adset_id, ad_account_id, creative_id, creative_data").eq("tenant_id", tenantId).limit(500),
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

  // Creative cadence check (min 3/week per top product)
  const topProducts = products.slice(0, 5);
  const creativeCadence = topProducts.map((p: any) => ({
    product_id: p.id,
    product_name: p.name,
    creatives_this_week: recentCreatives.filter((c: any) => c.product_id === p.id).length,
    needs_more: recentCreatives.filter((c: any) => c.product_id === p.id).length < 3,
  }));

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
      triggerInstruction = `## TRIGGER: PRIMEIRA ATIVAÇÃO (Colocar a Casa em Ordem)
Este é o evento de REESTRUTURAÇÃO TOTAL. Analise profundamente:
1. **PLANNING**: Diagnóstico completo (use strategic_plan). Identifique oportunidades e problemas.
2. **CRIATIVOS**: Gere criativos para os top 3 produtos (generate_creative). Mín 3 variações.
3. **PÚBLICOS**: Se há Custom Audiences, crie Lookalikes (create_lookalike_audience). 1-5% ratio.
4. **MONTAGEM**: Crie campanhas com CBO e ad sets segmentados (create_campaign + create_adset).
5. **PUBLICAÇÃO**: Tudo criado PAUSADO. Ativações agendadas para 00:01-04:00 BRT.

REGRAS ESPECIAIS:
- Aumentos de budget limitados a +20% por campanha existente
- Reduções/pausas livres
- Se orçamento economizado não cabe em +20%, CRIE novas campanhas
- Sem restrições de maturidade (min_data_days ignorados)`;
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
      triggerInstruction = `## TRIGGER: REVISÃO MENSAL (Dia 1 → planejamento macro)
Análise profunda de TODO o mês anterior:
1. **PLANNING**: Diagnóstico mensal completo. ROI real, custo por aquisição, LTV estimado.
2. **CRIATIVOS**: Renove criativos que têm >30d (fadiga criativa). Gere novas abordagens.
3. **PÚBLICOS**: Reavalie todos os públicos. Expire Lookalikes com ROAS < mínimo.
4. **MONTAGEM**: Reestruturação se necessário (novas campanhas por funil stage).
5. **PUBLICAÇÃO**: Planejamento do mês (orçamento, metas, testes A/B propostos).

FOCO MENSAL: Visão macro. Identifique tendências e pivote estratégia se necessário.`;
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

${triggerInstruction}

## NEGÓCIO
- Ticket Médio: R$ ${(context.orderStats.avg_ticket_cents / 100).toFixed(2)}
- Pedidos 30d: ${context.orderStats.paid_30d} (receita: R$ ${(context.orderStats.revenue_cents_30d / 100).toFixed(2)})
- Top Produtos: ${context.products.slice(0, 5).map((p: any) => `${p.name} (R$${(p.price / 100).toFixed(2)}${p.cost_price ? `, margem ~${Math.round(((p.price - p.cost_price) / p.price) * 100)}%` : ""})`).join(", ")}`;

  // Build ads data per account
  const accountAds = context.ads?.filter((a: any) => a.ad_account_id === config.ad_account_id) || [];

  const user = `## CAMPANHAS (${campaignData.length} total: ${activeCampaigns.length} ativas, ${pausedCampaigns.length} pausadas)
${JSON.stringify(campaignData, null, 2)}

## AD SETS (${accountAdsets.length})
${JSON.stringify(accountAdsets.slice(0, 30).map((as: any) => ({ id: as.meta_adset_id, name: as.name, status: as.status, campaign_id: as.meta_campaign_id })), null, 2)}

## ANÚNCIOS (${accountAds.length})
${JSON.stringify(accountAds.slice(0, 50).map((ad: any) => ({ id: ad.meta_ad_id, name: ad.name, status: ad.status, effective_status: ad.effective_status, adset_id: ad.meta_adset_id })), null, 2)}

## PÚBLICOS DISPONÍVEIS (${accountAudiences.length})
${JSON.stringify(accountAudiences.map((a: any) => ({ id: a.meta_audience_id, name: a.name, type: a.audience_type, subtype: a.subtype, size: a.approximate_count })), null, 2)}

## PRODUTOS DO CATÁLOGO (${context.products.length})
${JSON.stringify(context.products.slice(0, 15).map((p: any) => ({ id: p.id, name: p.name, price_brl: (p.price / 100).toFixed(2), cost: p.cost_price ? (p.cost_price / 100).toFixed(2) : null, stock: p.stock_quantity, brand: p.brand, description: p.short_description?.substring(0, 100), images: ((context.imagesByProduct || {})[p.id] || []).slice(0, 3), product_url: context.storeUrl ? `${context.storeUrl}/produto/${p.id}` : null })), null, 2)}

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
    // Just record the plan as an insight
    await supabase.from("ads_autopilot_insights").insert({
      tenant_id: tenantId,
      channel: config.channel,
      ad_account_id: config.ad_account_id,
      title: "Plano Estratégico — Motor Estrategista",
      body: args.diagnosis + "\n\n**Ações Planejadas:**\n" + (args.planned_actions || []).map((a: string) => `• ${a}`).join("\n") + "\n\n**Resultados Esperados:** " + (args.expected_results || "") + "\n\n**Riscos:** " + (args.risk_assessment || ""),
      category: "strategy",
      priority: "high",
      sentiment: "neutral",
      status: "open",
      evidence: { planned_actions: args.planned_actions, timeline: args.timeline, budget_allocation: args.budget_allocation },
      recommended_action: args.planned_actions?.[0] ? { action: args.planned_actions[0] } : null,
    });
    return { status: "executed", data: { type: "strategic_plan" } };
  }

  if (toolName === "generate_creative") {
    const topProduct = context.products.find((p: any) => p.name === args.product_name) || context.products[0];
    if (!topProduct) return { status: "failed", data: { error: "Produto não encontrado" } };

    // Resolve product image URL
    let productImageUrl: string | null = null;
    if (topProduct.images) {
      const images = Array.isArray(topProduct.images) ? topProduct.images : [];
      const firstImg = images[0];
      productImageUrl = typeof firstImg === "string" ? firstImg : (firstImg as any)?.url || null;
    }

    try {
      const { data: creativeResult, error: creativeErr } = await supabase.functions.invoke("ads-autopilot-creative", {
        body: {
          tenant_id: tenantId,
          session_id: sessionId,
          channel: config.channel,
          product_id: topProduct.id,
          product_name: topProduct.name,
          product_image_url: productImageUrl, // Now included!
          campaign_objective: args.campaign_objective,
          target_audience: args.target_audience,
          style_preference: args.style_preference || "promotional",
          format: args.format || "1:1",
          variations: args.variations || 3,
        },
      });
      if (creativeErr) throw creativeErr;
      return { status: "executed", data: { creative_job_id: creativeResult?.data?.job_id, product_name: topProduct.name } };
    } catch (err: any) {
      return { status: "failed", data: { error: err.message } };
    }
  }

  if (toolName === "create_lookalike_audience") {
    try {
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
          lookalike_spec: JSON.stringify({ type: "similarity", ratio: args.ratio || 0.05, country: args.country || "BR" }),
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
        description: `LAL ${((args.ratio || 0.05) * 100).toFixed(0)}% de ${args.source_audience_name}`,
        lookalike_spec: { ratio: args.ratio, country: args.country || "BR", source: args.source_audience_id },
        synced_at: new Date().toISOString(),
      }, { onConflict: "tenant_id,meta_audience_id" });

      return { status: "executed", data: { lookalike_audience_id: lalResult.id } };
    } catch (err: any) {
      return { status: "failed", data: { error: err.message } };
    }
  }

  if (toolName === "create_campaign") {
    const needsApproval = config.human_approval_mode === "all" || config.human_approval_mode === "approve_high_impact";
    if (needsApproval) {
      return { status: "pending_approval", data: { ...args, ad_account_id: config.ad_account_id } };
    }

    try {
      // Step 1: Create campaign PAUSED via Meta API
      const { data: campResult, error: campErr } = await supabase.functions.invoke("meta-ads-campaigns", {
        body: {
          tenant_id: tenantId,
          action: "create",
          ad_account_id: config.ad_account_id,
          name: args.campaign_name,
          objective: args.objective,
          daily_budget_cents: args.daily_budget_cents,
          status: "PAUSED",
          bid_strategy: "LOWEST_COST_WITHOUT_CAP",
        },
      });
      if (campErr) throw campErr;
      if (campResult && !campResult.success) throw new Error(campResult.error || "Erro ao criar campanha");

      const newCampaignId = campResult?.data?.meta_campaign_id;

      // Step 2: Create default ad set (CBO — no budget at adset level)
      let newAdsetId = null;
      if (newCampaignId) {
        try {
          const targeting: any = { geo_locations: { countries: ["BR"] }, age_min: 18, age_max: 65 };
          
          // Build promoted_object for conversion campaigns
          const promotedObject: any = {};
          if (context.metaPixelId && (args.objective === "OUTCOME_SALES" || args.objective === "OUTCOME_LEADS")) {
            promotedObject.pixel_id = context.metaPixelId;
            promotedObject.custom_event_type = args.objective === "OUTCOME_SALES" ? "PURCHASE" : "LEAD";
          }

          const { data: adsetResult } = await supabase.functions.invoke("meta-ads-adsets", {
            body: {
              tenant_id: tenantId,
              action: "create",
              ad_account_id: config.ad_account_id,
              meta_campaign_id: newCampaignId,
              name: `[AI] ${args.funnel_stage} | ${args.targeting_description}`.substring(0, 200),
              targeting,
              status: "PAUSED",
              ...(Object.keys(promotedObject).length > 0 ? { promoted_object: promotedObject } : {}),
            },
          });
          newAdsetId = adsetResult?.data?.meta_adset_id || null;
        } catch (e: any) {
          console.error(`[ads-autopilot-strategist][${VERSION}] Adset creation failed:`, e.message);
        }
      }

      // Schedule activation for 00:01-04:00 BRT
      const scheduledFor = getNextSchedulingTime();
      if (newCampaignId && isAutoMode) {
        await supabase.from("ads_autopilot_actions").insert({
          tenant_id: tenantId,
          session_id: sessionId,
          channel: config.channel,
          action_type: "activate_campaign",
          action_data: { campaign_id: newCampaignId, ad_account_id: config.ad_account_id, campaign_name: args.campaign_name, scheduled_for: scheduledFor },
          reasoning: `Ativação agendada para ${scheduledFor}`,
          status: "scheduled",
          action_hash: `${sessionId}_activate_${newCampaignId}`,
        });
      }

      return {
        status: isAutoMode ? "scheduled" : "executed",
        data: {
          meta_campaign_id: newCampaignId,
          meta_adset_id: newAdsetId,
          scheduled_activation: isAutoMode ? scheduledFor : null,
          ad_account_id: config.ad_account_id,
          campaign_name: args.campaign_name,
        },
      };
    } catch (err: any) {
      return { status: "failed", data: { error: err.message } };
    }
  }

  if (toolName === "create_adset") {
    const needsApproval = config.human_approval_mode === "all" || config.human_approval_mode === "approve_high_impact";
    if (needsApproval) {
      return { status: "pending_approval", data: { ...args, ad_account_id: config.ad_account_id } };
    }

    try {
      const targeting: any = { geo_locations: { countries: ["BR"] }, age_min: args.age_min || 18, age_max: args.age_max || 65 };
      if (args.genders?.length > 0) targeting.genders = args.genders;
      if (args.custom_audience_id) targeting.custom_audiences = [{ id: args.custom_audience_id }];
      else if (args.interests?.length > 0) targeting.flexible_spec = [{ interests: args.interests }];

      // Build promoted_object with pixel for conversion optimization
      const promotedObject: any = {};
      if (context.metaPixelId) {
        promotedObject.pixel_id = context.metaPixelId;
        promotedObject.custom_event_type = "PURCHASE";
      }

      const { data: adsetResult, error: adsetErr } = await supabase.functions.invoke("meta-ads-adsets", {
        body: {
          tenant_id: tenantId,
          action: "create",
          ad_account_id: config.ad_account_id,
          meta_campaign_id: args.campaign_id,
          name: args.adset_name,
          targeting,
          status: "PAUSED",
          ...(Object.keys(promotedObject).length > 0 ? { promoted_object: promotedObject } : {}),
        },
      });
      if (adsetErr) throw adsetErr;
      if (adsetResult && !adsetResult.success) throw new Error(adsetResult.error || "Erro ao criar adset");

      return { status: "executed", data: { meta_adset_id: adsetResult?.data?.meta_adset_id, ad_account_id: config.ad_account_id } };
    } catch (err: any) {
      return { status: "failed", data: { error: err.message } };
    }
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

async function runStrategistForTenant(supabase: any, tenantId: string, trigger: StrategistTrigger, targetAccountId?: string | null) {
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
  const context = await collectStrategistContext(supabase, tenantId, activeConfigs);

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

  // Analyze each account with full pipeline
  for (const config of activeConfigs) {
    const prompt = buildStrategistPrompt(trigger, config, context);

    try {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const aiResponse = await fetch(LOVABLE_AI_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-5.2",
          messages: [
            { role: "system", content: prompt.system },
            { role: "user", content: prompt.user },
          ],
          tools: STRATEGIST_TOOLS,
          tool_choice: "auto",
        }),
      });

      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error(`[ads-autopilot-strategist][${VERSION}] AI error: ${aiResponse.status} ${errText}`);
        continue;
      }

      const aiResult = await aiResponse.json();
      const toolCalls = aiResult.choices?.[0]?.message?.tool_calls || [];
      const aiText = aiResult.choices?.[0]?.message?.content || "";

      for (const tc of toolCalls) {
        const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
        totalPlanned++;

        // Execute the tool
        const result = await executeToolCall(supabase, tenantId, sessionId, config, tc, context);

        // Get campaign name for logging
        const campaignName = context.campaigns.find((c: any) => c.meta_campaign_id === args.campaign_id)?.name || args.campaign_name || null;

        // Record action
        const actionRecord: any = {
          tenant_id: tenantId,
          session_id: sessionId,
          channel: config.channel,
          action_type: tc.function.name,
          action_data: { ...args, ...(result.data || {}), ad_account_id: config.ad_account_id, campaign_name: campaignName },
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
        } else if (result.status === "pending_approval") {
          // pending_approval counts as planned, not executed
        }

        const { error: insertErr } = await supabase.from("ads_autopilot_actions").insert(actionRecord);
        if (insertErr) console.error(`[ads-autopilot-strategist][${VERSION}] Action insert error:`, insertErr);
      }

      // Save per-account session detail
      if (aiText || toolCalls.length > 0) {
        await supabase.from("ads_autopilot_sessions").insert({
          tenant_id: tenantId,
          channel: config.channel,
          trigger_type: `strategist_${trigger}`,
          motor_type: "strategist",
          ai_response_raw: aiText,
          actions_planned: toolCalls.length,
          actions_executed: toolCalls.length,
          context_snapshot: { ad_account_id: config.ad_account_id, trigger },
        });
      }

      console.log(`[ads-autopilot-strategist][${VERSION}] Account ${config.ad_account_id}: ${toolCalls.length} tool calls processed`);
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
    const result = await runStrategistForTenant(supabase, tenantId, trigger, targetAccountId);
    return ok(result);
  } catch (err: any) {
    console.error(`[ads-autopilot-strategist][${VERSION}] Fatal:`, err.message);
    return fail(err.message || "Erro interno");
  }
});
