import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: sync insights from TikTok Ads Reporting API
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

async function getTikTokConnection(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("tiktok_ads_connections")
    .select("access_token, advertiser_id")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("connection_status", "connected")
    .maybeSingle();
  if (!data?.access_token || !data?.advertiser_id) return null;
  return data;
}

async function tiktokApi(path: string, token: string, method = "GET", body?: any) {
  const url = `${TIKTOK_API_BASE}${path}`;
  const headers: Record<string, string> = {
    "Access-Token": token,
    "Content-Type": "application/json",
  };
  const options: RequestInit = { method, headers };
  if (body && method !== "GET") options.body = JSON.stringify(body);

  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { code: -1, message: text };
  }
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[tiktok-ads-insights][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get("action") || "list";
    const tenantId = body.tenant_id || url.searchParams.get("tenant_id");

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const conn = await getTikTokConnection(supabase, tenantId);
    if (!conn) {
      return new Response(
        JSON.stringify({ success: false, error: "TikTok Ads não conectado", code: "TIKTOK_NOT_CONNECTED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const advertiserId = body.advertiser_id || conn.advertiser_id;

    // ========================
    // SYNC — Pull insights from TikTok Reporting API
    // ========================
    if (action === "sync") {
      // Default: last 30 days
      const now = new Date();
      const startDate = body.date_start || new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
      const endDate = body.date_end || now.toISOString().split("T")[0];

      const reportBody = {
        advertiser_id: advertiserId,
        report_type: "BASIC",
        data_level: "AUCTION_CAMPAIGN",
        dimensions: ["campaign_id", "stat_time_day"],
        metrics: [
          "spend", "impressions", "clicks", "reach", "cpc", "cpm", "ctr",
          "conversion", "cost_per_conversion", "conversion_rate",
          "total_complete_payment_rate", "complete_payment",
          "video_play_actions", "video_watched_2s", "video_watched_6s",
          "likes", "comments", "shares", "follows", "frequency",
        ],
        start_date: startDate,
        end_date: endDate,
        page_size: 200,
        page: 1,
      };

      const result = await tiktokApi("/report/integrated/get/", conn.access_token, "POST", reportBody);

      if (result.code !== 0) {
        console.error(`[tiktok-ads-insights][${traceId}] API error:`, result);
        return new Response(
          JSON.stringify({ success: false, error: result.message || "Erro na API TikTok", code: "TIKTOK_API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const rows = result.data?.list || [];
      let synced = 0;

      // Pre-fetch campaign map for FK linking
      const { data: localCampaigns } = await supabase
        .from("tiktok_ad_campaigns")
        .select("id, tiktok_campaign_id")
        .eq("tenant_id", tenantId);

      const campaignMap = new Map(
        (localCampaigns || []).map((c: any) => [c.tiktok_campaign_id, c.id])
      );

      for (const row of rows) {
        const dims = row.dimensions || {};
        const metrics = row.metrics || {};
        const tiktokCampaignId = String(dims.campaign_id);
        const dateStr = dims.stat_time_day?.split(" ")[0];
        if (!dateStr) continue;

        const spendCents = metrics.spend ? Math.round(parseFloat(metrics.spend) * 100) : 0;
        const cpcCents = metrics.cpc ? Math.round(parseFloat(metrics.cpc) * 100) : 0;
        const cpmCents = metrics.cpm ? Math.round(parseFloat(metrics.cpm) * 100) : 0;

        const { error } = await supabase
          .from("tiktok_ad_insights")
          .upsert({
            tenant_id: tenantId,
            campaign_id: campaignMap.get(tiktokCampaignId) || null,
            tiktok_campaign_id: tiktokCampaignId,
            advertiser_id: advertiserId,
            date_start: dateStr,
            date_stop: dateStr,
            impressions: parseInt(metrics.impressions) || 0,
            clicks: parseInt(metrics.clicks) || 0,
            spend_cents: spendCents,
            reach: parseInt(metrics.reach) || 0,
            cpc_cents: cpcCents,
            cpm_cents: cpmCents,
            ctr: parseFloat(metrics.ctr) || 0,
            conversions: parseInt(metrics.conversion) || 0,
            conversion_value_cents: metrics.complete_payment ? Math.round(parseFloat(metrics.complete_payment) * 100) : 0,
            roas: metrics.total_complete_payment_rate ? parseFloat(metrics.total_complete_payment_rate) : 0,
            frequency: parseFloat(metrics.frequency) || 0,
            video_views: parseInt(metrics.video_play_actions) || 0,
            video_watched_2s: parseInt(metrics.video_watched_2s) || 0,
            video_watched_6s: parseInt(metrics.video_watched_6s) || 0,
            likes: parseInt(metrics.likes) || 0,
            comments: parseInt(metrics.comments) || 0,
            shares: parseInt(metrics.shares) || 0,
            follows: parseInt(metrics.follows) || 0,
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,tiktok_campaign_id,date_start" });

        if (error) {
          console.error(`[tiktok-ads-insights][${traceId}] Upsert error:`, error);
        } else {
          synced++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: rows.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const { data, error } = await supabase
        .from("tiktok_ad_insights")
        .select("*, tiktok_ad_campaigns(name, status, objective_type)")
        .eq("tenant_id", tenantId)
        .order("date_start", { ascending: false })
        .limit(100);

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-ads-insights][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
