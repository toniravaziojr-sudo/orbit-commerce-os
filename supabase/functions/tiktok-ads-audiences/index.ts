import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  console.log(`[tiktok-ads-audiences][${VERSION}][${traceId}] ${req.method}`);

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

    // ======================== SYNC ========================
    if (action === "sync") {
      const conn = await getTikTokConnection(supabase, tenantId);
      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: "TikTok Ads não conectado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const advertiserId = conn.advertiser_id;
      let allAudiences: any[] = [];
      let page = 1;
      const pageSize = 100;

      while (true) {
        const url = `${TIKTOK_API}/dmp/custom_audience/list/?advertiser_id=${advertiserId}&page=${page}&page_size=${pageSize}`;
        const res = await fetch(url, {
          headers: { "Access-Token": conn.access_token },
        });
        const result = await res.json();

        if (result.code !== 0) {
          console.error(`[tiktok-ads-audiences][${traceId}] API error:`, result);
          return new Response(
            JSON.stringify({ success: false, error: result.message || "Erro na API do TikTok" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const list = result.data?.list || [];
        allAudiences = allAudiences.concat(list);

        if (list.length < pageSize || allAudiences.length >= 500) break;
        page++;
      }

      let synced = 0;
      for (const a of allAudiences) {
        const { error } = await supabase
          .from("tiktok_ad_audiences")
          .upsert({
            tenant_id: tenantId,
            tiktok_audience_id: String(a.custom_audience_id || a.audience_id),
            advertiser_id: advertiserId,
            name: a.name || "Sem nome",
            audience_type: a.audience_type || "custom",
            cover_num: a.cover_num || 0,
            is_valid: a.is_valid !== false,
            is_expired: a.is_expired === true,
            rules: a.rules || {},
            metadata: { calculate_type: a.calculate_type, source: a.source },
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,tiktok_audience_id" });

        if (!error) synced++;
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: allAudiences.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======================== LIST ========================
    if (action === "list") {
      const { data, error } = await supabase
        .from("tiktok_ad_audiences")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======================== CREATE ========================
    if (action === "create") {
      const conn = await getTikTokConnection(supabase, tenantId);
      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: "TikTok Ads não conectado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${TIKTOK_API}/dmp/custom_audience/create/`, {
        method: "POST",
        headers: {
          "Access-Token": conn.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          advertiser_id: conn.advertiser_id,
          custom_audience_name: body.name,
          audience_type: body.audience_type || "CUSTOMER_FILE",
          ...(body.rules ? { rules: body.rules } : {}),
        }),
      });
      const result = await res.json();

      if (result.code !== 0) {
        return new Response(
          JSON.stringify({ success: false, error: result.message || "Erro ao criar público" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ success: true, data: result.data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ======================== DELETE ========================
    if (action === "delete") {
      const conn = await getTikTokConnection(supabase, tenantId);
      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: "TikTok Ads não conectado" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const res = await fetch(`${TIKTOK_API}/dmp/custom_audience/delete/`, {
        method: "POST",
        headers: {
          "Access-Token": conn.access_token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          advertiser_id: conn.advertiser_id,
          custom_audience_ids: [body.tiktok_audience_id],
        }),
      });
      const result = await res.json();

      if (result.code !== 0) {
        return new Response(
          JSON.stringify({ success: false, error: result.message || "Erro ao excluir público" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Remove from local cache
      await supabase
        .from("tiktok_ad_audiences")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("tiktok_audience_id", body.tiktok_audience_id);

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-ads-audiences][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: (error as any).message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
