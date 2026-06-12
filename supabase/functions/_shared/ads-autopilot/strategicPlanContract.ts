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

export const CONTRACT_VERSION = "1.0.0";

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

const LEGACY_CAMPAIGN_TYPES = new Set(["tof", "mof", "bof", "remarketing", "teste", "test", "remarket", "topo", "meio", "fundo"]);

const COLD_ACTION_HINTS = new Set([
  "cold",
  "tof",
  "frio",
  "prospecting",
  "prospect",
  "prospeccao",
  "topo",
  "topo de funil",
  "catalog_prospecting",
]);

function normValue(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hasCreativeTestCustomerOverride(action: any): boolean {
  const intent = normValue(action?.campaign_intent);
  const overrideReason = String(action?.exclusion_override_reason || "").trim();
  const explicitlyIncludesCustomers = action?.audience_exclusions?.customers === false || action?.audience_inclusion?.customers === true;
  return intent === "creative_test" && explicitlyIncludesCustomers && overrideReason.length >= 12;
}

function isProspectingLike(action: any): boolean {
  const t = normValue(action?.campaign_type);
  const i = normValue(action?.campaign_intent);
  const funnel = normValue(action?.funnel || action?.affected_funnel);
  const stage = normValue(action?.funnel_stage);
  if (COLD_ACTION_HINTS.has(t) || COLD_ACTION_HINTS.has(funnel) || COLD_ACTION_HINTS.has(stage)) return true;
  if (i === "acquisition" || i === "scale") return true;
  return false;
}

function isCatalogType(t: string): boolean {
  return t === "catalog_prospecting" || t === "catalog_retargeting";
}

function isBudgetAction(a: any): boolean {
  const at = String(a?.action_type || "").toLowerCase();
  return ["create_campaign", "scale", "scale_budget", "reduce_budget", "pause", "reallocate_budget", "maintain"].includes(at);
}

export function normalizeStrategicPlanCustomerExclusions(plan: any, preflight: StrategicPlanPreflight): any {
  if (!plan || typeof plan !== "object" || !Array.isArray(plan.planned_actions)) return plan;

  const detected = preflight.customer_audience.customer_audience_detected;

  return {
    ...plan,
    planned_actions: plan.planned_actions.map((action: any) => {
      if (!action || typeof action !== "object") return action;
      if (!isProspectingLike(action)) return action;
      if (hasCreativeTestCustomerOverride(action)) return action;

      const current = (action.audience_exclusions && typeof action.audience_exclusions === "object")
        ? action.audience_exclusions
        : {};

      if (detected) {
        const { pending_dependency: _pending, ...rest } = current;
        return {
          ...action,
          audience_exclusions: {
            ...rest,
            customers: true,
            reason: String(rest.reason || "").trim() || "Público frio deve excluir clientes existentes por padrão.",
            customer_audience_detected: true,
          },
        };
      }

      const { customers: _customers, ...rest } = current;
      return {
        ...action,
        audience_exclusions: {
          ...rest,
          reason: String(rest.reason || "").trim() || "Público de Clientes não detectado nesta conta.",
          customer_audience_detected: false,
          pending_dependency: "customer_audience_missing",
        },
      };
    }),
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

    const campaignType = String(a.campaign_type || "").toLowerCase();
    if (!campaignType) {
      push({ code: "action_missing_campaign_type", severity: "blocker", message: "Ação sem `campaign_type`.", path });
    } else if (LEGACY_CAMPAIGN_TYPES.has(campaignType)) {
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

    const intent = String(a.campaign_intent || "").toLowerCase();
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
    if (isProspectingLike(a)) {
      const excl = a.audience_exclusions || {};
      const detected = preflight.customer_audience.customer_audience_detected;
      if (detected) {
        if (!excl.customers) {
          push({
            code: "prospecting_missing_customer_exclusion",
            severity: "blocker",
            message: "Campanha de prospecção/aquisição precisa excluir o público de Clientes.",
            path: `${path}.audience_exclusions.customers`,
          });
        }
      } else {
        if (excl.pending_dependency !== "customer_audience_missing") {
          push({
            code: "prospecting_missing_pending_dependency",
            severity: "blocker",
            message: "Público de Clientes não detectado — a ação precisa declarar `audience_exclusions.pending_dependency='customer_audience_missing'`.",
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
