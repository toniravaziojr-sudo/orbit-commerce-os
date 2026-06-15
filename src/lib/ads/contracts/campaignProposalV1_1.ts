// =============================================================================
// campaign_proposal_v1_1 — Onda H.2.1 (contrato versionado Meta Vendas)
//
// Função PURA. Não chama IA, Meta, banco nem rede.
// Centraliza a derivação determinística de campos novos do contrato v1.1 a
// partir do payload v1 (legado) ou v1.1 já gravado. Usada por:
//   - normalizador da UI (runtime fallback);
//   - gerador shared (emissão de novas propostas);
//   - testes unitários;
//   - função SQL idempotente de patch das propostas existentes (lógica
//     replicada em SQL — qualquer mudança aqui deve ser refletida lá).
//
// REGRAS INVIOLÁVEIS:
//   - Não inventa defaults de configuração Meta (pixel, evento, UTM, CTA).
//   - Plataforma/objetivo sem contrato real → blocked + unsupported_reason.
//   - Nunca mistura CBO e ABO no mesmo payload — bloqueia mixed_budget_modes.
//   - Catálogo só é exigido para sales_subtype = advantage_plus_shopping.
// =============================================================================

export const CAMPAIGN_PROPOSAL_V1_1 = "campaign_proposal_v1_1" as const;
export const CAMPAIGN_PROPOSAL_V1 = "campaign_proposal_v1" as const;

export type BudgetMode = "CBO" | "ABO";
export type SalesSubtype = "advantage_plus_shopping" | "manual_sales";
export type InternalStrategyTag =
  | "prospecting"
  | "retargeting"
  | "creation"
  | "testing"
  | "catalog_prospecting"
  | "catalog_retargeting";
export type ContractValidationStatus = "ok" | "pending_dependency" | "blocked";
export type CreativeSource = "manual" | "catalog";
export type DestinationType = "website" | "catalog_pdp";

export interface ContractV1_1Derivation {
  contract_version: typeof CAMPAIGN_PROPOSAL_V1_1;
  platform: "meta" | string;
  platform_objective: string | null;
  objective_canonical: string | null;
  sales_subtype: SalesSubtype | null;
  internal_strategy_tag: InternalStrategyTag | null;
  budget_mode: BudgetMode | null;
  campaign_budget_cents: number | null;
  adset_budget_cents_by_index: Record<number, number | null>;
  budget_distribution_estimate_by_index: Record<number, number | null>;
  requires_catalog: boolean;
  product_catalog_id: string | null;
  product_set_id: string | null;
  creative_source: CreativeSource;
  creative_format: string | null;
  destination_type: DestinationType;
  destination_url: string | null;
  utm_template: string | Record<string, string> | null;
  cta_source: string | null;
  unsupported_reason: string | null;
  contract_validation_status: ContractValidationStatus;
  notes: string[];
}

const SUPPORTED_PLATFORMS_THIS_WAVE = new Set(["meta"]);
const SUPPORTED_OBJECTIVES_THIS_WAVE = new Set(["sales"]);

function isPositiveNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

function inferPlatform(payload: any, channel: string | null | undefined): string {
  const explicit = payload?.platform || payload?.campaign?.platform || channel;
  if (typeof explicit === "string" && explicit.trim().length > 0) {
    return String(explicit).toLowerCase();
  }
  // sem origem real → assume "meta" só se não for nada (default histórico do módulo).
  return "meta";
}

function inferObjectiveCanonical(payload: any): string | null {
  const raw = String(payload?.campaign?.objective || payload?.objective || "").toLowerCase().trim();
  if (!raw) return null;
  if (["sales", "outcome_sales", "purchases", "conversions", "vendas"].includes(raw)) return "sales";
  if (["leads", "outcome_leads", "lead_generation"].includes(raw)) return "leads";
  if (["traffic", "outcome_traffic", "tráfego", "trafego"].includes(raw)) return "traffic";
  if (["awareness", "outcome_awareness", "reach", "brand_awareness"].includes(raw)) return "awareness";
  if (["engagement", "outcome_engagement"].includes(raw)) return "engagement";
  if (["app_promotion", "outcome_app_promotion", "app"].includes(raw)) return "app_promotion";
  return null;
}

