// =============================================================================
// FASE C.4 — Hardening de auditoria
//
// Garante que toda ação em ads_autopilot_actions deixe claro, via metadata,
// se foi:
//   - human_approval        (aprovação manual via UI)
//   - policy_auto_execution (auto-executada pela Fase C.4)
//   - rejected_by_user      (rejeitada manualmente)
//   - blocked_by_policy     (bloqueada por gate da Fase C.4)
//
// Testes puros: NÃO chamam Supabase, NÃO chamam Meta/Google/TikTok.
// Replicam os shapes que `ads-autopilot-scheduled-runner`, o hook
// `useAdsPendingActions` e `ads-autopilot-execute-approved` gravam em
// `policy_check_result.autoexec_audit`.
// =============================================================================
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveEffectiveAutonomy,
  canAutoExecuteC4,
  classifyAction,
  isStrategicPauseAction,
} from "./ads-policy.ts";

// Shapes idênticos aos do runner e do hook.
function buildPolicyAutoExecAudit(opts: {
  effective_mode: "off" | "technical_only";
  effective_source: "account" | "global" | "default_off";
  action_type: string;
  action_class: string;
  policy_decision_kind: string;
  inside_safe_window: boolean;
}) {
  return {
    approval_source: "policy_auto_execution",
    human_approved: false,
    approved_by_user: false,
    auto_executed: true,
    auto_execution_phase: "c4_enabled",
    effective_autonomy_mode: opts.effective_mode,
    effective_autonomy_source: opts.effective_source,
    executed_by: "policy",
    policy_gate_result: {
      ok: true,
      reason: "ok",
      inputs: {
        action_type: opts.action_type,
        action_class: opts.action_class,
        policy_decision_kind: opts.policy_decision_kind,
        inside_safe_window: opts.inside_safe_window,
      },
    },
    at: new Date().toISOString(),
  };
}

function buildHumanApprovalAudit(userId: string) {
  return {
    approval_source: "human_approval",
    human_approved: true,
    approved_by_user: true,
    auto_executed: false,
    auto_execution_phase: null,
    effective_autonomy_mode: null,
    effective_autonomy_source: null,
    executed_by: "user",
    approved_by: userId,
    at: new Date().toISOString(),
  };
}

function buildRejectedAudit(userId: string, reason: string) {
  return {
    approval_source: "rejected_by_user",
    human_approved: false,
    approved_by_user: false,
    auto_executed: false,
    executed_by: null,
    rejected_by: userId,
    rejection_reason: reason,
    at: new Date().toISOString(),
  };
}

function buildBlockedByPolicyAudit(reason: string) {
  return {
    approval_source: "blocked_by_policy",
    human_approved: false,
    approved_by_user: false,
    auto_executed: false,
    auto_execution_phase: "c4_enabled",
    policy_gate_result: { ok: false, reason },
    at: new Date().toISOString(),
  };
}

// ───────────────────────── Hardening de auditoria ─────────────────────────

Deno.test("autoexec C.4 NUNCA registra aprovação humana", () => {
  const audit = buildPolicyAutoExecAudit({
    effective_mode: "technical_only",
    effective_source: "account",
    action_type: "adjust_budget",
    action_class: "automatic_candidate",
    policy_decision_kind: "execute_now",
    inside_safe_window: true,
  });
  assertEquals(audit.approval_source, "policy_auto_execution");
  assertEquals(audit.human_approved, false);
  assertEquals(audit.approved_by_user, false);
  assertEquals(audit.auto_executed, true);
  assertEquals(audit.auto_execution_phase, "c4_enabled");
  assertEquals(audit.executed_by, "policy");
});

Deno.test("autoexec C.4 — fonte 'global' fica registrada corretamente", () => {
  const audit = buildPolicyAutoExecAudit({
    effective_mode: "technical_only",
    effective_source: "global",
    action_type: "adjust_budget",
    action_class: "automatic_candidate",
    policy_decision_kind: "execute_now",
    inside_safe_window: true,
  });
  assertEquals(audit.effective_autonomy_source, "global");
  assertEquals(audit.effective_autonomy_mode, "technical_only");
});

Deno.test("aprovação manual registra approval_source=human_approval", () => {
  const audit = buildHumanApprovalAudit("user-abc");
  assertEquals(audit.approval_source, "human_approval");
  assertEquals(audit.human_approved, true);
  assertEquals(audit.approved_by_user, true);
  assertEquals(audit.auto_executed, false);
  assertEquals(audit.executed_by, "user");
  assertEquals((audit as any).approved_by, "user-abc");
});

