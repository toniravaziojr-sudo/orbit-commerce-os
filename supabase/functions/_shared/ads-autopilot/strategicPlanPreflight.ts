// =====================================================================
// Onda G.1 (rev2) — Strategy Preflight Builder
//
// Camada determinística (sem IA, sem rede) que reúne tudo que o Plano
// Estratégico precisa refletir obrigatoriamente:
//
//   - funnel_budget_state (planejado/ocupado/livre por funil)
//   - active_campaigns_summary (campanhas ativas que o plano DEVE endereçar)
//   - product_identifications (produto inferido + confiança por campanha)
//   - customer_audience (público de clientes detectado por conta)
//   - catalog_availability (catálogo Meta detectado por conta)
//   - audience_budget_fits (Audience Budget Fit Lite por campanha)
//
// O resultado vira FONTE DE VERDADE: o Strategist consome no prompt, e o
// `validateStrategicPlanContract` cruza com o JSON devolvido pela IA.
// =====================================================================

import {
  computeFunnelBudgetState,
  type FunnelBucketKey,
  type FunnelBudgetState,
  type CampaignBudgetInput,
} from "./funnelBudgetModel.ts";
import {
  identifyProductFromCampaign,
  type InferredProduct,
  type ProductRef,
} from "./productIdentification.ts";
import {
  evaluateAudienceBudgetFit,
  type AudienceBudgetFitResult,
} from "./audienceBudgetFitLite.ts";

export type AttentionLevel = "ok" | "watch" | "act_now";

export interface ActiveCampaignSummary {
  campaign_id: string;
  campaign_name: string;
  funnel_stage: FunnelBucketKey;
  current_budget_brl: number;
  roas_7d: number | null;
  roas_30d: number | null;
  spend_7d_brl: number;
  spend_30d_brl: number;
  trend: "up" | "down" | "stable" | "unknown";
  recommended_attention_level: AttentionLevel;
  must_be_addressed_in_plan: boolean;
  reason: string;
  inferred_product_id: string | null;
  inferred_product_name: string | null;
  product_identification_confidence: InferredProduct["product_identification_confidence"];
}

export interface CustomerAudienceAvailability {
  customer_audience_detected: boolean;
  customer_audience_id: string | null;
  customer_audience_name: string | null;
  pending_dependency: "customer_audience_missing" | null;
}

export interface CatalogAvailability {
  catalog_detected: boolean;
  product_catalog_id: string | null;
  product_catalog_name: string | null;
  product_sets_available: Array<{ id: string; name: string }>;
  pending_dependency: "catalog_not_connected" | null;
}

export interface StrategicPlanPreflight {
  version: "g.1-rev2";
  generated_at: string;
  ad_account_id: string;
  total_daily_brl: number;
  funnel_budget_state: FunnelBudgetState;
  active_campaigns_summary: ActiveCampaignSummary[];
  product_identifications: Array<{
    campaign_id: string;
    campaign_name: string;
  } & InferredProduct>;
  customer_audience: CustomerAudienceAvailability;
  catalog_availability: CatalogAvailability;
  audience_budget_fits: Array<{
    campaign_id: string;
    campaign_name: string;
  } & AudienceBudgetFitResult>;
}

export interface PreflightInput {
  ad_account_id: string;
  total_daily_cents: number;
  funnel_splits: Partial<Record<FunnelBucketKey, number>> | null;
  campaigns: Array<CampaignBudgetInput & {
    name?: string | null;
    objective?: string | null;
  }>;
  perf_by_campaign?: Record<string, {
    impressions_30d?: number;
    reach_30d?: number;
    frequency_avg?: number;
    cpm_cents?: number;
    ctr_pct?: number;
    conversions_30d?: number;
    cpa_cents?: number;
    roas_30d?: number;
    roas_7d?: number;
    spend_30d_cents?: number;
    spend_7d_cents?: number;
  }>;
  adsets_by_campaign?: Record<string, Array<{ name?: string | null }>>;
  ads_by_campaign?: Record<string, Array<{ name?: string | null; copy_texts?: string[]; destination_urls?: string[]; creative_product_ids?: string[] }>>;
  catalog_refs?: ProductRef[];
  customer_audience?: { found: boolean; meta_audience_id?: string | null; audience_name?: string | null } | null;
  catalog?: {
    available: boolean;
    catalog_id?: string | null;
    catalog_name?: string | null;
    product_sets?: Array<{ id: string; name: string }>;
  } | null;
}

