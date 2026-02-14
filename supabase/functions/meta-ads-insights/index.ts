import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Fetch + cache campaign insights
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GRAPH_API_VERSION = "v21.0";

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-ads-insights][${VERSION}][${traceId}] ${req.method}`);

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

    // ========================
    // SYNC — Pull insights from Meta for all campaigns
    // ========================
    if (action === "sync") {
      const { data: conn } = await supabase
        .from("marketplace_connections")
        .select("access_token, metadata")
        .eq("tenant_id", tenantId)
        .eq("platform", "meta")
        .eq("status", "active")
        .maybeSingle();

      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: "Meta não conectada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adAccounts = conn.metadata?.assets?.ad_accounts || [];
      if (adAccounts.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma conta de anúncios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adAccountId = body.ad_account_id || adAccounts[0].id;
      const datePreset = body.date_preset || "last_30d";
      const timeRange = body.time_range; // { since: "YYYY-MM-DD", until: "YYYY-MM-DD" }

      let insightsUrl = `act_${adAccountId.replace("act_", "")}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,reach,cpc,cpm,ctr,actions,cost_per_action_type,frequency&level=campaign&limit=500`;

      if (timeRange) {
        insightsUrl += `&time_range=${JSON.stringify(timeRange)}`;
      } else {
        insightsUrl += `&date_preset=${datePreset}`;
      }

      const res = await fetch(
        `https://graph.facebook.com/${GRAPH_API_VERSION}/${insightsUrl}&access_token=${conn.access_token}`
      );
      const result = await res.json();

      if (result.error) {
        return new Response(
          JSON.stringify({ success: false, error: result.error.message }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const insights = result.data || [];
      let synced = 0;

      for (const i of insights) {
        // Find local campaign
        const { data: localCampaign } = await supabase
          .from("meta_ad_campaigns")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("meta_campaign_id", i.campaign_id)
          .maybeSingle();

        // Extract conversions from actions
        const purchaseAction = (i.actions || []).find((a: any) => a.action_type === "purchase" || a.action_type === "offsite_conversion.fb_pixel_purchase");
        const conversions = purchaseAction ? parseInt(purchaseAction.value || "0") : 0;

        const spendCents = Math.round(parseFloat(i.spend || "0") * 100);
        const cpcCents = Math.round(parseFloat(i.cpc || "0") * 100);
        const cpmCents = Math.round(parseFloat(i.cpm || "0") * 100);

        const { error } = await supabase
          .from("meta_ad_insights")
          .upsert({
            tenant_id: tenantId,
            campaign_id: localCampaign?.id || null,
            meta_campaign_id: i.campaign_id,
            date_start: i.date_start,
            date_stop: i.date_stop,
            impressions: parseInt(i.impressions || "0"),
            clicks: parseInt(i.clicks || "0"),
            spend_cents: spendCents,
            reach: parseInt(i.reach || "0"),
            cpc_cents: cpcCents,
            cpm_cents: cpmCents,
            ctr: parseFloat(i.ctr || "0"),
            conversions,
            frequency: parseFloat(i.frequency || "0"),
            actions: i.actions || [],
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,meta_campaign_id,date_start,date_stop" });

        if (error) {
          console.error(`[meta-ads-insights][${traceId}] Upsert error:`, error);
        } else {
          synced++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: insights.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const campaignId = body.campaign_id || url.searchParams.get("campaign_id");
      let query = supabase
        .from("meta_ad_insights")
        .select("*, meta_ad_campaigns(name, status, objective)")
        .eq("tenant_id", tenantId)
        .order("date_start", { ascending: false })
        .limit(100);

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // SUMMARY — Aggregated metrics
    // ========================
    if (action === "summary") {
      const { data, error } = await supabase
        .from("meta_ad_insights")
        .select("impressions, clicks, spend_cents, reach, conversions, conversion_value_cents")
        .eq("tenant_id", tenantId);

      if (error) throw error;

      const summary = (data || []).reduce((acc, row) => ({
        impressions: acc.impressions + (row.impressions || 0),
        clicks: acc.clicks + (row.clicks || 0),
        spend_cents: acc.spend_cents + (row.spend_cents || 0),
        reach: acc.reach + (row.reach || 0),
        conversions: acc.conversions + (row.conversions || 0),
        conversion_value_cents: acc.conversion_value_cents + (row.conversion_value_cents || 0),
      }), { impressions: 0, clicks: 0, spend_cents: 0, reach: 0, conversions: 0, conversion_value_cents: 0 });

      summary.ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions * 100) : 0;
      summary.roas = summary.spend_cents > 0 ? (summary.conversion_value_cents / summary.spend_cents) : 0;

      return new Response(
        JSON.stringify({ success: true, data: summary }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[meta-ads-insights][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
