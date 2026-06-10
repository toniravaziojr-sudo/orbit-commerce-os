// =============================================================================
// Testes do adapter normalizeCampaignStructure (Gestor de Tráfego IA)
// =============================================================================
import { describe, it, expect } from "vitest";
import { normalizeCampaignStructure } from "@/lib/ads/normalizeCampaignStructure";

describe("normalizeCampaignStructure", () => {
  it("não muta o payload original", () => {
    const original = { campaign_name: "X", adsets: [{ name: "A" }] };
    const snapshot = JSON.parse(JSON.stringify(original));
    normalizeCampaignStructure(original, { actionType: "create_campaign" });
    expect(original).toEqual(snapshot);
  });

  it("aceita formato canônico campaign_structure", () => {
    const cs = {
      campaign_structure: {
        campaign: { name: "Camp A", objective: "Vendas", daily_budget_cents: 5000 },
        ad_sets: [
          {
            name: "Conjunto 1",
            funnel_stage: "cold",
            inclusions: ["Estética masculina"],
            exclusions: ["Clientes atuais"],
            age_range: "28-55",
            gender: "Masculino",
          },
        ],
        ads: [
          {
            name: "Anúncio 1",
            headline: "Compre agora",
            creative_status: "pending_strategy_approval",
          },
        ],
      },
    };
    const out = normalizeCampaignStructure(cs);
    expect(out.source).toBe("canonical");
    expect(out.is_structured_campaign).toBe(true);
    expect(out.campaign.name).toBe("Camp A");
    expect(out.campaign.daily_budget_cents).toBe(5000);
    expect(out.ad_sets).toHaveLength(1);
    expect(out.ad_sets[0].inclusions).toEqual(["Estética masculina"]);
    expect(out.ad_sets[0].exclusions).toEqual(["Clientes atuais"]);
    expect(out.ads[0].creative_status).toBe("pending_strategy_approval");
  });

  it("normaliza payload legacy plano (campaign_name + preview)", () => {
    const data = {
      campaign_name: "Prospecção Frio",
      campaign_type: "sales",
      daily_budget_cents: 5000,
      funnel_stage: "cold",
      product_id: "p-1",
      preview: {
        campaign_name: "Prospecção Frio",
        targeting_summary: "Homens 28-55 com interesse em estética",
        age_range: "28-55",
        headline: "Conheça o ritual",
        copy_text: "Texto da copy",
        creative_url: "https://img/ref.png",
      },
      creative_brief: { prompt: "Foto premium em estúdio", format: "1:1" },
      flow_version: "two_step_v1",
    };
    const out = normalizeCampaignStructure(data, { actionType: "create_campaign" });
    expect(out.source).toBe("legacy_adapter");
    expect(out.is_structured_campaign).toBe(true);
    expect(out.campaign.name).toBe("Prospecção Frio");
    expect(out.campaign.daily_budget_cents).toBe(5000);
    expect(out.ad_sets).toHaveLength(1);
    expect(out.ad_sets[0].targeting_summary).toBe("Homens 28-55 com interesse em estética");
    expect(out.ad_sets[0].age_range).toBe("28-55");
    expect(out.ads).toHaveLength(1);
    // Etapa 1 do two_step → criativo final NÃO renderiza, vira só referência
    expect(out.ads[0].creative_final_url).toBeNull();
    expect(out.ads[0].reference_image_url).toBe("https://img/ref.png");
    expect(out.ads[0].creative_status).toBe("pending_strategy_approval");
    expect(out.ads[0].creative_prompt).toBe("Foto premium em estúdio");
    expect(out.ads[0].creative_format).toBe("1:1");
  });

  it("normaliza payload legacy com adsets[] explícitos", () => {
    const data = {
      campaign_name: "Camp B",
      adsets: [
        {
          adset_name: "Cold BR",
          targeting: {
            age_min: 28,
            age_max: 55,
            genders: [1],
            geo_locations: { countries: ["BR"] },
            interests: [{ name: "Cuidado masculino" }],
          },
          daily_budget_cents: 3000,
          reasoning: "Foco em prospecção",
        },
      ],
      ads: [
        { name: "Ad 1", headline: "Headline ad", body: "Body ad", url: "https://x", creative_url: "https://img/final.png" },
      ],
    };
    const out = normalizeCampaignStructure(data, { actionType: "create_campaign" });
    expect(out.ad_sets[0].name).toBe("Cold BR");
    expect(out.ad_sets[0].age_range).toBe("28-55");
    expect(out.ad_sets[0].gender).toBe("Masculino");
    expect(out.ad_sets[0].location).toBe("BR");
    expect(out.ad_sets[0].inclusions).toEqual(["Cuidado masculino"]);
    expect(out.ad_sets[0].daily_budget_cents).toBe(3000);
    expect(out.ads[0].headline).toBe("Headline ad");
    expect(out.ads[0].primary_text).toBe("Body ad");
    expect(out.ads[0].destination_url).toBe("https://x");
    expect(out.ads[0].creative_final_url).toBe("https://img/final.png");
    expect(out.ads[0].creative_status).toBe("ready");
  });

  it("exibe nulls em campos ausentes sem quebrar", () => {
    const out = normalizeCampaignStructure({}, { actionType: "create_campaign" });
    expect(out.campaign.name).toBeNull();
    expect(out.ad_sets).toEqual([]);
    expect(out.ads).toEqual([]);
    expect(out.is_structured_campaign).toBe(false);
  });

  it("ação operacional legacy (pause_campaign) não é classificada como estruturada", () => {
    const out = normalizeCampaignStructure(
      { campaign_id: "abc", current_spend_cents: 100 },
      { actionType: "pause_campaign" },
    );
    expect(out.is_structured_campaign).toBe(false);
  });

  it("aceita actionType ou flowVersion como gatilho de classificação", () => {
    const out1 = normalizeCampaignStructure({}, { actionType: "create_campaign" });
    expect(out1.is_structured_campaign).toBe(true);
    const out2 = normalizeCampaignStructure({ flow_version: "two_step_v1" });
    expect(out2.is_structured_campaign).toBe(true);
  });
});