function trendFromRoas(r7: number | null, r30: number | null): "up" | "down" | "stable" | "unknown" {
  if (r7 == null || r30 == null) return "unknown";
  if (r30 <= 0) return r7 > 0 ? "up" : "unknown";
  const ratio = r7 / r30;
  if (ratio >= 1.1) return "up";
  if (ratio <= 0.9) return "down";
  return "stable";
}

function classifyAttention(opts: {
  spend30Brl: number;
  trend: "up" | "down" | "stable" | "unknown";
  roas7: number | null;
  roas30: number | null;
  status: string;
}): { level: AttentionLevel; must: boolean; reason: string } {
  const status = (opts.status || "").toUpperCase();
  if (status !== "ACTIVE") {
    return { level: "ok", must: false, reason: "Campanha não-ativa — sem ocupação de orçamento diário." };
  }
  const spendRelevant = opts.spend30Brl >= 30; // ≥ R$30 nos últimos 30 dias
  if (opts.trend === "down" && spendRelevant) {
    return {
      level: "act_now",
      must: true,
      reason: `ROAS 7d caiu vs 30d (7d=${opts.roas7?.toFixed(2) ?? "?"} vs 30d=${opts.roas30?.toFixed(2) ?? "?"}) com gasto relevante. Plano precisa decidir: manter, reduzir, pausar, monitorar ou justificar.`,
    };
  }
  if (spendRelevant && (opts.roas30 ?? 0) > 0 && (opts.roas30 ?? 0) < 1) {
    return {
      level: "act_now",
      must: true,
      reason: `Campanha ativa com ROAS 30d abaixo de 1.0 e gasto relevante. Plano precisa endereçar.`,
    };
  }
  if (spendRelevant) {
    return {
      level: "watch",
      must: true,
      reason: "Campanha ativa com gasto relevante — plano deve registrar decisão (manter/reduzir/pausar/monitorar).",
    };
  }
  return { level: "ok", must: false, reason: "Campanha ativa sem gasto relevante nos últimos 30 dias." };
}

