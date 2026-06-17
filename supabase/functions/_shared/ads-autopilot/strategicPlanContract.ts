// =====================================================================
// Onda G (rev2) — Strategic Plan Contract Validator (fail-closed).
//
// Cruza o JSON devolvido pela IA (strategic_plan tool args) com o
// Preflight determinístico. Se algum requisito obrigatório falhar, o
// plano fica marcado como INVÁLIDO e a UI bloqueia "Aprovar plano".
//
// Não corrige o plano. Não regenera. Não publica. Não chama Meta.
// =====================================================================

import type { StrategicPlanPreflight } from "./strategicPlanPreflight.ts";

export const CONTRACT_VERSION = "1.2.0";
export const PLAN_SCHEMA_VERSION = "strategic_plan_v2";
export const CUSTOMER_AUDIENCE_PENDING_DEPENDENCY = "customer_audience_not_detected" as const;
export const LEGACY_CUSTOMER_AUDIENCE_PENDING_DEPENDENCY = "customer_audience_missing" as const;
export const TEST_NEW_LAUNCH_SKIP_REASON = "test_for_new_or_launch_product" as const;

// Sinais de produto em lançamento/novo (não-carro-chefe). Aplicados a product_name,
// product_lifecycle e tags do action quando disponíveis. Sinais carro-chefe vencem.
const NEW_LAUNCH_PRODUCT_TOKENS = /(lan[cç]amento|novidade|nova f[oó]rmula|rec[eé]m[\s-]?lan[cç]ad[oa]|pr[eé][\s-]?venda|prelan[cç]amento|launch|new product|beta|piloto)/i;
const BESTSELLER_PRODUCT_TOKENS = /(carro[\s-]?chefe|best[\s-]?seller|produto principal|principal|top de vendas|mais vendid[oa])/i;
const NEW_LAUNCH_LIFECYCLE_VALUES = new Set(["new", "launch", "novo", "lancamento", "lançamento", "pre_launch", "pre-launch", "prelaunch"]);
const ESTABLISHED_LIFECYCLE_VALUES = new Set(["established", "bestseller", "carro_chefe", "carro-chefe", "consolidado", "mature"]);

export const CAMPAIGN_TYPE_VALUES = [
  "prospecting",
  "retargeting",
  "catalog_prospecting",
  "catalog_retargeting",
  "testing",
] as const;
export type CampaignType = typeof CAMPAIGN_TYPE_VALUES[number];

export const CAMPAIGN_INTENT_VALUES = [
  "acquisition",
  "retention",
  "creative_test",
  "offer_test",
  "scale",
  "reactivation",
] as const;
export type CampaignIntent = typeof CAMPAIGN_INTENT_VALUES[number];

export const BUDGET_SOURCE_VALUES = [
  "free_now",
  "released_by_previous_action",
  "test_allocation",
  "retained_existing_budget",
  "reallocated_budget",
  "insufficient_budget_pending_action",
] as const;
export type BudgetSource = typeof BUDGET_SOURCE_VALUES[number];

export const EXISTING_CAMPAIGN_ACTIONS = [
  "maintain",
  "reduce_budget",
  "pause",
  "monitor",
  "request_review",
] as const;

export type ContractErrorSeverity = "blocker" | "warning";

export interface ContractError {
  code: string;
  severity: ContractErrorSeverity;
  message: string;
  path?: string;
}

export interface ContractResult {
  ok: boolean;
  version: string;
  errors: ContractError[];
  blockers_count: number;
  warnings_count: number;
}

export interface StrategicPlanApprovalGuardResult {
  normalizedPlan: any;
  contract: ContractResult;
  approvalStatus: "pending_approval" | "incomplete";
}

export interface StrategicPlanGuardOptions {
  source_flow?: string | null;
  campaign_account_snapshot?: any[] | null;
  analysis_run_id?: string | null;
}

const LEGACY_CAMPAIGN_TYPES = new Set([
  "tof",
  "mof",
  "bof",
  "remarketing",
  "teste",
  "test",
  "remarket",
  "topo",
  "topo de funil",
  "meio",
  "meio de funil",
  "fundo",
  "fundo de funil",
  "duplicacao",
  "duplicar",
]);

const COLD_ACTION_HINTS = new Set([
  "cold",
  "tof",
  "frio",
  "prospecting",
  "prospect",
  "prospeccao",
  "topo",
  "topo de funil",
  "catalog prospecting",
  "acquisition",
  "novos clientes",
  "new customers",
]);

const WARM_ACTION_HINTS = new Set([
  "warm",
  "mof",
  "bof",
  "remarketing",
  "retargeting",
  "remarket",
  "retention",
  "reactivation",
  "fundo de funil",
  "meio de funil",
]);

const TEST_ACTION_HINTS = new Set([
  "test",
  "teste",
  "testing",
  "creative test",
  "creative_test",
  "offer test",
  "offer_test",
]);

const BROAD_AUDIENCE_HINTS = /(broad|amplo|lookalike|lal|aquisi(c|ç)ao|acquisition|novos clientes|new customers)/i;
const BRAZIL_AGE_AUDIENCE_HINTS = /(homens?|mulheres?|todos).{0,20}(\d{2}).{0,8}(\d{2}|65\+?).{0,20}(brasil|br)/i;

