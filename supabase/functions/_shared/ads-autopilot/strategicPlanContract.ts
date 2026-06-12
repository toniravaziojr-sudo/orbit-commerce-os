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

export const CONTRACT_VERSION = "1.1.0";
export const CUSTOMER_AUDIENCE_PENDING_DEPENDENCY = "customer_audience_not_detected" as const;
export const LEGACY_CUSTOMER_AUDIENCE_PENDING_DEPENDENCY = "customer_audience_missing" as const;

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
  if (isCold && !hasCreativeTestCustomerOverride({ ...action, campaign_intent: campaignIntent })) {
    if (detected) {
      const { pending_dependency: _pending, ...rest } = current;
      audienceExclusions = {
        ...rest,
        customers: true,
        customer_audience_detected: true,
        customer_audience_id: preflight.customer_audience.customer_audience_id,
        customer_audience_name: preflight.customer_audience.customer_audience_name,
        reason: String(rest.reason || "").trim() || "Campanha de aquisição/prospecção deve excluir clientes/compradores atuais.",
      };
    } else {
      const { customer_audience_id: _id, customer_audience_name: _name, ...rest } = current;
      audienceExclusions = {
        ...rest,
        customers: false,
        customer_audience_detected: false,
        pending_dependency: CUSTOMER_AUDIENCE_PENDING_DEPENDENCY,
        reason: String(rest.reason || "").trim() || "Campanha de aquisição/prospecção exige público de clientes/compradores para exclusão antes da aprovação.",
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
  };
}

export function normalizeStrategicPlanCustomerExclusions(plan: any, preflight: StrategicPlanPreflight): any {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.planned_actions)) return plan;

  return {
    ...plan,
    planned_actions: plan.planned_actions.map((action: any) => normalizeStrategicPlanAction(action, preflight)),
  };
}

export function normalizeAndValidateStrategicPlanForApproval(
  plan: any,
  preflight: StrategicPlanPreflight | null,
): StrategicPlanApprovalGuardResult {
  if (!preflight) {
    return {
      normalizedPlan: plan,
      contract: buildMissingPreflightContract(),
      approvalStatus: "incomplete",
    };
  }

  const normalizedPlan = normalizeStrategicPlanCustomerExclusions(plan, preflight);
  const contract = validateStrategicPlanContract(normalizedPlan, preflight);
  const hasCustomerAudiencePending = Array.isArray(normalizedPlan?.planned_actions) && normalizedPlan.planned_actions.some((action: any) =>
    isProspectingLike(action) && hasCustomerAudiencePendingDependency(action?.audience_exclusions?.pending_dependency)
  );
  return {
    normalizedPlan,
    contract,
    approvalStatus: contract.ok && !hasCustomerAudiencePending ? "pending_approval" : "incomplete",
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

    const rawCampaignType = normValue(a.campaign_type);
    const rawExcl = a.audience_exclusions || {};
    const normalizedAction = normalizeStrategicPlanAction(a, preflight);
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

    // Exclusão de clientes em prospecção/aquisição
    if (isProspectingLike(a) && preflight.customer_audience.customer_audience_detected && !rawExcl.customers) {
      push({
        code: "prospecting_missing_customer_exclusion",
        severity: "blocker",
        message: "Campanha de prospecção/aquisição precisa excluir o público de Clientes.",
        path: `${path}.audience_exclusions.customers`,
      });
    }

    if (isProspectingLike(normalizedAction)) {
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
    if (intent === "creative_test") {
      const includesCustomers = a.audience_exclusions?.customers === false || a.audience_inclusion?.customers === true;
      if (includesCustomers) {
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
    if (at === "pause" || at === "reduce_budget") {
      const funnel = String(a.affected_funnel || a.funnel || "").toLowerCase();
      const released = Math.abs(Number(a.budget_released_brl || a.daily_budget_brl || 0)) * 100;
      freeByFunnel[funnel] = (freeByFunnel[funnel] ?? 0) + released;
    }

    // Produto baixa confiança não permite pause como ação principal
    const refId = a?.target_campaign_id || a?.campaign_id || a?.affected_campaign_id;
    if (refId && at === "pause") {
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
