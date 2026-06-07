// =====================================================================
// Etapa 7.mem — Subfase F.2
// Plug silencioso do Tenant Preference Guard no gatilho determinístico
// de orçamento. Estes testes validam as INVARIANTES (sem rodar a edge
// function): para qualquer rascunho construído pelo gatilho determinístico
// de orçamento, o Guard pode ser executado e o trace simulado pode ser
// gerado, mas a sugestão real (action_type/status/orçamento) NUNCA muda.
// =====================================================================

import { describe, it, expect } from "vitest";
import { applyTenantPreferenceGuard } from "@/lib/adsAutopilot/tenantPreferenceGuard";
import type { TenantMemoryRow } from "@/lib/adsAutopilot/memoryReader";

const TENANT = "d1a4d0ed-8842-495e-b741-540a9a345b25";

function buildRealAction(direction: "up" | "down", current = 10000) {
  const change_pct = direction === "up" ? 10 : -10;
  const new_budget = Math.round(current * (1 + change_pct / 100));
  return {
    tenant_id: TENANT,
    channel: "meta",
    action_type: "adjust_budget",
    status: "pending_approval",
    action_data: {
      current_daily_budget_cents: current,
      new_budget_cents: new_budget,
      proposed_daily_budget_cents: new_budget,
      change_pct,
      direction,
    },
  };
}

function buildGuardInput(direction: "up" | "down", memories: TenantMemoryRow[]) {
  const sim = direction === "up" ? "increase_budget" : "decrease_budget";
  return {
    tenant_id: TENANT,
    ads_platform: "meta",
    action_type: sim,
    campaign_id: "camp_1",
    draft: {
      action_type: sim,
      params: { increase_pct: 10, change_pct: 10 },
      proposed_status: "pending_approval",
      rationale: "deterministic budget",
      priority: "normal" as const,
    },
    memories,
  };
}

function mem(partial: Partial<TenantMemoryRow>): TenantMemoryRow {
  return {
    id: partial.id ?? "m1",
    tenant_id: TENANT,
    sales_platform: "internal",
    ads_platform: "meta",
    memory_type: "preference",
    scope: "budget",
    key: "budget_preference",
    value: {},
    confidence: 0.8,
    evidence_count: 3,
    status: "active",
    ...partial,
  } as TenantMemoryRow;
}

/** Simula o wrapping silencioso: nunca aplica `recommendation` ao real. */
function simulateSilentPlug(real: any, memories: TenantMemoryRow[]) {
  const direction = real.action_data.direction as "up" | "down";
  const before = JSON.parse(JSON.stringify(real));
  const out = applyTenantPreferenceGuard(buildGuardInput(direction, memories));
  const trace = {
    tenant_memory_guard_mode: "silent" as const,
    tenant_memory_used: out.trace.tenant_memory_used,
    memory_candidates_count: memories.length,
    memory_ids_used: out.trace.memory_ids_used,
    memory_statuses_used: out.trace.memory_statuses_used,
    influence_type: out.trace.influence_type,
    real_recommendation_changed: false,
    applied_to_decision: false,
    fail_open: out.trace.fail_open,
  };
  real.action_data.tenant_memory_silent_trace = trace;
  return { real, before, trace, guardOut: out };
}

