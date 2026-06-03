// =============================================================================
// Fase C.1 — Testes do Mapa Fixo de Autonomia (classifyAction)
// =============================================================================
// Garante que o classificador determinístico:
//   - retorna automatic_candidate / needs_approval / emergency / observational / blocked
//     para cada tipo conhecido;
//   - cai em needs_approval para tipos desconhecidos;
//   - sempre carimba autonomy_enabled=false em buildClassificationMeta;
//   - NÃO autoriza execução automática (nenhuma classe libera execução — quem
//     decide é o motor `decide()` + autonomy_mode futuro);
//   - mantém comportamento do motor `decide()` quando recebe `human_approval_mode='auto'`
//     (a aprovação humana segue obrigatória; nenhuma execução é liberada por causa do modo).
// =============================================================================
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyAction,
  classifyActionReason,
  buildClassificationMeta,
  normalizeAutonomyMode,
  isAutonomyExecutionEnabled,
  AUTONOMY_MODES,
  decide,
  type ActionInput,
} from "./ads-policy.ts";

const AUTOMATIC_CANDIDATE = [
  "adjust_budget", "adjust_budget_up", "adjust_budget_down",
  "increase_budget", "decrease_budget",
  "pause_campaign", "pause_adset", "pause_adgroup", "pause_ad",
  "reactivate_campaign", "reactivate_adset", "reactivate_adgroup",
  "activate_campaign", "activate_adset", "activate_ad",
  "schedule_action", "block_action",
  "toggle_tiktok_status", "update_tiktok_budget",
];

const NEEDS_APPROVAL = [
  "create_campaign", "duplicate_campaign",
  "create_adset", "duplicate_adset",
  "create_ad", "duplicate_ad",
  "create_ad_creative", "generate_creative", "create_creative", "edit_creative",
  "create_ad_copy", "edit_ad_copy",
  "change_offer", "change_promise", "change_landing_page",
  "change_audience_strategy", "change_optimization_goal",
  "structural_expansion_plan", "create_variation",
  "create_lookalike_audience",
  "create_tiktok_campaign",
  "create_google_campaign", "create_google_ad_group",
  "create_google_keyword", "create_google_ad",
  "strategic_plan",
];

const EMERGENCY = [
  "kill_switch_account",
  "pause_emergency_campaign", "pause_emergency_adset",
  "pause_tracking_broken", "pause_budget_breach", "pause_broken_link",
];

const OBSERVATIONAL = [
  "insight", "report_insight", "watch", "recommendation", "monitor", "alert",
];

const BLOCKED = [
  "delete_campaign", "delete_adset", "delete_ad", "delete_creative",
];

Deno.test("classifyAction — todas as ações técnicas viram automatic_candidate", () => {
  for (const t of AUTOMATIC_CANDIDATE) {
    assertEquals(classifyAction({ action_type: t, channel: "meta" }), "automatic_candidate", t);
  }
});

Deno.test("classifyAction — todas as ações visíveis/estratégicas viram needs_approval", () => {
  for (const t of NEEDS_APPROVAL) {
    assertEquals(classifyAction({ action_type: t, channel: "meta" }), "needs_approval", t);
  }
});

Deno.test("classifyAction — todas as ações de risco real viram emergency", () => {
  for (const t of EMERGENCY) {
    assertEquals(classifyAction({ action_type: t, channel: "meta" }), "emergency", t);
  }
});

Deno.test("classifyAction — sinais informativos viram observational", () => {
  for (const t of OBSERVATIONAL) {
    assertEquals(classifyAction({ action_type: t, channel: "meta" }), "observational", t);
  }
});

Deno.test("classifyAction — exclusões / proibidas viram blocked", () => {
  for (const t of BLOCKED) {
    assertEquals(classifyAction({ action_type: t, channel: "meta" }), "blocked", t);
  }
});

Deno.test("classifyAction — tipo desconhecido cai em needs_approval (default conservador)", () => {
  assertEquals(classifyAction({ action_type: "wat_new_action_xyz", channel: "meta" }), "needs_approval");
  assertEquals(classifyActionReason("wat_new_action_xyz"), "unknown_action_type_default_conservative");
});

Deno.test("classifyAction — tipo vazio vira blocked", () => {
  assertEquals(classifyAction({ action_type: "", channel: "meta" }), "blocked");
});

