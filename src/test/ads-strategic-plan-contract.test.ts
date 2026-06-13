import { describe, it, expect } from "vitest";
import { normalizeAndValidateStrategicPlanForApproval, normalizeStrategicPlanCustomerExclusions, validateStrategicPlanContract } from "../../supabase/functions/_shared/ads-autopilot/strategicPlanContract";
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
    metadata: {
      source_flow: "strategist_start",
      schema_version: "strategic_plan_v2",
      preflight_version: basePreflight.version,
      validator_version: "1.2.0",
      guard_version: "1.2.0",
      normalized_at: new Date().toISOString(),
      validated_at: new Date().toISOString(),
      validation_status: "valid",
      validation_errors: [],
      is_approvable: true,
      analysis_run_id: "run_1",
      campaign_account_snapshot: [{ campaign_id: "c1", campaign_name: "Frio Broad", status: "ACTIVE", effective_status: "ACTIVE", allowed_actions: ["maintain", "reduce_budget", "pause_campaign"] }],
    },
    planned_actions: [
      {
        action_type: "create_campaign",
        campaign_type: "prospecting",
        campaign_intent: "acquisition",
        affected_funnel: "cold",
        product_name: "Shampoo Calvície Zero",
        target_audience: "Homens 30-65, Brasil",
        daily_budget_brl: 50,
        budget_source: "free_now",
        audience_exclusions: {
          customers: true,
          customer_audience_detected: true,
          customer_audience_id: "aud1",
          customer_audience_name: "Clientes",
          reason: "prospecção pura",
        },
        audience_budget_fit: { fit: "insufficient_data" },
      },
      {
        action_type: "maintain",
        target_campaign_id: "c1",
        campaign_type: "prospecting",
        campaign_intent: "acquisition",
        product_name: "Shampoo Calvície Zero",
        target_audience: "Homens 30-65, Brasil",
        audience_exclusions: {
          customers: true,
          customer_audience_detected: true,
          customer_audience_id: "aud1",
          customer_audience_name: "Clientes",
        },
        audience_budget_fit: { fit: "adequate" },
      },
    ],
    ...overrides,
  };
}

