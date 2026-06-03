// =============================================================================
// _shared/ads-policy.ts — Execution Policy Engine (Fase B — fundação)
// =============================================================================
// Determinístico. Sem LLM. Sem chamada externa.
// Centraliza limites por plataforma, janelas seguras, TTLs e a função `decide`
// usada pelo executor aprovado e pelo runner agendado.
//
// REGRA DE OURO: se faltar contexto obrigatório para decisão segura sobre uma
// ação executável, NUNCA retornar `execute_now`. Sempre retornar uma decisão
// conservadora (`reject_policy_missing_context`, `schedule`, etc.).
// =============================================================================

export const POLICY_ENGINE_VERSION = "v1";

export type Channel = "meta" | "google" | "tiktok";

export interface PlatformLimit {
  maxBudgetChangePct: number;     // 0.20 = ±20%
  minBudgetIntervalHours: number; // intervalo mínimo entre ajustes
}

export const PLATFORM_LIMITS: Record<Channel, PlatformLimit> = {
  meta:   { maxBudgetChangePct: 0.20, minBudgetIntervalHours: 72 },
  google: { maxBudgetChangePct: 0.20, minBudgetIntervalHours: 168 }, // 7 dias
  tiktok: { maxBudgetChangePct: 0.15, minBudgetIntervalHours: 48 },
};

// Janela segura BRT (UTC-3) — 00:01 → 04:00
export const SAFE_WINDOW_BRT = {
  startHour: 0,
  startMinute: 1,
  endHour: 4, // exclusivo
};

// TTLs conservadores (em horas)
export const APPROVAL_TTL_HOURS = {
  visible: 48,     // criativos, novas campanhas (ações visíveis ao cliente final)
  strategic: 24,   // ajustes de orçamento, pausas, reativações
  default: 24,     // fallback conservador
};

// Action types tratados como "planejamento" (sem chamada à API externa)
export const NON_EXTERNAL_ACTION_TYPES = new Set<string>([
  "strategic_plan",
]);

// Action types que SEMPRE exigem entidade alvo identificada
export const ENTITY_REQUIRED_ACTION_TYPES = new Set<string>([
  "pause_campaign",
  "reactivate_campaign",
  "activate_campaign",
  "adjust_budget",
  "pause_adset",
  "activate_adset",
  "pause_ad",
  "activate_ad",
]);

// Action types que mexem em orçamento (revalidação de limite/intervalo)
export const BUDGET_ACTION_TYPES = new Set<string>([
  "adjust_budget",
]);

// Action types estruturais (criação) — exigem janela segura BRT
export const STRUCTURAL_ACTION_TYPES = new Set<string>([
  "create_campaign",
  "create_adset",
  "create_ad",
  "create_lookalike_audience",
  "generate_creative",
]);

// =============================================================================
// Tipos
// =============================================================================

export type ActionClass =
  | "automatic_candidate" // Fase C.1: classificada como candidata a autonomia técnica futura. NÃO executa automaticamente nesta fase.
  | "needs_approval"      // exige aprovação humana (visível ao cliente final / mudança estratégica)
  | "emergency"           // ação emergencial; poderá executar imediatamente em fase futura, sob critérios técnicos
  | "observational"       // informativa/recomendação; NUNCA chama API externa
  | "blocked";            // proibida — destrutiva, fora do limite da plataforma ou explicitamente vetada

// =============================================================================
// Fase C.2 — autonomy_mode (apenas 2 modos nesta fase)
// =============================================================================
// IMPORTANTE: `technical_only` ainda NÃO libera execução automática real nesta
// fase. O campo existe apenas para preparar a futura autonomia técnica. Quem
// decide execução continua sendo o motor `decide()` + aprovação humana válida.
// `human_approval_mode` permanece como campo LEGADO e não é usado como bypass.
export type AutonomyMode = "off" | "technical_only";

