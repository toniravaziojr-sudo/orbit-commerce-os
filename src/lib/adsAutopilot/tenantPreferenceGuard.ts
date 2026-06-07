// =====================================================================
// Tenant Preference Guard — Ads Autopilot (Etapa 7.mem — Subfase F.1)
//
// Camada PURA, determinística e compartilhada que avalia uma sugestão
// rascunhada do Ads Autopilot contra as preferências aprendidas do
// tenant (Tenant Memory) e devolve a sugestão original ou ajustada
// junto com um bloco de rastreabilidade (`influence_trace`).
//
// Princípios obrigatórios desta subfase:
//   - NÃO consulta banco. As memórias chegam como entrada (carregadas
//     previamente pelo Reader da Subfase D).
//   - NÃO chama Meta. NÃO usa LLM. NÃO executa ação. NÃO aprova ação.
//   - NÃO é plugada em geradores (Analyze/Strategist/Guardian/gatilho
//     determinístico de orçamento/criativos/experiments) nesta F.1.
//     O plug ocorre apenas a partir da Subfase F.2 em diante, e sempre
//     em modo silencioso primeiro.
//   - Falha aberta: qualquer erro interno devolve a recomendação
//     original com `fail_open: true` no trace.
//   - Hierarquia: Segurança/Plataforma > Governance > Policy Engine >
//     Matriz por objetivo > Configurações explícitas do tenant >
//     Tenant Memory active > Tenant Memory provisional > Dados atuais
//     da campanha. Se a memória conflitar com qualquer camada acima,
//     a memória PERDE.
// =====================================================================

import type { TenantMemoryRow, TenantMemoryStatus } from "./memoryReader";

export type GuardInfluenceType =
  | "none"
  | "block"
  | "downgrade"
  | "soften"
  | "enrich_rationale"
  | "prioritize";

export interface GuardGovernanceFlags {
  /** true se camada superior (segurança/plataforma) já travou a ação. */
  platform_locked?: boolean;
  /** true se Governance Layer já bloqueou. */
  governance_blocked?: boolean;
  /** true se Policy Engine já bloqueou. */
  policy_blocked?: boolean;
  /** true se a ação é exigida por configuração explícita do tenant. */
  tenant_explicit_required?: boolean;
  /** true se kill switch global do tenant está ativo. */
  kill_switch?: boolean;
}

export interface DraftRecommendation {
  /** Identificador estável do rascunho (para trace). Opcional. */
  draft_id?: string;
  action_type: string;
  /** Parâmetros estruturados; o Guard pode suavizar campos numéricos. */
  params?: Record<string, unknown>;
  /** Status proposto pelo gerador (ex.: "proposed", "needs_human_review"). */
  proposed_status?: string;
  /** Rationale textual original do gerador. */
  rationale?: string;
  /** Marcador opcional de prioridade. */
  priority?: "normal" | "high";
  /** Quaisquer outros campos do rascunho são preservados. */
  [key: string]: unknown;
}

export interface GuardInput {
  tenant_id: string;
  ads_platform: string;
  sales_platform?: string | null;
  action_type: string;
  objective?: string | null;
  campaign_id?: string | null;
  product_id?: string | null;
  draft: DraftRecommendation;
  /** Memórias já carregadas pelo Reader (Subfase D). */
  memories: TenantMemoryRow[];
  governance?: GuardGovernanceFlags;
  /** Contexto adicional opcional. Não é interpretado nesta F.1. */
  context?: Record<string, unknown>;
}

export interface InfluenceTrace {
  tenant_memory_used: boolean;
  memory_ids_used: string[];
  memory_statuses_used: TenantMemoryStatus[];
  influence_type: GuardInfluenceType;
  before_recommendation: DraftRecommendation;
  after_recommendation: DraftRecommendation;
  why_memory_applied: string[];
  why_memory_did_not_apply: string[];
  /** true quando o Guard de fato alterou o rascunho retornado. */
  applied_to_decision: boolean;
  /** true quando algo falhou e devolvemos o rascunho original. */
  fail_open: boolean;
}