function normValue(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isCanonicalCampaignType(value: string): value is CampaignType {
  return (CAMPAIGN_TYPE_VALUES as readonly string[]).includes(value);
}

function isCanonicalCampaignIntent(value: string): value is CampaignIntent {
  return (CAMPAIGN_INTENT_VALUES as readonly string[]).includes(value);
}

function hasCustomerAudiencePendingDependency(value: unknown): boolean {
  const normalized = normValue(value);
  return normalized === normValue(CUSTOMER_AUDIENCE_PENDING_DEPENDENCY) || normalized === normValue(LEGACY_CUSTOMER_AUDIENCE_PENDING_DEPENDENCY);
}

function isPausedLikeStatus(value: unknown): boolean {
  const status = normValue(value).replace(/\s+/g, "_");
  return ["paused", "pause", "with_issues", "campaign_paused"].includes(status);
}

function isActiveLikeStatus(value: unknown): boolean {
  const status = normValue(value).replace(/\s+/g, "_");
  return ["active", "pending_review", "preapproved", "in_process"].includes(status);
}

export function getAllowedActionsForCampaignStatus(status: unknown, effectiveStatus?: unknown): string[] {
  const candidate = isPausedLikeStatus(effectiveStatus) ? effectiveStatus : status;
  if (isPausedLikeStatus(candidate)) {
    return ["keep_paused", "use_as_reference", "reactivate", "monitor_historical", "request_review"];
  }
  if (isActiveLikeStatus(candidate)) {
    return ["maintain", "reduce_budget", "pause_campaign", "monitor", "request_review"];
  }
  return ["request_review"];
}

export function hasRequiredStrategicPlanMetadata(plan: any): boolean {
  const metadata = plan?.metadata;
  return !!(
    metadata &&
    metadata.schema_version &&
    metadata.preflight_version &&
    metadata.validator_version &&
    metadata.guard_version &&
    metadata.validation_status &&
    typeof metadata.is_approvable === "boolean"
  );
}

function getCampaignSnapshotEntries(plan: any): any[] {
  return Array.isArray(plan?.campaign_account_snapshot)
    ? plan.campaign_account_snapshot
    : Array.isArray(plan?.metadata?.campaign_account_snapshot)
      ? plan.metadata.campaign_account_snapshot
      : [];
}

function getReferencedCampaignId(action: any): string | null {
  return String(
    action?.existing_campaign_id ||
    action?.target_campaign_id ||
    action?.campaign_id ||
    action?.affected_campaign_id ||
    "",
  ).trim() || null;
}

function getReferencedCampaignSnapshot(plan: any, action: any): any | null {
  const referencedId = getReferencedCampaignId(action);
  const referencedName = String(action?.existing_campaign_name || action?.campaign_name || "").trim().toLowerCase();
  const snapshotEntries = getCampaignSnapshotEntries(plan);
  if (referencedId) {
    const byId = snapshotEntries.find((entry: any) => String(entry?.campaign_id || "") === referencedId);
    if (byId) return byId;
  }
  if (referencedName) {
    return snapshotEntries.find((entry: any) => String(entry?.campaign_name || "").trim().toLowerCase() === referencedName) || null;
  }
  return null;
}

function buildPlanMetadata(
  plan: any,
  preflight: StrategicPlanPreflight,
  contract: ContractResult,
  approvalStatus: "pending_approval" | "incomplete",
  options?: StrategicPlanGuardOptions,
) {
  const nowIso = new Date().toISOString();
  return {
    ...(plan?.metadata && typeof plan.metadata === "object" ? plan.metadata : {}),
    source_flow: options?.source_flow || plan?.metadata?.source_flow || "unknown",
    schema_version: PLAN_SCHEMA_VERSION,
    preflight_version: preflight.version,
    validator_version: CONTRACT_VERSION,
    guard_version: CONTRACT_VERSION,
    normalized_at: nowIso,
    validated_at: nowIso,
    validation_status: contract.ok && approvalStatus === "pending_approval" ? "valid" : "invalid",
    validation_errors: contract.errors,
    is_approvable: contract.ok && approvalStatus === "pending_approval",
    analysis_run_id: options?.analysis_run_id || plan?.metadata?.analysis_run_id || null,
    campaign_account_snapshot: Array.isArray(options?.campaign_account_snapshot) ? options?.campaign_account_snapshot : (plan?.metadata?.campaign_account_snapshot || []),
  };
}

function buildMissingPreflightContract(): ContractResult {
  return {
    ok: false,
    version: CONTRACT_VERSION,
    errors: [{ code: "preflight_unavailable", severity: "blocker", message: "Preflight determinístico indisponível — plano não pode ser validado." }],
    blockers_count: 1,
    warnings_count: 0,
  };
}

function getActionAudienceText(action: any): string {
  const adsets = Array.isArray(action?.adsets) ? action.adsets : [];
  const pieces = [
    action?.target_audience,
    action?.label,
    action?.tag,
    action?.targeting_description,
    action?.audience_label,
    action?.campaign_label,
    ...adsets.map((a: any) => `${a?.audience_type || ""} ${a?.audience_description || ""}`),
  ].filter(Boolean);
  return pieces.join(" | ");
}

function hasCreativeTestCustomerOverride(action: any): boolean {
  const intent = normValue(action?.campaign_intent);
  const overrideReason = String(action?.exclusion_override_reason || "").trim();
  const explicitlyIncludesCustomers = action?.audience_exclusions?.customers === false || action?.audience_inclusion?.customers === true;
  return intent === "creative test" && explicitlyIncludesCustomers && overrideReason.length >= 12;
}

/**
 * Detecta se a ação é um TESTE (creative_test/offer_test) para produto novo ou em lançamento.
 * Nesse cenário, manter a base de clientes no público é desejável para validar atratividade
 * do produto novo — então a exclusão automática NÃO se aplica.
 * Sinais carro-chefe vencem (sempre exclui).
 */
export function isTestForNewOrLaunchProduct(action: any): boolean {
  if (!action || typeof action !== "object") return false;
  const intent = normValue(action?.campaign_intent);
  const campaignType = normValue(action?.campaign_type);
  const stage = normValue(action?.funnel_stage);
  const isTest =
    intent === "creative test" ||
    intent === "offer test" ||
    campaignType === "testing" ||
    stage === "test";
  if (!isTest) return false;

  const lifecycle = normValue(action?.product_lifecycle || action?.product_stage);
  if (ESTABLISHED_LIFECYCLE_VALUES.has(lifecycle)) return false;

  const textPool = [
    action?.product_name,
    action?.product_label,
    action?.product_tag,
    action?.rationale,
    ...(Array.isArray(action?.product_tags) ? action.product_tags : []),
  ]
    .filter(Boolean)
    .map((s: any) => String(s))
    .join(" | ");

  if (BESTSELLER_PRODUCT_TOKENS.test(textPool)) return false;

  if (NEW_LAUNCH_LIFECYCLE_VALUES.has(lifecycle)) return true;
  if (NEW_LAUNCH_PRODUCT_TOKENS.test(textPool)) return true;
  return false;
}

function ensureArray<T = any>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : [];
}

function isProspectingLikeAdset(action: any, adset: any): boolean {
  if (isProspectingLike(action)) return true;
  const audienceType = normValue(adset?.audience_type);
  const name = normValue(adset?.adset_name || adset?.name);
  const audienceDescription = normValue(adset?.audience_description);
  if (["broad", "lookalike"].includes(audienceType)) return true;
  if (/(^|\s)(tof|broad|amplo|lal)(\s|$)/i.test(name)) return true;
  if (/(publico amplo|lookalike|homens 30 65 brasil|sem segmentacao|compra 180d|viewcontent)/i.test(audienceDescription)) return true;
  return false;
}