function inferInternalStrategyTag(payload: any): InternalStrategyTag | null {
  const ct = String(payload?.campaign?.campaign_type || payload?.campaign_type || "").toLowerCase();
  if (!ct) return null;
  if (ct === "testing" || ct.includes("test")) return "testing";
  if (ct === "catalog_prospecting") return "catalog_prospecting";
  if (ct === "catalog_retargeting") return "catalog_retargeting";
  if (ct === "retargeting" || ct.includes("retarget") || ct.includes("remark")) return "retargeting";
  if (ct === "prospecting" || ct.includes("prospect") || ct.includes("cold")) return "prospecting";
  if (ct.includes("creat") || ct.includes("launch")) return "creation";
  return null;
}

function inferSalesSubtype(strategyTag: InternalStrategyTag | null, payload: any): SalesSubtype {
  // Catálogo: só explicitamente catalog_* ou campo direto.
  if (strategyTag === "catalog_prospecting" || strategyTag === "catalog_retargeting") {
    return "advantage_plus_shopping";
  }
  const explicit = String(payload?.campaign?.sales_subtype || payload?.sales_subtype || "").toLowerCase();
  if (explicit === "advantage_plus_shopping") return "advantage_plus_shopping";
  return "manual_sales";
}

interface AdsetBudgetView {
  index: number;
  cents: number | null;
}

function readAdsetBudgets(payload: any): AdsetBudgetView[] {
  const adsets: any[] = Array.isArray(payload?.adsets) ? payload.adsets : [];
  return adsets.map((a, i) => ({
    index: typeof a?.index === "number" ? a.index : i,
    cents: isPositiveNumber(a?.daily_budget_cents) ? a.daily_budget_cents : null,
  }));
}

/**
 * Decide CBO vs ABO sem ambiguidade.
 *
 * Regras (estritas, decisão aprovada Onda H.2.1):
 *   - internal_strategy_tag === "testing" → SEMPRE ABO. Orçamento real fica por
 *     conjunto; campaign_budget zera. Se nenhum conjunto tem orçamento ainda,
 *     distribui o valor da campanha igualmente entre os conjuntos.
 *   - demais (prospecting, retargeting, creation, catalog_*) → SEMPRE CBO.
 *     campaign_budget fica; adset_budgets ficam null.
 *   - Se o explícito `budget_mode` do payload contradiz a regra acima, prevalece
 *     a regra (consistência > input legado).
 */
function decideBudgetMode(
  strategyTag: InternalStrategyTag | null,
  campaignCents: number | null,
  adsetBudgets: AdsetBudgetView[],
): {
  mode: BudgetMode;
  campaign_budget_cents: number | null;
  adset_budget_cents_by_index: Record<number, number | null>;
  budget_distribution_estimate_by_index: Record<number, number | null>;
  notes: string[];
} {
  const notes: string[] = [];

  if (strategyTag === "testing") {
    // ABO — distribui campanha entre conjuntos se conjuntos vazios.
    const hasAnyAdsetBudget = adsetBudgets.some((a) => isPositiveNumber(a.cents));
    let perAdset: Record<number, number | null> = {};
    if (hasAnyAdsetBudget) {
      // Mantém o que já existe; null vira null.
      adsetBudgets.forEach((a) => { perAdset[a.index] = a.cents; });
      const filled = adsetBudgets.filter((a) => isPositiveNumber(a.cents)).length;
      if (filled < adsetBudgets.length) {
        notes.push(`abo_partial_budgets:${filled}/${adsetBudgets.length}`);
      }
    } else if (isPositiveNumber(campaignCents) && adsetBudgets.length > 0) {
      // Distribui igualmente e ajusta o resto no último conjunto (determinístico).
      const n = adsetBudgets.length;
      const base = Math.floor(campaignCents / n);
      const remainder = campaignCents - base * n;
      adsetBudgets.forEach((a, i) => {
        perAdset[a.index] = base + (i === n - 1 ? remainder : 0);
      });
      notes.push("abo_split_from_campaign_budget");
    } else {
      adsetBudgets.forEach((a) => { perAdset[a.index] = null; });
      notes.push("abo_no_budget_available");
    }
    return {
      mode: "ABO",
      campaign_budget_cents: null,
      adset_budget_cents_by_index: perAdset,
      budget_distribution_estimate_by_index: {},
      notes,
    };
  }

  // CBO — orçamento na campanha; estimativa nos conjuntos é informativa.
  const distribution: Record<number, number | null> = {};
  adsetBudgets.forEach((a) => {
    if (isPositiveNumber(a.cents)) distribution[a.index] = a.cents;
  });
  if (Object.keys(distribution).length > 0) {
    notes.push("cbo_estimate_kept_from_legacy_adset_budgets");
  }
  const perAdset: Record<number, number | null> = {};
  adsetBudgets.forEach((a) => { perAdset[a.index] = null; });
  return {
    mode: "CBO",
    campaign_budget_cents: isPositiveNumber(campaignCents) ? campaignCents : null,
    adset_budget_cents_by_index: perAdset,
    budget_distribution_estimate_by_index: distribution,
    notes,
  };
}

