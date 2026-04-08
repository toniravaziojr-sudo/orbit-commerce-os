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
  console.log(`[tiktok-ads-adgroups][${VERSION}][${traceId}] ${req.method}`);

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
    console.log(`[tiktok-ads-adgroups][${traceId}] action=${action} advertiser=${advertiserId}`);

    // ======================== SYNC ========================
    if (action === "sync") {
      const campaignIds = body.campaign_ids; // optional filter
      let path = `/adgroup/get/?advertiser_id=${advertiserId}&page_size=100&fields=["adgroup_id","campaign_id","adgroup_name","operation_status","promotion_type","placement_type","bid_type","bid","budget_mode","budget","optimize_goal","billing_event","schedule_start_time","schedule_end_time","targeting"]`;
      if (campaignIds?.length) path += `&filtering={"campaign_ids":${JSON.stringify(campaignIds)}}`;

      const result = await tiktokApi(path, conn.access_token);
      if (result.code !== 0) return ok({ success: false, error: result.message || "Erro na API TikTok", code: "TIKTOK_API_ERROR" });

      const adgroups = result.data?.list || [];
      let synced = 0;

      for (const ag of adgroups) {
        const budgetCents = ag.budget ? Math.round(parseFloat(ag.budget) * 100) : null;
        const bidCents = ag.bid ? Math.round(parseFloat(ag.bid) * 100) : null;

        // Try to find local campaign reference
        const { data: localCampaign } = await supabase
          .from("tiktok_ad_campaigns")
          .select("id")
          .eq("tenant_id", tenantId)
          .eq("tiktok_campaign_id", String(ag.campaign_id))
          .maybeSingle();

        const { error } = await supabase
          .from("tiktok_ad_groups")
          .upsert({
            tenant_id: tenantId,
            tiktok_adgroup_id: String(ag.adgroup_id),
            campaign_id: localCampaign?.id || null,
            tiktok_campaign_id: String(ag.campaign_id),
            advertiser_id: advertiserId,
            name: ag.adgroup_name,
            status: ag.operation_status || "ENABLE",
            promotion_type: ag.promotion_type,
            placement_type: ag.placement_type,
            bid_type: ag.bid_type,
            bid_price_cents: bidCents,
            budget_mode: ag.budget_mode,
            budget_cents: budgetCents,
            optimize_goal: ag.optimize_goal,
            billing_event: ag.billing_event,
            schedule_start_time: ag.schedule_start_time,
            schedule_end_time: ag.schedule_end_time,
            targeting: ag.targeting || {},
            synced_at: new Date().toISOString(),
          }, { onConflict: "tenant_id,tiktok_adgroup_id" });

        if (error) console.error(`[tiktok-ads-adgroups][${traceId}] Upsert error:`, error);
        else synced++;
      }

      return ok({ success: true, data: { synced, total: adgroups.length } });
    }

    // ======================== LIST ========================
    if (action === "list") {
      let query = supabase.from("tiktok_ad_groups").select("*").eq("tenant_id", tenantId).order("updated_at", { ascending: false });
      if (body.tiktok_campaign_id) query = query.eq("tiktok_campaign_id", body.tiktok_campaign_id);
      const { data, error } = await query;
      if (error) throw error;
      return ok({ success: true, data });
    }

    // ======================== CREATE ========================
    if (action === "create") {
      const { name, tiktok_campaign_id, promotion_type, placement_type, bid_type, bid_price_cents, budget_mode, budget_cents, optimize_goal, billing_event, targeting, status: agStatus } = body;

      if (!name || !tiktok_campaign_id) return ok({ success: false, error: "name e tiktok_campaign_id obrigatórios" });

      const createBody: any = {
        advertiser_id: advertiserId,
        campaign_id: tiktok_campaign_id,
        adgroup_name: name,
        promotion_type: promotion_type || "WEBSITE",
        placement_type: placement_type || "PLACEMENT_TYPE_AUTOMATIC",
        budget_mode: budget_mode || "BUDGET_MODE_INFINITE",
        optimize_goal: optimize_goal || "CLICK",
        billing_event: billing_event || "CPC",
        operation_status: agStatus || "DISABLE",
      };
      if (bid_price_cents) createBody.bid = (bid_price_cents / 100).toFixed(2);
      if (budget_cents) createBody.budget = (budget_cents / 100).toFixed(2);
      if (bid_type) createBody.bid_type = bid_type;
      if (targeting) createBody.targeting = targeting;

      const result = await tiktokApi("/adgroup/create/", conn.access_token, "POST", createBody);
      if (result.code !== 0) return ok({ success: false, error: result.message || "Erro ao criar ad group", code: "TIKTOK_API_ERROR" });

      const tiktokAdgroupId = String(result.data?.adgroup_id);

      const { data: localCampaign } = await supabase.from("tiktok_ad_campaigns").select("id").eq("tenant_id", tenantId).eq("tiktok_campaign_id", tiktok_campaign_id).maybeSingle();

      const { data: saved } = await supabase
        .from("tiktok_ad_groups")
        .insert({
          tenant_id: tenantId,
          tiktok_adgroup_id: tiktokAdgroupId,
          campaign_id: localCampaign?.id || null,
          tiktok_campaign_id,
          advertiser_id: advertiserId,
          name,
          status: agStatus || "DISABLE",
          promotion_type: promotion_type || "WEBSITE",
          placement_type: placement_type || "PLACEMENT_TYPE_AUTOMATIC",
          bid_type,
          bid_price_cents,
          budget_mode: budget_mode || "BUDGET_MODE_INFINITE",
          budget_cents,
          optimize_goal: optimize_goal || "CLICK",
          billing_event: billing_event || "CPC",
          targeting: targeting || {},
          synced_at: new Date().toISOString(),
        })
        .select().single();

      return ok({ success: true, data: saved || { tiktok_adgroup_id: tiktokAdgroupId } });
    }

    // ======================== UPDATE ========================
    if (action === "update") {
      const { tiktok_adgroup_id, name, status: agStatus, budget_cents, bid_price_cents } = body;
      if (!tiktok_adgroup_id) return ok({ success: false, error: "tiktok_adgroup_id obrigatório" });

      const updateBody: any = { advertiser_id: advertiserId, adgroup_id: tiktok_adgroup_id };
      if (name) updateBody.adgroup_name = name;
      if (agStatus) updateBody.operation_status = agStatus;
      if (budget_cents) updateBody.budget = (budget_cents / 100).toFixed(2);
      if (bid_price_cents) updateBody.bid = (bid_price_cents / 100).toFixed(2);

      const result = await tiktokApi("/adgroup/update/", conn.access_token, "POST", updateBody);
      if (result.code !== 0) return ok({ success: false, error: result.message || "Erro ao atualizar", code: "TIKTOK_API_ERROR" });

      const localUpdates: any = { synced_at: new Date().toISOString() };
      if (name) localUpdates.name = name;
      if (agStatus) localUpdates.status = agStatus;
      if (budget_cents) localUpdates.budget_cents = budget_cents;
      if (bid_price_cents) localUpdates.bid_price_cents = bid_price_cents;

      await supabase.from("tiktok_ad_groups").update(localUpdates).eq("tenant_id", tenantId).eq("tiktok_adgroup_id", tiktok_adgroup_id);

      return ok({ success: true, data: { updated: true } });
    }

    // ======================== DELETE ========================
    if (action === "delete") {
      const { tiktok_adgroup_id } = body;
      if (!tiktok_adgroup_id) return ok({ success: false, error: "tiktok_adgroup_id obrigatório" });

      await tiktokApi("/adgroup/update/status/", conn.access_token, "POST", {
        advertiser_id: advertiserId,
        adgroup_ids: [tiktok_adgroup_id],
        operation_status: "DELETE",
      });

      await supabase.from("tiktok_ad_groups").delete().eq("tenant_id", tenantId).eq("tiktok_adgroup_id", tiktok_adgroup_id);

      return ok({ success: true, data: { deleted: true } });
    }

    return ok({ success: false, error: `Ação desconhecida: ${action}` });
  } catch (error) {
    return errorResponse(error, corsHeaders, { module: 'tiktok', action: 'ads-adgroups' });
  }
});
