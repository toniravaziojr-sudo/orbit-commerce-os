// =====================================================================
// Onda H.2 + H.2.1 — Gerador de Propostas Filhas Detalhadas
//
// Recebe um Plano Estratégico **já validado e aprovado** (passou pelo
// guard canônico em strategicPlanContract.ts) e gera 1 registro
// `campaign_proposal` por ação planejada.
//
// H.2.1 (2026-06-14):
// - Aceita `account_defaults` (resolvido server-side) e injeta identidade
//   (página, IG, pixel, evento, UTM base, CTA padrão, faixa etária etc.)
//   no snapshot, para a proposta nascer com dados reais da conta.
// - Calcula `pending_fields[]` por contrato de objetivo Meta (sem ser gate).
// - Garante pelo menos 1 criativo planejado por conjunto quando a proposta
//   é de criação/ajuste, marcando-os como `placeholder_pending_strategy_fill`.
//
// REGRAS INVIOLÁVEIS:
// - Função PURA. Não chama banco, não chama Meta, não consome crédito.
// - Não gera criativo final. Não cria público. Não cria catálogo.
// =====================================================================

import {
  computePendingFields,
  defaultCtaForObjective,
  type PendingFieldsReport,
} from "./objectiveFieldContract.ts";
import type { AccountDefaults } from "./accountDefaults.ts";

/**
 * Onda H.2.1 — versão do contrato. v1 continua sendo aceito em LEITURA pelo
 * normalizador da UI, mas toda escrita nova passa a sair como v1.1.
 */
export const CAMPAIGN_PROPOSAL_SCHEMA_VERSION = "campaign_proposal_v1_1" as const;
export const CAMPAIGN_PROPOSAL_LIFECYCLE_VERSION = "h2_v1" as const;

export type CampaignProposalLifecycleStatus =
  | "campaign_proposal_pending_review"
  | "campaign_proposal_approved"
  | "campaign_proposal_rejected"
  | "campaign_proposal_needs_adjustment"
  | "campaign_assets_pending"
  | "campaign_creatives_generation_pending"
  | "campaign_creatives_pending_review"
  | "campaign_final_review_pending"
  | "campaign_ready_for_implementation"
  | "campaign_implemented"
  | "campaign_implementation_failed";

export type CampaignProposalKind =
  | "campaign_creation_proposal"
  | "campaign_adjustment_proposal"
  | "campaign_pause_proposal"
  | "campaign_budget_adjustment_proposal"
  | "campaign_reactivation_proposal";

export interface ParentPlanContext {
  id: string;
  tenant_id: string;
  channel: string | null;
  session_id: string | null;
  analysis_run_id: string | null;
  ad_account_id?: string | null;
  /** Defaults da conta (página, IG, pixel etc.) resolvidos server-side. */
  account_defaults?: AccountDefaults | null;
}

export interface CampaignProposalRecord {
  tenant_id: string;
  session_id: string | null;
  channel: string;
  action_type: "campaign_proposal";
  status: "pending_approval";
  action_data: Record<string, unknown>;
  reasoning: string | null;
  expected_impact: string | null;
  confidence: string | null;
  parent_action_id: string;
  planned_action_index: number;
  analysis_run_id: string | null;
  policy_engine_version: null;
}

// ---------------- Classificação de tipo de proposta -----------------

function classifyProposalKind(action: any): CampaignProposalKind {
  const raw = String(action?.action_type || "").toLowerCase();
  const intent = String(action?.campaign_intent || "").toLowerCase();
  if (raw.includes("pause") || raw === "pause_campaign") return "campaign_pause_proposal";
  if (raw.includes("reactivat") || intent === "reactivation") return "campaign_reactivation_proposal";
  if (raw.includes("scale") || raw.includes("reduce") || raw === "adjust_budget" || raw === "allocate_budget" || raw.includes("budget"))
    return "campaign_budget_adjustment_proposal";
  if (raw.includes("create") || raw.includes("duplicate") || raw.includes("launch")) return "campaign_creation_proposal";
  if (raw.includes("adjust") || raw.includes("optimi") || raw.includes("revise")) return "campaign_adjustment_proposal";
  return "campaign_adjustment_proposal";
}

