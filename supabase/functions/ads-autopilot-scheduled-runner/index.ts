// =============================================================================
// ads-autopilot-scheduled-runner
// Roda a cada 5 min.
//   (A) Processa ações status='scheduled' (engine v1). Reaplica a política.
//   (B) Fase C.4: também varre ações 'pending_approval' classificadas como
//       automatic_candidate/emergency e, se TODOS os gates passarem
//       (resolveEffectiveAutonomy='technical_only', IA ativa, kill switch off
//       conta+global, classe elegível, janela segura, maturidade, orçamento,
//       Policy Engine), auto-aprova e dispara o executor com auto_executed=true.
// Strategic pause NUNCA é elegível ao caminho (B).
// =============================================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import {
  decide,
  POLICY_ENGINE_VERSION,
  isApprovalStillValid,
  resolveEffectiveAutonomy,
  canAutoExecuteC4,
  classifyAction,
  isStrategicPauseAction,
  getApprovalTtlHours,
  type ActionInput,
} from "../_shared/ads-policy.ts";
import { isWithinBudgetWindow, CADENCE_POLICY_VERSION } from "../_shared/ads-autopilot/cadencePolicy.ts";

const VERSION = "v1.3.0"; // Fase C.4 — autoexecução técnica governada por toggle

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function extractAdAccountId(action: any): string | null {
  const d = action?.action_data || {};
  return d.ad_account_id || d.account_id || d.adAccountId || null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  console.log(`[ads-autopilot-scheduled-runner][${VERSION}] tick`);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const now = new Date();
  const summary = {
    picked: 0,
    executed: 0,
    rescheduled: 0,
    rejected: 0,
    expired: 0,
    blocked_module: 0,
    errors: 0,
  };

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
    // 2) Lock otimista
    const { data: locked, error: lockErr } = await supabase
      .from("ads_autopilot_actions")
      .update({ status: "processing_runner" })
      .eq("id", r.id)
      .eq("status", "scheduled")
      .select("id")
      .maybeSingle();
    if (lockErr || !locked) continue;

    try {
      // 3) Gate operacional Fase B.1 — TTL primeiro
      const ttlValid = isApprovalStillValid({
        approved_at: r.approved_at,
        approval_expires_at: r.approval_expires_at,
        now,
      });
      if (!ttlValid) {
        summary.expired++;
        await supabase.from("ads_autopilot_actions").update({
          status: "expired_approval",
          policy_check_result: {
            ...(r.policy_check_result || {}),
            runner_gate: { reason: "approval_ttl_passed", at: now.toISOString() },
          },
        }).eq("id", r.id);
        continue;
      }

      // 3b) Janela operacional de orçamento — adjust_budget só executa 00:01–03:00 BRT.
      // Fora da janela, reagenda para o próximo slot às 00:01 BRT.
      if (r.action_type === "adjust_budget" && !isWithinBudgetWindow(now)) {
        // Próximo 00:01 BRT (UTC = BRT+3 → 03:01 UTC)
        const next = new Date(now);
        next.setUTCDate(next.getUTCDate() + (next.getUTCHours() >= 6 ? 1 : 0));
        next.setUTCHours(3, 1, 0, 0);
        if (next.getTime() <= now.getTime()) next.setUTCDate(next.getUTCDate() + 1);
        summary.rescheduled++;
        await supabase.from("ads_autopilot_actions").update({
          status: "scheduled",
          scheduled_for: next.toISOString(),
          policy_check_result: {
            ...(r.policy_check_result || {}),
            runner_gate: {
              reason: "outside_budget_operational_window",
              window_brt: "00:01-03:00",
              cadence_policy_version: CADENCE_POLICY_VERSION,
              rescheduled_for: next.toISOString(),
              at: now.toISOString(),
            },
          },
        }).eq("id", r.id);
        continue;
      }

      // 4) Gate operacional — conta/IA/kill switch
      const adAccountId = extractAdAccountId(r);
      if (adAccountId) {
        const { data: acct } = await supabase
          .from("ads_autopilot_account_configs")
          .select("is_ai_enabled, kill_switch")
          .eq("tenant_id", r.tenant_id)
          .eq("channel", r.channel)
          .eq("ad_account_id", adAccountId)
          .maybeSingle();

        let blockReason: string | null = null;
        if (!acct) blockReason = "account_config_missing";
        else if (acct.is_ai_enabled === false) blockReason = "ai_disabled";
        else if (acct.kill_switch === true) blockReason = "kill_switch_active";

        if (blockReason) {
          summary.blocked_module++;
          await supabase.from("ads_autopilot_actions").update({
            status: "rejected_policy_module_disabled",
            policy_check_result: {
              ...(r.policy_check_result || {}),
              runner_gate: { reason: blockReason, ad_account_id: adAccountId, at: now.toISOString() },
            },
          }).eq("id", r.id);
          continue;
        }
      }

      // 5) Reaplicar policy
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
        status: "scheduled",
        error_message: e.message,
      }).eq("id", r.id);
    }
  }

  // ===========================================================================
  // FASE C.4 — Segundo passe: autoexecução técnica governada por toggle
  // ===========================================================================
  // Varre `pending_approval` engine v1 elegíveis. Para cada uma:
  //   1) Resolve autonomy efetivo (conta > global > default off).
  //   2) Aplica `canAutoExecuteC4` (kill switch, IA, classe, janela, etc.).
  //   3) Se ok, faz stamp de auto-aprovação (approved_at + TTL) e invoca o
  //      executor com from_runner=true + auto_executed=true.
  //   4) Se não ok, NÃO altera a ação — segue para aprovação humana normal.
  // ===========================================================================
  const c4Summary = { picked: 0, auto_executed: 0, blocked: 0, errors: 0 };
  try {
    const { data: pendingRows } = await supabase
      .from("ads_autopilot_actions")
      .select("*")
      .eq("status", "pending_approval")
      .eq("policy_engine_version", POLICY_ENGINE_VERSION)
      .order("created_at", { ascending: true })
      .limit(50);

    // Cache simples de global config por tenant
    const globalCache = new Map<string, any>();

    for (const r of (pendingRows || [])) {
      c4Summary.picked++;
      try {
        // 0) Strategic pause NUNCA passa pelo caminho C.4
        if (isStrategicPauseAction(r.action_type)) {
          c4Summary.blocked++;
          continue;
        }

        const action_class = classifyAction({ action_type: r.action_type, channel: r.channel });
        if (action_class !== "automatic_candidate" && action_class !== "emergency") {
          c4Summary.blocked++;
          continue;
        }

        const adAccountId = extractAdAccountId(r);
        if (!adAccountId) { c4Summary.blocked++; continue; }

        // Carrega config da conta + global
        const { data: acct } = await supabase
          .from("ads_autopilot_account_configs")
          .select("autonomy_mode, is_ai_enabled, kill_switch, budget_cents")
          .eq("tenant_id", r.tenant_id)
          .eq("channel", r.channel)
          .eq("ad_account_id", adAccountId)
          .maybeSingle();

        let globalCfg = globalCache.get(r.tenant_id);
        if (globalCfg === undefined) {
          const { data: g } = await supabase
            .from("ads_autopilot_configs")
            .select("autonomy_mode, kill_switch")
            .eq("tenant_id", r.tenant_id)
            .eq("channel", "global")
            .maybeSingle();
          globalCfg = g || null;
          globalCache.set(r.tenant_id, globalCfg);
        }

        const eff = resolveEffectiveAutonomy(acct, globalCfg);

        // Reaplica `decide()` para conhecer veredicto da política
        const actionInput: ActionInput = {
          id: r.id,
          tenant_id: r.tenant_id,
          channel: r.channel,
          action_type: r.action_type,
          action_data: r.action_data,
          status: r.status,
          approved_at: null,
          approval_expires_at: null,
          created_at: r.created_at,
        };
        let snap: any = null;
        const entity = r.action_data?.entity_id || r.action_data?.campaign_id ||
                       r.action_data?.meta_campaign_id || null;
        if (entity && r.channel === "meta") {
          const { data: cs } = await supabase
            .from("meta_ad_campaigns")
            .select("daily_budget_cents, created_at, status")
            .eq("tenant_id", r.tenant_id)
            .or(`id.eq.${entity},meta_campaign_id.eq.${entity}`)
            .maybeSingle();
          snap = cs;
        }
        const policyNow = new Date();
        const decision = decide({ action: actionInput, campaignSnapshot: snap, now: policyNow });

        // Maturidade
        const campaignAgeDays = snap?.created_at
          ? (Date.now() - new Date(snap.created_at).getTime()) / 86400000
          : null;

        // Janela segura BRT 00:01–04:00
        const brtH = (policyNow.getUTCHours() - 3 + 24) % 24;
        const brtM = policyNow.getUTCMinutes();
        const insideWindow = (brtH === 0 && brtM >= 1) || (brtH >= 1 && brtH < 4);

        const gate = canAutoExecuteC4({
          effective_mode: eff.mode,
          effective_source: eff.source,
          is_ai_enabled: acct?.is_ai_enabled === true,
          account_kill_switch: acct?.kill_switch === true,
          global_kill_switch: globalCfg?.kill_switch === true,
          action_type: r.action_type,
          action_class,
          policy_decision_kind: decision.kind,
          campaign_age_days: campaignAgeDays,
          in_learning_phase: null,
          inside_safe_window: insideWindow,
          budget_within_limit: null,
        });

        if (!gate.ok) {
          c4Summary.blocked++;
          await supabase.from("ads_autopilot_actions").update({
            policy_check_result: {
              ...(r.policy_check_result || {}),
              c4_autoexec_gate: {
                ok: false,
                reason: gate.reason,
                effective_mode: eff.mode,
                effective_source: eff.source,
                at: policyNow.toISOString(),
              },
            },
          }).eq("id", r.id);
          continue;
        }

        // OK — stamp de auto-aprovação + invoke executor
        // HARDENING DE AUDITORIA (Fase C.4): registrar de forma persistente
        // que esta ação foi liberada por POLÍTICA, não por humano. O status
        // `approved` permanece por compatibilidade com o executor; o campo
        // `policy_check_result.autoexec_audit` é a fonte de verdade da origem.
        const ttl = getApprovalTtlHours(r.action_type);
        const approvedAt = new Date().toISOString();
        const expiresAt = new Date(Date.now() + ttl * 3600 * 1000).toISOString();
        const autoexecAudit = {
          approval_source: "policy_auto_execution",
          human_approved: false,
          approved_by_user: false,
          auto_executed: true,
          auto_execution_phase: "c4_enabled",
          effective_autonomy_mode: eff.mode,
          effective_autonomy_source: eff.source,
          executed_by: "policy",
          policy_gate_result: {
            ok: true,
            reason: "ok",
            inputs: {
              action_type: r.action_type,
              action_class,
              policy_decision_kind: decision.kind,
              campaign_age_days: campaignAgeDays,
              inside_safe_window: insideWindow,
              global_kill_switch: globalCfg?.kill_switch === true,
              account_kill_switch: acct?.kill_switch === true,
              is_ai_enabled: acct?.is_ai_enabled === true,
            },
          },
          at: approvedAt,
        };
        const { data: stamped } = await supabase
          .from("ads_autopilot_actions")
          .update({
            status: "approved",
            approved_at: approvedAt,
            approval_expires_at: expiresAt,
            approved_by_user_id: null, // explicitamente: sem usuário humano
            auto_executed: true,
            policy_check_result: {
              ...(r.policy_check_result || {}),
              autoexec_audit: autoexecAudit,
              c4_autoexec_gate: {
                ok: true,
                reason: "ok",
                effective_mode: eff.mode,
                effective_source: eff.source,
                at: approvedAt,
              },
            },
          })
          .eq("id", r.id)
          .eq("status", "pending_approval")
          .select("id")
          .maybeSingle();

        if (!stamped) { c4Summary.blocked++; continue; }

        const { error: execErr } = await supabase.functions.invoke("ads-autopilot-execute-approved", {
          body: { tenant_id: r.tenant_id, action_id: r.id, from_runner: true },
        });
        if (execErr) {
          c4Summary.errors++;
          await supabase.from("ads_autopilot_actions").update({
            status: "failed",
            error_message: `c4_autoexec_invoke_failed: ${execErr.message}`,
          }).eq("id", r.id);
        } else {
          c4Summary.auto_executed++;
        }
      } catch (e: any) {
        c4Summary.errors++;
        console.error(`[scheduled-runner][${VERSION}] C.4 autoexec error on ${r.id}:`, e.message);
      }
    }
  } catch (e: any) {
    console.error(`[scheduled-runner][${VERSION}] C.4 pass error:`, e.message);
  }

  console.log(`[ads-autopilot-scheduled-runner][${VERSION}] summary`, summary, "c4", c4Summary);
  return new Response(JSON.stringify({ success: true, summary, c4: c4Summary }), {
    status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
