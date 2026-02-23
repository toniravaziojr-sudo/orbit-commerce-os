import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // CRUD: create, sync, list, pause, activate keywords
// ===================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GOOGLE_ADS_API_VERSION = "v18";

// Auth helpers
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
  await supabase.from("google_connections").update({ access_token: data.access_token, token_expires_at: new Date(Date.now() + (data.expires_in || 3600) * 1000).toISOString() }).eq("tenant_id", tenantId);
  return data.access_token;
}

async function getValidToken(supabase: any, tenantId: string) {
  const { data: conn } = await supabase.from("google_connections").select("access_token, refresh_token, token_expires_at, scope_packs, assets, is_active")
    .eq("tenant_id", tenantId).eq("is_active", true).maybeSingle();
  if (!conn || !conn.scope_packs?.includes("ads")) return null;
  let token = conn.access_token;
  if (conn.token_expires_at && new Date(conn.token_expires_at) < new Date() && conn.refresh_token) {
    const t = await refreshAccessToken(supabase, tenantId, conn.refresh_token); if (!t) return null; token = t;
  }
  return { token, conn };
}

async function getAdsHeaders(supabaseUrl: string, supabaseServiceKey: string, token: string) {
  const devToken = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_DEVELOPER_TOKEN");
  if (!devToken) return null;
  const loginCustomerId = await getCredential(supabaseUrl, supabaseServiceKey, "GOOGLE_ADS_LOGIN_CUSTOMER_ID");
  const h: Record<string, string> = { "Authorization": `Bearer ${token}`, "developer-token": devToken, "Content-Type": "application/json" };
  if (loginCustomerId) h["login-customer-id"] = loginCustomerId.replace(/-/g, "");
  return h;
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[google-ads-keywords][${VERSION}][${traceId}] ${req.method}`);
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
      const q = supabase.from("google_ad_keywords").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (body.ad_group_id) q.eq("google_ad_group_id", body.ad_group_id);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return jsonRes({ success: true, data });
    }

    // Auth
    const auth = await getValidToken(supabase, tenantId);
    if (!auth) return jsonRes({ success: false, error: "Google Ads não conectado" });
    const headers = await getAdsHeaders(supabaseUrl, supabaseServiceKey, auth.token);
    if (!headers) return jsonRes({ success: false, error: "GOOGLE_ADS_DEVELOPER_TOKEN não configurado" });
    const customerId = (body.customer_id || auth.conn.assets?.ad_accounts?.[0]?.id || "").replace(/-/g, "");
    if (!customerId) return jsonRes({ success: false, error: "Nenhuma conta encontrada" });

    // SYNC
    if (action === "sync") {
      const agFilter = body.ad_group_id ? `AND ad_group.id = '${body.ad_group_id}'` : "";
      const query = `
        SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text,
               ad_group_criterion.keyword.match_type, ad_group_criterion.status,
               ad_group_criterion.cpc_bid_micros,
               ad_group_criterion.quality_info.quality_score,
               ad_group_criterion.quality_info.creative_quality_score,
               ad_group_criterion.quality_info.post_click_quality_score,
               ad_group_criterion.quality_info.search_predicted_ctr,
               ad_group.id
        FROM ad_group_criterion
        WHERE ad_group_criterion.type = 'KEYWORD'
          AND ad_group_criterion.status != 'REMOVED'
          ${agFilter}
        ORDER BY ad_group_criterion.keyword.text
      `;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
        { method: "POST", headers, body: JSON.stringify({ query }) }
      );

      if (!res.ok) {
        const errText = await res.text();
        return jsonRes({ success: false, error: tryParseErr(errText) });
      }

      const results = JSON.parse(await res.text());
      let allRows: any[] = [];
      for (const batch of results) { if (batch.results) allRows = allRows.concat(batch.results); }

      let synced = 0;
      for (const row of allRows) {
        const c = row.adGroupCriterion;
        if (!c?.criterionId) continue;

        const { error } = await supabase.from("google_ad_keywords").upsert({
          tenant_id: tenantId, google_criterion_id: c.criterionId,
          google_ad_group_id: row.adGroup?.id || "", ad_account_id: customerId,
          keyword_text: c.keyword?.text || "", match_type: c.keyword?.matchType || "BROAD",
          status: c.status || "ENABLED",
          cpc_bid_micros: c.cpcBidMicros ? parseInt(c.cpcBidMicros) : null,
          quality_score: c.qualityInfo?.qualityScore || null,
          quality_info: c.qualityInfo ? {
            creative_quality: c.qualityInfo.creativeQualityScore,
            post_click_quality: c.qualityInfo.postClickQualityScore,
            search_predicted_ctr: c.qualityInfo.searchPredictedCtr,
          } : null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,google_criterion_id" });
        if (!error) synced++;
      }

      return jsonRes({ success: true, data: { synced, total: allRows.length } });
    }

    // CREATE — Add keywords to ad group
    if (action === "create") {
      const { ad_group_id, keywords } = body;
      // keywords: [{text, match_type, cpc_bid_micros?}]
      if (!ad_group_id || !keywords?.length) {
        return jsonRes({ success: false, error: "ad_group_id e keywords são obrigatórios" });
      }

      const adGroupResourceName = `customers/${customerId}/adGroups/${ad_group_id}`;
      const operations = keywords.map((kw: any) => ({
        create: {
          adGroup: adGroupResourceName,
          status: "ENABLED",
          keyword: { text: kw.text, matchType: kw.match_type || "BROAD" },
          ...(kw.cpc_bid_micros ? { cpcBidMicros: String(kw.cpc_bid_micros) } : {}),
        }
      }));

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/adGroupCriteria:mutate`,
        { method: "POST", headers, body: JSON.stringify({ operations }) }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error(`[google-ads-keywords][${traceId}] Create error:`, JSON.stringify(data));
        return jsonRes({ success: false, error: data.error?.message || "Erro ao criar keywords" });
      }

      // Cache locally
      const created: string[] = [];
      for (let i = 0; i < (data.results || []).length; i++) {
        const rn = data.results[i]?.resourceName;
        const criterionId = rn?.split("~").pop();
        if (criterionId) {
          created.push(criterionId);
          const kw = keywords[i];
          await supabase.from("google_ad_keywords").upsert({
            tenant_id: tenantId, google_criterion_id: criterionId,
            google_ad_group_id: ad_group_id, ad_account_id: customerId,
            keyword_text: kw.text, match_type: kw.match_type || "BROAD",
            status: "ENABLED", cpc_bid_micros: kw.cpc_bid_micros || null,
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,google_criterion_id" });
        }
      }

      return jsonRes({ success: true, data: { created: created.length, criterion_ids: created } });
    }

    // PAUSE / ACTIVATE
    if (action === "pause" || action === "activate") {
      const { ad_group_id, criterion_id } = body;
      if (!ad_group_id || !criterion_id) return jsonRes({ success: false, error: "ad_group_id e criterion_id são obrigatórios" });

      const newStatus = action === "pause" ? "PAUSED" : "ENABLED";
      const resourceName = `customers/${customerId}/adGroupCriteria/${ad_group_id}~${criterion_id}`;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/adGroupCriteria:mutate`,
        { method: "POST", headers, body: JSON.stringify({ operations: [{ update: { resourceName, status: newStatus }, updateMask: "status" }] }) }
      );

      const data = await res.json();
      if (!res.ok || data.error) return jsonRes({ success: false, error: data.error?.message || "Erro" });

      await supabase.from("google_ad_keywords").update({ status: newStatus }).eq("tenant_id", tenantId).eq("google_criterion_id", criterion_id);
      return jsonRes({ success: true, data: { criterion_id, status: newStatus } });
    }

    // REMOVE
    if (action === "remove") {
      const { ad_group_id, criterion_id } = body;
      if (!ad_group_id || !criterion_id) return jsonRes({ success: false, error: "ad_group_id e criterion_id são obrigatórios" });

      const resourceName = `customers/${customerId}/adGroupCriteria/${ad_group_id}~${criterion_id}`;
      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/adGroupCriteria:mutate`,
        { method: "POST", headers, body: JSON.stringify({ operations: [{ remove: resourceName }] }) }
      );

      const data = await res.json();
      if (!res.ok || data.error) return jsonRes({ success: false, error: data.error?.message || "Erro" });

      await supabase.from("google_ad_keywords").update({ status: "REMOVED" }).eq("tenant_id", tenantId).eq("google_criterion_id", criterion_id);
      return jsonRes({ success: true, data: { removed: criterion_id } });
    }

    return jsonRes({ success: false, error: `Ação desconhecida: ${action}` });
  } catch (error) {
    console.error(`[google-ads-keywords][${traceId}] Error:`, error);
    return jsonRes({ success: false, error: error.message || "Erro interno" });
  }
});

function jsonRes(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function tryParseErr(text: string): string {
  try { const d = JSON.parse(text); return d.error?.message || d[0]?.error?.message || "Erro na API"; } catch { return "Erro na API"; }
}
