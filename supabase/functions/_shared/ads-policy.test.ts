// =============================================================================
// Testes unitários do Execution Policy Engine (Fase B.1)
// Rodar: deno test supabase/functions/_shared/ads-policy.test.ts
// =============================================================================
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  PLATFORM_LIMITS,
  POLICY_ENGINE_VERSION,
  buildIdempotencyKey,
  canChangeBudget,
  decide,
  getNextSafeWindow,
  isApprovalStillValid,
  isInsideSafeWindow,
  type ActionInput,
} from "./ads-policy.ts";

// Helper: monta um Date UTC a partir de hora BRT (UTC-3)
function brtToUtc(year: number, month: number, day: number, hourBrt: number, minBrt = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hourBrt + 3, minBrt, 0));
}

// ============================================================================
// PLATFORM_LIMITS
// ============================================================================
Deno.test("PLATFORM_LIMITS — valores oficiais", () => {
  assertEquals(PLATFORM_LIMITS.meta.maxBudgetChangePct, 0.20);
  assertEquals(PLATFORM_LIMITS.meta.minBudgetIntervalHours, 72);
  assertEquals(PLATFORM_LIMITS.google.maxBudgetChangePct, 0.20);
  assertEquals(PLATFORM_LIMITS.google.minBudgetIntervalHours, 168);
  assertEquals(PLATFORM_LIMITS.tiktok.maxBudgetChangePct, 0.15);
  assertEquals(PLATFORM_LIMITS.tiktok.minBudgetIntervalHours, 48);
});

// ============================================================================
// getNextSafeWindow / isInsideSafeWindow — bordas 00:01 e 04:00 BRT
// ============================================================================
Deno.test("isInsideSafeWindow — antes da janela (23:30 BRT)", () => {
  const now = brtToUtc(2026, 6, 2, 23, 30);
  assertEquals(isInsideSafeWindow(now), false);
});

Deno.test("isInsideSafeWindow — borda 00:01 BRT inclusiva", () => {
  const now = brtToUtc(2026, 6, 3, 0, 1);
  assertEquals(isInsideSafeWindow(now), true);
});

Deno.test("isInsideSafeWindow — dentro (02:00 BRT)", () => {
  const now = brtToUtc(2026, 6, 3, 2, 0);
  assertEquals(isInsideSafeWindow(now), true);
});

Deno.test("isInsideSafeWindow — borda 04:00 BRT exclusiva", () => {
  const now = brtToUtc(2026, 6, 3, 4, 0);
  assertEquals(isInsideSafeWindow(now), false);
});

Deno.test("getNextSafeWindow — antes da janela (23:30 BRT) → próximo 00:01 BRT do dia seguinte UTC", () => {
  const now = brtToUtc(2026, 6, 2, 23, 30);
  const next = getNextSafeWindow(now);
  assert(next.getTime() > now.getTime());
  // Espera 00:01 BRT = 03:01 UTC
  assertEquals(next.getUTCHours(), 3);
  assertEquals(next.getUTCMinutes(), 1);
});

Deno.test("getNextSafeWindow — dentro da janela retorna now", () => {
  const now = brtToUtc(2026, 6, 3, 2, 0);
  const next = getNextSafeWindow(now);
  assertEquals(next.getTime(), now.getTime());
});

Deno.test("getNextSafeWindow — depois da janela (10:00 BRT) → próximo 00:01 BRT amanhã", () => {
  const now = brtToUtc(2026, 6, 3, 10, 0);
  const next = getNextSafeWindow(now);
  assertEquals(next.getUTCHours(), 3);
  assertEquals(next.getUTCMinutes(), 1);
  // Deve ser no dia 4 UTC
  assertEquals(next.getUTCDate(), 4);
});

// ============================================================================
// canChangeBudget — limites por plataforma
// ============================================================================
Deno.test("canChangeBudget — Meta acima de 20% rejeitado", () => {
  const r = canChangeBudget({ channel: "meta", currentCents: 10000, proposedCents: 13000 });
  assertEquals(r.ok, false);
  assertEquals(r.reason, "limit_exceeded");
});

Deno.test("canChangeBudget — Meta exatamente 20% permitido", () => {
  const r = canChangeBudget({ channel: "meta", currentCents: 10000, proposedCents: 12000 });
  assertEquals(r.ok, true);
});

Deno.test("canChangeBudget — Google acima de 20% rejeitado", () => {
  const r = canChangeBudget({ channel: "google", currentCents: 10000, proposedCents: 12500 });
  assertEquals(r.ok, false);
  assertEquals(r.reason, "limit_exceeded");
});

Deno.test("canChangeBudget — TikTok acima de 15% rejeitado", () => {
  const r = canChangeBudget({ channel: "tiktok", currentCents: 10000, proposedCents: 11600 });
  assertEquals(r.ok, false);
  assertEquals(r.reason, "limit_exceeded");
});

Deno.test("canChangeBudget — TikTok exatamente 15% permitido", () => {
  const r = canChangeBudget({ channel: "tiktok", currentCents: 10000, proposedCents: 11500 });
  assertEquals(r.ok, true);
});

Deno.test("canChangeBudget — intervalo não vencido (Meta 24h < 72h)", () => {
  const now = new Date("2026-06-02T12:00:00Z");
  const lastChange = new Date("2026-06-01T12:00:00Z").toISOString();
  const r = canChangeBudget({
    channel: "meta", currentCents: 10000, proposedCents: 11000,
    lastChangeAt: lastChange, now,
  });
  assertEquals(r.ok, false);
  assertEquals(r.reason, "interval_too_short");
});

