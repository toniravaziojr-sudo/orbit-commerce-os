// =====================================================================
// Testes do creativeResolver — auto-resolução determinística usada no
// fluxo implement_campaigns do Strategist ANTES do Quality Gate.
//
// Cobre o caso real do tenant Respeite o Homem onde 15/15 propostas
// foram bloqueadas por `invalid_missing_creative` mesmo havendo 20
// criativos ready, porque o match estrito por nome falhava (mantendo
// matchedProduct=null) e a auto-resolução era pulada.
// =====================================================================

import { describe, expect, it } from "vitest";
import {
  resolveProduct,
  selectReadyCreative,
  describeResolverDecision,
} from "../../supabase/functions/_shared/ads-autopilot/creativeResolver.ts";

const CATALOG = [
  { id: "p-shampoo", name: "Shampoo Calvície Zero", price: 93.01 },
  { id: "p-kit", name: "Kit Banho Calvície Zero", price: 189.47 },
  { id: "p-kit-2x", name: "Kit Banho Calvície Zero (2x)", price: 349.0 },
  { id: "p-balm", name: "Balm Pós-Banho Calvície Zero (Dia)", price: 79.0 },
  { id: "p-fast", name: "Fast Upgrade", price: 49.0 },
];

const CREATIVES = [
  { id: "c-shampoo-1", product_id: "p-shampoo", status: "ready", asset_url: "https://x/shampoo1.png" },
  { id: "c-shampoo-2", product_id: "p-shampoo", status: "ready", asset_url: "https://x/shampoo2.png" },
  { id: "c-kit-1", product_id: "p-kit", status: "ready", asset_url: "https://x/kit1.png" },
  { id: "c-kit2x-1", product_id: "p-kit-2x", status: "ready", asset_url: "https://x/kit2x1.png" },
  { id: "c-balm-1", product_id: "p-balm", status: "ready", asset_url: "https://x/balm1.png" },
  { id: "c-fast-1", product_id: "p-fast", status: "ready", asset_url: "https://x/fast1.png" },
  { id: "c-pending", product_id: "p-shampoo", status: "pending", asset_url: "https://x/p.png" },
  { id: "c-noUrl", product_id: "p-kit", status: "ready", asset_url: null },
];

describe("creativeResolver.resolveProduct", () => {
  it("resolve por product_id mesmo com product_name divergente", () => {
    const p = resolveProduct({
      args: { product_id: "p-shampoo", product_name: "Shampoo  Calvicie  Zero" },
      catalog: CATALOG,
    });
    expect(p?.id).toBe("p-shampoo");
  });

  it("resolve por nome exato quando id ausente", () => {
    const p = resolveProduct({
      args: { product_id: null, product_name: "Kit Banho Calvície Zero" },
      catalog: CATALOG,
    });
    expect(p?.id).toBe("p-kit");
  });

  it("resolve por nome normalizado (acento/espaço/caixa)", () => {
    const p = resolveProduct({
      args: { product_id: null, product_name: "kit banho calvicie zero" },
      catalog: CATALOG,
    });
    expect(p?.id).toBe("p-kit");
  });

  it("aceita Fast Upgrade como produto real do catálogo", () => {
    const p = resolveProduct({
      args: { product_id: null, product_name: "Fast Upgrade" },
      catalog: CATALOG,
    });
    expect(p?.id).toBe("p-fast");
  });

  it("retorna null para produto fora do catálogo", () => {
    const p = resolveProduct({
      args: { product_id: null, product_name: "Codinome Inventado" },
      catalog: CATALOG,
    });
    expect(p).toBeNull();
  });

  it("não confunde Kit com produto isolado por substring", () => {
    // "Banho" sozinho não deve resolver para Kit Banho.
    const p = resolveProduct({
      args: { product_id: null, product_name: "Banho" },
      catalog: CATALOG,
    });
    expect(p).toBeNull();
  });
});

