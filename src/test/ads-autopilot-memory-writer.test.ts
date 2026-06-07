// =====================================================================
// Testes específicos do Tenant Memory Writer — Subfase C
// Não tocam o banco; cobrem a lógica determinística pura.
// =====================================================================

import { describe, it, expect } from "vitest";
import {
  deriveEvidencesFromFeedback,
  recomputeMemoryFromEvidences,
  __THRESHOLDS__,
  type FeedbackRow,
  type EvidenceRecord,
} from "@/lib/adsAutopilot/memoryWriter";

const TENANT = "d1a4d0ed-8842-495e-b741-540a9a345b25";

function fb(overrides: Partial<FeedbackRow> = {}): FeedbackRow {
  return {
    id: crypto.randomUUID(),
    tenant_id: TENANT,
    sales_platform: "storefront",
    ads_platform: "meta",
    action_type: "increase_budget",
    objective: "OUTCOME_SALES",
    decision: "approved",
    reason_codes: ["good_budget_logic"],
    should_become_preference: false,
    decided_at: new Date().toISOString(),
    ...overrides,
  };
}

function ev(overrides: Partial<EvidenceRecord> = {}): EvidenceRecord {
  return {
    is_supporting: true,
    weight: 1.0,
    processed_at: new Date().toISOString(),
    should_become_preference: false,
    ...overrides,
  };
}

describe("deriveEvidencesFromFeedback", () => {
  it("aprovação gera approved_action_pattern + espelho de contradição rejected_action_pattern", () => {
    const evs = deriveEvidencesFromFeedback(fb({ decision: "approved" }));
    const types = evs.map((e) => `${e.memory_type}:${e.is_supporting}`);
    expect(types).toContain("approved_action_pattern:true");
    expect(types).toContain("rejected_action_pattern:false");
  });

  it("recusa gera rejected_action_pattern e espelha approved_action_pattern como contradição", () => {
    const evs = deriveEvidencesFromFeedback(
      fb({ decision: "rejected", reason_codes: ["insufficient_data"] }),
    );
    const types = evs.map((e) => `${e.memory_type}:${e.is_supporting}`);
    expect(types).toContain("rejected_action_pattern:true");
    expect(types).toContain("approved_action_pattern:false");
  });

  it("edited_then_approved conta como aprovação", () => {
    const evs = deriveEvidencesFromFeedback(
      fb({ decision: "edited_then_approved" }),
    );
    expect(evs.some((e) => e.memory_type === "approved_action_pattern" && e.is_supporting)).toBe(true);
  });

  it("should_become_preference=true eleva o peso para 2.0", () => {
    const evs = deriveEvidencesFromFeedback(fb({ should_become_preference: true }));
    expect(evs.every((e) => e.weight === 2.0)).toBe(true);
  });

  it("reason_code conhecido gera memória do tipo correto", () => {
    const evs = deriveEvidencesFromFeedback(
      fb({ reason_codes: ["protect_winning_campaign"] }),
    );
    expect(evs.some((e) => e.memory_type === "campaign_protection_candidate")).toBe(true);
  });

  it("reason_code desconhecido NÃO gera memória de reason_code (mas mantém action_pattern)", () => {
    const evs = deriveEvidencesFromFeedback(
      fb({ reason_codes: ["codigo_nunca_visto"] }),
    );
    expect(evs.every((e) => e.scope !== "reason_code")).toBe(true);
  });

  it("sem action_type não emite action_pattern", () => {
    const evs = deriveEvidencesFromFeedback(fb({ action_type: null }));
    expect(evs.every((e) => e.memory_type !== "approved_action_pattern")).toBe(true);
  });
});

