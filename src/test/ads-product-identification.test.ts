import { describe, it, expect } from "vitest";
import {
  identifyProductFromCampaign,
  blocksDestructiveActions,
} from "../../supabase/functions/_shared/ads-autopilot/productIdentification";

const catalog = [
  { id: "p1", name: "Shampoo Calvície Zero", slug: "shampoo-calvicie-zero" },
  { id: "p2", name: "Kit Banho Calvície Zero Dia", slug: "kit-banho-calvicie-zero-dia" },
  { id: "p3", name: "Balm Pós-Barba", slug: "balm-pos-barba" },
];

describe("Onda G.2 — Identificação de Produto em campanhas existentes", () => {
  it("identifica por slug da URL com confiança alta", () => {
    const r = identifyProductFromCampaign(
      { id: "c1", destination_urls: ["https://loja.com/p/shampoo-calvicie-zero?utm_source=meta"] },
      catalog,
    );
    expect(r.inferred_product_id).toBe("p1");
    expect(r.product_identification_confidence).toBe("high");
    expect(r.inferred_product_source).toBe("url_slug");
  });

  it("identifica por nome da campanha", () => {
    const r = identifyProductFromCampaign(
      { id: "c2", name: "[AI] Vendas | Shampoo Calvície Zero | Broad" },
      catalog,
    );
    expect(r.inferred_product_id).toBe("p1");
    expect(["high", "medium"]).toContain(r.product_identification_confidence);
  });

  it("identifica por copy com confiança média", () => {
    const r = identifyProductFromCampaign(
      { id: "c3", name: "Produtos Diversos", copy_texts: ["Conheça o Kit Banho Calvície Zero Dia"] },
      catalog,
    );
    expect(r.inferred_product_id).toBe("p2");
    expect(["medium", "high"]).toContain(r.product_identification_confidence);
  });

  it("retorna unknown quando nada bate", () => {
    const r = identifyProductFromCampaign(
      { id: "c4", name: "Genérico XPTO" },
      catalog,
    );
    expect(r.product_identification_confidence).toBe("unknown");
    expect(r.diagnosis_limitation).toBeTruthy();
  });

  it("blocksDestructiveActions é true para baixa confiança", () => {
    expect(blocksDestructiveActions("unknown")).toBe(true);
    expect(blocksDestructiveActions("low")).toBe(true);
    expect(blocksDestructiveActions("medium")).toBe(false);
    expect(blocksDestructiveActions("high")).toBe(false);
  });
});
