import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.5.0"; // Fix: chunked fallback when maximum date_preset fails for large accounts
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
    // SYNC — Pull insights from Meta for all campaigns (ALL accounts)
    // ========================
    if (action === "sync") {
      // FIX: use correct column names (marketplace, is_active)
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

      // Sync both the requested preset AND today to ensure current-day data
      const presetsToSync = timeRange ? [null] : [datePreset, ...(datePreset !== "today" ? ["today"] : [])];

      // Helper: fetch insights for a specific time_range or preset
      async function fetchInsightsPage(accountId: string, options: { preset?: string; timeRange?: any }): Promise<{ data: any[]; error?: any }> {
        let insightsUrl = `act_${accountId}/insights?fields=campaign_id,campaign_name,impressions,clicks,spend,reach,cpc,cpm,ctr,actions,action_values,cost_per_action_type,frequency&level=campaign&time_increment=1&limit=500`;
        if (options.timeRange) {
          insightsUrl += `&time_range=${JSON.stringify(options.timeRange)}`;
        } else if (options.preset) {
          insightsUrl += `&date_preset=${options.preset}`;
        }
        const graphUrl = `https://graph.facebook.com/${GRAPH_API_VERSION}/${insightsUrl}&access_token=${conn.access_token}`;
        const res = await fetch(graphUrl);
        const result = await res.json();
        if (result.error) return { data: [], error: result.error };
        return { data: result.data || [] };
      }

      // Helper: generate quarterly chunks from a start date to today
      // Meta API limits to 37 months back, so we enforce that as minimum
      function generateQuarterlyChunks(startDate: Date): Array<{ since: string; until: string }> {
        const chunks: Array<{ since: string; until: string }> = [];
        const now = new Date();
        // Meta API hard limit: 37 months back
        const metaLimit = new Date();
        metaLimit.setMonth(metaLimit.getMonth() - 36); // 36 months = safe margin under 37
        
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

      // Iterate ALL ad accounts
      for (const account of adAccounts) {
        const accountId = account.id.replace("act_", "");
        
        for (const preset of presetsToSync) {
          let insights: any[] = [];

          if (timeRange) {
            const result = await fetchInsightsPage(accountId, { timeRange });
            if (result.error) {
              console.error(`[meta-ads-insights][${traceId}] Graph API error for ${account.id} (time_range):`, result.error);
              totalErrors++;
              continue;
            }
            insights = result.data;
          } else if (preset) {
            const result = await fetchInsightsPage(accountId, { preset });
            
            if (result.error) {
              // v1.5.0: If "maximum" fails due to data volume, fallback to quarterly chunks
              if (preset === "maximum" && result.error.code === 1) {
                console.warn(`[meta-ads-insights][${traceId}] Account ${account.id}: "maximum" too large, falling back to quarterly chunks...`);
                
                // Determine start date from earliest known campaign (filter out epoch-0 dates)
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
                console.log(`[meta-ads-insights][${traceId}] Account ${account.id}: ${chunks.length} quarterly chunks (earliest campaign: ${startDate.toISOString().split("T")[0]}, first chunk: ${chunks[0]?.since || "none"})`);
                
                for (const chunk of chunks) {
                  const chunkResult = await fetchInsightsPage(accountId, { 
                    timeRange: { since: chunk.since, until: chunk.until } 
                  });
                  
                  if (chunkResult.error) {
                    console.warn(`[meta-ads-insights][${traceId}] Chunk ${chunk.since}→${chunk.until} failed for ${account.id}:`, chunkResult.error.message);
                    totalErrors++;
                    continue;
                  }
                  
                  insights.push(...chunkResult.data);
                  console.log(`[meta-ads-insights][${traceId}] Chunk ${chunk.since}→${chunk.until}: ${chunkResult.data.length} insights`);
                  
                  // Small delay to avoid rate limiting
                  if (chunks.indexOf(chunk) < chunks.length - 1) {
                    await new Promise(r => setTimeout(r, 1000));
                  }
                }
                
                console.log(`[meta-ads-insights][${traceId}] Account ${account.id} total from chunks: ${insights.length} insights`);
              } else {
                console.error(`[meta-ads-insights][${traceId}] Graph API error for ${account.id} (${preset}):`, result.error);
                totalErrors++;
                continue;
              }
            } else {
              insights = result.data;
            }
          }

          console.log(`[meta-ads-insights][${traceId}] Account ${account.id} (${preset || "time_range"}): ${insights.length} insights`);

          for (const i of insights) {
            // Find local campaign
            let { data: localCampaign } = await supabase
              .from("meta_ad_campaigns")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("meta_campaign_id", i.campaign_id)
              .maybeSingle();

            // AUTO-CREATE missing campaign from insight data
            if (!localCampaign && i.campaign_id && i.campaign_name) {
              console.log(`[meta-ads-insights][${traceId}] Auto-creating missing campaign: ${i.campaign_name} (${i.campaign_id})`);
              const { data: created } = await supabase
                .from("meta_ad_campaigns")
                .upsert({
                  tenant_id: tenantId,
                  meta_campaign_id: i.campaign_id,
                  ad_account_id: account.id,
                  name: i.campaign_name,
                  status: "UNKNOWN",
                  synced_at: new Date().toISOString(),
                }, { onConflict: "tenant_id,meta_campaign_id" })
                .select("id")
                .maybeSingle();
              localCampaign = created;
            }

            // Extract conversions count from actions
            const purchaseAction = (i.actions || []).find((a: any) => 
              a.action_type === "purchase" || 
              a.action_type === "offsite_conversion.fb_pixel_purchase" ||
              a.action_type === "omni_purchase"
            );
            const conversions = purchaseAction ? parseInt(purchaseAction.value || "0") : 0;

            // Extract conversion VALUE from action_values (revenue)
            const purchaseValue = (i.action_values || []).find((a: any) => 
              a.action_type === "purchase" || 
              a.action_type === "offsite_conversion.fb_pixel_purchase" ||
              a.action_type === "omni_purchase"
            );
            const conversionValueCents = purchaseValue 
              ? Math.round(parseFloat(purchaseValue.value || "0") * 100) 
              : 0;

            const spendCents = Math.round(parseFloat(i.spend || "0") * 100);
            const cpcCents = Math.round(parseFloat(i.cpc || "0") * 100);
            const cpmCents = Math.round(parseFloat(i.cpm || "0") * 100);
            const roas = spendCents > 0 ? conversionValueCents / spendCents : 0;

            const { error } = await supabase
              .from("meta_ad_insights")
              .upsert({
                tenant_id: tenantId,
                campaign_id: localCampaign?.id || null,
                meta_campaign_id: i.campaign_id,
                date_start: i.date_start,
                date_stop: i.date_stop,
                impressions: parseInt(i.impressions || "0"),
                clicks: parseInt(i.clicks || "0"),
                spend_cents: spendCents,
                reach: parseInt(i.reach || "0"),
                cpc_cents: cpcCents,
                cpm_cents: cpmCents,
                ctr: parseFloat(i.ctr || "0"),
                conversions,
                conversion_value_cents: conversionValueCents,
                roas,
                frequency: parseFloat(i.frequency || "0"),
                actions: i.actions || [],
                synced_at: new Date().toISOString(),
              }, { onConflict: "tenant_id,meta_campaign_id,date_start,date_stop" });

            if (error) {
              console.error(`[meta-ads-insights][${traceId}] Upsert error:`, error);
              totalErrors++;
            } else {
              totalSynced++;
            }
          }
        } // end presetsToSync
      } // end adAccounts

      return new Response(
        JSON.stringify({ success: true, data: { synced: totalSynced, errors: totalErrors } }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // LIST — From local cache
    // ========================
    if (action === "list") {
      const campaignId = body.campaign_id || url.searchParams.get("campaign_id");
      let query = supabase
        .from("meta_ad_insights")
        .select("*, meta_ad_campaigns(name, status, objective)")
        .eq("tenant_id", tenantId)
        .order("date_start", { ascending: false })
        .limit(100);

      if (campaignId) {
        query = query.eq("campaign_id", campaignId);
      }

      const { data, error } = await query;
      if (error) throw error;

      return new Response(
        JSON.stringify({ success: true, data }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ========================
    // SUMMARY — Aggregated metrics
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
