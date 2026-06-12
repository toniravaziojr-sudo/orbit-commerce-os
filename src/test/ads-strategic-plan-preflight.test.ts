import { describe, it, expect } from "vitest";
import { buildStrategicPlanPreflightContext } from "../../supabase/functions/_shared/ads-autopilot/strategicPlanPreflight";

const catalog = [
  { id: "p1", name: "Shampoo Calvície Zero", slug: "shampoo-calvicie-zero" },
];

describe("Onda G (rev2) — Strategy Preflight Builder", () => {
  it("calcula planned/occupied/free por funil", () => {
    const r = buildStrategicPlanPreflightContext({
      ad_account_id: "act_1",
      total_daily_cents: 30000,
      funnel_splits: { cold: 60, remarketing: 25, tests: 15, leads: 0 } as any,
      campaigns: [
        { id: "c1", name: "Frio - Aquisição Broad", status: "ACTIVE", daily_budget_cents: 12000 },
      ],
    });
    expect(r.funnel_budget_state.per_funnel.cold.planned_cents).toBe(18000);
    expect(r.funnel_budget_state.per_funnel.cold.occupied_cents).toBe(12000);
    expect(r.funnel_budget_state.per_funnel.cold.free_cents).toBe(6000);
  });

  it("marca campanha ativa com queda de ROAS como must_be_addressed_in_plan", () => {
    const r = buildStrategicPlanPreflightContext({
      ad_account_id: "act_1",
      total_daily_cents: 30000,
      funnel_splits: null,
      campaigns: [{ id: "c1", name: "TOF Broad", status: "ACTIVE", daily_budget_cents: 10000 }],
      perf_by_campaign: {
        c1: { roas_7d: 1.2, roas_30d: 3.5, spend_30d_cents: 50000, spend_7d_cents: 10000 },
      },
    });
    const cs = r.active_campaigns_summary[0];
    expect(cs.trend).toBe("down");
    expect(cs.must_be_addressed_in_plan).toBe(true);
    expect(cs.recommended_attention_level).toBe("act_now");
  });

  it("identifica produto via slug do anúncio e expõe confiança", () => {
    const r = buildStrategicPlanPreflightContext({
      ad_account_id: "act_1",
      total_daily_cents: 10000,
      funnel_splits: null,
      campaigns: [{ id: "c1", name: "Genérico", status: "ACTIVE", daily_budget_cents: 5000 }],
      ads_by_campaign: { c1: [{ destination_urls: ["https://loja/p/shampoo-calvicie-zero"] }] },
      catalog_refs: catalog,
    });
    const pi = r.product_identifications[0];
    expect(pi.inferred_product_id).toBe("p1");
    expect(pi.product_identification_confidence).toBe("high");
  });

  it("declara pending_dependency quando catálogo e clientes ausentes", () => {
    const r = buildStrategicPlanPreflightContext({
      ad_account_id: "act_1",
      total_daily_cents: 10000,
      funnel_splits: null,
      campaigns: [],
      customer_audience: { found: false },
      catalog: { available: false },
    });
    expect(r.customer_audience.pending_dependency).toBe("customer_audience_missing");
    expect(r.catalog_availability.pending_dependency).toBe("catalog_not_connected");
  });

  it("inclui audience_budget_fit por campanha (insufficient_data quando histórico raso)", () => {
    const r = buildStrategicPlanPreflightContext({
      ad_account_id: "act_1",
      total_daily_cents: 5000,
      funnel_splits: null,
      campaigns: [{ id: "c1", name: "Nova", status: "ACTIVE", daily_budget_cents: 2000 }],
    });
    expect(r.audience_budget_fits[0].fit).toBe("insufficient_data");
  });
});