export const AUTONOMY_MODES: readonly AutonomyMode[] = ["off", "technical_only"] as const;

/**
 * Normaliza qualquer valor recebido para um `AutonomyMode` seguro.
 * Valores ausentes, nulos, vazios ou desconhecidos viram `off`.
 */
export function normalizeAutonomyMode(value: unknown): AutonomyMode {
  if (typeof value !== "string") return "off";
  const v = value.trim().toLowerCase();
  return v === "technical_only" ? "technical_only" : "off";
}

/**
 * Fase C.2 — Nenhuma autonomia automática é liberada nesta fase, qualquer que
 * seja o `autonomy_mode`. Esta função existe para deixar o contrato explícito
 * em código: enquanto o sistema estiver em C.2, autoexecução = false.
 */
export function isAutonomyExecutionEnabled(_mode: AutonomyMode | unknown): false {
  return false;
}

export type CampaignClass =
  | "new"
  | "learning"
  | "mature"
  | "low_spend"
  | "unknown";

export interface ActionInput {
  id: string;
  tenant_id: string;
  channel: string;
  action_type: string;
  action_data: any;
  status: string;
  approved_at?: string | null;
  approval_expires_at?: string | null;
  created_at?: string;
}

export interface CampaignSnapshot {
  daily_budget_cents?: number | null;
  created_at?: string | null;
  last_budget_change_at?: string | null;
  status?: string | null;
}

export interface DecideContext {
  action: ActionInput;
  campaignSnapshot?: CampaignSnapshot | null;
  accountLimitCents?: number | null;
  lastBudgetChangeAt?: string | null;
  now?: Date;
}

export type Decision =
  | { kind: "execute_now"; reason: string; meta?: Record<string, any> }
  | { kind: "schedule"; scheduled_for: string; reason: string; meta?: Record<string, any> }
  | { kind: "reject_policy_limit_exceeded"; reason: string; meta?: Record<string, any> }
  | { kind: "reject_policy_missing_context"; reason: string; meta?: Record<string, any> }
  | { kind: "expired_approval"; reason: string }
  | { kind: "reject_duplicate"; reason: string };

// =============================================================================
// Helpers de tempo (BRT)
// =============================================================================

function brtParts(d: Date): { h: number; m: number; y: number; mo: number; day: number } {
  // BRT = UTC-3 sem horário de verão
  const ms = d.getTime() - 3 * 3600 * 1000;
  const u = new Date(ms);
  return {
    h: u.getUTCHours(),
    m: u.getUTCMinutes(),
    y: u.getUTCFullYear(),
    mo: u.getUTCMonth(),
    day: u.getUTCDate(),
  };
}

export function getNextSafeWindow(now: Date = new Date()): Date {
  const p = brtParts(now);
  // Dentro da janela? → agora mesmo
  if ((p.h === SAFE_WINDOW_BRT.startHour && p.m >= SAFE_WINDOW_BRT.startMinute) ||
      (p.h > SAFE_WINDOW_BRT.startHour && p.h < SAFE_WINDOW_BRT.endHour)) {
    return now;
  }
  // Próximo 00:01 BRT = 03:01 UTC; se já passou hoje, vai pra amanhã
  const next = new Date(now);
  const nowUtcHour = next.getUTCHours();
  if (nowUtcHour >= 3) {
    // já passou 00:00 BRT de hoje (que é 03:00 UTC)
    next.setUTCDate(next.getUTCDate() + 1);
  }
  next.setUTCHours(3, 1, 0, 0);
  return next;
}

export function isInsideSafeWindow(now: Date = new Date()): boolean {
  const p = brtParts(now);
  return (p.h === SAFE_WINDOW_BRT.startHour && p.m >= SAFE_WINDOW_BRT.startMinute) ||
         (p.h > SAFE_WINDOW_BRT.startHour && p.h < SAFE_WINDOW_BRT.endHour);
}

