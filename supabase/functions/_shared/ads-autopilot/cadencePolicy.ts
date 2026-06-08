// =====================================================================
// Ads Autopilot — Política Operacional v1 (Cadência)
//
// Módulo PURO (sem I/O): regras determinísticas que separam operação
// diária leve de ações estruturais semanais/mensais e enforçam janelas
// de aprendizado por plataforma.
//
// NÃO chama banco, NÃO chama Meta, NÃO chama LLM.
// Tudo aqui é testável de forma isolada.
//
// Fonte de verdade documental: docs/especificacoes/marketing/gestor-trafego.md
// seção "Política Operacional v1".
// =====================================================================

export const CADENCE_POLICY_VERSION = "1.0.0";

// --------------------------------------------------------------------
// 1. Perfis por plataforma — officially_documented vs conservative_default
// --------------------------------------------------------------------

export type PlatformKey = "meta" | "google" | "tiktok";

export interface PlatformProfile {
  platform: PlatformKey;
  /** Período de aprendizado típico em dias — oficial quando indicado. */
  learning_phase_days: { value: number; source: "officially_documented" | "conservative_operational_default" };
  /** Mínimo de eventos de conversão para sair do learning. */
  min_conversion_events: { value: number; source: "officially_documented" | "conservative_operational_default" };
  /** Dias mínimos rodando antes de qualquer otimização real. */
  min_days_before_optimization: { value: number; source: "officially_documented" | "conservative_operational_default" };
  /** Intervalo mínimo recomendado entre ajustes de orçamento (horas). */
  min_hours_between_budget_changes: { value: number; source: "officially_documented" | "conservative_operational_default" };
  /** Percentual máximo recomendado de variação de orçamento por ciclo. */
  max_budget_change_pct_per_cycle: { value: number; source: "officially_documented" | "conservative_operational_default" };
  /** Janela observacional (após mín. dias mas antes de poder otimizar). */
  observational_window_days: { value: number; source: "officially_documented" | "conservative_operational_default" };
  /** Dayparting recomendado pela plataforma? */
  dayparting_recommended: { value: boolean; source: "officially_documented" | "conservative_operational_default" };
  /** Fontes consultadas. */
  sources: string[];
}

export const PLATFORM_PROFILES: Record<PlatformKey, PlatformProfile> = {
  meta: {
    platform: "meta",
    learning_phase_days: { value: 7, source: "officially_documented" },
    min_conversion_events: { value: 50, source: "officially_documented" },
    min_days_before_optimization: { value: 3, source: "conservative_operational_default" },
    min_hours_between_budget_changes: { value: 72, source: "conservative_operational_default" },
    max_budget_change_pct_per_cycle: { value: 20, source: "conservative_operational_default" },
    observational_window_days: { value: 4, source: "conservative_operational_default" }, // 3 a 7 dias
    dayparting_recommended: { value: false, source: "officially_documented" },
    sources: [
      "facebook.com/business/help/112167992830700 (About the learning phase)",
      "facebook.com/business/help/316478108955072 (Significant edits and learning phase)",
      "developers.facebook.com/docs/marketing-api/bidding/overview/pacing-and-scheduling",
    ],
  },
  google: {
    platform: "google",
    learning_phase_days: { value: 7, source: "officially_documented" },
    min_conversion_events: { value: 50, source: "officially_documented" }, // "~50 conversões ou 3 ciclos"
    min_days_before_optimization: { value: 7, source: "conservative_operational_default" },
    min_hours_between_budget_changes: { value: 72, source: "conservative_operational_default" },
    max_budget_change_pct_per_cycle: { value: 20, source: "conservative_operational_default" },
    observational_window_days: { value: 7, source: "conservative_operational_default" },
    dayparting_recommended: { value: true, source: "officially_documented" },
    sources: [
      "support.google.com/google-ads/answer/13020501 (Google Ads learning phase and duration)",
      "support.google.com/google-ads/answer/10970825 (How our bidding algorithms learn)",
      "support.google.com/google-ads/answer/7065882 (About Smart Bidding)",
    ],
  },
  tiktok: {
    platform: "tiktok",
    learning_phase_days: { value: 7, source: "officially_documented" },
    min_conversion_events: { value: 50, source: "officially_documented" },
    min_days_before_optimization: { value: 3, source: "conservative_operational_default" },
    min_hours_between_budget_changes: { value: 72, source: "conservative_operational_default" },
    max_budget_change_pct_per_cycle: { value: 20, source: "conservative_operational_default" },
    observational_window_days: { value: 4, source: "conservative_operational_default" },
    dayparting_recommended: { value: false, source: "conservative_operational_default" },
    sources: [
      "ads.tiktok.com/business/library/Web_Auction_Best_Practices_Guide.pdf",
    ],
  },
};

