import { describe, it, expect } from "vitest";
import { evaluateAudienceBudgetFit } from "../../supabase/functions/_shared/ads-autopilot/audienceBudgetFitLite";

describe("Onda G.6 — Audience Budget Fit (Lite)", () => {
  it("retorna insufficient_data quando histórico é raso", () => {
    const r = evaluateAudienceBudgetFit({
      current_daily_budget_cents: 5000,
      impressions_30d: 100,
      spend_30d_cents: 100,
    });
    expect(r.fit).toBe("insufficient_data");
    expect(r.suggested_budget_range_cents).toBeNull();
  });

  it("detecta saturation_risk quando frequência alta", () => {
    const r = evaluateAudienceBudgetFit({
      current_daily_budget_cents: 10000,
      impressions_30d: 50000,
      spend_30d_cents: 80000,
      reach_30d: 200000,
      frequency_avg: 5.5,
      conversions_30d: 4,
      roas: 1.1,
    });
    expect(["saturation_risk", "over_funded_small_audience"]).toContain(r.fit);
  });

  it("detecta over_funded_small_audience quando alcance pequeno", () => {
    const r = evaluateAudienceBudgetFit({
      current_daily_budget_cents: 8000,
      impressions_30d: 60000,
      spend_30d_cents: 50000,
      reach_30d: 10000,
      frequency_avg: 6,
      conversions_30d: 2,
      roas: 0.8,
    });
    expect(r.fit).toBe("over_funded_small_audience");
    expect(r.suggested_budget_range_cents).not.toBeNull();
  });

  it("detecta under_funded quando ROAS bom + pouco gasto", () => {
    const r = evaluateAudienceBudgetFit({
      current_daily_budget_cents: 2000,
      impressions_30d: 30000,
      spend_30d_cents: 60000,
      reach_30d: 25000,
      frequency_avg: 1.2,
      conversions_30d: 8,
      roas: 3.1,
    });
    expect(r.fit).toBe("under_funded");
    expect(r.suggested_budget_range_cents?.max_cents).toBeGreaterThan(r.suggested_budget_range_cents!.min_cents);
  });

  it("retorna adequate em cenário neutro", () => {
    const r = evaluateAudienceBudgetFit({
      current_daily_budget_cents: 5000,
      impressions_30d: 20000,
      spend_30d_cents: 40000,
      reach_30d: 15000,
      frequency_avg: 1.5,
      conversions_30d: 3,
      roas: 1.4,
    });
    expect(r.fit).toBe("adequate");
  });
});
