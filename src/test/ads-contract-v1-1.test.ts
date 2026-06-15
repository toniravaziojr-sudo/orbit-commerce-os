// =============================================================================
// Onda H.2.1 — Testes do contrato Meta Vendas v1.1
// =============================================================================

import { describe, it, expect } from "vitest";
import {
  deriveCampaignProposalV1_1,
  applyV1_1Patch,
  CAMPAIGN_PROPOSAL_V1_1,
} from "@/lib/ads/contracts/campaignProposalV1_1";
import { runStructureCompletenessGate } from "@/lib/ads/gates/structureCompleteness";
import { runPlatformCompatibilityGate } from "@/lib/ads/gates/platformCompatibility";
import { normalizeCampaignStructure } from "@/lib/ads/normalizeCampaignStructure";

function metaSalesBase() {
  return {
    schema_version: "campaign_proposal_v1",
    platform: "meta",
    campaign: {
      name: "[Frio] Kit — 2026-06-15",
      objective: "sales",
      campaign_type: "prospecting",
      daily_budget_cents: 9000,
    },
    adsets: [
      { index: 0, name: "Conjunto 1", daily_budget_cents: null, age_min: 25, age_max: 55, location: "BR", placements: ["advantage_plus"] },
      { index: 1, name: "Conjunto 2", daily_budget_cents: null, age_min: 25, age_max: 55, location: "BR", placements: ["advantage_plus"] },
    ],
    planned_creatives: [],
  };
}

function metaSalesTestingBase() {
  return {
    schema_version: "campaign_proposal_v1",
    platform: "meta",
    campaign: {
      name: "[Teste] Kit — 2026-06-15",
      objective: "sales",
      campaign_type: "testing",
      daily_budget_cents: 2500,
    },
    adsets: [
      { index: 0, daily_budget_cents: 833 },
      { index: 1, daily_budget_cents: 833 },
      { index: 2, daily_budget_cents: 834 },
    ],
    planned_creatives: [],
  };
}

describe("Onda H.2.1 — Derivação determinística v1.1", () => {
  it("Meta Vendas prospecting → CBO, orçamento na campanha, conjuntos zerados", () => {
    const d = deriveCampaignProposalV1_1({ action_data: metaSalesBase() });
    expect(d.contract_version).toBe(CAMPAIGN_PROPOSAL_V1_1);
    expect(d.platform).toBe("meta");
    expect(d.platform_objective).toBe("OUTCOME_SALES");
    expect(d.objective_canonical).toBe("sales");
    expect(d.sales_subtype).toBe("manual_sales");
    expect(d.internal_strategy_tag).toBe("prospecting");
    expect(d.budget_mode).toBe("CBO");
    expect(d.campaign_budget_cents).toBe(9000);
    expect(d.adset_budget_cents_by_index[0]).toBe(null);
    expect(d.adset_budget_cents_by_index[1]).toBe(null);
    expect(d.requires_catalog).toBe(false);
    expect(d.contract_validation_status).toBe("ok");
    expect(d.unsupported_reason).toBe(null);
  });

  it("Meta Vendas testing → ABO, orçamento nos conjuntos, campanha zerada", () => {
    const d = deriveCampaignProposalV1_1({ action_data: metaSalesTestingBase() });
    expect(d.budget_mode).toBe("ABO");
    expect(d.internal_strategy_tag).toBe("testing");
    expect(d.campaign_budget_cents).toBe(null);
    expect(d.adset_budget_cents_by_index[0]).toBe(833);
    expect(d.adset_budget_cents_by_index[1]).toBe(833);
    expect(d.adset_budget_cents_by_index[2]).toBe(834);
    expect(d.notes).toContain("resolved_mixed_to_abo");
  });

  it("Testing sem orçamento por conjunto → distribui igualmente a partir da campanha", () => {
    const base = metaSalesTestingBase();
    base.adsets.forEach((a: any) => { a.daily_budget_cents = null; });
    const d = deriveCampaignProposalV1_1({ action_data: base });
    expect(d.budget_mode).toBe("ABO");
    expect(d.campaign_budget_cents).toBe(null);
    // 2500 / 3 = 833 base + 1 resto no último → 833, 833, 834
    expect(d.adset_budget_cents_by_index[0]).toBe(833);
    expect(d.adset_budget_cents_by_index[1]).toBe(833);
    expect(d.adset_budget_cents_by_index[2]).toBe(834);
    expect(d.notes).toContain("abo_split_from_campaign_budget");
  });

  it("Plataforma diferente de Meta → blocked com mensagem PT-BR", () => {
    const base: any = metaSalesBase();
    base.platform = "google";
    base.campaign.platform = "google";
    const d = deriveCampaignProposalV1_1({ action_data: base });
    expect(d.contract_validation_status).toBe("blocked");
    expect(d.unsupported_reason).toMatch(/google/i);
    expect(d.unsupported_reason).toMatch(/Meta Ads está habilitado/i);
  });

  it("Objetivo Meta diferente de Vendas → blocked", () => {
    const base: any = metaSalesBase();
    base.campaign.objective = "leads";
    const d = deriveCampaignProposalV1_1({ action_data: base });
    expect(d.contract_validation_status).toBe("blocked");
    expect(d.unsupported_reason).toMatch(/Geração de leads|leads/i);
  });

  it("TikTok → blocked", () => {
    const base: any = metaSalesBase();
    base.platform = "tiktok";
    base.campaign.platform = "tiktok";
    const d = deriveCampaignProposalV1_1({ action_data: base });
    expect(d.contract_validation_status).toBe("blocked");
  });

  it("Catalog prospecting sem catálogo no cache → pending_dependency", () => {
    const base: any = metaSalesBase();
    base.campaign.campaign_type = "catalog_prospecting";
    const d = deriveCampaignProposalV1_1({ action_data: base, cached_catalogs: [] });
    expect(d.sales_subtype).toBe("advantage_plus_shopping");
    expect(d.requires_catalog).toBe(true);
    expect(d.contract_validation_status).toBe("pending_dependency");
  });

  it("Catalog prospecting com 1 catálogo único em cache → ok e resolvido", () => {
    const base: any = metaSalesBase();
    base.campaign.campaign_type = "catalog_prospecting";
    const d = deriveCampaignProposalV1_1({
      action_data: base,
      cached_catalogs: [{ id: "cat_123", name: "Loja" }],
    });
    expect(d.product_catalog_id).toBe("cat_123");
    expect(d.contract_validation_status).toBe("ok");
    expect(d.notes).toContain("catalog_resolved_from_cache_unique");
  });

  it("applyV1_1Patch é idempotente nos campos contratuais", () => {
    const v1 = metaSalesBase();
    const once = applyV1_1Patch(v1, "meta");
    const twice = applyV1_1Patch(once, "meta");
    // Os campos contratuais devem ser idênticos entre passadas (timestamp é exceção esperada).
    const stripDerivedAt = (x: any) => {
      const cp = JSON.parse(JSON.stringify(x));
      if (cp.contract_v1_1_meta) delete cp.contract_v1_1_meta.derived_at;
      return cp;
    };
    expect(stripDerivedAt(once)).toEqual(stripDerivedAt(twice));
  });
});