// --------------------------------------------------------------------
// 2. Idade de campanha — no_touch / observe_only / optimize_allowed
// --------------------------------------------------------------------

export type CampaignAgeGate = "no_touch" | "observe_only" | "optimize_allowed";

export interface CampaignAgeInput {
  platform: PlatformKey;
  daysRunning: number;
  inLearningPhase: boolean;
  conversionEventsLast7d?: number;
}

export function evaluateCampaignAge(input: CampaignAgeInput): {
  gate: CampaignAgeGate;
  reason: string;
} {
  const profile = PLATFORM_PROFILES[input.platform];
  if (input.inLearningPhase) {
    return { gate: "no_touch", reason: "in_learning_phase" };
  }
  if (input.daysRunning < profile.min_days_before_optimization.value) {
    return { gate: "no_touch", reason: "min_days_before_optimization_not_met" };
  }
  const observationalUpper =
    profile.min_days_before_optimization.value + profile.observational_window_days.value;
  if (input.daysRunning < observationalUpper) {
    return { gate: "observe_only", reason: "within_observational_window" };
  }
  const minEvents = profile.min_conversion_events.value;
  if (
    typeof input.conversionEventsLast7d === "number" &&
    input.conversionEventsLast7d < minEvents
  ) {
    return { gate: "observe_only", reason: "insufficient_conversion_events" };
  }
  return { gate: "optimize_allowed", reason: "mature_and_stable" };
}

// --------------------------------------------------------------------
// 3. Janela operacional de orçamento (00:01–03:00 BRT)
// --------------------------------------------------------------------

/**
 * Retorna true se o instante `now` está dentro da janela operacional
 * 00:01–03:00 BRT (America/Sao_Paulo, UTC-3 fixo / sem horário de verão
 * atual). Verificação por componentes de hora em BRT.
 */
export function isWithinBudgetWindow(now: Date): boolean {
  // BRT = UTC-3 (Brasil aboliu DST). Calculamos hora em BRT.
  const utcMs = now.getTime();
  const brt = new Date(utcMs - 3 * 60 * 60 * 1000);
  const h = brt.getUTCHours();
  const m = brt.getUTCMinutes();
  // 00:01 ≤ hora < 03:00
  if (h === 0 && m >= 1) return true;
  if (h === 1 || h === 2) return true;
  return false;
}

// --------------------------------------------------------------------
// 4. Variação de orçamento — dentro do limite 20%
// --------------------------------------------------------------------

export interface BudgetChangeInput {
  platform: PlatformKey;
  currentCents: number;
  proposedCents: number;
}

export function evaluateBudgetChange(input: BudgetChangeInput): {
  allowed: boolean;
  requires_human_approval: boolean;
  pct_change: number;
  cap_pct: number;
  cap_source: "officially_documented" | "conservative_operational_default";
  reason: string;
} {
  const profile = PLATFORM_PROFILES[input.platform];
  const cap = profile.max_budget_change_pct_per_cycle;
  if (input.currentCents <= 0) {
    return {
      allowed: false,
      requires_human_approval: true,
      pct_change: 0,
      cap_pct: cap.value,
      cap_source: cap.source,
      reason: "current_budget_zero_or_missing",
    };
  }
  const diff = input.proposedCents - input.currentCents;
  const pct = (diff / input.currentCents) * 100;
  const abs = Math.abs(pct);
  if (abs <= cap.value) {
    return {
      allowed: true,
      requires_human_approval: false,
      pct_change: pct,
      cap_pct: cap.value,
      cap_source: cap.source,
      reason: "within_conservative_cap",
    };
  }
  return {
    allowed: false,
    requires_human_approval: true,
    pct_change: pct,
    cap_pct: cap.value,
    cap_source: cap.source,
    reason: "exceeds_conservative_cap",
  };
}

