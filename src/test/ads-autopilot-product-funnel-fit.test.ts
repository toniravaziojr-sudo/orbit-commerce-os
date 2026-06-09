// =============================================
// Frente 4 — Classificador comercial e Product/Funnel Fit Gate
// =============================================
import { describe, it, expect } from "vitest";
import {
  classifyProduct,
  type ClassificationInput,
} from "../../supabase/functions/_shared/ads-autopilot/productCommercialClassifier";
import {
  evaluateProductFunnelFit,
  normalizeFunnelStage,
} from "../../supabase/functions/_shared/ads-autopilot/productFunnelFitGate";

const base = (over: Partial<ClassificationInput["product"]> = {}): ClassificationInput["product"] => ({
  id: "p1",
  name: "Shampoo Calvície Zero",
  price: 93,
  product_format: "simple",
  tags: [],
  category_names: [],
  ...over,
});

describe("Frente 4 — Classificador comercial", () => {
  it("produto simples sem composição → produto_base", () => {
    const r = classifyProduct({ product: base() });
    expect(["produto_base", "produto_principal_simples"]).toContain(r.commercial_class);
  });

  it("produto simples com preço próximo do floor → produto_principal_simples", () => {
    const r = classifyProduct({ product: base({ price: 93 }), basePriceFloor: 80 });
    expect(r.commercial_class).toBe("produto_principal_simples");
  });

  it("composição com 2 bases diferentes, 1 unidade cada → kit_unitario_apresentacao", () => {
    const r = classifyProduct({
      product: base({ id: "kit-dia", name: "Kit Banho Dia", product_format: "with_composition" }),
      components: [
        { component_product_id: "shampoo", quantity: 1 },
        { component_product_id: "balm", quantity: 1 },
      ],
    });
    expect(r.commercial_class).toBe("kit_unitario_apresentacao");
    expect(r.confidence).toBe("high");
  });

  it("composição com quantidade > 1 de qualquer base → kit_quantidade", () => {
    const r = classifyProduct({
      product: base({ id: "kit3x", name: "Kit Banho (3x)", product_format: "with_composition" }),
      components: [
        { component_product_id: "shampoo", quantity: 3 },
        { component_product_id: "balm", quantity: 3 },
        { component_product_id: "locao", quantity: 3 },
      ],
    });
    expect(r.commercial_class).toBe("kit_quantidade");
  });

  it("multipack do mesmo SKU (Shampoo (2x)) sem composição → kit_quantidade", () => {
    const r = classifyProduct({ product: base({ name: "Shampoo Preventive Power (2x)", price: 133 }) });
    expect(r.commercial_class).toBe("kit_quantidade");
  });

  it("tag de recompra vence composição → recompra_retencao", () => {
    const r = classifyProduct({ product: base({ tags: ["recompra"] }) });
    expect(r.commercial_class).toBe("recompra_retencao");
  });

  it("kit sem rows de composição → desconhecido (baixa confiança)", () => {
    const r = classifyProduct({ product: base({ product_format: "with_composition", name: "Kit Misterioso" }) });
    expect(r.commercial_class).toBe("desconhecido");
    expect(r.confidence).toBe("low");
  });
});

describe("Frente 4 — Product/Funnel Fit Gate", () => {
  const cold = "cold" as const;
  const warm = "warm" as const;
  const hot = "hot" as const;
  const ret = "retention" as const;

  it("Frio + produto_base → high, não bloqueia", () => {
    const r = evaluateProductFunnelFit({ commercial_class: "produto_base", classification_confidence: "medium", funnel_stage: cold });
    expect(r.fit_level).toBe("high");
    expect(r.soft_block).toBe(false);
  });

  it("Frio + kit_unitario_apresentacao → high", () => {
    const r = evaluateProductFunnelFit({ commercial_class: "kit_unitario_apresentacao", classification_confidence: "high", funnel_stage: cold });
    expect(r.fit_level).toBe("high");
  });

  it("Frio + kit_quantidade → blocked + soft_block", () => {
    const r = evaluateProductFunnelFit({ commercial_class: "kit_quantidade", classification_confidence: "high", funnel_stage: cold });
    expect(r.fit_level).toBe("blocked");
    expect(r.soft_block).toBe(true);
    expect(r.reason_codes).toContain("cold_audience_bundle_not_recommended");
  });

  it("Frio + recompra → blocked", () => {
    const r = evaluateProductFunnelFit({ commercial_class: "recompra_retencao", classification_confidence: "medium", funnel_stage: cold });
    expect(r.fit_level).toBe("blocked");
    expect(r.reason_codes).toContain("cold_audience_retention_offer_mismatch");
  });

  it("Frio + desconhecido (baixa confiança) → composição incerta + soft_block", () => {
    const r = evaluateProductFunnelFit({ commercial_class: "desconhecido", classification_confidence: "low", funnel_stage: cold });
    expect(r.fit_level).toBe("unknown_composition");
    expect(r.soft_block).toBe(true);
  });

  it("Remarketing + kit_quantidade → high, não bloqueia", () => {
    const r = evaluateProductFunnelFit({ commercial_class: "kit_quantidade", classification_confidence: "high", funnel_stage: warm });
    expect(r.fit_level).toBe("high");
    expect(r.soft_block).toBe(false);
  });

  it("Quente + kit_quantidade → high", () => {
    const r = evaluateProductFunnelFit({ commercial_class: "kit_quantidade", classification_confidence: "high", funnel_stage: hot });
    expect(r.fit_level).toBe("high");
  });

  it("Retenção + recompra → high", () => {
    const r = evaluateProductFunnelFit({ commercial_class: "recompra_retencao", classification_confidence: "medium", funnel_stage: ret });
    expect(r.fit_level).toBe("high");
  });

  it("normalizeFunnelStage aceita tof/bof/mof", () => {
    expect(normalizeFunnelStage("tof")).toBe("cold");
    expect(normalizeFunnelStage("bof")).toBe("hot");
    expect(normalizeFunnelStage("mof")).toBe("warm");
    expect(normalizeFunnelStage("retencao")).toBe("retention");
    expect(normalizeFunnelStage(null)).toBe("unknown");
  });
});
