// Tests — Tenant Preference Guard (Etapa 7.mem — Subfase F.1)
// Pure/deterministic. No DB, no Meta, no LLM.

import { describe, it, expect } from "vitest";
import {
  applyTenantPreferenceGuard,
  type GuardInput,
  type DraftRecommendation,
} from "@/lib/adsAutopilot/tenantPreferenceGuard";
import type { TenantMemoryRow } from "@/lib/adsAutopilot/memoryReader";

const TENANT = "d1a4d0ed-8842-495e-b741-540a9a345b25";

function mem(over: Partial<TenantMemoryRow>): TenantMemoryRow {
  return {
    id: over.id ?? `m-${Math.random().toString(36).slice(2, 9)}`,
    tenant_id: over.tenant_id ?? TENANT,
    sales_platform: over.sales_platform ?? "shopify",
    ads_platform: over.ads_platform ?? "meta",
    memory_type: over.memory_type ?? "preference",
    scope: over.scope ?? "global",
    key: over.key ?? "approved_action_pattern",
    value: over.value ?? {},
    confidence: over.confidence ?? 0.9,
    evidence_count: over.evidence_count ?? 5,
    status: over.status ?? "active",
  };
}

function baseInput(
  draft: DraftRecommendation,
  memories: TenantMemoryRow[] = [],
  patch: Partial<GuardInput> = {},
): GuardInput {
  return {
    tenant_id: TENANT,
    ads_platform: "meta",
    sales_platform: "shopify",
    action_type: draft.action_type,
    objective: "sales",
    draft,
    memories,
    ...patch,
  };
}