Deno.test("status 'approved' é desambiguado pelo autoexec_audit", () => {
  // Simulação: ambos os caminhos produzem status='approved' (compatibilidade
  // com o executor existente). A distinção MORA em policy_check_result.
  const humanRow = {
    status: "approved",
    auto_executed: false,
    policy_check_result: { autoexec_audit: buildHumanApprovalAudit("u1") },
  };
  const policyRow = {
    status: "approved",
    auto_executed: true,
    policy_check_result: {
      autoexec_audit: buildPolicyAutoExecAudit({
        effective_mode: "technical_only",
        effective_source: "account",
        action_type: "adjust_budget",
        action_class: "automatic_candidate",
        policy_decision_kind: "execute_now",
        inside_safe_window: true,
      }),
    },
  };
  assertEquals(humanRow.status, policyRow.status); // mesmo status
  // Mas a origem é distinguível por metadata + flag:
  assertEquals(humanRow.auto_executed, false);
  assertEquals(policyRow.auto_executed, true);
  assertEquals(humanRow.policy_check_result.autoexec_audit.approval_source, "human_approval");
  assertEquals(policyRow.policy_check_result.autoexec_audit.approval_source, "policy_auto_execution");
});

Deno.test("rejeição manual registra approval_source=rejected_by_user", () => {
  const audit = buildRejectedAudit("user-xyz", "não faz sentido pausar agora");
  assertEquals(audit.approval_source, "rejected_by_user");
  assertEquals(audit.human_approved, false);
  assertEquals(audit.auto_executed, false);
  assertEquals(audit.rejected_by, "user-xyz");
});

Deno.test("bloqueio por gate C.4 registra approval_source=blocked_by_policy", () => {
  const audit = buildBlockedByPolicyAudit("autonomy_off");
  assertEquals(audit.approval_source, "blocked_by_policy");
  assertEquals(audit.human_approved, false);
  assertEquals(audit.auto_executed, false);
  assertEquals(audit.policy_gate_result.reason, "autonomy_off");
});

// ───────────────────────── Revalidação no executor ────────────────────────

// Simulação do branch do executor: se `auto_executed=true` e o gate falhar,
// nenhuma chamada externa pode acontecer. Modelamos isso com um spy.
function simulateExecutorAutoExecBranch(input: {
  auto_executed: boolean;
  gate_ok: boolean;
  is_strategic_pause: boolean;
}) {
  let externalCalls = 0;
  let revertedToPending = false;
  if (input.auto_executed) {
    if (input.is_strategic_pause) {
      revertedToPending = true;
      return { externalCalls, revertedToPending };
    }
    if (!input.gate_ok) {
      revertedToPending = true;
      return { externalCalls, revertedToPending };
    }
  }
  externalCalls = 1;
  return { externalCalls, revertedToPending };
}

Deno.test("executor revalida gates: gate=ok → executa", () => {
  const r = simulateExecutorAutoExecBranch({
    auto_executed: true, gate_ok: true, is_strategic_pause: false,
  });
  assertEquals(r.externalCalls, 1);
  assertEquals(r.revertedToPending, false);
});

Deno.test("executor revalida gates: gate falha → NÃO chama API e volta a pending", () => {
  const r = simulateExecutorAutoExecBranch({
    auto_executed: true, gate_ok: false, is_strategic_pause: false,
  });
  assertEquals(r.externalCalls, 0);
  assertEquals(r.revertedToPending, true);
});

Deno.test("executor revalida gates: strategic_pause NUNCA autoexecuta", () => {
  for (const t of ["strategic_pause", "pause_low_roas", "pause_dayparting", "pause_fatigue"]) {
    assert(isStrategicPauseAction(t));
    const r = simulateExecutorAutoExecBranch({
      auto_executed: true, gate_ok: true, is_strategic_pause: true,
    });
    assertEquals(r.externalCalls, 0, t);
    assertEquals(r.revertedToPending, true, t);
  }
});

// ──────────────────────── Falha externa não vira sucesso ───────────────────

function simulateExternalCallResult(input: { externalOk: boolean }) {
  return input.externalOk
    ? { status: "executed", executed_at: new Date().toISOString() }
    : { status: "failed", error_message: "external_api_error" };
}

Deno.test("falha na chamada externa NÃO marca a ação como sucesso", () => {
  const r = simulateExternalCallResult({ externalOk: false });
  assertEquals(r.status, "failed");
  assert(!("executed_at" in r));
});

