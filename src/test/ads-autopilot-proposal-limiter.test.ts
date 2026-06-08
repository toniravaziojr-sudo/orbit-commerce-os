// =====================================================================
// Testes do proposalLimiter — cap por ciclo, cap por produto, cooldown
// 24h, dedup por template e ranking determinístico.
// =====================================================================

import { describe, expect, it } from "vitest";
import {
  scoreProposal,
  templateKey,
  applyLimits,
  DEFAULT_MAX_PROPOSALS_PER_CYCLE,
  DEFAULT_MAX_PROPOSALS_PER_PRODUCT_PER_CYCLE,
} from "../../supabase/functions/_shared/ads-autopilot/proposalLimiter.ts";

const baseArgs = {
  product_id: "p-shampoo",
  product_name: "Shampoo Calvície Zero",
  funnel_stage: "tof",
  ad_format: "single_image",
  headlines: ["a", "b", "c"],
  primary_texts: ["x", "y"],
  destination_url: "https://loja/produto/shampoo",
  creative_asset_id: "c1",
  daily_budget_cents: 5000,
  objective: "OUTCOME_SALES",
};

describe("templateKey", () => {
  it("gera chave estável", () => {
    expect(templateKey(baseArgs)).toBe("p-shampoo|tof|single_image");
  });
  it("fallbacks quando faltam campos", () => {
    expect(templateKey({})).toBe("no_product|no_funnel|no_format");
  });
});

describe("scoreProposal", () => {
  it("proposta completa + criativo match tem score alto", () => {
    const s = scoreProposal(baseArgs, {
      qualityGateOk: true,
      creativeMatchesProduct: true,
      productsAlreadyInCycle: new Set(),
    });
    // 50 (gate) + 25 (creative match) + 6+2 (headlines) + 6 (primary≥2) + 5 (url) + 2 (obj) + 10 (novidade) + 4 (budget conservador) = 110
    expect(s).toBeGreaterThanOrEqual(100);
  });
  it("penaliza budget agressivo em frio com criativo desalinhado", () => {
    const s = scoreProposal(
      { ...baseArgs, daily_budget_cents: 30000, creative_asset_id: null },
      { qualityGateOk: true, creativeMatchesProduct: false, productsAlreadyInCycle: new Set() },
    );
    const baseline = scoreProposal(baseArgs, {
      qualityGateOk: true,
      creativeMatchesProduct: true,
      productsAlreadyInCycle: new Set(),
    });
    expect(s).toBeLessThan(baseline);
  });
  it("perde bônus de diversidade quando produto já está na rodada", () => {
    const s1 = scoreProposal(baseArgs, {
      qualityGateOk: true,
      creativeMatchesProduct: true,
      productsAlreadyInCycle: new Set(),
    });
    const s2 = scoreProposal(baseArgs, {
      qualityGateOk: true,
      creativeMatchesProduct: true,
      productsAlreadyInCycle: new Set(["p-shampoo"]),
    });
    expect(s1 - s2).toBe(10);
  });
});

