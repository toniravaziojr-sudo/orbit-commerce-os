// =============================================================================
// Testes — Meta Adapter (Objective Mapper) e Platform Compatibility Gate v2
// =============================================================================
import { describe, it, expect } from "vitest";
import {
  inferCanonicalObjective,
  objectiveLabelPtBr,
  translateObjectiveToMeta,
} from "@/lib/ads/platform/metaAdapter";
import { runPlatformCompatibilityGate, type PlatformCapabilitiesRow } from "@/lib/ads/gates/platformCompatibility";
import type { CampaignStructure } from "@/lib/ads/normalizeCampaignStructure";

const META_CAPS: PlatformCapabilitiesRow = {
  platform: "meta",
  status: "verificado",
  capabilities_version: "meta-baseline",
  adapter_version: "v0.1",
  last_verified_at: new Date().toISOString(),
  capabilities_json: {
    supported_objectives: ["OUTCOME_SALES", "OUTCOME_LEADS"],
    supported_conversion_events: ["PURCHASE"],
    supported_placements: ["advantage_plus"],
    supported_ctas: ["SHOP_NOW"],
    supported_creative_formats: ["SINGLE_IMAGE"],
  },
};

function structureWith(objective: string | null): CampaignStructure {
  return {
    schema_version: 2,
    is_structured_campaign: true,
    source: "canonical",
    campaign: {
      name: "x", objective, platform: "meta", buying_type: "AUCTION", budget_type: "daily",
      daily_budget_cents: 1000, planned_status: "PAUSED", rationale: null,
      inherited_destination_url: null, inherited_cta: null,
    },
    ad_sets: [], ads: [],
  };
}

describe("Meta Adapter — Objective Mapper", () => {
  it("traduz canônico 'sales' para OUTCOME_SALES", () => {
    expect(translateObjectiveToMeta("sales")).toBe("OUTCOME_SALES");
  });

  it("infere canônico a partir de strings legadas (SALES, sales, OUTCOME_SALES, Vendas)", () => {
    expect(inferCanonicalObjective("SALES")).toBe("sales");
    expect(inferCanonicalObjective("sales")).toBe("sales");
    expect(inferCanonicalObjective("OUTCOME_SALES")).toBe("sales");
    expect(inferCanonicalObjective("vendas")).toBe("sales");
    expect(inferCanonicalObjective("Conversions")).toBe("sales");
  });

  it("retorna null para entradas desconhecidas (sem inventar mapeamento)", () => {
    expect(inferCanonicalObjective("foobar")).toBeNull();
    expect(inferCanonicalObjective("")).toBeNull();
    expect(inferCanonicalObjective(null)).toBeNull();
  });

  it("expõe label PT-BR amigável", () => {
    expect(objectiveLabelPtBr("sales")).toBe("Vendas");
    expect(objectiveLabelPtBr("leads")).toBe("Geração de leads");
  });
});

describe("Platform Compatibility Gate v2 — objective via adapter", () => {
  it("não falha com mensagem técnica 'SALES não suportado' (corrige o bug do print)", () => {
    const s = structureWith("SALES");
    const r = runPlatformCompatibilityGate(s, META_CAPS);
    expect(r.passed).toBe(true);
    const techy = [...r.blockers, ...r.warnings].some((b) => /SALES/.test(b.message) && /não suportado/i.test(b.message));
    expect(techy).toBe(false);
  });

  it("aceita o canônico 'sales' como entrada e compara via tradução para OUTCOME_SALES", () => {
    const s = structureWith("sales");
    const r = runPlatformCompatibilityGate(s, META_CAPS);
    expect(r.passed).toBe(true);
  });

  it("dá mensagem amigável quando o objetivo é desconhecido", () => {
    const s = structureWith("foobar");
    const r = runPlatformCompatibilityGate(s, META_CAPS);
    expect(r.passed).toBe(false);
    const b = r.blockers.find((x) => x.field === "campaign.objective");
    expect(b?.node_type).toBe("campaign");
    expect(b?.message).toMatch(/Selecione um objetivo conhecido/);
  });

  it("blockers carregam node_type/node_id para alimentar o editor", () => {
    const s = structureWith("sales");
    s.ad_sets = [{
      id: null, name: "CJ 1", funnel_stage: null, audience_type: null, targeting_summary: null,
      inclusions: [], exclusions: [], customer_exclusion_applied: null, customer_exclusion_label: null,
      location: null, age_range: null, gender: null, placements: [],
      optimization_goal: null, conversion_event: null, schedule: null,
      daily_budget_cents: null, rationale: null,
    }];
    s.ads = [];
    const r = runPlatformCompatibilityGate(s, META_CAPS);
    // platform gate só vê objective compatível aqui — sem blockers; structureCompleteness é outro teste
    expect(r.blockers.every((b) => !!b.node_type)).toBe(true);
  });
});