export interface GuardOutput {
  recommendation: DraftRecommendation;
  trace: InfluenceTrace;
}

// ---------------------------------------------------------------------
// Conjuntos de chaves de memória reconhecidas nesta primeira versão.
// Outras chaves passam adiante apenas como enrich_rationale (se active).
// ---------------------------------------------------------------------
const BLOCK_KEYS = new Set([
  "do_not_scale_this_product",
  "rejected_action_pattern",
  "campaign_protection_candidate",
  "cold_campaign_too_aggressive",
]);

const SOFTEN_BUDGET_KEYS = new Set([
  "budget_preference",
  "conservative_budget_increase",
]);

const PRIORITIZE_KEYS = new Set([
  "approved_action_pattern",
  "preferred_action_pattern",
]);

const BUDGET_ACTION_TYPES = new Set([
  "increase_budget",
  "budget_increase",
  "scale_budget",
  "raise_budget",
]);

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

function cloneDraft(d: DraftRecommendation): DraftRecommendation {
  // Clone raso suficiente para os campos que o Guard altera.
  return {
    ...d,
    params: d.params ? { ...d.params } : undefined,
  };
}

function emptyTrace(draft: DraftRecommendation, why: string[]): InfluenceTrace {
  return {
    tenant_memory_used: false,
    memory_ids_used: [],
    memory_statuses_used: [],
    influence_type: "none",
    before_recommendation: draft,
    after_recommendation: draft,
    why_memory_applied: [],
    why_memory_did_not_apply: why,
    applied_to_decision: false,
    fail_open: false,
  };
}

function failOpen(draft: DraftRecommendation, reason: string): GuardOutput {
  return {
    recommendation: draft,
    trace: {
      tenant_memory_used: false,
      memory_ids_used: [],
      memory_statuses_used: [],
      influence_type: "none",
      before_recommendation: draft,
      after_recommendation: draft,
      why_memory_applied: [],
      why_memory_did_not_apply: [reason],
      applied_to_decision: false,
      fail_open: true,
    },
  };
}

/** Aplica os filtros mínimos de aplicabilidade ao input do Guard. */
function selectApplicableMemories(input: GuardInput): {
  active: TenantMemoryRow[];
  provisional: TenantMemoryRow[];
  ignored_archived: number;
  ignored_other_tenant: number;
  ignored_other_platform: number;
} {
  const active: TenantMemoryRow[] = [];
  const provisional: TenantMemoryRow[] = [];
  let ignored_archived = 0;
  let ignored_other_tenant = 0;
  let ignored_other_platform = 0;

  for (const m of input.memories || []) {
    if (m.status === "archived") {
      ignored_archived += 1;
      continue;
    }
    if (m.tenant_id !== input.tenant_id) {
      ignored_other_tenant += 1;
      continue;
    }
    if (input.ads_platform && m.ads_platform !== input.ads_platform) {
      ignored_other_platform += 1;
      continue;
    }
    if (
      input.sales_platform &&
      m.sales_platform &&
      m.sales_platform !== input.sales_platform
    ) {
      ignored_other_platform += 1;
      continue;
    }
    if (m.status === "active") active.push(m);
    else if (m.status === "provisional") provisional.push(m);
  }

  return {
    active,
    provisional,
    ignored_archived,
    ignored_other_tenant,
    ignored_other_platform,
  };
}

