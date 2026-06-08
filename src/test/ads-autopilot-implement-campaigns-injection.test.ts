// =====================================================================
// Teste de contrato — fluxo implement_campaigns: simula a rota real do
// Strategist (resolver → inventário tenant-scoped → injeção de
// creative_asset_id/creative_url nos args → Quality Gate).
//
// Reproduz o caso do tenant Respeite o Homem (d1a4d0ed-...) onde 15/15
// propostas eram bloqueadas por `invalid_missing_creative` mesmo havendo
// 20 criativos ready. Garante que, com o resolver determinístico, a
// proposta passa pelo gate quando há criativo ready do mesmo product_id
// e continua bloqueada quando não há.
//
// Não chama Meta, não chama LLM, não consulta banco real.
// =====================================================================

import { describe, expect, it } from "vitest";
import {
  resolveProduct,
  selectReadyCreative,
} from "../../supabase/functions/_shared/ads-autopilot/creativeResolver.ts";
import { runCreateCampaignQualityGate } from "../../supabase/functions/_shared/ads-autopilot/qualityGate.ts";

const TENANT_ID = "d1a4d0ed-8842-495e-b741-540a9a345b25";

const CATALOG = [
  { id: "p-shampoo", name: "Shampoo Calvície Zero", price: 93.01 },
  { id: "p-kit", name: "Kit Banho Calvície Zero", price: 189.47 },
  { id: "p-kit-2x", name: "Kit Banho Calvície Zero (2x)", price: 349.0 },
  { id: "p-balm", name: "Balm Pós-Banho Calvície Zero (Dia)", price: 79.0 },
  { id: "p-fast", name: "Fast Upgrade", price: 49.0 },
];

// Espelho do inventário real do tenant (apenas ids fictícios)
const INVENTORY = [
  { id: "c-shampoo-1", tenant_id: TENANT_ID, product_id: "p-shampoo", status: "ready", asset_url: "https://x/shampoo.png" },
  { id: "c-kit-1",     tenant_id: TENANT_ID, product_id: "p-kit",     status: "ready", asset_url: "https://x/kit.png" },
  { id: "c-kit2x-1",   tenant_id: TENANT_ID, product_id: "p-kit-2x",  status: "ready", asset_url: "https://x/kit2x.png" },
  { id: "c-fast-1",    tenant_id: TENANT_ID, product_id: "p-fast",    status: "ready", asset_url: "https://x/fast.png" },
  { id: "c-balm-1",    tenant_id: TENANT_ID, product_id: "p-balm",    status: "ready", asset_url: "https://x/balm.png" },
];

/**
 * Simula EXATAMENTE a rota do Strategist em handleToolCall →
 * `create_campaign` no trigger `implement_campaigns`:
 *   1. Resolve produto (id → nome exato → normalizado).
 *   2. Consulta tenant_scoped por product_id resolvido + status=ready.
 *   3. Injeta creative_asset_id/creative_url nos args.
 *   4. Roda Quality Gate.
 * Mantém paridade com supabase/functions/ads-autopilot-strategist/index.ts
 * (linhas ~2351-2467).
 */
function runImplementCampaignsTool(args: any, opts?: { inventory?: typeof INVENTORY }) {
  const inventory = opts?.inventory ?? INVENTORY;
  const resolved = resolveProduct({
    args: { product_id: args.product_id, product_name: args.product_name },
    catalog: CATALOG,
  });
  const matchedProduct = resolved ? CATALOG.find((p) => p.id === resolved.id) || null : null;
  const lookupProductId = matchedProduct?.id || args.product_id || null;

  let tenantCreatives: any[] = [];
  if (lookupProductId) {
    // Espelha o filtro do Strategist: tenant_id + product_id + status=ready + asset_url not null
    tenantCreatives = inventory.filter(
      (c) =>
        c.tenant_id === TENANT_ID &&
        c.product_id === lookupProductId &&
        c.status === "ready" &&
        typeof c.asset_url === "string" &&
        c.asset_url.length > 0,
    );
    const selection = selectReadyCreative({
      product: matchedProduct
        ? { id: matchedProduct.id, name: matchedProduct.name, price: matchedProduct.price }
        : args.product_id
          ? { id: String(args.product_id), name: String(args.product_name || "") }
          : null,
      tenantCreatives,
    });
    if (!args.creative_asset_id && !args.creative_url && selection.asset) {
      args.creative_asset_id = selection.asset.id;
      args.creative_url = selection.asset.asset_url;
    }
  }

  const gate = runCreateCampaignQualityGate({
    args: {
      ...args,
      headline: args.headlines?.[0] || args.headline || null,
      primary_text: args.primary_texts?.[0] || args.primary_text || null,
    },
    matchedProduct: matchedProduct
      ? { id: matchedProduct.id, name: matchedProduct.name, price: matchedProduct.price }
      : null,
    catalog: CATALOG,
    tenantCreatives: tenantCreatives.map((c) => ({ id: c.id, product_id: c.product_id, tenant_id: c.tenant_id })),
  });

  return { args, gate, matchedProduct, tenantCreatives };
}

const baseArgs = (overrides: Record<string, unknown> = {}) => ({
  campaign_name: "Shampoo Calvície Zero — Conversão TOF",
  product_id: "p-shampoo",
  product_name: "Shampoo Calvície Zero",
  headlines: ["Shampoo Calvície Zero — fim da queda"],
  primary_texts: ["Reduza a queda de cabelo com Shampoo Calvície Zero. Resultado em 30 dias."],
  destination_url: "https://loja.com/p/shampoo-calvicie-zero",
  funnel_stage: "tof",
  objective: "OUTCOME_SALES",
  daily_budget_cents: 5000,
  ad_format: "single_image",
  ...overrides,
});

