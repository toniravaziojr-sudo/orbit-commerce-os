import { describe, it, expect } from "vitest";
import {
  computeFunnelBudgetState,
  inferCampaignFunnel,
  projectSequentialAvailability,
} from "../../supabase/functions/_shared/ads-autopilot/funnelBudgetModel";

describe("Onda G.1 — Modelo de Orçamento por Funil", () => {
  const splits = { cold: 60, remarketing: 25, tests: 15, leads: 0 };

  it("calcula planejado por funil a partir do split", () => {
    const state = computeFunnelBudgetState({
      totalDailyCents: 30000,
      funnelSplits: splits,
      campaigns: [],
    });
    expect(state.per_funnel.cold.planned_cents).toBe(18000);
    expect(state.per_funnel.remarketing.planned_cents).toBe(7500);
    expect(state.per_funnel.tests.planned_cents).toBe(4500);
    expect(state.per_funnel.leads.planned_cents).toBe(0);
  });

  it("considera campanhas ativas como orçamento ocupado", () => {
    const state = computeFunnelBudgetState({
      totalDailyCents: 30000,
      funnelSplits: splits,
      campaigns: [
        { id: "c1", name: "Frio - Aquisição Broad", status: "ACTIVE", daily_budget_cents: 16000 },
        { id: "c2", name: "Remarketing Carrinho", status: "ACTIVE", daily_budget_cents: 5000 },
        { id: "c3", name: "Pausada Antiga", status: "PAUSED", daily_budget_cents: 9999 },
      ],
    });
    expect(state.per_funnel.cold.occupied_cents).toBe(16000);
    expect(state.per_funnel.cold.free_cents).toBe(2000);
    expect(state.per_funnel.remarketing.occupied_cents).toBe(5000);
    expect(state.per_funnel.remarketing.free_cents).toBe(2500);
  });

  it("identifica funil por palavras-chave no nome", () => {
    expect(inferCampaignFunnel({ name: "TOF Broad" })).toBe("cold");
    expect(inferCampaignFunnel({ name: "Remarketing 7d" })).toBe("remarketing");
    expect(inferCampaignFunnel({ name: "Lead Gen B2B" })).toBe("leads");
    expect(inferCampaignFunnel({ name: "Teste criativo" })).toBe("tests");
    expect(inferCampaignFunnel({ name: "Sem rótulo" })).toBe("unknown");
  });

  it("projeção sequencial libera verba após redução planejada", () => {
    const state = computeFunnelBudgetState({
      totalDailyCents: 30000,
      funnelSplits: splits,
      campaigns: [{ id: "c1", name: "TOF Broad", status: "ACTIVE", daily_budget_cents: 16000 }],
    });
    const rows = projectSequentialAvailability(state, [
      { action_index: 0, action_type: "adjust_budget", funnel: "cold", budget_delta_cents: -7000 },
      { action_index: 1, action_type: "create_campaign", funnel: "cold", budget_delta_cents: 9000, references_release_from_action_index: 0 },
    ]);
    expect(rows[0].after_free_cents).toBe(2000 + 7000); // liberou 7k
    expect(rows[1].before_free_cents).toBe(9000);
    expect(rows[1].ok).toBe(true);
  });

  it("bloqueia ação que excede orçamento livre quando não há liberação anterior", () => {
    const state = computeFunnelBudgetState({
      totalDailyCents: 30000,
      funnelSplits: splits,
      campaigns: [{ id: "c1", name: "TOF Broad", status: "ACTIVE", daily_budget_cents: 16000 }],
    });
    const rows = projectSequentialAvailability(state, [
      { action_index: 0, action_type: "create_campaign", funnel: "cold", budget_delta_cents: 9000 },
    ]);
    expect(rows[0].ok).toBe(false);
    expect(rows[0].reason).toBe("exceeds_free_budget");
  });
});
