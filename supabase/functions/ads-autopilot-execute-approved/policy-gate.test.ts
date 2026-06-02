// =============================================================================
// Testes de contrato — garante que a Policy Engine bloqueia ações antes de
// qualquer chamada externa (Meta/Google/TikTok).
//
// Não chama APIs reais nem o edge real. Importa apenas o helper compartilhado
// e prova que para todas as decisões != execute_now o caller deve retornar
// imediatamente. Os testes do executor real ficam em ambiente sandbox.
// =============================================================================
import { assert, assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { decide, type ActionInput } from "../_shared/ads-policy.ts";

function action(over: Partial<ActionInput> = {}, now: Date = new Date()): ActionInput {
  return {
    id: "a1",
    tenant_id: "t1",
    channel: "meta",
    action_type: "pause_campaign",
    action_data: { entity_id: "E1" },
    status: "approved",
    approval_expires_at: new Date(now.getTime() + 24 * 3600 * 1000).toISOString(),
    ...over,
  };
}

// Simula o ramo do executor: se decision.kind != 'execute_now', NENHUMA
// chamada externa pode acontecer. Aqui modelamos isso com um spy.
function simulateExecutorBranch(decision: { kind: string }) {
  let externalCalls = 0;
  if (decision.kind === "execute_now") {
    externalCalls++; // representa a chamada externa real
  }
  return { externalCalls };
}

Deno.test("contrato: fora da janela (create_campaign) NÃO chama API externa", () => {
  // Hora UTC fora de 03:01–07:00 UTC (= 00:01–04:00 BRT)
  const now = new Date(Date.UTC(2026, 5, 3, 13, 0)); // 10:00 BRT
  const d = decide({ action: action({ action_type: "create_campaign" }), now });
  assertEquals(d.kind, "schedule");
  const r = simulateExecutorBranch(d);
  assertEquals(r.externalCalls, 0);
});

Deno.test("contrato: limite excedido NÃO chama API externa", () => {
  const d = decide({
    action: action({
      action_type: "adjust_budget",
      action_data: {
        entity_id: "E1",
        current_daily_budget_cents: 10000,
        proposed_daily_budget_cents: 20000,
      },
    }),
    now: new Date(Date.UTC(2026, 5, 3, 5, 0)), // 02:00 BRT
  });
  assertEquals(d.kind, "reject_policy_limit_exceeded");
  assertEquals(simulateExecutorBranch(d).externalCalls, 0);
});

Deno.test("contrato: contexto ausente NÃO chama API externa", () => {
  const d = decide({
    action: action({ action_type: "pause_campaign", action_data: {} }),
    now: new Date(Date.UTC(2026, 5, 3, 5, 0)),
  });
  assertEquals(d.kind, "reject_policy_missing_context");
  assertEquals(simulateExecutorBranch(d).externalCalls, 0);
});

Deno.test("contrato: aprovação expirada NÃO chama API externa", () => {
  const d = decide({
    action: action({
      approval_expires_at: new Date(Date.now() - 3600 * 1000).toISOString(),
    }),
    now: new Date(),
  });
  assertEquals(d.kind, "expired_approval");
  assertEquals(simulateExecutorBranch(d).externalCalls, 0);
});

Deno.test("contrato: decisão execute_now É a única que permite chamada externa", () => {
  const d = decide({
    action: action(),
    now: new Date(Date.UTC(2026, 5, 3, 5, 0)),
  });
  assertEquals(d.kind, "execute_now");
  assert(simulateExecutorBranch(d).externalCalls > 0);
});

Deno.test("contrato: nenhum branch != execute_now produz externalCalls", () => {
  const cases = [
    { kind: "schedule" },
    { kind: "reject_policy_limit_exceeded" },
    { kind: "reject_policy_missing_context" },
    { kind: "reject_duplicate" },
    { kind: "expired_approval" },
  ];
  for (const c of cases) {
    assertEquals(simulateExecutorBranch(c).externalCalls, 0, `branch ${c.kind}`);
  }
  assertNotEquals(simulateExecutorBranch({ kind: "execute_now" }).externalCalls, 0);
});
