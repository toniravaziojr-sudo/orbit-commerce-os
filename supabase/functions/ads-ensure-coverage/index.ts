// ads-ensure-coverage
// Verifica se há dias faltantes em meta_ad_insights / google_ad_insights / tiktok_ad_insights
// dentro do range solicitado e, se houver, dispara backfill cirúrgico.
// Retorna imediatamente com { has_gap, gap_days, triggered } — o backfill roda em background.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CoverageRequest {
  tenant_id: string;
  date_start: string; // YYYY-MM-DD
  date_end: string;   // YYYY-MM-DD
  platforms?: ("meta" | "google" | "tiktok")[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const body: CoverageRequest = await req.json();
    const { tenant_id, date_start, date_end } = body;
    const platforms = body.platforms || ["meta", "google", "tiktok"];

    if (!tenant_id || !date_start || !date_end) {
      return json({ success: false, error: "tenant_id, date_start, date_end obrigatórios" }, 400);
    }

    console.log(`[ads-ensure-coverage][${VERSION}] tenant=${tenant_id} range=${date_start}→${date_end} platforms=${platforms.join(",")}`);

    const results: Record<string, any> = {};

    for (const platform of platforms) {
      results[platform] = await ensureCoverageForPlatform(
        supabase,
        supabaseUrl,
        supabaseKey,
        tenant_id,
        platform,
        date_start,
        date_end
      );
    }

    return json({ success: true, results });
  } catch (e) {
    console.error("[ads-ensure-coverage] error:", e);
    return json({ success: false, error: String(e) }, 500);
  }

  function json(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function ensureCoverageForPlatform(
  supabase: any,
  supabaseUrl: string,
  serviceKey: string,
  tenantId: string,
  platform: "meta" | "google" | "tiktok",
  dateStart: string,
  dateEnd: string
) {
  // 1. Check if platform is connected for tenant
  const isConnected = await checkConnection(supabase, tenantId, platform);
  if (!isConnected) {
    return { connected: false, skipped: true };
  }

  // 2. Find missing days in range
  const tableInfo = TABLE_BY_PLATFORM[platform];
  const { data: existingDays } = await supabase
    .from(tableInfo.table)
    .select(tableInfo.dateCol)
    .eq("tenant_id", tenantId)
    .gte(tableInfo.dateCol, dateStart)
    .lte(tableInfo.dateCol, dateEnd);

  const presentDays = new Set((existingDays || []).map((r: any) => r[tableInfo.dateCol]));
  const allDays = enumerateDays(dateStart, dateEnd);
  const missingDays = allDays.filter((d) => !presentDays.has(d));

  // 3. If today's data, ALWAYS refresh (today's spend changes throughout the day).
  //    For other days: only sync if actually missing.
  const todayStr = new Date().toISOString().split("T")[0];
  const needsTodayRefresh = allDays.includes(todayStr) && dateEnd >= todayStr;

  // Decision: skip if no gaps and we don't need today refresh
  if (missingDays.length === 0 && !needsTodayRefresh) {
    return {
      connected: true,
      has_gap: false,
      gap_days: 0,
      triggered: false,
    };
  }

  // 4. Decide sync window:
  //    - If gap is large (>30 days) or hits historical data → use chunked time_range
  //    - If gap is small/recent → use date_preset for efficiency
  const syncStart = missingDays.length > 0 ? missingDays[0] : todayStr;
  const syncEnd = dateEnd;

  console.log(`[ads-ensure-coverage] ${platform}/${tenantId}: ${missingDays.length} missing days, triggering sync ${syncStart}→${syncEnd}`);

  // 5. Trigger the platform-specific sync function (fire-and-forget)
  const functionName = SYNC_FN_BY_PLATFORM[platform];
  const payload: any = {
    action: "sync",
    tenant_id: tenantId,
    time_range: { since: syncStart, until: syncEnd },
  };

  // Don't await — fire and forget so the dashboard query returns fast
  fetch(`${supabaseUrl}/functions/v1/${functionName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify(payload),
  })
    .then(async (r) => {
      const txt = await r.text();
      console.log(`[ads-ensure-coverage] ${platform}/${tenantId} sync result ${r.status}: ${txt.substring(0, 200)}`);

      // Update coverage tracking after sync completes
      await supabase
        .from("ad_insights_sync_coverage")
        .upsert(
          {
            tenant_id: tenantId,
            platform,
            ad_account_id: null,
            last_day_synced: syncEnd,
            last_sync_at: new Date().toISOString(),
            last_sync_kind: "on_demand",
            last_sync_status: r.ok ? "success" : "error",
            last_sync_error: r.ok ? null : txt.substring(0, 500),
          },
          { onConflict: "tenant_id,platform,ad_account_id" }
        );
    })
    .catch((err) => {
      console.error(`[ads-ensure-coverage] ${platform}/${tenantId} sync failed:`, err);
    });

  // Mark as running immediately
  await supabase
    .from("ad_insights_sync_coverage")
    .upsert(
      {
        tenant_id: tenantId,
        platform,
        ad_account_id: null,
        last_sync_at: new Date().toISOString(),
        last_sync_kind: "on_demand",
        last_sync_status: "running",
      },
      { onConflict: "tenant_id,platform,ad_account_id" }
    );

  return {
    connected: true,
    has_gap: missingDays.length > 0,
    gap_days: missingDays.length,
    triggered: true,
    sync_window: { since: syncStart, until: syncEnd },
  };
}

const TABLE_BY_PLATFORM = {
  meta: { table: "meta_ad_insights", dateCol: "date_start" },
  google: { table: "google_ad_insights", dateCol: "date" },
  tiktok: { table: "tiktok_ad_insights", dateCol: "date_start" },
} as const;

const SYNC_FN_BY_PLATFORM = {
  meta: "meta-ads-insights",
  google: "google-ads-insights",
  tiktok: "tiktok-ads-insights",
} as const;

async function checkConnection(supabase: any, tenantId: string, platform: string): Promise<boolean> {
  if (platform === "meta") {
    const { data } = await supabase
      .from("tenant_meta_auth_grants")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .eq("status", "active")
      .maybeSingle();
    return !!data;
  }
  if (platform === "google") {
    const { data } = await supabase
      .from("google_connections")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .maybeSingle();
    return !!data;
  }
  if (platform === "tiktok") {
    const { data } = await supabase
      .from("tiktok_ads_connections")
      .select("tenant_id")
      .eq("tenant_id", tenantId)
      .eq("is_active", true)
      .eq("connection_status", "connected")
      .maybeSingle();
    return !!data;
  }
  return false;
}

function enumerateDays(start: string, end: string): string[] {
  const out: string[] = [];
  const s = new Date(start + "T00:00:00Z");
  const e = new Date(end + "T00:00:00Z");
  const cur = new Date(s);
  while (cur <= e) {
    out.push(cur.toISOString().split("T")[0]);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}
