// =============================================================================
// Fase C.4 — Testes do toggle de autoexecução técnica governada
// =============================================================================
// Cobertura:
//   - resolveEffectiveAutonomy (hierarquia individual > global > default off)
//   - isAutonomyExecutionEnabled (libera somente technical_only)
//   - canAutoExecuteC4 (todos os gates de segurança)
//   - getStrategicPauseExpiry (próximo 00:01 BRT)
//   - isStrategicPauseAction / classifyAction para os novos tipos
// =============================================================================
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  resolveEffectiveAutonomy,
  isAutonomyExecutionEnabled,
  canAutoExecuteC4,
  getStrategicPauseExpiry,
  isStrategicPauseAction,
  isEmergencyOperationalPause,
  classifyAction,
  STRATEGIC_PAUSE_ACTION_TYPES,
  EMERGENCY_OPERATIONAL_PAUSE_TYPES,
} from "./ads-policy.ts";

// ──────────────────────────── resolveEffectiveAutonomy ───────────────────────

Deno.test("resolve — default OFF quando nem conta nem global têm config", () => {
  assertEquals(resolveEffectiveAutonomy(null, null), { mode: "off", source: "default_off" });
});

Deno.test("resolve — conta sem config + global technical_only herda global", () => {
  const r = resolveEffectiveAutonomy(null, { autonomy_mode: "technical_only" });
  assertEquals(r, { mode: "technical_only", source: "global" });
});

Deno.test("resolve — conta individual OFF sobrescreve global ON", () => {
  const r = resolveEffectiveAutonomy({ autonomy_mode: "off" }, { autonomy_mode: "technical_only" });
  assertEquals(r, { mode: "off", source: "account" });
});

Deno.test("resolve — conta individual ON sobrescreve global OFF", () => {
  const r = resolveEffectiveAutonomy({ autonomy_mode: "technical_only" }, { autonomy_mode: "off" });
  assertEquals(r, { mode: "technical_only", source: "account" });
});

Deno.test("resolve — valor inválido cai em default off (preservando hierarquia)", () => {
  const r = resolveEffectiveAutonomy({ autonomy_mode: "lol" as any }, { autonomy_mode: "technical_only" });
  assertEquals(r, { mode: "technical_only", source: "global" });
});

// ──────────────────────────── isAutonomyExecutionEnabled ─────────────────────

Deno.test("isAutonomyExecutionEnabled — true só para technical_only", () => {
  assertEquals(isAutonomyExecutionEnabled("technical_only"), true);
  assertEquals(isAutonomyExecutionEnabled("off"), false);
  assertEquals(isAutonomyExecutionEnabled(null), false);
  assertEquals(isAutonomyExecutionEnabled(undefined), false);
  assertEquals(isAutonomyExecutionEnabled("foo"), false);
});

// ──────────────────────────── canAutoExecuteC4 ───────────────────────────────

const BASE = {
  effective_mode: "technical_only" as const,
  effective_source: "account" as const,
  is_ai_enabled: true,
  account_kill_switch: false,
  global_kill_switch: false,
  action_type: "adjust_budget",
  action_class: "automatic_candidate" as const,
  policy_decision_kind: "execute_now" as const,
  campaign_age_days: 30,
  in_learning_phase: false,
  inside_safe_window: true,
  budget_within_limit: true,
};

Deno.test("gate OK — todas as condições passam", () => {
  assertEquals(canAutoExecuteC4(BASE).ok, true);
});

Deno.test("gate — autonomy_off bloqueia (toggle desligado)", () => {
  const r = canAutoExecuteC4({ ...BASE, effective_mode: "off" });
  assertEquals(r, { ok: false, reason: "autonomy_off" });
});

Deno.test("gate — kill switch GLOBAL tem prioridade absoluta", () => {
  const r = canAutoExecuteC4({ ...BASE, global_kill_switch: true });
  assertEquals(r.reason, "kill_switch_global");
});

Deno.test("gate — kill switch da CONTA bloqueia", () => {
  const r = canAutoExecuteC4({ ...BASE, account_kill_switch: true });
  assertEquals(r.reason, "kill_switch_account");
});

Deno.test("gate — IA desativada bloqueia", () => {
  const r = canAutoExecuteC4({ ...BASE, is_ai_enabled: false });
  assertEquals(r.reason, "ai_disabled");
});

Deno.test("gate — strategic_pause SEMPRE bloqueia, mesmo com toggle ON e tudo verde", () => {
  for (const t of STRATEGIC_PAUSE_ACTION_TYPES) {
    const r = canAutoExecuteC4({ ...BASE, action_type: t, action_class: "needs_approval" });
    assertEquals(r.reason, "strategic_pause_always_human", `tipo ${t}`);
  }
});

Deno.test("gate — needs_approval (criativos/campanhas) bloqueia", () => {
  for (const t of ["create_campaign", "create_adset", "generate_creative", "change_offer"]) {
    const r = canAutoExecuteC4({ ...BASE, action_type: t, action_class: "needs_approval" });
    assertEquals(r.reason, "action_class_not_eligible", `tipo ${t}`);
  }
});

