import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v4.3.0"; // Fixed approve_high_impact: budget >20% now requires approval
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

// ============ TYPES ============

interface AccountConfig {
  id: string;
  tenant_id: string;
  channel: string;
  ad_account_id: string;
  is_ai_enabled: boolean;
  budget_mode: string | null;
  budget_cents: number | null;
  target_roi: number | null;
  min_roi_cold: number | null;
  min_roi_warm: number | null;
  user_instructions: string | null;
  strategy_mode: string | null;
  funnel_split_mode: string | null;
  funnel_splits: Record<string, number> | null;
  kill_switch: boolean | null;
  human_approval_mode: string | null;
}

interface GlobalConfig {
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
  safety_rules: Record<string, any>;
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

const DEFAULT_SAFETY = {
  max_budget_change_pct_day: 10,
  max_actions_per_session: 10,
  phase1_actions: ["pause_campaign", "adjust_budget", "report_insight", "allocate_budget"],
  phase2_actions: ["create_campaign", "create_adset"],
  allowed_actions: ["pause_campaign", "adjust_budget", "report_insight", "allocate_budget", "create_campaign", "create_adset"],
  min_data_days_for_action: 3,
  min_data_days_for_creation: 7,
  min_conversions_for_creation: 10,
  ramp_up_max_pct: 10,
  max_new_campaigns_per_day: 2,
};

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

async function preCheckIntegrations(supabase: any, tenantId: string, channels: string[]) {
  const status: Record<string, { connected: boolean; reason?: string }> = {};
  const uniqueChannels = [...new Set(channels)];

  for (const channel of uniqueChannels) {
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
    active_campaigns: 0,
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

// ============ CONTEXT COLLECTOR ============

async function collectContext(supabase: any, tenantId: string, enabledChannels: string[]) {
  const { data: products } = await supabase
    .from("products")
    .select("id, name, price, compare_at_price, cost_price, status, stock_quantity, product_type, brand")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(20);

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

  const lowStockProducts = (products || []).filter((p: any) => p.stock_quantity !== null && p.stock_quantity <= 5);

  const now = Date.now();
  const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
  const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  const channelData: Record<string, any> = {};

  for (const ch of [...new Set(enabledChannels)]) {
    if (ch === "meta") {
      const { data: campaigns } = await supabase
        .from("meta_ad_campaigns")
        .select("meta_campaign_id, name, status, objective, daily_budget_cents, ad_account_id")
        .eq("tenant_id", tenantId)
        .limit(50);

      const { data: insightsCurrent } = await supabase
        .from("meta_ad_insights")
        .select("meta_campaign_id, impressions, clicks, spend_cents, reach, ctr, conversions, roas, date_start")
        .eq("tenant_id", tenantId)
        .gte("date_start", sevenDaysAgo)
        .limit(500);

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

      // Per-campaign perf
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

      // Campaign → account mapping
      const campaignAccountMap: Record<string, string> = {};
      for (const c of campaigns || []) {
        if (c.ad_account_id) campaignAccountMap[c.meta_campaign_id] = c.ad_account_id;
      }

      channelData.meta = { campaigns: campaigns || [], trend, campaignPerf, campaignAccountMap, rawInsights7d: (insightsCurrent || []).length };
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
        campaignPerf[cid] = { ...p, days: p.days.size, cpa: safeDivide(p.spend, p.conversions), roas: safeDivide(p.revenue, p.spend), cpc: safeDivide(p.spend, p.clicks), ctr_pct: safeDivide(p.clicks * 100, p.impressions) };
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
        campaignPerf[cid] = { ...p, days: p.days.size, cpa_cents: safeDivide(p.spend, p.conversions), cpc_cents: safeDivide(p.spend, p.clicks), ctr_pct: safeDivide(p.clicks * 100, p.impressions) };
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

// ============ TRACKING HEALTH CHECK ============

async function checkTrackingHealth(supabase: any, tenantId: string, context: any): Promise<Record<string, any>> {
  const healthResults: Record<string, any> = {};

  for (const [channel, data] of Object.entries(context.channels) as [string, any][]) {
    const trend = data?.trend?.current_period;
    const prevTrend = data?.trend?.previous_period;
    if (!trend) continue;

    const indicators: Record<string, any> = {};
    const alerts: string[] = [];
    let status = "healthy";

    // 1. Check conversion attribution vs real orders
    const adConversions = trend.total_conversions || 0;
    const realOrders = context.orderStats.paid_orders || 0;
    if (adConversions > 0 && realOrders > 0) {
      const discrepancyPct = Math.abs(adConversions - realOrders) / Math.max(adConversions, realOrders) * 100;
      indicators.attribution_discrepancy_pct = Math.round(discrepancyPct);
      if (discrepancyPct > 50) {
        alerts.push(`Discrepância de atribuição ${Math.round(discrepancyPct)}% entre conversões (${adConversions}) e pedidos reais (${realOrders})`);
        status = "critical";
      } else if (discrepancyPct > 30) {
        alerts.push(`Discrepância moderada ${Math.round(discrepancyPct)}% na atribuição`);
        status = status === "critical" ? "critical" : "degraded";
      }
    }

    // 2. Check event drop (>30% vs previous period)
    if (prevTrend && prevTrend.total_conversions > 0) {
      const dropPct = ((prevTrend.total_conversions - trend.total_conversions) / prevTrend.total_conversions) * 100;
      indicators.conversion_drop_pct = Math.round(dropPct);
      if (dropPct > 30) {
        alerts.push(`Queda de ${Math.round(dropPct)}% nas conversões vs período anterior`);
        status = status === "critical" ? "critical" : "degraded";
      }
    }

    // 3. CPC anomaly (>3x average)
    if (prevTrend && prevTrend.avg_cpc_cents > 0 && trend.avg_cpc_cents > prevTrend.avg_cpc_cents * 3) {
      indicators.cpc_anomaly = true;
      alerts.push(`CPC ${Math.round(trend.avg_cpc_cents / 100 * 100) / 100} é ${Math.round(trend.avg_cpc_cents / prevTrend.avg_cpc_cents)}x a média anterior`);
      status = status === "critical" ? "critical" : "degraded";
    }

    // 4. CTR collapse (< 50% of previous)
    if (prevTrend && prevTrend.avg_ctr_pct > 0 && trend.avg_ctr_pct < prevTrend.avg_ctr_pct * 0.5) {
      indicators.ctr_collapse = true;
      alerts.push(`CTR caiu para ${trend.avg_ctr_pct.toFixed(2)}% (era ${prevTrend.avg_ctr_pct.toFixed(2)}%)`);
    }

    indicators.conversions_current = trend.total_conversions;
    indicators.conversions_previous = prevTrend?.total_conversions || 0;
    indicators.spend_current = trend.total_spend_cents;

    healthResults[channel] = { status, indicators, alerts };

    // Persist to ads_tracking_health
    await supabase.from("ads_tracking_health").insert({
      tenant_id: tenantId,
      channel,
      status,
      indicators,
      alerts,
    });
  }

  return healthResults;
}

// ============ PACING MONITOR ============

function checkPacing(context: any, accountConfigs: any[]): Record<string, any> {
  const pacingResults: Record<string, any> = {};

  for (const acct of accountConfigs) {
    if (!acct.budget_cents || acct.budget_cents <= 0) continue;
    const channelData = context.channels[acct.channel];
    if (!channelData?.trend?.current_period) continue;

    const trend = channelData.trend.current_period;
    const monthlyBudget = acct.budget_mode === "daily" ? acct.budget_cents * 30 : acct.budget_cents;

    // Estimate monthly spend from 7d data
    const dailySpendAvg = trend.days_with_data > 0 ? trend.total_spend_cents / trend.days_with_data : 0;
    const now = new Date();
    const dayOfMonth = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projectedMonthlySpend = dailySpendAvg * daysInMonth;
    const spentSoFar = dailySpendAvg * dayOfMonth;

    const expectedSpend = (dayOfMonth / daysInMonth) * monthlyBudget;
    const pacingPct = expectedSpend > 0 ? Math.round((spentSoFar / expectedSpend) * 100) : 0;

    const underspend = pacingPct < 80;
    const overspend = pacingPct > 110;

    pacingResults[acct.ad_account_id] = {
      monthly_budget_cents: monthlyBudget,
      daily_avg_spend_cents: Math.round(dailySpendAvg),
      projected_monthly_spend_cents: Math.round(projectedMonthlySpend),
      spent_so_far_cents: Math.round(spentSoFar),
      pacing_pct: pacingPct,
      underspend,
      overspend,
      flag: underspend ? "UNDERSPEND" : overspend ? "OVERSPEND" : "ON_TRACK",
    };
  }

  return pacingResults;
}

// ============ POLICY VALIDATION (v4 - Per-Account) ============

function validateAction(
  action: any,
  acctConfig: AccountConfig,
  context: any,
  sessionActionsCount: number,
  trackingHealth?: Record<string, any>
): { valid: boolean; reason?: string } {
  // Kill switch
  if (acctConfig.kill_switch) {
    return { valid: false, reason: `Kill Switch ATIVO para conta ${acctConfig.ad_account_id}. Todas as ações bloqueadas.` };
  }

  // Max actions per session
  if (sessionActionsCount >= DEFAULT_SAFETY.max_actions_per_session) {
    return { valid: false, reason: `Limite de ${DEFAULT_SAFETY.max_actions_per_session} ações por sessão atingido.` };
  }

  // Tracking health gate (v4.2): block budget increases when degraded/critical
  const channelKey = acctConfig.channel;
  if (trackingHealth?.[channelKey]) {
    const health = trackingHealth[channelKey];
    if ((health.status === "critical" || health.status === "degraded") && action.name === "adjust_budget") {
      const args = typeof action.arguments === "string" ? JSON.parse(action.arguments) : action.arguments;
      if ((args.change_pct || 0) > 0) {
        return { valid: false, reason: `Tracking ${health.status}: escala de budget bloqueada. Corrija o tracking primeiro.` };
      }
    }
  }

  // Check if action type is allowed
  if (!DEFAULT_SAFETY.allowed_actions.includes(action.name)) {
    return { valid: false, reason: `Ação '${action.name}' não habilitada.` };
  }

  // Data sufficiency check
  const channelKey = acctConfig.channel;
  if (channelKey && context?.channels?.[channelKey]) {
    const trend = context.channels[channelKey].trend;
    const daysWithData = trend?.current_period?.days_with_data || 0;
    const totalConversions = trend?.current_period?.total_conversions || 0;

    // Phase 2 actions (create_campaign, create_adset) require more data
    if (DEFAULT_SAFETY.phase2_actions.includes(action.name)) {
      if (daysWithData < DEFAULT_SAFETY.min_data_days_for_creation) {
        return { valid: false, reason: `Criação requer ${DEFAULT_SAFETY.min_data_days_for_creation}+ dias de dados (atual: ${daysWithData}).` };
      }
      if (totalConversions < DEFAULT_SAFETY.min_conversions_for_creation) {
        return { valid: false, reason: `Criação requer ${DEFAULT_SAFETY.min_conversions_for_creation}+ conversões (atual: ${totalConversions}).` };
      }
    }

    if (daysWithData < DEFAULT_SAFETY.min_data_days_for_action) {
      if (action.name !== "report_insight") {
        return {
          valid: false,
          reason: `Dados insuficientes (${daysWithData} dias). Mínimo: ${DEFAULT_SAFETY.min_data_days_for_action} dias.`,
        };
      }
    }
  }

  // Budget change limits — PLATFORM-SPECIFIC
  if (action.name === "adjust_budget" && action.arguments) {
    const args = typeof action.arguments === "string" ? JSON.parse(action.arguments) : action.arguments;
    const changePct = args.change_pct || 0;
    const absChange = Math.abs(changePct);

    const platformMaxPerCycle: Record<string, number> = { meta: 10, google: 15, tiktok: 7 };
    const platformMax = platformMaxPerCycle[channelKey] || DEFAULT_SAFETY.max_budget_change_pct_day;
    const effectiveMax = Math.min(platformMax, DEFAULT_SAFETY.max_budget_change_pct_day);

    if (absChange > effectiveMax) {
      return { valid: false, reason: `Alteração de ${changePct}% excede limite de ±${effectiveMax}%/ciclo para ${channelKey}.` };
    }

    if (changePct > DEFAULT_SAFETY.ramp_up_max_pct) {
      const confidence = parseFloat(args.confidence) || 0;
      if (confidence < 0.7) {
        return { valid: false, reason: `Aumento de ${changePct}% requer confidence >= 0.7 (atual: ${confidence}).` };
      }
    }

    // Low stock check
    if (context.lowStockProducts?.length > 0 && changePct > 0) {
      // Allow increase but warn
    }
  }

  // Never delete
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
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto" }),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error(`[ads-autopilot-analyze][${VERSION}] AI error: ${response.status} ${text}`);
    throw new Error(`AI gateway error: ${response.status}`);
  }

  return response.json();
}

// ============ TOOLS DEFINITIONS ============

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
              spend_reduction_cents_day: { type: "number" },
              conversions_lost_day: { type: "number" },
              risk: { type: "string", enum: ["low", "medium", "high"] },
            },
            required: ["spend_reduction_cents_day", "risk"],
          },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          metric_trigger: { type: "string" },
          rollback_plan: { type: "string" },
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
          campaign_id: { type: "string" },
          current_budget_cents: { type: "number" },
          new_budget_cents: { type: "number" },
          change_pct: { type: "number" },
          current_cpa_cents: { type: "number" },
          reason: { type: "string" },
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
          metric_trigger: { type: "string" },
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
      description: "Reporta insight, recomendação ou alerta sem executar ação.",
      parameters: {
        type: "object",
        properties: {
          summary: { type: "string" },
          kpi_analysis: {
            type: "object",
            properties: {
              best_performing_campaign: { type: "string" },
              worst_performing_campaign: { type: "string" },
              overall_trend: { type: "string", enum: ["improving", "declining", "stable"] },
              key_metrics: { type: "string" },
            },
          },
          recommendations: { type: "array", items: { type: "string" } },
          risk_alerts: { type: "array", items: { type: "string" } },
        },
        required: ["summary", "recommendations"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_campaign",
      description: "Cria nova campanha baseada em template. Requer 7+ dias de dados e 10+ conversões na conta. Naming: [AI] {objetivo} - {produto/público} - {data}.",
      parameters: {
        type: "object",
        properties: {
          campaign_name: { type: "string", description: "Nome da campanha seguindo padrão [AI] ..." },
          objective: { type: "string", enum: ["conversions", "traffic", "awareness", "leads"], description: "Objetivo da campanha" },
          template: { type: "string", enum: ["cold_conversion", "remarketing", "creative_test", "leads"], description: "Template de campanha" },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos" },
          targeting_description: { type: "string", description: "Descrição do público-alvo" },
          funnel_stage: { type: "string", enum: ["tof", "mof", "bof"], description: "Estágio do funil" },
          reason: { type: "string", description: "Justificativa baseada em dados" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
          metric_trigger: { type: "string" },
        },
        required: ["campaign_name", "objective", "template", "daily_budget_cents", "targeting_description", "funnel_stage", "reason", "confidence", "metric_trigger"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_adset",
      description: "Cria novo conjunto de anúncios dentro de campanha existente. Requer campanha ativa e público válido.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "ID da campanha existente" },
          adset_name: { type: "string", description: "Nome do ad set" },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos" },
          targeting_description: { type: "string", description: "Descrição do targeting" },
          audience_type: { type: "string", enum: ["cold", "warm", "hot"], description: "Tipo de audiência" },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_id", "adset_name", "daily_budget_cents", "targeting_description", "audience_type", "reason", "confidence"],
        additionalProperties: false,
      },
    },
  },
];

// ============ SYSTEM PROMPT (v4 - Per-Account) ============

function buildAccountPlannerPrompt(acctConfig: AccountConfig, context: any) {
  const channelName = acctConfig.channel === "meta" ? "Meta (Facebook/Instagram)" : acctConfig.channel === "google" ? "Google Ads" : "TikTok Ads";
  const channelTrend = context.channels?.[acctConfig.channel]?.trend;

  const budgetStr = acctConfig.budget_cents ? `R$ ${(acctConfig.budget_cents / 100).toFixed(2)}` : "Não definido";
  const targetRoi = acctConfig.target_roi || 2.0;
  const minRoiCold = acctConfig.min_roi_cold || 0.8;
  const minRoiWarm = acctConfig.min_roi_warm || 1.5;

  const strategyDescriptions: Record<string, string> = {
    aggressive: "AGRESSIVA — Priorizar escala e volume. Aceitar CPAs temporariamente maiores para ganhar market share. Escalar rápido campanhas com ROI > alvo.",
    balanced: "BALANCEADA — Equilibrar crescimento e eficiência. Escalar gradualmente mantendo ROI saudável. Pausar apenas quando métricas estiverem muito fora do alvo.",
    long_term: "LONGO PRAZO — Priorizar sustentabilidade e construção de marca. Ser conservador com budget. Foco em LTV e retenção, não apenas ROAS imediato.",
  };
  const strategyStr = strategyDescriptions[acctConfig.strategy_mode || "balanced"] || strategyDescriptions.balanced;

  let funnelSection = "";
  if (acctConfig.funnel_split_mode === "manual" && acctConfig.funnel_splits) {
    const splits = acctConfig.funnel_splits;
    funnelSection = `
## SPLITS DE FUNIL (definidos pelo lojista — OBRIGATÓRIO respeitar)
- TOF (Topo — Público Frio): ${splits.tof || 0}%
- MOF (Meio — Público Morno): ${splits.mof || 0}%
- BOF (Fundo — Público Quente): ${splits.bof || 0}%
⚠️ Distribua o orçamento desta conta respeitando estes percentuais.`;
  } else {
    funnelSection = `
## SPLITS DE FUNIL
A IA decide a distribuição ideal entre TOF/MOF/BOF com base nos dados.`;
  }

  let trendSection = "";
  if (channelTrend) {
    const d = channelTrend.delta;
    trendSection = `
## TENDÊNCIA 7d ATUAL vs 7d ANTERIOR (${channelTrend.trend_direction.toUpperCase()})
| Métrica | Atual | Anterior | Variação |
|---------|-------|----------|----------|
| Spend | R$ ${(channelTrend.current_period.total_spend_cents / 100).toFixed(2)} | R$ ${(channelTrend.previous_period.total_spend_cents / 100).toFixed(2)} | ${d.spend_pct > 0 ? "+" : ""}${d.spend_pct}% |
| Conversões | ${channelTrend.current_period.total_conversions} | ${channelTrend.previous_period.total_conversions} | ${d.conversions_pct > 0 ? "+" : ""}${d.conversions_pct}% |
| CPA | R$ ${(channelTrend.current_period.real_cpa_cents / 100).toFixed(2)} | R$ ${(channelTrend.previous_period.real_cpa_cents / 100).toFixed(2)} | ${d.cpa_pct > 0 ? "+" : ""}${d.cpa_pct}% |
| CTR | ${channelTrend.current_period.avg_ctr_pct}% | ${channelTrend.previous_period.avg_ctr_pct}% | ${d.ctr_pct > 0 ? "+" : ""}${d.ctr_pct}% |
| ROAS | ${channelTrend.current_period.real_roas} | ${channelTrend.previous_period.real_roas} | ${d.roas_pct > 0 ? "+" : ""}${d.roas_pct}% |`;
  }

  // Platform-specific knowledge (condensed)
  const platformRules: Record<string, string> = {
    meta: `
### META ADS — REGRAS
- Learning Phase: ~50 eventos em 7d para estabilizar. NÃO editar durante.
- Budget: Máx ±10% por ciclo de 6h (respeitar ±20% em 48h).
- Pausar frio: ROAS < ${minRoiCold} por 5+ dias. Pausar quente: ROAS < ${minRoiWarm} por 5+ dias.
- Frequência > 3.0 = saturação de audiência.
- CTR < 0.5% por 3d = criativo/targeting ineficaz.`,
    google: `
### GOOGLE ADS — REGRAS
- Smart Bidding: ~2 semanas e ~30 conversões para estabilizar.
- Budget: Máx ±15% por ciclo (mais flexível que Meta).
- Search: CPA > 2x alvo por 7d com 30+ cliques → pausar.
- Shopping: ROAS < 1.5x por 7d → pausar.`,
    tiktok: `
### TIKTOK ADS — REGRAS
- Learning Phase: ~50 conversões em 7d. Mais sensível que Meta.
- Budget: Máx ±7% por ciclo (mais conservador).
- CTR < 0.3% por 3d = criativo não engaja.
- Criativos duram 7-14 dias. UGC performa 2-3x melhor.`,
  };

  return `Você é um media buyer sênior especializado em ${channelName}, focado exclusivamente na conta de anúncios ${acctConfig.ad_account_id}.

## ESTRATÉGIA DEFINIDA PELO LOJISTA
${strategyStr}

## CONTEXTO DA CONTA
- CANAL: ${channelName}
- CONTA: ${acctConfig.ad_account_id}
- ORÇAMENTO: ${budgetStr} / ${acctConfig.budget_mode === "daily" ? "dia" : "mês"}
- ROI IDEAL (alvo): ${targetRoi}x
- ROI MÍN. PÚBLICO FRIO: ${minRoiCold}x (abaixo disso → pausar campanhas frias)
- ROI MÍN. PÚBLICO QUENTE: ${minRoiWarm}x (abaixo disso → pausar campanhas quentes)

${funnelSection}

${acctConfig.user_instructions ? `## INSTRUÇÕES DO LOJISTA\n${acctConfig.user_instructions}` : ""}

${trendSection}

${platformRules[acctConfig.channel] || ""}

## TICKET MÉDIO: R$ ${(context.orderStats.avg_ticket_cents / 100).toFixed(2)}
## PEDIDOS (30d): ${context.orderStats.paid_orders} pagos, ${context.orderStats.cancellation_rate_pct}% cancelados

## CICLO
- Roda a cada 6h. Ações graduais.
- Máx ${DEFAULT_SAFETY.max_actions_per_session} ações/sessão.
- Se dados < ${DEFAULT_SAFETY.min_data_days_for_action} dias → APENAS report_insight.
- NUNCA deletar — apenas pausar.
- Toda ação COM justificativa numérica.
- Diferencie público frio de quente.
- Campanhas em Learning Phase → APENAS report_insight.

## FASE 2 — CRIAÇÃO (disponível se dados suficientes)
Se esta conta tem 7+ dias de dados E 10+ conversões, você PODE usar:
- create_campaign: Criar nova campanha com naming [AI] {objetivo} - {produto/público} - {data}
  - Templates: cold_conversion (TOF), remarketing (BOF), creative_test, leads
  - Budget inicial respeitando splits de funil
  - Máximo ${DEFAULT_SAFETY.max_new_campaigns_per_day} novas campanhas por sessão
- create_adset: Criar novo ad set em campanha existente
  - Público definido (cold/warm/hot)
  - Budget proporcional ao tamanho do público

Se dados insuficientes para criação, use report_insight para RECOMENDAR a criação.

Analise as campanhas DESTA CONTA e execute.`;
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

    // ---- Load global config (for lock/session/global toggle) ----
    const { data: configs } = await supabase
      .from("ads_autopilot_configs")
      .select("*")
      .eq("tenant_id", tenant_id);

    const globalConfig = configs?.find((c: any) => c.channel === "global") as GlobalConfig | undefined;
    if (!globalConfig || !globalConfig.is_enabled) {
      return fail("Piloto Automático não está ativo. Configure e ative primeiro.");
    }

    // ---- Load per-account configs (v4) ----
    const { data: accountConfigs } = await supabase
      .from("ads_autopilot_account_configs")
      .select("*")
      .eq("tenant_id", tenant_id);

    const activeAccounts = (accountConfigs || []).filter(
      (ac: any) => ac.is_ai_enabled && !ac.kill_switch
    ) as AccountConfig[];

    if (activeAccounts.length === 0) {
      return fail("Nenhuma conta de anúncios com IA ativa. Configure e ative pelo menos uma conta.");
    }

    // ---- Pre-check integrations ----
    const enabledChannels = [...new Set(activeAccounts.map((ac) => ac.channel))];
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

      return ok({ status: "BLOCKED", integration_status: integrationStatus, session_id: session?.id });
    }

    // Filter active accounts to only connected channels
    const runnableAccounts = activeAccounts.filter((ac) => connectedChannels.includes(ac.channel));
    if (runnableAccounts.length === 0) {
      return fail("Contas ativas não possuem canais conectados.");
    }

    // ---- Lock ----
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
      // ---- Context Collector ----
      console.log(`[ads-autopilot-analyze][${VERSION}] Collecting context for ${connectedChannels.join(", ")}, ${runnableAccounts.length} accounts`);
      const context = await collectContext(supabase, tenant_id, connectedChannels);

      // ---- Tracking Health Check (v4.2) ----
      console.log(`[ads-autopilot-analyze][${VERSION}] Running Tracking Health Check`);
      const trackingHealth = await checkTrackingHealth(supabase, tenant_id, context);

      // ---- Pacing Monitor (v4.2) ----
      console.log(`[ads-autopilot-analyze][${VERSION}] Running Pacing Monitor`);
      const pacingResults = checkPacing(context, runnableAccounts);

      // ---- Create global session ----
      const { data: session } = await supabase
        .from("ads_autopilot_sessions")
        .insert({
          tenant_id,
          channel: "global",
          trigger_type,
          context_snapshot: {
            accounts: runnableAccounts.map((a) => ({ channel: a.channel, account: a.ad_account_id })),
            tracking_health: trackingHealth,
            pacing: pacingResults,
          },
          integration_status: integrationStatus,
        })
        .select("id")
        .single();

      const sessionId = session!.id;
      let totalActionsPlanned = 0;
      let totalActionsExecuted = 0;
      let totalActionsRejected = 0;
      const allInsights: any[] = [];

      // ---- Per-Account Analysis (v4 core) ----
      for (const acctConfig of runnableAccounts) {
        const channel = acctConfig.channel;
        const channelData = context.channels[channel];
        if (!channelData) continue;

        // Filter campaigns for this account (Meta has ad_account_id mapping)
        let accountCampaigns = channelData.campaigns;
        let accountCampaignPerf = channelData.campaignPerf;

        if (channel === "meta" && channelData.campaignAccountMap) {
          const accountCampaignIds = Object.entries(channelData.campaignAccountMap)
            .filter(([_, acctId]) => acctId === acctConfig.ad_account_id)
            .map(([campId]) => campId);

          accountCampaigns = channelData.campaigns.filter((c: any) =>
            accountCampaignIds.includes(c.meta_campaign_id) || c.ad_account_id === acctConfig.ad_account_id
          );

          accountCampaignPerf: Record<string, any> = {};
          for (const cid of accountCampaignIds) {
            if (channelData.campaignPerf[cid]) {
              (accountCampaignPerf as any)[cid] = channelData.campaignPerf[cid];
            }
          }
        }

        if (accountCampaigns.length === 0) {
          console.log(`[ads-autopilot-analyze][${VERSION}] No campaigns for account ${acctConfig.ad_account_id}, skipping`);
          continue;
        }

        console.log(`[ads-autopilot-analyze][${VERSION}] Analyzing account ${acctConfig.ad_account_id} (${channel}), ${accountCampaigns.length} campaigns`);

        // Tracking health gate (v4.2): if channel is critical/degraded, restrict to insights only
        const channelHealth = trackingHealth[channel];
        const isHealthDegraded = channelHealth && (channelHealth.status === "critical" || channelHealth.status === "degraded");

        // Pacing context for this account (v4.2)
        const accountPacing = pacingResults[acctConfig.ad_account_id];
        const pacingContext = accountPacing ? `
## PACING (${accountPacing.flag})
- Orçamento mensal: R$ ${(accountPacing.monthly_budget_cents / 100).toFixed(2)}
- Gasto médio/dia: R$ ${(accountPacing.daily_avg_spend_cents / 100).toFixed(2)}
- Pacing: ${accountPacing.pacing_pct}% do esperado
${accountPacing.underspend ? "⚠️ UNDERSPEND >20%: Priorize escalar vencedores e criar novos testes." : ""}
${accountPacing.overspend ? "⚠️ OVERSPEND >10%: Reduza agressividade e revise campanhas de alto CPA." : ""}` : "";

        const healthContext = isHealthDegraded ? `
## ⚠️ TRACKING DEGRADADO (${channelHealth.status.toUpperCase()})
${channelHealth.alerts?.join("\n") || ""}
🚨 RESTRIÇÃO: Não escalar budgets. Apenas pausar campanhas problemáticas e gerar insights.` : "";

        const plannerMessages = [
          { role: "system", content: buildAccountPlannerPrompt(acctConfig, context) + pacingContext + healthContext },
          {
            role: "user",
            content: `## CAMPANHAS DESTA CONTA (${acctConfig.ad_account_id})
${JSON.stringify(accountCampaigns, null, 2)}

## PERFORMANCE POR CAMPANHA (7d)
${JSON.stringify(accountCampaignPerf, null, 2)}

## PRODUTOS TOP
${JSON.stringify(
  context.products.slice(0, 10).map((p: any) => ({
    name: p.name,
    price: `R$ ${(p.price / 100).toFixed(2)}`,
    stock: p.stock_quantity,
    cost: p.cost_price ? `R$ ${(p.cost_price / 100).toFixed(2)}` : "N/A",
  })),
  null, 2
)}

## VENDAS (30d)
${JSON.stringify(context.orderStats)}${context.lowStockProducts.length > 0 ? `\n\n## ⚠️ PRODUTOS COM ESTOQUE BAIXO\n${context.lowStockProducts.map((p: any) => `- ${p.name}: ${p.stock_quantity} un.`).join("\n")}` : ""}`,
          },
        ];

        const plannerResponse = await callAI(plannerMessages, PLANNER_TOOLS, globalConfig.ai_model);
        const toolCalls = plannerResponse.choices?.[0]?.message?.tool_calls || [];
        const aiText = plannerResponse.choices?.[0]?.message?.content || "";

        for (const tc of toolCalls) {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          const validation = validateAction(
            { name: tc.function.name, arguments: args },
            acctConfig,
            context,
            totalActionsPlanned,
            trackingHealth
          );

          totalActionsPlanned++;

          if (tc.function.name === "report_insight") {
            allInsights.push({ ...args, account_id: acctConfig.ad_account_id });
            await supabase.from("ads_autopilot_actions").insert({
              tenant_id,
              session_id: sessionId,
              channel,
              action_type: "report_insight",
              action_data: { ...args, ad_account_id: acctConfig.ad_account_id },
              reasoning: args.summary,
              status: "executed",
              action_hash: `${sessionId}_insight_${acctConfig.ad_account_id}_${totalActionsPlanned}`,
            });
            totalActionsExecuted++;
            continue;
          }

          const actionRecord: any = {
            tenant_id,
            session_id: sessionId,
            channel,
            action_type: tc.function.name,
            action_data: { ...args, ad_account_id: acctConfig.ad_account_id },
            reasoning: args.reason || args.reasoning || "",
            expected_impact: JSON.stringify(args.expected_impact || ""),
            confidence: String(args.confidence || "medium"),
            metric_trigger: args.metric_trigger || "",
            status: validation.valid ? "validated" : "rejected",
            rejection_reason: validation.reason || null,
            action_hash: `${sessionId}_${tc.function.name}_${acctConfig.ad_account_id}_${args.campaign_id || totalActionsPlanned}`,
          };

          // Human approval mode check
          const isCreateAction = tc.function.name === "create_campaign" || tc.function.name === "create_adset";
          const isBigBudgetChange = tc.function.name === "adjust_budget" && Math.abs(args.change_pct || 0) > 20;
          const isHighImpact = isCreateAction || isBigBudgetChange;
          const needsApproval = validation.valid && (
            acctConfig.human_approval_mode === "all" ||
            (acctConfig.human_approval_mode === "approve_high_impact" && isHighImpact) ||
            isCreateAction // create actions ALWAYS need approval regardless of mode
          );

          if (needsApproval) {
            actionRecord.status = "pending_approval";
          } else if (validation.valid) {
            // Execute
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

        // Save per-account session
        if (aiText || toolCalls.length > 0) {
          await supabase.from("ads_autopilot_sessions").insert({
            tenant_id,
            channel,
            trigger_type,
            context_snapshot: {
              ad_account_id: acctConfig.ad_account_id,
              strategy_mode: acctConfig.strategy_mode,
              trend: channelData.trend,
              campaignPerf: accountCampaignPerf,
            },
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
        `[ads-autopilot-analyze][${VERSION}] Completed: ${runnableAccounts.length} accounts, ${totalActionsPlanned} planned, ${totalActionsExecuted} executed, ${totalActionsRejected} rejected in ${durationMs}ms`
      );

      return ok({
        session_id: sessionId,
        status: "completed",
        accounts_analyzed: runnableAccounts.length,
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
    console.error(`[ads-autopilot-analyze][${VERSION}] Fatal error:`, err.message, err.stack);
    return fail(err.message || "Erro interno");
  }
});
