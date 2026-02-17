import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.3.0"; // Fix: pagination using absolute next URL from Meta Graph API
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
      pages?: Array<{ id: string; name: string; access_token?: string }>;
    };
    scope_packs?: string[];
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
  const options: RequestInit = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  
  if (method === "GET") {
    // Support absolute URLs (pagination next) or relative paths
    const isAbsolute = pathOrUrl.startsWith("https://");
    let fullUrl: string;
    if (isAbsolute) {
      // Already has access_token from Meta pagination
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
  console.log(`[meta-ads-campaigns][${VERSION}][${traceId}] ${req.method}`);

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

    const targetAccountId = body.ad_account_id;
    console.log(`[meta-ads-campaigns][${traceId}] action=${action} targetAccount=${targetAccountId || 'all'}`);

    // ========================
    // SYNC — Pull campaigns from Meta into local cache (all accounts or specific)
    // ========================
    if (action === "sync") {
      const accountsToSync = targetAccountId 
        ? adAccounts.filter((a: any) => a.id === targetAccountId)
        : adAccounts;
      
      let totalSynced = 0;
      let totalCampaigns = 0;

      for (const account of accountsToSync) {
        const accountId = account.id.replace("act_", "");
        console.log(`[meta-ads-campaigns][${traceId}] Syncing account: ${account.name} (act_${accountId})`);
        
        // Paginate through ALL campaigns (Meta returns max 100 per page)
        let nextUrl: string | null = `act_${accountId}/campaigns?fields=id,name,status,effective_status,objective,buying_type,daily_budget,lifetime_budget,bid_strategy,start_time,stop_time,special_ad_categories&limit=100`;
        let pageCount = 0;

        while (nextUrl && pageCount < 10) { // Safety: max 10 pages (1000 campaigns per account)
          pageCount++;
          const result = await graphApi(nextUrl, conn.access_token);

          if (result.error) {
            console.error(`[meta-ads-campaigns][${traceId}] Graph API error for ${account.id}:`, result.error);
            break;
          }

          const campaigns = result.data || [];
          totalCampaigns += campaigns.length;
          console.log(`[meta-ads-campaigns][${traceId}] Account ${account.id} page ${pageCount}: ${campaigns.length} campaigns`);

          for (const c of campaigns) {
            const { error } = await supabase
              .from("meta_ad_campaigns")
              .upsert({
                tenant_id: tenantId,
                meta_campaign_id: c.id,
                ad_account_id: account.id,
                name: c.name,
                status: c.status || "PAUSED",
                effective_status: c.effective_status || c.status || "PAUSED",
                objective: c.objective,
                buying_type: c.buying_type,
                daily_budget_cents: c.daily_budget ? parseInt(c.daily_budget) : null,
                lifetime_budget_cents: c.lifetime_budget ? parseInt(c.lifetime_budget) : null,
                bid_strategy: c.bid_strategy,
                start_time: c.start_time || null,
                stop_time: c.stop_time || null,
                special_ad_categories: c.special_ad_categories || [],
                synced_at: new Date().toISOString(),
              }, { onConflict: "tenant_id,meta_campaign_id" });

            if (error) {
              console.error(`[meta-ads-campaigns][${traceId}] Upsert error for ${c.id}:`, error);
            } else {
              totalSynced++;
            }
          }

          // Check for next page — use absolute URL directly
          nextUrl = result.paging?.next || null;
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced: totalSynced, total: totalCampaigns } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const statusFilter = body.status || url.searchParams.get("status");
      let query = supabase
        .from("meta_ad_campaigns")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });

      if (statusFilter) {
        query = query.eq("status", statusFilter);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // CREATE — Create campaign on Meta + local
    // ========================
    if (action === "create") {
      const { name, objective, status: campaignStatus, daily_budget_cents, lifetime_budget_cents, special_ad_categories, bid_strategy, start_time, stop_time } = body;
      const adAccountId = targetAccountId || adAccounts[0].id;

      if (!name || !objective) {
        return new Response(
          JSON.stringify({ success: false, error: "name e objective obrigatórios" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const createBody: any = {
        name,
        objective,
        status: campaignStatus || "PAUSED",
        special_ad_categories: special_ad_categories || [],
        bid_strategy: bid_strategy || "LOWEST_COST_WITHOUT_CAP",
      };

      if (daily_budget_cents) createBody.daily_budget = String(daily_budget_cents);
      if (lifetime_budget_cents) createBody.lifetime_budget = String(lifetime_budget_cents);
      if (start_time) createBody.start_time = start_time;
      if (stop_time) createBody.stop_time = stop_time;

      const result = await graphApi(
        `act_${adAccountId.replace("act_", "")}/campaigns`,
        conn.access_token,
        "POST",
        createBody
      );

      if (result.error) {
        return new Response(
          JSON.stringify({ success: false, error: result.error.message, code: "GRAPH_API_ERROR" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Save locally
      const { data: saved, error: saveErr } = await supabase
        .from("meta_ad_campaigns")
        .insert({
          tenant_id: tenantId,
          meta_campaign_id: result.id,
          ad_account_id: adAccountId,
          name,
          objective,
          status: campaignStatus || "PAUSED",
          daily_budget_cents,
          lifetime_budget_cents,
          special_ad_categories: special_ad_categories || [],
          start_time: start_time || null,
          stop_time: stop_time || null,
          synced_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (saveErr) console.error(`[meta-ads-campaigns][${traceId}] Save error:`, saveErr);

      return new Response(
        JSON.stringify({ success: true, data: saved || { meta_campaign_id: result.id } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // UPDATE — Update campaign on Meta + local
    // ========================
    if (action === "update") {
      const { campaign_id, meta_campaign_id, ...updates } = body;
      const metaId = meta_campaign_id;

      if (!metaId) {
        return new Response(
          JSON.stringify({ success: false, error: "meta_campaign_id obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const metaUpdates: any = {};
      if (updates.name) metaUpdates.name = updates.name;
      if (updates.status) metaUpdates.status = updates.status;
      if (updates.daily_budget_cents) metaUpdates.daily_budget = String(updates.daily_budget_cents);

      const result = await graphApi(metaId, conn.access_token, "POST", metaUpdates);

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
        .from("meta_ad_campaigns")
        .update(localUpdates)
        .eq("tenant_id", tenantId)
        .eq("meta_campaign_id", metaId);

      return new Response(
        JSON.stringify({ success: true, data: { updated: true } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // DELETE — Pause on Meta (Meta doesn't allow true delete)
    // ========================
    if (action === "delete") {
      const { meta_campaign_id } = body;
      if (!meta_campaign_id) {
        return new Response(
          JSON.stringify({ success: false, error: "meta_campaign_id obrigatório" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Archive on Meta
      await graphApi(meta_campaign_id, conn.access_token, "POST", { status: "ARCHIVED" });

      // Remove local
      await supabase
        .from("meta_ad_campaigns")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("meta_campaign_id", meta_campaign_id);

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
    console.error(`[meta-ads-campaigns][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