function normalizeProspectingAdsetCustomerExclusion(adset: any, preflight: StrategicPlanPreflight): any {
  const currentExclusion = adset?.audience_exclusions && typeof adset.audience_exclusions === "object"
    ? adset.audience_exclusions
    : {};
  const currentExcludedIds = ensureArray<any>(adset?.excluded_audience_ids);
  const currentTargeting = adset?.targeting && typeof adset.targeting === "object" ? adset.targeting : {};
  const currentExcludedCustomAudiences = ensureArray<any>(currentTargeting?.excluded_custom_audiences);
  const detected = preflight.customer_audience.customer_audience_detected;
  const customerId = preflight.customer_audience.customer_audience_id;
  const customerName = preflight.customer_audience.customer_audience_name;

  if (detected && customerId) {
    const excludedIds = currentExcludedIds.map((entry: any) => String(entry?.id ?? entry));
    const normalizedExcludedIds = excludedIds.includes(String(customerId))
      ? currentExcludedIds
      : [...currentExcludedIds, customerId];

    const normalizedExcludedCustomAudiences = currentExcludedCustomAudiences.some(
      (entry: any) => String(entry?.id ?? entry) === String(customerId),
    )
      ? currentExcludedCustomAudiences
      : [...currentExcludedCustomAudiences, { id: customerId, name: customerName || "Clientes" }];

    return {
      ...adset,
      audience_exclusions: {
        ...currentExclusion,
        customers: true,
        customer_audience_detected: true,
        customer_audience_id: customerId,
        customer_audience_name: customerName,
        reason: String(currentExclusion?.reason || "").trim() || "Conjunto de aquisição/prospecção deve excluir clientes/compradores atuais.",
      },
      excluded_audience_ids: normalizedExcludedIds,
      targeting: {
        ...currentTargeting,
        excluded_custom_audiences: normalizedExcludedCustomAudiences,
      },
    };
  }

  return {
    ...adset,
    audience_exclusions: {
      ...currentExclusion,
      customers: false,
      customer_audience_detected: false,
      pending_dependency: CUSTOMER_AUDIENCE_PENDING_DEPENDENCY,
      reason: String(currentExclusion?.reason || "").trim() || "Conjunto de aquisição/prospecção exige público de clientes/compradores para exclusão antes da aprovação.",
    },
  };
}

export function enforceProspectingAdsetCustomerExclusions(plan: any, preflight: StrategicPlanPreflight): any {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.planned_actions)) return plan;

  return {
    ...plan,
    planned_actions: plan.planned_actions.map((action: any) => {
      if (!action || typeof action !== "object" || !Array.isArray(action.adsets)) return action;
      if (hasCreativeTestCustomerOverride(action)) return action;
      if (isTestForNewOrLaunchProduct(action)) {
        // Teste de produto novo/lançamento: marca exceção determinística nos adsets,
        // mas não força exclusão. Validador respeita o motivo.
        const normalizedAdsets = action.adsets.map((adset: any) => {
          if (!isProspectingLikeAdset(action, adset)) return adset;
          const currentExclusion = adset?.audience_exclusions && typeof adset.audience_exclusions === "object" ? adset.audience_exclusions : {};
          return {
            ...adset,
            audience_exclusions: {
              ...currentExclusion,
              customers: false,
              exclusion_skipped_reason: TEST_NEW_LAUNCH_SKIP_REASON,
              reason:
                String(currentExclusion?.reason || "").trim() ||
                "Teste de produto novo/lançamento — manter base de clientes no público para validar atratividade.",
            },
          };
        });
        return { ...action, adsets: normalizedAdsets };
      }

      const normalizedAdsets = action.adsets.map((adset: any) => {
        if (!isProspectingLikeAdset(action, adset)) return adset;
        return normalizeProspectingAdsetCustomerExclusion(adset, preflight);
      });

      return {
        ...action,
        adsets: normalizedAdsets,
      };
    }),
  };
}

function inferLegacyCampaignBucket(action: any): "cold" | "remarketing" | "tests" | null {
  const campaignType = normValue(action?.campaign_type);
  const funnel = normValue(action?.funnel || action?.affected_funnel);
  const stage = normValue(action?.funnel_stage);
  const intent = normValue(action?.campaign_intent);
  const actionType = normValue(action?.action_type);
  const audienceText = getActionAudienceText(action);

  if ((intent === "creative test" || intent === "offer test") && (TEST_ACTION_HINTS.has(campaignType) || stage === "test")) return "tests";
  if (COLD_ACTION_HINTS.has(campaignType) || COLD_ACTION_HINTS.has(funnel) || COLD_ACTION_HINTS.has(stage) || intent === "acquisition" || intent === "scale") {
    return "cold";
  }
  if (actionType.includes("create") || actionType.includes("duplicate") || actionType.includes("duplicat")) {
    if (BROAD_AUDIENCE_HINTS.test(audienceText) || BRAZIL_AGE_AUDIENCE_HINTS.test(audienceText)) return "cold";
  }
  if (WARM_ACTION_HINTS.has(campaignType) || WARM_ACTION_HINTS.has(funnel) || WARM_ACTION_HINTS.has(stage) || intent === "retention" || intent === "reactivation") {
    return "remarketing";
  }
  if (/catalog/i.test(String(action?.campaign_type || ""))) {
    return /retarget|remarket|warm|mof|bof/i.test(`${campaignType} ${funnel} ${stage}`) ? "remarketing" : "cold";
  }
  if (TEST_ACTION_HINTS.has(campaignType) || TEST_ACTION_HINTS.has(intent) || stage === "test") return "tests";
  return null;
}

function isProspectingLike(action: any): boolean {
  return inferLegacyCampaignBucket(action) === "cold";
}

function canonicalizeCampaignType(action: any): CampaignType | string {
  const campaignType = normValue(action?.campaign_type);
  if (isCanonicalCampaignType(campaignType)) return campaignType;
  if (/catalog/i.test(String(action?.campaign_type || ""))) {
    return inferLegacyCampaignBucket(action) === "remarketing" ? "catalog_retargeting" : "catalog_prospecting";
  }
  const inferred = inferLegacyCampaignBucket(action);
  if (inferred === "tests") return "testing";
  if (inferred === "remarketing") return "retargeting";
  if (inferred === "cold") return "prospecting";
  return campaignType || String(action?.campaign_type || "");
}

function canonicalizeCampaignIntent(action: any, campaignType: string): CampaignIntent | string {
  const intent = normValue(action?.campaign_intent);
  if (isCanonicalCampaignIntent(intent)) return intent;
  if (campaignType === "testing") return "creative_test";
  if (campaignType === "prospecting" || campaignType === "catalog_prospecting") return "acquisition";
  if (campaignType === "retargeting" || campaignType === "catalog_retargeting") return "retention";
  return intent || "acquisition";
}

