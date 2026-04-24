import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TIKTOK_API = "https://business-api.tiktok.com/open_api/v1.3";

async function getTikTokConnection(supabase: any, tenantId: string) {
  const { data } = await supabase
    .from("tiktok_ads_connections")
    .select("*")
    .eq("tenant_id", tenantId)
    .eq("status", "active")
    .maybeSingle();
  return data;
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[tiktok-ads-assets][${VERSION}][${traceId}] ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json();
    const action = body.action || "list";
    const tenantId = body.tenant_id;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: "tenant_id obrigatório" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======================== SYNC IMAGES ========================
    if (action === "sync") {
      const conn = await getTikTokConnection(supabase, tenantId);
      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: "TikTok Ads não conectado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const advertiserId = conn.advertiser_id;
      let allAssets: any[] = [];

      // Sync images
      let page = 1;
      while (true) {
        const url = `${TIKTOK_API}/file/image/ad/get/?advertiser_id=${advertiserId}&page=${page}&page_size=100`;
        const res = await fetch(url, {
          headers: { "Access-Token": conn.access_token },
        });
        const result = await res.json();

        if (result.code !== 0) {
          console.error(`[tiktok-ads-assets][${traceId}] Image API error:`, result);
          break;
        }

        const list = result.data?.list || [];
        for (const img of list) {
          allAssets.push({
            tenant_id: tenantId,
            tiktok_asset_id: img.image_id || img.id,
            advertiser_id: advertiserId,
            asset_type: "image",
            file_name: img.file_name || img.image_name || null,
            file_url: img.image_url || img.url || null,
            width: img.width || 0,
            height: img.height || 0,
            duration: 0,
            file_size: img.size || img.file_size || 0,
            format: img.format || null,
            signature: img.signature || img.md5 || null,
            metadata: { create_time: img.create_time, modify_time: img.modify_time },
            synced_at: new Date().toISOString(),
          });
        }

        if (list.length < 100 || allAssets.length >= 500) break;
        page++;
      }

      // Sync videos
      page = 1;
      while (true) {
        const url = `${TIKTOK_API}/file/video/ad/get/?advertiser_id=${advertiserId}&page=${page}&page_size=100`;
        const res = await fetch(url, {
          headers: { "Access-Token": conn.access_token },
        });
        const result = await res.json();

        if (result.code !== 0) {
          console.error(`[tiktok-ads-assets][${traceId}] Video API error:`, result);
          break;
        }

        const list = result.data?.list || [];
        for (const vid of list) {
          allAssets.push({
            tenant_id: tenantId,
            tiktok_asset_id: vid.video_id || vid.id,
            advertiser_id: advertiserId,
            asset_type: "video",
            file_name: vid.file_name || vid.video_name || null,
            file_url: vid.preview_url || vid.video_url || null,
            width: vid.width || 0,
            height: vid.height || 0,
            duration: vid.duration || 0,
            file_size: vid.size || vid.file_size || 0,
            format: vid.format || null,
            signature: vid.signature || vid.md5 || null,
            metadata: { create_time: vid.create_time, modify_time: vid.modify_time, bit_rate: vid.bit_rate },
            synced_at: new Date().toISOString(),
          });
        }

        if (list.length < 100 || allAssets.length >= 1000) break;
        page++;
      }

      let synced = 0;
      for (const asset of allAssets) {
        const { error } = await supabase
          .from("tiktok_ad_assets")
          .upsert(asset, { onConflict: "tenant_id,tiktok_asset_id" });
        if (!error) synced++;
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: allAssets.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======================== LIST ========================
    if (action === "list") {
      const assetType = body.asset_type;
      let query = supabase
        .from("tiktok_ad_assets")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false })
        .limit(200);

      if (assetType) {
        query = query.eq("asset_type", assetType);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======================== UPLOAD IMAGE ========================
    if (action === "upload_image") {
      const conn = await getTikTokConnection(supabase, tenantId);
      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: "TikTok Ads não conectado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!body.image_url) {
        return new Response(
          JSON.stringify({ success: false, error: "image_url obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${TIKTOK_API}/file/image/ad/upload/`, {
        method: "POST",
        headers: {
          "Access-Token": conn.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          advertiser_id: conn.advertiser_id,
          upload_type: "UPLOAD_BY_URL",
          image_url: body.image_url,
          file_name: body.file_name || "upload.jpg",
        }),
      });
      const result = await res.json();

      if (result.code !== 0) {
        return new Response(
          JSON.stringify({ success: false, error: result.message || "Erro ao fazer upload" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: result.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======================== UPLOAD VIDEO ========================
    if (action === "upload_video") {
      const conn = await getTikTokConnection(supabase, tenantId);
      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: "TikTok Ads não conectado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!body.video_url) {
        return new Response(
          JSON.stringify({ success: false, error: "video_url obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${TIKTOK_API}/file/video/ad/upload/`, {
        method: "POST",
        headers: {
          "Access-Token": conn.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          advertiser_id: conn.advertiser_id,
          upload_type: "UPLOAD_BY_URL",
          video_url: body.video_url,
          file_name: body.file_name || "upload.mp4",
        }),
      });
      const result = await res.json();

      if (result.code !== 0) {
        return new Response(
          JSON.stringify({ success: false, error: result.message || "Erro ao fazer upload" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: result.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-ads-assets][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: (error as any).message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
