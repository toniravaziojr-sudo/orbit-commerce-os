import { describe, expect, it } from "vitest";
import {
  CADENCE_POLICY_VERSION,
  PLATFORM_PROFILES,
  evaluateCampaignAge,
  isWithinBudgetWindow,
  evaluateBudgetChange,
  isDailyActionAllowed,
  classifyPauseRequest,
  evaluatePendingQueueGate,
  evaluateStrategistCooldown,
  isGuardianDuplicate,
  evaluateAudiencePolicy,
  isFirstSaturdayOfMonthBRT,
  shouldWeeklyYieldToMonthly,
  MAX_PENDING_APPROVAL_QUEUE,
} from "../../supabase/functions/_shared/ads-autopilot/cadencePolicy.ts";

describe("Ads Autopilot — Cadence Policy v1", () => {
  it("expõe versão estável", () => {
    expect(CADENCE_POLICY_VERSION).toBe("1.0.0");
  });

  it("perfil Meta vem de fontes oficiais para learning phase", () => {
    expect(PLATFORM_PROFILES.meta.learning_phase_days.source).toBe(
      "officially_documented",
    );
    expect(PLATFORM_PROFILES.meta.min_conversion_events.value).toBe(50);
  });

  it("padrão de 20% de variação é marcado como conservador, NÃO oficial", () => {
    expect(PLATFORM_PROFILES.meta.max_budget_change_pct_per_cycle.source).toBe(
      "conservative_operational_default",
    );
    expect(PLATFORM_PROFILES.google.max_budget_change_pct_per_cycle.source).toBe(
      "conservative_operational_default",
    );
    expect(PLATFORM_PROFILES.tiktok.max_budget_change_pct_per_cycle.source).toBe(
      "conservative_operational_default",
    );
  });

  it("campanha <3 dias = no_touch", () => {
    const r = evaluateCampaignAge({ platform: "meta", daysRunning: 2, inLearningPhase: false });
    expect(r.gate).toBe("no_touch");
    expect(r.reason).toBe("min_days_before_optimization_not_met");
  });

  it("campanha entre 3 e 7 dias = observe_only", () => {
    const r = evaluateCampaignAge({ platform: "meta", daysRunning: 5, inLearningPhase: false });
    expect(r.gate).toBe("observe_only");
  });

  it("campanha em learning phase = no_touch mesmo madura", () => {
    const r = evaluateCampaignAge({ platform: "meta", daysRunning: 30, inLearningPhase: true });
    expect(r.gate).toBe("no_touch");
    expect(r.reason).toBe("in_learning_phase");
  });

  it("campanha madura com dados suficientes = optimize_allowed", () => {
    const r = evaluateCampaignAge({
      platform: "meta",
      daysRunning: 14,
      inLearningPhase: false,
      conversionEventsLast7d: 80,
    });
    expect(r.gate).toBe("optimize_allowed");
  });

  it("campanha madura com poucos eventos = observe_only", () => {
    const r = evaluateCampaignAge({
      platform: "meta",
      daysRunning: 14,
      inLearningPhase: false,
      conversionEventsLast7d: 10,
    });
    expect(r.gate).toBe("observe_only");
    expect(r.reason).toBe("insufficient_conversion_events");
  });

  it("janela operacional 00:01–03:00 BRT — dentro", () => {
    // 02:00 BRT = 05:00 UTC
    const inside = new Date("2026-06-10T05:00:00Z");
    expect(isWithinBudgetWindow(inside)).toBe(true);
  });

  it("janela operacional 00:01–03:00 BRT — fora (00:00 BRT)", () => {
    // 00:00 BRT = 03:00 UTC
    const edge = new Date("2026-06-10T03:00:00Z");
    expect(isWithinBudgetWindow(edge)).toBe(false);
  });

  it("janela operacional 00:01–03:00 BRT — fora (03:00 BRT exato)", () => {
    // 03:00 BRT = 06:00 UTC
    const edge = new Date("2026-06-10T06:00:00Z");
    expect(isWithinBudgetWindow(edge)).toBe(false);
  });

  it("janela operacional — fora (meio dia)", () => {
    const noon = new Date("2026-06-10T15:00:00Z"); // 12:00 BRT
    expect(isWithinBudgetWindow(noon)).toBe(false);
  });

  it("ajuste de orçamento ≤20% é permitido", () => {
    const r = evaluateBudgetChange({ platform: "meta", currentCents: 10000, proposedCents: 11500 });
    expect(r.allowed).toBe(true);
    expect(r.requires_human_approval).toBe(false);
  });

  it("ajuste >20% exige aprovação humana", () => {
    const r = evaluateBudgetChange({ platform: "meta", currentCents: 10000, proposedCents: 15000 });
    expect(r.allowed).toBe(false);
    expect(r.requires_human_approval).toBe(true);
    expect(r.cap_source).toBe("conservative_operational_default");
  });

  it("redução >20% também exige aprovação", () => {
    const r = evaluateBudgetChange({ platform: "meta", currentCents: 10000, proposedCents: 7000 });
    expect(r.requires_human_approval).toBe(true);
  });

  it("ciclo diário bloqueia create_campaign", () => {
    expect(isDailyActionAllowed("create_campaign").allowed).toBe(false);
    expect(isDailyActionAllowed("create_adset").allowed).toBe(false);
    expect(isDailyActionAllowed("generate_creative").allowed).toBe(false);
    expect(isDailyActionAllowed("create_audience").allowed).toBe(false);
    expect(isDailyActionAllowed("create_lookalike_audience").allowed).toBe(false);
    expect(isDailyActionAllowed("duplicate_campaign").allowed).toBe(false);
  });

  it("ciclo diário permite operações", () => {
    expect(isDailyActionAllowed("adjust_budget").allowed).toBe(true);
    expect(isDailyActionAllowed("pause_campaign").allowed).toBe(true);
    expect(isDailyActionAllowed("report_insight").allowed).toBe(true);
    expect(isDailyActionAllowed("alert").allowed).toBe(true);
  });

  it("pausa emergencial é permitida no diário", () => {
    const r = classifyPauseRequest("site_down");
    expect(r.kind).toBe("emergency");
    expect(r.daily_cycle_allowed).toBe(true);
  });

  it("pausa estratégica bloqueada no diário", () => {
    const r = classifyPauseRequest("low_performance");
    expect(r.kind).toBe("strategic");
    expect(r.daily_cycle_allowed).toBe(false);
    expect(r.requires_human_approval).toBe(true);
  });

  it("pausa com motivo desconhecido = bloqueada por padrão", () => {
    const r = classifyPauseRequest("xpto");
    expect(r.kind).toBe("unknown");
    expect(r.daily_cycle_allowed).toBe(false);
  });

  it("fila pending_approval >=5 bloqueia create_campaign", () => {
    const r = evaluatePendingQueueGate({ pendingCount: MAX_PENDING_APPROVAL_QUEUE, actionType: "create_campaign" });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("pending_queue_limit_reached");
  });

  it("fila pending_approval >=5 NÃO bloqueia report_insight", () => {
    const r = evaluatePendingQueueGate({ pendingCount: 99, actionType: "report_insight" });
    expect(r.allowed).toBe(true);
  });

  it("fila >=5 bloqueia adjust_budget com mudança >20%", () => {
    const r = evaluatePendingQueueGate({ pendingCount: 5, actionType: "adjust_budget", budgetChangePct: 35 });
    expect(r.allowed).toBe(false);
  });

  it("Strategist manual respeita cooldown de 6h", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const recent = new Date("2026-06-10T08:00:00Z"); // 4h atrás
    const r = evaluateStrategistCooldown({ trigger: "manual_implement_campaigns", lastRunAt: recent, now });
    expect(r.allowed).toBe(false);
    expect(r.reason).toBe("cooldown_active");
  });

  it("Strategist manual libera após 6h", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const long = new Date("2026-06-10T05:30:00Z");
    const r = evaluateStrategistCooldown({ trigger: "manual_implement_campaigns", lastRunAt: long, now });
    expect(r.allowed).toBe(true);
  });

  it("Strategist weekly respeita cooldown de 6 dias", () => {
    const now = new Date("2026-06-13T04:00:00Z");
    const r1 = evaluateStrategistCooldown({
      trigger: "weekly",
      lastRunAt: new Date("2026-06-10T04:00:00Z"),
      now,
    });
    expect(r1.allowed).toBe(false);
    const r2 = evaluateStrategistCooldown({
      trigger: "weekly",
      lastRunAt: new Date("2026-06-05T04:00:00Z"),
      now,
    });
    expect(r2.allowed).toBe(true);
  });

  it("Strategist monthly respeita cooldown de 28 dias", () => {
    const now = new Date("2026-07-04T05:00:00Z");
    const r1 = evaluateStrategistCooldown({
      trigger: "monthly",
      lastRunAt: new Date("2026-06-10T05:00:00Z"),
      now,
    });
    expect(r1.allowed).toBe(false);
    const r2 = evaluateStrategistCooldown({
      trigger: "monthly",
      lastRunAt: new Date("2026-06-01T05:00:00Z"),
      now,
    });
    expect(r2.allowed).toBe(true);
  });

  it("Guardian dedupe — ação igual na mesma campanha em <2h é duplicada", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const dup = isGuardianDuplicate({
      candidate: { action_type: "adjust_budget", campaign_id: "c1" },
      recentActions: [
        { action_type: "adjust_budget", campaign_id: "c1", created_at: new Date("2026-06-10T11:00:00Z") },
      ],
      now,
    });
    expect(dup).toBe(true);
  });

  it("Guardian dedupe — ação igual em campanha diferente NÃO é duplicada", () => {
    const now = new Date("2026-06-10T12:00:00Z");
    const dup = isGuardianDuplicate({
      candidate: { action_type: "adjust_budget", campaign_id: "c2" },
      recentActions: [
        { action_type: "adjust_budget", campaign_id: "c1", created_at: new Date("2026-06-10T11:00:00Z") },
      ],
      now,
    });
    expect(dup).toBe(false);
  });

  it("público frio sem exclude_customers é corrigido para excluir", () => {
    const r = evaluateAudiencePolicy({ funnel_stage: "cold" });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("cold_audience_must_exclude_customers");
    expect(r.patched.exclude_customers).toBe(true);
  });

  it("público quente recebe retenção padrão de 14 dias se ausente", () => {
    const r = evaluateAudiencePolicy({ funnel_stage: "hot" });
    expect(r.patched.retention_days).toBe(14);
  });

  it("primeiro sábado do mês BRT detectado", () => {
    // 2026-06-06 é primeiro sábado de junho/2026. 02:00 BRT = 05:00 UTC.
    const firstSat = new Date("2026-06-06T05:00:00Z");
    expect(isFirstSaturdayOfMonthBRT(firstSat)).toBe(true);
    expect(shouldWeeklyYieldToMonthly(firstSat)).toBe(true);
  });

  it("segundo sábado do mês NÃO é primeiro", () => {
    const secondSat = new Date("2026-06-13T05:00:00Z");
    expect(isFirstSaturdayOfMonthBRT(secondSat)).toBe(false);
  });
});
