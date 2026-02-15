import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: sync and update individual ads
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GRAPH_API_VERSION = "v21.0";

interface MetaConnection {
  access_token: string;
  metadata: {
    assets?: {
      ad_accounts?: Array<{ id: string; name: string }>;
    };
  };
}

async function getMetaConnection(supabase: any, tenantId: string): Promise<MetaConnection | null> {
  const { data } = await supabase
    .from("marketplace_connections")
    .select("access_token, metadata")
    .eq("tenant_id", tenantId)
    .eq("marketplace", "meta")
    .eq("is_active", true)
    .maybeSingle();
  return data;
}

async function graphApi(pathOrUrl: string, token: string, method = "GET", body?: any) {
  const options: RequestInit = { method, headers: { "Content-Type": "application/json" } };

  if (method === "GET") {
    const isAbsolute = pathOrUrl.startsWith("https://");
    let fullUrl: string;
    if (isAbsolute) {
      fullUrl = pathOrUrl;
    } else {
      const base = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pathOrUrl}`;
      const separator = pathOrUrl.includes("?") ? "&" : "?";
      fullUrl = `${base}${separator}access_token=${token}`;
    }
    const res = await fetch(fullUrl, options);
    return res.json();
  }

  if (body) {
    options.body = JSON.stringify({ ...body, access_token: token });
  }
  const url = `https://graph.facebook.com/${GRAPH_API_VERSION}/${pathOrUrl}`;
  const res = await fetch(url, options);
  return res.json();
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-ads-ads][${VERSION}][${traceId}] ${req.method}`);

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

    const conn = await getMetaConnection(supabase, tenantId);
    if (!conn) {
      return new Response(
        JSON.stringify({ success: false, error: "Meta não conectada", code: "META_NOT_CONNECTED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const adAccounts = conn.metadata?.assets?.ad_accounts || [];
    if (adAccounts.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Nenhuma conta de anúncios encontrada", code: "NO_AD_ACCOUNT" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[meta-ads-ads][${traceId}] action=${action}`);

    // ========================
    // SYNC — Pull ads from Meta
    // ========================
    if (action === "sync") {
      const filterAdsetId = body.meta_adset_id;
      const filterCampaignId = body.meta_campaign_id;
      let totalSynced = 0;

      // Get local adset IDs for FK mapping
      const { data: localAdsets } = await supabase
        .from("meta_ad_adsets")
        .select("id, meta_adset_id")
        .eq("tenant_id", tenantId);
      const adsetMap = new Map((localAdsets || []).map((a: any) => [a.meta_adset_id, a.id]));

      for (const account of adAccounts) {
        const accountId = account.id.replace("act_", "");
        let apiPath = `act_${accountId}/ads?fields=id,name,status,effective_status,adset_id,campaign_id,creative{id}&limit=200`;

        if (filterAdsetId) {
          apiPath += `&filtering=[{"field":"adset.id","operator":"EQUAL","value":"${filterAdsetId}"}]`;
        } else if (filterCampaignId) {
          apiPath += `&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${filterCampaignId}"}]`;
        }

        let nextUrl: string | null = apiPath;
        let pageCount = 0;

        while (nextUrl && pageCount < 10) {
          pageCount++;
          const result = await graphApi(nextUrl, conn.access_token);

          if (result.error) {
            console.error(`[meta-ads-ads][${traceId}] Graph API error for ${account.id}:`, result.error);
            break;
          }

          const ads = result.data || [];
          console.log(`[meta-ads-ads][${traceId}] Account ${account.id} page ${pageCount}: ${ads.length} ads`);

          for (const ad of ads) {
            const { error } = await supabase
              .from("meta_ad_ads")
              .upsert({
                tenant_id: tenantId,
                meta_ad_id: ad.id,
                meta_adset_id: ad.adset_id || "",
                meta_campaign_id: ad.campaign_id || "",
                adset_id: adsetMap.get(ad.adset_id) || null,
                ad_account_id: account.id,
                name: ad.name,
                status: ad.status || "PAUSED",
                effective_status: ad.effective_status || ad.status || "PAUSED",
                creative_id: ad.creative?.id || null,
                synced_at: new Date().toISOString(),
              }, { onConflict: "tenant_id,meta_ad_id" });

            if (error) {
              console.error(`[meta-ads-ads][${traceId}] Upsert error for ${ad.id}:`, error);
            } else {
              totalSynced++;
            }
          }

          nextUrl = result.paging?.next || null;
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced: totalSynced } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // UPDATE — Update ad on Meta + local
    // ========================
    if (action === "update") {
      const { meta_ad_id, ...updates } = body;
      if (!meta_ad_id) {
        return new Response(
          JSON.stringify({ success: false, error: "meta_ad_id obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metaUpdates: any = {};
      if (updates.name) metaUpdates.name = updates.name;
      if (updates.status) metaUpdates.status = updates.status;

      const result = await graphApi(meta_ad_id, conn.access_token, "POST", metaUpdates);

      if (result.error) {
        return new Response(
          JSON.stringify({ success: false, error: result.error.message, code: "GRAPH_API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update local
      const localUpdates: any = { synced_at: new Date().toISOString() };
      if (updates.name) localUpdates.name = updates.name;
      if (updates.status) localUpdates.status = updates.status;

      await supabase
        .from("meta_ad_ads")
        .update(localUpdates)
        .eq("tenant_id", tenantId)
        .eq("meta_ad_id", meta_ad_id);

      return new Response(
        JSON.stringify({ success: true, data: { updated: true } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[meta-ads-ads][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
