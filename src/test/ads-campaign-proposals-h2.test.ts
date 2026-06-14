import { describe, it, expect } from "vitest";
import {
  buildCampaignProposalsFromApprovedPlan,
  CAMPAIGN_PROPOSAL_SCHEMA_VERSION,
} from "../../supabase/functions/_shared/ads-autopilot/campaignProposals";

const parent = {
  id: "plan-1",
  tenant_id: "tenant-1",
  channel: "meta",
  session_id: "session-1",
  analysis_run_id: "run-1",
  ad_account_id: "act_123",
};

function basePlan(actions: any[]): any {
  return {
    diagnosis: "ok",
    metadata: {
      schema_version: "strategic_plan_v2",
      is_approvable: true,
      validation_status: "valid",
    },
    contract: { ok: true, version: "1.2.0" },
    planned_actions: actions,
  };
}

describe("Onda H.2 — Gerador de propostas filhas detalhadas", () => {
  it("gera 1 proposta por planned_action com vínculo correto", () => {
    const { records, skipped_reasons } = buildCampaignProposalsFromApprovedPlan(
      basePlan([
        { action_type: "create_campaign", campaign_name: "C1", campaign_type: "prospecting" },
        { action_type: "adjust_budget", campaign_name: "C2" },
        { action_type: "pause_campaign", campaign_name: "C3" },
      ]),
      parent,
    );

    expect(skipped_reasons).toEqual([]);
    expect(records).toHaveLength(3);
    records.forEach((r, i) => {
      expect(r.action_type).toBe("campaign_proposal");
      expect(r.status).toBe("pending_approval");
      expect(r.parent_action_id).toBe(parent.id);
      expect(r.planned_action_index).toBe(i);
      expect(r.tenant_id).toBe(parent.tenant_id);
      expect(r.channel).toBe(parent.channel);
      expect(r.analysis_run_id).toBe(parent.analysis_run_id);
      expect(r.policy_engine_version).toBeNull();

      const ad = r.action_data as any;
      expect(ad.schema_version).toBe(CAMPAIGN_PROPOSAL_SCHEMA_VERSION);
      expect(ad.lifecycle.status).toBe("campaign_proposal_pending_review");
      expect(ad.source_plan_id).toBe(parent.id);
      expect(ad.planned_action_index).toBe(i);
      expect(ad.ad_account_id).toBe(parent.ad_account_id);
    });
  });

  it("classifica corretamente os tipos de proposta", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([
        { action_type: "create_campaign" },
        { action_type: "pause_campaign" },
        { action_type: "adjust_budget" },
        { action_type: "scale_budget" },
        { action_type: "reactivate_campaign" },
      ]),
      parent,
    );

    expect((records[0].action_data as any).kind).toBe("campaign_creation_proposal");
    expect((records[1].action_data as any).kind).toBe("campaign_pause_proposal");
    expect((records[2].action_data as any).kind).toBe("campaign_budget_adjustment_proposal");
    expect((records[3].action_data as any).kind).toBe("campaign_budget_adjustment_proposal");
    expect((records[4].action_data as any).kind).toBe("campaign_reactivation_proposal");
  });

  it("preserva snapshot detalhado de campanha, conjuntos, criativos planejados e validações", () => {
    const action = {
      action_type: "create_campaign",
      campaign_name: "Frio Aquisição",
      objective: "OUTCOME_SALES",
      daily_budget_cents: 5000,
      campaign_type: "prospecting",
      campaign_intent: "acquisition",
      funnel_stage: "tof",
      product_name: "Shampoo X",
      rationale: "Razão",
      adsets: [
        {
          name: "Adset 1",
          audience: "Broad BR 30-65",
          audience_exclusions: { customers: true, customer_audience_id: "aud_1" },
          excluded_audience_ids: ["aud_1"],
          daily_budget_cents: 5000,
          placements: ["feed", "stories"],
          optimization_event: "PURCHASE",
        },
      ],
      creatives: [
        {
          format: "image",
          angle: "preço",
          copy: "Compre já",
          headline: "Frete grátis",
          cta: "SHOP_NOW",
          destination_url: "https://x?utm_source=meta",
        },
      ],
    };

    const { records } = buildCampaignProposalsFromApprovedPlan(basePlan([action]), parent);
    const ad = records[0].action_data as any;

    expect(ad.campaign.name).toBe("Frio Aquisição");
    expect(ad.campaign.daily_budget_cents).toBe(5000);
    expect(ad.campaign.initial_status_planned).toBe("PAUSED");
    expect(ad.adsets[0].audience).toBe("Broad BR 30-65");
    expect(ad.adsets[0].audience_exclusions.customers).toBe(true);
    expect(ad.planned_creatives[0].generation_status).toBe("planned_only");
    expect(ad.planned_creatives[0].headline).toBe("Frete grátis");
    expect(ad.validations.cold_audience_exclusion_present).toBe(true);
  });

  it("retorna vazio quando o plano não tem planned_actions", () => {
    const r = buildCampaignProposalsFromApprovedPlan(basePlan([]), parent);
    expect(r.records).toEqual([]);
    expect(r.skipped_reasons).toContain("no_planned_actions");
  });

  it("não gera registros com action_type fora de campaign_proposal", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([
        { action_type: "create_campaign" },
        { action_type: "generate_creative" },
        { action_type: "create_lookalike_audience" },
      ]),
      parent,
    );
    records.forEach((r) => {
      expect(r.action_type).toBe("campaign_proposal");
    });
  });

  it("não chama Meta, não gera criativo, não toca em integrações (função pura)", () => {
    // Função pura: o teste já não importa nada de Meta/criativos. Asserção semântica:
    const { records } = buildCampaignProposalsFromApprovedPlan(basePlan([{ action_type: "create_campaign" }]), parent);
    expect(records[0].action_data).not.toHaveProperty("meta_campaign_id");
    expect(records[0].action_data).not.toHaveProperty("creative_asset_url");
    expect((records[0].action_data as any).planned_creatives).toBeInstanceOf(Array);
  });
});