export function buildStrategicPlanPreflightContext(input: PreflightInput): StrategicPlanPreflight {
  const totalDailyCents = Math.max(0, Math.round(input.total_daily_cents || 0));
  const campaignBudgetInputs: CampaignBudgetInput[] = (input.campaigns || []).map((c) => ({
    id: c.id,
    name: c.name || c.id,
    status: (c.status || "").toUpperCase(),
    daily_budget_cents: Number(c.daily_budget_cents || 0),
    objective: c.objective || null,
  }));

  const funnelBudgetState = computeFunnelBudgetState({
    totalDailyCents,
    funnelSplits: (input.funnel_splits as any) || null,
    campaigns: campaignBudgetInputs,
  });

  const catalogRefs = input.catalog_refs || [];
  const adsetsByCampaign = input.adsets_by_campaign || {};
  const adsByCampaign = input.ads_by_campaign || {};

  const productIdentifications: StrategicPlanPreflight["product_identifications"] = [];
  for (const c of campaignBudgetInputs) {
    const sets = adsetsByCampaign[c.id] || [];
    const ads = adsByCampaign[c.id] || [];
    const inf = identifyProductFromCampaign(
      {
        id: c.id,
        name: c.name,
        adset_names: sets.map((s) => s.name || "").filter(Boolean),
        ad_names: ads.map((a) => a.name || "").filter(Boolean),
        destination_urls: ads.flatMap((a) => a.destination_urls || []),
        copy_texts: ads.flatMap((a) => a.copy_texts || []),
        creative_product_ids: ads.flatMap((a) => a.creative_product_ids || []),
      },
      catalogRefs,
    );
    productIdentifications.push({ campaign_id: c.id, campaign_name: c.name, ...inf });
  }

  const productByCampaign: Record<string, typeof productIdentifications[number]> = {};
  for (const pi of productIdentifications) productByCampaign[pi.campaign_id] = pi;

  const activeCampaignsSummary: ActiveCampaignSummary[] = [];
  const audienceBudgetFits: StrategicPlanPreflight["audience_budget_fits"] = [];

  for (const c of campaignBudgetInputs) {
    const perf = (input.perf_by_campaign || {})[c.id] || {};
    const fit = evaluateAudienceBudgetFit({
      current_daily_budget_cents: c.daily_budget_cents,
      impressions_30d: perf.impressions_30d || 0,
      reach_30d: perf.reach_30d || 0,
      frequency_avg: perf.frequency_avg || 0,
      cpm_cents: perf.cpm_cents || 0,
      ctr_pct: perf.ctr_pct || 0,
      conversions_30d: perf.conversions_30d || 0,
      cpa_cents: perf.cpa_cents || 0,
      roas: perf.roas_30d || 0,
      spend_30d_cents: perf.spend_30d_cents || 0,
    });
    audienceBudgetFits.push({ campaign_id: c.id, campaign_name: c.name, ...fit });

    if (c.status === "ACTIVE") {
      const roas7 = perf.roas_7d ?? null;
      const roas30 = perf.roas_30d ?? null;
      const spend30Brl = (perf.spend_30d_cents || 0) / 100;
      const spend7Brl = (perf.spend_7d_cents || 0) / 100;
      const trend = trendFromRoas(roas7, roas30);
      const attn = classifyAttention({
        spend30Brl,
        trend,
        roas7,
        roas30,
        status: c.status,
      });
      const prod = productByCampaign[c.id];
      activeCampaignsSummary.push({
        campaign_id: c.id,
        campaign_name: c.name,
        funnel_stage: ((c as any).inferred_funnel || "unknown") as FunnelBucketKey,
        current_budget_brl: c.daily_budget_cents / 100,
        roas_7d: roas7,
        roas_30d: roas30,
        spend_7d_brl: spend7Brl,
        spend_30d_brl: spend30Brl,
        trend,
        recommended_attention_level: attn.level,
        must_be_addressed_in_plan: attn.must,
        reason: attn.reason,
        inferred_product_id: prod?.inferred_product_id ?? null,
        inferred_product_name: prod?.inferred_product_name ?? null,
        product_identification_confidence: prod?.product_identification_confidence ?? "unknown",
      });
    }
  }

  const customerAudience: CustomerAudienceAvailability = (() => {
    const ca = input.customer_audience || null;
    if (ca?.found && ca.meta_audience_id) {
      return {
        customer_audience_detected: true,
        customer_audience_id: ca.meta_audience_id,
        customer_audience_name: ca.audience_name || "Clientes",
        pending_dependency: null,
      };
    }
    return {
      customer_audience_detected: false,
      customer_audience_id: null,
      customer_audience_name: null,
      pending_dependency: "customer_audience_missing",
    };
  })();

  const catalog: CatalogAvailability = (() => {
    const cat = input.catalog || null;
    if (cat?.available && cat.catalog_id) {
      return {
        catalog_detected: true,
        product_catalog_id: cat.catalog_id,
        product_catalog_name: cat.catalog_name || null,
        product_sets_available: cat.product_sets || [],
        pending_dependency: null,
      };
    }
    return {
      catalog_detected: false,
      product_catalog_id: null,
      product_catalog_name: null,
      product_sets_available: [],
      pending_dependency: "catalog_not_connected",
    };
  })();

  return {
    version: "g.1-rev2",
    generated_at: new Date().toISOString(),
    ad_account_id: input.ad_account_id,
    total_daily_brl: totalDailyCents / 100,
    funnel_budget_state: funnelBudgetState,
    active_campaigns_summary: activeCampaignsSummary,
    product_identifications: productIdentifications,
    customer_audience: customerAudience,
    catalog_availability: catalog,
    audience_budget_fits: audienceBudgetFits,
  };
}
