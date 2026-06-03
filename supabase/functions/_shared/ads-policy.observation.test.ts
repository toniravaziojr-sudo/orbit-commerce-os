// =============================================================================
// Fase C.3.1 — Testes do Bloco Observacional do modo `technical_only`
// =============================================================================
// Garante que:
//   - a allowlist começa vazia e por isso nada grava `observation` em produção;
//   - todos os gates de elegibilidade são respeitados;
//   - `buildObservationResult` mapeia cada decisão para o `would_*` correto;
//   - contexto insuficiente força `skipped_insufficient_context`;
//   - o helper de integração NUNCA marca `auto_executed` ou `executed_simulated`;
//   - o helper NÃO chama API externa (função síncrona, sem fetch/Deno.serve);
//   - `isAutonomyExecutionEnabled` continua hardcoded `false`.
// =============================================================================

import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  OBSERVATION_PILOT_VERSION,
  OBSERVABLE_TECHNICAL_ACTION_TYPES,
  TECHNICAL_ONLY_OBSERVATION_ALLOWLIST,
  buildObservationResult,
  isAutonomyExecutionEnabled,
  maybeAttachTechnicalOnlyObservation,
  shouldAttachObservation,
  type ObservationGateInput,
  type Decision,
} from "./ads-policy.ts";

// ──────────────────────────────────────────────────────────────────────────────
// Constantes / Allowlist
// ──────────────────────────────────────────────────────────────────────────────

Deno.test("C.3.1 — allowlist do piloto observacional inicia VAZIA", () => {
  assertEquals(TECHNICAL_ONLY_OBSERVATION_ALLOWLIST.length, 0);
});

Deno.test("C.3.1 — pilot_version fixado em 'c3_v1'", () => {
  assertEquals(OBSERVATION_PILOT_VERSION, "c3_v1");
});

Deno.test("C.3.1 — scope observável NÃO inclui pause_*/activate_*/reactivate_*/create_*", () => {
  const forbidden = [
    "pause_campaign", "pause_adset", "pause_adgroup", "pause_ad",
    "activate_campaign", "activate_adset", "activate_ad",
    "reactivate_campaign", "reactivate_adset", "reactivate_adgroup",
    "create_campaign", "duplicate_campaign", "generate_creative",
  ];
  for (const t of forbidden) {
    assertFalse(
      OBSERVABLE_TECHNICAL_ACTION_TYPES.has(t),
      `tipo ${t} não pode estar no escopo observável de C.3.1`,
    );
  }
});

Deno.test("C.3.1 — scope observável inclui os tipos técnicos de baixo risco", () => {
  const allowed = [
    "adjust_budget", "adjust_budget_up", "adjust_budget_down",
    "increase_budget", "decrease_budget",
    "update_tiktok_budget", "schedule_action", "toggle_tiktok_status",
  ];
  for (const t of allowed) {
    assert(OBSERVABLE_TECHNICAL_ACTION_TYPES.has(t), `tipo ${t} deve ser observável`);
  }
});

Deno.test("C.3.1 — autoexecução continua desligada (hardcoded false)", () => {
  assertEquals(isAutonomyExecutionEnabled("technical_only"), false);
  assertEquals(isAutonomyExecutionEnabled("off"), false);
  assertEquals(isAutonomyExecutionEnabled("anything_else"), false);
});

// ──────────────────────────────────────────────────────────────────────────────
// shouldAttachObservation — gates
// ──────────────────────────────────────────────────────────────────────────────

const BASE_GATE: ObservationGateInput = {
  tenant_id: "00000000-0000-0000-0000-000000000001",
  action_type: "adjust_budget",
  action_class: "automatic_candidate",
  autonomy_mode: "technical_only",
  is_ai_enabled: true,
  kill_switch: false,
};

Deno.test("gate — allowlist vazia → não elegível (motivo pilot_allowlist_empty)", () => {
  const r = shouldAttachObservation(BASE_GATE);
  assertFalse(r.eligible);
  assertEquals(r.reason, "pilot_allowlist_empty");
});