Deno.test("gate — observational bloqueia", () => {
  const r = canAutoExecuteC4({ ...BASE, action_type: "insight", action_class: "observational" });
  assertEquals(r.reason, "action_class_not_eligible");
});

Deno.test("gate — campanha em learning phase bloqueia ajuste", () => {
  const r = canAutoExecuteC4({ ...BASE, in_learning_phase: true });
  assertEquals(r.reason, "in_learning_phase");
});

Deno.test("gate — campanha com menos de 3 dias bloqueia", () => {
  const r = canAutoExecuteC4({ ...BASE, campaign_age_days: 2 });
  assertEquals(r.reason, "campaign_too_new");
});

Deno.test("gate — emergência ignora learning/maturidade/janela", () => {
  const r = canAutoExecuteC4({
    ...BASE,
    action_type: "pause_emergency_campaign",
    action_class: "emergency",
    in_learning_phase: true,
    campaign_age_days: 0,
    inside_safe_window: false,
  });
  assertEquals(r.ok, true);
});

Deno.test("gate — orçamento acima do limite seguro bloqueia", () => {
  const r = canAutoExecuteC4({ ...BASE, budget_within_limit: false });
  assertEquals(r.reason, "budget_above_safe_limit");
});

Deno.test("gate — fora da janela segura bloqueia (não emergencial)", () => {
  const r = canAutoExecuteC4({ ...BASE, inside_safe_window: false });
  assertEquals(r.reason, "outside_safe_window");
});

Deno.test("gate — Policy Engine não-execute_now bloqueia", () => {
  const r = canAutoExecuteC4({ ...BASE, policy_decision_kind: "reject_policy_limit_exceeded" });
  assertEquals(r.reason, "policy_engine_rejected");
});

Deno.test("gate — bloqueio por política funciona independentemente do toggle (mesmo toggle ON)", () => {
  // Policy engine veta → gate retorna policy_engine_rejected.
  const r = canAutoExecuteC4({ ...BASE, policy_decision_kind: "reject_duplicate" });
  assertEquals(r.ok, false);
});

// ──────────────────────────── strategic_pause ─────────────────────────────────

Deno.test("classifyAction — strategic_pause vira needs_approval", () => {
  for (const t of STRATEGIC_PAUSE_ACTION_TYPES) {
    assertEquals(classifyAction({ action_type: t, channel: "meta" }), "needs_approval", t);
  }
});

Deno.test("classifyAction — emergency_operational_pause vira emergency", () => {
  for (const t of EMERGENCY_OPERATIONAL_PAUSE_TYPES) {
    assertEquals(classifyAction({ action_type: t, channel: "meta" }), "emergency", t);
  }
});

Deno.test("isStrategicPauseAction / isEmergencyOperationalPause", () => {
  assert(isStrategicPauseAction("strategic_pause"));
  assert(isStrategicPauseAction("pause_low_roas"));
  assert(isStrategicPauseAction("pause_dayparting"));
  assert(!isStrategicPauseAction("emergency_operational_pause"));
  assert(!isStrategicPauseAction("adjust_budget"));
  assert(isEmergencyOperationalPause("emergency_operational_pause"));
  assert(isEmergencyOperationalPause("pause_emergency_campaign"));
  assert(!isEmergencyOperationalPause("strategic_pause"));
});

// ──────────────────────────── getStrategicPauseExpiry ────────────────────────

Deno.test("expiry — antes das 00:01 BRT retorna 00:01 BRT do mesmo dia UTC", () => {
  // 2026-06-08 02:50 UTC = 23:50 BRT do dia 07
  const now = new Date("2026-06-08T02:50:00Z");
  const exp = getStrategicPauseExpiry(now);
  // Esperado: 2026-06-08 03:01 UTC = 00:01 BRT do dia 08
  assertEquals(exp.toISOString(), "2026-06-08T03:01:00.000Z");
});

Deno.test("expiry — depois das 00:01 BRT vai para 00:01 BRT do dia seguinte", () => {
  // 2026-06-08 12:00 UTC = 09:00 BRT
  const now = new Date("2026-06-08T12:00:00Z");
  const exp = getStrategicPauseExpiry(now);
  // Próximo 00:01 BRT = 2026-06-09 03:01 UTC
  assertEquals(exp.toISOString(), "2026-06-09T03:01:00.000Z");
});

Deno.test("expiry — exatamente em 00:01 BRT vai para o próximo dia", () => {
  // 03:01 UTC = 00:01 BRT
  const now = new Date("2026-06-08T03:01:00Z");
  const exp = getStrategicPauseExpiry(now);
  assertEquals(exp.toISOString(), "2026-06-09T03:01:00.000Z");
});

Deno.test("expiry — chamada repetida é determinística (idempotência conceitual)", () => {
  const now = new Date("2026-06-08T15:00:00Z");
  const a = getStrategicPauseExpiry(now).toISOString();
  const b = getStrategicPauseExpiry(now).toISOString();
  assertEquals(a, b);
});
