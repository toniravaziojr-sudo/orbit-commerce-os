import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v5.11.2"; // Pipeline orientado a processo + HARD STOP + PAUSED-first + rollback + produto por funil + insights + artifacts
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
  roas_scale_up_threshold: number | null;
  roas_scale_down_threshold: number | null;
  budget_increase_pct: number | null;
  budget_decrease_pct: number | null;
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
  phase2_actions: ["create_campaign", "create_adset", "create_lookalike_audience"],
  allowed_actions: ["pause_campaign", "adjust_budget", "report_insight", "allocate_budget", "create_campaign", "create_adset", "generate_creative", "create_lookalike_audience"],
  min_data_days_for_action: 3,
  min_data_days_for_creation: 7,
  min_conversions_for_creation: 10,
  ramp_up_max_pct: 10,
  max_new_campaigns_per_day: 2,
  first_activation_max_increase_pct: 20, // Max budget increase per campaign even on first activation
  scheduling_window_start_hour: 0,  // 00:01
  scheduling_window_end_hour: 4,    // 04:00
};

// ============ FUNNEL CLASSIFIER (v5.11.0) ============

function classifyCampaignFunnel(campaign: any): string {
  const name = (campaign.name || "").toLowerCase();
  const objective = (campaign.objective || "").toUpperCase();

  // BOF keywords
  if (/remarketing|retarget|quente|warm|carrinho|abandono|comprador/.test(name)) return "bof";
  // TEST keywords
  if (/teste|test|criativo|creative/.test(name)) return "test";
  // MOF keywords
  if (/morno|engaj|visita/.test(name)) return "mof";
  // TOF keywords
  if (/frio|cold|prospecc|lookalike|lal|awareness|conversao|convers/.test(name)) return "tof";

  // Fallback by objective
  if (objective === "OUTCOME_AWARENESS") return "tof";
  if (objective === "OUTCOME_LEADS") return "leads";
  if (objective === "OUTCOME_TRAFFIC") return "tof";

  return "unknown";
}