// ---------------- Identidade da conta (campo Identity) ---------------

function buildIdentitySnapshot(action: any, defaults?: AccountDefaults | null) {
  const d = defaults || null;
  const utmFromAction = action?.utm || action?.utm_base || null;
  return {
    facebook_page_id: action?.facebook_page_id || d?.facebook_page_id || null,
    facebook_page_name: d?.facebook_page_name || null,
    instagram_actor_id: action?.instagram_actor_id || d?.instagram_actor_id || null,
    instagram_actor_name: d?.instagram_actor_name || null,
    pixel_id: action?.pixel_id || d?.pixel_id || null,
    pixel_name: d?.pixel_name || null,
    conversion_event_default: action?.conversion_event || d?.conversion_event_default || null,
    attribution_window: action?.attribution_window || d?.attribution_window || null,
    utm_base: utmFromAction || d?.default_utm_params || null,
    cta_default: action?.cta_default || d?.default_cta || null,
    conversions_api_active: !!d?.conversions_api_active,
    source: d?.source || "none",
  };
}

// ---------------- Snapshot da campanha ------------------------------

function brlToCents(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : null;
  return n !== null && Number.isFinite(n) ? Math.round(n * 100) : null;
}

function pickFunnelShareCents(defaults: AccountDefaults | null | undefined, funnelStage: string | null): number | null {
  if (!defaults?.default_daily_budget_cents || !defaults?.funnel_splits) return defaults?.default_daily_budget_cents ?? null;
  const total = Number(defaults.default_daily_budget_cents);
  const fs = defaults.funnel_splits as any;
  const stage = String(funnelStage || "").toLowerCase();
  const key =
    stage.includes("test") ? "tests"
    : stage.includes("remark") || stage.includes("warm") ? "remarketing"
    : stage.includes("cold") || stage.includes("frio") || stage.includes("prosp") ? "cold"
    : stage.includes("lead") ? "leads"
    : null;
  const pct = key && typeof fs[key] === "number" ? Number(fs[key]) : null;
  if (!pct || pct <= 0) return total;
  return Math.max(1000, Math.round((total * pct) / 100)); // mínimo R$ 10,00/dia
}

function autoCampaignName(action: any, kind: CampaignProposalKind): string {
  const stage = String(action?.funnel_stage || action?.affected_funnel || "").toLowerCase();
  const label =
    kind === "campaign_creation_proposal" ? "Criação"
    : stage.includes("test") ? "Teste"
    : stage.includes("remark") || stage.includes("warm") ? "Remarketing"
    : stage.includes("cold") || stage.includes("frio") ? "Frio"
    : "Campanha";
  const prod = (action?.product_name || action?.product || "").toString().trim().slice(0, 40) || "Geral";
  const d = new Date();
  const ymd = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `[${label}] ${prod} — ${ymd}`;
}

