import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v2.2.0"; // Reconciliation: delete local adsets not found on Meta after sync
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

async function graphApi(path: string, token: string, method = "GET", body?: any) {
  // Support absolute URLs (e.g. pagination links from Meta)
  const isAbsolute = path.startsWith("https://");
  const baseUrl = isAbsolute ? path : `https://graph.facebook.com/${GRAPH_API_VERSION}/${path}`;
  const options: RequestInit = { method, headers: { "Content-Type": "application/json" } };

  if (method === "GET") {
    const separator = baseUrl.includes("?") ? "&" : "?";
    const fullUrl = isAbsolute ? `${baseUrl}&access_token=${token}` : `${baseUrl}${separator}access_token=${token}`;
    const res = await fetch(fullUrl, options);
    return res.json();
  }

  if (body) {
    options.body = JSON.stringify({ ...body, access_token: token });
  }
  const res = await fetch(baseUrl, options);
  return res.json();
}

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-ads-adsets][${VERSION}][${traceId}] ${req.method}`);

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

    console.log(`[meta-ads-adsets][${traceId}] action=${action}`);

    // ========================
    // SYNC — Pull ad sets from Meta for all campaigns
    // ========================
    if (action === "sync") {
      const campaignId = body.meta_campaign_id; // optional: sync specific campaign
      let totalSynced = 0;

      // Get local campaign IDs for FK mapping
      const { data: localCampaigns } = await supabase
        .from("meta_ad_campaigns")
        .select("id, meta_campaign_id")
        .eq("tenant_id", tenantId);
      const campaignMap = new Map((localCampaigns || []).map((c: any) => [c.meta_campaign_id, c.id]));

      for (const account of adAccounts) {
        const accountId = account.id.replace("act_", "");
        let apiPath = `act_${accountId}/adsets?fields=id,name,status,effective_status,campaign_id,optimization_goal,billing_event,bid_amount,daily_budget,lifetime_budget,targeting,start_time,end_time&limit=200`;

        if (campaignId) {
          apiPath += `&filtering=[{"field":"campaign.id","operator":"EQUAL","value":"${campaignId}"}]`;
        }

        const result = await graphApi(apiPath, conn.access_token);

        if (result.error) {
          console.error(`[meta-ads-adsets][${traceId}] Graph API error for ${account.id}:`, result.error);
          continue;
        }

        const adsets = result.data || [];
        for (const as of adsets) {
          const { error } = await supabase
            .from("meta_ad_adsets")
            .upsert({
              tenant_id: tenantId,
              meta_adset_id: as.id,
              meta_campaign_id: as.campaign_id,
              campaign_id: campaignMap.get(as.campaign_id) || null,
              ad_account_id: account.id,
              name: as.name,
              status: as.status || "PAUSED",
              effective_status: as.effective_status || as.status || "PAUSED",
              optimization_goal: as.optimization_goal,
              billing_event: as.billing_event,
              bid_amount_cents: as.bid_amount ? parseInt(as.bid_amount) : null,
              daily_budget_cents: as.daily_budget ? parseInt(as.daily_budget) : null,
              lifetime_budget_cents: as.lifetime_budget ? parseInt(as.lifetime_budget) : null,
              targeting: as.targeting || {},
              start_time: as.start_time || null,
              end_time: as.end_time || null,
              synced_at: new Date().toISOString(),
            }, { onConflict: "tenant_id,meta_adset_id" });

          if (error) {
            console.error(`[meta-ads-adsets][${traceId}] Upsert error for ${as.id}:`, error);
          } else {
            totalSynced++;
          }
        }
      }

      // ---- RECONCILIATION: remove local adsets not found on Meta ----
      let totalDeleted = 0;
      for (const account of adAccounts) {
        const { data: localRows } = await supabase
          .from("meta_ad_adsets")
          .select("id, meta_adset_id")
          .eq("tenant_id", tenantId)
          .eq("ad_account_id", account.id);

        if (localRows && localRows.length > 0) {
          let metaIds = new Set<string>();
          let checkUrl: string | null = `act_${account.id.replace("act_", "")}/adsets?fields=id&limit=500`;
          let checkPages = 0;
          while (checkUrl && checkPages < 10) {
            checkPages++;
            const checkResult = await graphApi(checkUrl, conn.access_token);
            if (checkResult.error) break;
            for (const a of (checkResult.data || [])) metaIds.add(a.id);
            checkUrl = checkResult.paging?.next || null;
          }

          for (const row of localRows) {
            if (!metaIds.has(row.meta_adset_id)) {
              console.log(`[meta-ads-adsets][${traceId}] Reconcile: deleting local adset ${row.meta_adset_id}`);
              await supabase.from("meta_ad_ads").delete().eq("tenant_id", tenantId).eq("meta_adset_id", row.meta_adset_id);
              await supabase.from("meta_ad_adsets").delete().eq("id", row.id);
              totalDeleted++;
            }
          }
        }
      }
      if (totalDeleted > 0) {
        console.log(`[meta-ads-adsets][${traceId}] Reconciliation: removed ${totalDeleted} orphaned adsets`);
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced: totalSynced, deleted: totalDeleted } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // UPDATE — Update ad set on Meta + local
    // ========================
    if (action === "update") {
      const { meta_adset_id, ...updates } = body;
      if (!meta_adset_id) {
        return new Response(
          JSON.stringify({ success: false, error: "meta_adset_id obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metaUpdates: any = {};
      if (updates.name) metaUpdates.name = updates.name;
      if (updates.status) metaUpdates.status = updates.status;
      if (updates.daily_budget_cents) metaUpdates.daily_budget = String(updates.daily_budget_cents);
      if (updates.bid_amount_cents) metaUpdates.bid_amount = String(updates.bid_amount_cents);

      const result = await graphApi(meta_adset_id, conn.access_token, "POST", metaUpdates);

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
      if (updates.daily_budget_cents) localUpdates.daily_budget_cents = updates.daily_budget_cents;

      await supabase
        .from("meta_ad_adsets")
        .update(localUpdates)
        .eq("tenant_id", tenantId)
        .eq("meta_adset_id", meta_adset_id);

      return new Response(
        JSON.stringify({ success: true, data: { updated: true } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // CREATE — Create ad set on Meta + local
    // ========================
    if (action === "create") {
      const {
        meta_campaign_id,
        ad_account_id: targetAcct,
        name: adsetName,
        optimization_goal,
        billing_event,
        daily_budget_cents,
        lifetime_budget_cents,
        targeting,
        bid_amount_cents,
        start_time,
        end_time,
        status: adsetStatus,
        promoted_object,
      } = body;

      const adAccountId = targetAcct || adAccounts[0].id;

      if (!meta_campaign_id || !adsetName) {
        return new Response(
          JSON.stringify({ success: false, error: "meta_campaign_id e name obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Build targeting with mandatory advantage_audience flag (Meta API requirement since 2025)
      const finalTargeting = targeting || { geo_locations: { countries: ["BR"] }, age_min: 18, age_max: 65 };
      // Ensure targeting_automation is set - Meta requires advantage_audience flag
      if (!finalTargeting.targeting_automation) {
        finalTargeting.targeting_automation = { advantage_audience: 0 };
      }

      const createBody: any = {
        name: adsetName,
        campaign_id: meta_campaign_id,
        optimization_goal: optimization_goal || "OFFSITE_CONVERSIONS",
        billing_event: billing_event || "IMPRESSIONS",
        status: adsetStatus || "PAUSED",
        targeting: finalTargeting,
      };

      if (daily_budget_cents) createBody.daily_budget = String(daily_budget_cents);
      if (lifetime_budget_cents) createBody.lifetime_budget = String(lifetime_budget_cents);
      if (bid_amount_cents) createBody.bid_amount = String(bid_amount_cents);
      if (start_time) createBody.start_time = start_time;
      if (end_time) createBody.end_time = end_time;
      if (promoted_object) createBody.promoted_object = promoted_object;

      console.log(`[meta-ads-adsets][${traceId}] Creating adset: ${adsetName} in campaign ${meta_campaign_id}`);

      const result = await graphApi(
        `act_${adAccountId.replace("act_", "")}/adsets`,
        conn.access_token,
        "POST",
        createBody
      );

      if (result.error) {
        console.error(`[meta-ads-adsets][${traceId}] Create error:`, result.error);
        return new Response(
          JSON.stringify({ success: false, error: result.error.message, code: "GRAPH_API_ERROR", details: result.error }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get local campaign FK
      const { data: localCamp } = await supabase
        .from("meta_ad_campaigns")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("meta_campaign_id", meta_campaign_id)
        .maybeSingle();

      // Save locally
      const { data: saved, error: saveErr } = await supabase
        .from("meta_ad_adsets")
        .insert({
          tenant_id: tenantId,
          meta_adset_id: result.id,
          meta_campaign_id,
          campaign_id: localCamp?.id || null,
          ad_account_id: adAccountId,
          name: adsetName,
          status: adsetStatus || "PAUSED",
          effective_status: adsetStatus || "PAUSED",
          optimization_goal: optimization_goal || "OFFSITE_CONVERSIONS",
          billing_event: billing_event || "IMPRESSIONS",
          daily_budget_cents,
          targeting: targeting || { geo_locations: { countries: ["BR"] } },
          synced_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saveErr) console.error(`[meta-ads-adsets][${traceId}] Save error:`, saveErr);

      console.log(`[meta-ads-adsets][${traceId}] Adset created: ${result.id}`);

      return new Response(
        JSON.stringify({ success: true, data: saved || { meta_adset_id: result.id } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // BALANCE — Get ad account balance/spend info
    // ========================
    if (action === "balance") {
      const results: any[] = [];
      for (const account of adAccounts) {
        const accountId = account.id.replace("act_", "");
        // Fetch balance — use only top-level fields (funding_source_details.current_balance deprecated)
        const result = await graphApi(
          `act_${accountId}?fields=balance,amount_spent,spend_cap,currency,account_status,name,funding_source_details{type,display_string},funding_source`,
          conn.access_token
        );
        if (!result.error) {
          // Map numeric funding_source_details.type to string
          // Meta types: 1=credit_card, 2=coupon, 4=bank_account, 12=paypal, 20=prepaid
          const rawType = result.funding_source_details?.type;
          let fundingType = "UNKNOWN";
          if (rawType === 1 || rawType === "1") fundingType = "CREDIT_CARD";
          else if (rawType === 20 || rawType === "20") fundingType = "PREPAID";
          else if (rawType === 4 || rawType === "4") fundingType = "BANK_ACCOUNT";
          else if (rawType === 12 || rawType === "12") fundingType = "PAYPAL";
          else if (rawType === 2 || rawType === "2") fundingType = "COUPON";
          else if (rawType != null) fundingType = `TYPE_${rawType}`;
          else if (result.funding_source) fundingType = "CREDIT_CARD"; // fallback

          const apiBalance = result.balance ? parseInt(result.balance) : 0;

          // For prepaid accounts: use |balance| from the API (represents remaining credit)
          // For credit card accounts: balance is irrelevant (post-paid)
          // Note: Meta's `balance` field is negative for prepaid (remaining credit), use Math.abs
          const balanceCents = fundingType === "CREDIT_CARD" 
            ? 0 
            : Math.abs(apiBalance);

          console.log(`[meta-ads-adsets][${traceId}] Balance ${account.id}: type=${fundingType} rawType=${rawType} balance=${balanceCents} apiBalance=${apiBalance} displayString=${result.funding_source_details?.display_string}`);

          results.push({
            id: account.id,
            name: result.name || account.name,
            balance_cents: balanceCents,
            amount_spent_cents: result.amount_spent ? parseInt(result.amount_spent) : 0,
            currency: result.currency || "BRL",
            account_status: result.account_status,
            funding_source_type: fundingType,
          });
        } else {
          console.error(`[meta-ads-adsets][${traceId}] Balance error for ${account.id}:`, result.error);
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: results }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[meta-ads-adsets][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
