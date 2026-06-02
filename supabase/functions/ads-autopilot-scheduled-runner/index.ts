// =============================================================================
// ads-autopilot-scheduled-runner
// Roda a cada 5 min. Processa ações status='scheduled' com policy_engine_version='v1'.
// Reaplica a política antes de executar. Ignora ações legadas.
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { decide, POLICY_ENGINE_VERSION, type ActionInput } from "../_shared/ads-policy.ts";

const VERSION = "v1.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(`[ads-autopilot-scheduled-runner][${VERSION}] tick`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const summary = { picked: 0, executed: 0, rescheduled: 0, rejected: 0, expired: 0, errors: 0 };

  // 1) Buscar candidatos (engine v1 obrigatório)
  const { data: rows, error: fetchErr } = await supabase
    .from("ads_autopilot_actions")
    .select("*")
    .eq("status", "scheduled")
    .eq("policy_engine_version", POLICY_ENGINE_VERSION)
    .lte("scheduled_for", now.toISOString())
    .order("scheduled_for", { ascending: true })
    .limit(50);

  if (fetchErr) {
    console.error(`[ads-autopilot-scheduled-runner][${VERSION}] fetch error:`, fetchErr.message);
    return new Response(JSON.stringify({ success: false, error: fetchErr.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  summary.picked = rows?.length || 0;

  for (const r of (rows || [])) {
    // 2) Lock otimista: marca como 'processing_runner' antes de tocar API
    const { data: locked, error: lockErr } = await supabase
      .from("ads_autopilot_actions")
      .update({ status: "processing_runner" })
      .eq("id", r.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (lockErr || !locked) {
      // outra instância pegou
      continue;
    }

    try {
      // 3) Reaplicar policy
      const action: ActionInput = {
        id: r.id,
        tenant_id: r.tenant_id,
        channel: r.channel,
        action_type: r.action_type,
        action_data: r.action_data,
        status: r.status,
        approved_at: r.approved_at,
        approval_expires_at: r.approval_expires_at,
        created_at: r.created_at,
      };

      // Snapshot enxuto p/ orçamento
      let snapshot: any = null;
      const entity = r.action_data?.entity_id || r.action_data?.campaign_id ||
                     r.action_data?.meta_campaign_id || null;
      if (entity && r.channel === "meta") {
        const { data: snap } = await supabase
          .from("meta_ad_campaigns")
          .select("daily_budget_cents, created_at, status")
          .eq("tenant_id", r.tenant_id)
          .or(`id.eq.${entity},meta_campaign_id.eq.${entity}`)
          .maybeSingle();
        snapshot = snap;
      }

      const decision = decide({ action, campaignSnapshot: snapshot, now });

      if (decision.kind === "execute_now") {
        // 4) Invoca executor — passando flag from_runner para aceitar status atual
        const { data: execRes, error: execErr } = await supabase.functions.invoke(
          "ads-autopilot-execute-approved",
          { body: { tenant_id: r.tenant_id, action_id: r.id, from_runner: true } }
        );
        if (execErr || (execRes && execRes.success === false)) {
          summary.errors++;
          await supabase.from("ads_autopilot_actions").update({
            status: "failed",
            error_message: execErr?.message || execRes?.error || "runner_exec_failed",
          }).eq("id", r.id);
        } else {
          summary.executed++;
        }
      } else if (decision.kind === "schedule") {
        summary.rescheduled++;
        await supabase.from("ads_autopilot_actions").update({
          status: "scheduled",
          scheduled_for: decision.scheduled_for,
          policy_check_result: { ...(r.policy_check_result || {}), runner_decision: decision, at: now.toISOString() },
        }).eq("id", r.id);
      } else if (decision.kind === "expired_approval") {
        summary.expired++;
        await supabase.from("ads_autopilot_actions").update({
          status: "expired_approval",
          policy_check_result: { ...(r.policy_check_result || {}), runner_decision: decision, at: now.toISOString() },
        }).eq("id", r.id);
      } else {
        // rejeições
        summary.rejected++;
        const statusMap: Record<string, string> = {
          reject_policy_limit_exceeded: "rejected_policy_limit_exceeded",
          reject_policy_missing_context: "rejected_policy_missing_context",
          reject_duplicate: "rejected_duplicate",
        };
        const newStatus = statusMap[decision.kind] || "rejected";
        await supabase.from("ads_autopilot_actions").update({
          status: newStatus,
          policy_check_result: { ...(r.policy_check_result || {}), runner_decision: decision, at: now.toISOString() },
        }).eq("id", r.id);
      }
    } catch (e: any) {
      summary.errors++;
      console.error(`[ads-autopilot-scheduled-runner][${VERSION}] action ${r.id} error:`, e.message);
      await supabase.from("ads_autopilot_actions").update({
        status: "scheduled", // libera para próxima tentativa
        error_message: e.message,
      }).eq("id", r.id);
    }
  }

  console.log(`[ads-autopilot-scheduled-runner][${VERSION}] summary`, summary);
  return new Response(JSON.stringify({ success: true, summary }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
