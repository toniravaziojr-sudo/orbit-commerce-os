import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v2.0.0"; // CRUD: create, update, pause, activate + sync + list
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GOOGLE_ADS_API_VERSION = "v18";

// =====================
// Auth helpers
// =====================

async function refreshAccessToken(supabase: any, tenantId: string, refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const data = await res.json();
  if (!data.access_token) return null;

  await supabase.from("google_connections").update({
    access_token: data.access_token,
    token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  }).eq("tenant_id", tenantId);

  return data.access_token;
}

async function getValidToken(supabase: any, tenantId: string): Promise<{ token: string; conn: any } | null> {
  const { data: conn } = await supabase.from("google_connections")
    .select("access_token, refresh_token, token_expires_at, scope_packs, assets, is_active")
    .eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
  if (!conn || !conn.scope_packs?.includes("ads")) return null;

  const isExpired = conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : true;
  let token = conn.access_token;
  if (isExpired && conn.refresh_token) {
    const newToken = await refreshAccessToken(supabase, tenantId, conn.refresh_token);
    if (!newToken) return null;
    token = newToken;
  }
  return { token, conn };
}

async function getAdsHeaders(supabaseUrl: string, supabaseServiceKey: string, token: string, traceId: string): Promise<{ headers: Record<string, string>; devToken: string } | null> {
  const devToken = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!devToken) return null;
  const loginCustomerId = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_LOGIN_CUSTOMER_ID");

  const headers: Record<string, string> = {
    "Authorization": `Bearer ${token}`,
    "developer-token": devToken,
    "Content-Type": "application/json",
  };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  return { headers, devToken };
}

function resolveCustomerId(body: any, conn: any): string | null {
  const adAccounts = conn.assets?.ad_accounts || [];
  const cid = body.customer_id || adAccounts[0]?.id;
  return cid ? cid.replace(/-/g, "") : null;
}