function pickFirstString(...vals: unknown[]): string | null {
  for (const v of vals) {
    if (typeof v === "string" && v.trim().length > 0) return v;
  }
  return null;
}

interface DeriveInput {
  action_data: any;
  channel?: string | null;
  /** selected_assets[*].catalogs determinísticos do tenant; só usado se exatamente 1. */
  cached_catalogs?: Array<{ id: string; name?: string | null }>;
}

/**
 * Derivação principal — pura, determinística, idempotente.
 */
export function deriveCampaignProposalV1_1(input: DeriveInput): ContractV1_1Derivation {
  const data = input.action_data || {};
  const channel = input.channel || data?.channel || null;

  const notes: string[] = [];
  const platform = inferPlatform(data, channel);
  const objectiveCanonical = inferObjectiveCanonical(data);
  const platformObjective = objectiveCanonical === "sales" ? "OUTCOME_SALES"
    : objectiveCanonical === "leads" ? "OUTCOME_LEADS"
    : objectiveCanonical === "traffic" ? "OUTCOME_TRAFFIC"
    : objectiveCanonical === "awareness" ? "OUTCOME_AWARENESS"
    : objectiveCanonical === "engagement" ? "OUTCOME_ENGAGEMENT"
    : objectiveCanonical === "app_promotion" ? "OUTCOME_APP_PROMOTION"
    : null;

  // ---- Fail-closed: escopo desta onda ---------------------------------------
  let unsupported_reason: string | null = null;
  let contract_validation_status: ContractValidationStatus = "ok";

  if (!SUPPORTED_PLATFORMS_THIS_WAVE.has(platform)) {
    unsupported_reason = `A plataforma "${platform}" ainda não está disponível nesta fase do Gestor de Tráfego IA. Apenas Meta Ads está habilitado.`;
    contract_validation_status = "blocked";
  } else if (!objectiveCanonical) {
    unsupported_reason = "Não conseguimos identificar o objetivo desta proposta. Apenas o objetivo de Vendas está disponível nesta fase.";
    contract_validation_status = "blocked";
  } else if (!SUPPORTED_OBJECTIVES_THIS_WAVE.has(objectiveCanonical)) {
    const label = objectiveCanonical === "leads" ? "Geração de leads"
      : objectiveCanonical === "traffic" ? "Tráfego"
      : objectiveCanonical === "awareness" ? "Reconhecimento de marca"
      : objectiveCanonical === "engagement" ? "Engajamento"
      : objectiveCanonical === "app_promotion" ? "Promoção de aplicativo"
      : objectiveCanonical;
    unsupported_reason = `O objetivo "${label}" ainda não está disponível nesta fase. Apenas o objetivo de Vendas está habilitado.`;
    contract_validation_status = "blocked";
  }

  // ---- Tag estratégica e subtipo -------------------------------------------
  const strategyTag = inferInternalStrategyTag(data);
  const salesSubtype = inferSalesSubtype(strategyTag, data);

  // ---- Orçamento CBO/ABO ----------------------------------------------------
  const cpyCampaignCents = isPositiveNumber(data?.campaign?.daily_budget_cents) ? data.campaign.daily_budget_cents : null;
  const adsetBudgets = readAdsetBudgets(data);
  const budgetDecision = decideBudgetMode(strategyTag, cpyCampaignCents, adsetBudgets);
  notes.push(...budgetDecision.notes);

  // Detecção de orçamento misto cru no payload de origem (informativo).
  const hadCampaignBudget = isPositiveNumber(cpyCampaignCents);
  const hadAdsetBudget = adsetBudgets.some((a) => isPositiveNumber(a.cents));
  if (hadCampaignBudget && hadAdsetBudget) {
    notes.push(strategyTag === "testing" ? "resolved_mixed_to_abo" : "resolved_mixed_to_cbo");
  }

  // ---- Catálogo -------------------------------------------------------------
  const requires_catalog = salesSubtype === "advantage_plus_shopping";
  let product_catalog_id: string | null = null;
  let product_set_id: string | null = null;
  if (requires_catalog) {
    const explicit = pickFirstString(data?.campaign?.product_catalog_id, data?.product_catalog_id);
    if (explicit) {
      product_catalog_id = explicit;
    } else if (Array.isArray(input.cached_catalogs) && input.cached_catalogs.length === 1) {
      product_catalog_id = input.cached_catalogs[0].id;
      notes.push("catalog_resolved_from_cache_unique");
    } else if (Array.isArray(input.cached_catalogs) && input.cached_catalogs.length > 1) {
      notes.push("catalog_ambiguous_multiple_cached");
    }
    if (!product_catalog_id && contract_validation_status === "ok") {
      contract_validation_status = "pending_dependency";
    }
    product_set_id = pickFirstString(data?.campaign?.product_set_id, data?.product_set_id);
  }

  // ---- Criativo (estrutura — não conteúdo final) ----------------------------
  const creative_source: CreativeSource = requires_catalog ? "catalog" : "manual";
  const destination_type: DestinationType = requires_catalog ? "catalog_pdp" : "website";

  const firstCreative = Array.isArray(data?.planned_creatives) && data.planned_creatives.length > 0
    ? data.planned_creatives[0]
    : null;
  const creative_format = pickFirstString(
    data?.campaign?.creative_format,
    firstCreative?.format,
    data?.default_creative_format,
  );
  const destination_url = creative_source === "manual"
    ? pickFirstString(firstCreative?.destination_url, firstCreative?.final_url_with_utm, data?.destination_url)
    : null;
  const cta_source = pickFirstString(firstCreative?.cta, data?.identity?.cta_default, data?.default_cta);

  // ---- UTM ------------------------------------------------------------------
  const utm_template = data?.identity?.utm_base || data?.utm_base || data?.default_utm_params || null;

  return {
    contract_version: CAMPAIGN_PROPOSAL_V1_1,
    platform,
    platform_objective: platformObjective,
    objective_canonical: objectiveCanonical,
    sales_subtype: salesSubtype,
    internal_strategy_tag: strategyTag,
    budget_mode: budgetDecision.mode,
    campaign_budget_cents: budgetDecision.campaign_budget_cents,
    adset_budget_cents_by_index: budgetDecision.adset_budget_cents_by_index,
    budget_distribution_estimate_by_index: budgetDecision.budget_distribution_estimate_by_index,
    requires_catalog,
    product_catalog_id,
    product_set_id,
    creative_source,
    creative_format,
    destination_type,
    destination_url,
    utm_template,
    cta_source,
    unsupported_reason,
    contract_validation_status,
    notes,
  };
}

