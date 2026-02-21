import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.7.0"; // Fix: upsert per-chunk + campaign cache to avoid 150s timeout
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const GRAPH_API_VERSION = "v21.0";

Deno.serve(async (req) => {
  const traceId = crypto.randomUUID().substring(0, 8);
  console.log(`[meta-ads-insights][${VERSION}][${traceId}] ${req.method}`);

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

    // ========================
    // SYNC
    // ========================
    if (action === "sync") {
      const { data: conn } = await supabase
        .from("marketplace_connections")
        .select("access_token, metadata")
        .eq("tenant_id", tenantId)
        .eq("marketplace", "meta")
        .eq("is_active", true)
        .maybeSingle();

      if (!conn) {
        return new Response(
          JSON.stringify({ success: false, error: "Meta não conectada", code: "META_NOT_CONNECTED" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const adAccounts = conn.metadata?.assets?.ad_accounts || [];
      if (adAccounts.length === 0) {
        return new Response(
          JSON.stringify({ success: false, error: "Nenhuma conta de anúncios", code: "NO_AD_ACCOUNT" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const datePreset = body.date_preset || "last_30d";
      const timeRange = body.time_range;
      let totalSynced = 0;
      let totalErrors = 0;

      const presetsToSync = timeRange ? [null] : [datePreset, ...(datePreset !== "today" ? ["today"] : [])];

      // === CAMPAIGN CACHE: Load all campaigns upfront to avoid N+1 queries ===
      const campaignCache = new Map<string, string>(); // meta_campaign_id -> local id
      const { data: allCampaigns } = await supabase
        .from("meta_ad_campaigns")
        .select("id, meta_campaign_id")
        .eq("tenant_id", tenantId);
      for (const c of (allCampaigns || [])) {
        campaignCache.set(c.meta_campaign_id, c.id);
      }

      // === Fetch with full pagination ===
      const MAX_PAGES = 50;
      const PAGE_DELAY_MS = 300;

      async function fetchAllPages(accountId: string, options: { preset?: string; timeRange?: any }): Promise<{ data: any[]; error?: any }> {
        let firstUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/act_${accountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,reach,cpc,cpm,ctr,actions,action_values,cost_per_action_type,frequency&level=campaign&time_increment=1&limit=500`;
        if (options.timeRange) {
          firstUrl += `&time_range=${JSON.stringify(options.timeRange)}`;
        } else if (options.preset) {
          firstUrl += `&date_preset=${options.preset}`;
        }
        firstUrl += `&access_token=${conn.access_token}`;

        const allData: any[] = [];
        let nextUrl: string | null = firstUrl;
        let page = 0;

        while (nextUrl && page < MAX_PAGES) {
          page++;
          const res = await fetch(nextUrl);
          const result = await res.json();

          if (result.error) {
            if (page === 1) return { data: [], error: result.error };
            console.warn(`[meta-ads-insights][${traceId}] Page ${page} error, returning ${allData.length} collected:`, result.error.message);
            break;
          }

          allData.push(...(result.data || []));
          nextUrl = result.paging?.next || null;

          if (nextUrl && page < MAX_PAGES) {
            await new Promise(r => setTimeout(r, PAGE_DELAY_MS));
          }
        }
        return { data: allData };
      }

      // === Quarterly chunks ===
      function generateQuarterlyChunks(startDate: Date): Array<{ since: string; until: string }> {
        const chunks: Array<{ since: string; until: string }> = [];
        const now = new Date();
        const metaLimit = new Date();
        metaLimit.setMonth(metaLimit.getMonth() - 36);
        let current = startDate < metaLimit ? metaLimit : new Date(startDate);
        
        while (current < now) {
          const chunkEnd = new Date(current);
          chunkEnd.setMonth(chunkEnd.getMonth() + 3);
          if (chunkEnd > now) chunkEnd.setTime(now.getTime());
          chunks.push({
            since: current.toISOString().split("T")[0],
            until: chunkEnd.toISOString().split("T")[0],
          });
          current = new Date(chunkEnd);
          current.setDate(current.getDate() + 1);
        }
        return chunks;
      }

      // === Batch upsert insights (process an array of raw Meta insights) ===
      async function batchUpsertInsights(insights: any[], accountFullId: string): Promise<{ synced: number; errors: number }> {
        let synced = 0;
        let errors = 0;
        const now = new Date().toISOString();

        // Build upsert rows, auto-creating missing campaigns in batch
        const missingCampaigns = new Map<string, string>(); // meta_id -> name
        for (const i of insights) {
          if (!campaignCache.has(i.campaign_id) && i.campaign_id && i.campaign_name) {
            missingCampaigns.set(i.campaign_id, i.campaign_name);
          }
        }

        // Batch create missing campaigns
        if (missingCampaigns.size > 0) {
          const campaignRows = Array.from(missingCampaigns.entries()).map(([metaId, name]) => ({
            tenant_id: tenantId,
            meta_campaign_id: metaId,
            ad_account_id: accountFullId,
            name,
            status: "UNKNOWN",
            synced_at: now,
          }));
          
          const { data: created } = await supabase
            .from("meta_ad_campaigns")
            .upsert(campaignRows, { onConflict: "tenant_id,meta_campaign_id" })
            .select("id, meta_campaign_id");
          
          for (const c of (created || [])) {
            campaignCache.set(c.meta_campaign_id, c.id);
          }
        }

        // Build insight rows for bulk upsert (batches of 100)
        const UPSERT_BATCH = 100;
        for (let start = 0; start < insights.length; start += UPSERT_BATCH) {
          const batch = insights.slice(start, start + UPSERT_BATCH);
          const rows = batch.map(i => {
            const purchaseAction = (i.actions || []).find((a: any) => 
              a.action_type === "purchase" || 
              a.action_type === "offsite_conversion.fb_pixel_purchase" ||
              a.action_type === "omni_purchase"
            );
            const conversions = purchaseAction ? parseInt(purchaseAction.value || "0") : 0;

            const purchaseValue = (i.action_values || []).find((a: any) => 
              a.action_type === "purchase" || 
              a.action_type === "offsite_conversion.fb_pixel_purchase" ||
              a.action_type === "omni_purchase"
            );
            const conversionValueCents = purchaseValue 
              ? Math.round(parseFloat(purchaseValue.value || "0") * 100) : 0;

            const spendCents = Math.round(parseFloat(i.spend || "0") * 100);

            return {
              tenant_id: tenantId,
              campaign_id: campaignCache.get(i.campaign_id) || null,
              meta_campaign_id: i.campaign_id,
              date_start: i.date_start,
              date_stop: i.date_stop,
              impressions: parseInt(i.impressions || "0"),
              clicks: parseInt(i.clicks || "0"),
              spend_cents: spendCents,
              reach: parseInt(i.reach || "0"),
              cpc_cents: Math.round(parseFloat(i.cpc || "0") * 100),
              cpm_cents: Math.round(parseFloat(i.cpm || "0") * 100),
              ctr: parseFloat(i.ctr || "0"),
              conversions,
              conversion_value_cents: conversionValueCents,
              roas: spendCents > 0 ? conversionValueCents / spendCents : 0,
              frequency: parseFloat(i.frequency || "0"),
              actions: i.actions || [],
              synced_at: now,
            };
          });

          const { error, count } = await supabase
            .from("meta_ad_insights")
            .upsert(rows, { onConflict: "tenant_id,meta_campaign_id,date_start,date_stop", count: "exact" });

          if (error) {
            console.error(`[meta-ads-insights][${traceId}] Batch upsert error:`, error.message);
            errors += batch.length;
          } else {
            synced += batch.length;
          }
        }

        return { synced, errors };
      }

      // === Main loop: iterate accounts ===
      for (const account of adAccounts) {
        const accountId = account.id.replace("act_", "");
        
        for (const preset of presetsToSync) {
          if (timeRange) {
            const result = await fetchAllPages(accountId, { timeRange });
            if (result.error) {
              console.error(`[meta-ads-insights][${traceId}] Error ${account.id} (time_range):`, result.error);
              totalErrors++;
              continue;
            }
            const r = await batchUpsertInsights(result.data, account.id);
            totalSynced += r.synced;
            totalErrors += r.errors;
            console.log(`[meta-ads-insights][${traceId}] ${account.id} (time_range): ${result.data.length} fetched, ${r.synced} upserted`);
          } else if (preset) {
            const result = await fetchAllPages(accountId, { preset });
            
            if (result.error) {
              if (preset === "maximum" && result.error.code === 1) {
                console.warn(`[meta-ads-insights][${traceId}] ${account.id}: "maximum" too large → quarterly chunks`);
                
                const { data: earliestCampaign } = await supabase
                  .from("meta_ad_campaigns")
                  .select("start_time")
                  .eq("tenant_id", tenantId)
                  .eq("ad_account_id", account.id)
                  .not("start_time", "is", null)
                  .gt("start_time", "2010-01-01T00:00:00Z")
                  .order("start_time", { ascending: true })
                  .limit(1)
                  .maybeSingle();
                
                const startDate = earliestCampaign?.start_time 
                  ? new Date(earliestCampaign.start_time) 
                  : new Date(new Date().setFullYear(new Date().getFullYear() - 2));
                
                const chunks = generateQuarterlyChunks(startDate);
                console.log(`[meta-ads-insights][${traceId}] ${account.id}: ${chunks.length} chunks (from ${startDate.toISOString().split("T")[0]})`);
                
                for (const chunk of chunks) {
                  const chunkResult = await fetchAllPages(accountId, { 
                    timeRange: { since: chunk.since, until: chunk.until } 
                  });
                  
                  if (chunkResult.error) {
                    console.warn(`[meta-ads-insights][${traceId}] Chunk ${chunk.since}→${chunk.until} failed:`, chunkResult.error.message);
                    totalErrors++;
                    continue;
                  }
                  
                  // UPSERT PER CHUNK instead of collecting all
                  const r = await batchUpsertInsights(chunkResult.data, account.id);
                  totalSynced += r.synced;
                  totalErrors += r.errors;
                  console.log(`[meta-ads-insights][${traceId}] Chunk ${chunk.since}→${chunk.until}: ${chunkResult.data.length} fetched, ${r.synced} upserted`);
                  
                  if (chunks.indexOf(chunk) < chunks.length - 1) {
                    await new Promise(r => setTimeout(r, 500));
                  }
                }
              } else {
                console.error(`[meta-ads-insights][${traceId}] Error ${account.id} (${preset}):`, result.error);
                totalErrors++;
                continue;
              }
            } else {
              const r = await batchUpsertInsights(result.data, account.id);
              totalSynced += r.synced;
              totalErrors += r.errors;
              console.log(`[meta-ads-insights][${traceId}] ${account.id} (${preset}): ${result.data.length} fetched, ${r.synced} upserted`);
            }
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, data: { synced: totalSynced, errors: totalErrors } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST
    // ========================
    if (action === "list") {
      const campaignId = body.campaign_id || url.searchParams.get("campaign_id");
      let query = supabase
        .from("meta_ad_insights")
        .select("*, meta_ad_campaigns(name, status, objective)")
        .eq("tenant_id", tenantId)
        .order("date_start", { ascending: false })
        .limit(100);

      if (campaignId) query = query.eq("campaign_id", campaignId);

      const { data, error } = await query;
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // SUMMARY
    // ========================
    if (action === "summary") {
      const { data, error } = await supabase
        .from("meta_ad_insights")
        .select("impressions, clicks, spend_cents, reach, conversions, conversion_value_cents")
        .eq("tenant_id", tenantId);

      if (error) throw error;

      const summary = (data || []).reduce((acc, row) => ({
        impressions: acc.impressions + (row.impressions || 0),
        clicks: acc.clicks + (row.clicks || 0),
        spend_cents: acc.spend_cents + (row.spend_cents || 0),
        reach: acc.reach + (row.reach || 0),
        conversions: acc.conversions + (row.conversions || 0),
        conversion_value_cents: acc.conversion_value_cents + (row.conversion_value_cents || 0),
      }), { impressions: 0, clicks: 0, spend_cents: 0, reach: 0, conversions: 0, conversion_value_cents: 0 });

      summary.ctr = summary.impressions > 0 ? (summary.clicks / summary.impressions * 100) : 0;
      summary.roas = summary.spend_cents > 0 ? (summary.conversion_value_cents / summary.spend_cents) : 0;

      return new Response(
        JSON.stringify({ success: true, data: summary }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: `Ação desconhecida: ${action}` }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error(`[meta-ads-insights][${traceId}] Error:`, error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || "Erro interno" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
