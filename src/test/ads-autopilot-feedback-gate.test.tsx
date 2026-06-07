// =====================================================================
// Testes da Subfase A.2 — gate de feedback do Ads Autopilot
// Foco: motivo obrigatório, gravação prévia, bloqueio em falha,
// vínculo correto de tenant e mapping aprovado/recusado.
// =====================================================================

import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

const invokeMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: any[]) => invokeMock(...args) } },
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import { useAdsAutopilotFeedbackGate } from "@/hooks/useAdsAutopilotFeedbackGate";

const TENANT = "d1a4d0ed-8842-495e-b741-540a9a345b25";

const ACTION = {
  id: "11111111-1111-1111-1111-111111111111",
  tenant_id: TENANT,
  channel: "meta",
  action_type: "create_campaign",
  action_data: {
    campaign_name: "Camp X",
    objective: "OUTCOME_SALES",
    ad_account_id: "act_251893833881780",
    metrics_snapshot: { spend_7d: 100 },
  },
  reasoning: "razão",
  expected_impact: "+ROAS",
};

function Harness({ mode }: { mode: "approve" | "reject" }) {
  const gate = useAdsAutopilotFeedbackGate(TENANT);
  const confirmed = React.useRef(0);
  return (
    <div>
      <button
        data-testid="trigger"
        onClick={() =>
          mode === "approve"
            ? gate.requestApproval(ACTION as any, () => {
                confirmed.current += 1;
                (window as any).__confirmed = confirmed.current;
              })
            : gate.requestRejection(ACTION as any, () => {
                confirmed.current += 1;
                (window as any).__confirmed = confirmed.current;
              })
        }
      >
        open
      </button>
      {gate.FeedbackDialog}
    </div>
  );
}

beforeEach(() => {
  invokeMock.mockReset();
  (window as any).__confirmed = 0;
});

describe("Ads Autopilot Feedback Gate — A.2", () => {
  it("abre o diálogo de aprovação ao solicitar", () => {
    render(<Harness mode="approve" />);
    fireEvent.click(screen.getByTestId("trigger"));
    expect(screen.getByText(/aprovando esta sugestão/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar aprovação/i })).toBeDisabled();
  });

  it("abre o diálogo de recusa ao solicitar", () => {
    render(<Harness mode="reject" />);
    fireEvent.click(screen.getByTestId("trigger"));
    expect(screen.getByText(/recusando esta sugestão/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirmar recusa/i })).toBeDisabled();
  });

  it("bloqueia confirmação de aprovação sem motivo", () => {
    render(<Harness mode="approve" />);
    fireEvent.click(screen.getByTestId("trigger"));
    const btn = screen.getByRole("button", { name: /confirmar aprovação/i });
    expect(btn).toBeDisabled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("bloqueia confirmação de recusa sem motivo", () => {
    render(<Harness mode="reject" />);
    fireEvent.click(screen.getByTestId("trigger"));
    expect(screen.getByRole("button", { name: /confirmar recusa/i })).toBeDisabled();
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it("grava feedback aprovado e só então executa o fluxo original", async () => {
    invokeMock.mockResolvedValue({ data: { success: true, feedback_id: "fb1" }, error: null });
    render(<Harness mode="approve" />);
    fireEvent.click(screen.getByTestId("trigger"));
    fireEvent.click(screen.getByLabelText(/boa lógica de orçamento/i, { selector: "button" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar aprovação/i }));
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    const [fn, opts] = invokeMock.mock.calls[0];
    expect(fn).toBe("ads-autopilot-feedback-record");
    expect(opts.body.tenant_id).toBe(TENANT);
    expect(opts.body.action_id).toBe(ACTION.id);
    expect(opts.body.decision).toBe("approved");
    expect(opts.body.reason_codes).toEqual(["good_budget_logic"]);
    expect(opts.body.ads_platform).toBe("meta");
    expect(opts.body.metrics_snapshot).toEqual({ spend_7d: 100 });
    expect((window as any).__confirmed).toBe(1);
  });

  it("grava feedback recusado e só então segue", async () => {
    invokeMock.mockResolvedValue({ data: { success: true, feedback_id: "fb2" }, error: null });
    render(<Harness mode="reject" />);
    fireEvent.click(screen.getByTestId("trigger"));
    fireEvent.click(screen.getByLabelText(/copy fraca/i, { selector: "button" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar recusa/i }));
    });
    expect(invokeMock).toHaveBeenCalledTimes(1);
    expect(invokeMock.mock.calls[0][1].body.decision).toBe("rejected");
    expect(invokeMock.mock.calls[0][1].body.reason_codes).toEqual(["weak_copy"]);
    expect((window as any).__confirmed).toBe(1);
  });

  it("não segue o fluxo se a gravação de feedback falhar (success:false)", async () => {
    invokeMock.mockResolvedValue({ data: { success: false, error: "invalid_reason_codes" }, error: null });
    render(<Harness mode="approve" />);
    fireEvent.click(screen.getByTestId("trigger"));
    fireEvent.click(screen.getByLabelText(/boa lógica de orçamento/i, { selector: "button" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar aprovação/i }));
    });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect((window as any).__confirmed).toBe(0);
  });

  it("não segue o fluxo se a gravação de feedback falhar (error de transporte)", async () => {
    invokeMock.mockResolvedValue({ data: null, error: { message: "network" } });
    render(<Harness mode="reject" />);
    fireEvent.click(screen.getByTestId("trigger"));
    fireEvent.click(screen.getByLabelText(/orçamento alto demais/i, { selector: "button" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar recusa/i }));
    });
    await waitFor(() => expect(invokeMock).toHaveBeenCalled());
    expect((window as any).__confirmed).toBe(0);
  });

  it("vincula feedback ao tenant correto e não chama nenhuma outra função", async () => {
    invokeMock.mockResolvedValue({ data: { success: true, feedback_id: "fb3" }, error: null });
    render(<Harness mode="approve" />);
    fireEvent.click(screen.getByTestId("trigger"));
    fireEvent.click(screen.getByLabelText(/alinhado ao objetivo de negócio/i, { selector: "button" }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /confirmar aprovação/i }));
    });
    const calls = invokeMock.mock.calls.map((c) => c[0]);
    expect(calls).toEqual(["ads-autopilot-feedback-record"]);
    expect(invokeMock.mock.calls[0][1].body.tenant_id).toBe(TENANT);
  });
});
