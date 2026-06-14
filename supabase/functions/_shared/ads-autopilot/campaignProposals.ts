// =====================================================================
// Onda H.2 — Gerador de Propostas Filhas Detalhadas
//
// Recebe um Plano Estratégico **já validado e aprovado** (passou pelo
// guard canônico em strategicPlanContract.ts) e gera 1 registro
// `campaign_proposal` por ação planejada.
//
// REGRAS INVIOLÁVEIS:
// - Função PURA. Não chama banco, não chama Meta, não consome crédito.
// - Não gera criativo. Não cria público. Não cria catálogo.
// - Cada proposta nasce em status='pending_approval' (UI legada lê
//   `pending_approval` e mostra na fila), com lifecycle canônico
//   `campaign_proposal_pending_review` dentro de action_data.lifecycle.
// - Dedup garantida pelo índice único parcial
//   idx_aaa_child_dedup_plan_action (parent_action_id, planned_action_index).
//   Quem chama deve tratar erro 23505 como "já existe" (idempotente).
// =====================================================================

export const CAMPAIGN_PROPOSAL_SCHEMA_VERSION = "campaign_proposal_v1" as const;
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
  // default seguro: ajuste — não pressupõe criação real
  return "campaign_adjustment_proposal";
}

// ---------------- Snapshot da campanha ------------------------------

function buildCampaignSnapshot(action: any) {
  const brlToCents = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : null;
    return n !== null && Number.isFinite(n) ? Math.round(n * 100) : null;
  };
  const dailyBudgetCents =
    action?.daily_budget_cents
    ?? action?.budget_cents
    ?? brlToCents(action?.daily_budget_brl)
    ?? brlToCents(action?.budget_brl)
    ?? null;
  return {
    name: action?.campaign_name || action?.name || null,
    objective: action?.objective || null,
    daily_budget_cents: dailyBudgetCents,
    initial_status_planned: action?.initial_status || "PAUSED",
    campaign_type: action?.campaign_type || null,
    campaign_intent: action?.campaign_intent || null,
    product: action?.product_name || action?.product || null,
    product_id: action?.product_id || null,
    funnel_stage: action?.funnel_stage || action?.funnel || null,
    affected_funnel: action?.affected_funnel || null,
    rationale: action?.rationale || null,
    risks: action?.risks || null,
    dependencies: action?.dependencies || null,
    utm_base: action?.utm || action?.utm_base || null,
    audience_budget_fit: action?.audience_budget_fit || null,
    budget_source: action?.budget_source || null,
    existing_campaign_id: action?.target_campaign_id || action?.campaign_id || null,
    existing_campaign_action: action?.existing_campaign_action || null,
  };
}

// ---------------- Snapshot de conjuntos -----------------------------

function buildAdsetsSnapshot(action: any): any[] {
  const adsets = Array.isArray(action?.adsets) ? action.adsets : [];
  return adsets.map((adset: any, i: number) => ({
    index: i,
    name: adset?.name || `Conjunto ${i + 1}`,
    audience: adset?.audience || adset?.audience_name || null,
    targeting: adset?.targeting || null,
    audience_exclusions: adset?.audience_exclusions || null,
    excluded_audience_ids: adset?.excluded_audience_ids || null,
    daily_budget_cents: adset?.daily_budget_cents ?? null,
    placements: adset?.placements || null,
    optimization_event: adset?.optimization_event || adset?.conversion_event || null,
    required_audiences: adset?.required_audiences || null,
    required_lookalikes: adset?.required_lookalikes || null,
    required_catalogs: adset?.required_catalogs || adset?.product_catalog_id ? {
      catalog_id: adset?.product_catalog_id || null,
      product_set: adset?.product_set || null,
    } : null,
    pending_dependencies: adset?.pending_dependency || adset?.pending_dependencies || null,
  }));
}

// ---------------- Snapshot de criativos planejados ------------------

function buildPlannedCreativesSnapshot(action: any): any[] {
  // Os criativos no Plano Estratégico vêm como descritivos (não gerados).
  // Pode estar em action.creatives, action.planned_creatives ou action.ads.
  const raw = Array.isArray(action?.creatives) ? action.creatives
    : Array.isArray(action?.planned_creatives) ? action.planned_creatives
    : Array.isArray(action?.ads) ? action.ads
    : [];
  return raw.map((c: any, i: number) => ({
    index: i,
    quantity: c?.quantity ?? 1,
    format: c?.format || null,
    angle: c?.angle || null,
    promise: c?.promise || null,
    copy: c?.copy || c?.primary_text || null,
    headline: c?.headline || null,
    cta: c?.cta || c?.call_to_action || null,
    final_url_with_utm: c?.destination_url || c?.final_url || null,
    visual_prompt: c?.visual_prompt || c?.prompt || null,
    reference: c?.reference || c?.reference_asset_id || null,
    generation_status: "planned_only" as const,
  }));
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

// ---------------- Construção do registro ---------------------------

function buildProposalRecord(
  action: any,
  index: number,
  parent: ParentPlanContext,
  plan: any,
): CampaignProposalRecord {
  const kind = classifyProposalKind(action);
  const campaignSnapshot = buildCampaignSnapshot(action);
  const adsetsSnapshot = buildAdsetsSnapshot(action);
  const creativesSnapshot = buildPlannedCreativesSnapshot(action);
  const validations = buildValidationsSnapshot(action);

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
      campaign: campaignSnapshot,
      adsets: adsetsSnapshot,
      planned_creatives: creativesSnapshot,
      validations,
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
    records.push(buildProposalRecord(action, i, parent, plan));
  }

  return { records, skipped_reasons: skipped };
}