function buildCampaignSnapshot(action: any, defaults?: AccountDefaults | null, kind: CampaignProposalKind = "campaign_adjustment_proposal") {
  const funnelStage = action?.funnel_stage || action?.affected_funnel || null;
  const dailyBudgetCents =
    action?.daily_budget_cents
    ?? action?.budget_cents
    ?? brlToCents(action?.daily_budget_brl)
    ?? brlToCents(action?.budget_brl)
    ?? pickFunnelShareCents(defaults || null, funnelStage)
    ?? null;
  return {
    name: action?.campaign_name || action?.name || autoCampaignName(action, kind),
    objective: action?.objective || defaults?.default_objective || null,
    buying_type: action?.buying_type || defaults?.default_buying_type || "AUCTION",
    budget_type: action?.budget_type || defaults?.default_budget_type || (dailyBudgetCents ? "daily" : null),
    daily_budget_cents: dailyBudgetCents,
    initial_status_planned: action?.initial_status || defaults?.default_planned_status || "PAUSED",
    planned_status: action?.initial_status || defaults?.default_planned_status || "PAUSED",
    campaign_type: action?.campaign_type || null,
    campaign_intent: action?.campaign_intent || null,
    product: action?.product_name || action?.product || null,
    product_id: action?.product_id || null,
    funnel_stage: funnelStage,
    affected_funnel: action?.affected_funnel || null,
    rationale: action?.rationale || null,
    risks: action?.risks || null,
    dependencies: action?.dependencies || null,
    utm_base: action?.utm || action?.utm_base || defaults?.default_utm_params || null,
    attribution_window: action?.attribution_window || defaults?.attribution_window || null,
    audience_budget_fit: action?.audience_budget_fit || null,
    budget_source: action?.budget_source || (dailyBudgetCents && !action?.daily_budget_cents ? "funnel_share_fallback" : null),
    existing_campaign_id: action?.target_campaign_id || action?.campaign_id || null,
    existing_campaign_action: action?.existing_campaign_action || null,
  };
}


// ---------------- Snapshot de conjuntos -----------------------------

function buildAdsetsSnapshot(action: any, defaults?: AccountDefaults | null): any[] {
  const adsets = Array.isArray(action?.adsets) ? action.adsets : [];
  return adsets.map((adset: any, i: number) => {
    const ageMin = adset?.age_min ?? adset?.targeting?.age_min ?? defaults?.default_age_min ?? null;
    const ageMax = adset?.age_max ?? adset?.targeting?.age_max ?? defaults?.default_age_max ?? null;
    const placements = Array.isArray(adset?.placements) ? adset.placements
      : Array.isArray(defaults?.default_placements) ? defaults!.default_placements : null;
    return {
      index: i,
      name: adset?.adset_name || adset?.name || `Conjunto ${i + 1}`,
      audience: adset?.audience || adset?.audience_name || adset?.audience_description || null,
      targeting: adset?.targeting || null,
      audience_exclusions: adset?.audience_exclusions || null,
      excluded_audience_ids: adset?.excluded_audience_ids || null,
      age_min: ageMin,
      age_max: ageMax,
      age_range: (ageMin || ageMax) ? `${ageMin ?? 18}-${ageMax ?? 65}` : null,
      gender: adset?.gender || defaults?.default_gender || null,
      location: adset?.location || defaults?.default_country || null,
      daily_budget_cents: adset?.daily_budget_cents ?? brlToCents(adset?.budget_brl) ?? null,
      placements,
      optimization_goal: adset?.optimization_goal || null,
      conversion_event: adset?.conversion_event || adset?.optimization_event || defaults?.conversion_event_default || null,
      schedule: adset?.schedule || { start: "Imediato após aprovação", end: "Sem data final" },
      required_audiences: adset?.required_audiences || null,
      required_lookalikes: adset?.required_lookalikes || null,
      required_catalogs: (adset?.required_catalogs || adset?.product_catalog_id) ? {
        catalog_id: adset?.product_catalog_id || null,
        product_set: adset?.product_set || null,
      } : null,
      pending_dependencies: adset?.pending_dependency || adset?.pending_dependencies || null,
    };
  });
}

// ---------------- Snapshot de criativos planejados ------------------

/**
 * H.2.2 — Vincula cada anúncio planejado a um conjunto e enriquece com
 * campos estruturais H.2 (creative_source, destination_type, planned_cta,
 * utm_template, linked_adset_name/key/index, resolution_phase).
 *
 * Não inventa copy, asset, ID Meta ou URL final. Não chama IA nem Meta.
 */
