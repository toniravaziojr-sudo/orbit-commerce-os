import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.0.0"; // Initial: CRUD campaigns + sync from TikTok
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const TIKTOK_API_BASE = "https://business-api.tiktok.com/open_api/v1.3";

interface TikTokAdsConnection {
  access_token: string;
  advertiser_id: string;
  advertiser_name: string | null;
}

async function getTikTokConnection(supabase: any, tenantId: string): Promise<TikTokAdsConnection | null> {
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
  const headers: Record<string, string> = {
    "Access-Token": token,
    "Content-Type": "application/json",
  };

  const options: RequestInit = { method, headers };
  if (body && method !== "GET") {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(url, options);
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { code: -1, message: text };
  }
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[tiktok-ads-campaigns][${VERSION}][${traceId}] ${req.method}`);

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

    const conn = await getTikTokConnection(supabase, tenantId);
    if (!conn) {
      return new Response(
        JSON.stringify({ success: false, error: "TikTok Ads não conectado", code: "TIKTOK_NOT_CONNECTED" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const advertiserId = body.advertiser_id || conn.advertiser_id;
    console.log(`[tiktok-ads-campaigns][${traceId}] action=${action} advertiser=${advertiserId}`);

    // ========================
    // SYNC — Pull campaigns from TikTok into local cache
    // ========================
    if (action === "sync") {
      const result = await tiktokApi(
        `/campaign/get/?advertiser_id=${advertiserId}&page_size=100&fields=["campaign_id","campaign_name","operation_status","objective_type","budget_mode","budget","bid_type","optimize_goal","create_time","modify_time","campaign_type","special_industries"]`,
        conn.access_token
      );

      if (result.code !== 0) {
        console.error(`[tiktok-ads-campaigns][${traceId}] API error:`, result);
        return new Response(
          JSON.stringify({ success: false, error: result.message || "Erro na API TikTok", code: "TIKTOK_API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const campaigns = result.data?.list || [];
      let synced = 0;

      for (const c of campaigns) {
        const budgetCents = c.budget ? Math.round(parseFloat(c.budget) * 100) : null;

        const { error } = await supabase
          .from("tiktok_ad_campaigns")
          .upsert({
            tenant_id: tenantId,
            tiktok_campaign_id: String(c.campaign_id),
            advertiser_id: advertiserId,
            name: c.campaign_name,
            status: c.operation_status || "CAMPAIGN_STATUS_NOT_DELETE",
            objective_type: c.objective_type,
            budget_mode: c.budget_mode,
            budget_cents: budgetCents,
            bid_type: c.bid_type,
            optimize_goal: c.optimize_goal,
            campaign_type: c.campaign_type,
            special_industries: c.special_industries || [],
            metadata: { create_time: c.create_time, modify_time: c.modify_time },
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,tiktok_campaign_id" });

        if (error) {
          console.error(`[tiktok-ads-campaigns][${traceId}] Upsert error for ${c.campaign_id}:`, error);
        } else {
          synced++;
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced, total: campaigns.length } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const { data, error } = await supabase
        .from("tiktok_ad_campaigns")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // CREATE — Create campaign on TikTok + local
    // ========================
    if (action === "create") {
      const { name, objective_type, budget_mode, budget_cents, status: campaignStatus } = body;

      if (!name || !objective_type) {
        return new Response(
          JSON.stringify({ success: false, error: "name e objective_type obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const createBody: any = {
        advertiser_id: advertiserId,
        campaign_name: name,
        objective_type,
        budget_mode: budget_mode || "BUDGET_MODE_INFINITE",
        operation_status: campaignStatus || "DISABLE",
      };
      if (budget_cents) createBody.budget = (budget_cents / 100).toFixed(2);

      const result = await tiktokApi("/campaign/create/", conn.access_token, "POST", createBody);

      if (result.code !== 0) {
        return new Response(
          JSON.stringify({ success: false, error: result.message || "Erro ao criar campanha", code: "TIKTOK_API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const tiktokCampaignId = String(result.data?.campaign_id);

      const { data: saved, error: saveErr } = await supabase
        .from("tiktok_ad_campaigns")
        .insert({
          tenant_id: tenantId,
          tiktok_campaign_id: tiktokCampaignId,
          advertiser_id: advertiserId,
          name,
          objective_type,
          budget_mode: budget_mode || "BUDGET_MODE_INFINITE",
          budget_cents,
          status: campaignStatus || "DISABLE",
          synced_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saveErr) console.error(`[tiktok-ads-campaigns][${traceId}] Save error:`, saveErr);

      return new Response(
        JSON.stringify({ success: true, data: saved || { tiktok_campaign_id: tiktokCampaignId } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // UPDATE — Update campaign on TikTok + local
    // ========================
    if (action === "update") {
      const { tiktok_campaign_id, name, status: campaignStatus, budget_cents } = body;

      if (!tiktok_campaign_id) {
        return new Response(
          JSON.stringify({ success: false, error: "tiktok_campaign_id obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const updateBody: any = {
        advertiser_id: advertiserId,
        campaign_id: tiktok_campaign_id,
      };
      if (name) updateBody.campaign_name = name;
      if (campaignStatus) updateBody.operation_status = campaignStatus;
      if (budget_cents) updateBody.budget = (budget_cents / 100).toFixed(2);

      const result = await tiktokApi("/campaign/update/", conn.access_token, "POST", updateBody);

      if (result.code !== 0) {
        return new Response(
          JSON.stringify({ success: false, error: result.message || "Erro ao atualizar", code: "TIKTOK_API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const localUpdates: any = { synced_at: new Date().toISOString() };
      if (name) localUpdates.name = name;
      if (campaignStatus) localUpdates.status = campaignStatus;
      if (budget_cents) localUpdates.budget_cents = budget_cents;

      await supabase
        .from("tiktok_ad_campaigns")
        .update(localUpdates)
        .eq("tenant_id", tenantId)
        .eq("tiktok_campaign_id", tiktok_campaign_id);

      return new Response(
        JSON.stringify({ success: true, data: { updated: true } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // DELETE — Disable on TikTok
    // ========================
    if (action === "delete") {
      const { tiktok_campaign_id } = body;
      if (!tiktok_campaign_id) {
        return new Response(
          JSON.stringify({ success: false, error: "tiktok_campaign_id obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      await tiktokApi("/campaign/update/status/", conn.access_token, "POST", {
        advertiser_id: advertiserId,
        campaign_ids: [tiktok_campaign_id],
        operation_status: "DELETE",
      });

      await supabase
        .from("tiktok_ad_campaigns")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("tiktok_campaign_id", tiktok_campaign_id);

      return new Response(
        JSON.stringify({ success: true, data: { deleted: true } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[tiktok-ads-campaigns][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