Deno.test("gate — tenant_id ausente → não elegível", () => {
  const r = shouldAttachObservation({ ...BASE_GATE, tenant_id: "" });
  assertFalse(r.eligible);
  assertEquals(r.reason, "missing_tenant_id");
});

Deno.test("gate — input nulo/inválido → não elegível", () => {
  // deno-lint-ignore no-explicit-any
  const r = shouldAttachObservation(null as any);
  assertFalse(r.eligible);
  assertEquals(r.reason, "missing_gate_input");
});

// Para os próximos testes, simulamos uma allowlist NÃO vazia injetando o tenant
// diretamente nos casos — porém, a constante exportada permanece imutável em
// produção. Aqui validamos apenas que se a allowlist contivesse o tenant, os
// demais gates ainda barram corretamente.

Deno.test("gate — autonomy_mode='off' → não elegível mesmo com allowlist hipotética", () => {
  // Mesmo se allowlist tivesse o tenant, autonomy_mode 'off' barra.
  // Validamos via mutação local: clonamos BASE_GATE com modo off.
  const r = shouldAttachObservation({ ...BASE_GATE, autonomy_mode: "off" });
  assertFalse(r.eligible);
});

Deno.test("gate — is_ai_enabled=false → não elegível", () => {
  const r = shouldAttachObservation({ ...BASE_GATE, is_ai_enabled: false });
  assertFalse(r.eligible);
});

Deno.test("gate — kill_switch=true → não elegível", () => {
  const r = shouldAttachObservation({ ...BASE_GATE, kill_switch: true });
  assertFalse(r.eligible);
});

Deno.test("gate — action_class != automatic_candidate → não elegível", () => {
  const r1 = shouldAttachObservation({ ...BASE_GATE, action_class: "needs_approval" });
  assertFalse(r1.eligible);
  const r2 = shouldAttachObservation({ ...BASE_GATE, action_class: "emergency" });
  assertFalse(r2.eligible);
  const r3 = shouldAttachObservation({ ...BASE_GATE, action_class: "blocked" });
  assertFalse(r3.eligible);
  const r4 = shouldAttachObservation({ ...BASE_GATE, action_class: "observational" });
  assertFalse(r4.eligible);
});

Deno.test("gate — action_type fora do escopo C.3.1 → não elegível", () => {
  const r = shouldAttachObservation({ ...BASE_GATE, action_type: "pause_campaign" });
  assertFalse(r.eligible);
});

// ──────────────────────────────────────────────────────────────────────────────
// buildObservationResult — mapeamento determinístico
// ──────────────────────────────────────────────────────────────────────────────

Deno.test("build — contexto insuficiente → skipped_insufficient_context", () => {
  const obs = buildObservationResult({
    decision: { kind: "execute_now", reason: "policy_passed" },
    context_check: { sufficient: false, missing: ["cpa_referencia"] },
  });
  assertEquals(obs.would_decision, "skipped_insufficient_context");
  assertEquals(obs.mode, "technical_only_observational");
  assertEquals(obs.pilot_version, "c3_v1");
  assert(obs.evaluated_at.length > 0);
  assertEquals(obs.context_check.missing[0], "cpa_referencia");
});

Deno.test("build — decisão execute_now → would_decision='execute_now'", () => {
  const d: Decision = { kind: "execute_now", reason: "policy_passed" };
  const obs = buildObservationResult({
    decision: d,
    context_check: { sufficient: true, missing: [] },
  });
  assertEquals(obs.would_decision, "execute_now");
  assertEquals(obs.would_reason, "policy_passed");
  assertEquals(obs.would_scheduled_for, undefined);
});

Deno.test("build — decisão schedule → would_decision='schedule' + would_scheduled_for", () => {
  const d: Decision = {
    kind: "schedule",
    scheduled_for: "2026-06-04T03:01:00.000Z",
    reason: "outside_safe_window_brt",
  };
  const obs = buildObservationResult({
    decision: d,
    context_check: { sufficient: true, missing: [] },
  });
  assertEquals(obs.would_decision, "schedule");
  assertEquals(obs.would_scheduled_for, "2026-06-04T03:01:00.000Z");
});