function canonicalizeFunnelStage(action: any, campaignType: string): string {
  const stage = normValue(action?.funnel_stage);
  if (["tof", "mof", "bof", "test", "leads"].includes(stage)) {
    if (campaignType === "prospecting" || campaignType === "catalog_prospecting") return "tof";
    return stage;
  }
  if (campaignType === "prospecting" || campaignType === "catalog_prospecting") return "tof";
  if (campaignType === "testing") return stage || "test";
  return stage || "bof";
}

function canonicalizeAffectedFunnel(action: any, campaignType: string): string {
  const funnel = normValue(action?.affected_funnel || action?.funnel);
  if (["cold", "remarketing", "tests", "leads"].includes(funnel)) {
    if (campaignType === "prospecting" || campaignType === "catalog_prospecting") return "cold";
    return funnel;
  }
  const explicitStage = normValue(action?.funnel_stage);
  if (explicitStage === "tof" || explicitStage === "cold") return "cold";
  if (campaignType === "prospecting" || campaignType === "catalog_prospecting") return "cold";
  if (campaignType === "testing") return "tests";
  return "remarketing";
}

function isCatalogType(t: string): boolean {
  return t === "catalog_prospecting" || t === "catalog_retargeting";
}

function isBudgetAction(a: any): boolean {
  const at = String(a?.action_type || "").toLowerCase();
  return ["create_campaign", "scale", "scale_budget", "reduce_budget", "pause", "pause_campaign", "reallocate_budget", "maintain", "duplicate"].includes(at);
}

function inferAudienceBudgetFitsForPlan(plan: any, preflight: StrategicPlanPreflight): any {
  if (!plan || !Array.isArray(plan.planned_actions)) return plan;

  const fitsByCampaignId = new Map<string, any>();
  const fitsByCampaignName = new Map<string, any>();

  for (const fitEntry of ensureArray<any>(preflight?.audience_budget_fits)) {
    const campaignId = String(fitEntry?.campaign_id || "").trim();
    const campaignName = normValue(fitEntry?.campaign_name);
    if (campaignId) fitsByCampaignId.set(campaignId, fitEntry);
    if (campaignName) fitsByCampaignName.set(campaignName, fitEntry);
  }

  const next = plan.planned_actions.map((a: any) => {
    if (!a || typeof a !== "object" || !isBudgetAction(a)) return a;
    if (a.audience_budget_fit && typeof a.audience_budget_fit === "object" && a.audience_budget_fit.fit) return a;

    const referencedCampaignId = String(
      a?.existing_campaign_id ||
      a?.target_campaign_id ||
      a?.campaign_id ||
      a?.affected_campaign_id ||
      "",
    ).trim();
    const referencedCampaignName = normValue(
      a?.existing_campaign_name ||
      a?.campaign_name ||
      a?.target_campaign_name ||
      a?.affected_campaign_name ||
      "",
    );

    const matchedFit = (referencedCampaignId && fitsByCampaignId.get(referencedCampaignId))
      || (referencedCampaignName && fitsByCampaignName.get(referencedCampaignName))
      || null;

    const inferredFit = matchedFit
      ? {
          fit: matchedFit.fit,
          saturation_score: matchedFit.saturation_score ?? null,
          under_funding_score: matchedFit.under_funding_score ?? null,
          recommended_action: matchedFit.recommended_action || "Manter orçamento atual e monitorar.",
          suggested_budget_range_cents: matchedFit.suggested_budget_range_cents ?? null,
          explanation: matchedFit.explanation || "Fit reaproveitado do preflight determinístico.",
        }
      : {
          fit: "insufficient_data",
          saturation_score: null,
          under_funding_score: null,
          recommended_action: "Aguardar acúmulo de dados antes de ajustar orçamento.",
          suggested_budget_range_cents: null,
          explanation: "Fit inferido como insufficient_data por ausência de histórico determinístico correspondente no preflight.",
        };

    return {
      ...a,
      audience_budget_fit: inferredFit,
      audience_budget_fit_inferred: true,
    };
  });

  return { ...plan, planned_actions: next };
}

function normalizeStrategicPlanAction(action: any, preflight: StrategicPlanPreflight): any {
  if (!action || typeof action !== "object") return action;

  const campaignType = String(canonicalizeCampaignType(action));
  const campaignIntent = String(canonicalizeCampaignIntent(action, campaignType));
  const funnelStage = canonicalizeFunnelStage(action, campaignType);
  const affectedFunnel = canonicalizeAffectedFunnel(action, campaignType);
  const isCold = campaignType === "prospecting" || campaignType === "catalog_prospecting" || isProspectingLike({ ...action, campaign_type: campaignType, campaign_intent: campaignIntent, funnel_stage: funnelStage, affected_funnel: affectedFunnel });
  const detected = preflight.customer_audience.customer_audience_detected;
  const current = action.audience_exclusions && typeof action.audience_exclusions === "object"
    ? action.audience_exclusions
    : {};

  let audienceExclusions = current;
  const isTestNewLaunch = isTestForNewOrLaunchProduct({ ...action, campaign_type: campaignType, campaign_intent: campaignIntent, funnel_stage: funnelStage, affected_funnel: affectedFunnel });
  const hasOverride = hasCreativeTestCustomerOverride({ ...action, campaign_intent: campaignIntent });
  // Default seguro: testes criativos sem sinal de lançamento e sem justificativa
  // formal devem excluir clientes (mesmo critério do tráfego frio). Evita bloqueio
  // por omissão do LLM e respeita a regra de negócio: só mantém clientes quando há
  // sinal explícito de produto novo/lançamento.
  const isCreativeTestWithoutLaunch =
    campaignIntent === "creative_test" && !isTestNewLaunch && !hasOverride;
  if ((isCold || isCreativeTestWithoutLaunch) && !hasOverride && !isTestNewLaunch) {
    if (detected) {
      const { pending_dependency: _pending, ...rest } = current;
      audienceExclusions = {
        ...rest,
        customers: true,
        customer_audience_detected: true,
        customer_audience_id: preflight.customer_audience.customer_audience_id,
        customer_audience_name: preflight.customer_audience.customer_audience_name,
        reason: String(rest.reason || "").trim() || (isCreativeTestWithoutLaunch
          ? "Teste criativo sem sinal de produto novo/lançamento — aplicar exclusão padrão de clientes."
          : "Campanha de aquisição/prospecção deve excluir clientes/compradores atuais."),
      };
    } else {
      const { customer_audience_id: _id, customer_audience_name: _name, ...rest } = current;
      audienceExclusions = {
        ...rest,
        customers: false,
        customer_audience_detected: false,
        pending_dependency: CUSTOMER_AUDIENCE_PENDING_DEPENDENCY,
        reason: String(rest.reason || "").trim() || "Campanha exige público de clientes/compradores para exclusão antes da aprovação.",
      };
    }
  } else if (isTestNewLaunch) {
    audienceExclusions = {
      ...current,
      customers: false,
      exclusion_skipped_reason: TEST_NEW_LAUNCH_SKIP_REASON,
      reason:
        String(current?.reason || "").trim() ||
        "Teste de produto novo/lançamento — manter base de clientes no público para validar atratividade.",
    };
  }

  // Auto-cura: catálogo dinâmico sem catálogo Meta detectado → injetar pending_dependency
  // determinística para evitar bloqueio do plano inteiro por falha do LLM em declarar a pendência.
  // Mesmo padrão usado acima para `customer_audience_not_detected`.
  let catalogSetup = action.catalog_setup;
  if (isCatalogType(campaignType) && !preflight.catalog_availability?.catalog_detected) {
    const cs = (catalogSetup && typeof catalogSetup === "object") ? catalogSetup : {};
    if (cs.pending_dependency !== "catalog_not_connected") {
      catalogSetup = {
        ...cs,
        pending_dependency: "catalog_not_connected",
      };
    }
  }

  return {
    ...action,
    campaign_type: campaignType,
    campaign_intent: campaignIntent,
    funnel_stage: funnelStage,
    affected_funnel: affectedFunnel,
    funnel: action?.funnel ?? affectedFunnel,
    audience_exclusions: audienceExclusions,
    ...(catalogSetup !== undefined ? { catalog_setup: catalogSetup } : {}),
  };
}

