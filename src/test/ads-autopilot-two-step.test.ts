// =============================================
// Frente 4 — Fluxo de duas etapas (testes consolidados)
// =============================================
// Cobre os 17 cenários da spec via testes puros sobre os helpers
// `twoStep.ts` + `qualityGate.ts`. Nada externo é chamado.

import { describe, it, expect } from "vitest";
import {
  TWO_STEP_FLOW_VERSION,
  TWO_STEP_STATUSES,
  isTwoStepAction,
  buildCreativeBrief,
  runTwoStepCreativeGate,
} from "../../supabase/functions/_shared/ads-autopilot/twoStep";

const baseAction = (overrides: any = {}) => ({
  id: "act-1",
  status: TWO_STEP_STATUSES.PENDING_STRATEGY,
  action_type: "create_campaign",
  action_data: {
    flow_version: TWO_STEP_FLOW_VERSION,
    campaign_name: "Campanha Teste",
    destination_url: "https://loja.com/p/x",
    funnel_stage: "tof",
    creative_brief: {
      prompt: "Foto do produto X em estúdio",
      format: "1:1",
      funnel_stage: "tof",
      product_name: "Produto X",
    },
    customer_audience_exclusion: { enabled: true, audience_id: "cust-1" },
    ...overrides.action_data,
  },
  ...overrides,
});

describe("Frente 4 — marcador de fluxo two-step", () => {
  it("identifica proposta two-step nova", () => {
    expect(isTwoStepAction(baseAction())).toBe(true);
  });

  it("identifica proposta legacy (sem flow_version)", () => {
    expect(isTwoStepAction({ action_data: { campaign_name: "X" } } as any)).toBe(false);
  });

  it("buildCreativeBrief preserva prompt e formato", () => {
    const brief = buildCreativeBrief(
      { product_name: "P", prompt: "Foto premium", format: "9:16", funnel_stage: "tof" },
      { product_id: "p-1", product_image_url: "http://img" },
    );
    expect(brief.prompt).toBe("Foto premium");
    expect(brief.format).toBe("9:16");
    expect(brief.product_id).toBe("p-1");
    expect(brief.deferred).toBe(true);
  });
});

describe("Frente 4 — Quality Gate antes de gerar criativos (Etapa 2)", () => {
  const baseGateInput = {
    action: baseAction(),
    qualityGatePassed: true,
    customerExclusionApplied: true,
    funnelStage: "tof",
  };

  it("passa quando tudo está válido (campanha fria + exclusão de Clientes)", () => {
    const r = runTwoStepCreativeGate(baseGateInput);
    expect(r.ok).toBe(true);
  });

  it("bloqueia proposta legacy (sem flow_version)", () => {
    const action = baseAction();
    delete (action.action_data as any).flow_version;
    const r = runTwoStepCreativeGate({ ...baseGateInput, action });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("not_two_step_flow");
  });

  it("bloqueia campanha fria sem exclusão de Clientes", () => {
    const r = runTwoStepCreativeGate({ ...baseGateInput, customerExclusionApplied: false });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("cold_audience_requires_customer_exclusion");
  });

  it("bloqueia quando creative_brief está ausente", () => {
    const action = baseAction({ action_data: { creative_brief: null } });
    const r = runTwoStepCreativeGate({ ...baseGateInput, action });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("creative_brief_missing");
  });

  it("bloqueia quando formato está ausente", () => {
    const action = baseAction({
      action_data: {
        creative_brief: { prompt: "X", funnel_stage: "tof", product_name: "P" },
      },
    });
    const r = runTwoStepCreativeGate({ ...baseGateInput, action });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("creative_format_missing");
  });

  it("bloqueia quando link de destino está ausente", () => {
    const action = baseAction({
      action_data: { destination_url: null, link_url: null, preview: {} },
    });
    const r = runTwoStepCreativeGate({ ...baseGateInput, action });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("destination_url_missing");
  });

  it("bloqueia proposta rejeitada", () => {
    const action = baseAction({ status: "rejected" });
    const r = runTwoStepCreativeGate({ ...baseGateInput, action });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("proposal_rejected");
  });

  it("bloqueia proposta superseded", () => {
    const action = baseAction({ status: "superseded" });
    const r = runTwoStepCreativeGate({ ...baseGateInput, action });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("proposal_superseded");
  });

  it("bloqueia quando Quality Gate principal falhou", () => {
    const r = runTwoStepCreativeGate({ ...baseGateInput, qualityGatePassed: false });
    expect(r.ok).toBe(false);
    expect(r.reason_codes).toContain("quality_gate_failed");
  });

  it("permite campanha quente (hot) sem exclusão de Clientes", () => {
    const action = baseAction({
      action_data: {
        funnel_stage: "bof",
        creative_brief: {
          prompt: "Reativação clientes", format: "1:1", funnel_stage: "bof", product_name: "P",
        },
      },
    });
    const r = runTwoStepCreativeGate({
      action,
      qualityGatePassed: true,
      customerExclusionApplied: false,
      funnelStage: "bof",
    });
    expect(r.ok).toBe(true);
  });
});

describe("Frente 4 — Estados do fluxo", () => {
  it("define os 3 estados ativos esperados", () => {
    expect(TWO_STEP_STATUSES.PENDING_STRATEGY).toBe("pending_approval");
    expect(TWO_STEP_STATUSES.CREATIVE_PENDING).toBe("creative_pending");
    expect(TWO_STEP_STATUSES.FINAL_PENDING).toBe("final_pending_approval");
  });

  it("flow_version marcador é estável", () => {
    expect(TWO_STEP_FLOW_VERSION).toBe("two_step_v1");
  });
});

describe("Frente 4 — Compatibilidade com propostas antigas", () => {
  it("buildCreativeBrief não polui campos não fornecidos", () => {
    const brief = buildCreativeBrief({ product_name: "P" });
    expect(brief.deferred).toBe(true);
    expect(brief.format).toBe("1:1");
    expect(brief.variations).toBe(3);
  });

  it("isTwoStepAction retorna false para action null/undefined", () => {
    expect(isTwoStepAction(null)).toBe(false);
    expect(isTwoStepAction(undefined)).toBe(false);
    expect(isTwoStepAction({} as any)).toBe(false);
  });
});
