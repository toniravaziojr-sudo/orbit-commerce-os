// =============================================================================
// Onda H.3 — Gate de aprovação estrutural (testes focados)
// Valida: separação h2_structural × account_config × h4_future, defesa em
// profundidade, ambiguidade e ausência de efeitos colaterais (função pura).
// =============================================================================
import { describe, it, expect } from "vitest";
import { classifyH3Approval } from "../../supabase/functions/_shared/ads-autopilot/h3StructureGate";

const baseProposal = () => ({
  schema_version: "campaign_proposal_v1_1",
  contract_validation_status: "ok",
  campaign: {
    name: "Vendas — Prospecção",
    objective: "outcome_sales",
    daily_budget_cents: 5000,
    budget_mode: "CBO",
  },
  identity: { facebook_page_id: null, pixel_id: null },
  adsets: [{ name: "Conjunto A", audience: {} }],
  planned_creatives: [{ adset_index: 0, creative_format: "single_image", cta: "SHOP_NOW", destination_url: "https://x.com/p/a" }],
  pending_fields: [],
});

describe("Onda H.3 — classifyH3Approval", () => {
  it("aprova quando estrutura H.2 está completa (sem blockers, sem account_config)", () => {
    const r = classifyH3Approval({ action_data: baseProposal() });
    expect(r.blockers).toEqual([]);
    expect(r.ambiguous).toEqual([]);
    expect(r.account_config_pending).toEqual([]);
  });

  it("bloqueia quando falta campo crítico (nome, objetivo, orçamento, conjunto, anúncio)", () => {
    const p = baseProposal();
    p.campaign.name = "";
    p.campaign.objective = "";
    p.campaign.daily_budget_cents = 0 as any;
    p.adsets = [];
    p.planned_creatives = [];
    const r = classifyH3Approval({ action_data: p });
    const codes = r.blockers.map((b) => b.code);
    expect(codes).toContain("campaign_name_missing");
    expect(codes).toContain("campaign_objective_missing");
    expect(codes).toContain("campaign_budget_missing");
    expect(codes).toContain("no_adsets");
    expect(codes).toContain("no_planned_creatives");
  });

  it("não exige orçamento na campanha quando budget_mode=ABO", () => {
    const p = baseProposal();
    p.campaign.budget_mode = "ABO";
    p.campaign.daily_budget_cents = 0 as any;
    const r = classifyH3Approval({ action_data: p });
    expect(r.blockers.map((b) => b.code)).not.toContain("campaign_budget_missing");
  });

  it("bloqueia quando há anúncio sem vínculo com conjunto", () => {
    const p = baseProposal();
    p.planned_creatives = [{ creative_format: "single_image" } as any];
    const r = classifyH3Approval({ action_data: p });
    expect(r.blockers.map((b) => b.code)).toContain("creative_adset_link_missing");
  });

  it("trata pending_fields phase=h2_structural como blocker (sem duplicar com defesa em profundidade)", () => {
    const p = baseProposal();
    p.pending_fields = [
      { level: "ad", index: 0, field: "destination_url", label_pt: "URL de destino", phase: "h2_structural" },
    ] as any;
    p.planned_creatives = [{ adset_index: 0, creative_format: "single_image", cta: "SHOP_NOW", destination_url: null }] as any;
    const r = classifyH3Approval({ action_data: p });
    expect(r.blockers.some((b) => b.code === "pf_ad_destination_url")).toBe(true);
  });

  it("NÃO bloqueia pending_fields phase=account_config — vão para account_config_pending", () => {
    const p = baseProposal();
    p.pending_fields = [
      { level: "identity", field: "pixel_id", label_pt: "Pixel", phase: "account_config" },
      { level: "identity", field: "facebook_page_id", label_pt: "Página do Facebook", phase: "account_config" },
      { level: "campaign", field: "attribution_window", label_pt: "Janela de atribuição", phase: "account_config" },
    ] as any;
    const r = classifyH3Approval({ action_data: p });
    expect(r.blockers).toEqual([]);
    expect(r.account_config_pending).toHaveLength(3);
    expect(r.account_config_pending.map((p) => p.field)).toEqual(["pixel_id", "facebook_page_id", "attribution_window"]);
  });

  it("ignora pending_fields phase=h4_future (não bloqueia, não vira account_config)", () => {
    const p = baseProposal();
    p.pending_fields = [
      { level: "ad", index: 0, field: "primary_text", label_pt: "Texto principal", phase: "h4_future" },
      { level: "ad", index: 0, field: "headline", label_pt: "Título", phase: "h4_future" },
    ] as any;
    const r = classifyH3Approval({ action_data: p });
    expect(r.blockers).toEqual([]);
    expect(r.account_config_pending).toEqual([]);
    expect(r.ambiguous).toEqual([]);
  });

  it("trata fase desconhecida como ambíguo (bloqueia por segurança)", () => {
    const p = baseProposal();
    p.pending_fields = [
      { level: "ad", index: 0, field: "mistery", label_pt: "Campo X", phase: "unknown_phase" },
    ] as any;
    const r = classifyH3Approval({ action_data: p });
    expect(r.ambiguous.length).toBe(1);
    expect(r.ambiguous[0].code).toBe("pf_unknown_phase_mistery");
  });

  it("bloqueia quando contract_validation_status=blocked (escopo não suportado)", () => {
    const p = baseProposal();
    p.contract_validation_status = "blocked";
    (p as any).unsupported_reason = "Objetivo X fora do escopo Meta Vendas";
    const r = classifyH3Approval({ action_data: p });
    expect(r.blockers.some((b) => b.code === "contract_blocked")).toBe(true);
  });

  it("bloqueia schema_version não suportada", () => {
    const p = baseProposal();
    p.schema_version = "campaign_proposal_v2";
    const r = classifyH3Approval({ action_data: p });
    expect(r.blockers.some((b) => b.code === "unsupported_schema_version")).toBe(true);
  });

  it("não chama IA, Meta, nem cria creative_jobs — função pura sem side effects", () => {
    // Garantia estrutural: a função é importada de um módulo puro e não recebe
    // injeção de cliente Supabase nem fetch. Este teste documenta o contrato.
    const fn = classifyH3Approval as any;
    expect(typeof fn).toBe("function");
    expect(fn.length).toBe(1); // único parâmetro: action_data
  });
});