function inferBudgetSourcesForPlan(plan: any, preflight: StrategicPlanPreflight): any {
  if (!plan || !Array.isArray(plan.planned_actions)) return plan;
  const freeByFunnel: Record<string, number> = {};
  const fbs = preflight?.funnel_budget_state?.per_funnel || ({} as any);
  for (const k of Object.keys(fbs)) freeByFunnel[k] = (fbs as any)[k]?.free_cents || 0;
  const priorReleaseByFunnel: Record<string, boolean> = {};

  const next = plan.planned_actions.map((a: any) => {
    if (!a || typeof a !== "object") return a;
    const at = String(a.action_type || "").toLowerCase();
    const funnel = String(a.affected_funnel || a.funnel || "").toLowerCase();

    // Pause/reduce on an active campaign releases budget into the same funnel
    if (at === "pause" || at === "pause_campaign" || at === "reduce_budget") {
      const referenced = getReferencedCampaignSnapshot(plan, a);
      const effective = referenced?.effective_status || referenced?.status || null;
      if (isActiveLikeStatus(effective)) {
        const released = Math.abs(Number(a.budget_released_brl || a.daily_budget_brl || 0)) * 100;
        if (released > 0) {
          freeByFunnel[funnel] = (freeByFunnel[funnel] ?? 0) + released;
          priorReleaseByFunnel[funnel] = true;
        }
      }
      return a;
    }

    const isCreateOrScale = at === "create_campaign" || at === "scale" || at === "scale_budget";
    if (!isCreateOrScale) return a;

    const currentSource = String(a.budget_source || "").toLowerCase();
    if ((BUDGET_SOURCE_VALUES as readonly string[]).includes(currentSource)) {
      // Trust LLM but still debit projection for downstream inference
      const delta = Number(a.daily_budget_brl || 0) * 100;
      if (currentSource === "free_now" || currentSource === "test_allocation" || currentSource === "reallocated_budget") {
        freeByFunnel[funnel] = Math.max(0, (freeByFunnel[funnel] ?? 0) - delta);
      }
      return a;
    }

    const delta = Number(a.daily_budget_brl || 0) * 100;
    const free = freeByFunnel[funnel] ?? 0;
    let inferred: string;
    if (free + 1 >= delta && delta > 0) {
      inferred = "free_now";
      freeByFunnel[funnel] = Math.max(0, free - delta);
    } else if (priorReleaseByFunnel[funnel]) {
      inferred = "released_by_previous_action";
    } else {
      inferred = "insufficient_budget_pending_action";
    }
    return {
      ...a,
      budget_source: inferred,
      budget_source_inferred: true,
    };
  });

  return { ...plan, planned_actions: next };
}

export function normalizeStrategicPlanCustomerExclusions(plan: any, preflight: StrategicPlanPreflight): any {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.planned_actions)) return plan;

  const normalizedPlan = {
    ...plan,
    planned_actions: plan.planned_actions.map((action: any) => normalizeStrategicPlanAction(action, preflight)),
  };

  const withExclusions = enforceProspectingAdsetCustomerExclusions(normalizedPlan, preflight);
  const withBudgetSources = inferBudgetSourcesForPlan(withExclusions, preflight);
  return inferAudienceBudgetFitsForPlan(withBudgetSources, preflight);
}

export function normalizeAndValidateStrategicPlanForApproval(
  plan: any,
  preflight: StrategicPlanPreflight | null,
  options?: StrategicPlanGuardOptions,
): StrategicPlanApprovalGuardResult {
  if (!preflight) {
    const missingContract = buildMissingPreflightContract();
    return {
      normalizedPlan: {
        ...(plan && typeof plan === "object" ? plan : {}),
        contract: missingContract,
        contract_version: CONTRACT_VERSION,
        approval_status: "incomplete",
        metadata: {
          ...((plan && typeof plan === "object" && plan.metadata && typeof plan.metadata === "object") ? plan.metadata : {}),
          source_flow: options?.source_flow || plan?.metadata?.source_flow || "unknown",
          schema_version: PLAN_SCHEMA_VERSION,
          preflight_version: null,
          validator_version: CONTRACT_VERSION,
          guard_version: CONTRACT_VERSION,
          normalized_at: new Date().toISOString(),
          validated_at: new Date().toISOString(),
          validation_status: "invalid",
          validation_errors: missingContract.errors,
          is_approvable: false,
          analysis_run_id: options?.analysis_run_id || plan?.metadata?.analysis_run_id || null,
          campaign_account_snapshot: Array.isArray(options?.campaign_account_snapshot) ? options?.campaign_account_snapshot : [],
        },
      },
      contract: missingContract,
      approvalStatus: "incomplete",
    };
  }

  const normalizedPlanBase = autoResolveExistingCampaignIds(
    normalizeStrategicPlanCustomerExclusions(plan, preflight),
    preflight,
  );
  const hasCustomerAudiencePending = Array.isArray(normalizedPlanBase?.planned_actions) && normalizedPlanBase.planned_actions.some((action: any) => {
    if (isTestForNewOrLaunchProduct(action)) return false;
    return (
      (isProspectingLike(action) && hasCustomerAudiencePendingDependency(action?.audience_exclusions?.pending_dependency)) ||
      ensureArray<any>(action?.adsets).some((adset: any) =>
        isProspectingLikeAdset(action, adset) && hasCustomerAudiencePendingDependency(adset?.audience_exclusions?.pending_dependency),
      )
    );
  });
  const provisionalContract: ContractResult = {
    ok: true,
    version: CONTRACT_VERSION,
    errors: [],
    blockers_count: 0,
    warnings_count: 0,
  };
  const provisionalStatus = hasCustomerAudiencePending ? "incomplete" : "pending_approval";
  const metadata = buildPlanMetadata(normalizedPlanBase, preflight, provisionalContract, provisionalStatus, options);
  const normalizedPlan: any = {
    ...normalizedPlanBase,
    contract: provisionalContract,
    contract_version: CONTRACT_VERSION,
    approval_status: provisionalStatus,
    metadata,
    campaign_account_snapshot: metadata.campaign_account_snapshot,
    source_flow: metadata.source_flow,
    analysis_run_id: metadata.analysis_run_id,
  };
  const contract = validateStrategicPlanContract(normalizedPlan, preflight);
  const approvalStatus = contract.ok && !hasCustomerAudiencePending ? "pending_approval" : "incomplete";
  normalizedPlan.contract = contract;
  normalizedPlan.contract_version = CONTRACT_VERSION;
  normalizedPlan.approval_status = approvalStatus;
  normalizedPlan.metadata = buildPlanMetadata(normalizedPlan, preflight, contract, approvalStatus, options);
  return {
    normalizedPlan,
    contract,
    approvalStatus,
  };
}