// =============================================================================
// Classificações — Fase C.1 (Mapa Fixo de Autonomia)
//
// IMPORTANTE: Mesmo que uma ação seja classificada como `automatic_candidate`
// ou `emergency`, ela NÃO deve executar automaticamente nesta fase. A autonomia
// real depende de `autonomy_mode` (Fase C.2+) explicitamente ativado por tenant.
// =============================================================================

const ACTION_CLASS_MAP: Record<string, { cls: ActionClass; reason: string }> = {
  // ───────── A) automatic_candidate (ações técnicas/operacionais seguras)
  adjust_budget:           { cls: "automatic_candidate", reason: "budget_change_within_platform_limit" },
  adjust_budget_up:        { cls: "automatic_candidate", reason: "budget_change_within_platform_limit" },
  adjust_budget_down:      { cls: "automatic_candidate", reason: "budget_change_within_platform_limit" },
  increase_budget:         { cls: "automatic_candidate", reason: "budget_change_within_platform_limit" },
  decrease_budget:         { cls: "automatic_candidate", reason: "budget_change_within_platform_limit" },
  pause_campaign:          { cls: "automatic_candidate", reason: "pause_by_mature_performance_criteria" },
  pause_adset:             { cls: "automatic_candidate", reason: "pause_by_mature_performance_criteria" },
  pause_adgroup:           { cls: "automatic_candidate", reason: "pause_by_mature_performance_criteria" },
  pause_ad:                { cls: "automatic_candidate", reason: "pause_by_mature_performance_criteria" },
  reactivate_campaign:     { cls: "automatic_candidate", reason: "safe_reactivation" },
  reactivate_adset:        { cls: "automatic_candidate", reason: "safe_reactivation" },
  reactivate_adgroup:      { cls: "automatic_candidate", reason: "safe_reactivation" },
  activate_campaign:       { cls: "automatic_candidate", reason: "safe_reactivation" },
  activate_adset:          { cls: "automatic_candidate", reason: "safe_reactivation" },
  activate_ad:             { cls: "automatic_candidate", reason: "safe_reactivation" },
  schedule_action:         { cls: "automatic_candidate", reason: "scheduling_into_safe_window" },
  block_action:            { cls: "automatic_candidate", reason: "policy_block_decision" },
  toggle_tiktok_status:    { cls: "automatic_candidate", reason: "tiktok_technical_status_toggle" },
  update_tiktok_budget:    { cls: "automatic_candidate", reason: "tiktok_budget_change_within_limit" },

  // ───────── B) needs_approval (criação / criativos / copys / estratégia visível)
  create_campaign:               { cls: "needs_approval", reason: "creates_visible_campaign" },
  duplicate_campaign:            { cls: "needs_approval", reason: "duplicates_visible_campaign" },
  create_adset:                  { cls: "needs_approval", reason: "creates_visible_adset" },
  duplicate_adset:               { cls: "needs_approval", reason: "duplicates_visible_adset" },
  create_ad:                     { cls: "needs_approval", reason: "creates_visible_ad" },
  duplicate_ad:                  { cls: "needs_approval", reason: "duplicates_visible_ad" },
  create_ad_creative:            { cls: "needs_approval", reason: "creates_or_changes_creative" },
  generate_creative:             { cls: "needs_approval", reason: "creates_or_changes_creative" },
  create_creative:               { cls: "needs_approval", reason: "creates_or_changes_creative" },
  edit_creative:                 { cls: "needs_approval", reason: "creates_or_changes_creative" },
  create_ad_copy:                { cls: "needs_approval", reason: "creates_or_changes_copy" },
  edit_ad_copy:                  { cls: "needs_approval", reason: "creates_or_changes_copy" },
  change_offer:                  { cls: "needs_approval", reason: "changes_commercial_offer" },
  change_promise:                { cls: "needs_approval", reason: "changes_commercial_promise" },
  change_landing_page:           { cls: "needs_approval", reason: "changes_landing_page" },
  change_audience_strategy:      { cls: "needs_approval", reason: "strategic_audience_change" },
  change_optimization_goal:      { cls: "needs_approval", reason: "changes_optimization_goal" },
  structural_expansion_plan:     { cls: "needs_approval", reason: "structural_expansion" },
  create_variation:              { cls: "needs_approval", reason: "creates_visible_variation" },
  create_lookalike_audience:     { cls: "needs_approval", reason: "creates_visible_audience" },
  create_tiktok_campaign:        { cls: "needs_approval", reason: "creates_visible_campaign" },
  create_google_campaign:        { cls: "needs_approval", reason: "creates_visible_campaign" },
  create_google_ad_group:        { cls: "needs_approval", reason: "creates_visible_adgroup" },
  create_google_keyword:         { cls: "needs_approval", reason: "creates_visible_keyword" },
  create_google_ad:              { cls: "needs_approval", reason: "creates_visible_ad" },
  strategic_plan:                { cls: "needs_approval", reason: "strategic_plan_requires_approval" },

  // ───────── C) emergency (risco real — execução técnica futura imediata sob critérios)
  kill_switch_account:     { cls: "emergency", reason: "kill_switch" },
  pause_emergency_campaign:{ cls: "emergency", reason: "emergency_pause" },
  pause_emergency_adset:   { cls: "emergency", reason: "emergency_pause" },
  pause_tracking_broken:   { cls: "emergency", reason: "tracking_broken" },
  pause_budget_breach:     { cls: "emergency", reason: "budget_breach" },
  pause_broken_link:       { cls: "emergency", reason: "broken_link" },

  // ───────── D) observational (NUNCA chama API externa)
  insight:        { cls: "observational", reason: "insight_only" },
  report_insight: { cls: "observational", reason: "insight_only" },
  watch:          { cls: "observational", reason: "watch_only" },
  recommendation: { cls: "observational", reason: "recommendation_only" },
  monitor:        { cls: "observational", reason: "monitor_only" },
  alert:          { cls: "observational", reason: "alert_only" },

  // ───────── E) blocked (nunca executar)
  delete_campaign: { cls: "blocked", reason: "destructive_delete_forbidden" },
  delete_adset:    { cls: "blocked", reason: "destructive_delete_forbidden" },
  delete_ad:       { cls: "blocked", reason: "destructive_delete_forbidden" },
  delete_creative: { cls: "blocked", reason: "destructive_delete_forbidden" },
};

