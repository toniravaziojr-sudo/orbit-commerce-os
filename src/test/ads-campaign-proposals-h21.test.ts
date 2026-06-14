import { describe, it, expect } from "vitest";
import {
  buildCampaignProposalsFromApprovedPlan,
} from "../../supabase/functions/_shared/ads-autopilot/campaignProposals";

const parent = {
  id: "plan-1",
  tenant_id: "tenant-1",
  channel: "meta",
  session_id: "session-1",
  analysis_run_id: "run-1",
  ad_account_id: "act_123",
  account_defaults: {
    facebook_page_id: "111",
    facebook_page_name: "Página Loja",
    instagram_actor_id: "222",
    instagram_actor_name: "@loja",
    pixel_id: "333",
    pixel_name: "Pixel Principal",
    conversion_event_default: "PURCHASE",
    attribution_window: "7d_click",
    default_objective: null,
    default_buying_type: "AUCTION",
    default_budget_type: "daily",
    default_daily_budget_cents: null,
    default_planned_status: "PAUSED",
    default_country: "BR",
    default_age_min: 25,
    default_age_max: 55,
    default_gender: "all",
    default_placements: ["advantage_plus"],
    default_cta: "SHOP_NOW",
    default_creative_format: "image",
    default_utm_params: { utm_source: "meta", utm_medium: "paid" },
    conversions_api_active: true,
    source: "merged" as const,
  },
};

function basePlan(actions: any[]): any {
  return {
    metadata: { schema_version: "strategic_plan_v2", is_approvable: true, validation_status: "valid" },
    contract: { ok: true, version: "1.2.0" },
    planned_actions: actions,
  };
}

describe("Onda H.2.1 — Identidade da conta + pending_fields por objetivo", () => {
  it("injeta identidade (página, IG, pixel, CTA padrão, UTM) na proposta", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{ action_type: "create_campaign", campaign_name: "X", objective: "sales", daily_budget_cents: 5000, adsets: [{ name: "A1" }] }]),
      parent as any,
    );
    const ad = records[0].action_data as any;
    expect(ad.identity.facebook_page_id).toBe("111");
    expect(ad.identity.pixel_id).toBe("333");
    expect(ad.identity.conversions_api_active).toBe(true);
    expect(ad.identity.cta_default).toBe("SHOP_NOW");
    expect(ad.identity.attribution_window).toBe("7d_click");
  });

  it("garante 1 criativo placeholder por conjunto quando a estratégia não trouxe criativos", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{ action_type: "create_campaign", objective: "sales", adsets: [{ name: "A1" }, { name: "A2" }] }]),
      parent as any,
    );
    const ad = records[0].action_data as any;
    expect(ad.planned_creatives).toHaveLength(2);
    expect(ad.planned_creatives[0].generation_status).toBe("placeholder_pending_strategy_fill");
    expect(ad.planned_creatives[0].cta).toBe("SHOP_NOW"); // herdou do default
  });

  it("computa pending_fields baseado no contrato do objetivo Meta", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{ action_type: "create_campaign", objective: "sales", adsets: [{ name: "A1" }] }]),
      parent as any,
    );
    const ad = records[0].action_data as any;
    expect(ad.objective_contract_label_pt).toBe("Vendas");
    expect(Array.isArray(ad.pending_fields)).toBe(true);
    expect(ad.meta_step_checklist).toHaveLength(4);
    // Pelo menos identidade e campanha devem aparecer no checklist
    expect(ad.meta_step_checklist.map((s: any) => s.step)).toEqual(["identity", "campaign", "adset", "ad"]);
  });

  it("herda age/gender/placements/país do default quando a ação não traz", () => {
    const { records } = buildCampaignProposalsFromApprovedPlan(
      basePlan([{ action_type: "create_campaign", objective: "sales", adsets: [{ name: "A1" }] }]),
      parent as any,
    );
    const adset = (records[0].action_data as any).adsets[0];
    expect(adset.age_min).toBe(25);
    expect(adset.age_max).toBe(55);
    expect(adset.location).toBe("BR");
    expect(adset.placements).toEqual(["advantage_plus"]);
    expect(adset.conversion_event).toBe("PURCHASE");
  });
});