describe("implement_campaigns — auto-resolução de criativo + Quality Gate", () => {
  it("injeta creative_asset_id quando há criativo ready do mesmo product_id (Shampoo)", () => {
    const r = runImplementCampaignsTool(baseArgs());
    expect(r.args.creative_asset_id).toBe("c-shampoo-1");
    expect(r.args.creative_url).toBe("https://x/shampoo.png");
    expect(r.gate.ok).toBe(true);
  });

  it("injeta criativo correto para Kit Banho (não pega criativo de Shampoo isolado)", () => {
    const r = runImplementCampaignsTool(
      baseArgs({
        product_id: "p-kit",
        product_name: "Kit Banho Calvície Zero",
        campaign_name: "Kit Banho Calvície Zero — TOF",
        headlines: ["Kit Banho Calvície Zero completo"],
        primary_texts: ["Kit Banho Calvície Zero para o cuidado diário do seu cabelo."],
        destination_url: "https://loja.com/p/kit-banho-calvicie-zero",
      }),
    );
    expect(r.args.creative_asset_id).toBe("c-kit-1");
    expect(r.gate.ok).toBe(true);
  });

  it("injeta criativo correto para Fast Upgrade (produto real do catálogo)", () => {
    const r = runImplementCampaignsTool(
      baseArgs({
        product_id: "p-fast",
        product_name: "Fast Upgrade",
        campaign_name: "Fast Upgrade — Upsell",
        headlines: ["Fast Upgrade — turbine seu resultado"],
        primary_texts: ["Fast Upgrade: acelere os resultados do seu tratamento."],
        destination_url: "https://loja.com/p/fast-upgrade",
      }),
    );
    expect(r.args.creative_asset_id).toBe("c-fast-1");
    expect(r.gate.ok).toBe(true);
  });

  it("Fast Upgrade NÃO é tratado como produto fantasma quando existe no catálogo", () => {
    const r = runImplementCampaignsTool(
      baseArgs({ product_id: "p-fast", product_name: "Fast Upgrade" }),
    );
    expect(r.matchedProduct?.id).toBe("p-fast");
    expect(r.gate.reason_codes).not.toContain("invalid_unknown_product_name");
    expect(r.gate.reason_codes).not.toContain("invalid_product_catalog_mismatch");
  });

  it("resolve mesmo com nome divergente (acento/caixa) quando product_id está correto", () => {
    const r = runImplementCampaignsTool(
      baseArgs({ product_id: "p-shampoo", product_name: "shampoo  calvicie  ZERO" }),
    );
    expect(r.matchedProduct?.id).toBe("p-shampoo");
    expect(r.args.creative_asset_id).toBe("c-shampoo-1");
    expect(r.gate.ok).toBe(true);
  });

  it("bloqueia com invalid_missing_creative quando inventário não tem criativo ready do produto", () => {
    const inventorySemShampoo = INVENTORY.filter((c) => c.product_id !== "p-shampoo");
    const r = runImplementCampaignsTool(baseArgs(), { inventory: inventorySemShampoo });
    expect(r.args.creative_asset_id).toBeUndefined();
    expect(r.gate.ok).toBe(false);
    expect(r.gate.reason_codes).toContain("invalid_missing_creative");
  });

  it("bloqueia quando o modelo tenta vincular creative_asset_id que não está no inventário do produto", () => {
    // Strategist filtra inventário por lookupProductId (p-shampoo), então
    // um creative_asset_id de Kit cai fora da lista tenant-scoped do gate.
    const r = runImplementCampaignsTool(
      baseArgs({
        product_id: "p-shampoo",
        creative_asset_id: "c-kit-1", // criativo de Kit em proposta de Shampoo
        creative_url: "https://x/kit.png",
      }),
    );
    expect(r.gate.ok).toBe(false);
    expect(r.gate.reason_codes).toEqual(
      expect.arrayContaining(["invalid_creative_not_in_tenant"]),
    );
  });

  it("Kit não recebe criativo de Shampoo isolado (proteção Kit vs isolado)", () => {
    const inventorySoShampoo = INVENTORY.filter((c) => c.product_id === "p-shampoo");
    const r = runImplementCampaignsTool(
      baseArgs({
        product_id: "p-kit",
        product_name: "Kit Banho Calvície Zero",
        campaign_name: "Kit Banho — TOF",
        headlines: ["Kit Banho Calvície Zero completo"],
        primary_texts: ["Kit Banho Calvície Zero: shampoo + balm."],
        destination_url: "https://loja.com/p/kit-banho-calvicie-zero",
      }),
      { inventory: inventorySoShampoo },
    );
    expect(r.args.creative_asset_id).toBeUndefined();
    expect(r.gate.ok).toBe(false);
    expect(r.gate.reason_codes).toContain("invalid_missing_creative");
  });

  it("oferta divergente continua bloqueada mesmo com criativo correto injetado", () => {
    const r = runImplementCampaignsTool(
      baseArgs({
        campaign_name: "Promo Kit 50% OFF",
        headlines: ["Kit Banho 50% OFF — só hoje"],
        primary_texts: ["Aproveite 50% OFF no Kit Banho Calvície Zero."],
      }),
    );
    // Produto é Shampoo (isolado), copy/headline citam Kit → oferta divergente
    expect(r.gate.ok).toBe(false);
    expect(r.gate.reason_codes).toEqual(
      expect.arrayContaining(["invalid_offer_mismatch"]),
    );
  });
});