/**
 * Fase C.1 — Mapa Fixo de Autonomia.
 *
 * Classifica um tipo de ação em uma das 5 categorias:
 *   automatic_candidate | needs_approval | emergency | observational | blocked
 *
 * Regras:
 *   - Tipo desconhecido → `needs_approval` (default conservador).
 *   - Tipo ausente/vazio → `blocked`.
 *   - Esta função é PURA e determinística; não decide execução, apenas classifica.
 *   - Nenhuma classe libera execução automática nesta fase — quem decide execução
 *     é o Execution Policy Engine (`decide`) somado a `autonomy_mode` (futuro).
 */
export function classifyAction(action: Pick<ActionInput, "action_type" | "channel">): ActionClass {
  if (!action.action_type) return "blocked";
  const entry = ACTION_CLASS_MAP[action.action_type];
  return entry ? entry.cls : "needs_approval";
}

/**
 * Retorna o motivo da classificação para registro em `policy_check_result`.
 * Para tipos desconhecidos devolve "unknown_action_type_default_conservative".
 */
export function classifyActionReason(actionType: string | null | undefined): string {
  if (!actionType) return "missing_action_type";
  const entry = ACTION_CLASS_MAP[actionType];
  return entry ? entry.reason : "unknown_action_type_default_conservative";
}