export function validateStrategicPlanContract(plan: any, preflight: StrategicPlanPreflight): ContractResult {
  const errors: ContractError[] = [];
  const push = (e: ContractError) => errors.push(e);

  // ---- Nível do plano --------------------------------------------------
  if (!plan || typeof plan !== "object") {
    return {
      ok: false,
      version: CONTRACT_VERSION,
      errors: [{ code: "plan_missing", severity: "blocker", message: "Plano estratégico ausente ou em formato inválido." }],
      blockers_count: 1,
      warnings_count: 0,
    };
  }

  if (!plan.diagnosis || String(plan.diagnosis).trim().length < 10) {
    push({ code: "plan_missing_diagnosis", severity: "blocker", message: "Diagnóstico está ausente ou muito curto.", path: "diagnosis" });
  }
  if (!hasRequiredStrategicPlanMetadata(plan)) {
    push({
      code: "plan_missing_required_metadata",
      severity: "blocker",
      message: "Plano legado ou incompleto: metadados obrigatórios de validação e versionamento estão ausentes.",
      path: "metadata",
    });
  }
  if (!plan.risk_assessment) {
    push({ code: "plan_missing_risk_assessment", severity: "blocker", message: "Avaliação de risco está ausente.", path: "risk_assessment" });
  }
  if (!plan.funnel_budget_state || typeof plan.funnel_budget_state !== "object") {
    push({ code: "plan_missing_funnel_budget_state", severity: "blocker", message: "Estado de orçamento por funil ausente do plano.", path: "funnel_budget_state" });
  }
  if (!Array.isArray(plan.active_campaigns_summary)) {
    push({ code: "plan_missing_active_campaigns_summary", severity: "blocker", message: "Resumo das campanhas ativas ausente do plano.", path: "active_campaigns_summary" });
  }
  if (!Array.isArray(plan.planned_actions) || plan.planned_actions.length === 0) {
    push({ code: "plan_missing_planned_actions", severity: "blocker", message: "Plano não contém nenhuma ação planejada.", path: "planned_actions" });
  }

  // ---- Campanhas ativas obrigatórias ----------------------------------
  const mustAddress = (preflight.active_campaigns_summary || []).filter((c) => c.must_be_addressed_in_plan);
  const referencedCampaignIds = new Set<string>();
  const actions: any[] = Array.isArray(plan.planned_actions) ? plan.planned_actions : [];
  for (const a of actions) {
    const refId = a?.target_campaign_id || a?.campaign_id || a?.affected_campaign_id;
    if (refId) referencedCampaignIds.add(String(refId));
  }
  const nonActionReasons: Record<string, string> = (plan.explicit_non_action_reasons || plan.non_action_reasons || {}) as any;
  for (const c of mustAddress) {
    const hasAction = referencedCampaignIds.has(c.campaign_id);
    const hasReason = !!nonActionReasons[c.campaign_id] && String(nonActionReasons[c.campaign_id]).trim().length >= 10;
    if (!hasAction && !hasReason) {
      push({
        code: "active_campaign_ignored",
        severity: "blocker",
        message: `Campanha ativa relevante "${c.campaign_name}" não foi endereçada (manter/reduzir/pausar/monitorar) e não há justificativa explícita.`,
        path: `planned_actions[?].target_campaign_id=${c.campaign_id}`,
      });
    }
  }

  // ---- Validação por ação --------------------------------------------
  // Orçamento sequencial — contabilizar liberação por funil.
  const freeByFunnel: Record<string, number> = {};
  const fbs = preflight.funnel_budget_state.per_funnel || ({} as any);
  for (const k of Object.keys(fbs)) freeByFunnel[k] = (fbs as any)[k]?.free_cents || 0;

  actions.forEach((a, idx) => {
    const path = `planned_actions[${idx}]`;
    if (typeof a !== "object" || !a) {
      push({ code: "action_invalid_shape", severity: "blocker", message: "Ação planejada vazia ou em formato inválido.", path });
      return;
    }

    const normalizedAction = normalizeStrategicPlanAction(a, preflight);
    const rawCampaignType = normValue(a.campaign_type);
    // IMPORTANT: rawExcl must come from the ORIGINAL action, not the normalized one.
    // Normalization auto-injects customer exclusion for prospecting; using it here would
    // mask the validator's job of catching plans that arrived without canonical exclusion.
    const rawExcl = (a && typeof a === "object" && a.audience_exclusions && typeof a.audience_exclusions === "object") ? a.audience_exclusions : {};
    const campaignType = String(canonicalizeCampaignType(normalizedAction) || "").toLowerCase();
    if (!campaignType) {
      push({ code: "action_missing_campaign_type", severity: "blocker", message: "Ação sem `campaign_type`.", path });
    } else if (LEGACY_CAMPAIGN_TYPES.has(rawCampaignType)) {
      push({
        code: "action_legacy_campaign_type",
        severity: "blocker",
        message: `\`campaign_type\` usa formato antigo ("${a.campaign_type}"). Use um dos valores canônicos: ${CAMPAIGN_TYPE_VALUES.join(", ")}.`,
        path: `${path}.campaign_type`,
      });
    } else if (!(CAMPAIGN_TYPE_VALUES as readonly string[]).includes(campaignType)) {
      push({
        code: "action_unknown_campaign_type",
        severity: "blocker",
        message: `\`campaign_type\` desconhecido ("${a.campaign_type}").`,
        path: `${path}.campaign_type`,
      });
    }

    const intent = String(canonicalizeCampaignIntent(normalizedAction, campaignType) || "").toLowerCase();
    if (!intent) {
      push({ code: "action_missing_campaign_intent", severity: "blocker", message: "Ação sem `campaign_intent`.", path: `${path}.campaign_intent` });
    } else if (!(CAMPAIGN_INTENT_VALUES as readonly string[]).includes(intent)) {
      push({
        code: "action_unknown_campaign_intent",
        severity: "blocker",
        message: `\`campaign_intent\` desconhecido ("${a.campaign_intent}").`,
        path: `${path}.campaign_intent`,
      });
    }

    const testForNewLaunch = isTestForNewOrLaunchProduct(normalizedAction);

    // Exclusão de clientes em prospecção/aquisição (pulada em teste de produto novo/lançamento)
    if (!testForNewLaunch && isProspectingLike(normalizedAction) && preflight.customer_audience.customer_audience_detected && !rawExcl.customers) {
      push({
        code: "prospecting_missing_customer_exclusion",
        severity: "blocker",
        message: "Campanha de prospecção/aquisição precisa excluir o público de Clientes.",
        path: `${path}.audience_exclusions.customers`,
      });
    }

    if (!testForNewLaunch && isProspectingLike(normalizedAction)) {
      const excl = normalizedAction.audience_exclusions || {};
      const detected = preflight.customer_audience.customer_audience_detected;
      if (detected) {
        if (!excl.customer_audience_id || !excl.customer_audience_name) {
          push({
            code: "prospecting_missing_customer_audience_metadata",
            severity: "blocker",
            message: "Campanha de público frio precisa trazer o público de Clientes detectado no contrato canônico.",
            path: `${path}.audience_exclusions.customer_audience_id`,
          });
        }
      } else {
        if (!hasCustomerAudiencePendingDependency(excl.pending_dependency)) {
          push({
            code: "prospecting_missing_pending_dependency",
            severity: "blocker",
            message: "Campanha de público frio/prospecção precisa excluir clientes/compradores atuais ou declarar pendência técnica do público de clientes.",
            path: `${path}.audience_exclusions.pending_dependency`,
          });
        } else {
          push({
            code: "prospecting_customer_audience_pending_dependency",
            severity: "blocker",
            message: "Campanha de público frio/prospecção depende do público de clientes antes da aprovação; plano deve permanecer incompleto.",
            path: `${path}.audience_exclusions.pending_dependency`,
          });
        }
      }
    }

    const adsets = ensureArray<any>(normalizedAction?.adsets);
    adsets.forEach((adset: any, adsetIndex: number) => {
      if (!isProspectingLikeAdset(normalizedAction, adset)) return;
      if (testForNewLaunch) return;

      const adsetPath = `${path}.adsets[${adsetIndex}]`;
      const adsetExclusion = adset?.audience_exclusions || {};
      const adsetExcludedIds = ensureArray<any>(adset?.excluded_audience_ids).map((entry: any) => String(entry?.id ?? entry));
      const adsetExcludedCustomAudiences = ensureArray<any>(adset?.targeting?.excluded_custom_audiences).map((entry: any) => String(entry?.id ?? entry));
      const detected = preflight.customer_audience.customer_audience_detected;
      const customerId = preflight.customer_audience.customer_audience_id;

      if (detected && customerId) {
        const hasConditionA =
          adsetExclusion?.customers === true &&
          adsetExcludedIds.includes(String(customerId)) &&
          adsetExcludedCustomAudiences.includes(String(customerId));

        if (!hasConditionA) {
          push({
            code: "prospecting_adset_missing_customer_exclusion",
            severity: "blocker",
            message: "Conjunto de público frio/prospecção precisa excluir clientes/compradores atuais ou declarar pendência técnica do público de clientes.",
            path: `${adsetPath}.audience_exclusions`,
          });
        }
      } else if (!hasCustomerAudiencePendingDependency(adsetExclusion?.pending_dependency)) {
        push({
          code: "prospecting_adset_missing_pending_dependency",
          severity: "blocker",
          message: "Conjunto de público frio/prospecção precisa excluir clientes/compradores atuais ou declarar pendência técnica do público de clientes.",
          path: `${adsetPath}.audience_exclusions.pending_dependency`,
        });
      }
    });

    // Catálogo dinâmico
    if (isCatalogType(campaignType)) {
      const cs = a.catalog_setup || {};
      if (cs.creative_mode !== "dynamic") {
        push({
          code: "catalog_missing_dynamic_creative_mode",
          severity: "blocker",
          message: "Campanha de catálogo precisa de `catalog_setup.creative_mode='dynamic'`.",
          path: `${path}.catalog_setup.creative_mode`,
        });
      }
      const catalogDetected = preflight.catalog_availability.catalog_detected;
      if (catalogDetected) {
        if (!cs.product_catalog_id) {
          push({
            code: "catalog_missing_product_catalog_id",
            severity: "blocker",
            message: "Campanha de catálogo precisa de `product_catalog_id`.",
            path: `${path}.catalog_setup.product_catalog_id`,
          });
        }
        if (!cs.product_set && !cs.product_set_id) {
          push({
            code: "catalog_missing_product_set",
            severity: "blocker",
            message: "Campanha de catálogo precisa de `product_set` (ou `product_set_id`).",
            path: `${path}.catalog_setup.product_set`,
          });
        }
      } else if (cs.pending_dependency !== "catalog_not_connected") {
        push({
          code: "catalog_missing_pending_dependency",
          severity: "blocker",
          message: "Catálogo Meta não detectado — declare `catalog_setup.pending_dependency='catalog_not_connected'`.",
          path: `${path}.catalog_setup.pending_dependency`,
        });
      }
    }

    // Teste criativo com inclusão de clientes precisa de justificativa
    // (exceção: produto novo/lançamento — exclusion_skipped_reason determinístico)
    if (intent === "creative_test" && !testForNewLaunch) {
      const includesCustomers = a.audience_exclusions?.customers === false || a.audience_inclusion?.customers === true;
      if (includesCustomers) {
        const skipReason = String(a.audience_exclusions?.exclusion_skipped_reason || "").trim();
        if (skipReason !== TEST_NEW_LAUNCH_SKIP_REASON) {
          const reason = String(a.exclusion_override_reason || "").trim();
          if (reason.length < 12) {
            push({
              code: "creative_test_missing_override_reason",
              severity: "blocker",
              message: "Teste criativo com inclusão de clientes exige `exclusion_override_reason` (≥ 12 caracteres).",
              path: `${path}.exclusion_override_reason`,
            });
          }
        }
      }
    }

    // Audience Budget Fit obrigatório para ações de orçamento
    if (isBudgetAction(a)) {
      const fit = a.audience_budget_fit;
      if (!fit || typeof fit !== "object" || !fit.fit) {
        push({
          code: "budget_action_missing_audience_budget_fit",
          severity: "blocker",
          message: "Ação que mexe em orçamento precisa de `audience_budget_fit` (use `insufficient_data` quando não houver histórico).",
          path: `${path}.audience_budget_fit`,
        });
      }
    }

    const referencedCampaign = getReferencedCampaignSnapshot(plan, normalizedAction);
    const actionType = String(normalizedAction.action_type || "").toLowerCase();
    if (referencedCampaign) {
      const allowedActions = getAllowedActionsForCampaignStatus(referencedCampaign.status, referencedCampaign.effective_status);
      const effectiveStatus = referencedCampaign.effective_status || referencedCampaign.status || null;
      const isPauseRequest = ["pause", "pause_campaign"].includes(actionType);
      const actionRequiresExistingCampaign = ["pause", "pause_campaign", "reduce_budget", "maintain", "monitor", "reactivate", "keep_paused", "use_as_reference", "monitor_historical", "request_review"].includes(actionType);

      if (isPauseRequest && isPausedLikeStatus(effectiveStatus)) {
        push({
          code: "paused_campaign_cannot_receive_pause",
          severity: "blocker",
          message: `Campanha já pausada não pode receber ação de pausa. Use manter pausada, referência histórica, reativar, monitorar histórico ou solicitar revisão.`,
          path: `${path}.action_type`,
        });
      }

      if (actionRequiresExistingCampaign && !allowedActions.includes(actionType)) {
        push({
          code: "campaign_action_not_allowed_for_status",
          severity: "blocker",
          message: `Ação selecionada não é permitida para o status atual da campanha. Ações permitidas: ${allowedActions.join(", ")}.`,
          path: `${path}.action_type`,
        });
      }
    }

    if (["pause", "pause_campaign"].includes(actionType) || ["reduce_budget", "maintain", "monitor", "request_review"].includes(actionType)) {
      if (!getReferencedCampaignId(normalizedAction)) {
        push({
          code: "existing_campaign_required",
          severity: "blocker",
          message: "Ação operacional sobre campanha existente exige identificar qual campanha será usada.",
          path: `${path}.existing_campaign_id`,
        });
      }
    }

    if (["pause", "pause_campaign", "reduce_budget", "maintain", "monitor", "request_review", "create_campaign"].includes(actionType)) {
      const productName = String(normalizedAction.product_name || "").trim();
      const audienceValue = String(normalizedAction.target_audience || "").trim();
      if (!productName || /^n\/?a$/i.test(productName)) {
        push({
          code: "action_missing_product_name",
          severity: "blocker",
          message: "Ação operacional não pode ficar com produto indefinido.",
          path: `${path}.product_name`,
        });
      }
      if (!audienceValue || /^n\/?a$/i.test(audienceValue)) {
        push({
          code: "action_missing_target_audience",
          severity: "blocker",
          message: "Ação operacional não pode ficar com público indefinido.",
          path: `${path}.target_audience`,
        });
      }
    }

    // Orçamento sequencial: criar/escalar não pode exceder o livre sem liberação
    const at = String(a.action_type || "").toLowerCase();
    const isCreateOrScale = at === "create_campaign" || at === "scale" || at === "scale_budget";
    if (isCreateOrScale) {
      const funnel = String(a.affected_funnel || a.funnel || "").toLowerCase();
      const delta = Number(a.daily_budget_brl || 0) * 100;
      const source = String(a.budget_source || "").toLowerCase();
      if (!(BUDGET_SOURCE_VALUES as readonly string[]).includes(source)) {
        push({
          code: "action_missing_budget_source",
          severity: "blocker",
          message: "Ação que aloca orçamento precisa de `budget_source` válido.",
          path: `${path}.budget_source`,
        });
      }
      const free = freeByFunnel[funnel] ?? 0;
      if (source === "released_by_previous_action") {
        // confiamos na sequência declarada; nada a debitar aqui
      } else if (source === "free_now" || source === "test_allocation" || source === "reallocated_budget") {
        if (delta > free + 1) {
          push({
            code: "action_exceeds_free_budget",
            severity: "blocker",
            message: `Ação aloca R$ ${(delta / 100).toFixed(2)} no funil "${funnel}" mas só há R$ ${(free / 100).toFixed(2)} livres e não há ação anterior que libere verba.`,
            path: `${path}.daily_budget_brl`,
          });
        } else {
          freeByFunnel[funnel] = Math.max(0, free - delta);
        }
      }
    }
    if (at === "pause" || at === "pause_campaign" || at === "reduce_budget") {
      const funnel = String(a.affected_funnel || a.funnel || "").toLowerCase();
      const referencedCampaign = getReferencedCampaignSnapshot(plan, normalizedAction);
      const effectiveStatus = referencedCampaign?.effective_status || referencedCampaign?.status || null;
      if (isActiveLikeStatus(effectiveStatus)) {
        const released = Math.abs(Number(a.budget_released_brl || a.daily_budget_brl || 0)) * 100;
        freeByFunnel[funnel] = (freeByFunnel[funnel] ?? 0) + released;
      }
    }

    // Produto baixa confiança não permite pause como ação principal
    const refId = a?.target_campaign_id || a?.campaign_id || a?.affected_campaign_id;
    if (refId && (at === "pause" || at === "pause_campaign")) {
      const pi = preflight.product_identifications.find((p) => p.campaign_id === refId);
      if (pi && (pi.product_identification_confidence === "low" || pi.product_identification_confidence === "unknown")) {
        push({
          code: "pause_blocked_low_product_confidence",
          severity: "blocker",
          message: `Campanha "${pi.campaign_name}" tem produto identificado com baixa confiança — pause não é permitido como ação principal. Use manter, reduzir, monitorar ou solicitar revisão.`,
          path: `${path}.action_type`,
        });
      }
    }
  });

  const blockers_count = errors.filter((e) => e.severity === "blocker").length;
  const warnings_count = errors.filter((e) => e.severity === "warning").length;
  return {
    ok: blockers_count === 0,
    version: CONTRACT_VERSION,
    errors,
    blockers_count,
    warnings_count,
  };
}