describe("creativeResolver.selectReadyCreative", () => {
  it("Shampoo recebe criativo de Shampoo, não de Kit", () => {
    const r = selectReadyCreative({
      product: { id: "p-shampoo", name: "Shampoo Calvície Zero" },
      tenantCreatives: CREATIVES,
    });
    expect(r.asset?.product_id).toBe("p-shampoo");
    expect(r.candidates.every((c) => c.product_id === "p-shampoo")).toBe(true);
  });

  it("Kit recebe criativo de Kit, não de Shampoo", () => {
    const r = selectReadyCreative({
      product: { id: "p-kit", name: "Kit Banho Calvície Zero" },
      tenantCreatives: CREATIVES,
    });
    expect(r.asset?.product_id).toBe("p-kit");
    expect(r.asset?.id).toBe("c-kit-1");
  });

  it("Kit 2x não pega criativo de Kit simples (product_id distinto)", () => {
    const r = selectReadyCreative({
      product: { id: "p-kit-2x", name: "Kit Banho Calvície Zero (2x)" },
      tenantCreatives: CREATIVES,
    });
    expect(r.asset?.product_id).toBe("p-kit-2x");
  });

  it("Fast Upgrade recebe criativo de Fast Upgrade", () => {
    const r = selectReadyCreative({
      product: { id: "p-fast", name: "Fast Upgrade" },
      tenantCreatives: CREATIVES,
    });
    expect(r.asset?.id).toBe("c-fast-1");
  });

  it("descarta criativos pending e sem asset_url", () => {
    const r = selectReadyCreative({
      product: { id: "p-shampoo", name: "Shampoo Calvície Zero" },
      tenantCreatives: CREATIVES,
    });
    expect(r.candidates.find((c) => c.id === "c-pending")).toBeUndefined();
    expect(r.candidates.find((c) => c.id === "c-noUrl")).toBeUndefined();
  });

  it("produto sem criativo ready devolve skipped_reason", () => {
    const r = selectReadyCreative({
      product: { id: "p-sem-criativo", name: "Produto Sem Criativo" },
      tenantCreatives: CREATIVES,
    });
    expect(r.asset).toBeNull();
    expect(r.skipped_reason).toBe("no_ready_creative_for_product");
  });

  it("sem produto resolvido devolve skipped_reason", () => {
    const r = selectReadyCreative({
      product: null,
      tenantCreatives: CREATIVES,
    });
    expect(r.asset).toBeNull();
    expect(r.skipped_reason).toBe("no_resolved_product");
  });
});

describe("creativeResolver — dry-run integrado (resolução + seleção)", () => {
  it("dry-run: AI manda product_id correto + nome com variação → criativo é injetado", () => {
    const product = resolveProduct({
      args: { product_id: "p-shampoo", product_name: "shampoo  calvicie zero" },
      catalog: CATALOG,
    });
    const selection = selectReadyCreative({ product, tenantCreatives: CREATIVES });
    expect(product?.id).toBe("p-shampoo");
    expect(selection.asset?.id).toBe("c-shampoo-1");
    const log = describeResolverDecision({
      product,
      args: { product_id: "p-shampoo", product_name: "shampoo  calvicie zero" },
      result: selection,
    });
    expect(log.resolved_product_id).toBe("p-shampoo");
    expect(log.ready_creative_count).toBe(2);
    expect(log.selected_creative_id).toBe("c-shampoo-1");
  });

  it("dry-run: produto inexistente → resolver null, seleção bloqueada", () => {
    const product = resolveProduct({
      args: { product_id: null, product_name: "Codinome Inventado" },
      catalog: CATALOG,
    });
    const selection = selectReadyCreative({ product, tenantCreatives: CREATIVES });
    expect(product).toBeNull();
    expect(selection.asset).toBeNull();
    expect(selection.skipped_reason).toBe("no_resolved_product");
  });
});