function buildPlannedCreativesSnapshot(
  action: any,
  adsetsSnapshot: any[],
  kind: CampaignProposalKind,
  defaults?: AccountDefaults | null,
  options?: { strategyTag?: string | null; objectiveCanonical?: string | null; productUrl?: string | null },
): any[] {
  const raw = Array.isArray(action?.creatives) ? action.creatives
    : Array.isArray(action?.planned_creatives) ? action.planned_creatives
    : Array.isArray(action?.ads) ? action.ads
    : [];

  const isTesting = String(options?.strategyTag || "").toLowerCase() === "testing";
  const objCanon = options?.objectiveCanonical || null;
  // H.2.3 — CTA padrão derivado do objetivo (não da conta).
  const ctaFromObjective = objCanon === "sales" ? "SHOP_NOW"
    : objCanon === "leads" ? "SIGN_UP"
    : objCanon === "traffic" ? "LEARN_MORE"
    : null;
  // H.2.3 — Link de destino sai do produto/oferta, NUNCA de URL fixa da conta.
  const productUrl = options?.productUrl || action?.product_url || action?.destination_url || null;

  const adsetName = (i: number) =>
    (adsetsSnapshot[i] && (adsetsSnapshot[i].name as string | null)) || `Conjunto ${i + 1}`;

  const enrich = (c: any, idx: number, adsetIdx: number) => {
    // H.2.3 — Em [Teste], formato é variável do teste (decidido na H.4).
    const planned_format = isTesting
      ? null
      : (c?.format || defaults?.default_creative_format || null);
    const planned_cta = c?.cta || c?.call_to_action || ctaFromObjective || null;
    const cta_source: "ad_override" | "objective_default" | null =
      c?.cta || c?.call_to_action ? "ad_override"
      : ctaFromObjective ? "objective_default"
      : null;
    const planned_destination_url = c?.destination_url || c?.final_url || c?.final_url_with_utm || productUrl || null;
    const destination_source: "ad_override" | "product_offer" | null =
      c?.destination_url || c?.final_url || c?.final_url_with_utm ? "ad_override"
      : productUrl ? "product_offer"
      : null;

    return {
      index: idx,
      adset_index: adsetIdx,
      adset_key: `adset_${adsetIdx}`,
      linked_adset_name: adsetName(adsetIdx),
      quantity: c?.quantity ?? 1,
      format: planned_format,
      angle: c?.angle || null,
      promise: c?.promise || null,
      primary_text: c?.copy || c?.primary_text || null,
      headline: c?.headline || null,
      description: c?.description || null,
      cta: planned_cta,
      cta_source,
      destination_url: planned_destination_url,
      destination_source,
      destination_pending_reason: !planned_destination_url ? "product_offer_url_missing" : null,
      visual_prompt: c?.visual_prompt || c?.prompt || null,
      reference: c?.reference || c?.reference_asset_id || null,
      generation_status: (c?.generation_status || "planned_only") as
        "planned_only" | "placeholder_pending_strategy_fill",
      // ---------- Campos estruturais H.2 (Onda H.2.2/H.2.3) ----------
      creative_source: defaults?.default_creative_format === "catalog" ? "catalog" : "manual",
      destination_type: "website",
      planned_cta,
      utm_template: defaults?.default_utm_params || null,
      /** Mapa por campo: o que pertence a H.2 estrutural × H.4 futuro × config Meta. */
      resolution_phase: {
        adset_link: "h2_structural",
        // H.2.3 — em [Teste], formato vira variável do teste (H.4).
        format: isTesting ? "h4_future" : "h2_structural",
        cta: "h2_structural",
        destination_url: "h2_structural",
        utm_template: "h2_structural",
        primary_text: "h4_future",
        headline: "h4_future",
        description: "h4_future",
        visual_prompt: "h4_future",
        reference: "h4_future",
        creative_final_url: "h4_future",
        creative_id: "publication_final",
      } as const,
    };
  };

  // Caso 1 — IA forneceu criativos explícitos: respeitar mapping vindo
  // (adset_index), com fallback determinístico para o índice posicional.
  if (raw.length > 0) {
    return raw.map((c: any, i: number) => {
      const a = typeof c?.adset_index === "number" && c.adset_index >= 0
        ? Math.min(c.adset_index, Math.max(0, adsetsSnapshot.length - 1))
        : Math.min(i, Math.max(0, adsetsSnapshot.length - 1));
      return enrich(c, i, a);
    });
  }

  // Caso 2 — sem criativos vindos da estratégia. Geramos 1 placeholder por
  // conjunto (paridade 1↔1) para criação/ajuste; demais kinds ficam vazios.
  const needsPlaceholders = (kind === "campaign_creation_proposal" || kind === "campaign_adjustment_proposal")
    && adsetsSnapshot.length > 0;

  if (!needsPlaceholders) return [];

  return adsetsSnapshot.map((_adset, i) => enrich(
    {
      generation_status: "placeholder_pending_strategy_fill",
    },
    i,
    i,
  ));
}