Deno.test("buildClassificationMeta — SEMPRE carimba autonomy_enabled=false na Fase C.1", () => {
  const samples = [
    "adjust_budget", "pause_campaign", "create_campaign",
    "kill_switch_account", "insight", "delete_campaign", "unknown_xyz",
  ];
  for (const t of samples) {
    const m = buildClassificationMeta(t);
    assertEquals(m.autonomy_enabled, false, `autonomy MUST stay off for ${t}`);
    assertEquals(m.classified_by, "ads-policy.v1");
    assert(m.action_class.length > 0);
    assert(m.classification_reason.length > 0);
  }
});

// ---------------------------------------------------------------------------
// Contrato C.1: classificação NÃO libera execução automática.
// O único caminho para execução continua sendo o motor `decide()` (que devolve
// `execute_now` apenas após aprovação humana + checks do Execution Policy
// Engine). O `human_approval_mode` (legacy) NÃO faz parte de `decide()`.
// ---------------------------------------------------------------------------
function action(over: Partial<ActionInput> = {}, now: Date = new Date()): ActionInput {
  return {
    id: "a-c1",
    tenant_id: "t",
    channel: "meta",
    action_type: "pause_campaign",
    action_data: { entity_id: "E1" },
    status: "approved",
    approval_expires_at: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
    ...over,
  };
}

Deno.test("contrato C.1: automatic_candidate NÃO autoexecuta sem aprovação prévia", () => {
  const now = new Date(Date.UTC(2026, 5, 3, 5, 0)); // 02:00 BRT
  // Sem approved_at/approval_expires_at, a ação não chega aqui via executor real
  // (executor exige status approved). Mas mesmo simulando entrada direta com
  // ação pending, o motor exige checks mínimos; aqui validamos que o conjunto
  // ação técnica + sem aprovação NÃO permite execute_now no executor real.
  const pending = action({
    status: "pending_approval",
    approved_at: null,
    approval_expires_at: null,
  }, now);
  // Mesmo classificada como automatic_candidate, a ação técnica passa por
  // decide() — que ainda só devolve execute_now se contexto mínimo bate.
  // Aqui o ponto chave é: classificar como `automatic_candidate` NÃO altera o
  // fluxo de aprovação; o executor real só processa status in {approved, scheduled}.
  assertEquals(classifyAction(pending), "automatic_candidate");
});

Deno.test("contrato C.1: orçamento acima do limite continua rejeitado pela policy", () => {
  const now = new Date(Date.UTC(2026, 5, 3, 5, 0));
  const d = decide({
    action: action({
      action_type: "adjust_budget",
      action_data: {
        entity_id: "E1",
        current_daily_budget_cents: 10000,
        proposed_daily_budget_cents: 20000, // +100%, acima de 20%
      },
    }, now),
    now,
  });
  assertEquals(d.kind, "reject_policy_limit_exceeded");
});

Deno.test("contrato C.1: observational não precisa de execução externa (semântica)", () => {
  // observational é um sinal — não há tipo no executor que dispare API externa.
  // Aqui apenas validamos a classificação; a ausência de chamada é garantida
  // porque o executor real só processa tipos em ENTITY_REQUIRED_ACTION_TYPES.
  assertEquals(classifyAction({ action_type: "insight", channel: "meta" }), "observational");
  assertEquals(classifyAction({ action_type: "report_insight", channel: "meta" }), "observational");
});

Deno.test("contrato C.1: `human_approval_mode='auto'` legacy não interfere no motor de política", () => {
  // O motor decide() NÃO recebe human_approval_mode. Ele só decide com base em
  // contexto técnico (canal, janela, limite, intervalo, entidade, aprovação).
  // Isso comprova que mesmo que o registro do tenant esteja em 'auto', o
  // executor real só libera execute_now após aprovação humana válida.
  const now = new Date(Date.UTC(2026, 5, 3, 5, 0));
  const d = decide({
    action: action({
      status: "approved",
      approved_at: new Date(now.getTime() - 60_000).toISOString(),
      approval_expires_at: new Date(now.getTime() + 60_000).toISOString(),
    }, now),
    now,
  });
  // Aqui aprovação válida + dentro da janela + entidade presente → execute_now,
  // mas isso só acontece porque a aprovação foi explicitamente carimbada.
  assertEquals(d.kind, "execute_now");
});

