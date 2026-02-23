import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // CRUD: create, update, pause, activate, sync, list
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GOOGLE_ADS_API_VERSION = "v18";

// =====================
// Auth helpers (shared pattern)
// =====================

async function refreshAccessToken(supabase: any, tenantId: string, refreshToken: string): Promise<string | null> {
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID");
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET");
  if (!clientId || !clientSecret || !refreshToken) return null;
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const data = await res.json();
  if (!data.access_token) return null;
  await supabase.from("google_connections").update({
    access_token: data.access_token, token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq("tenant_id", tenantId);
  return data.access_token;
}

async function getValidToken(supabase: any, tenantId: string): Promise<{ token: string; conn: any } | null> {
  const { data: conn } = await supabase.from("google_connections").select("access_token, refresh_token, token_expires_at, scope_packs, assets, is_active")
    .eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
  if (!conn || !conn.scope_packs?.includes("ads")) return null;
  const isExpired = conn.token_expires_at ? new Date(conn.token_expires_at) < new Date() : true;
  let token = conn.access_token;
  if (isExpired && conn.refresh_token) { const t = await refreshAccessToken(supabase, tenantId, conn.refresh_token); if (!t) return null; token = t; }
  return { token, conn };
}

async function getAdsHeaders(supabaseUrl: string, supabaseServiceKey: string, token: string) {
  const devToken = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!devToken) return null;
  const loginCustomerId = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  const headers: Record<string, string> = { "Authorization": `Bearer ${token}`, "developer-token": devToken, "Content-Type": "application/json" };
  if (loginCustomerId) headers["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  return headers;
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[google-ads-adgroups][${VERSION}][${traceId}] ${req.method}`);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const { action = "list", tenant_id: tenantId } = body;

    if (!tenantId) return jsonRes({ success: false, error: "tenant_id obrigatório" });

    // LIST
    if (action === "list") {
      const q = supabase.from("google_ad_groups").select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
      if (body.campaign_id) q.eq("google_campaign_id", body.campaign_id);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return jsonRes({ success: true, data });
    }

    // Auth check for mutations
    const auth = await getValidToken(supabase, tenantId);
    if (!auth) return jsonRes({ success: false, error: "Google Ads não conectado" });
    const headers = await getAdsHeaders(supabaseUrl, supabaseServiceKey, auth.token);
    if (!headers) return jsonRes({ success: false, error: "GOOGLE_ADS_DEVELOPER_TOKEN não configurado" });
    const customerId = (body.customer_id || auth.conn.assets?.ad_accounts?.[0]?.id || "").replace(/-/g, "");
    if (!customerId) return jsonRes({ success: false, error: "Nenhuma conta encontrada" });

    // SYNC
    if (action === "sync") {
      const campaignFilter = body.campaign_id ? `AND campaign.id = '${body.campaign_id}'` : "";
      const query = `
        SELECT ad_group.id, ad_group.name, ad_group.status, ad_group.type,
               ad_group.cpc_bid_micros, ad_group.cpm_bid_micros, ad_group.target_cpa_micros,
               ad_group.target_roas, ad_group.effective_target_cpa_micros,
               campaign.id
        FROM ad_group
        WHERE ad_group.status != 'REMOVED' ${campaignFilter}
        ORDER BY ad_group.name
      `;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
        { method: "POST", headers, body: JSON.stringify({ query }) }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[google-ads-adgroups][${traceId}] Sync error:`, errText);
        return jsonRes({ success: false, error: tryParseErr(errText) });
      }

      const results = JSON.parse(await res.text());
      let allRows: any[] = [];
      for (const batch of results) { if (batch.results) allRows = allRows.concat(batch.results); }

      let synced = 0;
      for (const row of allRows) {
        const ag = row.adGroup;
        const { error } = await supabase.from("google_ad_groups").upsert({
          tenant_id: tenantId, google_ad_group_id: ag.id, google_campaign_id: row.campaign?.id || "",
          ad_account_id: customerId, name: ag.name, status: ag.status, ad_group_type: ag.type,
          cpc_bid_micros: ag.cpcBidMicros ? parseInt(ag.cpcBidMicros) : null,
          cpm_bid_micros: ag.cpmBidMicros ? parseInt(ag.cpmBidMicros) : null,
          target_cpa_micros: ag.targetCpaMicros ? parseInt(ag.targetCpaMicros) : null,
          target_roas: ag.targetRoas || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,google_ad_group_id" });
        if (!error) synced++;
      }

      return jsonRes({ success: true, data: { synced, total: allRows.length } });
    }

    // CREATE
    if (action === "create") {
      const { campaign_id, name, status = "ENABLED", ad_group_type = "SEARCH_STANDARD",
              cpc_bid_micros, target_cpa_micros, target_roas } = body;

      if (!campaign_id || !name) return jsonRes({ success: false, error: "campaign_id e name são obrigatórios" });

      const campaignResourceName = `customers/${customerId}/campaigns/${campaign_id}`;
      const adGroupPayload: any = {
        name, status, type: ad_group_type,
        campaign: campaignResourceName,
      };
      if (cpc_bid_micros) adGroupPayload.cpcBidMicros = String(cpc_bid_micros);
      if (target_cpa_micros) adGroupPayload.targetCpaMicros = String(target_cpa_micros);
      if (target_roas) adGroupPayload.targetRoas = target_roas;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/adGroups:mutate`,
        { method: "POST", headers, body: JSON.stringify({ operations: [{ create: adGroupPayload }] }) }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error(`[google-ads-adgroups][${traceId}] Create error:`, JSON.stringify(data));
        return jsonRes({ success: false, error: data.error?.message || "Erro ao criar grupo de anúncios" });
      }

      const resourceName = data.results?.[0]?.resourceName;
      const adGroupId = resourceName?.split("/").pop();

      // Cache locally
      if (adGroupId) {
        await supabase.from("google_ad_groups").upsert({
          tenant_id: tenantId, google_ad_group_id: adGroupId, google_campaign_id: campaign_id,
          ad_account_id: customerId, name, status, ad_group_type,
          cpc_bid_micros: cpc_bid_micros || null, target_cpa_micros: target_cpa_micros || null,
          target_roas: target_roas || null, synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,google_ad_group_id" });
      }

      return jsonRes({ success: true, data: { google_ad_group_id: adGroupId, resource_name: resourceName } });
    }

    // PAUSE / ACTIVATE
    if (action === "pause" || action === "activate") {
      const { ad_group_id } = body;
      if (!ad_group_id) return jsonRes({ success: false, error: "ad_group_id é obrigatório" });
      const newStatus = action === "pause" ? "PAUSED" : "ENABLED";
      const resourceName = `customers/${customerId}/adGroups/${ad_group_id}`;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/adGroups:mutate`,
        { method: "POST", headers, body: JSON.stringify({ operations: [{ update: { resourceName, status: newStatus }, updateMask: "status" }] }) }
      );

      const data = await res.json();
      if (!res.ok || data.error) return jsonRes({ success: false, error: data.error?.message || "Erro" });

      await supabase.from("google_ad_groups").update({ status: newStatus }).eq("tenant_id", tenantId).eq("google_ad_group_id", ad_group_id);
      return jsonRes({ success: true, data: { ad_group_id, status: newStatus } });
    }

    // UPDATE
    if (action === "update") {
      const { ad_group_id, updates, update_mask } = body;
      if (!ad_group_id || !updates) return jsonRes({ success: false, error: "ad_group_id e updates são obrigatórios" });

      const resourceName = `customers/${customerId}/adGroups/${ad_group_id}`;
      const mask = update_mask || Object.keys(updates).map(k => k.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`)).join(",");

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/adGroups:mutate`,
        { method: "POST", headers, body: JSON.stringify({ operations: [{ update: { resourceName, ...updates }, updateMask: mask }] }) }
      );

      const data = await res.json();
      if (!res.ok || data.error) return jsonRes({ success: false, error: data.error?.message || "Erro ao atualizar" });

      const localUpdates: any = { updated_at: new Date().toISOString() };
      if (updates.name) localUpdates.name = updates.name;
      if (updates.status) localUpdates.status = updates.status;
      await supabase.from("google_ad_groups").update(localUpdates).eq("tenant_id", tenantId).eq("google_ad_group_id", ad_group_id);

      return jsonRes({ success: true, data: { updated: ad_group_id } });
    }

    return jsonRes({ success: false, error: `Ação desconhecida: ${action}` });
  } catch (error) {
    console.error(`[google-ads-adgroups][${traceId}] Error:`, error);
    return jsonRes({ success: false, error: error.message || "Erro interno" });
  }
});

function jsonRes(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function tryParseErr(text: string): string {
  try { const d = JSON.parse(text); return d.error?.message || d[0]?.error?.message || "Erro na API"; } catch { return "Erro na API do Google Ads"; }
}