// ---------------- Validações herdadas do plano ---------------------

function buildValidationsSnapshot(action: any) {
  return {
    utm_present: !!(action?.utm || action?.utm_base),
    cold_audience_exclusion_present:
      action?.audience_exclusions?.customers === true ||
      Array.isArray(action?.adsets) && action.adsets.some((a: any) => a?.audience_exclusions?.customers === true),
    blockers: Array.isArray(action?.blockers) ? action.blockers : [],
    warnings: Array.isArray(action?.warnings) ? action.warnings : [],
    pending_dependencies: action?.pending_dependency
      ? [action.pending_dependency]
      : Array.isArray(action?.pending_dependencies) ? action.pending_dependencies : [],
  };
}

// ---------------- Onda H.2.1 — Contrato v1.1 (enricher inline) -------
// Réplica determinística da derivação em
// src/lib/ads/contracts/campaignProposalV1_1.ts — mantenha em sincronia.

function inferObjectiveCanonical(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const k = String(raw).trim().toLowerCase();
  if (["sales","outcome_sales","purchases","conversions","vendas"].includes(k)) return "sales";
  if (["leads","outcome_leads","lead_generation"].includes(k)) return "leads";
  if (["traffic","outcome_traffic","trafego","tráfego"].includes(k)) return "traffic";
  if (["awareness","outcome_awareness","reach","brand_awareness"].includes(k)) return "awareness";
  if (["engagement","outcome_engagement"].includes(k)) return "engagement";
  if (["app_promotion","outcome_app_promotion","app"].includes(k)) return "app_promotion";
  return null;
}

function inferStrategyTag(ctype: string | null | undefined): string | null {
  if (!ctype) return null;
  const k = String(ctype).toLowerCase();
  if (k === "testing" || k.includes("test")) return "testing";
  if (k === "catalog_prospecting") return "catalog_prospecting";
  if (k === "catalog_retargeting") return "catalog_retargeting";
  if (k.includes("retarget") || k.includes("remark")) return "retargeting";
  if (k.includes("prospect") || k.includes("cold")) return "prospecting";
  if (k.includes("creat") || k.includes("launch")) return "creation";
  return null;
}

