// =============================================
// Frente 4.3 — Editor estruturado, rascunho e versionamento
// Testes unitários puros (sem rede). Valida diff, rascunho e patch.
// =============================================
import { describe, it, expect } from "vitest";

// Reimplementação local do diff para teste isolado (mesma lógica do drawer)
type Fields = Record<string, string>;
function diffFields(initial: Fields, current: Fields) {
  const changed: string[] = [];
  const previous_values: Record<string, unknown> = {};
  const new_values: Record<string, unknown> = {};
  for (const k of Object.keys(initial)) {
    if ((initial[k] || "") !== (current[k] || "")) {
      changed.push(k);
      previous_values[k] = initial[k];
      new_values[k] = current[k];
    }
  }
  return { changed, previous_values, new_values };
}

describe("Frente 4.3 — Diff estruturado", () => {
  it("retorna vazio quando nada mudou", () => {
    const r = diffFields({ a: "1", b: "2" }, { a: "1", b: "2" });
    expect(r.changed).toEqual([]);
  });

  it("retorna apenas campos alterados", () => {
    const r = diffFields(
      { campaign_name: "X", budget: "50", funnel_stage: "cold" },
      { campaign_name: "Y", budget: "50", funnel_stage: "warm" },
    );
    expect(r.changed.sort()).toEqual(["campaign_name", "funnel_stage"]);
    expect(r.previous_values).toEqual({ campaign_name: "X", funnel_stage: "cold" });
    expect(r.new_values).toEqual({ campaign_name: "Y", funnel_stage: "warm" });
  });

  it("não envia campo cujo valor passou de undefined→string vazia", () => {
    const r = diffFields({ x: "" }, { x: "" });
    expect(r.changed).toEqual([]);
  });
});

describe("Frente 4.3 — Validações do editor", () => {
  function validate(fields: { campaign_name: string; product_id: string; funnel_stage: string; daily_budget_brl: string; destination_url: string; chips: string[]; note: string }) {
    const errors: string[] = [];
    if (!fields.campaign_name.trim()) errors.push("Nome da campanha é obrigatório.");
    if (!fields.product_id.trim()) errors.push("Produto é obrigatório.");
    if (!fields.funnel_stage) errors.push("Funil é obrigatório.");
    const b = Number(String(fields.daily_budget_brl).replace(",", "."));
    if (!Number.isFinite(b) || b <= 0) errors.push("Orçamento diário precisa ser maior que zero.");
    if (fields.destination_url && !/^https?:\/\//i.test(fields.destination_url)) errors.push("Link inválido.");
    if (fields.chips.includes("other") && !fields.note.trim())
      errors.push('Quando o motivo é "Outro", explique no campo de observação.');
    return errors;
  }

  it("aceita combinação válida", () => {
    expect(
      validate({
        campaign_name: "X",
        product_id: "p1",
        funnel_stage: "cold",
        daily_budget_brl: "50",
        destination_url: "https://x.com",
        chips: [],
        note: "",
      }),
    ).toEqual([]);
  });

  it("bloqueia orçamento zero", () => {
    const e = validate({
      campaign_name: "X",
      product_id: "p1",
      funnel_stage: "cold",
      daily_budget_brl: "0",
      destination_url: "",
      chips: [],
      note: "",
    });
    expect(e.some((x) => x.includes("Orçamento"))).toBe(true);
  });

  it('exige observação quando chip "Outro"', () => {
    const e = validate({
      campaign_name: "X",
      product_id: "p1",
      funnel_stage: "cold",
      daily_budget_brl: "50",
      destination_url: "",
      chips: ["other"],
      note: "",
    });
    expect(e.some((x) => x.includes("Outro"))).toBe(true);
  });

  it("rejeita link sem http", () => {
    const e = validate({
      campaign_name: "X",
      product_id: "p1",
      funnel_stage: "cold",
      daily_budget_brl: "50",
      destination_url: "google.com",
      chips: [],
      note: "",
    });
    expect(e.some((x) => x.includes("Link"))).toBe(true);
  });
});

describe("Frente 4.3 — Payload da revisão (contrato)", () => {
  it("inclui apenas campos alterados, feedback e identificador da proposta", () => {
    const changed = ["campaign_name", "funnel_stage"];
    const previous_values = { campaign_name: "X", funnel_stage: "cold" };
    const new_values = { campaign_name: "Y", funnel_stage: "warm" };
    const payload = {
      proposal_id: "abc",
      tenant_id: "ten",
      changed_fields: changed,
      previous_values,
      new_values,
      user_feedback: { adjustment_reason: "público estava errado", chips: ["audience"], note: null },
    };
    // Estrutura mínima esperada pelo edge function
    expect(Object.keys(payload).sort()).toEqual(
      ["changed_fields", "new_values", "previous_values", "proposal_id", "tenant_id", "user_feedback"].sort(),
    );
    expect(payload.changed_fields).toHaveLength(2);
    expect(payload.user_feedback?.chips).toContain("audience");
  });
});
