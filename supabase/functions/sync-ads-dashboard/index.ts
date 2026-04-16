import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ===== VERSION - SEMPRE INCREMENTAR =====
const VERSION = "v3.0.0"; // Estratégia híbrida 3 camadas: daily(7d) | weekly(90d) | on_connect(maximum)
// ========================================

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  mode?: "daily" | "weekly" | "on_connect" | "manual";
  tenant_id?: string;          // se setado, sincroniza só esse tenant
  date_preset?: string;         // override manual
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const body: Body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const mode = body.mode || "daily";
  const datePreset = body.date_preset || presetForMode(mode);

  console.log(`[sync-ads-dashboard][${VERSION}] mode=${mode} preset=${datePreset} tenant=${body.tenant_id || "ALL"}`);

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const stats = {
    mode,
    preset: datePreset,
    meta: { tenants: 0, success: 0, errors: 0 },
    google: { tenants: 0, success: 0, errors: 0 },
    tiktok: { tenants: 0, success: 0, errors: 0 },
    duration_ms: 0,
  };

  const startTime = Date.now();

  try {
    // 1. Discover tenants per platform
    const tenantFilter = body.tenant_id ? { tenant_id: body.tenant_id } : null;

    let v4MetaQ = supabase.from("tenant_meta_auth_grants").select("tenant_id").eq("status", "active");
    let googleQ = supabase.from("google_connections").select("tenant_id").eq("is_active", true);
    let tiktokQ = supabase.from("tiktok_ads_connections").select("tenant_id").eq("is_active", true).eq("connection_status", "connected");

    if (tenantFilter) {
      v4MetaQ = v4MetaQ.eq("tenant_id", tenantFilter.tenant_id);
      googleQ = googleQ.eq("tenant_id", tenantFilter.tenant_id);
      tiktokQ = tiktokQ.eq("tenant_id", tenantFilter.tenant_id);
    }

    const [{ data: v4MetaTenants }, { data: googleTenants }, { data: tiktokTenants }] = await Promise.all([v4MetaQ, googleQ, tiktokQ]);

    const metaIds = [...new Set((v4MetaTenants || []).map((t) => t.tenant_id))];
    const googleIds = [...new Set((googleTenants || []).map((t) => t.tenant_id))];
    const tiktokIds = [...new Set((tiktokTenants || []).map((t) => t.tenant_id))];

    stats.meta.tenants = metaIds.length;
    stats.google.tenants = googleIds.length;
    stats.tiktok.tenants = tiktokIds.length;

    console.log(`[sync-ads-dashboard] Tenants: meta=${metaIds.length} google=${googleIds.length} tiktok=${tiktokIds.length}`);

    async function callSync(fn: string, tid: string, platform: "meta" | "google" | "tiktok") {
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/${fn}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${supabaseServiceKey}` },
          body: JSON.stringify({ action: "sync", tenant_id: tid, date_preset: datePreset }),
        });
        if (r.ok) {
          stats[platform].success++;
          // Update coverage marker
          await supabase.from("ad_insights_sync_coverage").upsert(
            {
              tenant_id: tid,
              platform,
              ad_account_id: null,
              last_day_synced: new Date().toISOString().split("T")[0],
              last_sync_at: new Date().toISOString(),
              last_sync_kind: mode,
              last_sync_status: "success",
              last_sync_error: null,
            },
            { onConflict: "tenant_id,platform,ad_account_id" }
          );
        } else {
          stats[platform].errors++;
          const txt = await r.text();
          console.error(`[sync-ads-dashboard] ${platform}/${tid}: ${r.status} ${txt.substring(0, 200)}`);
          await supabase.from("ad_insights_sync_coverage").upsert(
            {
              tenant_id: tid,
              platform,
              ad_account_id: null,
              last_sync_at: new Date().toISOString(),
              last_sync_kind: mode,
              last_sync_status: "error",
              last_sync_error: txt.substring(0, 500),
            },
            { onConflict: "tenant_id,platform,ad_account_id" }
          );
        }
      } catch (e) {
        stats[platform].errors++;
        console.error(`[sync-ads-dashboard] ${platform}/${tid} exception:`, e);
      }
    }

    // 2. Run syncs (Meta needs campaigns first, then insights)
    if (metaIds.length > 0) {
      await Promise.allSettled(metaIds.map((tid) => callSync("meta-ads-campaigns", tid, "meta")));
      await Promise.allSettled(metaIds.map((tid) => callSync("meta-ads-insights", tid, "meta")));
    }
    if (googleIds.length > 0) {
      await Promise.allSettled(googleIds.map((tid) => callSync("google-ads-insights", tid, "google")));
    }
    if (tiktokIds.length > 0) {
      await Promise.allSettled(tiktokIds.map((tid) => callSync("tiktok-ads-insights", tid, "tiktok")));
    }

    stats.duration_ms = Date.now() - startTime;
    console.log(`[sync-ads-dashboard] Done in ${stats.duration_ms}ms`, JSON.stringify(stats));

    return new Response(JSON.stringify({ success: true, stats }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    stats.duration_ms = Date.now() - startTime;
    console.error("[sync-ads-dashboard] fatal:", e);
    return new Response(JSON.stringify({ success: false, error: String(e), stats }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function presetForMode(mode: string): string {
  // 3 camadas:
  // - daily   (de hora em hora): últimos 7 dias — performance recente
  // - weekly  (sábado madrugada): últimos 90 dias — reconciliação de atribuição
  // - on_connect (1ª conexão):   maximum         — backfill lifetime
  switch (mode) {
    case "weekly":
      return "last_90d";
    case "on_connect":
      return "maximum";
    case "manual":
      return "last_30d";
    case "daily":
    default:
      return "last_7d";
  }
}
