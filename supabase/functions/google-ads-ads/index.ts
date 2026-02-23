import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // CRUD: create RSA/RDA, sync, list, pause, activate
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
    const t = await refreshAccessToken(supabase, tenantId, conn.refresh_token);
    if (!t) return null;
    token = t;
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
  console.log(`[google-ads-ads][${VERSION}][${traceId}] ${req.method}`);
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
      const q = supabase.from("google_ad_ads").select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
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
        SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.ad.type,
               ad_group_ad.ad.final_urls, ad_group_ad.ad.display_url,
               ad_group_ad.status, ad_group_ad.ad.responsive_search_ad,
               ad_group_ad.ad.responsive_display_ad,
               ad_group_ad.ad_strength, ad_group_ad.policy_summary,
               ad_group.id
        FROM ad_group_ad
        WHERE ad_group_ad.status != 'REMOVED' ${agFilter}
        ORDER BY ad_group_ad.ad.name
      `;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
        { method: "POST", headers, body: JSON.stringify({ query }) }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[google-ads-ads][${traceId}] Sync error:`, errText);
        return jsonRes({ success: false, error: tryParseErr(errText) });
      }

      const results = JSON.parse(await res.text());
      let allRows: any[] = [];
      for (const batch of results) { if (batch.results) allRows = allRows.concat(batch.results); }

      let synced = 0;
      for (const row of allRows) {
        const ad = row.adGroupAd?.ad;
        if (!ad?.id) continue;

        // Extract headlines/descriptions from RSA
        let headlinesJson = null;
        let descriptionsJson = null;
        let path1 = null;
        let path2 = null;

        if (ad.responsiveSearchAd) {
          headlinesJson = ad.responsiveSearchAd.headlines || [];
          descriptionsJson = ad.responsiveSearchAd.descriptions || [];
          path1 = ad.responsiveSearchAd.path1 || null;
          path2 = ad.responsiveSearchAd.path2 || null;
        } else if (ad.responsiveDisplayAd) {
          headlinesJson = ad.responsiveDisplayAd.headlines || [];
          descriptionsJson = ad.responsiveDisplayAd.descriptions || [];
        }

        const { error } = await supabase.from("google_ad_ads").upsert({
          tenant_id: tenantId, google_ad_id: ad.id, google_ad_group_id: row.adGroup?.id || "",
          ad_account_id: customerId, name: ad.name || null,
          ad_type: ad.type || "RESPONSIVE_SEARCH_AD",
          status: row.adGroupAd?.status || "ENABLED",
          final_urls: ad.finalUrls || [],
          headlines: headlinesJson, descriptions: descriptionsJson,
          display_url: ad.displayUrl || null, path1, path2,
          ad_strength: row.adGroupAd?.adStrength || null,
          policy_summary: row.adGroupAd?.policySummary || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,google_ad_id" });
        if (!error) synced++;
      }

      return jsonRes({ success: true, data: { synced, total: allRows.length } });
    }

    // CREATE — Responsive Search Ad (RSA) or Responsive Display Ad (RDA)
    if (action === "create") {
      const { ad_group_id, ad_type = "RESPONSIVE_SEARCH_AD", final_urls, headlines, descriptions,
              path1, path2, status = "ENABLED",
              // RDA specific
              marketing_images, square_marketing_images, logos, long_headline, business_name } = body;

      if (!ad_group_id || !final_urls?.length) {
        return jsonRes({ success: false, error: "ad_group_id e final_urls são obrigatórios" });
      }

      const adGroupResourceName = `customers/${customerId}/adGroups/${ad_group_id}`;
      const adPayload: any = { finalUrls: final_urls };

      if (ad_type === "RESPONSIVE_SEARCH_AD") {
        if (!headlines?.length || !descriptions?.length) {
          return jsonRes({ success: false, error: "headlines e descriptions são obrigatórios para RSA" });
        }
        adPayload.responsiveSearchAd = {
          headlines: headlines.map((h: any) => typeof h === "string" ? { text: h } : h),
          descriptions: descriptions.map((d: any) => typeof d === "string" ? { text: d } : d),
        };
        if (path1) adPayload.responsiveSearchAd.path1 = path1;
        if (path2) adPayload.responsiveSearchAd.path2 = path2;
      } else if (ad_type === "RESPONSIVE_DISPLAY_AD") {
        adPayload.responsiveDisplayAd = {
          headlines: (headlines || []).map((h: any) => typeof h === "string" ? { text: h } : h),
          descriptions: (descriptions || []).map((d: any) => typeof d === "string" ? { text: d } : d),
          longHeadline: typeof long_headline === "string" ? { text: long_headline } : long_headline,
          businessName: business_name || "",
        };
        if (marketing_images?.length) adPayload.responsiveDisplayAd.marketingImages = marketing_images;
        if (square_marketing_images?.length) adPayload.responsiveDisplayAd.squareMarketingImages = square_marketing_images;
        if (logos?.length) adPayload.responsiveDisplayAd.logoImages = logos;
      }

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/adGroupAds:mutate`,
        {
          method: "POST", headers,
          body: JSON.stringify({
            operations: [{ create: { adGroup: adGroupResourceName, status, ad: adPayload } }]
          })
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error(`[google-ads-ads][${traceId}] Create error:`, JSON.stringify(data));
        return jsonRes({ success: false, error: data.error?.message || "Erro ao criar anúncio" });
      }

      const resourceName = data.results?.[0]?.resourceName;
      // resourceName format: customers/CID/adGroupAds/AGID~ADID
      const adId = resourceName?.split("~").pop();

      if (adId) {
        await supabase.from("google_ad_ads").upsert({
          tenant_id: tenantId, google_ad_id: adId, google_ad_group_id: ad_group_id,
          ad_account_id: customerId, ad_type, status, final_urls,
          headlines: headlines || null, descriptions: descriptions || null,
          path1: path1 || null, path2: path2 || null,
          synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,google_ad_id" });
      }

      return jsonRes({ success: true, data: { google_ad_id: adId, resource_name: resourceName } });
    }

    // PAUSE / ACTIVATE
    if (action === "pause" || action === "activate") {
      const { ad_group_id, ad_id } = body;
      if (!ad_group_id || !ad_id) return jsonRes({ success: false, error: "ad_group_id e ad_id são obrigatórios" });

      const newStatus = action === "pause" ? "PAUSED" : "ENABLED";
      const resourceName = `customers/${customerId}/adGroupAds/${ad_group_id}~${ad_id}`;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/adGroupAds:mutate`,
        { method: "POST", headers, body: JSON.stringify({ operations: [{ update: { resourceName, status: newStatus }, updateMask: "status" }] }) }
      );

      const data = await res.json();
      if (!res.ok || data.error) return jsonRes({ success: false, error: data.error?.message || "Erro" });

      await supabase.from("google_ad_ads").update({ status: newStatus }).eq("tenant_id", tenantId).eq("google_ad_id", ad_id);
      return jsonRes({ success: true, data: { ad_id, status: newStatus } });
    }

    return jsonRes({ success: false, error: `Ação desconhecida: ${action}` });
  } catch (error) {
    console.error(`[google-ads-ads][${traceId}] Error:`, error);
    return jsonRes({ success: false, error: error.message || "Erro interno" });
  }
});

function jsonRes(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function tryParseErr(text: string): string {
  try { const d = JSON.parse(text); return d.error?.message || d[0]?.error?.message || "Erro na API"; } catch { return "Erro na API"; }
}
