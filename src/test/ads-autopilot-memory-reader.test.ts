// =====================================================================
// Subfase D — Leitura Observacional da Tenant Memory
// Testes específicos do helper puro. Não tocam banco. Garantem
// isolamento por tenant, filtros, memória vazia e ausência de efeitos
// colaterais (sem Meta, sem fetch, sem supabase, sem influência em
// veredito/status/policy).
// =====================================================================

import { describe, it, expect, vi } from "vitest";
import {
  buildMemoryObservation,
  canQueryTenantMemory,
  filterApplicableMemories,
  OBSERVATIONAL_STATUSES,
  readTenantMemoryObservational,
  type TenantMemoryRow,
} from "@/lib/adsAutopilot/memoryReader";

const TENANT = "d1a4d0ed-8842-495e-b741-540a9a345b25";
const OTHER_TENANT = "00000000-0000-0000-0000-000000000999";

function mem(overrides: Partial<TenantMemoryRow> = {}): TenantMemoryRow {
  return {
    id: crypto.randomUUID(),
    tenant_id: TENANT,
    sales_platform: "storefront",
    ads_platform: "meta",
    memory_type: "approved_action_pattern",
    scope: "action_type",
    key: "increase_budget",
    value: {},
    confidence: 0.6,
    evidence_count: 3,
    status: "provisional",
    ...overrides,
  };
}

describe("canQueryTenantMemory", () => {
  it("falso sem tenant_id", () => {
    expect(canQueryTenantMemory({ ads_platform: "meta" })).toBe(false);
  });
  it("falso sem ads_platform", () => {
    expect(canQueryTenantMemory({ tenant_id: TENANT })).toBe(false);
  });
  it("verdadeiro com tenant_id + ads_platform", () => {
    expect(canQueryTenantMemory({ tenant_id: TENANT, ads_platform: "meta" })).toBe(true);
  });
});

describe("filterApplicableMemories — isolamento e filtros", () => {
  it("NUNCA retorna memória de outro tenant", () => {
    const rows = [mem(), mem({ tenant_id: OTHER_TENANT })];
    const out = filterApplicableMemories(rows, { tenant_id: TENANT, ads_platform: "meta" });
    expect(out).toHaveLength(1);
    expect(out[0].tenant_id).toBe(TENANT);
  });

  it("aceita provisional e active; rejeita archived", () => {
    const rows = [
      mem({ status: "provisional" }),
      mem({ status: "active" }),
      mem({ status: "archived" }),
    ];
    const out = filterApplicableMemories(rows, { tenant_id: TENANT, ads_platform: "meta" });
    expect(out.map((r) => r.status).sort()).toEqual(["active", "provisional"]);
    expect(OBSERVATIONAL_STATUSES).toEqual(["provisional", "active"]);
  });

  it("filtra por ads_platform", () => {
    const rows = [mem({ ads_platform: "meta" }), mem({ ads_platform: "google" })];
    const out = filterApplicableMemories(rows, { tenant_id: TENANT, ads_platform: "meta" });
    expect(out).toHaveLength(1);
    expect(out[0].ads_platform).toBe("meta");
  });

  it("filtra por sales_platform", () => {
    const rows = [
      mem({ sales_platform: "storefront" }),
      mem({ sales_platform: "marketplace" }),
    ];
    const out = filterApplicableMemories(rows, {
      tenant_id: TENANT, ads_platform: "meta", sales_platform: "storefront",
    });
    expect(out).toHaveLength(1);
  });

  it("filtra por scope/memory_type/key quando informados", () => {
    const rows = [
      mem({ scope: "action_type", memory_type: "approved_action_pattern", key: "increase_budget" }),
      mem({ scope: "reason_code", memory_type: "campaign_protection_candidate", key: "protect_winning_campaign" }),
    ];
    const out = filterApplicableMemories(rows, {
      tenant_id: TENANT, ads_platform: "meta",
      scope: "reason_code", memory_type: "campaign_protection_candidate",
    });
    expect(out).toHaveLength(1);
    expect(out[0].key).toBe("protect_winning_campaign");
  });

  it("filtros opcionais no value: só descarta quando o campo existe e diverge", () => {
    const rows = [
      mem({ value: { objective: "OUTCOME_SALES" } }),
      mem({ value: { objective: "OUTCOME_TRAFFIC" } }),
      mem({ value: {} }), // sem objective → permanece
    ];
    const out = filterApplicableMemories(rows, {
      tenant_id: TENANT, ads_platform: "meta", objective: "OUTCOME_SALES",
    });
    expect(out).toHaveLength(2);
  });

  it("min_confidence corta abaixo do limiar", () => {
    const rows = [mem({ confidence: 0.2 }), mem({ confidence: 0.9 })];
    const out = filterApplicableMemories(rows, {
      tenant_id: TENANT, ads_platform: "meta", min_confidence: 0.5,
    });
    expect(out).toHaveLength(1);
    expect(out[0].confidence).toBe(0.9);
  });

  it("sem tenant_id no contexto retorna vazio (defesa em profundidade)", () => {
    const out = filterApplicableMemories([mem()], { ads_platform: "meta" });
    expect(out).toEqual([]);
  });
});

