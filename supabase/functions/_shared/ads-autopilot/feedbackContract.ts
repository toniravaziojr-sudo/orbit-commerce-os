// =====================================================================
// Validador puro do contrato de feedback do Ads Autopilot (Subfase A.1).
// Cópia self-contained para a Edge Function — versão canônica no app está
// em src/lib/adsAutopilot/feedbackContract.ts. Mantenha em paridade.
// =====================================================================

export const ALLOWED_DECISIONS = [
  "approved",
  "rejected",
  "needs_revision",
  "edited_then_approved",
] as const;

export type FeedbackDecision = (typeof ALLOWED_DECISIONS)[number];

export const ALLOWED_CONFIDENCE = ["low", "medium", "high"] as const;
export type FeedbackConfidence = (typeof ALLOWED_CONFIDENCE)[number];

export interface FeedbackInput {
  tenant_id: string;
  recommendation_id?: string | null;
  suggestion_group_id?: string | null;
  action_id?: string | null;

  sales_platform?: string | null;
  ads_platform: string;
  ad_account_id?: string | null;
  campaign_id?: string | null;
  campaign_name?: string | null;
  objective?: string | null;
  functional_state?: string | null;
  proposed_verdict?: string | null;
  action_type?: string | null;
  action_class?: string | null;

  metrics_snapshot: Record<string, unknown>;
  policy_check_result?: Record<string, unknown> | null;
  observation?: string | null;

  decision: FeedbackDecision;
  reason_codes: string[];
  reason_text?: string | null;
  tags?: string[] | null;

  user_confidence?: FeedbackConfidence | null;
  would_do_manually?: boolean | null;
  should_become_preference?: boolean | null;
  ignored_context?: boolean | null;
  ignored_context_text?: string | null;

  diff?: Record<string, unknown> | null;
}

export interface ValidationResult {
  ok: boolean;
  error?: string;
  details?: unknown;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const DECISION_SET = new Set<string>(ALLOWED_DECISIONS);
const CONFIDENCE_SET = new Set<string>(ALLOWED_CONFIDENCE);

export function validateFeedbackInput(
  input: Partial<FeedbackInput> | null | undefined,
): ValidationResult {
  if (!input || typeof input !== "object") {
    return { ok: false, error: "invalid_payload" };
  }
  if (!input.tenant_id || !UUID_RE.test(String(input.tenant_id))) {
    return { ok: false, error: "tenant_id_required" };
  }
  if (!input.ads_platform || typeof input.ads_platform !== "string") {
    return { ok: false, error: "ads_platform_required" };
  }
  if (!input.decision || !DECISION_SET.has(String(input.decision))) {
    return {
      ok: false,
      error: "invalid_decision",
      details: { allowed: Array.from(DECISION_SET) },
    };
  }
  if (
    !Array.isArray(input.reason_codes) ||
    input.reason_codes.length === 0 ||
    input.reason_codes.some((c) => typeof c !== "string" || !c.trim())
  ) {
    return { ok: false, error: "reason_codes_required" };
  }
  if (
    input.metrics_snapshot === undefined ||
    input.metrics_snapshot === null ||
    typeof input.metrics_snapshot !== "object" ||
    Array.isArray(input.metrics_snapshot)
  ) {
    return { ok: false, error: "metrics_snapshot_required" };
  }
  if (
    input.user_confidence !== undefined &&
    input.user_confidence !== null &&
    !CONFIDENCE_SET.has(String(input.user_confidence))
  ) {
    return { ok: false, error: "invalid_user_confidence" };
  }
  if (input.diff !== undefined && input.diff !== null) {
    if (input.decision !== "edited_then_approved") {
      return { ok: false, error: "diff_only_allowed_for_edited_then_approved" };
    }
    if (typeof input.diff !== "object" || Array.isArray(input.diff)) {
      return { ok: false, error: "invalid_diff" };
    }
  }
  for (
    const f of [
      "recommendation_id",
      "suggestion_group_id",
      "action_id",
    ] as const
  ) {
    const v = (input as Record<string, unknown>)[f];
    if (v !== undefined && v !== null && !UUID_RE.test(String(v))) {
      return { ok: false, error: `invalid_${f}` };
    }
  }
  return { ok: true };
}