/**
 * Monta o bloco de metadados de classificação a ser mesclado em
 * `policy_check_result`. Sempre carimba `autonomy_enabled=false` na Fase C.2.
 *
 * Em C.2, se o caller souber o `autonomy_mode` da conta (lido de
 * `ads_autopilot_account_configs.autonomy_mode`), pode passá-lo aqui apenas
 * para AUDITORIA — não muda comportamento. Quando ausente, registra `off`.
 */
export function buildClassificationMeta(
  actionType: string | null | undefined,
  opts?: { autonomyMode?: unknown },
): {
  action_class: ActionClass;
  classification_reason: string;
  autonomy_enabled: false;
  classified_by: "ads-policy.v1";
  autonomy_mode: AutonomyMode;
  autonomy_source: "ads_autopilot_account_configs.autonomy_mode" | "default_off";
  autonomy_execution_phase: "not_enabled_c2";
} {
  const action_class = classifyAction({ action_type: actionType || "", channel: "" });
  const provided = opts && Object.prototype.hasOwnProperty.call(opts, "autonomyMode");
  const autonomy_mode = normalizeAutonomyMode(opts?.autonomyMode);
  const autonomy_source: "ads_autopilot_account_configs.autonomy_mode" | "default_off" =
    provided && (opts?.autonomyMode === "off" || opts?.autonomyMode === "technical_only")
      ? "ads_autopilot_account_configs.autonomy_mode"
      : "default_off";
  return {
    action_class,
    classification_reason: classifyActionReason(actionType),
    autonomy_enabled: false,
    classified_by: "ads-policy.v1",
    autonomy_mode,
    autonomy_source,
    autonomy_execution_phase: "not_enabled_c2",
  };
}

export function classifyCampaign(snapshot?: CampaignSnapshot | null): CampaignClass {
  if (!snapshot || !snapshot.created_at) return "unknown";
  const ageDays = (Date.now() - new Date(snapshot.created_at).getTime()) / 86400000;
  if (ageDays < 7) return "new";
  return "mature";
}

// =============================================================================
// TTL / aprovação
// =============================================================================

export function getApprovalTtlHours(actionType: string): number {
  // Visíveis ao cliente = criativos e novas campanhas
  if (actionType === "generate_creative" || actionType === "create_campaign" ||
      actionType === "create_ad" || actionType === "create_adset" ||
      actionType === "create_lookalike_audience") {
    return APPROVAL_TTL_HOURS.visible;
  }
  if (BUDGET_ACTION_TYPES.has(actionType) ||
      actionType === "pause_campaign" || actionType === "reactivate_campaign" ||
      actionType === "activate_campaign") {
    return APPROVAL_TTL_HOURS.strategic;
  }
  return APPROVAL_TTL_HOURS.default;
}

export function isApprovalStillValid(args: {
  approved_at?: string | null;
  approval_expires_at?: string | null;
  now?: Date;
}): boolean {
  const now = args.now ?? new Date();
  if (args.approval_expires_at) {
    return new Date(args.approval_expires_at).getTime() > now.getTime();
  }
  // Sem expires_at, considera válida se foi aprovada (compat com legado pós-stamp)
  return !!args.approved_at;
}

// =============================================================================
// Orçamento
// =============================================================================

export function canChangeBudget(args: {
  channel: string;
  currentCents?: number | null;
  proposedCents?: number | null;
  lastChangeAt?: string | null;
  now?: Date;
}): { ok: boolean; reason: string; meta?: Record<string, any> } {
  const channel = (args.channel || "").toLowerCase() as Channel;
  const limits = PLATFORM_LIMITS[channel];
  if (!limits) return { ok: false, reason: "unknown_channel", meta: { channel } };

  if (args.currentCents == null || args.proposedCents == null) {
    return { ok: false, reason: "missing_budget_context" };
  }
  if (args.currentCents <= 0) {
    return { ok: false, reason: "invalid_current_budget" };
  }
  const deltaPct = Math.abs(args.proposedCents - args.currentCents) / args.currentCents;
  if (deltaPct > limits.maxBudgetChangePct + 1e-9) {
    return {
      ok: false,
      reason: "limit_exceeded",
      meta: { delta_pct: deltaPct, max: limits.maxBudgetChangePct },
    };
  }
  if (args.lastChangeAt) {
    const now = args.now ?? new Date();
    const hoursSince = (now.getTime() - new Date(args.lastChangeAt).getTime()) / 3600000;
    if (hoursSince < limits.minBudgetIntervalHours) {
      return {
        ok: false,
        reason: "interval_too_short",
        meta: { hours_since: hoursSince, min_hours: limits.minBudgetIntervalHours },
      };
    }
  }
  return { ok: true, reason: "ok", meta: { delta_pct: deltaPct } };
}