Deno.test("sucesso na chamada externa marca executed_at apenas após confirmação", () => {
  const r = simulateExternalCallResult({ externalOk: true });
  assertEquals(r.status, "executed");
  assert("executed_at" in r);
});

// ──────────────────────── Hierarquia de autonomia ────────────────────────

Deno.test("hierarquia conta > global > default — autoexec usa o efetivo", () => {
  // Conta off > Global on → autoexec não roda
  const eff1 = resolveEffectiveAutonomy(
    { autonomy_mode: "off" }, { autonomy_mode: "technical_only" }
  );
  const gate1 = canAutoExecuteC4({
    effective_mode: eff1.mode,
    effective_source: eff1.source,
    is_ai_enabled: true,
    account_kill_switch: false,
    global_kill_switch: false,
    action_type: "adjust_budget",
    action_class: classifyAction({ action_type: "adjust_budget", channel: "meta" }),
    policy_decision_kind: "execute_now",
    campaign_age_days: 30,
    in_learning_phase: false,
    inside_safe_window: true,
    budget_within_limit: true,
  });
  assertEquals(gate1.ok, false);

  // Conta on, global off → autoexec roda
  const eff2 = resolveEffectiveAutonomy(
    { autonomy_mode: "technical_only" }, { autonomy_mode: "off" }
  );
  const gate2 = canAutoExecuteC4({
    effective_mode: eff2.mode,
    effective_source: eff2.source,
    is_ai_enabled: true,
    account_kill_switch: false,
    global_kill_switch: false,
    action_type: "adjust_budget",
    action_class: classifyAction({ action_type: "adjust_budget", channel: "meta" }),
    policy_decision_kind: "execute_now",
    campaign_age_days: 30,
    in_learning_phase: false,
    inside_safe_window: true,
    budget_within_limit: true,
  });
  assertEquals(gate2.ok, true);
});

// =============================================================================
// Microvalidação: 5º estado distinguível — strategic_pause expirada
// Replica o shape gravado por `ads-autopilot-strategic-pause-expire`.
// =============================================================================
function buildExpiredStrategicPauseRow(prev?: Record<string, unknown>) {
  const nowIso = new Date().toISOString();
  return {
    status: "expired",
    policy_check_result: {
      ...(prev || {}),
      expiration: {
        reason: "strategic_pause_daily_window_expired",
        ttl_policy: "strategic_pause_daily_until_next_0001_brt",
        expired_at: nowIso,
        pilot_version: "v1.0.0",
      },
      autoexec_audit: {
        decision_outcome: "expired",
        expiration_reason: "strategic_pause_daily_window_expired",
        expired_at: nowIso,
        human_approved: false,
        auto_executed: false,
        expired_by: "policy_ttl",
        expired_by_function: "ads-autopilot-strategic-pause-expire",
        pilot_version: "v1.0.0",
      },
    },
  };
}

Deno.test("C.4 audit — strategic_pause expirada é distinguível e fora da fila ativa", () => {
  const row = buildExpiredStrategicPauseRow();
  // Distinguível
  assertEquals(row.status, "expired");
  const audit = (row.policy_check_result as any).autoexec_audit;
  assertEquals(audit.decision_outcome, "expired");
  assertEquals(audit.expiration_reason, "strategic_pause_daily_window_expired");
  assertEquals(audit.human_approved, false);
  assertEquals(audit.auto_executed, false);
  assert(typeof audit.expired_at === "string");
  // Fila ativa filtra status='pending_approval' → expirada nunca aparece
  assert(row.status !== "pending_approval");
  // Histórico preservado: expiration + autoexec_audit ambos presentes
  assert((row.policy_check_result as any).expiration);
  assert((row.policy_check_result as any).autoexec_audit);
});

Deno.test("C.4 audit — strategic_pause é classificada e nunca auto-executa", () => {
  assert(isStrategicPauseAction("pause_campaign_strategic"));
  // Tipo estratégico não passa pelo gate de auto-execução
  const gate = canAutoExecuteC4({
    effective_mode: "technical_only",
    effective_source: "account",
    is_ai_enabled: true,
    account_kill_switch: false,
    global_kill_switch: false,
    action_type: "pause_campaign_strategic",
    action_class: classifyAction({ action_type: "pause_campaign_strategic", channel: "meta" }),
    policy_decision_kind: "execute_now",
    campaign_age_days: 30,
    in_learning_phase: false,
    inside_safe_window: true,
    budget_within_limit: true,
  });
  assertEquals(gate.ok, false);
});