function enrichRecordWithV1_1Contract(record: CampaignProposalRecord, parent: ParentPlanContext): void {
  const data = record.action_data as any;
  const campaign = data.campaign as any;
  const adsets: any[] = Array.isArray(data.adsets) ? data.adsets : [];

  const platform = String(campaign?.platform || parent.channel || "meta").toLowerCase();
  const objectiveCanonical = inferObjectiveCanonical(campaign?.objective);
  const platformObjective = objectiveCanonical === "sales" ? "OUTCOME_SALES"
    : objectiveCanonical === "leads" ? "OUTCOME_LEADS"
    : objectiveCanonical === "traffic" ? "OUTCOME_TRAFFIC"
    : objectiveCanonical === "awareness" ? "OUTCOME_AWARENESS"
    : objectiveCanonical === "engagement" ? "OUTCOME_ENGAGEMENT"
    : objectiveCanonical === "app_promotion" ? "OUTCOME_APP_PROMOTION"
    : null;

  let contract_validation_status: "ok" | "pending_dependency" | "blocked" = "ok";
  let unsupported_reason: string | null = null;
  if (platform !== "meta") {
    unsupported_reason = `A plataforma "${platform}" ainda não está disponível nesta fase do Gestor de Tráfego IA. Apenas Meta Ads está habilitado.`;
    contract_validation_status = "blocked";
  } else if (!objectiveCanonical) {
    unsupported_reason = "Não conseguimos identificar o objetivo desta proposta. Apenas o objetivo de Vendas está disponível nesta fase.";
    contract_validation_status = "blocked";
  } else if (objectiveCanonical !== "sales") {
    const label = objectiveCanonical === "leads" ? "Geração de leads"
      : objectiveCanonical === "traffic" ? "Tráfego"
      : objectiveCanonical === "awareness" ? "Reconhecimento de marca"
      : objectiveCanonical === "engagement" ? "Engajamento"
      : objectiveCanonical === "app_promotion" ? "Promoção de aplicativo"
      : objectiveCanonical;
    unsupported_reason = `O objetivo "${label}" ainda não está disponível nesta fase. Apenas o objetivo de Vendas está habilitado.`;
    contract_validation_status = "blocked";
  }

  const strategyTag = inferStrategyTag(campaign?.campaign_type);
  const salesSubtype = (strategyTag === "catalog_prospecting" || strategyTag === "catalog_retargeting"
    || String(campaign?.sales_subtype || "").toLowerCase() === "advantage_plus_shopping")
    ? "advantage_plus_shopping" : "manual_sales";

  const campaignCents = typeof campaign?.daily_budget_cents === "number" && campaign.daily_budget_cents > 0 ? campaign.daily_budget_cents : null;
  const adsetHasBudget = adsets.some((a) => typeof a?.daily_budget_cents === "number" && a.daily_budget_cents > 0);

  let budget_mode: "CBO" | "ABO";
  let finalCampaignCents: number | null;
  if (strategyTag === "testing") {
    budget_mode = "ABO";
    finalCampaignCents = null;
    if (!adsetHasBudget && campaignCents && adsets.length > 0) {
      const base = Math.floor(campaignCents / adsets.length);
      const remainder = campaignCents - base * adsets.length;
      adsets.forEach((a, i) => {
        a.daily_budget_cents = base + (i === adsets.length - 1 ? remainder : 0);
        a.budget_distribution_estimate = null;
      });
    } else {
      adsets.forEach((a) => { a.budget_distribution_estimate = null; });
    }
  } else {
    budget_mode = "CBO";
    finalCampaignCents = campaignCents;
    adsets.forEach((a) => {
      a.budget_distribution_estimate = typeof a?.daily_budget_cents === "number" && a.daily_budget_cents > 0
        ? a.daily_budget_cents : null;
      a.daily_budget_cents = null;
    });
  }

  const requires_catalog = salesSubtype === "advantage_plus_shopping";
  if (requires_catalog && !campaign?.product_catalog_id && contract_validation_status === "ok") {
    contract_validation_status = "pending_dependency";
  }

  campaign.platform = platform;
  campaign.platform_objective = platformObjective;
  campaign.objective_canonical = objectiveCanonical;
  campaign.sales_subtype = salesSubtype;
  campaign.internal_strategy_tag = strategyTag;
  campaign.budget_mode = budget_mode;
  campaign.daily_budget_cents = finalCampaignCents;
  campaign.requires_catalog = requires_catalog;

  data.platform = platform;
  data.contract_version = "campaign_proposal_v1_1";
  data.contract_validation_status = contract_validation_status;
  data.unsupported_reason = unsupported_reason;

  // ---- H.2.2: Paridade [Teste]/ABO — 1 anúncio por conjunto -------------
  // Determinístico: se planned_creatives.length === adsets.length, força
  // vínculo posicional. Se houver placeholder, expande até a contagem dos
  // conjuntos. Se houver mismatch ambíguo (planned > adsets ou planned ≠ 0
  // e ≠ adsets sem placeholders), marca pending_dependency em vez de inventar.
  if (strategyTag === "testing" && budget_mode === "ABO") {
    const planned: any[] = Array.isArray(data.planned_creatives) ? data.planned_creatives : [];
    const allPlaceholder = planned.length > 0 && planned.every(
      (p) => p?.generation_status === "placeholder_pending_strategy_fill",
    );
    const adsetName = (i: number) =>
      (adsets[i] && (adsets[i].name as string | null)) || `Conjunto ${i + 1}`;

    if (planned.length === adsets.length && planned.length > 0) {
      // Reforça vínculo posicional explicitamente.
      planned.forEach((p, i) => {
        p.adset_index = i;
        p.adset_key = `adset_${i}`;
        p.linked_adset_name = adsetName(i);
      });
    } else if (allPlaceholder && adsets.length > 0) {
      // Reexpande placeholders 1:1 (idempotente).
      data.planned_creatives = adsets.map((_, i) => {
        const base = planned[i] || planned[0] || {};
        return {
          ...base,
          index: i,
          adset_index: i,
          adset_key: `adset_${i}`,
          linked_adset_name: adsetName(i),
          generation_status: "placeholder_pending_strategy_fill",
        };
      });
    } else if (planned.length === 0 && adsets.length > 0) {
      // Sem criativos: o builder já gera placeholders 1:1. Nada a fazer.
    } else {
      // Mismatch ambíguo — não inventa, marca pendência declarada.
      if (contract_validation_status === "ok") contract_validation_status = "pending_dependency";
      data.contract_validation_status = contract_validation_status;
      data.testing_abo_pairing_status = "mismatch_pending_user_decision";
      data.testing_abo_pairing_note =
        `Esta campanha de teste em ABO tem ${planned.length} anúncio(s) planejado(s) para ${adsets.length} conjunto(s). ` +
        "A paridade 1:1 não pôde ser resolvida automaticamente. Ajuste antes de aprovar.";
    }
  }

  // ---- H.2.2: recompute pending_fields/meta_step_checklist com fase ------
  try {
    const report = computePendingFields({
      campaign: campaign as any,
      adsets: adsets as any,
      planned_creatives: (data.planned_creatives as any[]) || [],
      identity: (data.identity as any) || {},
      budget_mode: budget_mode,
    });
    data.pending_fields = report.pending;
    data.pending_fields_total = report.total;
    data.meta_step_checklist = report.meta_step_checklist;
    data.objective_contract_label_pt = report.contract_label_pt;
    data.contract_phase_version = report.contract_phase_version;
  } catch (_) {
    // Sem objetivo canônico — mantemos os campos inicializados vazios.
  }
}