// =============================================================================
// Pause / Reactivate — checks mínimos seguros (Fase B)
// =============================================================================

function _minimalEntityCheck(action: ActionInput): { ok: boolean; reason: string } {
  if (!action.channel) return { ok: false, reason: "missing_channel" };
  if (!action.action_type) return { ok: false, reason: "missing_action_type" };
  if (ENTITY_REQUIRED_ACTION_TYPES.has(action.action_type)) {
    const data = action.action_data || {};
    const hasEntity = data.entity_id || data.campaign_id || data.adset_id ||
                      data.ad_id || data.adgroup_id || data.google_campaign_id ||
                      data.meta_campaign_id;
    if (!hasEntity) return { ok: false, reason: "missing_entity_id" };
  }
  return { ok: true, reason: "ok" };
}

export function canPause(action: ActionInput): { ok: boolean; reason: string } {
  const base = _minimalEntityCheck(action);
  if (!base.ok) return base;
  const channel = (action.channel || "").toLowerCase();
  if (!PLATFORM_LIMITS[channel as Channel]) {
    return { ok: false, reason: "unknown_channel" };
  }
  return { ok: true, reason: "ok" };
}

export function canReactivate(action: ActionInput): { ok: boolean; reason: string } {
  return canPause(action); // mesmas pré-condições mínimas na Fase B
}

// =============================================================================
// Sugestão de expansão estrutural (placeholder para Fase C)
// =============================================================================

export function suggestStructuralExpansion(action: ActionInput): Record<string, any> {
  return {
    available: false,
    reason: "phase_b_not_implemented",
    action_id: action.id,
    action_type: action.action_type,
  };
}

// =============================================================================
// validateProposal — pré-uso pelos motores (Fase B = no-op seguro)
// =============================================================================

export function validateProposal(_action: ActionInput): { ok: true; engine_version: string } {
  return { ok: true, engine_version: POLICY_ENGINE_VERSION };
}

// =============================================================================
// buildIdempotencyKey
// =============================================================================

