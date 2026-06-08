// =============================================================================
// ads-autopilot-strategic-pause-expire
// Fase C.4 — Roda às 00:01 BRT (03:01 UTC) todos os dias.
// Marca como `expired` toda sugestão `strategic_pause` (ou tipos equivalentes)
// que esteja em `pending_approval` com `approval_expires_at <= now`.
// Idempotente. NÃO chama Meta/Google/TikTok. NÃO altera ações
// approved/rejected/executed/auto_executed.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { STRATEGIC_PAUSE_ACTION_TYPES } from "../_shared/ads-policy.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(`[strategic-pause-expire][${VERSION}] tick`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const nowIso = new Date().toISOString();
  const types = Array.from(STRATEGIC_PAUSE_ACTION_TYPES);

  const summary = { picked: 0, expired: 0, skipped: 0, errors: 0 };

  try {
    const { data: rows, error: fetchErr } = await supabase
      .from("ads_autopilot_actions")
      .select("id, status, action_type, approval_expires_at, policy_check_result")
      .eq("status", "pending_approval")
      .in("action_type", types)
      .lte("approval_expires_at", nowIso)
      .limit(500);

    if (fetchErr) {
      console.error(`[strategic-pause-expire][${VERSION}] fetch error:`, fetchErr.message);
      return new Response(JSON.stringify({ success: false, error: fetchErr.message }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    summary.picked = rows?.length || 0;

    for (const r of (rows || [])) {
      try {
        const { data: upd } = await supabase
          .from("ads_autopilot_actions")
          .update({
            status: "expired",
            policy_check_result: {
              ...((r as any).policy_check_result || {}),
              expiration: {
                reason: "strategic_pause_daily_window_expired",
                ttl_policy: "strategic_pause_daily_until_next_0001_brt",
                expired_at: nowIso,
                pilot_version: VERSION,
              },
            },
          })
          .eq("id", (r as any).id)
          .eq("status", "pending_approval") // lock idempotente
          .select("id")
          .maybeSingle();
        if (upd) summary.expired++;
        else summary.skipped++;
      } catch (e: any) {
        summary.errors++;
        console.error(`[strategic-pause-expire][${VERSION}] action ${(r as any).id} err:`, e.message);
      }
    }
  } catch (e: any) {
    console.error(`[strategic-pause-expire][${VERSION}] fatal:`, e.message);
    return new Response(JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  console.log(`[strategic-pause-expire][${VERSION}] summary`, summary);
  return new Response(JSON.stringify({ success: true, summary }),
    { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