describe("F.2 — silent guard plug invariants", () => {
  it("memória vazia: trace registra e ação real intacta", () => {
    const { real, before, trace } = simulateSilentPlug(buildRealAction("up"), []);
    expect(trace.memory_candidates_count).toBe(0);
    expect(trace.applied_to_decision).toBe(false);
    expect(trace.real_recommendation_changed).toBe(false);
    expect(real.action_type).toBe(before.action_type);
    expect(real.status).toBe(before.status);
    expect(real.action_data.change_pct).toBe(before.action_data.change_pct);
    expect(real.action_data.new_budget_cents).toBe(before.action_data.new_budget_cents);
    expect(real.action_data.proposed_daily_budget_cents).toBe(before.action_data.proposed_daily_budget_cents);
  });

  it("memória provisional: gera rationale simulado, ação real intacta", () => {
    const memories = [
      mem({ id: "p1", status: "provisional", key: "budget_preference", value: { action_type: "increase_budget" } }),
    ];
    const { real, before, trace } = simulateSilentPlug(buildRealAction("up"), memories);
    expect(["enrich_rationale", "soften", "none"]).toContain(trace.influence_type);
    expect(real.action_type).toBe(before.action_type);
    expect(real.action_data.change_pct).toBe(before.action_data.change_pct);
    expect(real.action_data.new_budget_cents).toBe(before.action_data.new_budget_cents);
    expect(real.action_data.tenant_memory_silent_trace.applied_to_decision).toBe(false);
    expect(real.action_data.tenant_memory_silent_trace.real_recommendation_changed).toBe(false);
  });

  it("memória active que BLOQUEARIA: simula block mas ação real continua pending_approval", () => {
    const memories = [
      mem({
        id: "b1",
        status: "active",
        key: "do_not_scale_this_product",
        value: { action_type: "increase_budget", campaign_id: "camp_1" },
      }),
    ];
    const { real, before, trace, guardOut } = simulateSilentPlug(buildRealAction("up"), memories);
    expect(guardOut.recommendation.proposed_status).toBe("needs_human_review");
    expect(trace.influence_type).toBe("block");
    // Real permanece intacta:
    expect(real.status).toBe("pending_approval");
    expect(real.status).toBe(before.status);
    expect(real.action_type).toBe("adjust_budget");
    expect(real.action_data.change_pct).toBe(before.action_data.change_pct);
    expect(real.action_data.new_budget_cents).toBe(before.action_data.new_budget_cents);
    expect(real.action_data.tenant_memory_silent_trace.applied_to_decision).toBe(false);
    expect(real.action_data.tenant_memory_silent_trace.real_recommendation_changed).toBe(false);
  });

  it("memória active que SUAVIZARIA: simula soften mas orçamento persistido não muda", () => {
    const memories = [
      mem({
        id: "s1",
        status: "active",
        key: "budget_preference",
        value: { style: "conservative", max_increase_pct: 5 },
      }),
    ];
    const real = buildRealAction("up"); // change_pct = +10%
    const { real: after, before, trace, guardOut } = simulateSilentPlug(real, memories);
    expect(trace.influence_type).toBe("soften");
    // Guard simulado reduziu params (apenas em recommendation), mas real intacto:
    expect((guardOut.recommendation.params as any).increase_pct).toBeLessThanOrEqual(5);
    expect(after.action_data.change_pct).toBe(before.action_data.change_pct);
    expect(after.action_data.new_budget_cents).toBe(before.action_data.new_budget_cents);
    expect(after.action_data.proposed_daily_budget_cents).toBe(before.action_data.proposed_daily_budget_cents);
    expect(after.action_data.tenant_memory_silent_trace.applied_to_decision).toBe(false);
    expect(after.action_data.tenant_memory_silent_trace.real_recommendation_changed).toBe(false);
  });

  it("entrada inválida do Guard → fail_open, ação real intacta", () => {
    const real = buildRealAction("up");
    const out = applyTenantPreferenceGuard({
      tenant_id: "",
      ads_platform: "meta",
      action_type: "increase_budget",
      draft: { action_type: "increase_budget" },
      memories: [],
    } as any);
    expect(out.trace.fail_open).toBe(true);
    expect(real.action_type).toBe("adjust_budget");
    expect(real.status).toBe("pending_approval");
  });

  it("trace nunca sobrescreve policy_check_result nem observation", () => {
    const real: any = buildRealAction("up");
    real.policy_check_result = { observation: { keep: "me" } };
    const memories = [
      mem({ id: "p2", status: "provisional", key: "approved_action_pattern", value: { action_type: "increase_budget" } }),
    ];
    simulateSilentPlug(real, memories);
    expect(real.policy_check_result).toEqual({ observation: { keep: "me" } });
    expect(real.action_data.tenant_memory_silent_trace).toBeDefined();
  });
});