describe("recomputeMemoryFromEvidences — regras de promoção", () => {
  it("0 evidências: provisional, confidence 0", () => {
    const r = recomputeMemoryFromEvidences([]);
    expect(r.status).toBe("provisional");
    expect(r.confidence).toBe(0);
  });

  it("1 evidência: provisional (nunca active com uma única evidência)", () => {
    const r = recomputeMemoryFromEvidences([ev()]);
    expect(r.status).toBe("provisional");
  });

  it("2 evidências consistentes: provisional", () => {
    const r = recomputeMemoryFromEvidences([ev(), ev()]);
    expect(r.status).toBe("provisional");
    expect(r.evidence_count).toBe(2);
  });

  it("5 evidências 100% consistentes: active", () => {
    const r = recomputeMemoryFromEvidences([ev(), ev(), ev(), ev(), ev()]);
    expect(r.status).toBe("active");
    expect(r.confidence).toBeGreaterThan(0.7);
  });

  it("5 evidências, 80% consistência (4 a favor, 1 contra antiga): active", () => {
    const old = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
    const r = recomputeMemoryFromEvidences([
      ev(), ev(), ev(), ev(),
      ev({ is_supporting: false, processed_at: old }),
    ]);
    expect(r.consistency).toBeGreaterThanOrEqual(0.8);
    expect(r.status).toBe("active");
  });

  it("5 evidências, 60% consistência: NÃO ativa", () => {
    const r = recomputeMemoryFromEvidences([
      ev(), ev(), ev(),
      ev({ is_supporting: false }),
      ev({ is_supporting: false }),
    ]);
    expect(r.status).toBe("provisional");
  });

  it("should_become_preference=true aumenta confidence", () => {
    const sem = recomputeMemoryFromEvidences([ev(), ev()]);
    const com = recomputeMemoryFromEvidences([
      ev({ should_become_preference: true }),
      ev({ should_become_preference: true }),
    ]);
    expect(com.confidence).toBeGreaterThan(sem.confidence);
  });

  it("feedback contrário reduz confidence", () => {
    const ok = recomputeMemoryFromEvidences([ev(), ev(), ev(), ev(), ev()]);
    const comContra = recomputeMemoryFromEvidences([
      ev(), ev(), ev(), ev(), ev(),
      ev({ is_supporting: false }),
    ]);
    expect(comContra.confidence).toBeLessThan(ok.confidence);
  });

  it("3 contradições recentes rebaixam active para provisional", () => {
    const r = recomputeMemoryFromEvidences(
      [
        ev(), ev(), ev(), ev(), ev(), ev(), ev(), ev(),
        ev({ is_supporting: false }),
        ev({ is_supporting: false }),
        ev({ is_supporting: false }),
      ],
      new Date(),
      "active",
    );
    expect(r.recent_contradictions).toBeGreaterThanOrEqual(3);
    expect(r.status).toBe("provisional");
  });

  it("status archived é preservado (nunca reclassificado)", () => {
    const r = recomputeMemoryFromEvidences(
      [ev(), ev(), ev(), ev(), ev()],
      new Date(),
      "archived",
    );
    expect(r.status).toBe("archived");
  });

  it("confidence sempre entre 0 e 1", () => {
    const r = recomputeMemoryFromEvidences(
      Array.from({ length: 50 }, () => ev({ should_become_preference: true })),
    );
    expect(r.confidence).toBeGreaterThanOrEqual(0);
    expect(r.confidence).toBeLessThanOrEqual(1);
  });

  it("thresholds documentados ficam estáveis (anti-regressão)", () => {
    expect(__THRESHOLDS__.ACTIVE_MIN_EVIDENCES).toBe(5);
    expect(__THRESHOLDS__.ACTIVE_MIN_CONSISTENCY).toBe(0.8);
    expect(__THRESHOLDS__.ACTIVE_MAX_RECENT_CONTRADICTIONS).toBe(3);
    expect(__THRESHOLDS__.PROVISIONAL_MIN_EVIDENCES).toBe(2);
  });
});

describe("Writer não tem efeitos colaterais proibidos (contrato)", () => {
  it("não importa supabase nem fetch nem chama Meta no módulo puro", async () => {
    const mod = await import("@/lib/adsAutopilot/memoryWriter");
    const src = Object.values(mod)
      .filter((v) => typeof v === "function")
      .map((f) => (f as Function).toString())
      .join("\n");
    expect(src).not.toMatch(/fetch\(/);
    expect(src).not.toMatch(/supabase/i);
    expect(src).not.toMatch(/facebook|graph\.facebook|meta\.com/i);
  });
});
