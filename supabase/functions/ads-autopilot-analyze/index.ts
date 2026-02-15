import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.2.0"; // Customer-defined ROI targets per audience type + min ROAS pause threshold
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ============ TYPES ============

interface SafetyRules {
  gross_margin_pct: number;
  max_cpa_cents: number | null;
  min_roas: number;
  target_roas_cold: number;        // ROAS ideal para público frio (prospecção)
  target_roas_remarketing: number;  // ROAS ideal para remarketing (público quente)
  min_roas_pause: number;           // ROAS mínimo — abaixo disso, pausar campanha
  max_budget_change_pct_day: number;
  max_actions_per_session: number;
  allowed_actions: string[];
  // v2: novos campos
  min_data_days_for_action: number;
  ramp_up_max_pct: number;
  max_new_campaigns_per_day: number;
}

interface AutopilotConfig {
  id: string;
  tenant_id: string;
  channel: string;
  is_enabled: boolean;
  budget_mode: string;
  budget_cents: number;
  allocation_mode: string;
  max_share_pct: number;
  min_share_pct: number;
  objective: string;
  user_instructions: string | null;
  ai_model: string;
  safety_rules: SafetyRules;
  lock_session_id: string | null;
  lock_expires_at: string | null;
  total_actions_executed?: number;
  total_credits_consumed?: number;
}

interface ChannelAggregates {
  total_spend_cents: number;
  total_impressions: number;
  total_clicks: number;
  total_conversions: number;
  total_revenue_cents: number;
  avg_cpc_cents: number;
  avg_cpm_cents: number;
  avg_ctr_pct: number;
  real_cpa_cents: number;
  real_roas: number;
  active_campaigns: number;
  days_with_data: number;
}

interface TrendComparison {
  current_period: ChannelAggregates;
  previous_period: ChannelAggregates;
  delta: {
    spend_pct: number;
    impressions_pct: number;
    clicks_pct: number;
    conversions_pct: number;
    cpa_pct: number;
    roas_pct: number;
    ctr_pct: number;
  };
  trend_direction: "improving" | "declining" | "stable";
}

// ============ DEFAULTS ============

const DEFAULT_SAFETY_RULES: SafetyRules = {
  gross_margin_pct: 50,
  max_cpa_cents: null,
  min_roas: 2.0,
  target_roas_cold: 2.0,
  target_roas_remarketing: 4.0,
  min_roas_pause: 1.0,
  max_budget_change_pct_day: 10,
  max_actions_per_session: 10,
  allowed_actions: ["pause_campaign", "adjust_budget", "report_insight", "allocate_budget"],
  min_data_days_for_action: 3,
  ramp_up_max_pct: 10,
  max_new_campaigns_per_day: 2,
};

function getSafetyRules(config: AutopilotConfig): SafetyRules {
  return { ...DEFAULT_SAFETY_RULES, ...config.safety_rules };
}

// ============ HELPERS ============

