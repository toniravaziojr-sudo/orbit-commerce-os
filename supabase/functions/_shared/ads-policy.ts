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
  | "automatic"      // reservado para Fase C
  | "needs_approval" // default conservador
  | "emergency"      // reservado
  | "blocked";

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
// Classificações
// =============================================================================

export function classifyAction(action: Pick<ActionInput, "action_type" | "channel">): ActionClass {
  // Default conservador na Fase B. Fase C diferencia automatic vs needs_approval.
  if (!action.action_type) return "blocked";
  return "needs_approval";
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
