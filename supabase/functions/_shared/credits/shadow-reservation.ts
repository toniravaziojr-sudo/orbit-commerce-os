/**
 * Shadow Reservation — Motor de Créditos v2 (Fase A2, shadow sidecar financeiro)
 *
 * OBJETIVO:
 *   Simular o fluxo financeiro reserve → capture | release em metadata do
 *   evento shadow, SEM tocar wallet, credit_ledger ou RPCs reais de cobrança.
 *
 * ESCOPO ESTRITO:
 *   - Apenas observabilidade financeira.
 *   - Não chama RPC de reserva/captura/charge.
 *   - Não altera wallet.
 *   - Não altera credit_ledger.
 *   - Não chama provider externo.
 *   - Cobre somente service_key fal.gpt-image-1.5.per_image.medium_1024 nesta fase.
 *
 * GATE (avaliado pelo caller):
 *   tenant_credit_motor_config.metadata->>'shadow_reservation_enabled' = 'true'
 *
 * VERSÃO: 0.1.0
 */

export const SHADOW_RESERVATION_VERSION = "0.1.0" as const;

export const SHADOW_RESERVATION_SUPPORTED_KEYS = [
  "fal.gpt-image-1.5.per_image.medium_1024",
] as const;

export type ShadowReservationServiceKey =
  (typeof SHADOW_RESERVATION_SUPPORTED_KEYS)[number];

export interface PricingSnapshotInput {
  pricing_id: string | null;
  service_key: string;
  cost_usd: number;
  markup_pct: number;
  unit: string;
  is_active: boolean;
  approved_for_live?: boolean | null;
  effective_until?: string | null;
}

export interface WalletSnapshotInput {
  balance_credits: number;
  reserved_credits: number;
}

export interface ShadowPricingSnapshot {
  pricing_id: string | null;
  service_key: string;
  cost_usd_snap: number | null;
  markup_pct_snap: number | null;
  sell_usd_snap: number | null;
  unit: string | null;
  approved_for_live: boolean;
  would_block_in_live: boolean;
  block_reason:
    | null
    | "no_pricing"
    | "pricing_inactive"
    | "pricing_expired"
    | "pricing_not_approved_for_live"
    | "service_key_out_of_scope";
}

export interface ShadowFormulaSnapshot {
  units_quantity: number;
  credit_formula: "GREATEST(1, CEIL(sell_usd / 0.01))";
  rounding_rule: "ceil";
  credits: number;
}

export interface ShadowBalanceSimulation {
  balance_before: number;
  reserved_before: number;
  available_before: number;
  balance_after: number;
  insufficient: boolean;
}

export interface ShadowReservePhase {
  would_run: boolean;
  credits: number;
  decided_at: string;
}

export interface ShadowCapturePhase {
  would_run: boolean;
  credits: number;
  decided_at: string | null;
}

export interface ShadowReleasePhase {
  would_run: boolean;
  reason: string | null;
  credits: number;
  decided_at: string | null;
}

export interface ShadowReservationMetadata {
  shadow_reservation_version: typeof SHADOW_RESERVATION_VERSION;
  no_wallet_mutation: true;
  no_ledger_mutation: true;
  shadow_pricing_snapshot: ShadowPricingSnapshot;
  shadow_formula_snapshot: ShadowFormulaSnapshot;
  shadow_balance_simulation: ShadowBalanceSimulation;
  shadow_reserve: ShadowReservePhase;
  shadow_capture: ShadowCapturePhase;
  shadow_release: ShadowReleasePhase;
  shadow_would_block_provider_call: boolean;
  shadow_error: string | null;
}

/**
 * Aritmética oficial (motor v2):
 *   sell_usd = cost_usd * units_quantity * (1 + markup_pct/100)
 *   credits  = GREATEST(1, CEIL(sell_usd / 0.01))
 *
 * Função pura. Nunca lança.
 */
export function calculateShadowImageReservation(args: {
  pricing: PricingSnapshotInput | null;
  units_quantity?: number;
  service_key: string;
}): { pricing: ShadowPricingSnapshot; formula: ShadowFormulaSnapshot } {
  const units = args.units_quantity ?? 1;
  const sk = args.service_key;
  const inScope = (SHADOW_RESERVATION_SUPPORTED_KEYS as readonly string[]).includes(sk);

  // Pricing ausente ou fora de escopo
  if (!args.pricing) {
    return {
      pricing: {
        pricing_id: null,
        service_key: sk,
        cost_usd_snap: null,
        markup_pct_snap: null,
        sell_usd_snap: null,
        unit: null,
        approved_for_live: false,
        would_block_in_live: true,
        block_reason: inScope ? "no_pricing" : "service_key_out_of_scope",
      },
      formula: {
        units_quantity: units,
        credit_formula: "GREATEST(1, CEIL(sell_usd / 0.01))",
        rounding_rule: "ceil",
        credits: 0,
      },
    };
  }

  const p = args.pricing;
  let blockReason: ShadowPricingSnapshot["block_reason"] = null;
  if (!inScope) blockReason = "service_key_out_of_scope";
  else if (p.is_active === false) blockReason = "pricing_inactive";
  else if (p.effective_until && new Date(p.effective_until).getTime() < Date.now())
    blockReason = "pricing_expired";
  else if (p.approved_for_live === false) blockReason = "pricing_not_approved_for_live";

  const cost = Number(p.cost_usd) || 0;
  const markup = Number(p.markup_pct) || 0;
  const sellUsd = cost * units * (1 + markup / 100);
  // arredonda para 6 casas para evitar lixo de float
  const sellUsdRounded = Math.round(sellUsd * 1_000_000) / 1_000_000;
  const credits = Math.max(1, Math.ceil(sellUsdRounded / 0.01));

  return {
    pricing: {
      pricing_id: p.pricing_id,
      service_key: sk,
      cost_usd_snap: cost,
      markup_pct_snap: markup,
      sell_usd_snap: sellUsdRounded,
      unit: p.unit,
      approved_for_live: blockReason === null,
      would_block_in_live: blockReason !== null,
      block_reason: blockReason,
    },
    formula: {
      units_quantity: units,
      credit_formula: "GREATEST(1, CEIL(sell_usd / 0.01))",
      rounding_rule: "ceil",
      credits: blockReason === null ? credits : 0,
    },
  };
}