// --------------------------------------------------------------------
// 5. Ações proibidas no ciclo diário (Analyze)
// --------------------------------------------------------------------

export const DAILY_BLOCKED_ACTION_TYPES = new Set<string>([
  "create_campaign",
  "create_adset",
  "generate_creative",
  "create_audience",
  "create_lookalike_audience",
  "duplicate_campaign",
  "update_campaign_copy",
  "update_offer",
]);

export const DAILY_ALLOWED_ACTION_TYPES = new Set<string>([
  "adjust_budget",
  "pause_campaign", // somente emergencial — quem chama deve validar pauseReason
  "activate_campaign",
  "report_insight",
  "alert",
]);

export function isDailyActionAllowed(actionType: string): {
  allowed: boolean;
  reason: string;
} {
  if (DAILY_BLOCKED_ACTION_TYPES.has(actionType)) {
    return { allowed: false, reason: "structural_action_blocked_in_daily_cycle" };
  }
  if (DAILY_ALLOWED_ACTION_TYPES.has(actionType)) {
    return { allowed: true, reason: "operational_action" };
  }
  // Default conservador: tipos desconhecidos não passam no diário.
  return { allowed: false, reason: "unknown_action_type_blocked_by_default" };
}

// --------------------------------------------------------------------
// 6. Pausas — emergencial vs estratégica
// --------------------------------------------------------------------

export type PauseKind = "emergency" | "strategic" | "unknown";

export const EMERGENCY_PAUSE_REASONS = new Set<string>([
  "site_down",
  "out_of_stock",
  "abnormal_spend",
  "tracking_broken_with_performance_drop",
  "operational_risk",
  "fraud_detected",
  "meta_account_alert",
]);

export const STRATEGIC_PAUSE_REASONS = new Set<string>([
  "low_performance",
  "dayparting",
  "manual_strategic",
  "reorganize_account",
  "test_pause",
]);

export function classifyPauseRequest(reason: string): {
  kind: PauseKind;
  daily_cycle_allowed: boolean;
  requires_human_approval: boolean;
} {
  const r = (reason || "").toLowerCase();
  if (EMERGENCY_PAUSE_REASONS.has(r)) {
    return { kind: "emergency", daily_cycle_allowed: true, requires_human_approval: false };
  }
  if (STRATEGIC_PAUSE_REASONS.has(r)) {
    return { kind: "strategic", daily_cycle_allowed: false, requires_human_approval: true };
  }
  return { kind: "unknown", daily_cycle_allowed: false, requires_human_approval: true };
}

// --------------------------------------------------------------------
// 7. Limite global de fila pending_approval (>=5 bloqueia estrutural)
// --------------------------------------------------------------------

export const MAX_PENDING_APPROVAL_QUEUE = 5;

export const STRUCTURAL_ACTION_TYPES = new Set<string>([
  "create_campaign",
  "create_adset",
  "create_lookalike_audience",
  "create_audience",
  "duplicate_campaign",
  "update_campaign_copy",
  "update_offer",
]);

export function evaluatePendingQueueGate(input: {
  pendingCount: number;
  actionType: string;
  budgetChangePct?: number;
  pauseKind?: PauseKind;
}): { allowed: boolean; reason: string } {
  const isStructural =
    STRUCTURAL_ACTION_TYPES.has(input.actionType) ||
    (input.actionType === "pause_campaign" && input.pauseKind === "strategic") ||
    (input.actionType === "adjust_budget" &&
      typeof input.budgetChangePct === "number" &&
      Math.abs(input.budgetChangePct) > 20);

  if (!isStructural) return { allowed: true, reason: "non_structural_action" };
  if (input.pendingCount >= MAX_PENDING_APPROVAL_QUEUE) {
    return { allowed: false, reason: "pending_queue_limit_reached" };
  }
  return { allowed: true, reason: "queue_has_room" };
}

// --------------------------------------------------------------------
// 8. Cooldowns do Strategist (manual 6h / weekly 6d / monthly 28d)
// --------------------------------------------------------------------

