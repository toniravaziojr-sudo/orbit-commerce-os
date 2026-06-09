// =============================================
// TWO-STEP CAMPAIGN FLOW — Frente 4
// Pure helpers (Deno + Node compatible — no runtime imports)
// =============================================
//
// Contrato:
//  - Propostas novas de create_campaign recebem `flow_version='two_step_v1'`
//    e um `creative_brief` em action_data.
//  - O Estrategista NÃO gera criativo na Etapa 1. A geração só acontece
//    após o usuário clicar "Aprovar e gerar criativos" (edge function
//    `ads-autopilot-approve-strategy`).
//  - Propostas antigas (sem `flow_version`) seguem o fluxo legado.
//
// Estados visíveis (campo `status` em ads_autopilot_actions — TEXT, sem enum):
//   pending_approval        → Etapa 1: aguardando aprovação da estratégia
//   creative_pending        → Etapa 2: gerando criativos
//   final_pending_approval  → Etapa 2: aguardando aprovação final
//   approved / rejected     → fluxo padrão atual (publicação real)

export const TWO_STEP_FLOW_VERSION = "two_step_v1" as const;

export const TWO_STEP_STATUSES = {
  PENDING_STRATEGY: "pending_approval",
  CREATIVE_PENDING: "creative_pending",
  FINAL_PENDING: "final_pending_approval",
} as const;

export const ACTIVE_PENDING_STATUSES = [
  TWO_STEP_STATUSES.PENDING_STRATEGY,
  TWO_STEP_STATUSES.CREATIVE_PENDING,
  TWO_STEP_STATUSES.FINAL_PENDING,
] as const;

export interface CreativeBrief {
  product_name?: string | null;
  product_id?: string | null;
  product_image_url?: string | null;
  campaign_objective?: string | null;
  target_audience?: string | null;
  style_preference?: string | null;
  format?: string | null;
  formats_suggested?: string[];
  variations?: number;
  funnel_stage?: string | null;
  copy_hint?: string | null;
  headline_hint?: string | null;
  cta_hint?: string | null;
  prompt?: string | null;
  deferred?: boolean;
  saved_at?: string;
}

/** True se a action pertence ao fluxo de duas etapas. */
export function isTwoStepAction(action: { action_data?: any } | null | undefined): boolean {
  if (!action) return false;
  const d = (action as any).action_data || {};
  return d?.flow_version === TWO_STEP_FLOW_VERSION;
}

/** Constrói o brief a partir dos args de generate_creative do Estrategista. */
export function buildCreativeBrief(args: Record<string, any>, opts?: {
  product_id?: string | null;
  product_image_url?: string | null;
}): CreativeBrief {
  return {
    product_name: args.product_name ?? null,
    product_id: opts?.product_id ?? args.product_id ?? null,
    product_image_url: opts?.product_image_url ?? null,
    campaign_objective: args.campaign_objective ?? null,
    target_audience: args.target_audience ?? null,
    style_preference: args.style_preference ?? "promotional",
    format: args.format ?? "1:1",
    formats_suggested: Array.isArray(args.formats_suggested)
      ? args.formats_suggested
      : [args.format ?? "1:1"],
    variations: typeof args.variations === "number" ? args.variations : 3,
    funnel_stage: args.funnel_stage ?? "tof",
    copy_hint: args.copy_text ?? args.copy ?? null,
    headline_hint: args.headline ?? null,
    cta_hint: args.cta ?? args.cta_type ?? null,
    prompt: args.prompt ?? args.creative_prompt ?? args.style_instructions ?? null,
    deferred: true,
    saved_at: new Date().toISOString(),
  };
}

export interface TwoStepGateResult {
  ok: boolean;
  reason_codes: string[];
  blocking_reason?: string;
}

/**
 * Gate executado ANTES de permitir gerar criativos (Etapa 2).
 * Revalida invariantes mínimos do brief + payload da campanha.
 */
export function runTwoStepCreativeGate(input: {
  action: { status?: string | null; action_data?: any };
  qualityGatePassed: boolean;
  customerExclusionApplied: boolean;
  funnelStage?: string | null;
}): TwoStepGateResult {
  const codes: string[] = [];
  const data = input.action?.action_data || {};

  if (input.action?.status === "rejected") codes.push("proposal_rejected");
  if (input.action?.status === "superseded") codes.push("proposal_superseded");

  if (!isTwoStepAction(input.action)) codes.push("not_two_step_flow");
  if (!input.qualityGatePassed) codes.push("quality_gate_failed");

  const brief: CreativeBrief = data.creative_brief || {};
  if (!brief || (!brief.prompt && !brief.copy_hint && !brief.product_name)) {
    codes.push("creative_brief_missing");
  }
  if (!brief.format && !(brief.formats_suggested?.length)) {
    codes.push("creative_format_missing");
  }

  const stage = (input.funnelStage || brief.funnel_stage || "").toLowerCase();
  const isCold = stage === "tof" || stage === "cold" || stage === "prospecting";
  if (isCold && !input.customerExclusionApplied) {
    codes.push("cold_audience_requires_customer_exclusion");
  }

  if (!data.campaign_name && !data.preview?.campaign_name) {
    codes.push("campaign_name_missing");
  }
  if (!data.destination_url && !data.link_url && !data.preview?.destination_url) {
    codes.push("destination_url_missing");
  }

  return {
    ok: codes.length === 0,
    reason_codes: codes,
    blocking_reason: codes[0],
  };
}