export function buildIdempotencyKey(action: ActionInput, now: Date = new Date()): string {
  const data = action.action_data || {};
  const entity = data.entity_id || data.campaign_id || data.adset_id ||
                 data.ad_id || data.adgroup_id || data.google_campaign_id ||
                 data.meta_campaign_id || "global";
  const p = brtParts(now);
  const day = `${p.y}-${String(p.mo + 1).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
  return `${action.tenant_id}:${action.channel}:${action.action_type}:${entity}:${day}`;
}

// =============================================================================
// decide — função central
// =============================================================================

export function decide(ctx: DecideContext): Decision {
  const now = ctx.now ?? new Date();
  const a = ctx.action;

  // 1) Aprovação ainda válida?
  if (a.approved_at || a.approval_expires_at) {
    if (!isApprovalStillValid({
      approved_at: a.approved_at,
      approval_expires_at: a.approval_expires_at,
      now,
    })) {
      return { kind: "expired_approval", reason: "approval_ttl_passed" };
    }
  }

  // 2) Ação sem efeito externo (planejamento puro)
  if (NON_EXTERNAL_ACTION_TYPES.has(a.action_type)) {
    return {
      kind: "execute_now",
      reason: "non_executable_or_no_external_effect",
      meta: { path: "non_executable_or_no_external_effect" },
    };
  }

  // 3) Checks mínimos: canal + action_type + (entidade quando aplicável) + plataforma conhecida
  const channel = (a.channel || "").toLowerCase();
  if (!a.channel || !PLATFORM_LIMITS[channel as Channel]) {
    return { kind: "reject_policy_missing_context", reason: "unknown_or_missing_channel", meta: { channel: a.channel } };
  }
  if (!a.action_type) {
    return { kind: "reject_policy_missing_context", reason: "missing_action_type" };
  }
  if (ENTITY_REQUIRED_ACTION_TYPES.has(a.action_type)) {
    const data = a.action_data || {};
    const hasEntity = data.entity_id || data.campaign_id || data.adset_id ||
                      data.ad_id || data.adgroup_id || data.google_campaign_id ||
                      data.meta_campaign_id;
    if (!hasEntity) {
      return { kind: "reject_policy_missing_context", reason: "missing_entity_id" };
    }
  }

  // 4) Ações estruturais: exigem janela segura BRT
  if (STRUCTURAL_ACTION_TYPES.has(a.action_type)) {
    if (!isInsideSafeWindow(now)) {
      return {
        kind: "schedule",
        scheduled_for: getNextSafeWindow(now).toISOString(),
        reason: "outside_safe_window_brt",
        meta: { window: SAFE_WINDOW_BRT },
      };
    }
  }

  // 5) Ações de orçamento: revalidar limite/intervalo
  if (BUDGET_ACTION_TYPES.has(a.action_type)) {
    const data = a.action_data || {};
    const proposed = Number(
      data.proposed_daily_budget_cents ??
      data.new_daily_budget_cents ??
      data.daily_budget_cents ??
      data.preview?.daily_budget_cents
    );
    const current = Number(
      data.current_daily_budget_cents ??
      ctx.campaignSnapshot?.daily_budget_cents
    );
    if (!proposed || !current) {
      return { kind: "reject_policy_missing_context", reason: "missing_budget_context", meta: { proposed, current } };
    }
    const last = ctx.lastBudgetChangeAt || ctx.campaignSnapshot?.last_budget_change_at || null;
    const r = canChangeBudget({
      channel: a.channel, currentCents: current, proposedCents: proposed, lastChangeAt: last, now,
    });
    if (!r.ok) {
      if (r.reason === "limit_exceeded") {
        return { kind: "reject_policy_limit_exceeded", reason: r.reason, meta: r.meta };
      }
      if (r.reason === "interval_too_short") {
        // Agenda para depois do intervalo mínimo + próxima janela segura
        const minHours = PLATFORM_LIMITS[channel as Channel].minBudgetIntervalHours;
        const eligibleAt = new Date(new Date(last!).getTime() + minHours * 3600 * 1000);
        const target = eligibleAt > now ? eligibleAt : now;
        const next = getNextSafeWindow(target);
        return { kind: "schedule", scheduled_for: next.toISOString(), reason: "interval_not_elapsed", meta: r.meta };
      }
      return { kind: "reject_policy_missing_context", reason: r.reason, meta: r.meta };
    }
  }

  // 6) Pause / reactivate — checks mínimos
  if (a.action_type === "pause_campaign" || a.action_type === "pause_adset" || a.action_type === "pause_ad") {
    const r = canPause(a);
    if (!r.ok) return { kind: "reject_policy_missing_context", reason: r.reason };
  }
  if (a.action_type === "reactivate_campaign" || a.action_type === "activate_campaign" ||
      a.action_type === "activate_adset" || a.action_type === "activate_ad") {
    const r = canReactivate(a);
    if (!r.ok) return { kind: "reject_policy_missing_context", reason: r.reason };
  }

  return { kind: "execute_now", reason: "policy_passed" };
}