export const STRATEGIST_COOLDOWNS_MS = {
  manual_implement_campaigns: 6 * 60 * 60 * 1000,
  weekly: 6 * 24 * 60 * 60 * 1000,
  monthly: 28 * 24 * 60 * 60 * 1000,
} as const;

export type StrategistTriggerKind =
  | "manual_implement_campaigns"
  | "weekly"
  | "monthly";

export function evaluateStrategistCooldown(input: {
  trigger: StrategistTriggerKind;
  lastRunAt: string | Date | null;
  now: Date;
}): { allowed: boolean; reason: string; cooldown_ms: number; elapsed_ms: number } {
  const cooldown = STRATEGIST_COOLDOWNS_MS[input.trigger];
  if (!input.lastRunAt) {
    return { allowed: true, reason: "no_previous_run", cooldown_ms: cooldown, elapsed_ms: Infinity };
  }
  const last = new Date(input.lastRunAt).getTime();
  const elapsed = input.now.getTime() - last;
  if (elapsed >= cooldown) {
    return { allowed: true, reason: "cooldown_elapsed", cooldown_ms: cooldown, elapsed_ms: elapsed };
  }
  return { allowed: false, reason: "cooldown_active", cooldown_ms: cooldown, elapsed_ms: elapsed };
}

// --------------------------------------------------------------------
// 9. Guardian dedupe (2h por campanha+ação)
// --------------------------------------------------------------------

export const GUARDIAN_DEDUPE_WINDOW_MS = 2 * 60 * 60 * 1000;

export interface RecentActionLite {
  action_type: string;
  campaign_id: string | null;
  created_at: string | Date;
}

export function isGuardianDuplicate(input: {
  candidate: { action_type: string; campaign_id: string | null };
  recentActions: RecentActionLite[];
  now: Date;
}): boolean {
  const limit = input.now.getTime() - GUARDIAN_DEDUPE_WINDOW_MS;
  return input.recentActions.some((a) => {
    if (a.action_type !== input.candidate.action_type) return false;
    if ((a.campaign_id || null) !== (input.candidate.campaign_id || null)) return false;
    return new Date(a.created_at).getTime() >= limit;
  });
}

// --------------------------------------------------------------------
// 10. Política de públicos — frio sempre exclui clientes
// --------------------------------------------------------------------

export interface AudienceSpec {
  funnel_stage: "cold" | "warm" | "hot" | string;
  exclude_customers?: boolean;
  excluded_audience_ids?: string[];
  retention_days?: number;
}

export function evaluateAudiencePolicy(spec: AudienceSpec): {
  ok: boolean;
  reason_codes: string[];
  patched: AudienceSpec;
} {
  const reason_codes: string[] = [];
  const patched: AudienceSpec = { ...spec };

  const stage = String(spec.funnel_stage || "").toLowerCase();

  if (stage === "cold" || stage === "tof" || stage === "prospecting") {
    if (!spec.exclude_customers) {
      reason_codes.push("cold_audience_must_exclude_customers");
      patched.exclude_customers = true;
    }
  }

  // Recomendações de janela (warm/hot adaptáveis por volume).
  if (stage === "warm" && (!spec.retention_days || spec.retention_days < 7)) {
    patched.retention_days = spec.retention_days ?? 30;
  }
  if (stage === "hot" && (!spec.retention_days || spec.retention_days < 3)) {
    patched.retention_days = spec.retention_days ?? 14;
  }

  return {
    ok: reason_codes.length === 0,
    reason_codes,
    patched,
  };
}

// --------------------------------------------------------------------
// 11. Conflito semanal × mensal (primeiro sábado)
// --------------------------------------------------------------------

/**
 * Retorna true se o `date` é o PRIMEIRO sábado do mês em BRT.
 * Quando weekly e monthly caírem no mesmo dia, weekly deve ceder
 * (monthly incorpora a análise semanal).
 */
export function isFirstSaturdayOfMonthBRT(date: Date): boolean {
  const brt = new Date(date.getTime() - 3 * 60 * 60 * 1000);
  if (brt.getUTCDay() !== 6) return false; // 6 = sábado
  return brt.getUTCDate() <= 7;
}

export function shouldWeeklyYieldToMonthly(date: Date): boolean {
  return isFirstSaturdayOfMonthBRT(date);
}