// =====================
// Main handler
// =====================

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[google-ads-campaigns][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const action = body.action || "list";
    const tenantId = body.tenant_id;

    if (!tenantId) {
      return new Response(JSON.stringify({ success: false, error: "tenant_id obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const { data, error } = await supabase.from("google_ad_campaigns")
        .select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // All other actions need auth
    const auth = await getValidToken(supabase, tenantId);
    if (!auth) {
      return new Response(JSON.stringify({ success: false, error: "Google Ads não conectado ou pack 'ads' não habilitado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const adsAuth = await getAdsHeaders(supabaseUrl, supabaseServiceKey, auth.token, traceId);
    if (!adsAuth) {
      return new Response(JSON.stringify({ success: false, error: "GOOGLE_ADS_DEVELOPER_TOKEN não configurado" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const customerId = resolveCustomerId(body, auth.conn);
    if (!customerId) {
      return new Response(JSON.stringify({ success: false, error: "Nenhuma conta de anúncios encontrada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========================
    // SYNC — Pull from Google Ads API
    // ========================
    if (action === "sync") {
      const query = `
        SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
               campaign.bidding_strategy_type, campaign.start_date, campaign.end_date,
               campaign.optimization_score, campaign_budget.amount_micros, campaign_budget.type
        FROM campaign WHERE campaign.status != 'REMOVED' ORDER BY campaign.name
      `;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
        { method: "POST", headers: adsAuth.headers, body: JSON.stringify({ query }) }
      );

      const responseText = await res.text();
      if (!res.ok) {
        console.error(`[google-ads-campaigns][${traceId}] API error:`, responseText);
        const errMsg = tryParseErrorMsg(responseText);
        return new Response(JSON.stringify({ success: false, error: errMsg }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let allRows: any[] = [];
      try {
        const results = JSON.parse(responseText);
        for (const batch of results) { if (batch.results) allRows = allRows.concat(batch.results); }
      } catch (e) {
        console.error(`[google-ads-campaigns][${traceId}] Parse error:`, e);
        return new Response(JSON.stringify({ success: false, error: "Erro ao processar resposta" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      let synced = 0;
      for (const row of allRows) {
        const c = row.campaign;
        const { error } = await supabase.from("google_ad_campaigns").upsert({
          tenant_id: tenantId, google_campaign_id: c.id, ad_account_id: customerId,
          name: c.name, status: c.status, campaign_type: c.advertisingChannelType,
          bidding_strategy_type: c.biddingStrategyType,
          budget_amount_micros: row.campaignBudget?.amountMicros ? parseInt(row.campaignBudget.amountMicros) : null,
          budget_type: row.campaignBudget?.type || "DAILY",
          start_date: c.startDate, end_date: c.endDate, optimization_score: c.optimizationScore,
          synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,google_campaign_id" });
        if (!error) synced++;
        else console.error(`[google-ads-campaigns][${traceId}] Upsert error:`, error);
      }

      return new Response(JSON.stringify({ success: true, data: { synced, total: allRows.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========================
    // CREATE — Create campaign + budget via Google Ads API
    // ========================
    if (action === "create") {
      const { name, status = "PAUSED", advertising_channel_type = "SEARCH", budget_amount_micros, budget_type = "DAILY",
              network_settings, bidding_strategy_type, target_cpa_micros, target_roas, geo_targets, language_targets } = body;

      if (!name || !budget_amount_micros) {
        return new Response(JSON.stringify({ success: false, error: "name e budget_amount_micros são obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Step 1: Create budget
      const budgetRes = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/campaignBudgets:mutate`,
        {
          method: "POST", headers: adsAuth.headers,
          body: JSON.stringify({
            operations: [{
              create: {
                name: `Budget - ${name} - ${Date.now()}`,
                amountMicros: String(budget_amount_micros),
                deliveryMethod: "STANDARD",
                ...(budget_type === "TOTAL" ? { period: "CUSTOM" } : {}),
              }
            }]
          })
        }
      );

      const budgetData = await budgetRes.json();
      if (!budgetRes.ok || budgetData.error) {
        console.error(`[google-ads-campaigns][${traceId}] Budget create error:`, JSON.stringify(budgetData));
        return new Response(JSON.stringify({ success: false, error: budgetData.error?.message || "Erro ao criar orçamento" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const budgetResourceName = budgetData.results?.[0]?.resourceName;
      if (!budgetResourceName) {
        return new Response(JSON.stringify({ success: false, error: "Não foi possível obter o resourceName do orçamento" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Step 2: Create campaign
      const campaignPayload: any = {
        name,
        status,
        advertisingChannelType: advertising_channel_type,
        campaignBudget: budgetResourceName,
      };

      // Network settings (Search)
      if (network_settings) {
        campaignPayload.networkSettings = network_settings;
      } else if (advertising_channel_type === "SEARCH") {
        campaignPayload.networkSettings = { targetGoogleSearch: true, targetSearchNetwork: true, targetContentNetwork: false };
      }

      // Bidding strategy
      if (bidding_strategy_type === "MAXIMIZE_CONVERSIONS") {
        campaignPayload.maximizeConversions = target_cpa_micros ? { targetCpaMicros: String(target_cpa_micros) } : {};
      } else if (bidding_strategy_type === "MAXIMIZE_CONVERSION_VALUE") {
        campaignPayload.maximizeConversionValue = target_roas ? { targetRoas: target_roas } : {};
      } else if (bidding_strategy_type === "TARGET_SPEND") {
        campaignPayload.targetSpend = {};
      } else if (bidding_strategy_type === "MANUAL_CPC") {
        campaignPayload.manualCpc = { enhancedCpcEnabled: true };
      }

      // Geo targets
      if (geo_targets && geo_targets.length > 0) {
        campaignPayload.geoTargetTypeSetting = { positiveGeoTargetType: "PRESENCE_OR_INTEREST" };
      }

      const campaignRes = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/campaigns:mutate`,
        { method: "POST", headers: adsAuth.headers, body: JSON.stringify({ operations: [{ create: campaignPayload }] }) }
      );

      const campaignData = await campaignRes.json();
      if (!campaignRes.ok || campaignData.error) {
        console.error(`[google-ads-campaigns][${traceId}] Campaign create error:`, JSON.stringify(campaignData));
        return new Response(JSON.stringify({ success: false, error: campaignData.error?.message || "Erro ao criar campanha" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const campaignResourceName = campaignData.results?.[0]?.resourceName;
      const googleCampaignId = campaignResourceName?.split("/").pop();

      // Step 3: Add geo targets if specified
      if (geo_targets && geo_targets.length > 0 && googleCampaignId) {
        const geoOps = geo_targets.map((geoId: string) => ({
          create: {
            campaign: campaignResourceName,
            location: { geoTargetConstant: `geoTargetConstants/${geoId}` },
          }
        }));

        await fetch(
          `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/campaignCriteria:mutate`,
          { method: "POST", headers: adsAuth.headers, body: JSON.stringify({ operations: geoOps }) }
        );
      }

      // Step 4: Add language targets if specified
      if (language_targets && language_targets.length > 0 && googleCampaignId) {
        const langOps = language_targets.map((langId: string) => ({
          create: {
            campaign: campaignResourceName,
            language: { languageConstant: `languageConstants/${langId}` },
          }
        }));

        await fetch(
          `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/campaignCriteria:mutate`,
          { method: "POST", headers: adsAuth.headers, body: JSON.stringify({ operations: langOps }) }
        );
      }

      // Save to local cache
      if (googleCampaignId) {
        await supabase.from("google_ad_campaigns").upsert({
          tenant_id: tenantId, google_campaign_id: googleCampaignId, ad_account_id: customerId,
          name, status, campaign_type: advertising_channel_type,
          bidding_strategy_type: bidding_strategy_type || null,
          budget_amount_micros: budget_amount_micros, budget_type: budget_type,
          synced_at: new Date().toISOString(),
          metadata: { budget_resource_name: budgetResourceName, campaign_resource_name: campaignResourceName },
        }, { onConflict: "tenant_id,google_campaign_id" });
      }

      console.log(`[google-ads-campaigns][${traceId}] Created campaign ${googleCampaignId}`);
      return new Response(JSON.stringify({
        success: true, data: { google_campaign_id: googleCampaignId, resource_name: campaignResourceName, budget_resource_name: budgetResourceName }
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========================
    // UPDATE — Update campaign via Google Ads API
    // ========================
    if (action === "update") {
      const { campaign_id, updates, update_mask } = body;
      if (!campaign_id || !updates) {
        return new Response(JSON.stringify({ success: false, error: "campaign_id e updates são obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const resourceName = `customers/${customerId}/campaigns/${campaign_id}`;
      const mask = update_mask || Object.keys(updates).map(k => camelToSnake(k)).join(",");

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/campaigns:mutate`,
        {
          method: "POST", headers: adsAuth.headers,
          body: JSON.stringify({
            operations: [{ update: { resourceName, ...updates }, updateMask: mask }]
          })
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error(`[google-ads-campaigns][${traceId}] Update error:`, JSON.stringify(data));
        return new Response(JSON.stringify({ success: false, error: data.error?.message || "Erro ao atualizar campanha" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // Update local cache
      const localUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.name) localUpdates.name = updates.name;
      if (updates.status) localUpdates.status = updates.status;
      await supabase.from("google_ad_campaigns").update(localUpdates)
        .eq("tenant_id", tenantId).eq("google_campaign_id", campaign_id);

      return new Response(JSON.stringify({ success: true, data: { updated: campaign_id } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========================
    // PAUSE / ACTIVATE — Shorthand for status update
    // ========================
    if (action === "pause" || action === "activate") {
      const { campaign_id } = body;
      if (!campaign_id) {
        return new Response(JSON.stringify({ success: false, error: "campaign_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const newStatus = action === "pause" ? "PAUSED" : "ENABLED";
      const resourceName = `customers/${customerId}/campaigns/${campaign_id}`;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/campaigns:mutate`,
        {
          method: "POST", headers: adsAuth.headers,
          body: JSON.stringify({
            operations: [{ update: { resourceName, status: newStatus }, updateMask: "status" }]
          })
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error(`[google-ads-campaigns][${traceId}] ${action} error:`, JSON.stringify(data));
        return new Response(JSON.stringify({ success: false, error: data.error?.message || `Erro ao ${action === "pause" ? "pausar" : "ativar"}` }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("google_ad_campaigns").update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId).eq("google_campaign_id", campaign_id);

      return new Response(JSON.stringify({ success: true, data: { campaign_id, status: newStatus } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ========================
    // REMOVE — Remove campaign
    // ========================
    if (action === "remove") {
      const { campaign_id } = body;
      if (!campaign_id) {
        return new Response(JSON.stringify({ success: false, error: "campaign_id é obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const resourceName = `customers/${customerId}/campaigns/${campaign_id}`;
      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/campaigns:mutate`,
        { method: "POST", headers: adsAuth.headers, body: JSON.stringify({ operations: [{ remove: resourceName }] }) }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        return new Response(JSON.stringify({ success: false, error: data.error?.message || "Erro ao remover" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      await supabase.from("google_ad_campaigns").update({ status: "REMOVED", updated_at: new Date().toISOString() })
        .eq("tenant_id", tenantId).eq("google_campaign_id", campaign_id);

      return new Response(JSON.stringify({ success: true, data: { removed: campaign_id } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    console.error(`[google-ads-campaigns][${traceId}] Error:`, error);
    return new Response(JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

// Helpers
function camelToSnake(str: string): string {
  return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

function tryParseErrorMsg(text: string): string {
  try {
    const d = JSON.parse(text);
    return d.error?.message || d[0]?.error?.message || "Erro na API do Google Ads";
  } catch { return "Erro na API do Google Ads"; }
}
