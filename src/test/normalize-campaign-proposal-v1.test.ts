import { describe, it, expect } from "vitest";
import { normalizeCampaignStructure } from "../lib/ads/normalizeCampaignStructure";

// Payload representativo do que a Onda H.2 grava em ads_autopilot_actions.action_data
const proposalData = {
  schema_version: "campaign_proposal_v1",
  kind: "campaign_adjustment_proposal",
  campaign: {
    name: null,
    objective: "sales",
    product: "Kit Banho Calvície Zero",
    funnel_stage: "test",
    rationale: "Testar novos criativos.",
    initial_status_planned: "PAUSED",
    daily_budget_cents: null,
  },
  adsets: [
    {
      name: "Conjunto 1",
      placements: ["advantage_plus"],
      optimization_event: "PURCHASE",
      targeting: {
        excluded_custom_audiences: [
          { id: "120244679266150057", name: "Clientes - Atualizado 14/06/2026" },
        ],
      },
      audience_exclusions: { customers: true, reason: "Excluir clientes existentes." },
    },
  ],
  planned_creatives: [],
  raw_planned_action: {
    daily_budget_brl: 25,
    objective: "sales",
    funnel_stage: "test",
    adsets: [
      {
        adset_name: "[AI] TEST - Kit Banho - Criativo X",
        gender: "Masculino",
        age_min: 30,
        age_max: 65,
        location: "BR",
        budget_brl: 8.33,
        audience_type: "broad",
        optimization_goal: "OFFSITE_CONVERSIONS",
        conversion_event: "PURCHASE",
        placements: ["advantage_plus"],
        audience_description: "Homens 30-65, Brasil, sem segmentação.",
      },
    ],
  },
};

describe("normalizeCampaignStructure — dialeto campaign_proposal_v1", () => {
  it("converte campanha, derivando orçamento de BRL e herdando do raw quando necessário", () => {
    const s = normalizeCampaignStructure(proposalData as any);
    expect(s.is_structured_campaign).toBe(true);
    expect(s.source).toBe("canonical");
    expect(s.campaign.objective).toBe("sales");
    expect(s.campaign.daily_budget_cents).toBe(2500); // 25 BRL
    expect(s.campaign.planned_status).toBe("PAUSED");
    expect(s.campaign.rationale).toContain("Testar");
  });

  it("converte conjuntos cruzando dialeto H.2 + raw_planned_action", () => {
    const s = normalizeCampaignStructure(proposalData as any);
    expect(s.ad_sets).toHaveLength(1);
    const a = s.ad_sets[0];
    expect(a.name).toBe("Conjunto 1");
    expect(a.gender).toBe("Masculino");
    expect(a.age_range).toBe("30-65");
    expect(a.location).toBe("BR");
    expect(a.audience_type).toBe("broad");
    expect(a.targeting_summary).toContain("Homens");
    expect(a.placements).toEqual(["advantage_plus"]);
    expect(a.optimization_goal).toBe("OFFSITE_CONVERSIONS");
    expect(a.conversion_event).toBe("PURCHASE");
    expect(a.daily_budget_cents).toBe(833); // 8.33 BRL
    expect(a.customer_exclusion_applied).toBe(true);
    expect(a.customer_exclusion_label).toBe("Exclui clientes/compradores");
    expect(a.exclusions.length).toBeGreaterThan(0);
  });

  it("não inventa anúncios quando planned_creatives está vazio", () => {
    const s = normalizeCampaignStructure(proposalData as any);
    expect(s.ads).toEqual([]);
  });

  it("renderiza anúncios planejados quando presentes", () => {
    const withCreative = {
      ...proposalData,
      planned_creatives: [
        {
          format: "image",
          angle: "preço",
          copy: "Compre já",
          headline: "Frete grátis",
          cta: "SHOP_NOW",
          final_url_with_utm: "https://x?utm_source=meta",
          visual_prompt: "produto sobre fundo claro",
        },
      ],
    };
    const s = normalizeCampaignStructure(withCreative as any);
    expect(s.ads).toHaveLength(1);
    expect(s.ads[0].headline).toBe("Frete grátis");
    expect(s.ads[0].primary_text).toBe("Compre já");
    expect(s.ads[0].cta).toBe("SHOP_NOW");
    expect(s.ads[0].destination_url).toContain("utm_source=meta");
    expect(s.ads[0].creative_prompt).toBe("produto sobre fundo claro");
    expect(s.ads[0].creative_status).toBe("pending_strategy_approval");
  });
});