describe("Onda H.2.1 — Gates", () => {
  it("Platform Compatibility Gate bloqueia quando contract_validation_status=blocked", () => {
    const v11 = applyV1_1Patch({ ...metaSalesBase(), platform: "tiktok", campaign: { ...metaSalesBase().campaign, platform: "tiktok" } }, "tiktok");
    const structure = normalizeCampaignStructure(v11);
    const r = runPlatformCompatibilityGate(structure, null);
    expect(r.passed).toBe(false);
    expect(r.blockers.length).toBe(1);
    expect(r.blockers[0].message).toMatch(/tiktok/i);
  });

  it("Structure Completeness Gate aceita CBO com orçamento na campanha", () => {
    const v11 = applyV1_1Patch(metaSalesBase(), "meta");
    const structure = normalizeCampaignStructure(v11);
    const r = runStructureCompletenessGate(structure);
    const budgetBlockers = r.blockers.filter((b) => b.field.includes("budget"));
    expect(budgetBlockers.length).toBe(0);
  });

  it("Structure Completeness Gate detecta mixed_budget_modes quando não há budget_mode", () => {
    // Payload v1 cru com orçamento na campanha E em adsets simultaneamente.
    const raw = {
      schema_version: "campaign_proposal_v1",
      platform: "meta",
      campaign: { name: "X", objective: "sales", daily_budget_cents: 9000 },
      adsets: [{ index: 0, name: "A", daily_budget_cents: 5000, location: "BR", age_min: 18, age_max: 65, gender: "all", placements: ["advantage_plus"], optimization_goal: "OFFSITE_CONVERSIONS" }],
    };
    const structure = normalizeCampaignStructure(raw);
    const r = runStructureCompletenessGate(structure);
    const mixed = r.blockers.find((b) => b.technical_reason === "mixed_budget_modes");
    expect(mixed).toBeTruthy();
  });
});

describe("Onda H.2.1 — Normalizador aceita v1 e v1.1", () => {
  it("normaliza payload v1 legado sem campos novos", () => {
    const s = normalizeCampaignStructure(metaSalesBase());
    expect(s.is_structured_campaign).toBe(true);
    expect(s.campaign.budget_mode).toBe(null);
  });

  it("normaliza payload v1.1 e expõe budget_mode, contract_validation_status, unsupported_reason", () => {
    const v11 = applyV1_1Patch(metaSalesBase(), "meta");
    const s = normalizeCampaignStructure(v11);
    expect(s.contract_version).toBe("campaign_proposal_v1_1");
    expect(s.contract_validation_status).toBe("ok");
    expect(s.campaign.budget_mode).toBe("CBO");
  });
});