Deno.test("canChangeBudget — intervalo vencido (Meta 80h > 72h)", () => {
  const now = new Date("2026-06-05T12:00:00Z");
  const lastChange = new Date("2026-06-02T04:00:00Z").toISOString();
  const r = canChangeBudget({
    channel: "meta", currentCents: 10000, proposedCents: 11000,
    lastChangeAt: lastChange, now,
  });
  assertEquals(r.ok, true);
});

Deno.test("canChangeBudget — contexto ausente", () => {
  const r = canChangeBudget({ channel: "meta", currentCents: null, proposedCents: 1000 });
  assertEquals(r.ok, false);
  assertEquals(r.reason, "missing_budget_context");
});

// ============================================================================
// isApprovalStillValid
// ============================================================================
Deno.test("isApprovalStillValid — válida (futuro)", () => {
  const now = new Date("2026-06-02T12:00:00Z");
  const expires = new Date("2026-06-02T20:00:00Z").toISOString();
  assertEquals(isApprovalStillValid({ approval_expires_at: expires, now }), true);
});

Deno.test("isApprovalStillValid — expirada (passado)", () => {
  const now = new Date("2026-06-02T12:00:00Z");
  const expires = new Date("2026-06-02T10:00:00Z").toISOString();
  assertEquals(isApprovalStillValid({ approval_expires_at: expires, now }), false);
});

Deno.test("isApprovalStillValid — sem contexto, sem approved_at → inválida", () => {
  assertEquals(isApprovalStillValid({ now: new Date() }), false);
});

// ============================================================================
// buildIdempotencyKey
// ============================================================================
function actionFixture(over: Partial<ActionInput> = {}): ActionInput {
  return {
    id: "a1",
    tenant_id: "t1",
    channel: "meta",
    action_type: "pause_campaign",
    action_data: {},
    status: "approved",
    ...over,
  };
}

Deno.test("buildIdempotencyKey — entity_id presente", () => {
  const k = buildIdempotencyKey(
    actionFixture({ action_data: { entity_id: "E123" } }),
    brtToUtc(2026, 6, 2, 12, 0),
  );
  assertEquals(k, "t1:meta:pause_campaign:E123:2026-06-02");
});

Deno.test("buildIdempotencyKey — fallback campaign_id", () => {
  const k = buildIdempotencyKey(
    actionFixture({ action_data: { campaign_id: "C9" } }),
    brtToUtc(2026, 6, 2, 12, 0),
  );
  assertEquals(k, "t1:meta:pause_campaign:C9:2026-06-02");
});

Deno.test("buildIdempotencyKey — fallback meta_campaign_id", () => {
  const k = buildIdempotencyKey(
    actionFixture({ action_data: { meta_campaign_id: "M7" } }),
    brtToUtc(2026, 6, 2, 12, 0),
  );
  assertEquals(k, "t1:meta:pause_campaign:M7:2026-06-02");
});

Deno.test("buildIdempotencyKey — fallback global sem entidade", () => {
  const k = buildIdempotencyKey(actionFixture(), brtToUtc(2026, 6, 2, 12, 0));
  assertEquals(k, "t1:meta:pause_campaign:global:2026-06-02");
});

// ============================================================================
// decide — cenários principais
// ============================================================================
Deno.test("decide — ação estrutural fora da janela → schedule", () => {
  const now = brtToUtc(2026, 6, 3, 10, 0);
  const d = decide({
    action: actionFixture({
      action_type: "create_campaign",
      action_data: { entity_id: "X" },
    }),
    now,
  });
  assertEquals(d.kind, "schedule");
});

Deno.test("decide — orçamento acima do limite → reject_policy_limit_exceeded", () => {
  const d = decide({
    action: actionFixture({
      action_type: "adjust_budget",
      action_data: {
        entity_id: "E1",
        current_daily_budget_cents: 10000,
        proposed_daily_budget_cents: 15000, // +50% > 20% Meta
      },
    }),
    now: brtToUtc(2026, 6, 3, 2, 0), // dentro da janela
  });
  assertEquals(d.kind, "reject_policy_limit_exceeded");
});

Deno.test("decide — contexto ausente (sem entity_id em pause_campaign) → reject_policy_missing_context", () => {
  const d = decide({
    action: actionFixture({ action_type: "pause_campaign", action_data: {} }),
    now: brtToUtc(2026, 6, 3, 2, 0),
  });
  assertEquals(d.kind, "reject_policy_missing_context");
});

Deno.test("decide — aprovação expirada → expired_approval", () => {
  const now = brtToUtc(2026, 6, 3, 2, 0);
  const d = decide({
    action: actionFixture({
      action_type: "pause_campaign",
      action_data: { entity_id: "E1" },
      approval_expires_at: new Date(now.getTime() - 3600 * 1000).toISOString(),
    }),
    now,
  });
  assertEquals(d.kind, "expired_approval");
});

Deno.test("decide — canal desconhecido → reject_policy_missing_context", () => {
  const d = decide({
    action: actionFixture({ channel: "snapchat" as any, action_data: { entity_id: "E" } }),
    now: brtToUtc(2026, 6, 3, 2, 0),
  });
  assertEquals(d.kind, "reject_policy_missing_context");
});

Deno.test("decide — pause válido dentro da janela → execute_now", () => {
  const d = decide({
    action: actionFixture({
      action_type: "pause_campaign",
      action_data: { entity_id: "E1" },
      approval_expires_at: new Date(Date.now() + 3600 * 1000).toISOString(),
    }),
    now: brtToUtc(2026, 6, 3, 2, 0),
  });
  assertEquals(d.kind, "execute_now");
});

Deno.test("POLICY_ENGINE_VERSION estável", () => {
  assertEquals(POLICY_ENGINE_VERSION, "v1");
});