describe("Onda G (rev2) — Strategic Plan Contract Validator", () => {
  it("fixture real problemática falha no contrato quando a action fria tem adsets sem exclusão por conjunto", () => {
    const realProblematicPlan = {
      diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
      risk_assessment: "Riscos mapeados.",
      funnel_budget_state: basePreflight.funnel_budget_state,
      active_campaigns_summary: basePreflight.active_campaigns_summary,
      planned_actions: [{
        action_type: "create_campaign",
        campaign_type: "TOF",
        funnel_stage: "tof",
        campaign_intent: "acquisition",
        target_audience: "Homens 30-65, Brasil",
        product_name: "Shampoo Calvície Zero",
        daily_budget_brl: 90,
        budget_source: "free_now",
        audience_budget_fit: { fit: "insufficient_data" },
        adsets: [
          {
            audience_type: "broad",
            audience_description: "Público amplo (Homens 30-65, Brasil)",
          },
          {
            audience_type: "lookalike",
            audience_description: "Lookalike 1% Compra 180D",
          },
        ],
      }],
    };

    const guarded = normalizeAndValidateStrategicPlanForApproval(realProblematicPlan, basePreflight);

    expect(guarded.contract.ok).toBe(false);
  });

  it("teste vermelho: normalização canônica injeta exclusão de clientes em cada adset frio", () => {
    const realProblematicPlan = {
      diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
      risk_assessment: "Riscos mapeados.",
      funnel_budget_state: basePreflight.funnel_budget_state,
      active_campaigns_summary: basePreflight.active_campaigns_summary,
      planned_actions: [{
        action_type: "create_campaign",
        campaign_type: "TOF",
        funnel_stage: "tof",
        campaign_intent: "acquisition",
        target_audience: "Homens 30-65, Brasil",
        product_name: "Shampoo Calvície Zero",
        daily_budget_brl: 90,
        budget_source: "free_now",
        audience_budget_fit: { fit: "insufficient_data" },
        adsets: [
          {
            adset_name: "[AI] CJ - Broad | TOF - Shampoo",
            audience_type: "broad",
            audience_description: "Público amplo (Homens 30-65, Brasil)",
          },
          {
            adset_name: "[AI] CJ - LAL 1% Compra 180D | TOF - Shampoo",
            audience_type: "lookalike",
            audience_description: "Lookalike 1% Compra 180D",
          },
        ],
      }],
    };

    const guarded = normalizeAndValidateStrategicPlanForApproval(realProblematicPlan, basePreflight);

    expect(guarded.normalizedPlan.planned_actions[0].adsets[0].audience_exclusions.customers).toBe(true);
    expect(guarded.normalizedPlan.planned_actions[0].adsets[0].excluded_audience_ids).toContain("aud1");
    expect(guarded.normalizedPlan.planned_actions[0].adsets[0].targeting.excluded_custom_audiences).toEqual(
      expect.arrayContaining([{ id: "aud1", name: "Clientes" }]),
    );
    expect(guarded.normalizedPlan.planned_actions[0].adsets[1].audience_exclusions.customers).toBe(true);
  });

  it("teste vermelho: validator reprova action fria quando só a action tem exclusão e os adsets não têm", () => {
    const plan = basePlan({
      planned_actions: [{
        action_type: "create_campaign",
        campaign_type: "prospecting",
        campaign_intent: "acquisition",
        funnel_stage: "tof",
        target_audience: "Homens 30-65, Brasil",
        daily_budget_brl: 90,
        budget_source: "free_now",
        audience_exclusions: { customers: true, customer_audience_detected: true, customer_audience_id: "aud1", customer_audience_name: "Clientes" },
        audience_budget_fit: { fit: "insufficient_data" },
        adsets: [
          { adset_name: "Broad", audience_type: "broad", audience_description: "Público amplo (Homens 30-65, Brasil)" },
          { adset_name: "LAL", audience_type: "lookalike", audience_description: "Lookalike 1% Compra 180D" },
        ],
      }],
    });

    const result = validateStrategicPlanContract(plan, basePreflight);

    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "prospecting_adset_missing_customer_exclusion")).toBe(true);
  });

  it("gera pendência por adset frio quando público de clientes não existe", () => {
    const pf = buildStrategicPlanPreflightContext({
      ad_account_id: "act_1",
      total_daily_cents: 30000,
      funnel_splits: { cold: 60, remarketing: 25, tests: 15, leads: 0 } as any,
      campaigns: [],
      customer_audience: { found: false },
    });

    const plan = {
      diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
      risk_assessment: "Riscos mapeados.",
      funnel_budget_state: pf.funnel_budget_state,
      active_campaigns_summary: pf.active_campaigns_summary,
      planned_actions: [{
        action_type: "create_campaign",
        campaign_type: "TOF",
        funnel_stage: "tof",
        campaign_intent: "acquisition",
        target_audience: "Homens 30-65, Brasil",
        daily_budget_brl: 90,
        budget_source: "free_now",
        audience_budget_fit: { fit: "insufficient_data" },
        adsets: [
          { adset_name: "Broad", audience_type: "broad", audience_description: "Público amplo (Homens 30-65, Brasil)" },
        ],
      }],
    };

    const guarded = normalizeAndValidateStrategicPlanForApproval(plan, pf);

    expect(guarded.normalizedPlan.planned_actions[0].adsets[0].audience_exclusions.pending_dependency).toBe("customer_audience_not_detected");
    expect(guarded.approvalStatus).toBe("incomplete");
  });

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

  it("normaliza automaticamente exclusão de clientes em ação fria antes de persistir o plano", () => {
    const plan = basePlan();
    plan.planned_actions[0].campaign_type = "testing";
    plan.planned_actions[0].campaign_intent = "retention";
    plan.planned_actions[0].funnel_stage = "tof";
    plan.planned_actions[0].audience_exclusions = {};

    const normalized = normalizeStrategicPlanCustomerExclusions(plan, basePreflight);

    expect(normalized.planned_actions[0].audience_exclusions.customers).toBe(true);
    expect(normalized.planned_actions[0].audience_exclusions.customer_audience_detected).toBe(true);
  });

  it("normaliza fixture real legado TOF para prospecting e injeta exclusão canônica", () => {
    const legacyPlan = {
      diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
      risk_assessment: "Riscos mapeados.",
      funnel_budget_state: basePreflight.funnel_budget_state,
      active_campaigns_summary: basePreflight.active_campaigns_summary,
      planned_actions: [{
        action_type: "create_campaign",
        campaign_type: "TOF",
        funnel_stage: "tof",
        target_audience: "Homens 30-65, Brasil",
        product_name: "Shampoo Calvície Zero",
        daily_budget_brl: 50,
        budget_source: "free_now",
        audience_budget_fit: { fit: "insufficient_data" },
      }, {
        action_type: "maintain",
        target_campaign_id: "c1",
        campaign_type: "prospecting",
        campaign_intent: "acquisition",
        product_name: "Shampoo Calvície Zero",
        target_audience: "Homens 30-65, Brasil",
        audience_exclusions: {
          customers: true,
          customer_audience_detected: true,
          customer_audience_id: "aud1",
          customer_audience_name: "Clientes",
        },
        audience_budget_fit: { fit: "adequate" },
      }],
    };

    const guarded = normalizeAndValidateStrategicPlanForApproval(legacyPlan, basePreflight);

    expect(guarded.normalizedPlan.planned_actions[0].campaign_type).toBe("prospecting");
    expect(guarded.normalizedPlan.planned_actions[0].campaign_intent).toBe("acquisition");
    expect(guarded.normalizedPlan.planned_actions[0].audience_exclusions.customers).toBe(true);
    expect(guarded.normalizedPlan.planned_actions[0].audience_exclusions.customer_audience_id).toBe("aud1");
    expect(guarded.approvalStatus).toBe("pending_approval");
  });

  it("gera pendência canônica quando público de clientes não existe e mantém plano incompleto", () => {
    const pf = buildStrategicPlanPreflightContext({
      ad_account_id: "act_1",
      total_daily_cents: 30000,
      funnel_splits: { cold: 60, remarketing: 25, tests: 15, leads: 0 } as any,
      campaigns: [],
      customer_audience: { found: false },
    });
    const legacyPlan = {
      diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
      risk_assessment: "Riscos mapeados.",
      funnel_budget_state: pf.funnel_budget_state,
      active_campaigns_summary: pf.active_campaigns_summary,
      planned_actions: [{
        action_type: "create_campaign",
        campaign_type: "TOF",
        funnel_stage: "tof",
        target_audience: "Homens 30-65, Brasil",
        daily_budget_brl: 50,
        budget_source: "free_now",
        audience_budget_fit: { fit: "insufficient_data" },
      }],
    };

    const guarded = normalizeAndValidateStrategicPlanForApproval(legacyPlan, pf);

    expect(guarded.normalizedPlan.planned_actions[0].campaign_type).toBe("prospecting");
    expect(guarded.normalizedPlan.planned_actions[0].audience_exclusions.pending_dependency).toBe("customer_audience_not_detected");
    expect(guarded.approvalStatus).toBe("incomplete");
    expect(guarded.contract.ok).toBe(false);
  });

  it("preserva exceção explícita de teste criativo com justificativa válida", () => {
    const plan = basePlan();
    plan.planned_actions[0].campaign_type = "testing";
    plan.planned_actions[0].campaign_intent = "creative_test";
    plan.planned_actions[0].funnel_stage = "tof";
    plan.planned_actions[0].audience_exclusions = { customers: false };
    plan.planned_actions[0].exclusion_override_reason = "Usuário pediu validar criativo com base compradora atual.";

    const normalized = normalizeStrategicPlanCustomerExclusions(plan, basePreflight);

    expect(normalized.planned_actions[0].audience_exclusions.customers).toBe(false);
  });

  it("rejeita ação de orçamento sem audience_budget_fit", () => {
    const plan = basePlan();
    delete plan.planned_actions[0].audience_budget_fit;
    const r = validateStrategicPlanContract(plan, basePreflight);
    expect(r.errors.some((e) => e.code === "budget_action_missing_audience_budget_fit")).toBe(true);
  });

  it("infere audience_budget_fit quando a IA omite o campo em ação de orçamento", () => {
    const plan = basePlan({
      planned_actions: [
        {
          action_type: "maintain",
          target_campaign_id: "c1",
          existing_campaign_name: "Frio Broad",
          campaign_type: "prospecting",
          campaign_intent: "acquisition",
          affected_funnel: "cold",
          product_name: "Shampoo Calvície Zero",
          target_audience: "Homens 30-65, Brasil",
          audience_exclusions: {
            customers: true,
            customer_audience_detected: true,
            customer_audience_id: "aud1",
            customer_audience_name: "Clientes",
          },
        },
      ],
    });

    const guarded = normalizeAndValidateStrategicPlanForApproval(plan, basePreflight);
    const expectedFit = basePreflight.audience_budget_fits.find((entry) => entry.campaign_id === "c1")?.fit;

    expect(guarded.approvalStatus).toBe("pending_approval");
    expect(guarded.contract.ok).toBe(true);
    expect(guarded.normalizedPlan.planned_actions[0].audience_budget_fit?.fit).toBe(expectedFit);
    expect(guarded.normalizedPlan.planned_actions[0].audience_budget_fit_inferred).toBe(true);
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

  it("anexa metadados obrigatórios de versionamento e aprovação ao plano normalizado", () => {
    const guarded = normalizeAndValidateStrategicPlanForApproval(basePlan(), basePreflight, {
      source_flow: "strategist_start",
      campaign_account_snapshot: [{ campaign_id: "c1", campaign_name: "Frio Broad", status: "ACTIVE", effective_status: "ACTIVE", allowed_actions: ["maintain", "reduce_budget", "pause_campaign"] }],
      analysis_run_id: "run_1",
    });

    expect(guarded.normalizedPlan.metadata.schema_version).toBe("strategic_plan_v2");
    expect(guarded.normalizedPlan.metadata.validator_version).toBeTruthy();
    expect(guarded.normalizedPlan.metadata.guard_version).toBeTruthy();
    expect(guarded.normalizedPlan.metadata.validation_status).toBe("valid");
    expect(guarded.normalizedPlan.metadata.is_approvable).toBe(true);
    expect(guarded.normalizedPlan.metadata.source_flow).toBe("strategist_start");
  });

  it("rejeita plano legado sem metadata obrigatória", () => {
    const legacyPlan = basePlan();
    delete (legacyPlan as any).metadata;
    const r = validateStrategicPlanContract(legacyPlan, basePreflight);
    expect(r.errors.some((e) => e.code === "plan_missing_required_metadata")).toBe(true);
  });

  it("rejeita pausar campanha já pausada pelo snapshot canônico", () => {
    const guarded = normalizeAndValidateStrategicPlanForApproval({
      diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
      risk_assessment: "Riscos mapeados.",
      funnel_budget_state: basePreflight.funnel_budget_state,
      active_campaigns_summary: basePreflight.active_campaigns_summary,
      planned_actions: [{
        action_type: "pause_campaign",
        campaign_type: "prospecting",
        campaign_intent: "acquisition",
        target_campaign_id: "c1",
        existing_campaign_id: "c1",
        existing_campaign_name: "Frio Broad",
        product_name: "Shampoo Calvície Zero",
        target_audience: "Homens 30-65, Brasil",
        audience_exclusions: { customers: true },
        audience_budget_fit: { fit: "adequate" },
      }],
    }, basePreflight, {
      source_flow: "strategist_start",
      campaign_account_snapshot: [{ campaign_id: "c1", campaign_name: "Frio Broad", status: "PAUSED", effective_status: "PAUSED", allowed_actions: ["keep_paused", "use_as_reference", "reactivate", "monitor_historical", "request_review"] }],
    });

    expect(guarded.contract.errors.some((e) => e.code === "paused_campaign_cannot_receive_pause")).toBe(true);
  });

  it("rejeita ação operacional com N/A em produto e público", () => {
    const guarded = normalizeAndValidateStrategicPlanForApproval({
      diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
      risk_assessment: "Riscos mapeados.",
      funnel_budget_state: basePreflight.funnel_budget_state,
      active_campaigns_summary: basePreflight.active_campaigns_summary,
      planned_actions: [{
        action_type: "pause_campaign",
        campaign_type: "prospecting",
        campaign_intent: "acquisition",
        target_campaign_id: "c1",
        existing_campaign_id: "c1",
        existing_campaign_name: "Frio Broad",
        product_name: "N/A",
        target_audience: "N/A",
        audience_exclusions: { customers: true },
        audience_budget_fit: { fit: "adequate" },
      }],
    }, basePreflight, {
      source_flow: "strategist_start",
      campaign_account_snapshot: [{ campaign_id: "c1", campaign_name: "Frio Broad", status: "ACTIVE", effective_status: "ACTIVE", allowed_actions: ["maintain", "reduce_budget", "pause_campaign"] }],
    });

    expect(guarded.contract.errors.some((e) => e.code === "action_missing_product_name")).toBe(true);
    expect(guarded.contract.errors.some((e) => e.code === "action_missing_target_audience")).toBe(true);
    expect(guarded.approvalStatus).toBe("incomplete");
  });

  it("payload persistido de plano legado bloqueado preserva metadata, preflight, contract e exclusão por adset", () => {
    const legacyPlan = {
      diagnosis: "Diagnóstico válido com mais de 10 caracteres.",
      risk_assessment: "Riscos mapeados.",
      expected_results: "Resultados esperados.",
      budget_allocation: { tof_brl: 180, bof_brl: 45, test_brl: 75, total_daily_brl: 300 },
      timeline: "Dia 1: lançar. Dia 3: revisar.",
      planned_actions: [{
        action_type: "duplicate",
        campaign_type: "TOF",
        funnel_stage: "tof",
        campaign_intent: "acquisition",
        target_audience: "Homens 30-65, Brasil",
        product_name: "Shampoo Calvície Zero",
        daily_budget_brl: 60,
        budget_source: "free_now",
        audience_budget_fit: { fit: "insufficient_data" },
        adsets: [
          { adset_name: "[AI] CJ - Broad | TOF", audience_type: "broad", audience_description: "Homens 30-65 BR sem segmentação de interesses" },
          { adset_name: "[AI] CJ - LAL 1% Compradores 180D | TOF", audience_type: "lookalike", audience_description: "Lookalike 1% de compradores nos últimos 180 dias" },
        ],
      }, {
        action_type: "maintain",
        target_campaign_id: "c1",
        existing_campaign_id: "c1",
        existing_campaign_name: "Frio Broad",
        campaign_type: "prospecting",
        campaign_intent: "acquisition",
        product_name: "Shampoo Calvície Zero",
        target_audience: "Homens 30-65, Brasil",
        audience_exclusions: {
          customers: true,
          customer_audience_detected: true,
          customer_audience_id: "aud1",
          customer_audience_name: "Clientes",
        },
        audience_budget_fit: { fit: "adequate" },
      }],
    };

    const guarded = normalizeAndValidateStrategicPlanForApproval(legacyPlan, basePreflight, {
      source_flow: "strategist_start",
      campaign_account_snapshot: [{ campaign_id: "c1", campaign_name: "Frio Broad", status: "ACTIVE", effective_status: "ACTIVE", allowed_actions: ["maintain", "reduce_budget", "pause_campaign"] }],
      analysis_run_id: "run_1",
    });

    const persistedPayload = {
      ...guarded.normalizedPlan,
      type: "strategic_plan",
      ad_account_id: "act_1",
      strategic_plan_preflight: basePreflight,
      contract: guarded.contract,
      approval_status: guarded.approvalStatus,
      preview: {
        headline: guarded.contract.ok ? "Plano Estratégico — Motor Estrategista" : "Plano Estratégico — INCOMPLETO (não aprovável)",
        copy_text: "preview",
        targeting_summary: "1 ações planejadas",
      },
    };

    expect(persistedPayload.metadata?.schema_version).toBe("strategic_plan_v2");
    expect(persistedPayload.metadata?.is_approvable).toBe(false);
    expect(persistedPayload.metadata?.validation_status).toBe("invalid");
    expect(persistedPayload.contract?.ok).toBe(false);
    expect(persistedPayload.approval_status).toBe("incomplete");
    expect(persistedPayload.strategic_plan_preflight?.customer_audience?.customer_audience_id).toBe("aud1");
    expect(persistedPayload.planned_actions[0].adsets[0].audience_exclusions.customers).toBe(true);
    expect(persistedPayload.planned_actions[0].adsets[0].excluded_audience_ids).toContain("aud1");
    expect(persistedPayload.planned_actions[0].adsets[0].targeting.excluded_custom_audiences).toEqual(
      expect.arrayContaining([{ id: "aud1", name: "Clientes" }]),
    );
  });
});