// Map funnel_stage to compatible stages for creative matching
function funnelStageCompatible(campaignFunnel: string): string[] {
  switch (campaignFunnel) {
    case "tof": return ["tof"];
    case "mof": return ["mof", "tof"];
    case "bof": return ["bof", "mof"];
    case "test": return ["test", "tof", "mof", "bof"];
    case "leads": return ["leads", "tof"];
    default: return ["tof", "mof", "bof", "test", "leads"];
  }
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

// Calculate next scheduling time within the 00:01-04:00 window
function getNextSchedulingTime(): string {
  const now = new Date();
  const startHour = DEFAULT_SAFETY.scheduling_window_start_hour;
  const endHour = DEFAULT_SAFETY.scheduling_window_end_hour;
  
  // Random minute within the window for distribution (avoid all hitting at exactly 00:01)
  const randomHour = startHour + Math.floor(Math.random() * (endHour - startHour));
  const randomMinute = randomHour === 0 ? 1 + Math.floor(Math.random() * 59) : Math.floor(Math.random() * 60);
  
  // Check if we're currently within the window
  const currentHour = now.getUTCHours() - 3; // BRT = UTC-3
  const adjustedHour = currentHour < 0 ? currentHour + 24 : currentHour;
  
  const scheduleDate = new Date(now);
  
  if (adjustedHour >= startHour && adjustedHour < endHour) {
    // We're inside the window — schedule for NOW + small offset
    scheduleDate.setMinutes(scheduleDate.getMinutes() + 5);
  } else {
    // Outside window — schedule for next window start
    if (adjustedHour >= endHour) {
      // Past today's window, schedule for tomorrow
      scheduleDate.setDate(scheduleDate.getDate() + 1);
    }
    // Set to random time within 00:01-04:00 BRT (03:01-07:00 UTC)
    scheduleDate.setUTCHours(randomHour + 3, randomMinute, 0, 0);
  }
  
  return scheduleDate.toISOString();
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
        .eq("marketplace", "meta")
        .eq("is_active", true)
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

      // Fetch saved custom audiences per ad account
      const savedAudiences: Record<string, any[]> = {};
      for (const account of (campaigns || []).reduce((acc: string[], c: any) => {
        if (c.ad_account_id && !acc.includes(c.ad_account_id)) acc.push(c.ad_account_id);
        return acc;
      }, [] as string[])) {
        try {
          const accountId = account.replace("act_", "");
          const { data: metaConn } = await supabase
            .from("marketplace_connections")
            .select("access_token")
            .eq("tenant_id", tenantId)
            .eq("marketplace", "meta")
            .eq("is_active", true)
            .maybeSingle();
          
          if (metaConn?.access_token) {
            const audRes = await fetch(
              `https://graph.facebook.com/${sevenDaysAgo ? "v21.0" : "v21.0"}/act_${accountId}/customaudiences?fields=id,name,subtype,approximate_count,delivery_status&limit=50&access_token=${metaConn.access_token}`
            );
            const audData = await audRes.json();
            if (audData.data) {
              savedAudiences[account] = audData.data.map((a: any) => ({
                id: a.id,
                name: a.name,
                subtype: a.subtype,
                size: a.approximate_count,
                deliverable: a.delivery_status?.status === "ready",
              }));
            }
          }
        } catch (audErr: any) {
          console.log(`[ads-autopilot-analyze][${VERSION}] Audience fetch failed for ${account}:`, audErr.message);
        }
      }

      channelData.meta = { campaigns: campaigns || [], trend, campaignPerf, campaignAccountMap, savedAudiences, rawInsights7d: (insightsCurrent || []).length };
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

    // 1. Order comparison is INFO-ONLY (fallback signal, NOT a gate)
    // Orders may belong to another store or not be imported — platform metrics are the source of truth
    const adConversions = trend.total_conversions || 0;
    const realOrders = context.orderStats.paid_orders || 0;
    if (adConversions > 0 && realOrders > 0) {
      const discrepancyPct = Math.abs(adConversions - realOrders) / Math.max(adConversions, realOrders) * 100;
      indicators.attribution_discrepancy_pct = Math.round(discrepancyPct);
      indicators.attribution_note = "Pedidos internos são FALLBACK — podem não refletir esta loja. Métricas da plataforma são prioridade.";
      if (discrepancyPct > 50) {
        alerts.push(`ℹ️ Info: Discrepância ${Math.round(discrepancyPct)}% entre conversões da plataforma (${adConversions}) e pedidos internos (${realOrders}). Pedidos podem não estar atualizados.`);
        // NOT setting status to critical — this is informational only
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
  trackingHealth?: Record<string, any>,
  triggerType?: string
): { valid: boolean; reason?: string } {
  // FIRST ACTIVATION or MANUAL (chat orders): bypass data sufficiency, phase restrictions, and budget change limits
  // Manual triggers come from the Chat AI where the store owner explicitly requested the action
  const isFirstActivation = triggerType === "first_activation";
  const isManualTrigger = triggerType === "manual";
  const bypassDataCheck = isFirstActivation || isManualTrigger;
  
  // Kill switch — ALWAYS checked, even on first activation
  if (acctConfig.kill_switch) {
    return { valid: false, reason: `Kill Switch ATIVO para conta ${acctConfig.ad_account_id}. Todas as ações bloqueadas.` };
  }

  // Max actions per session (doubled for first activation to allow full restructuring)
  const maxActions = (isFirstActivation || isManualTrigger) ? DEFAULT_SAFETY.max_actions_per_session * 2 : DEFAULT_SAFETY.max_actions_per_session;
  if (sessionActionsCount >= maxActions) {
    return { valid: false, reason: `Limite de ${maxActions} ações por sessão atingido.` };
  }

  // Tracking health gate: ONLY block budget INCREASES for non-order-based degradation
  // Order discrepancy NEVER blocks ANY action
  const channelKey = acctConfig.channel;
  if (!bypassDataCheck && trackingHealth?.[channelKey]) {
    const health = trackingHealth[channelKey];
    const hasNonOrderIssues = health.alerts?.some((a: string) => !a.startsWith("ℹ️ Info:"));
    if (hasNonOrderIssues && (health.status === "critical" || health.status === "degraded") && action.name === "adjust_budget") {
      const args = typeof action.arguments === "string" ? JSON.parse(action.arguments) : action.arguments;
      if ((args.change_pct || 0) > 0) {
        return { valid: false, reason: `Tracking ${health.status}: escala de budget bloqueada. Corrija o tracking primeiro.` };
      }
    }
  }

  // Check if action type is allowed — first activation and manual allow ALL actions
  if (!bypassDataCheck && !DEFAULT_SAFETY.allowed_actions.includes(action.name)) {
    return { valid: false, reason: `Ação '${action.name}' não habilitada.` };
  }

  // generate_creative is a PREPARATION action (no financial risk) — NEVER block by data sufficiency
  const isPreparationAction = action.name === "generate_creative";

  // Data sufficiency check — SKIP on first activation, manual trigger, or preparation actions
  if (!bypassDataCheck && !isPreparationAction && channelKey && context?.channels?.[channelKey]) {
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

    // Min data days check
    if (daysWithData < DEFAULT_SAFETY.min_data_days_for_action) {
      if (action.name !== "report_insight") {
        return {
          valid: false,
          reason: `Dados insuficientes (${daysWithData} dias). Mínimo: ${DEFAULT_SAFETY.min_data_days_for_action} dias.`,
        };
      }
    }
  }

  // Budget change limits — ALWAYS enforce per-campaign ceiling to protect learning phase
  if (action.name === "adjust_budget" && action.arguments) {
    const args = typeof action.arguments === "string" ? JSON.parse(action.arguments) : action.arguments;
    const changePct = args.change_pct || 0;
    const absChange = Math.abs(changePct);

    if (isFirstActivation || isManualTrigger) {
      // First activation: allow larger moves but STILL cap per campaign to protect learning
      const firstActivationMax = DEFAULT_SAFETY.first_activation_max_increase_pct; // 20%
      if (changePct > firstActivationMax) {
        return {
          valid: false,
          reason: `Aumento de ${changePct}% excede limite de +${firstActivationMax}% por campanha (proteção de Learning Phase). Redistribua o orçamento excedente criando novas campanhas (create_campaign).`,
        };
      }
      // Allow reductions freely on first activation (pausing/reducing is safe)
    } else {
      // Normal cycles: strict per-platform limits
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
          interests: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] }, description: "Interesses do Meta Ads (ex: [{id:'6003139266461',name:'Cosmetics'}]). Busque IDs válidos via Meta Targeting Search API." },
          age_min: { type: "number", description: "Idade mínima (default 18)" },
          age_max: { type: "number", description: "Idade máxima (default 65)" },
          genders: { type: "array", items: { type: "number" }, description: "1=Male, 2=Female. Omitir = todos." },
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
      description: "Cria novo conjunto de anúncios dentro de campanha existente. Pode usar custom_audience_id (público salvo), interests (interesses), ou targeting broad.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "ID da campanha existente" },
          adset_name: { type: "string", description: "Nome do ad set" },
          daily_budget_cents: { type: "number", description: "Orçamento diário em centavos" },
          targeting_description: { type: "string", description: "Descrição do targeting" },
          audience_type: { type: "string", enum: ["cold", "warm", "hot"], description: "Tipo de audiência" },
          custom_audience_id: { type: "string", description: "ID da custom audience salva da Meta (se disponível)" },
          interests: { type: "array", items: { type: "object", properties: { id: { type: "string" }, name: { type: "string" } }, required: ["id", "name"] }, description: "Interesses do Meta Ads para targeting detalhado" },
          age_min: { type: "number", description: "Idade mínima (default 18)" },
          age_max: { type: "number", description: "Idade máxima (default 65)" },
          genders: { type: "array", items: { type: "number" }, description: "1=Male, 2=Female" },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["campaign_id", "adset_name", "daily_budget_cents", "targeting_description", "audience_type", "reason", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_creative",
      description: "Gera criativos publicitários (imagem + copy) para uma campanha. Use quando não há criativos existentes na conta ou quando quer testar novos ângulos. Retorna um job_id que será processado assincronamente.",
      parameters: {
        type: "object",
        properties: {
          campaign_id: { type: "string", description: "ID da campanha destino (opcional)" },
          product_name: { type: "string", description: "Nome do produto para o criativo" },
          campaign_objective: { type: "string", enum: ["sales", "traffic", "awareness", "leads"] },
          target_audience: { type: "string", description: "Descrição do público-alvo" },
          style_preference: { type: "string", enum: ["promotional", "product_natural", "person_interacting"], description: "Estilo visual" },
          funnel_stage: { type: "string", enum: ["tof", "mof", "bof", "test", "leads"], description: "Estágio do funil para o criativo. TOF não serve para BOF e vice-versa." },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["product_name", "campaign_objective", "reason", "confidence"],
        additionalProperties: false,
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_lookalike_audience",
      description: "Cria um público Lookalike na Meta a partir de uma Custom Audience fonte (ex: compradores, visitantes). O público leva ~1h para ficar pronto. Use quando não houver Lookalikes disponíveis e a conta tiver Custom Audiences com dados suficientes.",
      parameters: {
        type: "object",
        properties: {
          source_audience_id: { type: "string", description: "ID da Custom Audience fonte (ex: compradores, visitantes do site)" },
          source_audience_name: { type: "string", description: "Nome do público fonte para referência" },
          lookalike_name: { type: "string", description: "Nome do novo Lookalike. Padrão: [AI] LAL - {fonte} - {%}" },
          ratio: { type: "number", description: "Tamanho do Lookalike (0.01 a 0.20). 0.01=1% mais similar, 0.10=10%. Recomendado: 0.01-0.05 para BOF, 0.05-0.10 para MOF, 0.10-0.20 para TOF." },
          country: { type: "string", description: "Código do país. Default: BR" },
          reason: { type: "string" },
          confidence: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["source_audience_id", "source_audience_name", "lookalike_name", "ratio", "reason", "confidence"],
        additionalProperties: false,
      },
    },
  },
];

// ============ SYSTEM PROMPT (v4 - Per-Account) ============

function buildAccountPlannerPrompt(acctConfig: AccountConfig, context: any, triggerType?: string) {
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
    // UI saves keys as: cold, remarketing, tests, leads
    funnelSection = `
## SPLITS DE FUNIL (definidos pelo lojista — OBRIGATÓRIO respeitar)
- Público Frio (Prospecção/TOF): ${splits.cold || 0}%
- Remarketing (Público Quente/MOF+BOF): ${splits.remarketing || 0}%
- Testes de Criativos: ${splits.tests || 0}%
- Leads/Captação: ${splits.leads || 0}%
⚠️ Distribua o orçamento desta conta respeitando estes percentuais EXATOS.
⚠️ Se "Testes de Criativos" > 0%, você DEVE criar campanhas de teste com criativos novos.`;
  } else {
    funnelSection = `
## SPLITS DE FUNIL
A IA decide a distribuição ideal entre Frio/Remarketing/Testes com base nos dados.`;
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
  // ROAS scaling threshold (single value)
  const roasScalingThreshold = acctConfig.roas_scale_up_threshold || null;

  let scalingSection = "";
  if (roasScalingThreshold) {
    scalingSection = `
## 📊 REGRAS DE ESCALONAMENTO DE ORÇAMENTO POR ROAS
- ROAS ALVO DE ESCALONAMENTO: ${roasScalingThreshold}x
- ROAS >= ${roasScalingThreshold}x → AUMENTAR orçamento (via adjust_budget). Percentual definido pelos limites da plataforma.
- ROAS < ${roasScalingThreshold}x (mas acima do mínimo de pausa) → REDUZIR orçamento (via adjust_budget). Percentual definido pelos limites da plataforma.
- Limites por plataforma: Meta ±10%/ciclo, Google ±15%/ciclo, TikTok ±7%/ciclo.
- Hierarquia de decisão: PAUSA (min_roi) > REDUÇÃO (abaixo do threshold) > MANUTENÇÃO > AUMENTO (acima do threshold)
- Ajustes de orçamento são agendados para 00:01 BRT (nunca imediatos).`;
  }

  const platformRules: Record<string, string> = {
    meta: `
### META ADS — REGRAS
- Learning Phase: ~50 eventos em 7d para estabilizar. NÃO editar durante.
- Budget: Máx ±10% por ciclo de 6h (respeitar ±20% em 48h).
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
- ROI MÍN. PÚBLICO FRIO: ${minRoiCold}x (abaixo disso → regras de pausa abaixo)
- ROI MÍN. PÚBLICO QUENTE: ${minRoiWarm}x (abaixo disso → regras de pausa abaixo)

## 🛑 REGRAS DE PAUSA (TIMING OBRIGATÓRIO)
- **PAUSA RÁPIDA (3 dias):** Se o ROI nos últimos 3 dias for < 50% do mínimo configurado (Frio < ${(minRoiCold * 0.5).toFixed(1)}x OU Quente < ${(minRoiWarm * 0.5).toFixed(1)}x) → PAUSAR IMEDIATAMENTE (performance crítica).
- **PAUSA NORMAL (7 dias):** Se o ROI nos últimos 7 dias for < mínimo configurado (Frio < ${minRoiCold}x OU Quente < ${minRoiWarm}x) → PAUSAR (performance ruim sustentada).
- **CICLO DE RECUPERAÇÃO:** Após 7 dias pausada, a campanha deve ser REATIVADA automaticamente para testar novamente.
- **PAUSA INDETERMINADA:** Se após a reativação a campanha atingir novamente os critérios de pausa (3d ou 7d acima) → PAUSA INDETERMINADA (não tentar mais).
- Use o campo metric_trigger para indicar: "pause_3d_critical", "pause_7d_normal", "recovery_reactivation" ou "pause_indefinite".

${funnelSection}

${scalingSection}

${acctConfig.user_instructions ? `## INSTRUÇÕES DO LOJISTA (SUGESTIVAS — NÃO SOBREPÕEM CONFIGS MANUAIS)
⚠️ As instruções abaixo são SUGESTIVAS e servem para dar contexto e direcionamento à IA.
Se houver CONFLITO entre estas instruções e as configurações manuais acima (ROI, orçamento, estratégia, splits), as CONFIGURAÇÕES MANUAIS SEMPRE PREVALECEM.
${acctConfig.user_instructions}` : ""}

${trendSection}

${platformRules[acctConfig.channel] || ""}

## PRIORIDADE DE MÉTRICAS (REGRA ABSOLUTA)
- **PRIORIDADE 1 (ÚNICA FONTE DE DECISÃO)**: Use ROAS, conversões, CPA e CTR reportados pela PRÓPRIA plataforma de anúncios (Meta/Google/TikTok). Estas são as ÚNICAS métricas válidas para tomar decisões.
- **FALLBACK / INFORMACIONAL**: Pedidos internos da loja são dados COMPLEMENTARES OPCIONAIS. Podem pertencer a outra loja, não estarem importados, ou estarem desatualizados. Use APENAS para cálculo de ROI real quando disponíveis.
- NUNCA bloqueie, pause ou atrase ações por discrepância entre conversões da plataforma e pedidos internos.
- Se a plataforma reporta conversões mas não há pedidos internos correspondentes, PROSSIGA normalmente com base nas métricas da plataforma.

## TICKET MÉDIO (referência informacional): R$ ${(context.orderStats.avg_ticket_cents / 100).toFixed(2)}
## PEDIDOS INTERNOS (30d, apenas referência): ${context.orderStats.paid_orders} pagos, ${context.orderStats.cancellation_rate_pct}% cancelados

## 💰 REGRA DE ORÇAMENTO OBRIGATÓRIA
O orçamento definido pelo lojista (${budgetStr}/${acctConfig.budget_mode === "daily" ? "dia" : "mês"}) é INVIOLÁVEL:
- Se você pausar campanhas que gastavam R$ Y/dia, você DEVE redistribuir esse R$ Y para outras campanhas ativas ou criar novas campanhas para absorver esse orçamento.
- O investimento diário/mensal definido NÃO PODE ser reduzido nem por um único dia.
- Ao pausar: calcule o gasto diário das campanhas pausadas e redistribua via adjust_budget nas campanhas vencedoras ou via create_campaign se necessário.
- Se não houver campanhas vencedoras suficientes para absorver, crie novas campanhas com o orçamento restante.

## 🧠 PLANEJAMENTO ESTRATÉGICO OBRIGATÓRIO
Antes de executar qualquer ação, PLANEJE UMA ESTRATÉGIA COMPLETA:
1. **Diagnóstico**: Analise todas as campanhas ativas, identifique vencedoras e perdedoras
2. **Redistribuição**: Calcule quanto orçamento está desperdiçado e quanto precisa ser realocado
3. **Criação**: Se o orçamento definido (${budgetStr}) não está sendo investido ou há espaço para novos testes:
   - Defina quais campanhas criar (objetivo, público, funil)
   - Distribua o orçamento de forma estratégica entre as campanhas
   - Crie públicos (Lookalikes) quando necessário
   - Gere criativos quando não houver disponíveis
4. **Execução**: Execute o plano de forma ordenada: pausas → redistribuições → criações
5. **O orçamento TOTAL definido DEVE estar sempre investido** — nunca deixe verba ociosa

## CICLO
- Roda a cada 6h. Ações graduais.
- Máx ${DEFAULT_SAFETY.max_actions_per_session} ações/sessão.
- Se dados < ${DEFAULT_SAFETY.min_data_days_for_action} dias → APENAS report_insight.
- NUNCA deletar — apenas pausar.
- Toda ação COM justificativa numérica.
- Diferencie público frio de quente.
- Campanhas em Learning Phase → APENAS report_insight.

## FORMATO DE INSIGHTS (OBRIGATÓRIO)
Insights devem ser CURTOS e em linguagem SIMPLES (para dono de loja, NÃO engenheiro).
- Máximo 4 frases no "summary"
- Sem IDs de campanha (use o NOME da campanha)
- Sem percentuais com mais de 1 casa decimal
- Linguagem direta: "A campanha X gastou R$ Y sem vender" em vez de "Campaign ID 120... apresentou ROAS de 0.00x"
- Para "recommendations": máximo 3 itens, cada um com 1 frase de ação clara
- Valores monetários SEMPRE em R$ (ex: "R$ 150,00" não "15000 cents")

## ⏰ JANELA DE PUBLICAÇÃO E AJUSTES (00:01 - 04:00 BRT)
- TODAS as novas campanhas e ajustes de orçamento são AGENDADOS para a janela 00:01-04:00 BRT
- Campanhas novas são criadas com status PAUSED e ativadas automaticamente na janela
- Ajustes de orçamento (increases/decreases) são aplicados automaticamente na janela
- Esta regra existe para respeitar o início do dia fiscal das plataformas de anúncios
- Você NÃO precisa se preocupar com o agendamento — o sistema faz automaticamente
- PAUSAS de campanhas são executadas IMEDIATAMENTE (não são agendadas)

${triggerType === "first_activation" ? `
## 🚀 PRIMEIRA ATIVAÇÃO — ACESSO TOTAL A TODAS AS FASES
Esta é a PRIMEIRA VEZ que a IA está sendo ativada nesta conta. Você tem ACESSO TOTAL a TODAS as ferramentas (Fases 1, 2 e 3), sem restrições de fase, dias mínimos de dados ou contagem mínima de conversões. Seu objetivo é "colocar a casa em ordem" COMPLETAMENTE:

1. Analise TODAS as campanhas dos últimos 7 dias em profundidade
2. Pause campanhas com métricas ruins (ROAS < mínimo, CPA muito alto)
3. **OBRIGATÓRIO**: Para cada campanha pausada, calcule o gasto diário economizado
4. **OBRIGATÓRIO**: Redistribua TODO o orçamento economizado para campanhas vencedoras via adjust_budget
5. Se não houver campanhas vencedoras suficientes, CRIE novas campanhas (create_campaign) para absorver o orçamento
6. O orçamento total definido (${budgetStr}) DEVE ser mantido integralmente — NÃO é aceitável economizar
7. Gere insights completos sobre o estado atual da conta
8. Redistribua orçamento conforme splits de funil definidos

⚠️ REGRA CRÍTICA: Se você pausou campanhas que gastavam R$ X/dia, a soma dos adjust_budget + create_campaign DEVE cobrir esses R$ X/dia. Não deixe orçamento ocioso.

⚠️ LIMITE DE ESCALA POR CAMPANHA: Mesmo na primeira ativação, cada campanha ativa só pode receber no MÁXIMO +${DEFAULT_SAFETY.first_activation_max_increase_pct}% de aumento de budget (proteção de Learning Phase). Se o orçamento economizado NÃO CABE dentro desse limite nas campanhas existentes, você É OBRIGADO a criar novas campanhas (create_campaign) para absorver o excedente. Exemplo: se economizou R$ 300/dia e as 2 campanhas ativas só absorvem +R$ 40/dia cada (20% de R$ 200), crie campanhas novas para os R$ 220 restantes.

Aja como se estivesse assumindo a gestão da conta pela primeira vez — seja COMPLETO e DECISIVO.
` : ""}

## FASE 2 — CRIAÇÃO (disponível se dados suficientes)
Se esta conta tem 7+ dias de dados E 10+ conversões, você PODE usar:
- create_campaign: Criar nova campanha COMPLETA (campanha + ad set + ad) com naming [AI] {objetivo} - {produto/público} - {data}
  - Templates: cold_conversion (TOF), remarketing (BOF), creative_test, leads
  - Budget inicial respeitando splits de funil
  - Máximo ${DEFAULT_SAFETY.max_new_campaigns_per_day} novas campanhas por sessão
  - O sistema cria automaticamente: campanha → ad set (com público) → ad (com criativo)
  - PRIORIDADE DE PÚBLICO: 1) Custom Audiences salvas 2) Interesses específicos 3) Broad (último recurso)
  - Use o campo "interests" para definir interesses específicos: [{id:"6003139266461",name:"Cosmetics"}]
  - Use age_min/age_max/genders para refinar demografia quando relevante
- create_adset: Criar novo ad set em campanha existente
  - Se houver custom_audience_id disponível, USE-O
  - Se não, use interests para targeting detalhado
  - Budget proporcional ao tamanho do público
- generate_creative: Gerar criativos para campanhas sem anúncios ou para testes
  - Use quando não houver criativos existentes
  - Priorize gerar para os TOP produtos por receita
- create_lookalike_audience: Criar público Lookalike a partir de um público fonte
  - Use quando a conta tem Custom Audiences (compradores, visitantes) mas NÃO tem Lookalikes
  - Ratio: 0.01 (1%) para BOF, 0.05 para MOF, 0.10-0.20 para TOF
  - O público leva ~1h para ficar pronto. Crie e use em sessões futuras.

## REGRAS DE TARGETING (OBRIGATÓRIAS)
- Para TOF (público frio): Prefira Lookalikes > Interesses amplos > Broad
- Para MOF (público morno): Prefira Engagers/Visitantes > Lookalikes pequenos > Interesses nichados
- Para BOF (público quente): Prefira Custom Audiences (compradores, carrinho) > Visitantes recentes
- Se não existem Lookalikes mas existem Custom Audiences com 1000+ registros, USE create_lookalike_audience
- Interesses são ideais para TESTES: crie ad sets com interesses diferentes para descobrir segmentos vencedores
- IDs de interesses válidos: consulte a seção INTERESSES DISPONÍVEIS abaixo (se fornecida)

## FASE 3 — CRIATIVOS AUTOMÁTICOS
Quando uma campanha é criada mas não há creative_id na conta, o sistema gera automaticamente via IA.
Quando você usa generate_creative, o job é assíncrono — os criativos aparecerão na conta em minutos.

Se dados insuficientes para criação, use report_insight para RECOMENDAR a criação.

## REGRAS DE CRIATIVOS (OBRIGATÓRIO — v5.11.0)
- Campanhas de TESTE DEVEM usar criativos NOVOS gerados nesta sessão (mesmo session_id).
- NUNCA crie campanha sem definir qual criativo será usado.
- Se não houver criativos prontos, use generate_creative PRIMEIRO e NÃO chame create_campaign no mesmo ciclo.
- Cada campanha DEVE usar um criativo DIFERENTE (unicidade por sessão — sem repetir creative_id).
- Criativos de TOF não servem para BOF e vice-versa. Respeite o funnel_stage.
- Identifique o funil de cada campanha existente antes de tomar decisões.

## REGRA DE PRODUTO POR FUNIL (OBRIGATÓRIO — GENÉRICO, SEM HARDCODE DE LOJA)
- TOF (Público Frio): Use SEMPRE o produto de MENOR preço (entrada/experimentação). Kits e bundles são para remarketing. NUNCA use kit/bundle caro em campanha de TOF.
- BOF/MOF/Remarketing: Priorize kits e bundles de maior ticket.
- Testes: Use o produto que a estratégia definir.
- A seleção é automática pelo sistema baseada em preço. Não hardcode nenhum nome de produto ou marca.

Analise as campanhas DESTA CONTA e execute.`;
}

// ============ SCHEDULED ACTION EXECUTOR (00:01-04:00 BRT Window) ============

async function executeScheduledActions(supabase: any, tenantId: string): Promise<number> {
  const now = new Date().toISOString();
  
  // Find ALL scheduled actions whose time has come (budget adjustments + campaign activations)
  const { data: scheduledActions } = await supabase
    .from("ads_autopilot_actions")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "scheduled")
    .in("action_type", ["adjust_budget", "activate_campaign"]);

  if (!scheduledActions || scheduledActions.length === 0) return 0;

  let executed = 0;
  for (const action of scheduledActions) {
    const scheduledFor = action.action_data?.scheduled_for;
    if (!scheduledFor || new Date(scheduledFor) > new Date(now)) continue;

    const channel = action.channel;
    const edgeFn = channel === "meta" ? "meta-ads-campaigns" : channel === "google" ? "google-ads-campaigns" : "tiktok-ads-campaigns";
    const idField = channel === "meta" ? "meta_campaign_id" : channel === "google" ? "google_campaign_id" : "tiktok_campaign_id";

    try {
      if (action.action_type === "adjust_budget") {
        const budgetField = channel === "meta" ? "daily_budget_cents" : "budget_cents";
        const campaignId = action.action_data?.campaign_id;
        const newBudget = action.action_data?.new_budget_cents;
        if (!campaignId || !newBudget) continue;

        const { error } = await supabase.functions.invoke(edgeFn, {
          body: { tenant_id: tenantId, action: "update", [idField]: campaignId, [budgetField]: newBudget },
        });
        if (error) throw error;
        console.log(`[ads-autopilot-analyze][${VERSION}] Scheduled budget executed for campaign ${campaignId}`);
      } else if (action.action_type === "activate_campaign") {
        const campaignId = action.action_data?.campaign_id;
        if (!campaignId) continue;

        // Activate campaign
        const { error: campErr } = await supabase.functions.invoke(edgeFn, {
          body: { tenant_id: tenantId, action: "update", [idField]: campaignId, status: "ACTIVE" },
        });
        if (campErr) throw campErr;
        console.log(`[ads-autopilot-analyze][${VERSION}] Campaign ${campaignId} activated (scheduled)`);

        // Also activate associated adset if present
        const adsetId = action.action_data?.adset_id;
        if (adsetId && channel === "meta") {
          try {
            await supabase.functions.invoke("meta-ads-adsets", {
              body: { tenant_id: tenantId, action: "update", meta_adset_id: adsetId, status: "ACTIVE" },
            });
            console.log(`[ads-autopilot-analyze][${VERSION}] Adset ${adsetId} activated (scheduled)`);
          } catch (adsetErr: any) {
            console.error(`[ads-autopilot-analyze][${VERSION}] Adset activation failed:`, adsetErr.message);
          }
        }
      }

      await supabase.from("ads_autopilot_actions")
        .update({ status: "executed", executed_at: now })
        .eq("id", action.id);
      executed++;
    } catch (err: any) {
      await supabase.from("ads_autopilot_actions")
        .update({ status: "failed", error_message: err.message || "Scheduled execution failed" })
        .eq("id", action.id);
      console.error(`[ads-autopilot-analyze][${VERSION}] Scheduled action failed (${action.action_type}):`, err.message);
    }
  }
  return executed;
}

// ============ MAIN HANDLER ============

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[ads-autopilot-analyze][${VERSION}] Request received`);

  try {
    const { tenant_id, trigger_type = "manual", target_account_id, target_channel } = await req.json();
    if (!tenant_id) return fail("tenant_id é obrigatório");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const startTime = Date.now();

    // ---- Load global config (used only for session locking, not as gate) ----
    const { data: configs } = await supabase
      .from("ads_autopilot_configs")
      .select("*")
      .eq("tenant_id", tenant_id);

    const globalConfig = configs?.find((c: any) => c.channel === "global") as GlobalConfig | undefined;
    // Note: global is_enabled is no longer required. Per-account configs control activation.

    // ---- Load per-account configs (v4) ----
    const { data: accountConfigs } = await supabase
      .from("ads_autopilot_account_configs")
      .select("*")
      .eq("tenant_id", tenant_id);

    let activeAccounts = (accountConfigs || []).filter(
      (ac: any) => ac.is_ai_enabled && !ac.kill_switch
    ) as AccountConfig[];

    // First activation: only analyze the specific account
    if (trigger_type === "first_activation" && target_account_id) {
      activeAccounts = activeAccounts.filter(
        (ac) => ac.ad_account_id === target_account_id && ac.channel === (target_channel || ac.channel)
      );
      console.log(`[ads-autopilot-analyze][${VERSION}] First activation for account ${target_account_id}`);
    }

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

    // ---- Lock (use global config row as mutex if it exists, otherwise skip locking) ----
    let sessionLockId: string | null = null;
    const newLockId = crypto.randomUUID();
    const lockExpiry = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    if (globalConfig) {
      // Fresh read of lock state to avoid stale data
      const { data: freshLock } = await supabase
        .from("ads_autopilot_configs")
        .select("lock_session_id, lock_expires_at")
        .eq("id", globalConfig.id)
        .single();
      const currentLock = freshLock?.lock_session_id;
      const currentExpiry = freshLock?.lock_expires_at;
      const lockIsFree = !currentLock || !currentExpiry || new Date(currentExpiry) < new Date();

      if (!lockIsFree) {
        return fail("Já existe uma análise em andamento. Aguarde.");
      }

      // Acquire lock
      const { error: lockError } = await supabase
        .from("ads_autopilot_configs")
        .update({ lock_session_id: newLockId, lock_expires_at: lockExpiry })
        .eq("id", globalConfig.id);

      if (lockError) {
        console.error(`[ads-autopilot-analyze][${VERSION}] Lock acquire error:`, lockError.message);
        return fail("Erro ao adquirir lock.");
      }
      sessionLockId = newLockId;
    } else {
      sessionLockId = newLockId;
    }

    try {
      // ---- Execute scheduled actions from previous cycles (budgets + campaign activations) ----
      const scheduledExecuted = await executeScheduledActions(supabase, tenant_id);
      if (scheduledExecuted > 0) {
        console.log(`[ads-autopilot-analyze][${VERSION}] Executed ${scheduledExecuted} scheduled actions (budgets + activations)`);
      }

      // ---- FIRST ACTIVATION: Fire-and-forget sync (don't block analysis) ----
      if (trigger_type === "first_activation") {
        const metaAccounts = runnableAccounts.filter(ac => ac.channel === "meta");
        if (metaAccounts.length > 0) {
          const syncAccountId = target_account_id || metaAccounts[0]?.ad_account_id;
          console.log(`[ads-autopilot-analyze][${VERSION}] First activation — triggering async sync for account ${syncAccountId} (fire-and-forget)`);
          // Fire-and-forget: trigger syncs without awaiting — they run in background
          // Analysis proceeds immediately with existing DB data
          supabase.functions.invoke("meta-ads-campaigns", {
            body: { tenant_id, action: "sync", ad_account_id: syncAccountId },
          }).catch((e: any) => console.log(`[ads-autopilot-analyze][${VERSION}] Async campaign sync error (non-blocking):`, e.message));
          
          supabase.functions.invoke("meta-ads-insights", {
            body: { tenant_id, action: "sync", date_preset: "last_7d", ad_account_id: syncAccountId },
          }).catch((e: any) => console.log(`[ads-autopilot-analyze][${VERSION}] Async insights sync error (non-blocking):`, e.message));
          
          supabase.functions.invoke("meta-ads-adsets", {
            body: { tenant_id, action: "sync", ad_account_id: syncAccountId },
          }).catch((e: any) => console.log(`[ads-autopilot-analyze][${VERSION}] Async adsets sync error (non-blocking):`, e.message));
        }
      }

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

      // ---- v5.11.0: Load persistent state from session ----
      const sessionRow = session!;
      let usedAssetIds = new Set<string>((sessionRow as any).used_asset_ids || []);
      let usedAdcreativeIds = new Set<string>((sessionRow as any).used_adcreative_ids || []);
      let mediaBlocked = (sessionRow as any).media_blocked === true;
      let mediaBlockReason = (sessionRow as any).media_block_reason || null;
      let strategyRunId = (sessionRow as any).strategy_run_id || null;

      if (!strategyRunId) {
        strategyRunId = crypto.randomUUID();
        await supabase.from("ads_autopilot_sessions").update({ strategy_run_id: strategyRunId }).eq("id", sessionId);
      }
      console.log(`[ads-autopilot-analyze][${VERSION}] Session state: strategyRunId=${strategyRunId}, usedAssets=${usedAssetIds.size}, usedAdcreatives=${usedAdcreativeIds.size}, mediaBlocked=${mediaBlocked}`);

      // Helper: atomic append to used_asset_ids
      async function appendUsedAssetId(assetId: string) {
        usedAssetIds.add(assetId);
        await supabase.rpc("", {}).catch(() => {}); // no-op, use raw update
        await supabase.from("ads_autopilot_sessions").update({
          used_asset_ids: Array.from(usedAssetIds),
        }).eq("id", sessionId);
      }

      // Helper: atomic append to used_adcreative_ids
      async function appendUsedAdcreativeId(adcreativeId: string) {
        usedAdcreativeIds.add(adcreativeId);
        await supabase.from("ads_autopilot_sessions").update({
          used_adcreative_ids: Array.from(usedAdcreativeIds),
        }).eq("id", sessionId);
      }

      // Helper: persist media_blocked
      async function setMediaBlocked(reason: string) {
        mediaBlocked = true;
        mediaBlockReason = reason;
        await supabase.from("ads_autopilot_sessions").update({
          media_blocked: true,
          media_block_reason: reason,
        }).eq("id", sessionId);
      }

      // Helper: batch_index counter for idempotency
      const batchIndexCounters: Record<string, number> = {};
      function getNextBatchIndex(actionType: string, productId: string, funnelStage: string, template: string): number {
        const key = `${actionType}_${productId}_${funnelStage}_${template}`;
        batchIndexCounters[key] = (batchIndexCounters[key] || 0) + 1;
        return batchIndexCounters[key];
      }

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

          accountCampaignPerf = {};
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

        // v5.11.0: Enrich campaigns with funnel_classification
        for (const camp of accountCampaigns) {
          camp.funnel_classification = classifyCampaignFunnel(camp);
        }

        // Tracking health gate (v4.8): only restrict for non-order-based issues
        const channelHealth = trackingHealth[channel];
        const hasRealTrackingIssues = channelHealth?.alerts?.some((a: string) => !a.startsWith("ℹ️ Info:"));
        const isHealthDegraded = channelHealth && hasRealTrackingIssues && (channelHealth.status === "critical" || channelHealth.status === "degraded");

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
          { role: "system", content: buildAccountPlannerPrompt(acctConfig, context, trigger_type) + pacingContext + healthContext },
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
${JSON.stringify(context.orderStats)}${context.lowStockProducts.length > 0 ? `\n\n## ⚠️ PRODUTOS COM ESTOQUE BAIXO\n${context.lowStockProducts.map((p: any) => `- ${p.name}: ${p.stock_quantity} un.`).join("\n")}` : ""}${
  channel === "meta" && channelData.savedAudiences?.[acctConfig.ad_account_id]?.length > 0
    ? `\n\n## 🎯 PÚBLICOS SALVOS (Custom Audiences)\nUse custom_audience_id ao criar ad sets para targeting inteligente.\n${JSON.stringify(channelData.savedAudiences[acctConfig.ad_account_id], null, 2)}`
    : "\n\n## 🎯 PÚBLICOS: Nenhum público salvo encontrado. Use targeting broad (Brasil, 18-65)."
}`,
          },
        ];

        const aiModel = globalConfig?.ai_model || "openai/gpt-5.2";
        const plannerResponse = await callAI(plannerMessages, PLANNER_TOOLS, aiModel);
        const toolCalls = plannerResponse.choices?.[0]?.message?.tool_calls || [];
        const aiText = plannerResponse.choices?.[0]?.message?.content || "";

        for (const tc of toolCalls) {
          const args = typeof tc.function.arguments === "string" ? JSON.parse(tc.function.arguments) : tc.function.arguments;
          const validation = validateAction(
            { name: tc.function.name, arguments: args },
            acctConfig,
            context,
            totalActionsPlanned,
            trackingHealth,
            trigger_type
          );

          totalActionsPlanned++;

          if (tc.function.name === "report_insight") {
            // v5.11.2: Sanitize insight before saving
            let sanitizedSummary = (args.summary || "").replace(/\b120\d{12,}\b/g, "[campanha]").slice(0, 500);
            const sanitizedArgs = { ...args, summary: sanitizedSummary, account_id: acctConfig.ad_account_id };

            allInsights.push(sanitizedArgs);
            await supabase.from("ads_autopilot_actions").insert({
              tenant_id,
              session_id: sessionId,
              channel,
              action_type: "report_insight",
              action_data: { ...sanitizedArgs, ad_account_id: acctConfig.ad_account_id },
              reasoning: sanitizedSummary,
              status: "executed",
              action_hash: `${sessionId}_insight_${acctConfig.ad_account_id}_${totalActionsPlanned}`,
            });

            // Also insert into ads_autopilot_insights table for the Insights tab
            const insightTitle = args.kpi_analysis?.overall_trend === "improving"
              ? "📈 Conta em melhora"
              : args.kpi_analysis?.overall_trend === "declining"
              ? "📉 Conta em declínio"
              : "📊 Análise da conta";

            await supabase.from("ads_autopilot_insights").insert({
              tenant_id,
              channel,
              ad_account_id: acctConfig.ad_account_id,
              title: insightTitle + ` (${acctConfig.ad_account_id})`,
              body: sanitizedSummary,
              evidence: { kpi_analysis: args.kpi_analysis, risk_alerts: args.risk_alerts },
              recommended_action: { recommendations: args.recommendations },
              priority: args.risk_alerts?.length > 2 ? "high" : "medium",
              category: "analysis",
              sentiment: args.kpi_analysis?.overall_trend === "improving" ? "positive" : args.kpi_analysis?.overall_trend === "declining" ? "negative" : "neutral",
              status: "open",
            });
            console.log(`[ads-autopilot-analyze][${VERSION}] Insight saved to ads_autopilot_insights table`);

            totalActionsExecuted++;
            continue;
          }

          // Enrich action_data with campaign name for UI clarity
          const campaignId = args.campaign_id;
          let campaignName: string | undefined;
          if (campaignId && accountCampaigns) {
            const match = accountCampaigns.find((c: any) => 
              (c.meta_campaign_id === campaignId) || (c.google_campaign_id === campaignId) || (c.tiktok_campaign_id === campaignId)
            );
            campaignName = match?.name;
          }

          const actionRecord: any = {
            tenant_id,
            session_id: sessionId,
            channel,
            action_type: tc.function.name,
            action_data: { ...args, ad_account_id: acctConfig.ad_account_id, campaign_name: campaignName || null },
            reasoning: args.reason || args.reasoning || "",
            expected_impact: JSON.stringify(args.expected_impact || ""),
            confidence: String(args.confidence || "medium"),
            metric_trigger: args.metric_trigger || "",
            status: validation.valid ? "validated" : "rejected",
            rejection_reason: validation.reason || null,
            action_hash: `${strategyRunId}_${acctConfig.ad_account_id}_${tc.function.name}_${args.product_name || args.campaign_id || ''}_${args.funnel_stage || ''}_${args.template || ''}_${getNextBatchIndex(tc.function.name, args.product_name || args.campaign_id || '', args.funnel_stage || '', args.template || '')}`,
          };

          // Human approval mode check
          const isCreateAction = tc.function.name === "create_campaign" || tc.function.name === "create_adset" || tc.function.name === "generate_creative" || tc.function.name === "create_lookalike_audience";
          const isBigBudgetChange = tc.function.name === "adjust_budget" && Math.abs(args.change_pct || 0) > 20;
          const isHighImpact = isCreateAction || isBigBudgetChange;
          const needsApproval = validation.valid && (
            acctConfig.human_approval_mode === "all" ||
            (acctConfig.human_approval_mode === "approve_high_impact" && isHighImpact)
            // When mode is "auto", NOTHING needs approval — AI executes everything
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
                // Budget adjustments are SCHEDULED for 00:01-04:00 BRT window
                const scheduledFor = getNextSchedulingTime();

                actionRecord.rollback_data = {
                  previous_budget_cents: args.current_budget_cents,
                  rollback_plan: `Reverter para R$ ${((args.current_budget_cents || 0) / 100).toFixed(2)}`,
                };
                actionRecord.status = "scheduled";
                actionRecord.action_data = {
                  ...actionRecord.action_data,
                  scheduled_for: scheduledFor,
                  new_budget_cents: args.new_budget_cents,
                };
                console.log(`[ads-autopilot-analyze][${VERSION}] Budget adjustment scheduled for ${scheduledFor}`);
                totalActionsExecuted++;
              } else if (tc.function.name === "create_campaign") {
                // ===== v5.11.2: PIPELINE ORIENTADO A PROCESSO =====
                // Order: 1) Select product by funnel → 2) Find creative → 3) Persist artifacts → 4) Create campaign PAUSED → 5) Create adset PAUSED → 6) Create ad → 7) Validate → 8) Activate if auto
                const isAutoMode = acctConfig.human_approval_mode === "auto";
                const scheduledActivationTime = getNextSchedulingTime();
                const campaignFunnel = args.funnel_stage || "tof";
                
                // Step 1: Create campaign with native start_time
                const objectiveMap: Record<string, string> = {
                  conversions: "OUTCOME_SALES",
                  traffic: "OUTCOME_TRAFFIC",
                  awareness: "OUTCOME_AWARENESS",
                  leads: "OUTCOME_LEADS",
                };
                const metaObjective = objectiveMap[args.objective] || "OUTCOME_SALES";
                
                // Auto mode: ACTIVE + future start_time = "Scheduled" in Meta
                // Manual/approval mode: PAUSED (requires manual activation)
                const campaignCreateBody: any = {
                  tenant_id,
                  action: "create",
                  ad_account_id: acctConfig.ad_account_id,
                  name: args.campaign_name,
                  objective: metaObjective,
                  status: "PAUSED", // v5.11.2: ALWAYS create PAUSED first
                  daily_budget_cents: args.daily_budget_cents,
                  special_ad_categories: [],
                };
                
                // v5.11.2: No start_time at creation — will be set AFTER ad validation if auto mode
                
                const { data: createResult, error: createErr } = await supabase.functions.invoke("meta-ads-campaigns", {
                  body: campaignCreateBody,
                });

                if (createErr) throw createErr;
                if (createResult && !createResult.success) throw new Error(createResult.error || "Erro ao criar campanha");

                const newMetaCampaignId = createResult?.data?.meta_campaign_id;
                console.log(`[ads-autopilot-analyze][${VERSION}] Step 1/3: Campaign created: ${args.campaign_name} (${newMetaCampaignId}) status=${isAutoMode ? "ACTIVE (scheduled)" : "PAUSED"}, start_time=${isAutoMode ? scheduledActivationTime : "N/A"}`);

                // Step 2: Create ad set with SMART targeting (prefer saved audiences)
                let newMetaAdsetId: string | null = null;
                if (newMetaCampaignId) {
                  try {
                    const optimizationGoalMap: Record<string, string> = {
                      conversions: "OFFSITE_CONVERSIONS",
                      traffic: "LINK_CLICKS",
                      awareness: "REACH",
                      leads: "LEAD_GENERATION",
                    };
                    const billingEventMap: Record<string, string> = {
                      conversions: "IMPRESSIONS",
                      traffic: "IMPRESSIONS",
                      awareness: "IMPRESSIONS",
                      leads: "IMPRESSIONS",
                    };

                    // Build smart targeting: prefer saved custom audiences > interests > broad
                    let targeting: any = {
                      geo_locations: { countries: ["BR"] },
                      age_min: args.age_min || 18,
                      age_max: args.age_max || 65,
                    };
                    if (args.genders?.length > 0) targeting.genders = args.genders;

                    const accountAudiences = channelData.savedAudiences?.[acctConfig.ad_account_id] || [];
                    if (accountAudiences.length > 0) {
                      // Pick best audience based on funnel stage
                      let bestAudience: any = null;
                      const funnelStage = args.funnel_stage || "tof";
                      
                      if (funnelStage === "bof") {
                        // BOF: prefer purchasers, cart abandoners
                        bestAudience = accountAudiences.find((a: any) => 
                          a.deliverable && (a.subtype === "CUSTOM" || a.subtype === "WEBSITE" || a.name?.toLowerCase().includes("compra") || a.name?.toLowerCase().includes("carrinho"))
                        );
                      } else if (funnelStage === "mof") {
                        // MOF: prefer engagers, visitors
                        bestAudience = accountAudiences.find((a: any) => 
                          a.deliverable && (a.subtype === "ENGAGEMENT" || a.subtype === "WEBSITE" || a.name?.toLowerCase().includes("visita") || a.name?.toLowerCase().includes("engaj"))
                        );
                      } else {
                        // TOF: prefer lookalikes
                        bestAudience = accountAudiences.find((a: any) => 
                          a.deliverable && (a.subtype === "LOOKALIKE" || a.name?.toLowerCase().includes("lookalike") || a.name?.toLowerCase().includes("semelhante"))
                        );
                      }
                      
                      // Fallback: largest deliverable audience
                      if (!bestAudience) {
                        bestAudience = accountAudiences
                          .filter((a: any) => a.deliverable)
                          .sort((a: any, b: any) => (b.size || 0) - (a.size || 0))[0];
                      }

                      if (bestAudience) {
                        targeting.custom_audiences = [{ id: bestAudience.id }];
                        console.log(`[ads-autopilot-analyze][${VERSION}] Step 2: Using audience: ${bestAudience.name} (${bestAudience.id}, size: ${bestAudience.size})`);
                      }
                    }

                    // Fallback to interests if no custom audience selected and AI provided interests
                    if (!targeting.custom_audiences && args.interests?.length > 0) {
                      targeting.flexible_spec = [{ interests: args.interests }];
                      console.log(`[ads-autopilot-analyze][${VERSION}] Step 2: Using interest targeting: ${args.interests.map((i: any) => i.name).join(", ")}`);
                    }

                    const adsetName = args.campaign_name.replace("[AI]", "[AI] CJ -");

                    // Fetch pixel_id for promoted_object (required for OFFSITE_CONVERSIONS)
                    let pixelId: string | null = null;
                    const optimizationGoal = optimizationGoalMap[args.objective] || "OFFSITE_CONVERSIONS";
                    if (optimizationGoal === "OFFSITE_CONVERSIONS" || optimizationGoal === "LEAD_GENERATION") {
                      const { data: mktConfig } = await supabase
                        .from("marketing_integrations")
                        .select("meta_pixel_id")
                        .eq("tenant_id", tenant_id)
                        .maybeSingle();
                      pixelId = mktConfig?.meta_pixel_id || null;
                      console.log(`[ads-autopilot-analyze][${VERSION}] Step 2: pixel_id=${pixelId ? pixelId.substring(0, 8) + '...' : 'NOT_FOUND'}`);
                    }

                    // CBO mode: campaign has budget, so adset must NOT have its own budget
                    const adsetCreateBody: any = {
                      tenant_id,
                      action: "create",
                      ad_account_id: acctConfig.ad_account_id,
                      meta_campaign_id: newMetaCampaignId,
                      name: adsetName,
                      optimization_goal: optimizationGoal,
                      billing_event: billingEventMap[args.objective] || "IMPRESSIONS",
                      targeting,
                      status: "PAUSED", // v5.11.2: ALWAYS create PAUSED first
                    };
                    
                    // v5.11.2: No start_time at creation — will be set AFTER ad validation

                    // Add promoted_object for conversion/lead objectives
                    if (pixelId && (optimizationGoal === "OFFSITE_CONVERSIONS" || optimizationGoal === "LEAD_GENERATION")) {
                      adsetCreateBody.promoted_object = {
                        pixel_id: pixelId,
                        custom_event_type: optimizationGoal === "LEAD_GENERATION" ? "LEAD" : "PURCHASE",
                      };
                      console.log(`[ads-autopilot-analyze][${VERSION}] Step 2: promoted_object set with pixel ${pixelId.substring(0, 8)}...`);
                    } else if (optimizationGoal === "OFFSITE_CONVERSIONS" || optimizationGoal === "LEAD_GENERATION") {
                      console.error(`[ads-autopilot-analyze][${VERSION}] Step 2: WARNING - No pixel_id found, adset creation will likely fail`);
                    }
                    
                    const { data: adsetResult, error: adsetErr } = await supabase.functions.invoke("meta-ads-adsets", {
                      body: adsetCreateBody,
                    });

                    if (adsetErr) {
                      console.error(`[ads-autopilot-analyze][${VERSION}] Step 2/3 failed (adset):`, adsetErr.message);
                    } else if (adsetResult && !adsetResult.success) {
                      console.error(`[ads-autopilot-analyze][${VERSION}] Step 2/3 failed (adset):`, adsetResult.error);
                    } else {
                      newMetaAdsetId = adsetResult?.data?.meta_adset_id;
                      console.log(`[ads-autopilot-analyze][${VERSION}] Step 2/3: Adset created: ${adsetName} (${newMetaAdsetId}) status=${isAutoMode ? "ACTIVE (scheduled)" : "PAUSED"}`);
                    }
                  } catch (adsetExecErr: any) {
                    console.error(`[ads-autopilot-analyze][${VERSION}] Step 2/3 error:`, adsetExecErr.message);
                  }
                }

                // Step 3: Create ad — v5.11.0 DETERMINISTIC creative selection
                let newMetaAdId: string | null = null;
                let creativeJobId: string | null = null;
                let selectedAssetId: string | null = null;
                let selectedPlatformAdcreativeId: string | null = null;
                let graphValidationResult: string | null = null;
                let expectedImageHash: string | null = null;
                let expectedVideoId: string | null = null;

                if (newMetaAdsetId) {
                  try {
                    let bestCreativeId: string | null = null;
                    let usedAiAsset = false;

                    // v5.11.2: Product selection by funnel (generic, no hardcode)
                    const availableProducts = (context.products || []).filter((p: any) => p.price > 0);
                    let topProduct: any;
                    if (campaignFunnel === "tof" || campaignFunnel === "cold") {
                      topProduct = [...availableProducts].sort((a: any, b: any) => a.price - b.price)[0]; // cheapest = entry product
                    } else if (["bof", "mof", "remarketing"].includes(campaignFunnel)) {
                      topProduct = [...availableProducts].sort((a: any, b: any) => b.price - a.price)[0]; // most expensive = kits/bundles
                    } else {
                      topProduct = availableProducts[0];
                    }
                    if (!topProduct) topProduct = context.products?.[0]; // fallback
                    const compatibleStages = funnelStageCompatible(campaignFunnel);
                    const isCreativeTest = args.template === "creative_test" || (args.campaign_name || "").toLowerCase().includes("teste");

                    // === LEVEL 1: AI assets with status='ready' (needs upload) ===
                    if (!mediaBlocked && topProduct) {
                      let level1Query = supabase
                        .from("ads_creative_assets")
                        .select("id, asset_url, headline, copy_text, cta_type, product_id, funnel_stage, session_id")
                        .eq("tenant_id", tenant_id)
                        .eq("status", "ready")
                        .not("asset_url", "is", null)
                        .order("created_at", { ascending: false })
                        .limit(20);

                      // creative_test: require same session
                      if (isCreativeTest) {
                        level1Query = level1Query.eq("session_id", sessionId);
                      }

                      const { data: aiAssets } = await level1Query;

                      // Filter by product match, funnel compatibility, and NOT IN used_asset_ids
                      const matchingAssets = (aiAssets || []).filter((a: any) => {
                        if (usedAssetIds.has(a.id)) return false;
                        const productMatch = a.product_id === topProduct.id || !a.product_id;
                        const funnelMatch = !a.funnel_stage || compatibleStages.includes(a.funnel_stage);
                        return productMatch && funnelMatch;
                      });

                      const aiAsset = matchingAssets[0];

                      if (aiAsset?.asset_url) {
                        console.log(`[ads-autopilot-analyze][${VERSION}] Step 3 L1: Found ready asset ${aiAsset.id} for funnel=${campaignFunnel}`);
                        selectedAssetId = aiAsset.id;

                        try {
                          const { data: metaConnForCreative } = await supabase
                            .from("marketplace_connections")
                            .select("access_token, metadata")
                            .eq("tenant_id", tenant_id)
                            .eq("marketplace", "meta")
                            .eq("is_active", true)
                            .maybeSingle();

                          if (metaConnForCreative?.access_token) {
                            const accountIdClean = acctConfig.ad_account_id.replace("act_", "");

                            // Upload image to Meta
                            const imgUploadRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adimages`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ url: aiAsset.asset_url, access_token: metaConnForCreative.access_token }),
                            });
                            const imgUploadData = await imgUploadRes.json();

                            // Check for media upload error
                            if (imgUploadData?.error) {
                              const metaErrorCode = imgUploadData.error.code;
                              const metaSubcode = imgUploadData.error.error_subcode;
                              console.error(`[ads-autopilot-analyze][${VERSION}] Step 3 L1: Image upload FAILED: code=${metaErrorCode} subcode=${metaSubcode} msg=${imgUploadData.error.message}`);
                              await setMediaBlocked(`Upload failed: code=${metaErrorCode} subcode=${metaSubcode} - ${imgUploadData.error.message}`);
                            } else {
                              const imageHash = imgUploadData?.images?.[Object.keys(imgUploadData?.images || {})[0]]?.hash;

                              if (imageHash) {
                                expectedImageHash = imageHash;
                                console.log(`[ads-autopilot-analyze][${VERSION}] Step 3 L1: Image uploaded, hash=${imageHash}`);

                                // Build destination URL
                                const { data: tenantInfo } = await supabase.from("tenants").select("slug").eq("id", tenant_id).single();
                                const { data: tenantDomainInfo } = await supabase.from("tenant_domains").select("domain").eq("tenant_id", tenant_id).eq("type", "custom").eq("is_primary", true).maybeSingle();
                                const storeHost = tenantDomainInfo?.domain || (tenantInfo?.slug ? `${tenantInfo.slug}.shops.comandocentral.com.br` : null);
                                
                                let productSlug = topProduct.slug || topProduct.id;
                                if (!topProduct.slug) {
                                  const { data: prodData } = await supabase.from("products").select("slug").eq("id", topProduct.id).single();
                                  productSlug = prodData?.slug || topProduct.id;
                                }
                                const destinationUrl = storeHost ? `https://${storeHost}/produto/${productSlug}` : `https://comandocentral.com.br`;

                                const pages = metaConnForCreative.metadata?.assets?.pages || [];
                                const pageId = pages[0]?.id || null;

                                const creativeBody: any = {
                                  name: `[AI] ${topProduct.name} - ${new Date().toISOString().split("T")[0]}`,
                                  access_token: metaConnForCreative.access_token,
                                };
                                if (pageId) {
                                  creativeBody.object_story_spec = {
                                    page_id: pageId,
                                    link_data: {
                                      image_hash: imageHash,
                                      message: aiAsset.copy_text || `Conheça ${topProduct.name}!`,
                                      name: aiAsset.headline || topProduct.name,
                                      link: destinationUrl,
                                      call_to_action: { type: "SHOP_NOW", value: { link: destinationUrl } },
                                    },
                                  };
                                } else {
                                  creativeBody.image_hash = imageHash;
                                  creativeBody.title = aiAsset.headline || topProduct.name;
                                  creativeBody.body = aiAsset.copy_text || `Conheça ${topProduct.name}!`;
                                }

                                const creativeRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountIdClean}/adcreatives`, {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify(creativeBody),
                                });
                                const creativeData = await creativeRes.json();

                                if (creativeData.id) {
                                  bestCreativeId = creativeData.id;
                                  selectedPlatformAdcreativeId = creativeData.id;
                                  usedAiAsset = true;
                                  console.log(`[ads-autopilot-analyze][${VERSION}] Step 3 L1: AdCreative created: ${bestCreativeId}`);

                                  // v5.11.0: Save platform_adcreative_id + expected_image_hash
                                  await supabase.from("ads_creative_assets").update({
                                    status: "published",
                                    platform_adcreative_id: creativeData.id,
                                    platform_ad_id: creativeData.id, // backward compat
                                    expected_image_hash: imageHash,
                                    updated_at: new Date().toISOString(),
                                  }).eq("id", aiAsset.id);

                                  // Track in both lists
                                  await appendUsedAssetId(aiAsset.id);
                                  await appendUsedAdcreativeId(creativeData.id);
                                } else {
                                  console.error(`[ads-autopilot-analyze][${VERSION}] Step 3 L1: AdCreative creation failed:`, creativeData.error?.message);
                                }
                              } else {
                                console.error(`[ads-autopilot-analyze][${VERSION}] Step 3 L1: Image upload returned no hash`);
                                await setMediaBlocked(`Upload returned no hash: ${JSON.stringify(imgUploadData).substring(0, 200)}`);
                              }
                            }
                          }
                        } catch (aiCreativeErr: any) {
                          console.error(`[ads-autopilot-analyze][${VERSION}] Step 3 L1 error:`, aiCreativeErr.message);
                        }
                      }
                    } else if (mediaBlocked) {
                      console.log(`[ads-autopilot-analyze][${VERSION}] Step 3 L1: SKIPPED (media_blocked=${mediaBlocked}, reason=${mediaBlockReason})`);
                    }

                    // === LEVEL 2: Published assets (no upload needed, works with media_blocked) ===
                    if (!bestCreativeId && topProduct) {
                      const { data: publishedAssets } = await supabase
                        .from("ads_creative_assets")
                        .select("id, platform_adcreative_id, product_id, funnel_stage, session_id")
                        .eq("tenant_id", tenant_id)
                        .eq("status", "published")
                        .not("platform_adcreative_id", "is", null)
                        .order("created_at", { ascending: false })
                        .limit(20);

                      const matchingPublished = (publishedAssets || []).filter((a: any) => {
                        if (usedAdcreativeIds.has(a.platform_adcreative_id)) return false;
                        if (isCreativeTest && a.session_id !== sessionId) return false;
                        const productMatch = a.product_id === topProduct.id || !a.product_id;
                        const funnelMatch = !a.funnel_stage || compatibleStages.includes(a.funnel_stage);
                        return productMatch && funnelMatch;
                      });

                      if (matchingPublished[0]) {
                        bestCreativeId = matchingPublished[0].platform_adcreative_id;
                        selectedAssetId = matchingPublished[0].id;
                        selectedPlatformAdcreativeId = matchingPublished[0].platform_adcreative_id;
                        await appendUsedAdcreativeId(bestCreativeId!);
                        console.log(`[ads-autopilot-analyze][${VERSION}] Step 3 L2: Using published asset ${matchingPublished[0].id} adcreative=${bestCreativeId}`);
                      }
                    }

                    // === NO CREATIVE FOUND: pending_creatives (DO NOT CREATE CAMPAIGN) ===
                    if (!bestCreativeId) {
                      if (isCreativeTest) {
                        console.log(`[ads-autopilot-analyze][${VERSION}] Step 3: creative_test has no session assets → pending_creatives`);
                      } else if (mediaBlocked) {
                        console.log(`[ads-autopilot-analyze][${VERSION}] Step 3: media_blocked + no published assets → blocked_media_permission`);
                      } else {
                        // Trigger auto-generation for future use
                        console.log(`[ads-autopilot-analyze][${VERSION}] Step 3: No compatible creative → triggering generation + pending_creatives`);
                        if (topProduct) {
                          try {
                            const { data: creativeResult, error: creativeErr } = await supabase.functions.invoke("ads-autopilot-creative", {
                              body: {
                                tenant_id,
                                session_id: sessionId,
                                channel: "meta",
                                product_id: topProduct.id,
                                product_name: topProduct.name,
                                campaign_objective: args.objective,
                                target_audience: args.targeting_description,
                                style_preference: "promotional",
                                format: "1:1",
                                variations: 2,
                                funnel_stage: campaignFunnel,
                              },
                            });
                            if (creativeErr) {
                              console.error(`[ads-autopilot-analyze][${VERSION}] Creative generation failed:`, creativeErr.message);
                            } else if (creativeResult?.success === false) {
                              // v5.11.1: Check logical success (HTTP 200 but success=false)
                              console.error(`[ads-autopilot-analyze][${VERSION}] Creative logical failure: ${creativeResult?.error}`);
                              creativeJobId = null;
                            } else {
                              creativeJobId = creativeResult?.data?.job_id || null;
                              console.log(`[ads-autopilot-analyze][${VERSION}] Creative job started: ${creativeJobId}`);
                            }
                          } catch (creativeExecErr: any) {
                            console.error(`[ads-autopilot-analyze][${VERSION}] Creative generation error:`, creativeExecErr.message);
                          }
                        }
                      }
                    }

                    // === CREATE AD (only if we have a creative) ===
                    if (bestCreativeId && newMetaAdsetId) {
                      const adName = args.campaign_name.replace("[AI]", "[AI] Ad -");
                      const { data: adResult, error: adErr } = await supabase.functions.invoke("meta-ads-ads", {
                        body: {
                          tenant_id,
                          action: "create",
                          ad_account_id: acctConfig.ad_account_id,
                          meta_adset_id: newMetaAdsetId,
                          meta_campaign_id: newMetaCampaignId,
                          name: adName,
                          creative_id: bestCreativeId,
                          status: isAutoMode ? "ACTIVE" : "PAUSED",
                        },
                      });

                      if (adErr) {
                        console.error(`[ads-autopilot-analyze][${VERSION}] Step 3 Ad failed:`, adErr.message);
                      } else if (adResult && !adResult.success) {
                        console.error(`[ads-autopilot-analyze][${VERSION}] Step 3 Ad failed:`, adResult.error);
                      } else {
                        newMetaAdId = adResult?.data?.meta_ad_id;
                        console.log(`[ads-autopilot-analyze][${VERSION}] Step 3: Ad created: ${adName} (${newMetaAdId}) creative=${bestCreativeId} (AI=${usedAiAsset})`);
                      }

                      // === v5.11.0: Graph API validation ===
                      if (newMetaAdId) {
                        try {
                          const { data: metaConnValidation } = await supabase
                            .from("marketplace_connections")
                            .select("access_token")
                            .eq("tenant_id", tenant_id)
                            .eq("marketplace", "meta")
                            .eq("is_active", true)
                            .maybeSingle();

                          if (metaConnValidation?.access_token) {
                            const validationRes = await fetch(
                              `https://graph.facebook.com/v21.0/${newMetaAdId}?fields=id,status,creative{id,object_story_spec,image_hash}&access_token=${metaConnValidation.access_token}`
                            );
                            const validationData = await validationRes.json();

                            if (validationData.id) {
                              // Validate media matches expected
                              const returnedCreativeId = validationData.creative?.id;
                              const returnedImageHash = validationData.creative?.object_story_spec?.link_data?.image_hash || validationData.creative?.image_hash;
                              const returnedVideoId = validationData.creative?.object_story_spec?.video_data?.video_id;

                              let mediaValid = true;
                              if (expectedImageHash && returnedImageHash && returnedImageHash !== expectedImageHash) {
                                mediaValid = false;
                                console.error(`[ads-autopilot-analyze][${VERSION}] Graph validation: image_hash MISMATCH expected=${expectedImageHash} got=${returnedImageHash}`);
                              }
                              if (expectedVideoId && returnedVideoId && returnedVideoId !== expectedVideoId) {
                                mediaValid = false;
                                console.error(`[ads-autopilot-analyze][${VERSION}] Graph validation: video_id MISMATCH expected=${expectedVideoId} got=${returnedVideoId}`);
                              }

                              graphValidationResult = mediaValid ? "ok" : "media_mismatch";
                              console.log(`[ads-autopilot-analyze][${VERSION}] Graph validation: ad=${newMetaAdId} creative=${returnedCreativeId} result=${graphValidationResult}`);
                            } else {
                              graphValidationResult = "ad_not_found";
                              console.error(`[ads-autopilot-analyze][${VERSION}] Graph validation: ad ${newMetaAdId} not found in Meta`);
                            }
                          }
                        } catch (valErr: any) {
                          graphValidationResult = "validation_error";
                          console.error(`[ads-autopilot-analyze][${VERSION}] Graph validation error:`, valErr.message);
                        }
                      }
                    }
                  } catch (adExecErr: any) {
                    console.error(`[ads-autopilot-analyze][${VERSION}] Step 3 error:`, adExecErr.message);
                  }
                }

                // === v5.11.2: STRICT POST-CONDITIONS + ROLLBACK + ACTIVATE ===
                if (newMetaCampaignId && newMetaAdsetId && newMetaAdId && graphValidationResult !== "media_mismatch" && graphValidationResult !== "ad_not_found") {
                  actionRecord.status = "executed";
                  actionRecord.executed_at = new Date().toISOString();

                  // v5.11.2: ACTIVATE campaign+adset if auto mode (PAUSED-first → ACTIVE)
                  if (isAutoMode) {
                    try {
                      await supabase.functions.invoke("meta-ads-campaigns", {
                        body: { tenant_id, action: "update", meta_campaign_id: newMetaCampaignId, status: "ACTIVE", start_time: scheduledActivationTime },
                      });
                      await supabase.functions.invoke("meta-ads-adsets", {
                        body: { tenant_id, action: "update", meta_adset_id: newMetaAdsetId, status: "ACTIVE", start_time: scheduledActivationTime },
                      });
                      console.log(`[ads-autopilot-analyze][${VERSION}] Activated campaign+adset for ${scheduledActivationTime}`);
                    } catch (activateErr: any) {
                      console.error(`[ads-autopilot-analyze][${VERSION}] Activation failed (campaign stays PAUSED):`, activateErr.message);
                    }
                  }
                } else if (newMetaCampaignId && newMetaAdsetId && !newMetaAdId) {
                  actionRecord.status = mediaBlocked ? "blocked_media_permission" : "pending_creatives";
                  actionRecord.error_message = mediaBlocked 
                    ? `Media blocked: ${mediaBlockReason}` 
                    : `No compatible creative found for funnel=${campaignFunnel}. Creative job: ${creativeJobId || 'none'}`;

                  // v5.11.2: ROLLBACK — pause orphan campaign+adset
                  try {
                    await supabase.functions.invoke("meta-ads-campaigns", {
                      body: { tenant_id, action: "update", meta_campaign_id: newMetaCampaignId, status: "PAUSED" },
                    });
                    console.log(`[ads-autopilot-analyze][${VERSION}] Rollback: paused orphan campaign ${newMetaCampaignId}`);
                  } catch (rollbackErr: any) {
                    console.error(`[ads-autopilot-analyze][${VERSION}] Rollback failed:`, rollbackErr.message);
                  }
                  actionRecord.rollback_data = { paused_campaign_id: newMetaCampaignId, paused_adset_id: newMetaAdsetId, reason: "no_ad_created" };
                } else if (newMetaCampaignId && !newMetaAdsetId) {
                  actionRecord.status = "partial_failed";
                  actionRecord.error_message = "Campaign created but adset creation failed";
                  // Rollback orphan campaign
                  try {
                    await supabase.functions.invoke("meta-ads-campaigns", {
                      body: { tenant_id, action: "update", meta_campaign_id: newMetaCampaignId, status: "PAUSED" },
                    });
                  } catch {}
                  actionRecord.rollback_data = { paused_campaign_id: newMetaCampaignId, reason: "no_adset_created" };
                } else if (!newMetaCampaignId) {
                  actionRecord.status = "failed";
                  actionRecord.error_message = "Campaign creation failed";
                } else {
                  actionRecord.status = "partial_failed";
                  actionRecord.error_message = graphValidationResult === "media_mismatch" 
                    ? "Graph API validation: media mismatch" 
                    : "Graph API validation: ad not found";
                }

                // v5.11.2: config_snapshot for auditability
                const configSnapshot = {
                  budget_cents: acctConfig.budget_cents,
                  funnel_splits: acctConfig.funnel_splits,
                  strategy_mode: acctConfig.strategy_mode,
                  human_approval_mode: acctConfig.human_approval_mode,
                  kill_switch: acctConfig.kill_switch,
                };

                actionRecord.action_data = {
                  ...actionRecord.action_data,
                  meta_campaign_id: newMetaCampaignId,
                  meta_adset_id: newMetaAdsetId,
                  meta_ad_id: newMetaAdId,
                  creative_job_id: creativeJobId,
                  selected_asset_id: selectedAssetId,
                  selected_platform_adcreative_id: selectedPlatformAdcreativeId,
                  funnel_stage: campaignFunnel,
                  strategy_run_id: strategyRunId,
                  expected_image_hash: expectedImageHash,
                  expected_video_id: expectedVideoId,
                  graph_validation_result: graphValidationResult,
                  product_name: topProduct?.name || null,
                  product_id: topProduct?.id || null,
                  product_price: topProduct?.price || null,
                  created_status: "PAUSED_FIRST",
                  activated: actionRecord.status === "executed" && isAutoMode,
                  start_time: isAutoMode && actionRecord.status === "executed" ? scheduledActivationTime : null,
                  config_snapshot: configSnapshot,
                  chain_steps: {
                    campaign: !!newMetaCampaignId,
                    adset: !!newMetaAdsetId,
                    ad: !!newMetaAdId,
                    creative_generating: !!creativeJobId,
                    graph_validated: graphValidationResult === "ok",
                  },
                };

                // v5.11.2: Persist artifacts for this campaign
                const campaignKey = `${strategyRunId}:${acctConfig.ad_account_id}:${args.template || 'auto'}:${campaignFunnel}:${topProduct?.id || 'auto'}`;
                try {
                  // Strategy artifact
                  await supabase.from("ads_autopilot_artifacts").upsert({
                    tenant_id, ad_account_id: acctConfig.ad_account_id, session_id: sessionId, strategy_run_id: strategyRunId,
                    campaign_key: campaignKey, artifact_type: "strategy",
                    data: { objective: args.objective, funnel: campaignFunnel, product: topProduct?.name, template: args.template, budget_cents: args.daily_budget_cents, targeting_description: args.targeting_description },
                    status: "ready",
                  }, { onConflict: "tenant_id,campaign_key,artifact_type" });

                  // Copy artifact
                  await supabase.from("ads_autopilot_artifacts").upsert({
                    tenant_id, ad_account_id: acctConfig.ad_account_id, session_id: sessionId, strategy_run_id: strategyRunId,
                    campaign_key: campaignKey, artifact_type: "copy",
                    data: { campaign_name: args.campaign_name, headline: args.headline, primary_text: args.primary_text, cta: args.cta },
                    status: "ready",
                  }, { onConflict: "tenant_id,campaign_key,artifact_type" });

                  // Campaign plan artifact
                  await supabase.from("ads_autopilot_artifacts").upsert({
                    tenant_id, ad_account_id: acctConfig.ad_account_id, session_id: sessionId, strategy_run_id: strategyRunId,
                    campaign_key: campaignKey, artifact_type: "campaign_plan",
                    data: {
                      meta_campaign_id: newMetaCampaignId, meta_adset_id: newMetaAdsetId, meta_ad_id: newMetaAdId,
                      creative_id: selectedPlatformAdcreativeId, asset_id: selectedAssetId,
                      objective: args.objective, funnel: campaignFunnel, budget_cents: args.daily_budget_cents,
                      product: topProduct?.name, config_snapshot: configSnapshot,
                      status: actionRecord.status,
                    },
                    status: actionRecord.status === "executed" ? "ready" : "failed",
                  }, { onConflict: "tenant_id,campaign_key,artifact_type" });
                } catch (artifactErr: any) {
                  console.error(`[ads-autopilot-analyze][${VERSION}] Artifact save error:`, artifactErr.message);
                }

                console.log(`[ads-autopilot-analyze][${VERSION}] Full chain: campaign=${!!newMetaCampaignId} adset=${!!newMetaAdsetId} ad=${!!newMetaAdId} creative=${!!creativeJobId} status=${actionRecord.status} graph=${graphValidationResult} product=${topProduct?.name || 'none'} funnel=${campaignFunnel}`);
                console.log(`[ads-autopilot-analyze][${VERSION}] Full chain: campaign=${!!newMetaCampaignId} adset=${!!newMetaAdsetId} ad=${!!newMetaAdId} creative=${!!creativeJobId} status=${actionRecord.status} graph=${graphValidationResult}`);
                totalActionsExecuted++;
              } else if (tc.function.name === "create_adset") {
                // Standalone adset creation with smart audiences
                const isAutoMode = acctConfig.human_approval_mode === "auto";
                const entityStatus = isAutoMode ? "ACTIVE" : "PAUSED";
                
                // Build targeting with custom audience, interests, or broad
                let targeting: any = {
                  geo_locations: { countries: ["BR"] },
                  age_min: args.age_min || 18,
                  age_max: args.age_max || 65,
                };
                if (args.genders?.length > 0) targeting.genders = args.genders;
                if (args.custom_audience_id) {
                  targeting.custom_audiences = [{ id: args.custom_audience_id }];
                  console.log(`[ads-autopilot-analyze][${VERSION}] Using custom audience: ${args.custom_audience_id}`);
                } else if (args.interests?.length > 0) {
                  targeting.flexible_spec = [{ interests: args.interests }];
                  console.log(`[ads-autopilot-analyze][${VERSION}] Using interest targeting: ${args.interests.map((i: any) => i.name).join(", ")}`);
                }

                const { data: adsetResult, error: adsetErr } = await supabase.functions.invoke("meta-ads-adsets", {
                  body: {
                    tenant_id,
                    action: "create",
                    ad_account_id: acctConfig.ad_account_id,
                    meta_campaign_id: args.campaign_id,
                    name: args.adset_name,
                    daily_budget_cents: args.daily_budget_cents,
                    targeting,
                    status: "PAUSED", // Always PAUSED — follows parent campaign scheduling
                  },
                });

                if (adsetErr) throw adsetErr;
                if (adsetResult && !adsetResult.success) throw new Error(adsetResult.error || "Erro ao criar adset");

                actionRecord.status = "executed";
                actionRecord.executed_at = new Date().toISOString();
                actionRecord.action_data = {
                  ...actionRecord.action_data,
                  meta_adset_id: adsetResult?.data?.meta_adset_id || null,
                  created_status: entityStatus,
                  custom_audience_id: args.custom_audience_id || null,
                  interests: args.interests || null,
                };
                console.log(`[ads-autopilot-analyze][${VERSION}] Adset created: ${args.adset_name} (${adsetResult?.data?.meta_adset_id}) status=${entityStatus}`);
                totalActionsExecuted++;
              } else if (tc.function.name === "create_lookalike_audience") {
                // Create Lookalike Audience via Meta API
                try {
                  const metaConn = await supabase
                    .from("marketplace_connections")
                    .select("access_token")
                    .eq("tenant_id", tenant_id)
                    .eq("marketplace", "meta")
                    .eq("is_active", true)
                    .maybeSingle();

                  if (!metaConn?.data?.access_token) throw new Error("Meta não conectada");

                  const accountId = acctConfig.ad_account_id.replace("act_", "");
                  const lalBody = {
                    name: args.lookalike_name,
                    subtype: "LOOKALIKE",
                    origin_audience_id: args.source_audience_id,
                    lookalike_spec: JSON.stringify({
                      type: "similarity",
                      ratio: args.ratio || 0.05,
                      country: args.country || "BR",
                    }),
                    access_token: metaConn.data.access_token,
                  };

                  const lalRes = await fetch(`https://graph.facebook.com/v21.0/act_${accountId}/customaudiences`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(lalBody),
                  });
                  const lalResult = await lalRes.json();

                  if (lalResult.error) throw new Error(lalResult.error.message);

                  // Save to local cache
                  await supabase.from("meta_ad_audiences").upsert({
                    tenant_id: tenant_id,
                    meta_audience_id: lalResult.id,
                    ad_account_id: acctConfig.ad_account_id,
                    name: args.lookalike_name,
                    audience_type: "lookalike",
                    subtype: "LOOKALIKE",
                    description: `LAL ${(args.ratio * 100).toFixed(0)}% de ${args.source_audience_name}`,
                    lookalike_spec: { ratio: args.ratio, country: args.country || "BR", source: args.source_audience_id },
                    synced_at: new Date().toISOString(),
                  }, { onConflict: "tenant_id,meta_audience_id" });

                  actionRecord.status = "executed";
                  actionRecord.executed_at = new Date().toISOString();
                  actionRecord.action_data = {
                    ...actionRecord.action_data,
                    lookalike_audience_id: lalResult.id,
                    source_audience_id: args.source_audience_id,
                    ratio: args.ratio,
                  };
                  console.log(`[ads-autopilot-analyze][${VERSION}] Lookalike created: ${args.lookalike_name} (${lalResult.id}) ratio=${args.ratio}`);
                } catch (lalErr: any) {
                  actionRecord.status = "failed";
                  actionRecord.error_message = lalErr.message || "Erro ao criar Lookalike";
                  console.error(`[ads-autopilot-analyze][${VERSION}] Lookalike creation failed:`, lalErr.message);
                }
                totalActionsExecuted++;
              } else if (tc.function.name === "generate_creative") {
                // Phase 3: Creative generation — v5.11.2: funnel-based product selection
                const gcFunnel = args.funnel_stage || "tof";
                const gcAvailable = (context.products || []).filter((p: any) => p.price > 0);
                let topProduct: any;
                // Try exact name match first (from AI), then funnel-based selection
                if (args.product_name) {
                  topProduct = context.products?.find((p: any) => p.name === args.product_name);
                }
                if (!topProduct) {
                  if (gcFunnel === "tof" || gcFunnel === "cold") {
                    topProduct = [...gcAvailable].sort((a: any, b: any) => a.price - b.price)[0];
                  } else if (["bof", "mof", "remarketing"].includes(gcFunnel)) {
                    topProduct = [...gcAvailable].sort((a: any, b: any) => b.price - a.price)[0];
                  } else {
                    topProduct = gcAvailable[0];
                  }
                }
                if (!topProduct) topProduct = context.products?.[0];
                if (!topProduct) {
                  actionRecord.status = "failed";
                  actionRecord.error_message = "Nenhum produto encontrado para gerar criativo";
                } else if (mediaBlocked) {
                  actionRecord.status = "blocked_media_permission";
                  actionRecord.error_message = `Media blocked: ${mediaBlockReason}`;
                } else {
                  try {
                    const { data: creativeResult, error: creativeErr } = await supabase.functions.invoke("ads-autopilot-creative", {
                      body: {
                        tenant_id,
                        session_id: sessionId,
                        channel: "meta",
                        product_id: topProduct.id,
                        product_name: topProduct.name,
                        campaign_objective: args.campaign_objective,
                        target_audience: args.target_audience,
                        style_preference: args.style_preference || "promotional",
                        format: "1:1",
                        variations: 3,
                        funnel_stage: args.funnel_stage || null,
                        strategy_run_id: strategyRunId,
                      },
                    });

                    if (creativeErr) throw creativeErr;

                    // v5.11.1: Check logical success (HTTP 200 but success=false)
                    if (creativeResult?.success === false) {
                      throw new Error(creativeResult?.error || "Creative generation failed (success=false)");
                    }

                    // v5.11.1: Enrich action_data with traceability
                    actionRecord.status = "executed";
                    actionRecord.executed_at = new Date().toISOString();
                    actionRecord.action_data = {
                      ...actionRecord.action_data,
                      creative_job_id: creativeResult?.data?.job_id,
                      creative_success: true,
                      creative_error: null,
                      product_id: topProduct.id,
                      product_name: topProduct.name,
                      funnel_stage: args.funnel_stage || null,
                      strategy_run_id: strategyRunId,
                    };
                    console.log(`[ads-autopilot-analyze][${VERSION}] Creative job started: ${creativeResult?.data?.job_id} funnel=${args.funnel_stage || 'unset'}`);
                  } catch (creativeErr: any) {
                    actionRecord.status = "failed";
                    actionRecord.error_message = creativeErr.message || "Erro ao gerar criativo";
                  }
                }
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
          if (insertErr) {
            // v5.11.0: Treat UNIQUE constraint violation as noop (idempotency)
            if (insertErr.code === "23505") {
              console.log(`[ads-autopilot-analyze][${VERSION}] Action hash duplicate (noop): ${actionRecord.action_hash}`);
            } else {
              console.error(`[ads-autopilot-analyze][${VERSION}] Action insert error:`, insertErr);
            }
          }
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

      // Update config stats (if global config exists)
      if (globalConfig) {
        await supabase
          .from("ads_autopilot_configs")
          .update({
            last_analysis_at: new Date().toISOString(),
            total_actions_executed: (globalConfig.total_actions_executed || 0) + totalActionsExecuted,
          })
          .eq("id", globalConfig.id);
      }

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
      if (globalConfig) {
        await supabase
          .from("ads_autopilot_configs")
          .update({ lock_session_id: null, lock_expires_at: null })
          .eq("id", globalConfig.id)
          .eq("lock_session_id", sessionLockId);
      }
    }
  } catch (err: any) {
    console.error(`[ads-autopilot-analyze][${VERSION}] Fatal error:`, err.message, err.stack);
    return fail(err.message || "Erro interno");
  }
});
