import { describe, it, expect } from "vitest";
import { validateStrategicPlanContract } from "../../supabase/functions/_shared/ads-autopilot/strategicPlanContract";
import { buildStrategicPlanPreflightContext } from "../../supabase/functions/_shared/ads-autopilot/strategicPlanPreflight";

const basePreflight = buildStrategicPlanPreflightContext({
  ad_account_id: "act_1",
  total_daily_cents: 30000,
  funnel_splits: { cold: 60, remarketing: 25, tests: 15, leads: 0 } as any,
  campaigns: [
    { id: "c1", name: "Frio Broad", status: "ACTIVE", daily_budget_cents: 12000 },
  ],
  perf_by_campaign: {
    c1: { roas_7d: 1.2, roas_30d: 3.5, spend_30d_cents: 50000, spend_7d_cents: 10000 },
  },
  customer_audience: { found: true, meta_audience_id: "aud1", audience_name: "Clientes" },
  catalog: { available: true, catalog_id: "cat1", catalog_name: "Cat", product_sets: [{ id: "ps1", name: "Tudo" }] },
});

function basePlan(overrides: any = {}) {
  return {
    diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
    risk_assessment: "Riscos mapeados.",
    funnel_budget_state: basePreflight.funnel_budget_state,
    active_campaigns_summary: basePreflight.active_campaigns_summary,
    planned_actions: [
      {
        action_type: "create_campaign",
        campaign_type: "prospecting",
        campaign_intent: "acquisition",
        affected_funnel: "cold",
        daily_budget_brl: 50,
        budget_source: "free_now",
        audience_exclusions: { customers: true, reason: "prospecção pura" },
        audience_budget_fit: { fit: "insufficient_data" },
      },
      { action_type: "maintain", target_campaign_id: "c1", campaign_type: "prospecting", campaign_intent: "acquisition", audience_exclusions: { customers: true }, audience_budget_fit: { fit: "adequate" } },
    ],
    ...overrides,
  };
}

describe("Onda G (rev2) — Strategic Plan Contract Validator", () => {
  it("aprova plano completo e bem-formado", () => {
    const r = validateStrategicPlanContract(basePlan(), basePreflight);
    expect(r.ok).toBe(true);
  });

  it("rejeita plano sem funnel_budget_state", () => {
    const r = validateStrategicPlanContract(basePlan({ funnel_budget_state: null }), basePreflight);
    expect(r.ok).toBe(false);
    expect(r.errors.find((e) => e.code === "plan_missing_funnel_budget_state")).toBeTruthy();
  });

  it("rejeita campaign_type legado (TOF, Remarketing, Teste)", () => {
    const plan = basePlan();
    plan.planned_actions[0].campaign_type = "TOF";
    const r = validateStrategicPlanContract(plan, basePreflight);
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.code === "action_legacy_campaign_type")).toBe(true);
  });

  it("rejeita prospecção sem exclusão de clientes quando público de Clientes detectado", () => {
    const plan = basePlan();
    plan.planned_actions[0].audience_exclusions = {};
    const r = validateStrategicPlanContract(plan, basePreflight);
    expect(r.errors.some((e) => e.code === "prospecting_missing_customer_exclusion")).toBe(true);
  });

  it("rejeita ação de orçamento sem audience_budget_fit", () => {
    const plan = basePlan();
    delete plan.planned_actions[0].audience_budget_fit;
    const r = validateStrategicPlanContract(plan, basePreflight);
    expect(r.errors.some((e) => e.code === "budget_action_missing_audience_budget_fit")).toBe(true);
  });

  it("rejeita catalog_retargeting sem catalog_setup completo", () => {
    const plan = basePlan();
    plan.planned_actions[0].campaign_type = "catalog_retargeting";
    plan.planned_actions[0].catalog_setup = { creative_mode: "static" };
    const r = validateStrategicPlanContract(plan, basePreflight);
    expect(r.errors.some((e) => e.code === "catalog_missing_dynamic_creative_mode")).toBe(true);
  });

  it("rejeita plano que ignora campanha ativa must_be_addressed", () => {
    const plan = basePlan();
    plan.planned_actions = [plan.planned_actions[0]]; // remove a manutenção de c1
    const r = validateStrategicPlanContract(plan, basePreflight);
    expect(r.errors.some((e) => e.code === "active_campaign_ignored")).toBe(true);
  });

  it("rejeita alocação acima do orçamento livre sem liberação sequencial", () => {
    const plan = basePlan();
    plan.planned_actions[0].daily_budget_brl = 999; // muito acima do free
    const r = validateStrategicPlanContract(plan, basePreflight);
    expect(r.errors.some((e) => e.code === "action_exceeds_free_budget")).toBe(true);
  });

  it("rejeita pause em campanha com produto de baixa confiança", () => {
    const pf = buildStrategicPlanPreflightContext({
      ad_account_id: "act_1",
      total_daily_cents: 10000,
      funnel_splits: null,
      campaigns: [{ id: "c9", name: "Produtos Diversos", status: "ACTIVE", daily_budget_cents: 5000 }],
      perf_by_campaign: { c9: { roas_7d: 0.5, roas_30d: 2.0, spend_30d_cents: 50000 } },
      catalog_refs: [{ id: "p1", name: "Shampoo X" }],
    });
    const plan = {
      diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
      risk_assessment: "Riscos.",
      funnel_budget_state: pf.funnel_budget_state,
      active_campaigns_summary: pf.active_campaigns_summary,
      planned_actions: [{
        action_type: "pause",
        campaign_type: "prospecting",
        campaign_intent: "acquisition",
        target_campaign_id: "c9",
        audience_exclusions: { customers: true },
      }],
    };
    const r = validateStrategicPlanContract(plan, pf);
    expect(r.errors.some((e) => e.code === "pause_blocked_low_product_confidence")).toBe(true);
  });

  it("creative_test sem exclusion_override_reason válida quando inclui clientes é inválido", () => {
    const plan = basePlan();
    plan.planned_actions[0].campaign_intent = "creative_test";
    plan.planned_actions[0].campaign_type = "testing";
    plan.planned_actions[0].audience_exclusions = { customers: false };
    plan.planned_actions[0].exclusion_override_reason = "ok"; // muito curto
    const r = validateStrategicPlanContract(plan, basePreflight);
    expect(r.errors.some((e) => e.code === "creative_test_missing_override_reason")).toBe(true);
  });
});