function ok(data: any) {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function fail(error: string, code?: string) {
  return new Response(JSON.stringify({ success: false, error, code }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100 * 10) / 10;
}

function safeDivide(a: number, b: number, fallback = 0): number {
  return b > 0 ? Math.round((a / b) * 100) / 100 : fallback;
}

// ============ PRE-CHECK INTEGRATIONS ============

async function preCheckIntegrations(supabase: any, tenantId: string, enabledChannels: string[]) {
  const status: Record<string, { connected: boolean; reason?: string }> = {};

  for (const channel of enabledChannels) {
    if (channel === "meta") {
      const { data } = await supabase
        .from("marketplace_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("platform", "meta")
        .eq("status", "active")
        .maybeSingle();
      status.meta = data
        ? { connected: true }
        : { connected: false, reason: "Meta não conectada. Vá em Integrações para conectar." };
    }

    if (channel === "google") {
      const { data } = await supabase
        .from("google_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();
      if (!data) {
        status.google = { connected: false, reason: "Google não conectado." };
      } else {
        const { data: cred } = await supabase
          .from("platform_credentials")
          .select("credential_value")
          .eq("credential_key", "GOOGLE_ADS_DEVELOPER_TOKEN")
          .maybeSingle();
        status.google = cred?.credential_value
          ? { connected: true }
          : { connected: false, reason: "Developer Token do Google Ads não configurado." };
      }
    }

    if (channel === "tiktok") {
      const { data } = await supabase
        .from("tiktok_ads_connections")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("status", "active")
        .maybeSingle();
      status.tiktok = data
        ? { connected: true }
        : { connected: false, reason: "TikTok Ads não conectado." };
    }
  }

  return status;
}

// ============ AGGREGATE METRICS ============

function aggregateInsights(insights: any[], spendField: string, conversionsField: string, revenueField?: string): ChannelAggregates {
  const totalSpend = insights.reduce((s, i) => s + (i[spendField] || 0), 0);
  const totalImpressions = insights.reduce((s, i) => s + (i.impressions || 0), 0);
  const totalClicks = insights.reduce((s, i) => s + (i.clicks || 0), 0);
  const totalConversions = insights.reduce((s, i) => s + (i[conversionsField] || 0), 0);
  const totalRevenue = revenueField ? insights.reduce((s, i) => s + (i[revenueField] || 0), 0) : 0;

  // Count unique dates for days_with_data
  const dateField = insights[0]?.date_start ? "date_start" : "date_range_start";
  const uniqueDates = new Set(insights.map((i) => i[dateField]).filter(Boolean));

  return {
    total_spend_cents: totalSpend,
    total_impressions: totalImpressions,
    total_clicks: totalClicks,
    total_conversions: totalConversions,
    total_revenue_cents: totalRevenue,
    avg_cpc_cents: safeDivide(totalSpend, totalClicks),
    avg_cpm_cents: safeDivide(totalSpend * 1000, totalImpressions),
    avg_ctr_pct: safeDivide(totalClicks * 100, totalImpressions),
    real_cpa_cents: safeDivide(totalSpend, totalConversions),
    real_roas: safeDivide(totalRevenue, totalSpend),
    active_campaigns: 0, // set externally
    days_with_data: uniqueDates.size,
  };
}

function computeTrend(current: ChannelAggregates, previous: ChannelAggregates): TrendComparison {
  const delta = {
    spend_pct: pctChange(current.total_spend_cents, previous.total_spend_cents),
    impressions_pct: pctChange(current.total_impressions, previous.total_impressions),
    clicks_pct: pctChange(current.total_clicks, previous.total_clicks),
    conversions_pct: pctChange(current.total_conversions, previous.total_conversions),
    cpa_pct: pctChange(current.real_cpa_cents, previous.real_cpa_cents),
    roas_pct: pctChange(current.real_roas, previous.real_roas),
    ctr_pct: pctChange(current.avg_ctr_pct, previous.avg_ctr_pct),
  };

  // Direction: improving if ROAS up OR CPA down; declining if opposite
  let score = 0;
  if (delta.roas_pct > 5) score++;
  if (delta.roas_pct < -5) score--;
  if (delta.cpa_pct < -5) score++;
  if (delta.cpa_pct > 5) score--;
  if (delta.conversions_pct > 5) score++;
  if (delta.conversions_pct < -5) score--;

  const trend_direction = score > 0 ? "improving" : score < 0 ? "declining" : "stable";

  return { current_period: current, previous_period: previous, delta, trend_direction };
}

// ============ ENHANCED CONTEXT COLLECTOR ============

async function collectContext(supabase: any, tenantId: string, enabledChannels: string[]) {
  // Products - top 20 by sales
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, compare_at_price, cost_price, status, stock_quantity, product_type, brand")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);

  // Orders - last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: orders } = await supabase
    .from("orders")
    .select("id, total, status, payment_status, created_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", thirtyDaysAgo)
    .limit(500);

  const paidOrders = orders?.filter((o: any) => o.payment_status === "paid" || o.status === "delivered") || [];
  const cancelledOrders = orders?.filter((o: any) => o.status === "cancelled" || o.status === "returned") || [];

  const orderStats = {
    total_orders: orders?.length || 0,
    paid_orders: paidOrders.length,
    cancelled_orders: cancelledOrders.length,
    cancellation_rate_pct: orders?.length ? Math.round((cancelledOrders.length / orders.length) * 100 * 10) / 10 : 0,
    total_revenue_cents: paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0),
    avg_ticket_cents: paidOrders.length
      ? Math.round(paidOrders.reduce((s: number, o: any) => s + (o.total || 0), 0) / paidOrders.length)
      : 0,
  };

  // Stock alerts - products with low stock
  const lowStockProducts = (products || []).filter((p: any) => p.stock_quantity !== null && p.stock_quantity <= 5);

  // Time windows
  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const channelData: Record<string, any> = {};

  for (const ch of enabledChannels) {
    if (ch === "meta") {
      const { data: campaigns } = await supabase
        .from("meta_ad_campaigns")
        .select("meta_campaign_id, name, status, objective, daily_budget_cents")
        .eq("tenant_id", tenantId)
        .limit(50);

      // Current 7 days
      const { data: insightsCurrent } = await supabase
        .from("meta_ad_insights")
        .select("meta_campaign_id, impressions, clicks, spend_cents, reach, ctr, conversions, roas, date_start")
        .eq("tenant_id", tenantId)
        .gte("date_start", sevenDaysAgo)
        .limit(500);

      // Previous 7 days
      const { data: insightsPrevious } = await supabase
        .from("meta_ad_insights")
        .select("meta_campaign_id, impressions, clicks, spend_cents, reach, ctr, conversions, roas, date_start")
        .eq("tenant_id", tenantId)
        .gte("date_start", fourteenDaysAgo)
        .lt("date_start", sevenDaysAgo)
        .limit(500);

      const currentAgg = aggregateInsights(insightsCurrent || [], "spend_cents", "conversions");
      currentAgg.active_campaigns = (campaigns || []).filter((c: any) => c.status === "ACTIVE").length;

      const previousAgg = aggregateInsights(insightsPrevious || [], "spend_cents", "conversions");
      const trend = computeTrend(currentAgg, previousAgg);

      // Per-campaign performance for the planner
      const campaignPerf: Record<string, any> = {};
      for (const ins of insightsCurrent || []) {
        const cid = ins.meta_campaign_id;
        if (!campaignPerf[cid]) campaignPerf[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, days: new Set() };
        campaignPerf[cid].spend += ins.spend_cents || 0;
        campaignPerf[cid].impressions += ins.impressions || 0;
        campaignPerf[cid].clicks += ins.clicks || 0;
        campaignPerf[cid].conversions += ins.conversions || 0;
        campaignPerf[cid].days.add(ins.date_start);
      }
      // Convert Sets to counts
      for (const cid of Object.keys(campaignPerf)) {
        const p = campaignPerf[cid];
        campaignPerf[cid] = {
          ...p,
          days: p.days.size,
          cpa_cents: safeDivide(p.spend, p.conversions),
          cpc_cents: safeDivide(p.spend, p.clicks),
          ctr_pct: safeDivide(p.clicks * 100, p.impressions),
        };
      }

      channelData.meta = { campaigns: campaigns || [], trend, campaignPerf, rawInsights7d: (insightsCurrent || []).length };
    }

    if (ch === "google") {
      const { data: campaigns } = await supabase
        .from("google_ad_campaigns")
        .select("google_campaign_id, name, status, advertising_channel_type, budget_amount_micros")
        .eq("tenant_id", tenantId)
        .limit(50);

      const { data: insightsCurrent } = await supabase
        .from("google_ad_insights")
        .select("google_campaign_id, impressions, clicks, cost_micros, conversions, conversions_value_micros, ctr, date_range_start")
        .eq("tenant_id", tenantId)
        .gte("date_range_start", sevenDaysAgo)
        .limit(500);

      const { data: insightsPrevious } = await supabase
        .from("google_ad_insights")
        .select("google_campaign_id, impressions, clicks, cost_micros, conversions, conversions_value_micros, ctr, date_range_start")
        .eq("tenant_id", tenantId)
        .gte("date_range_start", fourteenDaysAgo)
        .lt("date_range_start", sevenDaysAgo)
        .limit(500);

      const currentAgg = aggregateInsights(insightsCurrent || [], "cost_micros", "conversions", "conversions_value_micros");
      currentAgg.active_campaigns = (campaigns || []).filter((c: any) => c.status === "ENABLED").length;

      const previousAgg = aggregateInsights(insightsPrevious || [], "cost_micros", "conversions", "conversions_value_micros");
      const trend = computeTrend(currentAgg, previousAgg);

      // Per-campaign
      const campaignPerf: Record<string, any> = {};
      for (const ins of insightsCurrent || []) {
        const cid = ins.google_campaign_id;
        if (!campaignPerf[cid]) campaignPerf[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, days: new Set() };
        campaignPerf[cid].spend += ins.cost_micros || 0;
        campaignPerf[cid].impressions += ins.impressions || 0;
        campaignPerf[cid].clicks += ins.clicks || 0;
        campaignPerf[cid].conversions += ins.conversions || 0;
        campaignPerf[cid].revenue += ins.conversions_value_micros || 0;
        campaignPerf[cid].days.add(ins.date_range_start);
      }
      for (const cid of Object.keys(campaignPerf)) {
        const p = campaignPerf[cid];
        campaignPerf[cid] = {
          ...p,
          days: p.days.size,
          cpa: safeDivide(p.spend, p.conversions),
          roas: safeDivide(p.revenue, p.spend),
          cpc: safeDivide(p.spend, p.clicks),
          ctr_pct: safeDivide(p.clicks * 100, p.impressions),
        };
      }

      channelData.google = { campaigns: campaigns || [], trend, campaignPerf, rawInsights7d: (insightsCurrent || []).length };
    }

    if (ch === "tiktok") {
      const { data: campaigns } = await supabase
        .from("tiktok_ad_campaigns")
        .select("tiktok_campaign_id, name, status, objective_type, budget_cents")
        .eq("tenant_id", tenantId)
        .limit(50);

      const { data: insightsCurrent } = await supabase
        .from("tiktok_ad_insights")
        .select("tiktok_campaign_id, impressions, clicks, spend_cents, conversions, roas, ctr, date_start")
        .eq("tenant_id", tenantId)
        .gte("date_start", sevenDaysAgo)
        .limit(500);

      const { data: insightsPrevious } = await supabase
        .from("tiktok_ad_insights")
        .select("tiktok_campaign_id, impressions, clicks, spend_cents, conversions, roas, ctr, date_start")
        .eq("tenant_id", tenantId)
        .gte("date_start", fourteenDaysAgo)
        .lt("date_start", sevenDaysAgo)
        .limit(500);

      const currentAgg = aggregateInsights(insightsCurrent || [], "spend_cents", "conversions");
      currentAgg.active_campaigns = (campaigns || []).filter((c: any) => c.status === "ENABLE" || c.status === "ACTIVE").length;

      const previousAgg = aggregateInsights(insightsPrevious || [], "spend_cents", "conversions");
      const trend = computeTrend(currentAgg, previousAgg);

      const campaignPerf: Record<string, any> = {};
      for (const ins of insightsCurrent || []) {
        const cid = ins.tiktok_campaign_id;
        if (!campaignPerf[cid]) campaignPerf[cid] = { spend: 0, impressions: 0, clicks: 0, conversions: 0, days: new Set() };
        campaignPerf[cid].spend += ins.spend_cents || 0;
        campaignPerf[cid].impressions += ins.impressions || 0;
        campaignPerf[cid].clicks += ins.clicks || 0;
        campaignPerf[cid].conversions += ins.conversions || 0;
        campaignPerf[cid].days.add(ins.date_start);
      }
      for (const cid of Object.keys(campaignPerf)) {
        const p = campaignPerf[cid];
        campaignPerf[cid] = {
          ...p,
          days: p.days.size,
          cpa_cents: safeDivide(p.spend, p.conversions),
          cpc_cents: safeDivide(p.spend, p.clicks),
          ctr_pct: safeDivide(p.clicks * 100, p.impressions),
        };
      }

      channelData.tiktok = { campaigns: campaigns || [], trend, campaignPerf, rawInsights7d: (insightsCurrent || []).length };
    }
  }

  return {
    products: products || [],
    lowStockProducts,
    orderStats,
    channels: channelData,
  };
}

// ============ POLICY VALIDATION (v2 - Enhanced) ============

function validateAction(
  action: any,
  globalConfig: AutopilotConfig,
  channelConfig: AutopilotConfig | null,
  context: any,
  sessionActionsCount: number
): { valid: boolean; reason?: string } {
  const rules = getSafetyRules(globalConfig);

  // Max actions per session
  if (sessionActionsCount >= rules.max_actions_per_session) {
    return { valid: false, reason: `Limite de ${rules.max_actions_per_session} ações por sessão atingido.` };
  }

  // Check if action type is allowed
  if (!rules.allowed_actions.includes(action.name)) {
    return { valid: false, reason: `Ação '${action.name}' não habilitada na fase atual do rollout.` };
  }

  // Data sufficiency check
  const channelKey = action.arguments?.channel || (channelConfig?.channel);
  if (channelKey && context?.channels?.[channelKey]) {
    const trend = context.channels[channelKey].trend;
    if (trend?.current_period?.days_with_data < rules.min_data_days_for_action) {
      if (action.name !== "report_insight") {
        return {
          valid: false,
          reason: `Dados insuficientes (${trend.current_period.days_with_data} dias). Mínimo: ${rules.min_data_days_for_action} dias. Entrando em modo recommendation-only.`,
        };
      }
    }
  }

  // Budget change limits — PLATFORM-SPECIFIC
  if (action.name === "adjust_budget" && action.arguments) {
    const args = typeof action.arguments === "string" ? JSON.parse(action.arguments) : action.arguments;
    const changePct = args.change_pct || 0;
    const absChange = Math.abs(changePct);

    // Platform-specific max change per 6h cycle
    // Meta: 20% every 48h → ~10% per 6h cycle (to stay safe)
    // Google: 30% every 48-72h → ~15% per cycle (more flexible)
    // TikTok: 15% every 48h → ~7% per cycle (most conservative)
    const platformMaxPerCycle: Record<string, number> = {
      meta: 10,
      google: 15,
      tiktok: 7,
    };
    const budgetChannelKey = channelConfig?.channel || "meta";
    const platformMax = platformMaxPerCycle[budgetChannelKey] || rules.max_budget_change_pct_day;
    const effectiveMax = Math.min(platformMax, rules.max_budget_change_pct_day);

    if (absChange > effectiveMax) {
      return {
        valid: false,
        reason: `Alteração de ${changePct}% excede limite de ±${effectiveMax}%/ciclo para ${budgetChannelKey}. (Regra da plataforma: max ±${platformMax}% por 6h para respeitar limite de 48h.)`,
      };
    }

    // Ramp-up: increases above ramp_up_max_pct require confidence >= 0.7
    if (changePct > rules.ramp_up_max_pct) {
      const confidence = parseFloat(args.confidence) || 0;
      if (confidence < 0.7) {
        return {
          valid: false,
          reason: `Aumento de ${changePct}% requer confidence >= 0.7 (atual: ${confidence}). Reduza para ≤${rules.ramp_up_max_pct}%.`,
        };
      }
    }

    // CPA ceiling check: new budget should not push CPA above max
    if (rules.max_cpa_cents || context.orderStats?.avg_ticket_cents) {
      const maxCpa = rules.max_cpa_cents || Math.round(context.orderStats.avg_ticket_cents * (1 - rules.gross_margin_pct / 100));
      if (args.current_cpa_cents && args.current_cpa_cents > maxCpa && changePct > 0) {
        return {
          valid: false,
          reason: `CPA atual (R$ ${(args.current_cpa_cents / 100).toFixed(2)}) já excede teto (R$ ${(maxCpa / 100).toFixed(2)}). Não permitido aumentar budget.`,
        };
      }
    }
  }

  // Allocate budget - validate shares
  if (action.name === "allocate_budget" && action.arguments) {
    const args = typeof action.arguments === "string" ? JSON.parse(action.arguments) : action.arguments;
    const total = (args.meta_pct || 0) + (args.google_pct || 0) + (args.tiktok_pct || 0);
    if (total > 100) {
      return { valid: false, reason: `Alocação total de ${total}% excede 100%.` };
    }
  }

  // Never delete - only pause
  if (action.name === "delete_campaign" || action.name === "delete_ad" || action.name === "delete_adgroup") {
    return { valid: false, reason: "Deletar entidades é PROIBIDO. Use pause." };
  }

  return { valid: true };
}

// ============ AI CALL ============

async function callAI(messages: any[], tools: any[], model: string): Promise<any> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const response = await fetch(LOVABLE_AI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      tools,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[ads-autopilot][${VERSION}] AI error: ${response.status} ${text}`);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  return response.json();
}

// ============ TOOLS DEFINITIONS (v2 - Expanded) ============

const ALLOCATOR_TOOLS = [
  {
    type: "function",
    function: {
      name: "allocate_budget",
      description: "Distribui o orçamento total entre os canais baseado em ROAS marginal, tendência e escala disponível.",
      parameters: {
        type: "object",
        properties: {
          meta_pct: { type: "number", description: "% do orçamento para Meta (0-100)" },
          google_pct: { type: "number", description: "% do orçamento para Google (0-100)" },
          tiktok_pct: { type: "number", description: "% do orçamento para TikTok (0-100)" },
          reasoning: { type: "string", description: "Justificativa detalhada com base nos KPIs" },
          risk_alerts: { type: "array", items: { type: "string" }, description: "Alertas de risco identificados" },
        },
        required: ["meta_pct", "google_pct", "tiktok_pct", "reasoning"],
        additionalProperties: false,
      },
    },
  },
];

const PLANNER_TOOLS = [
  {
    type: "function",
    function: {
      name: "pause_campaign",
      description: "Pausa campanha com baixo desempenho. NUNCA delete — apenas pause.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "ID da campanha na plataforma" },
          reason: { type: "string", description: "Motivo baseado em métricas específicas" },
          expected_impact: {
            type: "object",
            properties: {
              spend_reduction_cents_day: { type: "number", description: "Economia diária em centavos" },
              conversions_lost_day: { type: "number", description: "Conversões perdidas estimadas" },
              risk: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["spend_reduction_cents_day", "risk"],
          },
          confidence: { type: "number", minimum: 0, maximum: 1, description: "Nível de confiança (0-1)" },
          metric_trigger: { type: "string", description: "KPI que motivou (ex: CPA > R$50, ROAS < 1.5)" },
          rollback_plan: { type: "string", description: "Como reverter se necessário" },
        },
        required: ["campaign_id", "reason", "expected_impact", "confidence", "metric_trigger"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "adjust_budget",
      description: "Ajusta orçamento de campanha. Respeite limites de ±% por dia e ramp-up.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "ID da campanha" },
          current_budget_cents: { type: "number", description: "Budget atual em centavos" },
          new_budget_cents: { type: "number", description: "Novo budget em centavos" },
          change_pct: { type: "number", description: "% de mudança (positivo=aumento, negativo=redução)" },
          current_cpa_cents: { type: "number", description: "CPA atual em centavos (para validação)" },
          reason: { type: "string", description: "Motivo baseado em métricas" },
          expected_impact: {
            type: "object",
            properties: {
              incremental_conversions_day: { type: "number" },
              new_estimated_cpa_cents: { type: "number" },
              risk: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["risk"],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          metric_trigger: { type: "string", description: "KPI que motivou" },
        },
        required: ["campaign_id", "new_budget_cents", "change_pct", "reason", "expected_impact", "confidence", "metric_trigger"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "report_insight",
      description: "Reporta insight, recomendação ou alerta sem executar ação. Use quando dados são insuficientes ou para diagnóstico.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string", description: "Resumo executivo do insight" },
          kpi_analysis: {
            type: "object",
            properties: {
              best_performing_campaign: { type: "string" },
              worst_performing_campaign: { type: "string" },
              overall_trend: { type: "string", enum: ["improving", "declining", "stable"] },
              key_metrics: { type: "string", description: "Métricas-chave observadas" },
            },
          },
          recommendations: { type: "array", items: { type: "string" }, description: "Lista de recomendações acionáveis" },
          risk_alerts: { type: "array", items: { type: "string" }, description: "Alertas de risco" },
          integration_gaps: { type: "array", items: { type: "string" }, description: "Pendências de integração" },
        },
        required: ["summary", "recommendations"],
        additionalProperties: false,
      },
    },
  },
];

// ============ SYSTEM PROMPTS (v2 - Professional) ============

function buildAllocatorPrompt(globalConfig: AutopilotConfig, context: any) {
  const rules = getSafetyRules(globalConfig);
  const maxCpaCents = rules.max_cpa_cents || Math.round(context.orderStats.avg_ticket_cents * (1 - rules.gross_margin_pct / 100));

  return `Você é um media buyer sênior com 10+ anos de experiência em alocação cross-channel.

## CONTEXTO DE NEGÓCIO
- ORÇAMENTO TOTAL: R$ ${(globalConfig.budget_cents / 100).toFixed(2)} / ${globalConfig.budget_mode === "daily" ? "dia" : "mês"}
- OBJETIVO: ${globalConfig.objective}
- MARGEM BRUTA: ${rules.gross_margin_pct}%
- ROAS MÍNIMO GERAL: ${rules.min_roas}
- ROAS IDEAL PÚBLICO FRIO: ${rules.target_roas_cold}
- ROAS IDEAL REMARKETING: ${rules.target_roas_remarketing}
- ROAS MÍNIMO P/ PAUSAR: ${rules.min_roas_pause}
- CPA MÁXIMO CALCULADO: R$ ${(maxCpaCents / 100).toFixed(2)}
- TICKET MÉDIO: R$ ${(context.orderStats.avg_ticket_cents / 100).toFixed(2)}
- PEDIDOS (30d): ${context.orderStats.paid_orders} pagos / ${context.orderStats.cancelled_orders} cancelados (${context.orderStats.cancellation_rate_pct}% cancel.)

${globalConfig.user_instructions ? `## INSTRUÇÕES DO LOJISTA\n${globalConfig.user_instructions}` : ""}

## CICLO DE EXECUÇÃO
- Este autopilot roda a cada 6 HORAS (4x/dia).
- Suas decisões de alocação valem para as próximas 6h até o próximo ciclo.
- Ajustes devem ser graduais, não abruptos.

## CHECKLIST DE DECISÃO
1. Compare ROAS real de cada canal (receita/gasto, não estimado)
2. Compare CPA real de cada canal (gasto/conversões)
3. Avalie TENDÊNCIA (7d atual vs 7d anterior) — canal melhorando merece mais budget
4. Considere ESCALA: canal com bom ROAS mas pouco gasto tem mais espaço de crescimento
5. Canal sem dados = 0% (ou mínimo para teste se budget permitir)
6. Considere ESTOQUE: produtos com ruptura iminente → reduzir tráfego para eles

## REGRAS
- A soma DEVE ser ≤ 100%
- Canal sem conexão = 0%
- Canal sem dados nos últimos 7d = máximo 15% (para exploração)
- Priorize o canal com melhor ROAS MARGINAL (não absoluto)
- Considere diversificação para reduzir risco

Use a tool 'allocate_budget'.`;
}

function buildPlannerPrompt(channel: string, globalConfig: AutopilotConfig, channelBudgetCents: number, context: any) {
  const rules = getSafetyRules(globalConfig);
  const maxCpaCents = rules.max_cpa_cents || Math.round(context.orderStats.avg_ticket_cents * (1 - rules.gross_margin_pct / 100));
  const channelName = channel === "meta" ? "Meta (Facebook/Instagram)" : channel === "google" ? "Google Ads" : "TikTok Ads";
  const channelTrend = context.channels?.[channel]?.trend;

  let trendSection = "";
  if (channelTrend) {
    const d = channelTrend.delta;
    trendSection = `
## TENDÊNCIA 7d ATUAL vs 7d ANTERIOR (${channelTrend.trend_direction.toUpperCase()})
| Métrica | Atual | Anterior | Variação |
|---------|-------|----------|----------|
| Spend | R$ ${(channelTrend.current_period.total_spend_cents / 100).toFixed(2)} | R$ ${(channelTrend.previous_period.total_spend_cents / 100).toFixed(2)} | ${d.spend_pct > 0 ? "+" : ""}${d.spend_pct}% |
| Impressões | ${channelTrend.current_period.total_impressions} | ${channelTrend.previous_period.total_impressions} | ${d.impressions_pct > 0 ? "+" : ""}${d.impressions_pct}% |
| Cliques | ${channelTrend.current_period.total_clicks} | ${channelTrend.previous_period.total_clicks} | ${d.clicks_pct > 0 ? "+" : ""}${d.clicks_pct}% |
| Conversões | ${channelTrend.current_period.total_conversions} | ${channelTrend.previous_period.total_conversions} | ${d.conversions_pct > 0 ? "+" : ""}${d.conversions_pct}% |
| CPA | R$ ${(channelTrend.current_period.real_cpa_cents / 100).toFixed(2)} | R$ ${(channelTrend.previous_period.real_cpa_cents / 100).toFixed(2)} | ${d.cpa_pct > 0 ? "+" : ""}${d.cpa_pct}% |
| CTR | ${channelTrend.current_period.avg_ctr_pct}% | ${channelTrend.previous_period.avg_ctr_pct}% | ${d.ctr_pct > 0 ? "+" : ""}${d.ctr_pct}% |
| ROAS | ${channelTrend.current_period.real_roas} | ${channelTrend.previous_period.real_roas} | ${d.roas_pct > 0 ? "+" : ""}${d.roas_pct}% |
| Dias c/ dados | ${channelTrend.current_period.days_with_data} | ${channelTrend.previous_period.days_with_data} | — |`;
  }

  // ========== PLATFORM-SPECIFIC KNOWLEDGE ==========
  const platformKnowledge: Record<string, string> = {
    meta: `
## REGRAS ESPECÍFICAS DO META ADS (Facebook/Instagram)

### LEARNING PHASE (Fase de Aprendizado)
- Uma campanha/ad set entra em Learning Phase ao ser criada ou após EDIÇÕES SIGNIFICATIVAS (budget, targeting, criativo, bid)
- Precisa de ~50 EVENTOS DE OTIMIZAÇÃO em 7 DIAS para sair da Learning Phase
- Durante a Learning Phase: performance é instável e custos podem ser mais altos — NÃO tome decisões precipitadas
- NUNCA julgue performance de um ad set que está em Learning Phase — aguarde 3-5 dias mínimo

### REGRA DE ORÇAMENTO (CRÍTICA!)
- **Regra dos 20%**: Aumentar ou diminuir o orçamento em no MÁXIMO 20% a cada 48 HORAS
- Mudanças acima de 20% RESETAM a Learning Phase e destroem a otimização acumulada
- Como este autopilot roda a cada 6h (4x/dia), aplique no MÁXIMO ±10% por ciclo (para respeitar ±20% em 48h)
- Exemplo: R$100/dia → máx R$110/dia neste ciclo. Próximo aumento só no ciclo seguinte (+48h)
- Se precisar escalar mais rápido, DUPLIQUE a campanha em vez de aumentar o budget

### QUANDO PAUSAR NO META
- CPA > 2x do CPA alvo por 3+ dias APÓS sair da Learning Phase
- ROAS < ${rules.min_roas_pause} (mín. definido pelo lojista) por 5+ dias consecutivos → PAUSAR
- Frequência > 3.0 (indica saturação de audiência/criativo)
- CTR < 0.5% por 3+ dias (indica criativo ou targeting ineficaz)
- NÃO pausar durante Learning Phase a menos que o gasto esteja completamente fora de controle

### PÚBLICO FRIO vs QUENTE
- **Público Frio (Prospecção/TOF)**: Lookalike, interesses amplos, broad targeting
  - CPA esperado: 1.5x a 3x maior que remarketing — ISSO É NORMAL
  - ROAS IDEAL (definido pelo lojista): ${rules.target_roas_cold}
  - Objetivo: volume e aprendizado, não ROAS imediato
  - Orçamento recomendado: 60-70% do total do canal
  - Métrica-chave: CPM, CTR, custo por lead/ATC (métricas de topo de funil)
  - NÃO pausar por CPA alto se CPM e CTR estiverem saudáveis — está alimentando o funil
  - Pausar SOMENTE se ROAS < ${rules.min_roas_pause} por 5+ dias

- **Público Quente (Remarketing/MOF-BOF)**: Visitantes do site, carrinhos abandonados, engajaram com conteúdo
  - CPA esperado: menor, mas volume limitado
  - Objetivo: conversão direta, ROAS alto
  - ROAS IDEAL (definido pelo lojista): ${rules.target_roas_remarketing}
  - Orçamento recomendado: 20-30% do total do canal
  - Métrica-chave: ROAS, CPA, taxa de conversão
  - Pausar se ROAS cair abaixo de ${rules.min_roas_pause} por 5+ dias

- **Público Hot (Retargeting Agressivo)**: Compradores anteriores, carrinhos < 7 dias
  - Orçamento recomendado: 10% do total
  - Foco em upsell/cross-sell

### INVESTIMENTO INICIAL RECOMENDADO
- Campanha de Conversão: Mínimo R$30/dia (idealmente 10x CPA alvo)
- Campanha de Tráfego: Mínimo R$20/dia
- Campanha de Reconhecimento: Mínimo R$15/dia
- Se o orçamento total do canal for < R$50/dia, concentre em UMA campanha de conversão`,

    google: `
## REGRAS ESPECÍFICAS DO GOOGLE ADS

### LEARNING PHASE
- Google Ads também possui período de aprendizado, especialmente em Smart Bidding (Target CPA, Target ROAS, Maximize Conversions)
- Precisa de ~2 SEMANAS e ~30 CONVERSÕES para estabilizar Smart Bidding
- Evitar mudanças significativas durante as primeiras 2 semanas de uma campanha nova
- Após mudanças de bid strategy, aguardar 7-14 dias antes de julgar performance

### REGRA DE ORÇAMENTO
- Google é MAIS FLEXÍVEL que Meta — aceita mudanças maiores sem "resetar" completamente
- Ainda assim, recomenda-se no máximo 20-30% a cada 48-72 horas para Smart Bidding
- Para campanhas manuais (Manual CPC), pode-se ajustar mais agressivamente (até 30%/dia)
- Google permite que o gasto diário real seja até 2x o budget diário configurado (otimização automática)

### TIPOS DE CAMPANHA
- **Search (Busca)**: Maior intenção de compra, CPA geralmente menor
  - CTR benchmark: 3-5% (inferior indica keywords ruins ou anúncios fracos)
  - Quality Score importa: otimizar anúncios com QS < 5
- **Shopping**: Excelente para e-commerce, depende de feed bem otimizado
  - ROAS benchmark: 4x-8x para e-commerce
  - Pausar se ROAS < 2x por 7+ dias
- **Display**: Público frio, reconhecimento — CPA mais alto é esperado
  - NÃO esperar ROAS de Search em Display
- **Performance Max (PMax)**: Campanhas automatizadas do Google
  - Precisa de volume mínimo de conversões para funcionar bem
  - NÃO alterar assets com frequência — deixar rodar 2+ semanas

### QUANDO PAUSAR NO GOOGLE
- Search: CPA > 2x do alvo por 7+ dias com 30+ cliques
- Shopping: ROAS < 1.5x por 7+ dias
- Display/PMax: ROAS < 1x por 14+ dias (precisa mais tempo)
- Keywords com QS ≤ 3 e sem conversões: pausar keywords, não a campanha

### PÚBLICO FRIO vs QUENTE
- **Frio (Search Genérico, Display, Discovery)**: Intenção baixa-média
  - Orçamento: 50-60% do canal
- **Quente (Search Brand, RLSA, Shopping Remarketing)**: Alta intenção
  - Orçamento: 30-40% do canal
- **Hot (Dynamic Remarketing, carrinho abandonado)**: Conversão direta
  - Orçamento: 10-20% do canal

### INVESTIMENTO INICIAL RECOMENDADO
- Search (conversão): Mínimo R$30/dia por campanha
- Shopping: Mínimo R$50/dia (precisa de volume)
- PMax: Mínimo R$50/dia (requer dados para otimizar)
- Display remarketing: Mínimo R$20/dia`,

    tiktok: `
## REGRAS ESPECÍFICAS DO TIKTOK ADS

### LEARNING PHASE
- TikTok requer ~50 CONVERSÕES em 7 DIAS para sair da Learning Phase
- A Learning Phase é especialmente sensível — mudanças RESETAM completamente
- NÃO editar ad groups durante Learning Phase (budget, targeting, criativo, bid)
- Aguardar 7-14 DIAS entre mudanças significativas

### REGRA DE ORÇAMENTO (CRÍTICA!)
- Escalar em no máximo 15-20% a cada 2-3 DIAS (mais conservador que Meta)
- Como este autopilot roda a cada 6h, aplique no MÁXIMO ±7% por ciclo (para respeitar ±15% em 48h)
- Budget diário mínimo: 10x o CPA alvo OU R$30/dia (o que for maior)
- Mudanças bruscas de budget são a causa #1 de perda de performance no TikTok

### QUANDO PAUSAR NO TIKTOK
- CPA > 2.5x do alvo por 5+ dias APÓS sair da Learning Phase
- CTR < 0.3% por 3+ dias (criativo não está engajando)
- CPM subindo + CTR caindo = fadiga criativa severa → pausar e renovar criativos
- NÃO pausar campanhas com < 7 dias de dados

### PÚBLICO FRIO vs QUENTE
- **Público Frio (Broad, Interest-based, Lookalike)**: 
  - CPA será 2x-4x maior que remarketing — esperado para TikTok
  - Orçamento recomendado: 70-80% (TikTok é plataforma de descoberta)
  - Foco em criativos nativos (UGC, trend-based)
- **Público Quente (Custom Audiences, Site visitors, Engagers)**:
  - Orçamento: 20-30%
  - Criativos mais diretos/oferta

### INVESTIMENTO INICIAL RECOMENDADO
- Campanha de Conversão: Mínimo R$50/dia (TikTok precisa de mais volume)
- Campanha de Tráfego: Mínimo R$30/dia
- Se orçamento total < R$50/dia, concentre em UMA campanha com broad targeting

### PARTICULARIDADES DO TIKTOK
- Criativos têm vida útil CURTA (7-14 dias em média) — monitorar frequência e CTR
- UGC (User Generated Content) performa 2-3x melhor que anúncios "produzidos"
- Vídeos de 15-30s performam melhor que vídeos longos
- Hook nos primeiros 3 segundos é CRÍTICO`,
  };

  const channelKnowledgeBlock = platformKnowledge[channel] || "";

  return `Você é um media buyer sênior especializado em ${channelName} com 10+ anos de experiência. Seu objetivo é maximizar ${globalConfig.objective} com eficiência.

## CONTEXTO DE NEGÓCIO
- ORÇAMENTO DESTE CANAL: R$ ${(channelBudgetCents / 100).toFixed(2)} / ${globalConfig.budget_mode === "daily" ? "dia" : "mês"}
- OBJETIVO: ${globalConfig.objective}
- MARGEM BRUTA: ${rules.gross_margin_pct}%
- ROAS MÍNIMO GERAL: ${rules.min_roas}
- ROAS IDEAL PÚBLICO FRIO: ${rules.target_roas_cold}
- ROAS IDEAL REMARKETING: ${rules.target_roas_remarketing}
- ROAS MÍNIMO P/ PAUSAR: ${rules.min_roas_pause} (abaixo disso → pausar campanha)
- CPA MÁXIMO: R$ ${(maxCpaCents / 100).toFixed(2)}
- TICKET MÉDIO: R$ ${(context.orderStats.avg_ticket_cents / 100).toFixed(2)}
${trendSection}

${globalConfig.user_instructions ? `## INSTRUÇÕES DO LOJISTA\n${globalConfig.user_instructions}` : ""}

## CICLO DE EXECUÇÃO
- Este autopilot roda a cada 6 HORAS (4x/dia).
- Suas ações devem ser proporcionais a um ciclo de 6h — NÃO faça mudanças drásticas.
- IMPORTANTE: Respeite os limites de alteração de budget ESPECÍFICOS da plataforma (veja abaixo).

${channelKnowledgeBlock}

## CHECKLIST DE ANÁLISE (OBRIGATÓRIO)
Antes de qualquer ação, analise CADA campanha ativa com este checklist:

### 1. FASE DE APRENDIZADO
- A campanha está em Learning Phase? → Se sim, NÃO alterar (apenas report_insight)
- Quantos dias de dados tem? → Se < 3 dias, modo recommendation-only
- Quantas conversões nos últimos 7 dias? → Se < 50 (Meta/TikTok), considerar em aprendizado

### 2. TIPO DE AUDIÊNCIA
- É campanha de PÚBLICO FRIO (prospecção)? → CPA mais alto é NORMAL, avaliar métricas de topo de funil
- É campanha de REMARKETING (quente)? → ROAS e CPA são as métricas decisivas
- Não compare CPA de campanha fria com quente — são funis DIFERENTES

### 3. EFICIÊNCIA (CPA)
- CPA < CPA máximo (R$ ${(maxCpaCents / 100).toFixed(2)})? → OK, considere escalar
- CPA entre 1x e 1.5x do máximo? → ATENÇÃO, monitore sem escalar
- CPA > 1.5x do máximo por período suficiente (ver regras da plataforma)? → REDUZIR budget ou PAUSAR

### 4. RETORNO (ROAS) — METAS DO LOJISTA
- Público Frio: ROAS ideal = ${rules.target_roas_cold}. Acima = escalar. Abaixo = monitorar (esperado ser menor que remarketing)
- Remarketing: ROAS ideal = ${rules.target_roas_remarketing}. Acima = escalar agressivamente. Abaixo = otimizar
- ROAS < ${rules.min_roas_pause} (mínimo absoluto) por período suficiente? → PAUSAR campanha (respeitando regras da plataforma)
- ROAS entre ${rules.min_roas_pause} e ${rules.min_roas}? → REDUZIR budget gradualmente

### 5. ENGAJAMENTO (CTR/CPC/Frequência)
- CTR caindo + CPC subindo? → Fadiga de criativo, sinalize
- Frequência > 3.0 (Meta)? → Saturação de audiência
- CTR abaixo do benchmark da plataforma? → Revisar targeting/criativo

### 6. ESCALA
- Campanha com bom ROAS + espaço pra crescer? → Aumentar budget respeitando LIMITES DA PLATAFORMA
- Campanha já no teto de escala? → Não forçar, buscar novo público/campanha

### 7. ESTOQUE
- Produto com estoque ≤ 5 unidades? → NÃO escalar tráfego para ele

## REGRAS OBRIGATÓRIAS
- NUNCA deletar — apenas pausar
- Respeitar limites de budget ESPECÍFICOS da plataforma (detalhados acima)
- Máximo ${rules.max_actions_per_session} ações por sessão
- Se dados < ${rules.min_data_days_for_action} dias, usar APENAS report_insight
- Toda ação DEVE ter justificativa com NÚMEROS ESPECÍFICOS (não genérica)
- Prefira poucas ações de alto impacto (3-5) a muitas de baixo impacto
- Inclua rollback_plan em ações de execução
- DIFERENCIE público frio de quente na análise — use CPA relativo, não absoluto
- Campanhas em Learning Phase: APENAS report_insight

Analise as campanhas e execute.`;
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-analyze][${VERSION}] Request received`);

  try {
    const { tenant_id, trigger_type = "manual" } = await req.json();
    if (!tenant_id) return fail("tenant_id é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const startTime = Date.now();

    // ---- Load configs ----
    const { data: configs } = await supabase
      .from("ads_autopilot_configs")
      .select("*")
      .eq("tenant_id", tenant_id);

    const globalConfig = configs?.find((c: any) => c.channel === "global") as AutopilotConfig | undefined;
    if (!globalConfig || !globalConfig.is_enabled) {
      return fail("Piloto Automático não está ativo. Configure e ative primeiro.");
    }

    // Apply default safety rules
    globalConfig.safety_rules = getSafetyRules(globalConfig);

    const channelConfigs = (configs || []).filter((c: any) => c.channel !== "global" && c.is_enabled) as AutopilotConfig[];
    const enabledChannels = channelConfigs.map((c) => c.channel);

    if (enabledChannels.length === 0) {
      return fail("Nenhum canal habilitado. Ative pelo menos um canal.");
    }

    // ---- ETAPA 0: Pre-check ----
    const integrationStatus = await preCheckIntegrations(supabase, tenant_id, enabledChannels);
    const connectedChannels = enabledChannels.filter((ch) => integrationStatus[ch]?.connected);

    if (connectedChannels.length === 0) {
      const { data: session } = await supabase
        .from("ads_autopilot_sessions")
        .insert({
          tenant_id,
          channel: "global",
          trigger_type,
          integration_status: integrationStatus,
          insights_generated: {
            blocked: true,
            reasons: Object.entries(integrationStatus).map(([ch, s]) => `${ch}: ${(s as any).reason}`),
          },
        })
        .select("id")
        .single();

      return ok({
        status: "BLOCKED",
        integration_status: integrationStatus,
        session_id: session?.id,
        message: "Nenhum canal conectado.",
      });
    }

    // ---- ETAPA 1: Lock ----
    const lockExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data: lockResult, error: lockError } = await supabase
      .from("ads_autopilot_configs")
      .update({ lock_session_id: crypto.randomUUID(), lock_expires_at: lockExpiry })
      .eq("id", globalConfig.id)
      .or(`lock_session_id.is.null,lock_expires_at.lt.${new Date().toISOString()}`)
      .select("lock_session_id")
      .single();

    if (lockError || !lockResult) {
      return fail("Já existe uma análise em andamento. Aguarde.");
    }

    const sessionLockId = lockResult.lock_session_id;

    try {
      // ---- ETAPA 2: Context Collector (Enhanced) ----
      console.log(`[ads-autopilot-analyze][${VERSION}] Collecting context for ${connectedChannels.join(", ")}`);
      const context = await collectContext(supabase, tenant_id, connectedChannels);

      // ---- Create session ----
      const { data: session } = await supabase
        .from("ads_autopilot_sessions")
        .insert({
          tenant_id,
          channel: "global",
          trigger_type,
          context_snapshot: context,
          integration_status: integrationStatus,
        })
        .select("id")
        .single();

      const sessionId = session!.id;
      let totalActionsPlanned = 0;
      let totalActionsExecuted = 0;
      let totalActionsRejected = 0;
      const allInsights: any[] = [];

      // ---- ETAPA 3: Allocator (Enhanced with real metrics) ----
      let allocation: Record<string, number> = {};

      if (connectedChannels.length > 1 && globalConfig.allocation_mode === "auto") {
        // Build rich context for allocator with aggregated metrics per channel
        const channelSummary: Record<string, any> = {};
        for (const ch of connectedChannels) {
          const chData = context.channels[ch];
          if (chData?.trend) {
            channelSummary[ch] = {
              spend_7d: `R$ ${(chData.trend.current_period.total_spend_cents / 100).toFixed(2)}`,
              conversions_7d: chData.trend.current_period.total_conversions,
              real_cpa: `R$ ${(chData.trend.current_period.real_cpa_cents / 100).toFixed(2)}`,
              real_roas: chData.trend.current_period.real_roas,
              avg_ctr: `${chData.trend.current_period.avg_ctr_pct}%`,
              active_campaigns: chData.trend.current_period.active_campaigns,
              trend: chData.trend.trend_direction,
              trend_delta: chData.trend.delta,
            };
          } else {
            channelSummary[ch] = "Sem dados de performance nos últimos 7 dias";
          }
        }

        const allocatorMessages = [
          { role: "system", content: buildAllocatorPrompt(globalConfig, context) },
          {
            role: "user",
            content: `PERFORMANCE AGREGADA POR CANAL (7d):\n\n${JSON.stringify(channelSummary, null, 2)}\n\nESTATÍSTICAS DE VENDAS (30d):\n${JSON.stringify(context.orderStats, null, 2)}${context.lowStockProducts.length > 0 ? `\n\nPRODUTOS COM ESTOQUE BAIXO (≤5):\n${context.lowStockProducts.map((p: any) => `- ${p.name}: ${p.stock_quantity} un.`).join("\n")}` : ""}`,
          },
        ];

        const allocatorResponse = await callAI(allocatorMessages, ALLOCATOR_TOOLS, globalConfig.ai_model);
        const toolCalls = allocatorResponse.choices?.[0]?.message?.tool_calls || [];

        for (const tc of toolCalls) {
          if (tc.function.name === "allocate_budget") {
            const args = JSON.parse(tc.function.arguments);
            const validation = validateAction({ name: tc.function.name, arguments: args }, globalConfig, null, context, totalActionsPlanned);

            allocation = {
              meta: args.meta_pct || 0,
              google: args.google_pct || 0,
              tiktok: args.tiktok_pct || 0,
            };

            await supabase.from("ads_autopilot_actions").insert({
              tenant_id,
              session_id: sessionId,
              channel: "global",
              action_type: "allocate_budget",
              action_data: args,
              reasoning: args.reasoning,
              expected_impact: "Redistribuição cross-channel",
              confidence: "high",
              metric_trigger: "performance_analysis",
              status: validation.valid ? "executed" : "rejected",
              rejection_reason: validation.reason || null,
              action_hash: `${sessionId}_allocate_budget_global`,
            });

            totalActionsPlanned++;
            if (validation.valid) totalActionsExecuted++;
            else totalActionsRejected++;
          }
        }
      } else {
        for (const ch of connectedChannels) {
          allocation[ch] = connectedChannels.length === 1 ? 100 : 100 / connectedChannels.length;
        }
      }

      // ---- ETAPA 4: Planner per channel (Enhanced) ----
      for (const channel of connectedChannels) {
        const channelBudgetCents = Math.round((globalConfig.budget_cents * (allocation[channel] || 0)) / 100);
        if (channelBudgetCents === 0) continue;

        const channelData = context.channels[channel];
        if (!channelData) continue;

        const plannerMessages = [
          { role: "system", content: buildPlannerPrompt(channel, globalConfig, channelBudgetCents, context) },
          {
            role: "user",
            content: `## CAMPANHAS ATIVAS\n${JSON.stringify(channelData.campaigns, null, 2)}\n\n## PERFORMANCE POR CAMPANHA (7d)\n${JSON.stringify(channelData.campaignPerf, null, 2)}\n\n## PRODUTOS TOP (para contexto de criativo)\n${JSON.stringify(
              context.products.slice(0, 10).map((p: any) => ({
                name: p.name,
                price: `R$ ${(p.price / 100).toFixed(2)}`,
                stock: p.stock_quantity,
                cost: p.cost_price ? `R$ ${(p.cost_price / 100).toFixed(2)}` : "N/A",
              })),
              null,
              2
            )}\n\n## VENDAS (30d)\n${JSON.stringify(context.orderStats)}${context.lowStockProducts.length > 0 ? `\n\n## ⚠️ PRODUTOS COM ESTOQUE BAIXO\n${context.lowStockProducts.map((p: any) => `- ${p.name}: ${p.stock_quantity} un.`).join("\n")}` : ""}`,
          },
        ];

        const plannerResponse = await callAI(plannerMessages, PLANNER_TOOLS, globalConfig.ai_model);
        const toolCalls = plannerResponse.choices?.[0]?.message?.tool_calls || [];
        const aiText = plannerResponse.choices?.[0]?.message?.content || "";

        for (const tc of toolCalls) {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          const validation = validateAction(
            { name: tc.function.name, arguments: args },
            globalConfig,
            channelConfigs.find((c) => c.channel === channel) || null,
            context,
            totalActionsPlanned
          );

          totalActionsPlanned++;

          if (tc.function.name === "report_insight") {
            allInsights.push(args);
            await supabase.from("ads_autopilot_actions").insert({
              tenant_id,
              session_id: sessionId,
              channel,
              action_type: "report_insight",
              action_data: args,
              reasoning: args.summary,
              status: "executed",
              action_hash: `${sessionId}_report_insight_${channel}_${totalActionsPlanned}`,
            });
            totalActionsExecuted++;
            continue;
          }

          const actionRecord: any = {
            tenant_id,
            session_id: sessionId,
            channel,
            action_type: tc.function.name,
            action_data: args,
            reasoning: args.reason || args.reasoning || "",
            expected_impact: JSON.stringify(args.expected_impact || ""),
            confidence: String(args.confidence || "medium"),
            metric_trigger: args.metric_trigger || "",
            status: validation.valid ? "validated" : "rejected",
            rejection_reason: validation.reason || null,
            action_hash: `${sessionId}_${tc.function.name}_${channel}_${args.campaign_id || totalActionsPlanned}`,
          };

          // ETAPA 5: Execute
          if (validation.valid) {
            try {
              if (tc.function.name === "pause_campaign") {
                const edgeFn = channel === "meta" ? "meta-ads-campaigns" : channel === "google" ? "google-ads-campaigns" : "tiktok-ads-campaigns";
                const idField = channel === "meta" ? "meta_campaign_id" : channel === "google" ? "google_campaign_id" : "tiktok_campaign_id";

                actionRecord.rollback_data = { previous_status: "ACTIVE", rollback_plan: args.rollback_plan || "Reativar campanha" };

                const { error } = await supabase.functions.invoke(edgeFn, {
                  body: { tenant_id, action: "update", [idField]: args.campaign_id, status: "PAUSED" },
                });

                if (error) throw error;
                actionRecord.status = "executed";
                actionRecord.executed_at = new Date().toISOString();
                totalActionsExecuted++;
              } else if (tc.function.name === "adjust_budget") {
                const edgeFn = channel === "meta" ? "meta-ads-campaigns" : channel === "google" ? "google-ads-campaigns" : "tiktok-ads-campaigns";
                const idField = channel === "meta" ? "meta_campaign_id" : channel === "google" ? "google_campaign_id" : "tiktok_campaign_id";
                const budgetField = channel === "meta" ? "daily_budget_cents" : "budget_cents";

                actionRecord.rollback_data = {
                  previous_budget_cents: args.current_budget_cents,
                  rollback_plan: `Reverter para R$ ${((args.current_budget_cents || 0) / 100).toFixed(2)}`,
                };

                const { error } = await supabase.functions.invoke(edgeFn, {
                  body: { tenant_id, action: "update", [idField]: args.campaign_id, [budgetField]: args.new_budget_cents },
                });

                if (error) throw error;
                actionRecord.status = "executed";
                actionRecord.executed_at = new Date().toISOString();
                totalActionsExecuted++;
              } else {
                actionRecord.status = "validated";
              }
            } catch (execErr: any) {
              actionRecord.status = "failed";
              actionRecord.error_message = execErr.message || "Erro ao executar";
              console.error(`[ads-autopilot-analyze][${VERSION}] Execution error:`, execErr.message);
            }
          } else {
            totalActionsRejected++;
          }

          const { error: insertErr } = await supabase.from("ads_autopilot_actions").insert(actionRecord);
          if (insertErr) console.error(`[ads-autopilot-analyze][${VERSION}] Action insert error:`, insertErr);
        }

        // Save channel session
        if (aiText || toolCalls.length > 0) {
          await supabase.from("ads_autopilot_sessions").insert({
            tenant_id,
            channel,
            trigger_type,
            context_snapshot: { trend: channelData.trend, campaignPerf: channelData.campaignPerf },
            ai_response_raw: aiText,
            actions_planned: toolCalls.length,
          });
        }
      }

      // ---- Update global session ----
      const durationMs = Date.now() - startTime;
      await supabase
        .from("ads_autopilot_sessions")
        .update({
          actions_planned: totalActionsPlanned,
          actions_executed: totalActionsExecuted,
          actions_rejected: totalActionsRejected,
          insights_generated: allInsights.length > 0 ? allInsights : null,
          duration_ms: durationMs,
        })
        .eq("id", sessionId);

      // Update config stats
      await supabase
        .from("ads_autopilot_configs")
        .update({
          last_analysis_at: new Date().toISOString(),
          total_actions_executed: (globalConfig.total_actions_executed || 0) + totalActionsExecuted,
        })
        .eq("id", globalConfig.id);

      console.log(
        `[ads-autopilot-analyze][${VERSION}] Completed: ${totalActionsPlanned} planned, ${totalActionsExecuted} executed, ${totalActionsRejected} rejected in ${durationMs}ms`
      );

      return ok({
        session_id: sessionId,
        status: "completed",
        allocation,
        integration_status: integrationStatus,
        actions: { planned: totalActionsPlanned, executed: totalActionsExecuted, rejected: totalActionsRejected },
        insights: allInsights,
        duration_ms: durationMs,
      });
    } finally {
      // ---- Release lock ----
      await supabase
        .from("ads_autopilot_configs")
        .update({ lock_session_id: null, lock_expires_at: null })
        .eq("id", globalConfig.id)
        .eq("lock_session_id", sessionLockId);
    }
  } catch (err: any) {
    console.error(`[ads-autopilot-analyze][${VERSION}] Error:`, err);
    return fail(err.message || "Erro interno");
  }
});
