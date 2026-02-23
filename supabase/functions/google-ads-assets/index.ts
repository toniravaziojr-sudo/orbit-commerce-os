import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCredential } from "../_shared/platform-credentials.ts";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Asset management: create image/text assets, link to campaigns (PMax), sync, list
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
  console.log(`[google-ads-assets][${VERSION}][${traceId}] ${req.method}`);
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
      const q = supabase.from("google_ad_assets").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (body.asset_type) q.eq("asset_type", body.asset_type);
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

    // SYNC — Pull assets from Google Ads
    if (action === "sync") {
      const query = `
        SELECT asset.id, asset.name, asset.type, asset.text_asset, asset.image_asset,
               asset.youtube_video_asset, asset.lead_form_asset, asset.policy_summary
        FROM asset
        WHERE asset.type IN ('IMAGE', 'TEXT', 'YOUTUBE_VIDEO', 'MEDIA_BUNDLE', 'LEAD_FORM')
        ORDER BY asset.id
        LIMIT 500
      `;

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/googleAds:searchStream`,
        { method: "POST", headers, body: JSON.stringify({ query }) }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.error(`[google-ads-assets][${traceId}] Sync error:`, errText);
        return jsonRes({ success: false, error: tryParseErr(errText) });
      }

      const results = JSON.parse(await res.text());
      let allRows: any[] = [];
      for (const batch of results) { if (batch.results) allRows = allRows.concat(batch.results); }

      let synced = 0;
      for (const row of allRows) {
        const a = row.asset;
        if (!a?.id) continue;

        const upsertData: any = {
          tenant_id: tenantId, google_asset_id: a.id, ad_account_id: customerId,
          asset_type: a.type, asset_name: a.name || null,
          policy_summary: a.policySummary || null,
          synced_at: new Date().toISOString(),
        };

        if (a.textAsset) upsertData.text_content = a.textAsset.text;
        if (a.imageAsset) {
          upsertData.image_url = a.imageAsset.fullSize?.url || null;
          upsertData.metadata = { file_size: a.imageAsset.fileSize, mime_type: a.imageAsset.mimeType };
        }
        if (a.youtubeVideoAsset) upsertData.youtube_video_id = a.youtubeVideoAsset.youtubeVideoId;

        const { error } = await supabase.from("google_ad_assets").upsert(upsertData, { onConflict: "tenant_id,google_asset_id" });
        if (!error) synced++;
      }

      return jsonRes({ success: true, data: { synced, total: allRows.length } });
    }

    // CREATE IMAGE ASSET — Upload image from URL
    if (action === "create_image") {
      const { image_url, asset_name } = body;
      if (!image_url) return jsonRes({ success: false, error: "image_url é obrigatório" });

      // Download image and convert to base64
      const imgRes = await fetch(image_url);
      if (!imgRes.ok) return jsonRes({ success: false, error: "Não foi possível baixar a imagem" });
      const imgBuffer = await imgRes.arrayBuffer();
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(imgBuffer)));

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/assets:mutate`,
        {
          method: "POST", headers,
          body: JSON.stringify({
            operations: [{
              create: {
                name: asset_name || `Image ${Date.now()}`,
                type: "IMAGE",
                imageAsset: { data: base64Data },
              }
            }]
          })
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error(`[google-ads-assets][${traceId}] Create image error:`, JSON.stringify(data));
        return jsonRes({ success: false, error: data.error?.message || "Erro ao criar asset de imagem" });
      }

      const resourceName = data.results?.[0]?.resourceName;
      const assetId = resourceName?.split("/").pop();

      if (assetId) {
        await supabase.from("google_ad_assets").upsert({
          tenant_id: tenantId, google_asset_id: assetId, ad_account_id: customerId,
          asset_type: "IMAGE", asset_name: asset_name || null, image_url,
          synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,google_asset_id" });
      }

      return jsonRes({ success: true, data: { google_asset_id: assetId, resource_name: resourceName } });
    }

    // CREATE TEXT ASSET
    if (action === "create_text") {
      const { text, asset_name, field_type } = body;
      if (!text) return jsonRes({ success: false, error: "text é obrigatório" });

      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/assets:mutate`,
        {
          method: "POST", headers,
          body: JSON.stringify({
            operations: [{
              create: {
                name: asset_name || `Text ${Date.now()}`,
                type: "TEXT",
                textAsset: { text },
              }
            }]
          })
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error(`[google-ads-assets][${traceId}] Create text error:`, JSON.stringify(data));
        return jsonRes({ success: false, error: data.error?.message || "Erro ao criar asset de texto" });
      }

      const resourceName = data.results?.[0]?.resourceName;
      const assetId = resourceName?.split("/").pop();

      if (assetId) {
        await supabase.from("google_ad_assets").upsert({
          tenant_id: tenantId, google_asset_id: assetId, ad_account_id: customerId,
          asset_type: "TEXT", asset_name: asset_name || null, text_content: text,
          field_type: field_type || null, synced_at: new Date().toISOString(),
        }, { onConflict: "tenant_id,google_asset_id" });
      }

      return jsonRes({ success: true, data: { google_asset_id: assetId, resource_name: resourceName } });
    }

    // LINK ASSET TO CAMPAIGN (PMax asset groups)
    if (action === "link_to_campaign") {
      const { campaign_id, asset_id, field_type } = body;
      if (!campaign_id || !asset_id || !field_type) {
        return jsonRes({ success: false, error: "campaign_id, asset_id e field_type são obrigatórios" });
      }

      // For PMax, assets are linked via CampaignAsset
      const res = await fetch(
        `https://googleads.googleapis.com/${GOOGLE_ADS_API_VERSION}/customers/${customerId}/campaignAssets:mutate`,
        {
          method: "POST", headers,
          body: JSON.stringify({
            operations: [{
              create: {
                asset: `customers/${customerId}/assets/${asset_id}`,
                campaign: `customers/${customerId}/campaigns/${campaign_id}`,
                fieldType: field_type, // HEADLINE, DESCRIPTION, MARKETING_IMAGE, etc.
              }
            }]
          })
        }
      );

      const data = await res.json();
      if (!res.ok || data.error) {
        console.error(`[google-ads-assets][${traceId}] Link error:`, JSON.stringify(data));
        return jsonRes({ success: false, error: data.error?.message || "Erro ao vincular asset" });
      }

      return jsonRes({ success: true, data: { linked: true, campaign_id, asset_id, field_type } });
    }

    return jsonRes({ success: false, error: `Ação desconhecida: ${action}` });
  } catch (error) {
    console.error(`[google-ads-assets][${traceId}] Error:`, error);
    return jsonRes({ success: false, error: error.message || "Erro interno" });
  }
});

function jsonRes(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
function tryParseErr(text: string): string {
  try { const d = JSON.parse(text); return d.error?.message || d[0]?.error?.message || "Erro na API"; } catch { return "Erro na API"; }
}