function memoryMatchesAction(m: TenantMemoryRow, input: GuardInput): boolean {
  const v = (m.value || {}) as Record<string, unknown>;
  if (typeof v.action_type === "string" && v.action_type !== input.action_type) {
    return false;
  }
  if (input.campaign_id && typeof v.campaign_id === "string" && v.campaign_id !== input.campaign_id) {
    return false;
  }
  if (input.product_id && typeof v.product_id === "string" && v.product_id !== input.product_id) {
    return false;
  }
  if (input.objective && typeof v.objective === "string" && v.objective !== input.objective) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------
// Núcleo do Guard
// ---------------------------------------------------------------------

export function applyTenantPreferenceGuard(input: GuardInput): GuardOutput {
  // Validação básica
  if (!input || !input.tenant_id || !input.ads_platform || !input.draft || !input.action_type) {
    return failOpen(
      input?.draft ?? ({} as DraftRecommendation),
      "guard_invalid_input_fail_open",
    );
  }

  const draft = input.draft;

  try {
    // Hierarquia: camadas superiores travam → Guard nunca contraria.
    const gov = input.governance || {};
    if (gov.platform_locked || gov.governance_blocked || gov.policy_blocked || gov.kill_switch) {
      return {
        recommendation: draft,
        trace: emptyTrace(draft, ["upper_layer_locked_memory_skipped"]),
      };
    }

    const { active, provisional, ignored_archived, ignored_other_tenant, ignored_other_platform } =
      selectApplicableMemories(input);

    if (active.length === 0 && provisional.length === 0) {
      const why = ["no_applicable_memory"];
      if (ignored_archived > 0) why.push(`ignored_archived:${ignored_archived}`);
      if (ignored_other_tenant > 0) why.push(`ignored_other_tenant:${ignored_other_tenant}`);
      if (ignored_other_platform > 0) why.push(`ignored_other_platform:${ignored_other_platform}`);
      return { recommendation: draft, trace: emptyTrace(draft, why) };
    }

    const usedIds: string[] = [];
    const usedStatuses = new Set<TenantMemoryStatus>();
    const whyApplied: string[] = [];
    const whyNotApplied: string[] = [];
    let influence: GuardInfluenceType = "none";
    let after = cloneDraft(draft);

    // ---------- 1. BLOQUEIO/DOWNGRADE por memória active ----------
    const blockingActive = active.find(
      (m) => BLOCK_KEYS.has(m.key) && memoryMatchesAction(m, input),
    );
    if (blockingActive) {
      // Configuração explícita do tenant tem precedência sobre memória.
      if (gov.tenant_explicit_required) {
        whyNotApplied.push("tenant_explicit_required_overrides_memory_block");
        influence = "none";
      } else {
        usedIds.push(blockingActive.id);
        usedStatuses.add("active");
        after = cloneDraft(draft);
        after.proposed_status = "needs_human_review";
        after.rationale = appendRationale(
          after.rationale,
          `Bloqueado por preferência aprendida do tenant: ${blockingActive.key}`,
        );
        whyApplied.push(`active_block_key:${blockingActive.key}`);
        influence = "block";
        return finalize(draft, after, influence, usedIds, usedStatuses, whyApplied, whyNotApplied);
      }
    }

    // ---------- 2. SOFTEN de orçamento ----------
    if (BUDGET_ACTION_TYPES.has(input.action_type)) {
      const softenMem = active.find(
        (m) => SOFTEN_BUDGET_KEYS.has(m.key) && isConservativeBudget(m),
      );
      if (softenMem) {
        const cap = readCap(softenMem);
        const softened = softenBudgetParams(draft, cap);
        if (softened.changed) {
          usedIds.push(softenMem.id);
          usedStatuses.add("active");
          after = softened.draft;
          after.rationale = appendRationale(
            after.rationale,
            `Suavizado para limite conservador aprendido (${cap ?? "padrão"}).`,
          );
          whyApplied.push(`active_soften_budget:${softenMem.key}`);
          influence = "soften";
          return finalize(draft, after, influence, usedIds, usedStatuses, whyApplied, whyNotApplied);
        } else {
          whyNotApplied.push("soften_budget_no_change_needed");
        }
      }
    }

    // ---------- 3. PRIORITIZE por memória active alinhada ----------
    const prioritizeMem = active.find(
      (m) => PRIORITIZE_KEYS.has(m.key) && memoryMatchesAction(m, input),
    );
    if (prioritizeMem) {
      usedIds.push(prioritizeMem.id);
      usedStatuses.add("active");
      after = cloneDraft(draft);
      after.priority = "high";
      after.rationale = appendRationale(
        after.rationale,
        "Priorizado: alinhado a preferência aprovada do tenant.",
      );
      whyApplied.push(`active_prioritize:${prioritizeMem.key}`);
      influence = "prioritize";
      return finalize(draft, after, influence, usedIds, usedStatuses, whyApplied, whyNotApplied);
    }

    // ---------- 4. ENRICH RATIONALE ----------
    // Memórias provisional NUNCA bloqueiam sozinhas — apenas enriquecem.
    // Memórias active não cobertas pelas regras acima também enriquecem.
    const enrichSources: TenantMemoryRow[] = [];
    for (const m of provisional) {
      if (memoryMatchesAction(m, input)) enrichSources.push(m);
    }
    for (const m of active) {
      if (
        !BLOCK_KEYS.has(m.key) &&
        !SOFTEN_BUDGET_KEYS.has(m.key) &&
        !PRIORITIZE_KEYS.has(m.key) &&
        memoryMatchesAction(m, input)
      ) {
        enrichSources.push(m);
      }
    }
    if (enrichSources.length > 0) {
      after = cloneDraft(draft);
      const notes = enrichSources
        .map((m) => `${m.status === "active" ? "[active]" : "[provisional]"} ${m.key}`)
        .join("; ");
      after.rationale = appendRationale(
        after.rationale,
        `Observação da memória do tenant: ${notes}`,
      );
      for (const m of enrichSources) {
        usedIds.push(m.id);
        usedStatuses.add(m.status);
      }
      whyApplied.push(`enrich_rationale:${enrichSources.length}_memories`);
      influence = "enrich_rationale";
      return finalize(draft, after, influence, usedIds, usedStatuses, whyApplied, whyNotApplied);
    }

    // Nenhuma regra disparou — devolve original.
    whyNotApplied.push("memory_present_but_no_rule_matched");
    return { recommendation: draft, trace: emptyTrace(draft, whyNotApplied) };
  } catch (err) {
    return failOpen(draft, `guard_internal_error_fail_open:${(err as Error)?.message ?? "unknown"}`);
  }
}

// ---------------------------------------------------------------------
// Helpers de suavização
// ---------------------------------------------------------------------

function appendRationale(existing: string | undefined, note: string): string {
  if (!existing || !existing.trim()) return note;
  return `${existing}\n${note}`;
}

function isConservativeBudget(m: TenantMemoryRow): boolean {
  const v = (m.value || {}) as Record<string, unknown>;
  const flag = v.style ?? v.preference ?? v.mode;
  if (typeof flag === "string" && /conservativ/i.test(flag)) return true;
  // Se houver um cap explícito, também consideramos conservador.
  return typeof v.max_increase_pct === "number" || typeof v.cap_pct === "number";
}

function readCap(m: TenantMemoryRow): number | null {
  const v = (m.value || {}) as Record<string, unknown>;
  if (typeof v.max_increase_pct === "number") return v.max_increase_pct;
  if (typeof v.cap_pct === "number") return v.cap_pct;
  return null;
}

function softenBudgetParams(
  draft: DraftRecommendation,
  cap: number | null,
): { draft: DraftRecommendation; changed: boolean } {
  const limit = cap ?? 20; // limite conservador padrão: 20%
  const out = cloneDraft(draft);
  const params = (out.params ?? {}) as Record<string, unknown>;
  let changed = false;

  if (typeof params.increase_pct === "number" && params.increase_pct > limit) {
    params.increase_pct = limit;
    changed = true;
  }
  if (typeof params.percent_change === "number" && params.percent_change > limit) {
    params.percent_change = limit;
    changed = true;
  }
  out.params = params;
  return { draft: out, changed };
}

function finalize(
  before: DraftRecommendation,
  after: DraftRecommendation,
  influence: GuardInfluenceType,
  usedIds: string[],
  usedStatuses: Set<TenantMemoryStatus>,
  whyApplied: string[],
  whyNotApplied: string[],
): GuardOutput {
  return {
    recommendation: after,
    trace: {
      tenant_memory_used: usedIds.length > 0,
      memory_ids_used: usedIds,
      memory_statuses_used: Array.from(usedStatuses),
      influence_type: influence,
      before_recommendation: before,
      after_recommendation: after,
      why_memory_applied: whyApplied,
      why_memory_did_not_apply: whyNotApplied,
      applied_to_decision: influence !== "none",
      fail_open: false,
    },
  };
}