// ---------------- Construção do registro ---------------------------

function buildProposalRecord(
  action: any,
  index: number,
  parent: ParentPlanContext,
  plan: any,
): CampaignProposalRecord {
  const kind = classifyProposalKind(action);
  const defaults = parent.account_defaults || null;
  const identity = buildIdentitySnapshot(action, defaults);
  const campaignSnapshot = buildCampaignSnapshot(action, defaults, kind);
  const adsetsSnapshot = buildAdsetsSnapshot(action, defaults);
  // H.2.3 — passa strategy_tag e objetivo canônico para o builder de criativos
  // resolver CTA padrão por objetivo, formato como variável em [Teste] e
  // link de destino vindo do produto/oferta (não da conta).
  const strategyTagPre = inferStrategyTag(action?.campaign_type || campaignSnapshot?.campaign_type);
  const objectiveCanonPre = inferObjectiveCanonical(campaignSnapshot?.objective);
  const productUrlPre = action?.product_url || action?.preview?.product_url || null;
  const creativesSnapshot = buildPlannedCreativesSnapshot(action, adsetsSnapshot, kind, defaults, {
    strategyTag: strategyTagPre,
    objectiveCanonical: objectiveCanonPre,
    productUrl: productUrlPre,
  });
  const validations = buildValidationsSnapshot(action);

  // H.2.2 — Pendências são computadas DEPOIS de o contrato v1.1 decidir
  // budget_mode (a regra muda se ABO/CBO). Aqui apenas inicializamos vazio.
  const pendingReport: PendingFieldsReport = {
    objective: null,
    contract_label_pt: null,
    pending: [],
    total: 0,
    meta_step_checklist: [],
    contract_phase_version: "h22_v1",
  };


  const adAccountId = parent.ad_account_id
    || plan?.ad_account_id
    || plan?.metadata?.campaign_account_snapshot?.[0]?.ad_account_id
    || action?.ad_account_id
    || null;

  return {
    tenant_id: parent.tenant_id,
    session_id: parent.session_id ?? null,
    channel: parent.channel || "meta",
    action_type: "campaign_proposal",
    status: "pending_approval",
    reasoning: action?.rationale || action?.reasoning || null,
    expected_impact: action?.expected_impact || null,
    confidence: action?.confidence || null,
    parent_action_id: parent.id,
    planned_action_index: index,
    analysis_run_id: parent.analysis_run_id ?? null,
    policy_engine_version: null,
    action_data: {
      schema_version: CAMPAIGN_PROPOSAL_SCHEMA_VERSION,
      lifecycle: {
        version: CAMPAIGN_PROPOSAL_LIFECYCLE_VERSION,
        status: "campaign_proposal_pending_review" as CampaignProposalLifecycleStatus,
        created_at: new Date().toISOString(),
      },
      kind,
      source_plan_id: parent.id,
      planned_action_index: index,
      ad_account_id: adAccountId,
      identity,
      campaign: campaignSnapshot,
      adsets: adsetsSnapshot,
      planned_creatives: creativesSnapshot,
      validations,
      pending_fields: pendingReport.pending,
      pending_fields_total: pendingReport.total,
      meta_step_checklist: pendingReport.meta_step_checklist,
      objective_contract_label_pt: pendingReport.contract_label_pt,
      raw_planned_action: action,
      inherited_contract: {
        plan_schema_version: plan?.metadata?.schema_version || null,
        plan_contract_version: plan?.contract?.version || null,
        plan_is_approvable: plan?.metadata?.is_approvable ?? null,
        plan_validation_status: plan?.metadata?.validation_status || null,
      },
    },
  };
}

// ---------------- API pública --------------------------------------

export interface BuildResult {
  records: CampaignProposalRecord[];
  skipped_reasons: string[];
}

export function buildCampaignProposalsFromApprovedPlan(
  plan: any,
  parent: ParentPlanContext,
): BuildResult {
  const skipped: string[] = [];
  if (!plan || typeof plan !== "object") {
    return { records: [], skipped_reasons: ["plan_payload_invalid"] };
  }
  const plannedActions = Array.isArray(plan?.planned_actions) ? plan.planned_actions : [];
  if (plannedActions.length === 0) {
    return { records: [], skipped_reasons: ["no_planned_actions"] };
  }

  const records: CampaignProposalRecord[] = [];
  for (let i = 0; i < plannedActions.length; i++) {
    const action = plannedActions[i];
    if (!action || typeof action !== "object") {
      skipped.push(`index_${i}_not_object`);
      continue;
    }
    const rec = buildProposalRecord(action, i, parent, plan);
    enrichRecordWithV1_1Contract(rec, parent);
    records.push(rec);
  }

  return { records, skipped_reasons: skipped };
}