describe("applyLimits — cooldown / dedup", () => {
  it("bloqueia segunda proposta de mesmo template em janela 24h", () => {
    const r = applyLimits({
      args: baseArgs,
      newScore: 80,
      existingPending: [
        {
          id: "e1",
          product_id: "p-shampoo",
          funnel_stage: "tof",
          ad_format: "single_image",
          campaign_name: "c1",
          score: 80,
          created_at: new Date().toISOString(),
        },
      ],
    });
    expect(r.decision).toBe("supersede_self");
    expect(r.reason).toBe("duplicate_template");
  });

  it("substitui pending fraca quando nova é claramente melhor (mesmo template)", () => {
    const r = applyLimits({
      args: baseArgs,
      newScore: 110,
      existingPending: [
        {
          id: "e1",
          product_id: "p-shampoo",
          funnel_stage: "tof",
          ad_format: "single_image",
          campaign_name: "c1",
          score: 60,
          created_at: new Date().toISOString(),
        },
      ],
    });
    expect(r.decision).toBe("replace");
    expect(r.supersedeIds).toEqual(["e1"]);
  });

  it("expirou cooldown — aceita normalmente", () => {
    const r = applyLimits({
      args: baseArgs,
      newScore: 80,
      existingPending: [
        {
          id: "e1",
          product_id: "p-shampoo",
          funnel_stage: "tof",
          ad_format: "single_image",
          campaign_name: "c1",
          score: 80,
          created_at: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
    expect(r.decision).toBe("accept");
  });
});

describe("applyLimits — cap por produto", () => {
  it("bloqueia 2ª proposta do mesmo produto no ciclo (cap=1)", () => {
    const r = applyLimits({
      args: { ...baseArgs, funnel_stage: "bof" }, // template diferente, mesmo produto
      newScore: 80,
      existingPending: [
        {
          id: "e1",
          product_id: "p-shampoo",
          funnel_stage: "tof",
          ad_format: "single_image",
          campaign_name: "c1",
          score: 80,
          created_at: new Date().toISOString(),
        },
      ],
    });
    expect(r.decision).toBe("supersede_self");
    expect(r.reason).toBe("product_cap_reached");
  });
});

describe("applyLimits — cap por ciclo", () => {
  it("bloqueia 4ª proposta quando cap=3 já está cheio", () => {
    const existingPending = ["p-a", "p-b", "p-c"].map((pid, i) => ({
      id: `e${i}`,
      product_id: pid,
      funnel_stage: "tof",
      ad_format: "single_image",
      campaign_name: `c${i}`,
      score: 80,
      created_at: new Date().toISOString(),
    }));
    const r = applyLimits({
      args: { ...baseArgs, product_id: "p-novo" },
      newScore: 80,
      existingPending,
    });
    expect(r.decision).toBe("supersede_self");
    expect(r.reason).toBe("cycle_cap_reached");
  });

  it("aceita quando cap não foi atingido", () => {
    const r = applyLimits({
      args: baseArgs,
      newScore: 80,
      existingPending: [],
    });
    expect(r.decision).toBe("accept");
  });
});

describe("dry-run — simula 57 propostas da rodada real", () => {
  it("mantém no máximo 3 pending_approval ao processar fila grande", () => {
    const cycle: any[] = [];
    const products = ["p-shampoo", "p-kit", "p-kit2x", "p-fast"];
    let accepted = 0;
    let superseded = 0;
    for (let i = 0; i < 57; i++) {
      const pid = products[i % products.length];
      const args = {
        ...baseArgs,
        product_id: pid,
        product_name: pid,
        creative_asset_id: `creative-${pid}`,
        daily_budget_cents: 5000 + (i % 5) * 1000,
      };
      const productsInCycle = new Set(cycle.map((c) => c.product_id));
      const newScore = scoreProposal(args, {
        qualityGateOk: true,
        creativeMatchesProduct: true,
        productsAlreadyInCycle: productsInCycle,
      });
      const r = applyLimits({ args, newScore, existingPending: cycle });
      if (r.decision === "accept") {
        accepted++;
        cycle.push({
          id: `n${i}`,
          product_id: pid,
          funnel_stage: args.funnel_stage,
          ad_format: args.ad_format,
          campaign_name: `c${i}`,
          score: newScore,
          created_at: new Date().toISOString(),
        });
      } else if (r.decision === "replace") {
        // remove superseded e adiciona nova
        cycle.splice(0, cycle.length, ...cycle.filter((c) => !r.supersedeIds.includes(c.id)));
        cycle.push({
          id: `n${i}`,
          product_id: pid,
          funnel_stage: args.funnel_stage,
          ad_format: args.ad_format,
          campaign_name: `c${i}`,
          score: newScore,
          created_at: new Date().toISOString(),
        });
      } else {
        superseded++;
      }
    }
    expect(cycle.length).toBeLessThanOrEqual(DEFAULT_MAX_PROPOSALS_PER_CYCLE);
    expect(accepted + superseded).toBeGreaterThanOrEqual(57 - DEFAULT_MAX_PROPOSALS_PER_CYCLE);
    // E cada produto aparece no máximo 1 vez
    const uniqueProducts = new Set(cycle.map((c) => c.product_id));
    expect(uniqueProducts.size).toBe(cycle.length);
  });
});
