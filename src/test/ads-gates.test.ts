// =============================================================================
// Testes — Structure Completeness Gate + Platform Compatibility Gate
// =============================================================================
import { describe, it, expect } from "vitest";
import { runStructureCompletenessGate } from "@/lib/ads/gates/structureCompleteness";
import { runPlatformCompatibilityGate, type PlatformCapabilitiesRow } from "@/lib/ads/gates/platformCompatibility";
import type { CampaignStructure } from "@/lib/ads/normalizeCampaignStructure";

function emptyStructured(): CampaignStructure {
  return {
    schema_version: 2,
    is_structured_campaign: true,
    source: "canonical",
    campaign: {
      name: "Camp",
      objective: "OUTCOME_SALES",
      platform: "meta",
      buying_type: "AUCTION",
      budget_type: "daily",
      daily_budget_cents: 5000,
      planned_status: "PAUSED",
      rationale: "r",
      inherited_destination_url: null,
      inherited_cta: null,
    },
    ad_sets: [],
    ads: [],
  };
}

function fullAdSet() {
  return {
    id: null,
    name: "CJ 1",
    funnel_stage: "cold",
    audience_type: "broad",
    targeting_summary: "Homens 30-65 BR",
    inclusions: ["Estética"],
    exclusions: [],
    customer_exclusion_applied: true,
    customer_exclusion_label: "Clientes 30d",
    location: "BR",
    age_range: "28-55",
    gender: "Masculino",
    placements: ["advantage_plus"],
    optimization_goal: "OFFSITE_CONVERSIONS",
    conversion_event: "PURCHASE",
    schedule: null,
    daily_budget_cents: 2500,
    rationale: "x",
  };
}

function fullAd() {
  return {
    name: "Ad 1",
    ad_set_ref: null,
    product_name: "Prod",
    offer_note: null,
    primary_text: "Compre",
    headline: "Título",
    description: null,
    cta: "SHOP_NOW",
    destination_url: "https://x",
    creative_prompt: null,
    creative_format: "SINGLE_IMAGE",
    alternative_formats: [],
    reference_image_url: null,
    creative_final_url: null,
    creative_status: "pending_strategy_approval" as const,
    rationale: null,
  };
}

const META_CAPS: PlatformCapabilitiesRow = {
  platform: "meta",
  status: "verificado",
  capabilities_version: "meta-2026-06-10-baseline",
  adapter_version: "v0.1",
  last_verified_at: new Date().toISOString(),
  capabilities_json: {
    supported_objectives: ["OUTCOME_SALES", "OUTCOME_LEADS"],
    supported_conversion_events: ["PURCHASE", "LEAD", "ADD_TO_CART"],
    supported_placements: ["advantage_plus"],
    supported_ctas: ["SHOP_NOW", "BUY_NOW"],
    supported_creative_formats: ["SINGLE_IMAGE", "SINGLE_VIDEO"],
  },
};

describe("Structure Completeness Gate", () => {
  it("passa quando proposta tem Campanha + 1 Conjunto + 1 Anúncio completos", () => {
    const s = emptyStructured();
    s.ad_sets = [fullAdSet()];
    s.ads = [fullAd()];
    const r = runStructureCompletenessGate(s);
    expect(r.passed).toBe(true);
    expect(r.blockers).toHaveLength(0);
  });

  it("bloqueia quando Conjunto vem vazio (sem região/idade/gênero/posicionamento/otimização/evento)", () => {
    const s = emptyStructured();
    s.ad_sets = [{ ...fullAdSet(), location: null, age_range: null, gender: null, placements: [], optimization_goal: null, conversion_event: null }];
    s.ads = [fullAd()];
    const r = runStructureCompletenessGate(s);
    expect(r.passed).toBe(false);
    const fields = r.blockers.map((b) => b.field);
    expect(fields).toEqual(expect.arrayContaining([
      "adset.0.location",
      "adset.0.age_range",
      "adset.0.gender",
      "adset.0.placements",
      "adset.0.optimization_goal",
      "adset.0.conversion_event",
    ]));
  });

  it("trata requires_user_input no evento de conversão como blocker amigável", () => {
    const s = emptyStructured();
    s.ad_sets = [{ ...fullAdSet(), conversion_event: "requires_user_input" }];
    s.ads = [fullAd()];
    const r = runStructureCompletenessGate(s);
    expect(r.passed).toBe(false);
    const b = r.blockers.find((x) => x.field === "adset.0.conversion_event");
    expect(b?.kind).toBe("requires_user_input");
  });

  it("bloqueia quando não há nenhum conjunto/anúncio", () => {
    const s = emptyStructured();
    const r = runStructureCompletenessGate(s);
    expect(r.blockers.some((b) => b.field === "ad_sets")).toBe(true);
    expect(r.blockers.some((b) => b.field === "ads")).toBe(true);
  });

  it("não roda em ações operacionais (is_structured_campaign=false)", () => {
    const s = { ...emptyStructured(), is_structured_campaign: false };
    expect(runStructureCompletenessGate(s).passed).toBe(true);
  });
});

describe("Platform Compatibility Gate inicial", () => {
  it("bloqueia se capacidades da plataforma não existem no registro", () => {
    const s = emptyStructured();
    s.ad_sets = [fullAdSet()];
    s.ads = [fullAd()];
    const r = runPlatformCompatibilityGate(s, null);
    expect(r.passed).toBe(false);
    expect(r.blockers[0].field).toBe("platform.status");
  });

  it("bloqueia plataforma não verificada (Google/TikTok seed inicial)", () => {
    const s = emptyStructured();
    s.ad_sets = [fullAdSet()];
    s.ads = [fullAd()];
    const r = runPlatformCompatibilityGate(s, { ...META_CAPS, status: "nao_verificado" });
    expect(r.passed).toBe(false);
  });

  it("bloqueia última verificação acima de 60 dias", () => {
    const old = new Date(Date.now() - 90 * 86400000).toISOString();
    const s = emptyStructured();
    s.ad_sets = [fullAdSet()];
    s.ads = [fullAd()];
    const r = runPlatformCompatibilityGate(s, { ...META_CAPS, last_verified_at: old });
    expect(r.passed).toBe(false);
  });

  it("passa com capacidades válidas e plano compatível", () => {
    const s = emptyStructured();
    s.ad_sets = [fullAdSet()];
    s.ads = [fullAd()];
    const r = runPlatformCompatibilityGate(s, META_CAPS);
    expect(r.passed).toBe(true);
  });

  it("bloqueia objetivo fora da lista suportada", () => {
    const s = emptyStructured();
    s.campaign.objective = "OUTCOME_AWARENESS"; // fora do suportado nesta lista de teste
    s.ad_sets = [fullAdSet()];
    s.ads = [fullAd()];
    const r = runPlatformCompatibilityGate(s, META_CAPS);
    expect(r.passed).toBe(false);
  });
});
