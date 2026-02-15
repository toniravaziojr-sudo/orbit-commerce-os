import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Google Ads Insights sync + list
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GOOGLE_ADS_API_VERSION = "v18";

async function refreshAccessToken(
  supabase: any,
  tenantId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await res.json();
  if (!data.access_token) return null;

  await supabase
    .from("google_connections")
    .update({
      access_token: data.access_token,
      token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("tenant_id", tenantId);

  return data.access_token;
}

async function getValidToken(supabase: any, tenantId: string): Promise<{ token: string; conn: any } | null> {
  const { data: conn } = await supabase
    .from("google_connections")
    .select("access_token, refresh_token, token_expires_at, scope_packs, assets, is_active")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .maybeSingle();

  if (!conn) return null;
  if (!conn.scope_packs?.includes("ads")) return null;

  const isExpired = conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : true;
  let token = conn.access_token;

  if (isExpired && conn.refresh_token) {
    const newToken = await refreshAccessToken(supabase, tenantId, conn.refresh_token);
    if (!newToken) return null;
    token = newToken;
  }

  return { token, conn };
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[google-ads-insights][${VERSION}][${traceId}] ${req.method}`);

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
    // SYNC — Pull insights from Google Ads API
    // ========================
    if (action === "sync") {
      const auth = await getValidToken(supabase, tenantId);
      if (!auth) {
        return new Response(
          JSON.stringify({ success: false, error: "Google Ads não conectado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const devToken = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_DEVELOPER_TOKEN");
      if (!devToken) {
        return new Response(
          JSON.stringify({ success: false, error: "GOOGLE_ADS_DEVELOPER_TOKEN não configurado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adAccounts = auth.conn.assets?.ad_accounts || [];
      const customerId = body.customer_id || adAccounts[0]?.id;
      if (!customerId) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma conta de anúncios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const loginCustomerId = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
      const cleanCustomerId = customerId.replace(/-/g, "");

      // Date range: default last 30 days
      const dateFrom = body.date_from || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const dateTo = body.date_to || new Date().toISOString().split("T")[0];

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${auth.token}`,
        "developer-token": devToken,
        "Content-Type": "application/json",
      };
      if (loginCustomerId) {
        headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
      }

      const query = `
        SELECT
          campaign.id,
          segments.date,
          metrics.impressions,
          metrics.clicks,
          metrics.cost_micros,
          metrics.conversions,
          metrics.conversions_value,
          metrics.ctr,
          metrics.average_cpc,
          metrics.average_cpm,
          metrics.interaction_rate,
          metrics.video_views,
          metrics.video_view_rate
        FROM campaign
        WHERE segments.date BETWEEN '${dateFrom.replace(/-/g, "")}' AND '${dateTo.replace(/-/g, "")}'
          AND campaign.status != 'REMOVED'
      `;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${cleanCustomerId}/googleAds:searchStream`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ query }),
        }
      );

      const responseText = await res.text();
      if (!res.ok) {
        console.error(`[google-ads-insights][${traceId}] API error:`, responseText);
        let errorMsg = "Erro na API do Google Ads";
        try {
          const errData = JSON.parse(responseText);
          errorMsg = errData.error?.message || errData[0]?.error?.message || errorMsg;
        } catch {}
        return new Response(
          JSON.stringify({ success: false, error: errorMsg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let allRows: any[] = [];
      try {
        const results = JSON.parse(responseText);
        for (const batch of results) {
          if (batch.results) {
            allRows = allRows.concat(batch.results);
          }
        }
      } catch (e) {
        console.error(`[google-ads-insights][${traceId}] Parse error:`, e);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao processar resposta" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let synced = 0;
      for (const row of allRows) {
        const m = row.metrics || {};
        const dateStr = row.segments?.date;
        if (!dateStr || !row.campaign?.id) continue;

        // Convert YYYY-MM-DD or YYYYMMDD to YYYY-MM-DD
        const formattedDate = dateStr.length === 8
          ? `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`
          : dateStr;

        const { error } = await supabase
          .from("google_ad_insights")
          .upsert({
            tenant_id: tenantId,
            google_campaign_id: row.campaign.id,
            ad_account_id: cleanCustomerId,
            date: formattedDate,
            impressions: parseInt(m.impressions || "0"),
            clicks: parseInt(m.clicks || "0"),
            cost_micros: parseInt(m.costMicros || "0"),
            conversions: m.conversions || 0,
            conversions_value: m.conversionsValue || 0,
            ctr: m.ctr || 0,
            average_cpc_micros: parseInt(m.averageCpc || "0"),
            average_cpm_micros: parseInt(m.averageCpm || "0"),
            interaction_rate: m.interactionRate || 0,
            video_views: parseInt(m.videoViews || "0"),
            view_rate: m.videoViewRate || 0,
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,google_campaign_id,date" });

        if (error) {
          console.error(`[google-ads-insights][${traceId}] Upsert error:`, error);
        } else {
          synced++;
        }
      }

      console.log(`[google-ads-insights][${traceId}] Synced ${synced}/${allRows.length} insight rows`);

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: allRows.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const campaignId = body.campaign_id || url.searchParams.get("campaign_id");
      const dateFrom = body.date_from || url.searchParams.get("date_from");
      const dateTo = body.date_to || url.searchParams.get("date_to");

      let query = supabase
        .from("google_ad_insights")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("date", { ascending: false });

      if (campaignId) query = query.eq("google_campaign_id", campaignId);
      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo);

      const { data, error } = await query.limit(500);
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // SUMMARY — Aggregate metrics
    // ========================
    if (action === "summary") {
      const dateFrom = body.date_from || url.searchParams.get("date_from") || new Date(Date.now() - 30 * 86400000).toISOString().split("T")[0];
      const dateTo = body.date_to || url.searchParams.get("date_to") || new Date().toISOString().split("T")[0];

      const { data, error } = await supabase
        .from("google_ad_insights")
        .select("impressions, clicks, cost_micros, conversions, conversions_value")
        .eq("tenant_id", tenantId)
        .gte("date", dateFrom)
        .lte("date", dateTo);

      if (error) throw error;

      const summary = (data || []).reduce((acc: any, row: any) => ({
        impressions: acc.impressions + (row.impressions || 0),
        clicks: acc.clicks + (row.clicks || 0),
        cost_micros: acc.cost_micros + (row.cost_micros || 0),
        conversions: acc.conversions + (row.conversions || 0),
        conversions_value: acc.conversions_value + (row.conversions_value || 0),
      }), { impressions: 0, clicks: 0, cost_micros: 0, conversions: 0, conversions_value: 0 });

      summary.spend = summary.cost_micros / 1_000_000;
      summary.ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions) * 100 : 0;
      summary.cpc = summary.clicks > 0 ? summary.spend / summary.clicks : 0;
      summary.roas = summary.spend > 0 ? summary.conversions_value / summary.spend : 0;

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
    console.error(`[google-ads-insights][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