describe("Tenant Preference Guard — Subfase F.1", () => {
  it("memória vazia retorna recomendação original com influence_type=none", () => {
    const draft: DraftRecommendation = { action_type: "increase_budget", params: { increase_pct: 30 } };
    const out = applyTenantPreferenceGuard(baseInput(draft, []));
    expect(out.recommendation).toBe(draft);
    expect(out.trace.influence_type).toBe("none");
    expect(out.trace.tenant_memory_used).toBe(false);
    expect(out.trace.applied_to_decision).toBe(false);
    expect(out.trace.fail_open).toBe(false);
  });

  it("sem memória aplicável (outro action_type) retorna none", () => {
    const draft: DraftRecommendation = { action_type: "pause_campaign" };
    const memories = [mem({ key: "approved_action_pattern", value: { action_type: "increase_budget" } })];
    const out = applyTenantPreferenceGuard(baseInput(draft, memories));
    expect(out.trace.influence_type).toBe("none");
    expect(out.trace.why_memory_did_not_apply.length).toBeGreaterThan(0);
  });

  it("memória provisional NÃO bloqueia sozinha — apenas enriquece rationale", () => {
    const draft: DraftRecommendation = { action_type: "increase_budget" };
    const memories = [
      mem({
        status: "provisional",
        key: "do_not_scale_this_product",
        value: { action_type: "increase_budget" },
      }),
    ];
    const out = applyTenantPreferenceGuard(baseInput(draft, memories));
    expect(out.trace.influence_type).toBe("enrich_rationale");
    expect(out.recommendation.proposed_status).toBeUndefined();
    expect(out.trace.memory_statuses_used).toContain("provisional");
  });

  it("memória active pode BLOQUEAR → status vira needs_human_review", () => {
    const draft: DraftRecommendation = { action_type: "increase_budget", proposed_status: "proposed" };
    const memories = [
      mem({ key: "do_not_scale_this_product", value: { action_type: "increase_budget" } }),
    ];
    const out = applyTenantPreferenceGuard(baseInput(draft, memories));
    expect(out.trace.influence_type).toBe("block");
    expect(out.recommendation.proposed_status).toBe("needs_human_review");
    expect(out.trace.applied_to_decision).toBe(true);
  });

  it("memória active pode SUAVIZAR aumento de orçamento agressivo", () => {
    const draft: DraftRecommendation = {
      action_type: "increase_budget",
      params: { increase_pct: 80 },
    };
    const memories = [
      mem({
        key: "budget_preference",
        value: { style: "conservative", max_increase_pct: 20 },
      }),
    ];
    const out = applyTenantPreferenceGuard(baseInput(draft, memories));
    expect(out.trace.influence_type).toBe("soften");
    expect((out.recommendation.params as any).increase_pct).toBe(20);
    expect(out.trace.applied_to_decision).toBe(true);
  });

  it("memória active alinhada PRIORIZA sugestão", () => {
    const draft: DraftRecommendation = { action_type: "increase_budget" };
    const memories = [
      mem({ key: "approved_action_pattern", value: { action_type: "increase_budget" } }),
    ];
    const out = applyTenantPreferenceGuard(baseInput(draft, memories));
    expect(out.trace.influence_type).toBe("prioritize");
    expect(out.recommendation.priority).toBe("high");
  });

  it("memória archived é IGNORADA", () => {
    const draft: DraftRecommendation = { action_type: "increase_budget" };
    const memories = [
      mem({
        status: "archived",
        key: "do_not_scale_this_product",
        value: { action_type: "increase_budget" },
      }),
    ];
    const out = applyTenantPreferenceGuard(baseInput(draft, memories));
    expect(out.trace.influence_type).toBe("none");
    expect(out.recommendation).toBe(draft);
  });

  it("conflito com camada superior — Tenant Memory PERDE (governance_blocked)", () => {
    const draft: DraftRecommendation = { action_type: "increase_budget" };
    const memories = [
      mem({ key: "do_not_scale_this_product", value: { action_type: "increase_budget" } }),
    ];
    const out = applyTenantPreferenceGuard(
      baseInput(draft, memories, { governance: { governance_blocked: true } }),
    );
    expect(out.trace.influence_type).toBe("none");
    expect(out.trace.why_memory_did_not_apply).toContain("upper_layer_locked_memory_skipped");
  });

  it("configuração explícita do tenant SOBREPÕE bloqueio da memória", () => {
    const draft: DraftRecommendation = { action_type: "increase_budget" };
    const memories = [
      mem({ key: "do_not_scale_this_product", value: { action_type: "increase_budget" } }),
    ];
    const out = applyTenantPreferenceGuard(
      baseInput(draft, memories, { governance: { tenant_explicit_required: true } }),
    );
    expect(out.trace.influence_type).toBe("none");
  });

  it("fail_open: input inválido devolve original com fail_open=true", () => {
    const draft = { action_type: "x" } as DraftRecommendation;
    const out = applyTenantPreferenceGuard({ ...({} as any), draft });
    expect(out.trace.fail_open).toBe(true);
    expect(out.recommendation).toBe(draft);
  });

  it("isolation por tenant: memória de outro tenant é descartada", () => {
    const draft: DraftRecommendation = { action_type: "increase_budget" };
    const memories = [
      mem({
        tenant_id: "outro-tenant",
        key: "do_not_scale_this_product",
        value: { action_type: "increase_budget" },
      }),
    ];
    const out = applyTenantPreferenceGuard(baseInput(draft, memories));
    expect(out.trace.influence_type).toBe("none");
    expect(out.trace.tenant_memory_used).toBe(false);
  });

  it("isolation por ads_platform: memória de outra plataforma é descartada", () => {
    const draft: DraftRecommendation = { action_type: "increase_budget" };
    const memories = [
      mem({
        ads_platform: "google",
        key: "do_not_scale_this_product",
        value: { action_type: "increase_budget" },
      }),
    ];
    const out = applyTenantPreferenceGuard(baseInput(draft, memories));
    expect(out.trace.influence_type).toBe("none");
  });

  it("influence_trace é SEMPRE produzido", () => {
    const cases: GuardInput[] = [
      baseInput({ action_type: "x" }, []),
      baseInput({ action_type: "increase_budget", params: { increase_pct: 80 } }, [
        mem({ key: "budget_preference", value: { style: "conservative", max_increase_pct: 10 } }),
      ]),
      baseInput({ action_type: "increase_budget" }, [
        mem({ key: "do_not_scale_this_product", value: { action_type: "increase_budget" } }),
      ]),
    ];
    for (const c of cases) {
      const out = applyTenantPreferenceGuard(c);
      expect(out.trace).toBeDefined();
      expect(out.trace.before_recommendation).toBeDefined();
      expect(out.trace.after_recommendation).toBeDefined();
      expect(typeof out.trace.applied_to_decision).toBe("boolean");
    }
  });

  it("Guard não importa Supabase/Meta/LLM (verificação textual do módulo)", async () => {
    const fs = await import("node:fs/promises");
    const src = await fs.readFile("src/lib/adsAutopilot/tenantPreferenceGuard.ts", "utf8");
    expect(src).not.toMatch(/from\s+["']@\/integrations\/supabase/);
    expect(src).not.toMatch(/graph\.facebook\.com/);
    expect(src).not.toMatch(/openai|anthropic|gemini|lovable\/ai/i);
    expect(src).not.toMatch(/\bfetch\s*\(/);
  });
});
