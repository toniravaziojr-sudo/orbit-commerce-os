// =====================================================================
// Testes do Quality Gate determinístico de create_campaign.
// Cobre os casos reais que motivaram a criação do gate (sugestões
// "Fast Upgrade" e "Conversions Shampoo vinculado a Kit" do tenant
// Respeite o Homem) + casos válidos.
// =====================================================================

import { describe, expect, it } from "vitest";
import { runCreateCampaignQualityGate } from "../../supabase/functions/_shared/ads-autopilot/qualityGate.ts";

const CATALOG = [
  { id: "p-shampoo", name: "Shampoo Calvície Zero", price: 93.01 },
  { id: "p-kit", name: "Kit Banho Calvície Zero", price: 189.47 },
];

const productById = (id: string) => CATALOG.find((p) => p.id === id) || null;

describe("Quality Gate — create_campaign", () => {
  it("bloqueia produto inexistente (codinome 'Fast Upgrade')", () => {
    const r = runCreateCampaignQualityGate({
      args: {
        campaign_name: "[AI] Creative Test - Fast Upgrade",
        product_name: "Fast Upgrade",
        headline: "Experimente o Fast Upgrade!",
        primary_text: "Transforme seu visual com o Fast Upgrade.",
        creative_asset_id: "abc",
        creative_url: "https://x/y.png",
        destination_url: "https://loja/p",
        funnel_stage: "test",
        objective: "conversions",
        daily_budget_cents: 12500,
      },
      matchedProduct: null,
      catalog: CATALOG,
    });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("invalid_unknown_product_name");
  });

  it("bloqueia divergência produto vinculado vs copy (caso 'Fast Upgrade' atrelado a Shampoo real)", () => {
    const r = runCreateCampaignQualityGate({
      args: {
        campaign_name: "[AI] Creative Test - Fast Upgrade",
        product_name: "Shampoo Calvície Zero",
        headline: "Experimente o Fast Upgrade!",
        primary_text: "Aumente sua confiança com o novo Fast Upgrade.",
        creative_asset_id: "abc",
        creative_url: "https://x/y.png",
        destination_url: "https://loja/p",
        funnel_stage: "test",
        objective: "conversions",
        daily_budget_cents: 12500,
      },
      matchedProduct: productById("p-shampoo"),
      catalog: CATALOG,
    });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("invalid_product_copy_mismatch");
    expect(r.reason_codes).toContain("invalid_creative_product_mismatch");
  });

  it("bloqueia Kit vinculado quando copy fala só do Shampoo isolado", () => {
    const r = runCreateCampaignQualityGate({
      args: {
        campaign_name: "[AI] Conversions - Shampoo Calvície Zero",
        product_name: "Kit Banho Calvície Zero",
        headline: "Acabe com a Calvície",
        primary_text: "Experimente o Shampoo Calvície Zero e devolva a força dos seus fios.",
        funnel_stage: "tof",
        objective: "conversions",
        daily_budget_cents: 30000,
      },
      matchedProduct: productById("p-kit"),
      catalog: CATALOG,
    });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("invalid_product_copy_mismatch");
    expect(r.reason_codes).toContain("invalid_offer_mismatch");
    expect(r.reason_codes).toContain("invalid_missing_creative");
    expect(r.reason_codes).toContain("invalid_missing_destination");
    expect(r.reason_codes).toContain("invalid_cold_campaign_budget_too_aggressive");
  });

  it("bloqueia create_campaign sem criativo", () => {
    const r = runCreateCampaignQualityGate({
      args: {
        campaign_name: "[AI] Sem Criativo",
        product_name: "Shampoo Calvície Zero",
        headline: "Shampoo Calvície Zero",
        primary_text: "Compre Shampoo Calvície Zero hoje.",
        destination_url: "https://loja/p",
        funnel_stage: "mof",
        objective: "conversions",
        daily_budget_cents: 5000,
      },
      matchedProduct: productById("p-shampoo"),
      catalog: CATALOG,
    });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("invalid_missing_creative");
  });

  it("bloqueia create_campaign sem destino quando objetivo exige", () => {
    const r = runCreateCampaignQualityGate({
      args: {
        campaign_name: "[AI] Sem Destino",
        product_name: "Shampoo Calvície Zero",
        headline: "Shampoo Calvície Zero",
        primary_text: "Compre Shampoo Calvície Zero.",
        creative_asset_id: "a",
        creative_url: "https://x/y.png",
        funnel_stage: "mof",
        objective: "conversions",
        daily_budget_cents: 5000,
      },
      matchedProduct: productById("p-shampoo"),
      catalog: CATALOG,
    });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("invalid_missing_destination");
  });

  it("bloqueia campanha fria agressiva sem base", () => {
    const r = runCreateCampaignQualityGate({
      args: {
        campaign_name: "[AI] TOF Frio Pesado",
        product_name: "Shampoo Calvície Zero",
        headline: "Shampoo Calvície Zero",
        primary_text: "Compre Shampoo Calvície Zero.",
        funnel_stage: "tof",
        objective: "conversions",
        daily_budget_cents: 50000,
      },
      matchedProduct: productById("p-shampoo"),
      catalog: CATALOG,
    });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("invalid_cold_campaign_budget_too_aggressive");
  });

  it("permite sugestão coerente e completa", () => {
    const r = runCreateCampaignQualityGate({
      args: {
        campaign_name: "[AI] Conversions - Shampoo Calvície Zero",
        product_name: "Shampoo Calvície Zero",
        headline: "Shampoo Calvície Zero — pare a queda",
        primary_text: "Experimente o Shampoo Calvície Zero hoje.",
        creative_asset_id: "abc",
        creative_url: "https://x/y.png",
        destination_url: "https://loja/p/shampoo",
        funnel_stage: "tof",
        objective: "conversions",
        daily_budget_cents: 10000,
      },
      matchedProduct: productById("p-shampoo"),
      catalog: CATALOG,
    });
    expect(r.ok).toBe(true);
    expect(r.reason_codes).toEqual([]);
  });
});