/**
 * Simula saldo SEM mutar wallet. Função pura.
 * Mesmo se insuficiente, A2 NÃO bloqueia geração real — apenas registra.
 */
export function simulateShadowBalance(args: {
  wallet: WalletSnapshotInput;
  reserve_credits: number;
}): ShadowBalanceSimulation {
  const balance = Number(args.wallet.balance_credits) || 0;
  const reserved = Number(args.wallet.reserved_credits) || 0;
  const available = balance - reserved;
  const after = available - args.reserve_credits;
  return {
    balance_before: balance,
    reserved_before: reserved,
    available_before: available,
    balance_after: after,
    insufficient: available < args.reserve_credits,
  };
}

/**
 * Monta metadata completa de Reserva Sombra (fase reserve).
 * Capture/Release são preenchidos depois via finalizeShadowReservationOutcome.
 * Função pura. Nunca lança.
 */
export function buildShadowReservationMetadata(args: {
  pricing: PricingSnapshotInput | null;
  wallet: WalletSnapshotInput;
  service_key: string;
  units_quantity?: number;
}): ShadowReservationMetadata {
  try {
    const calc = calculateShadowImageReservation({
      pricing: args.pricing,
      units_quantity: args.units_quantity,
      service_key: args.service_key,
    });
    const balanceSim = simulateShadowBalance({
      wallet: args.wallet,
      reserve_credits: calc.formula.credits,
    });
    const wouldBlock = calc.pricing.would_block_in_live || balanceSim.insufficient;
    const decidedAt = new Date().toISOString();
    return {
      shadow_reservation_version: SHADOW_RESERVATION_VERSION,
      no_wallet_mutation: true,
      no_ledger_mutation: true,
      shadow_pricing_snapshot: calc.pricing,
      shadow_formula_snapshot: calc.formula,
      shadow_balance_simulation: balanceSim,
      shadow_reserve: {
        would_run: !calc.pricing.would_block_in_live && !balanceSim.insufficient,
        credits: calc.formula.credits,
        decided_at: decidedAt,
      },
      shadow_capture: { would_run: false, credits: 0, decided_at: null },
      shadow_release: { would_run: false, reason: null, credits: 0, decided_at: null },
      shadow_would_block_provider_call: wouldBlock,
      shadow_error: null,
    };
  } catch (e: any) {
    return safeShadowReservationFallback(args.service_key, e?.message || "shadow_reservation_unknown_error");
  }
}

/**
 * Aplica desfecho (sucesso/falha) na metadata pré-construída pelo build.
 * Função pura. Nunca lança.
 */
export function finalizeShadowReservationOutcome(
  meta: ShadowReservationMetadata,
  outcome: { succeeded: boolean; failure_reason?: string | null },
): ShadowReservationMetadata {
  try {
    const decidedAt = new Date().toISOString();
    const credits = meta.shadow_reserve.credits;
    const wouldRunReserve = meta.shadow_reserve.would_run;
    if (outcome.succeeded) {
      return {
        ...meta,
        shadow_capture: {
          would_run: wouldRunReserve,
          credits,
          decided_at: decidedAt,
        },
        shadow_release: { would_run: false, reason: null, credits: 0, decided_at: null },
      };
    }
    return {
      ...meta,
      shadow_capture: { would_run: false, credits: 0, decided_at: null },
      shadow_release: {
        would_run: wouldRunReserve,
        reason: outcome.failure_reason || "generation_failed",
        credits,
        decided_at: decidedAt,
      },
    };
  } catch (_e) {
    return meta;
  }
}

function safeShadowReservationFallback(
  service_key: string,
  errMsg: string,
): ShadowReservationMetadata {
  const decidedAt = new Date().toISOString();
  return {
    shadow_reservation_version: SHADOW_RESERVATION_VERSION,
    no_wallet_mutation: true,
    no_ledger_mutation: true,
    shadow_pricing_snapshot: {
      pricing_id: null,
      service_key,
      cost_usd_snap: null,
      markup_pct_snap: null,
      sell_usd_snap: null,
      unit: null,
      approved_for_live: false,
      would_block_in_live: true,
      block_reason: "no_pricing",
    },
    shadow_formula_snapshot: {
      units_quantity: 1,
      credit_formula: "GREATEST(1, CEIL(sell_usd / 0.01))",
      rounding_rule: "ceil",
      credits: 0,
    },
    shadow_balance_simulation: {
      balance_before: 0,
      reserved_before: 0,
      available_before: 0,
      balance_after: 0,
      insufficient: true,
    },
    shadow_reserve: { would_run: false, credits: 0, decided_at: decidedAt },
    shadow_capture: { would_run: false, credits: 0, decided_at: null },
    shadow_release: { would_run: false, reason: null, credits: 0, decided_at: null },
    shadow_would_block_provider_call: true,
    shadow_error: errMsg,
  };
}

/**
 * Avalia gate A2 a partir do metadata do tenant.
 */
export function isShadowReservationEnabled(metadata: Record<string, any> | null | undefined): boolean {
  return !!metadata && metadata.shadow_reservation_enabled === true;
}