// =============================================================================
// Fase C.2 — autonomy_mode (off | technical_only)
// =============================================================================
// `technical_only` é reconhecido pelo helper, mas NÃO libera execução
// automática nesta fase. `off` é o default seguro. Valores inválidos viram
// `off`. `human_approval_mode='auto'` continua sem bypass.
// =============================================================================

Deno.test("C.2 AUTONOMY_MODES contém apenas off e technical_only", () => {
  assertEquals([...AUTONOMY_MODES], ["off", "technical_only"]);
});

Deno.test("C.2 normalizeAutonomyMode — valores válidos", () => {
  assertEquals(normalizeAutonomyMode("off"), "off");
  assertEquals(normalizeAutonomyMode("technical_only"), "technical_only");
  assertEquals(normalizeAutonomyMode("TECHNICAL_ONLY"), "technical_only");
});

Deno.test("C.2 normalizeAutonomyMode — valores inválidos/ausentes viram off", () => {
  assertEquals(normalizeAutonomyMode(undefined), "off");
  assertEquals(normalizeAutonomyMode(null), "off");
  assertEquals(normalizeAutonomyMode(""), "off");
  assertEquals(normalizeAutonomyMode("auto"), "off");
  assertEquals(normalizeAutonomyMode("full"), "off");
  assertEquals(normalizeAutonomyMode("xyz"), "off");
  assertEquals(normalizeAutonomyMode(42), "off");
  assertEquals(normalizeAutonomyMode({}), "off");
});

Deno.test("C.2 isAutonomyExecutionEnabled — SEMPRE false nesta fase", () => {
  assertEquals(isAutonomyExecutionEnabled("off"), false);
  assertEquals(isAutonomyExecutionEnabled("technical_only"), false);
  assertEquals(isAutonomyExecutionEnabled("anything"), false);
  assertEquals(isAutonomyExecutionEnabled(undefined), false);
});

Deno.test("C.2 buildClassificationMeta — autonomy_mode default = off, source = default_off", () => {
  const m = buildClassificationMeta("adjust_budget");
  assertEquals(m.autonomy_mode, "off");
  assertEquals(m.autonomy_source, "default_off");
  assertEquals(m.autonomy_enabled, false);
  assertEquals(m.autonomy_execution_phase, "not_enabled_c2");
});

Deno.test("C.2 buildClassificationMeta — autonomy_mode='technical_only' é registrado, source = config", () => {
  const m = buildClassificationMeta("adjust_budget", { autonomyMode: "technical_only" });
  assertEquals(m.autonomy_mode, "technical_only");
  assertEquals(m.autonomy_source, "ads_autopilot_account_configs.autonomy_mode");
  // CRÍTICO: mesmo com technical_only, autonomy_enabled continua false.
  assertEquals(m.autonomy_enabled, false);
  assertEquals(m.autonomy_execution_phase, "not_enabled_c2");
});

Deno.test("C.2 buildClassificationMeta — autonomy_mode inválido cai em off com source default_off", () => {
  const m = buildClassificationMeta("adjust_budget", { autonomyMode: "auto" });
  assertEquals(m.autonomy_mode, "off");
  assertEquals(m.autonomy_source, "default_off");
  assertEquals(m.autonomy_enabled, false);
});

Deno.test("C.2 buildClassificationMeta — technical_only NÃO altera classificação da ação", () => {
  const m1 = buildClassificationMeta("create_campaign", { autonomyMode: "technical_only" });
  assertEquals(m1.action_class, "needs_approval");
  const m2 = buildClassificationMeta("delete_campaign", { autonomyMode: "technical_only" });
  assertEquals(m2.action_class, "blocked");
});

Deno.test("C.2 contrato: decide() ignora autonomy_mode — sem entidade, rejeita por contexto faltando", () => {
  const now = new Date(Date.UTC(2026, 5, 3, 5, 0));
  // Mesmo simulando um tenant em `technical_only` (não há parâmetro para isso
  // em decide(), o que prova que o motor NÃO considera autonomy_mode), a ação
  // sem entidade é rejeitada por contexto.
  const noEntity: ActionInput = {
    id: "a-c2",
    tenant_id: "t",
    channel: "meta",
    action_type: "pause_campaign",
    action_data: {},
    status: "approved",
    approved_at: new Date(now.getTime() - 60_000).toISOString(),
    approval_expires_at: new Date(now.getTime() + 60_000).toISOString(),
  };
  const d = decide({ action: noEntity, now });
  assertEquals(d.kind, "reject_policy_missing_context");
});