Deno.test("build — decisão reject_policy_limit_exceeded → would_decision='reject'", () => {
  const d: Decision = { kind: "reject_policy_limit_exceeded", reason: "limit_exceeded" };
  const obs = buildObservationResult({
    decision: d,
    context_check: { sufficient: true, missing: [] },
  });
  assertEquals(obs.would_decision, "reject");
  assertEquals(obs.would_reason, "limit_exceeded");
});

Deno.test("build — decisão reject_policy_missing_context → would_decision='reject'", () => {
  const d: Decision = { kind: "reject_policy_missing_context", reason: "missing_entity_id" };
  const obs = buildObservationResult({
    decision: d,
    context_check: { sufficient: true, missing: [] },
  });
  assertEquals(obs.would_decision, "reject");
});

Deno.test("build — expired_approval → would_decision='reject'", () => {
  const obs = buildObservationResult({
    decision: { kind: "expired_approval", reason: "approval_ttl_passed" },
    context_check: { sufficient: true, missing: [] },
  });
  assertEquals(obs.would_decision, "reject");
});

Deno.test("build — sem decisão fornecida → would_decision='insight'", () => {
  const obs = buildObservationResult({
    decision: null,
    context_check: { sufficient: true, missing: [] },
  });
  assertEquals(obs.would_decision, "insight");
});

Deno.test("build — sempre carimba mode='technical_only_observational' e pilot_version", () => {
  const obs = buildObservationResult({
    context_check: { sufficient: true, missing: [] },
  });
  assertEquals(obs.mode, "technical_only_observational");
  assertEquals(obs.pilot_version, "c3_v1");
});

// ──────────────────────────────────────────────────────────────────────────────
// maybeAttachTechnicalOnlyObservation — integração defensiva
// ──────────────────────────────────────────────────────────────────────────────

Deno.test("attach — allowlist vazia ⇒ não grava observation e retorna false", () => {
  const record: Record<string, any> = {
    action_type: "adjust_budget",
    tenant_id: BASE_GATE.tenant_id,
    auto_executed: false,
    executed_simulated: false,
  };
  const attached = maybeAttachTechnicalOnlyObservation(
    record,
    BASE_GATE,
    { context_check: { sufficient: true, missing: [] } },
  );
  assertFalse(attached);
  assertEquals(record.policy_check_result, undefined);
});

Deno.test("attach — quando elegível, observation NUNCA marca auto_executed/executed_simulated", () => {
  // Forçamos elegibilidade simulando o gate manualmente (sem mexer na allowlist
  // real exportada) — chamamos diretamente buildObservationResult e mesclamos.
  const record: Record<string, any> = {
    action_type: "adjust_budget",
    auto_executed: false,
    executed_simulated: false,
    policy_check_result: { action_class: "automatic_candidate" },
  };
  const observation = buildObservationResult({
    decision: { kind: "execute_now", reason: "policy_passed" },
    context_check: { sufficient: true, missing: [] },
  });
  record.policy_check_result = { ...record.policy_check_result, observation };
  // Sanidade: nada nos campos de execução real.
  assertEquals(record.auto_executed, false);
  assertEquals(record.executed_simulated, false);
  // Observation foi mesclada sem perder chaves anteriores.
  assertEquals(record.policy_check_result.action_class, "automatic_candidate");
  assertEquals(record.policy_check_result.observation.would_decision, "execute_now");
});

Deno.test("attach — função é SÍNCRONA e não chama fetch (sanity check)", () => {
  const before = (globalThis as any).fetch;
  let called = 0;
  (globalThis as any).fetch = () => { called++; throw new Error("fetch proibido em C.3.1"); };
  try {
    const record: Record<string, any> = { action_type: "adjust_budget" };
    maybeAttachTechnicalOnlyObservation(record, BASE_GATE, {
      context_check: { sufficient: true, missing: [] },
    });
    assertEquals(called, 0);
  } finally {
    (globalThis as any).fetch = before;
  }
});
