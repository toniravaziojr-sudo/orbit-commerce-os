import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

async function getTikTokConnection(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("tiktok_ads_connections")
    .select("access_token, advertiser_id, advertiser_name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true)
    .eq("connection_status", "connected")
    .maybeSingle();
  if (!data?.access_token || !data?.advertiser_id) return null;
  return data;
}

async function tiktokApi(path: string, token: string, method = "GET", body?: any) {
  const url = `${TIKTOK_API_BASE}${path}`;
  const headers: Record<string, string> = { "Access-Token": token, "Content-Type": "application/json" };
  const options: RequestInit = { method, headers };
  if (body && method !== "GET") options.body = JSON.stringify(body);
  const res = await fetch(url, options);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { code: -1, message: text }; }
}

function ok(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[tiktok-ads-ads][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = req.method === "POST" ? await req.json() : {};
    const url = new URL(req.url);
    const action = body.action || url.searchParams.get("action") || "list";
    const tenantId = body.tenant_id || url.searchParams.get("tenant_id");

    if (!tenantId) return ok({ success: false, error: "tenant_id obrigatório" });

    const conn = await getTikTokConnection(supabase, tenantId);
    if (!conn) return ok({ success: false, error: "TikTok Ads não conectado", code: "TIKTOK_NOT_CONNECTED" });

    const advertiserId = body.advertiser_id || conn.advertiser_id;
    console.log(`[tiktok-ads-ads][${traceId}] action=${action} advertiser=${advertiserId}`);

    // ======================== SYNC ========================
    if (action === "sync") {
      const adgroupIds = body.adgroup_ids;
      let path = `/ad/get/?advertiser_id=${advertiserId}&page_size=100&fields=["ad_id","adgroup_id","campaign_id","ad_name","operation_status","ad_format","ad_text","landing_page_url","call_to_action","image_ids","video_id","display_name","identity_id","identity_type","tracking_pixel_id","deeplink"]`;
      if (adgroupIds?.length) path += `&filtering={"adgroup_ids":${JSON.stringify(adgroupIds)}}`;

      const result = await tiktokApi(path, conn.access_token);
      if (result.code !== 0) return ok({ success: false, error: result.message || "Erro na API TikTok", code: "TIKTOK_API_ERROR" });

      const ads = result.data?.list || [];
      let synced = 0;

      for (const ad of ads) {
        const { data: localAdgroup } = await supabase
          .from("tiktok_ad_groups")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("tiktok_adgroup_id", String(ad.adgroup_id))
          .maybeSingle();

        const { error } = await supabase
          .from("tiktok_ad_ads")
          .upsert({
            tenant_id: tenantId,
            tiktok_ad_id: String(ad.ad_id),
            adgroup_id: localAdgroup?.id || null,
            tiktok_adgroup_id: String(ad.adgroup_id),
            tiktok_campaign_id: String(ad.campaign_id),
            advertiser_id: advertiserId,
            name: ad.ad_name,
            status: ad.operation_status || "ENABLE",
            ad_format: ad.ad_format,
            ad_text: ad.ad_text,
            landing_page_url: ad.landing_page_url,
            call_to_action: ad.call_to_action,
            image_ids: ad.image_ids || [],
            video_id: ad.video_id,
            display_name: ad.display_name,
            identity_id: ad.identity_id,
            identity_type: ad.identity_type,
            tracking_pixel_id: ad.tracking_pixel_id,
            deeplink: ad.deeplink,
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,tiktok_ad_id" });

        if (error) console.error(`[tiktok-ads-ads][${traceId}] Upsert error:`, error);
        else synced++;
      }

      return ok({ success: true, data: { synced, total: ads.length } });
    }

    // ======================== LIST ========================
    if (action === "list") {
      let query = supabase.from("tiktok_ad_ads").select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
      if (body.tiktok_adgroup_id) query = query.eq("tiktok_adgroup_id", body.tiktok_adgroup_id);
      if (body.tiktok_campaign_id) query = query.eq("tiktok_campaign_id", body.tiktok_campaign_id);
      const { data, error } = await query;
      if (error) throw error;
      return ok({ success: true, data });
    }

    // ======================== CREATE ========================
    if (action === "create") {
      const { name, tiktok_adgroup_id, ad_format, ad_text, landing_page_url, call_to_action, image_ids, video_id, display_name, identity_id, identity_type, tracking_pixel_id, deeplink, status: adStatus } = body;

      if (!name || !tiktok_adgroup_id) return ok({ success: false, error: "name e tiktok_adgroup_id obrigatórios" });

      const createBody: any = {
        advertiser_id: advertiserId,
        adgroup_id: tiktok_adgroup_id,
        ad_name: name,
        ad_format: ad_format || "SINGLE_VIDEO",
        operation_status: adStatus || "DISABLE",
      };
      if (ad_text) createBody.ad_text = ad_text;
      if (landing_page_url) createBody.landing_page_url = landing_page_url;
      if (call_to_action) createBody.call_to_action = call_to_action;
      if (image_ids?.length) createBody.image_ids = image_ids;
      if (video_id) createBody.video_id = video_id;
      if (display_name) createBody.display_name = display_name;
      if (identity_id) createBody.identity_id = identity_id;
      if (identity_type) createBody.identity_type = identity_type;
      if (tracking_pixel_id) createBody.tracking_pixel_id = tracking_pixel_id;
      if (deeplink) createBody.deeplink = deeplink;

      const result = await tiktokApi("/ad/create/", conn.access_token, "POST", createBody);
      if (result.code !== 0) return ok({ success: false, error: result.message || "Erro ao criar anúncio", code: "TIKTOK_API_ERROR" });

      const tiktokAdId = String(result.data?.ad_id);

      // Get adgroup to find campaign_id
      const { data: localAdgroup } = await supabase.from("tiktok_ad_groups").select("id, tiktok_campaign_id").eq("tenant_id", tenantId).eq("tiktok_adgroup_id", tiktok_adgroup_id).maybeSingle();

      const { data: saved } = await supabase
        .from("tiktok_ad_ads")
        .insert({
          tenant_id: tenantId,
          tiktok_ad_id: tiktokAdId,
          adgroup_id: localAdgroup?.id || null,
          tiktok_adgroup_id,
          tiktok_campaign_id: localAdgroup?.tiktok_campaign_id || "",
          advertiser_id: advertiserId,
          name,
          status: adStatus || "DISABLE",
          ad_format: ad_format || "SINGLE_VIDEO",
          ad_text,
          landing_page_url,
          call_to_action,
          image_ids: image_ids || [],
          video_id,
          display_name,
          identity_id,
          identity_type,
          tracking_pixel_id,
          deeplink,
          synced_at: new Date().toISOString(),
        })
        .select().single();

      return ok({ success: true, data: saved || { tiktok_ad_id: tiktokAdId } });
    }

    // ======================== UPDATE ========================
    if (action === "update") {
      const { tiktok_ad_id, name, status: adStatus, ad_text, landing_page_url, call_to_action } = body;
      if (!tiktok_ad_id) return ok({ success: false, error: "tiktok_ad_id obrigatório" });

      const updateBody: any = { advertiser_id: advertiserId, ad_id: tiktok_ad_id };
      if (name) updateBody.ad_name = name;
      if (adStatus) updateBody.operation_status = adStatus;
      if (ad_text) updateBody.ad_text = ad_text;
      if (landing_page_url) updateBody.landing_page_url = landing_page_url;
      if (call_to_action) updateBody.call_to_action = call_to_action;

      const result = await tiktokApi("/ad/update/", conn.access_token, "POST", updateBody);
      if (result.code !== 0) return ok({ success: false, error: result.message || "Erro ao atualizar", code: "TIKTOK_API_ERROR" });

      const localUpdates: any = { synced_at: new Date().toISOString() };
      if (name) localUpdates.name = name;
      if (adStatus) localUpdates.status = adStatus;
      if (ad_text) localUpdates.ad_text = ad_text;
      if (landing_page_url) localUpdates.landing_page_url = landing_page_url;

      await supabase.from("tiktok_ad_ads").update(localUpdates).eq("tenant_id", tenantId).eq("tiktok_ad_id", tiktok_ad_id);

      return ok({ success: true, data: { updated: true } });
    }

    // ======================== DELETE ========================
    if (action === "delete") {
      const { tiktok_ad_id } = body;
      if (!tiktok_ad_id) return ok({ success: false, error: "tiktok_ad_id obrigatório" });

      await tiktokApi("/ad/update/status/", conn.access_token, "POST", {
        advertiser_id: advertiserId,
        ad_ids: [tiktok_ad_id],
        operation_status: "DELETE",
      });

      await supabase.from("tiktok_ad_ads").delete().eq("tenant_id", tenantId).eq("tiktok_ad_id", tiktok_ad_id);

      return ok({ success: true, data: { deleted: true } });
    }

    return ok({ success: false, error: `Ação desconhecida: ${action}` });
  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'tiktok', action: 'ads-ads' });
  }
});
