// Testes do validador puro do contrato de feedback do Ads Autopilot (A.1).
// Estes testes NÃO tocam o banco — validam apenas o contrato de entrada.
//
// Garantias cobertas:
// - reason_codes é obrigatório quando o endpoint é chamado;
// - decision precisa estar entre os 4 estados oficiais;
// - diff só é aceito em edited_then_approved;
// - snapshot mínimo é exigido;
// - tenant_id precisa ser UUID válido;
// - user_confidence só aceita low|medium|high quando presente.

import { describe, it, expect } from "vitest";
import { validateFeedbackInput } from "@/lib/adsAutopilot/feedbackContract";

const VALID_TENANT = "d1a4d0ed-8842-495e-b741-540a9a345b25";

const baseValid = {
  tenant_id: VALID_TENANT,
  ads_platform: "meta",
  metrics_snapshot: { cpa_7d_cents: 5400, conv_7d: 23 },
  decision: "approved",
  reason_codes: ["good_budget_logic"],
};

describe("validateFeedbackInput — contrato A.1", () => {
  it("aceita payload válido de aprovação", () => {
    expect(validateFeedbackInput(baseValid).ok).toBe(true);
  });

  it("aceita payload válido de recusa", () => {
    expect(
      validateFeedbackInput({
        ...baseValid,
        decision: "rejected",
        reason_codes: ["insufficient_data"],
      }).ok,
    ).toBe(true);
  });

  it("aceita payload válido de needs_revision", () => {
    expect(
      validateFeedbackInput({
        ...baseValid,
        decision: "needs_revision",
        reason_codes: ["missing_context"],
      }).ok,
    ).toBe(true);
  });

  it("aceita edited_then_approved com diff", () => {
    expect(
      validateFeedbackInput({
        ...baseValid,
        decision: "edited_then_approved",
        reason_codes: ["good_budget_logic"],
        diff: { budget_cents: { from: 10000, to: 8000 } },
      }).ok,
    ).toBe(true);
  });

  it("rejeita ausência de reason_codes", () => {
    const r = validateFeedbackInput({ ...baseValid, reason_codes: [] as string[] });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("reason_codes_required");
  });

  it("rejeita reason_codes undefined", () => {
    const { reason_codes: _omit, ...rest } = baseValid;
    const r = validateFeedbackInput(rest as any);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("reason_codes_required");
  });

  it("rejeita decision inválido", () => {
    const r = validateFeedbackInput({ ...baseValid, decision: "kinda_approved" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_decision");
  });

  it("rejeita tenant_id ausente", () => {
    const { tenant_id: _t, ...rest } = baseValid;
    const r = validateFeedbackInput(rest as any);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("tenant_id_required");
  });

  it("rejeita tenant_id mal formado", () => {
    const r = validateFeedbackInput({ ...baseValid, tenant_id: "not-a-uuid" });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("tenant_id_required");
  });

  it("rejeita metrics_snapshot ausente", () => {
    const { metrics_snapshot: _m, ...rest } = baseValid;
    const r = validateFeedbackInput(rest as any);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("metrics_snapshot_required");
  });

  it("rejeita metrics_snapshot como array", () => {
    const r = validateFeedbackInput({
      ...baseValid,
      metrics_snapshot: [] as any,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("metrics_snapshot_required");
  });

  it("rejeita ads_platform ausente", () => {
    const { ads_platform: _a, ...rest } = baseValid;
    const r = validateFeedbackInput(rest as any);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("ads_platform_required");
  });

  it("rejeita diff em decision != edited_then_approved", () => {
    const r = validateFeedbackInput({
      ...baseValid,
      decision: "approved",
      diff: { foo: "bar" },
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("diff_only_allowed_for_edited_then_approved");
  });

  it("rejeita diff como array", () => {
    const r = validateFeedbackInput({
      ...baseValid,
      decision: "edited_then_approved",
      diff: [] as any,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_diff");
  });

  it("rejeita user_confidence inválido", () => {
    const r = validateFeedbackInput({
      ...baseValid,
      user_confidence: "super_high" as any,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_user_confidence");
  });

  it("aceita user_confidence ausente", () => {
    expect(validateFeedbackInput(baseValid).ok).toBe(true);
  });

  it("rejeita recommendation_id inválido", () => {
    const r = validateFeedbackInput({
      ...baseValid,
      recommendation_id: "abc-123" as any,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_recommendation_id");
  });

  it("rejeita payload nulo", () => {
    const r = validateFeedbackInput(null as any);
    expect(r.ok).toBe(false);
    expect(r.error).toBe("invalid_payload");
  });
});