/**
 * Aplica a derivação ao payload original (modo idempotente), devolvendo um
 * NOVO payload v1.1 sem mutar o original. Mantém todos os campos legados.
 */
export function applyV1_1Patch(action_data: any, channel: string | null = null, cached_catalogs: DeriveInput["cached_catalogs"] = []): any {
  const d = deriveCampaignProposalV1_1({ action_data, channel, cached_catalogs });
  const next = JSON.parse(JSON.stringify(action_data || {}));

  next.schema_version = CAMPAIGN_PROPOSAL_V1_1;
  next.contract_version = CAMPAIGN_PROPOSAL_V1_1;
  next.platform = d.platform;

  next.campaign = next.campaign || {};
  next.campaign.platform = d.platform;
  next.campaign.platform_objective = d.platform_objective;
  next.campaign.objective_canonical = d.objective_canonical;
  next.campaign.sales_subtype = d.sales_subtype;
  next.campaign.internal_strategy_tag = d.internal_strategy_tag;
  next.campaign.budget_mode = d.budget_mode;
  next.campaign.daily_budget_cents = d.campaign_budget_cents; // null se ABO
  next.campaign.requires_catalog = d.requires_catalog;
  if (d.product_catalog_id) next.campaign.product_catalog_id = d.product_catalog_id;
  if (d.product_set_id) next.campaign.product_set_id = d.product_set_id;

  if (Array.isArray(next.adsets)) {
    next.adsets = next.adsets.map((a: any, i: number) => {
      const idx = typeof a?.index === "number" ? a.index : i;
      const copy = { ...a, index: idx };
      copy.daily_budget_cents = d.adset_budget_cents_by_index[idx] ?? null;
      const est = d.budget_distribution_estimate_by_index[idx];
      copy.budget_distribution_estimate = typeof est === "number" ? est : null;
      return copy;
    });
  }

  next.contract_validation_status = d.contract_validation_status;
  next.unsupported_reason = d.unsupported_reason;
  next.contract_v1_1_meta = {
    creative_source: d.creative_source,
    destination_type: d.destination_type,
    destination_url: d.destination_url,
    cta_source: d.cta_source,
    creative_format: d.creative_format,
    utm_template: d.utm_template,
    notes: d.notes,
    derived_at: new Date().toISOString(),
  };

  return next;
}
