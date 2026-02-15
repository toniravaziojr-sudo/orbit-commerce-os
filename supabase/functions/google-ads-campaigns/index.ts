import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: Google Ads Campaigns sync + list
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GOOGLE_ADS_API_VERSION = "v18";

interface GoogleAdsRow {
  campaign: {
    resourceName: string;
    id: string;
    name: string;
    status: string;
    advertisingChannelType?: string;
    biddingStrategyType?: string;
    startDate?: string;
    endDate?: string;
    optimizationScore?: number;
  };
  campaignBudget?: {
    amountMicros?: string;
    type?: string;
  };
  metrics?: {
    impressions?: string;
    clicks?: string;
    costMicros?: string;
    conversions?: number;
    conversionsValue?: number;
    ctr?: number;
    averageCpc?: string;
    averageCpm?: string;
  };
}

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
  console.log(`[google-ads-campaigns][${VERSION}][${traceId}] ${req.method}`);

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
    // SYNC — Pull campaigns from Google Ads API
    // ========================
    if (action === "sync") {
      const auth = await getValidToken(supabase, tenantId);
      if (!auth) {
        return new Response(
          JSON.stringify({ success: false, error: "Google Ads não conectado ou pack 'ads' não habilitado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get developer token from platform_credentials
      const devToken = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_DEVELOPER_TOKEN");
      if (!devToken) {
        return new Response(
          JSON.stringify({ success: false, error: "GOOGLE_ADS_DEVELOPER_TOKEN não configurado. Configure em Integrações da Plataforma." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get ad accounts from assets
      const adAccounts = auth.conn.assets?.ad_accounts || [];
      const customerId = body.customer_id || adAccounts[0]?.id;
      if (!customerId) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma conta de anúncios Google Ads encontrada" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Optional: login_customer_id for MCC accounts
      const loginCustomerId = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_LOGIN_CUSTOMER_ID");

      const cleanCustomerId = customerId.replace(/-/g, "");

      const headers: Record<string, string> = {
        "Authorization": `Bearer ${auth.token}`,
        "developer-token": devToken,
        "Content-Type": "application/json",
      };
      if (loginCustomerId) {
        headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
      }

      // GAQL query to fetch campaigns
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.advertising_channel_type,
          campaign.bidding_strategy_type,
          campaign.start_date,
          campaign.end_date,
          campaign.optimization_score,
          campaign_budget.amount_micros,
          campaign_budget.type
        FROM campaign
        WHERE campaign.status != 'REMOVED'
        ORDER BY campaign.name
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
        console.error(`[google-ads-campaigns][${traceId}] API error:`, responseText);
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

      let allRows: GoogleAdsRow[] = [];
      try {
        const results = JSON.parse(responseText);
        // searchStream returns array of batches
        for (const batch of results) {
          if (batch.results) {
            allRows = allRows.concat(batch.results);
          }
        }
      } catch (e) {
        console.error(`[google-ads-campaigns][${traceId}] Parse error:`, e);
        return new Response(
          JSON.stringify({ success: false, error: "Erro ao processar resposta do Google Ads" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      let synced = 0;
      for (const row of allRows) {
        const c = row.campaign;
        const { error } = await supabase
          .from("google_ad_campaigns")
          .upsert({
            tenant_id: tenantId,
            google_campaign_id: c.id,
            ad_account_id: cleanCustomerId,
            name: c.name,
            status: c.status,
            campaign_type: c.advertisingChannelType,
            bidding_strategy_type: c.biddingStrategyType,
            budget_amount_micros: row.campaignBudget?.amountMicros ? parseInt(row.campaignBudget.amountMicros) : null,
            budget_type: row.campaignBudget?.type || "DAILY",
            start_date: c.startDate,
            end_date: c.endDate,
            optimization_score: c.optimizationScore,
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,google_campaign_id" });

        if (error) {
          console.error(`[google-ads-campaigns][${traceId}] Upsert error for ${c.id}:`, error);
        } else {
          synced++;
        }
      }

      console.log(`[google-ads-campaigns][${traceId}] Synced ${synced}/${allRows.length} campaigns`);

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: allRows.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const { data, error } = await supabase
        .from("google_ad_campaigns")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

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
    console.error(`[google-ads-campaigns][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
