import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR AO FAZER MUDANÇAS =====
const VERSION = "v1.1.0"; // Fix: use last_7d instead of today to catch attribution delays
// ===========================================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[sync-ads-dashboard][${VERSION}] Starting sync`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const stats = {
    meta: { tenants: 0, success: 0, errors: 0 },
    google: { tenants: 0, success: 0, errors: 0 },
    tiktok: { tenants: 0, success: 0, errors: 0 },
    duration_ms: 0,
  };

  const startTime = Date.now();

  try {
    // 1. Find all tenants with active Meta connections that have ad accounts
    const { data: metaTenants } = await supabase
      .from("marketplace_connections")
      .select("tenant_id")
      .eq("marketplace", "meta")
      .eq("is_active", true);

    // 2. Find all tenants with active Google Ads connections
    const { data: googleTenants } = await supabase
      .from("google_connections")
      .select("tenant_id")
      .eq("is_active", true);

    // 3. Find all tenants with active TikTok Ads connections
    const { data: tiktokTenants } = await supabase
      .from("tiktok_ads_connections")
      .select("tenant_id")
      .eq("is_active", true)
      .eq("connection_status", "connected");

    // Deduplicate tenant IDs
    const metaIds = [...new Set((metaTenants || []).map((t) => t.tenant_id))];
    const googleIds = [...new Set((googleTenants || []).map((t) => t.tenant_id))];
    const tiktokIds = [...new Set((tiktokTenants || []).map((t) => t.tenant_id))];

    stats.meta.tenants = metaIds.length;
    stats.google.tenants = googleIds.length;
    stats.tiktok.tenants = tiktokIds.length;

    console.log(
      `[sync-ads-dashboard] Tenants found: Meta=${metaIds.length}, Google=${googleIds.length}, TikTok=${tiktokIds.length}`
    );

    // Helper to call a sync function
    async function callSync(
      functionName: string,
      tenantId: string,
      platform: "meta" | "google" | "tiktok"
    ) {
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            action: "sync",
            tenant_id: tenantId,
            date_preset: "last_7d",
          }),
        });

        if (response.ok) {
          stats[platform].success++;
          console.log(`[sync-ads-dashboard] ${platform}/${tenantId}: OK`);
        } else {
          stats[platform].errors++;
          const text = await response.text();
          console.error(`[sync-ads-dashboard] ${platform}/${tenantId}: ${response.status} - ${text.substring(0, 200)}`);
        }
      } catch (error) {
        stats[platform].errors++;
        console.error(`[sync-ads-dashboard] ${platform}/${tenantId}: ${error}`);
      }
    }

    // Run all syncs in parallel (grouped by platform to avoid overwhelming APIs)
    // Meta syncs
    if (metaIds.length > 0) {
      await Promise.allSettled(
        metaIds.map((tid) => callSync("meta-ads-insights", tid, "meta"))
      );
    }

    // Google syncs (parallel)
    if (googleIds.length > 0) {
      await Promise.allSettled(
        googleIds.map((tid) => callSync("google-ads-insights", tid, "google"))
      );
    }

    // TikTok syncs (parallel)
    if (tiktokIds.length > 0) {
      await Promise.allSettled(
        tiktokIds.map((tid) => callSync("tiktok-ads-insights", tid, "tiktok"))
      );
    }

    stats.duration_ms = Date.now() - startTime;
    console.log(`[sync-ads-dashboard] Completed in ${stats.duration_ms}ms`, JSON.stringify(stats));

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    stats.duration_ms = Date.now() - startTime;
    console.error("[sync-ads-dashboard] Fatal error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error), stats }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
