import { describe, it, expect } from "vitest";
import { runCreateCampaignQualityGate } from "../../supabase/functions/_shared/ads-autopilot/qualityGate";

const product = { id: "p1", name: "Shampoo Calvície Zero", price: 89 };
const catalog = [product];

const baseArgs: any = {
  campaign_name: "[AI] Vendas | Shampoo Calvície Zero",
  product_id: "p1",
  product_name: "Shampoo Calvície Zero",
  headline: "Shampoo Calvície Zero",
  primary_text: "Conheça o Shampoo Calvície Zero",
  destination_url: "https://loja.com/p/shampoo-calvicie-zero",
  funnel_stage: "tof",
  objective: "sales",
  daily_budget_cents: 5000,
  creative_url: "https://cdn.example/a.jpg",
  cta: "SHOP_NOW",
};

describe("Onda G.5 — Quality Gate override para creative_test", () => {
  it("bloqueia público frio sem exclusão quando intenção NÃO é creative_test", () => {
    const r = runCreateCampaignQualityGate({
      args: baseArgs,
      matchedProduct: product,
      catalog,
      customerAudience: { found: true, meta_audience_id: "aud_1", audience_name: "Clientes" },
      campaign_intent: "acquisition",
    });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("cold_audience_requires_customer_exclusion");
  });

  it("libera quando creative_test + justificativa válida", () => {
    const r = runCreateCampaignQualityGate({
      args: {
        ...baseArgs,
        exclusion_override_reason: "Validar ângulo criativo em público com sinal de compra",
      },
      matchedProduct: product,
      catalog,
      customerAudience: { found: true, meta_audience_id: "aud_1", audience_name: "Clientes" },
      campaign_intent: "creative_test",
    });
    expect(r.ok).toBe(true);
    expect(r.details.customer_audience_status).toBe("exclusion_overridden_creative_test");
  });

  it("não libera creative_test sem justificativa", () => {
    const r = runCreateCampaignQualityGate({
      args: { ...baseArgs, exclusion_override_reason: "x" },
      matchedProduct: product,
      catalog,
      customerAudience: { found: true, meta_audience_id: "aud_1", audience_name: "Clientes" },
      campaign_intent: "creative_test",
    });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("cold_audience_requires_customer_exclusion");
  });
});