describe("buildMemoryObservation", () => {
  it("memória vazia → reason explica vazio e applied_to_decision=false", () => {
    const obs = buildMemoryObservation([]);
    expect(obs.mode).toBe("observational_only");
    expect(obs.memory_candidates_count).toBe(0);
    expect(obs.memory_ids_considered).toEqual([]);
    expect(obs.statuses_considered).toEqual([]);
    expect(obs.applied_to_decision).toBe(false);
    expect(obs.reason).toMatch(/empty|not_applicable/);
  });

  it("com memórias → conta candidatas, status únicos e mantém applied_to_decision=false", () => {
    const obs = buildMemoryObservation([mem({ status: "provisional" }), mem({ status: "active" }), mem({ status: "active" })]);
    expect(obs.memory_candidates_count).toBe(3);
    expect(obs.memory_ids_considered).toHaveLength(3);
    expect(obs.statuses_considered.sort()).toEqual(["active", "provisional"]);
    expect(obs.applied_to_decision).toBe(false);
    expect(obs.reason).toBe("tenant_memory_not_active_for_influence");
  });
});

describe("readTenantMemoryObservational — orquestração", () => {
  it("sem tenant_id/ads_platform → não chama fetcher e devolve vazio", async () => {
    const fetcher = vi.fn();
    const out = await readTenantMemoryObservational({ tenant_id: TENANT }, fetcher as any);
    expect(fetcher).not.toHaveBeenCalled();
    expect(out.rows).toEqual([]);
    expect(out.observation.reason).toBe("missing_tenant_or_ads_platform");
  });

  it("memória vazia no banco → não quebra, devolve observação coerente", async () => {
    const fetcher = vi.fn().mockResolvedValue([]);
    const out = await readTenantMemoryObservational(
      { tenant_id: TENANT, ads_platform: "meta" }, fetcher as any,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(out.rows).toEqual([]);
    expect(out.observation.memory_candidates_count).toBe(0);
    expect(out.observation.applied_to_decision).toBe(false);
  });

  it("memória provisional + active → retorna ambas como candidatas observacionais", async () => {
    const fetcher = vi.fn().mockResolvedValue([
      mem({ status: "provisional" }),
      mem({ status: "active" }),
    ]);
    const out = await readTenantMemoryObservational(
      { tenant_id: TENANT, ads_platform: "meta" }, fetcher as any,
    );
    expect(out.rows).toHaveLength(2);
    expect(out.observation.memory_candidates_count).toBe(2);
    expect(out.observation.applied_to_decision).toBe(false);
  });

  it("falha do fetcher é absorvida (observacional não pode quebrar a IA)", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("boom"));
    const out = await readTenantMemoryObservational(
      { tenant_id: TENANT, ads_platform: "meta" }, fetcher as any,
    );
    expect(out.rows).toEqual([]);
    expect(out.observation.reason).toBe("tenant_memory_fetch_failed_observational_only");
  });

  it("não vaza memória de outro tenant mesmo se o fetcher retornar (defesa em profundidade)", async () => {
    const fetcher = vi.fn().mockResolvedValue([mem({ tenant_id: OTHER_TENANT }), mem()]);
    const out = await readTenantMemoryObservational(
      { tenant_id: TENANT, ads_platform: "meta" }, fetcher as any,
    );
    expect(out.rows).toHaveLength(1);
    expect(out.rows[0].tenant_id).toBe(TENANT);
  });
});

describe("Contrato anti-regressão: sem influência e sem efeitos colaterais", () => {
  it("módulo é puro — não importa supabase, não chama fetch, não chama Meta", async () => {
    const mod = await import("@/lib/adsAutopilot/memoryReader");
    const src = Object.values(mod)
      .filter((v) => typeof v === "function")
      .map((f) => (f as Function).toString())
      .join("\n");
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/supabase/i);
    expect(src).not.toMatch(/facebook|graph\.facebook|meta\.com/i);
  });

  it("observação sempre carrega applied_to_decision=false (nesta subfase)", () => {
    for (const rows of [[], [mem()], [mem({ status: "active" }), mem({ status: "provisional" })]]) {
      expect(buildMemoryObservation(rows).applied_to_decision).toBe(false);
    }
  });

  it("leitura observacional NÃO retorna campos de veredito/action/status alterados", async () => {
    // Defesa de contrato: o helper devolve TenantMemoryRow cru + observation.
    // Não existe nele nenhuma propriedade que represente decisão da IA
    // (verdict/action_type_override/policy_override/etc).
    const out = await readTenantMemoryObservational(
      { tenant_id: TENANT, ads_platform: "meta" },
      async () => [mem()],
    );
    const forbidden = ["verdict", "action_override", "policy_override", "status_override", "executed"];
    for (const row of out.rows) {
      for (const f of forbidden) expect(row as any).not.toHaveProperty(f);
    }
    expect(out.observation as any).not.toHaveProperty("verdict");
  });
});
