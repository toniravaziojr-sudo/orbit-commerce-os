// =============================================================================
// Onda H.2.2 — testes do contrato com fase + paridade ABO + vínculo anúncio↔conjunto
// =============================================================================
import { describe, it, expect } from "vitest";
import { buildCampaignProposalsFromApprovedPlan } from "../../supabase/functions/_shared/ads-autopilot/campaignProposals";

const parent = {
  id: "plan-1",
  tenant_id: "tenant-1",
  channel: "meta",
  session_id: "session-1",
  analysis_run_id: "run-1",
  ad_account_id: "act_123",
  account_defaults: {
    facebook_page_id: null,
    pixel_id: null,
    conversion_event_default: null,
    default_cta: null,
    default_creative_format: null,
    default_utm_params: null,
    source: "none" as const,
  } as any,
};

function basePlan(actions: any[]): any {
  return {
    metadata: { schema_version: "strategic_plan_v2", is_approvable: true, validation_status: "valid" },
    contract: { ok: true, version: "1.2.0" },
    planned_actions: actions,
  };
}

describe("H.2.2 — vínculo anúncio↔conjunto e enriquecimento estrutural", () => {
  it("propaga adset_index, adset_key e linked_adset_name em todos os anúncios planejados (placeholders)", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{
        action_type: "create_campaign",
        objective: "sales",
        campaign_type: "prospecting",
        daily_budget_cents: 5000,
        adsets: [{ name: "Conjunto A" }, { name: "Conjunto B" }],
      }]),
      parent as any,
    );
    const ad = records[0].action_data as any;
    expect(ad.planned_creatives).toHaveLength(2);
    expect(ad.planned_creatives[0].adset_index).toBe(0);
    expect(ad.planned_creatives[0].adset_key).toBe("adset_0");
    expect(ad.planned_creatives[0].linked_adset_name).toBe("Conjunto A");
    expect(ad.planned_creatives[1].linked_adset_name).toBe("Conjunto B");
    // Campos estruturais H.2 presentes
    expect(ad.planned_creatives[0].creative_source).toBeDefined();
    expect(ad.planned_creatives[0].destination_type).toBeDefined();
    expect(ad.planned_creatives[0].resolution_phase.headline).toBe("h4_future");
    expect(ad.planned_creatives[0].resolution_phase.cta).toBe("h2_structural");
  });

  it("vincula corretamente criativos vindos da estratégia (com adset_index explícito)", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{
        action_type: "create_campaign",
        objective: "sales",
        campaign_type: "prospecting",
        daily_budget_cents: 5000,
        adsets: [{ name: "A" }, { name: "B" }],
        creatives: [
          { adset_index: 1, format: "image", headline: "X" },
          { adset_index: 0, format: "video", headline: "Y" },
        ],
      }]),
      parent as any,
    );
    const cs = (records[0].action_data as any).planned_creatives;
    expect(cs[0].adset_index).toBe(1);
    expect(cs[0].linked_adset_name).toBe("B");
    expect(cs[1].adset_index).toBe(0);
    expect(cs[1].linked_adset_name).toBe("A");
  });
});

describe("H.2.2 — [Teste] ABO paridade 1 anúncio ↔ 1 conjunto", () => {
  it("expande placeholders 1:1 quando não há criativos vindos da estratégia", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{
        action_type: "create_campaign",
        objective: "sales",
        campaign_type: "testing",
        daily_budget_cents: 9000,
        adsets: [{ name: "Variação A" }, { name: "Variação B" }, { name: "Variação C" }],
      }]),
      parent as any,
    );
    const ad = records[0].action_data as any;
    expect(ad.campaign.budget_mode).toBe("ABO");
    expect(ad.planned_creatives).toHaveLength(3);
    expect(ad.planned_creatives.map((p: any) => p.linked_adset_name)).toEqual(["Variação A", "Variação B", "Variação C"]);
    expect(ad.contract_validation_status).toBe("ok");
  });

  it("marca pending_dependency quando o pareamento é ambíguo", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{
        action_type: "create_campaign",
        objective: "sales",
        campaign_type: "testing",
        daily_budget_cents: 9000,
        adsets: [{ name: "Var A" }, { name: "Var B" }],
        creatives: [
          { format: "image", headline: "1" },
          { format: "image", headline: "2" },
          { format: "image", headline: "3" }, // mais criativos do que conjuntos
        ],
      }]),
      parent as any,
    );
    const ad = records[0].action_data as any;
    expect(ad.contract_validation_status).toBe("pending_dependency");
    expect(ad.testing_abo_pairing_status).toBe("mismatch_pending_user_decision");
  });
});

describe("H.2.2 — checklist conta apenas pendência H.2 estrutural", () => {
  it("anúncios placeholder: copy/título/descrição NÃO contam como pendência H.2 (vão para h4_future)", () => {
    // defaults preenchem CTA e formato → não geram pendência H.2 nos anúncios
    const parentWithDefaults = {
      ...parent,
      account_defaults: {
        ...(parent.account_defaults as any),
        default_cta: "SHOP_NOW",
        default_creative_format: "image",
      } as any,
    };
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{
        action_type: "create_campaign",
        objective: "sales",
        campaign_type: "prospecting",
        daily_budget_cents: 5000,
        adsets: [
          { name: "C1", audience: "X", placements: ["feed"], schedule: { start: "now" }, optimization_goal: "OFFSITE_CONVERSIONS", conversion_event: "PURCHASE", audience_exclusions: { customers: true } },
          { name: "C2", audience: "Y", placements: ["feed"], schedule: { start: "now" }, optimization_goal: "OFFSITE_CONVERSIONS", conversion_event: "PURCHASE", audience_exclusions: { customers: true } },
        ],
      }]),
      parentWithDefaults as any,
    );
    const ad = records[0].action_data as any;
    const adsStep = ad.meta_step_checklist.find((s: any) => s.step === "ad");
    // título/texto ainda ausentes → vão para h4_future (não inflam o passo a passo)
    expect(adsStep.h2_missing_count).toBe(0);
    expect(adsStep.h4_missing_count).toBeGreaterThanOrEqual(4);
    // pending_fields no nível "ad" só carregam fase h4_future (copy/headline)
    const adPendings = ad.pending_fields.filter((p: any) => p.level === "ad");
    expect(adPendings.length).toBeGreaterThan(0);
    expect(adPendings.every((p: any) => p.phase === "h4_future")).toBe(true);
  });


  it("ABO não exige daily_budget_cents na campanha (sem pendência fantasma)", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{
        action_type: "create_campaign",
        objective: "sales",
        campaign_type: "testing",
        daily_budget_cents: 6000,
        adsets: [{ name: "A" }, { name: "B" }],
      }]),
      parent as any,
    );
    const ad = records[0].action_data as any;
    const campaignPendings = ad.pending_fields.filter(
      (p: any) => p.level === "campaign" && p.field === "daily_budget_cents",
    );
    expect(campaignPendings).toHaveLength(0);
  });
});
