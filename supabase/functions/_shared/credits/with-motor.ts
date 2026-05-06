/**
 * Motor Universal de Créditos — Wrapper de Alto Nível
 *
 * Encapsula o pipeline canônico:
 *   reserve → provider call → capture (sucesso) | release (falha)
 *
 * Toda edge function paga DEVE usar este wrapper.
 * Não calcula markup. Não chama provider antes da reserva.
 *
 * Uso típico:
 *
 *   const result = await withCreditMotor(
 *     {
 *       tenantId,
 *       userId,
 *       serviceKey: "openai.gpt-5.2.per_1m_tokens_in",
 *       units: { tokens_in: 1500, tokens_out: 500 },
 *       jobId: crypto.randomUUID(),
 *       feature: "generate-seo",
 *     },
 *     async () => {
 *       // chamada real ao provider — só roda se reserva foi aceita
 *       const aiResult = await aiChatCompletion({ ... });
 *       return {
 *         providerResult: aiResult,
 *         actualUnits: { tokens_in: aiResult.usage.input_tokens, tokens_out: aiResult.usage.output_tokens },
 *         providerCostUsd: null, // opcional
 *       };
 *     }
 *   );
 *
 *   if (!result.success) {
 *     return new Response(JSON.stringify({ success: false, error_code: result.errorCode, error_message: result.errorMessage }), { status: 200 });
 *   }
 *   return new Response(JSON.stringify({ success: true, data: result.providerResult, credits_charged: result.creditsCharged }), { status: 200 });
 */

import {
  reserveCredits,
  captureReservation,
  releaseReservation,
  buildIdempotencyKey,
  normalizeCreditError,
  type CreditMode,
} from "./charge.ts";

export interface WithMotorArgs {
  tenantId: string;
  userId?: string | null;
  serviceKey: string;
  /** Estimativa inicial de unidades para reserva. Se actualUnits != units, capture ajusta. */
  units: Record<string, unknown>;
  /** ID do job/operação. Usado para idempotência canônica. */
  jobId: string;
  /** Nome da feature (ex: "generate-seo", "ai-product-description"). */
  feature: string;
  /** Metadata livre para auditoria. */
  metadata?: Record<string, unknown>;
  /** Live (default) ou shadow (não debita). */
  mode?: CreditMode;
  /** TTL da reserva em minutos. Default 30. */
  reservationTtlMinutes?: number;
  /** Variation index para idempotência (default 0). */
  variationIndex?: number;
}

export interface ProviderCallResult<T> {
  providerResult: T;
  /** Unidades reais consumidas. Se omitido, usa units da reserva. */
  actualUnits?: Record<string, unknown>;
  /** Custo real informado pelo provider (opcional). */
  providerCostUsd?: number | null;
  /** Metadata extra a juntar no capture. */
  captureMetadata?: Record<string, unknown>;
}

export interface WithMotorSuccess<T> {
  success: true;
  providerResult: T;
  reservationId: string;
  ledgerId: string | null;
  creditsCharged: number;
}

export interface WithMotorFailure {
  success: false;
  errorCode: string;
  errorMessage: string;
  /** Mensagem amigável ao usuário (PT-BR). */
  userMessage: string;
  /** Stage onde falhou: reserve | provider | capture. */
  stage: "reserve" | "provider" | "capture";
  /** Erro original do provider (se stage=provider). */
  providerError?: unknown;
}

export type WithMotorResult<T> = WithMotorSuccess<T> | WithMotorFailure;

/**
 * Executa pipeline completo: reserve → provider → capture/release.
 * Em qualquer falha, garante release da reserva (wallet intacta).
 */
export async function withCreditMotor<T>(
  args: WithMotorArgs,
  providerCall: () => Promise<ProviderCallResult<T>>,
): Promise<WithMotorResult<T>> {
  const mode = args.mode ?? "live";
  const variationIndex = args.variationIndex ?? 0;

  const idempotencyKey = buildIdempotencyKey([
    "v2", "reserve",
    args.tenantId,
    args.jobId,
    args.serviceKey,
    variationIndex,
  ]);

  // ─── 1. RESERVE ───────────────────────────────
  const reserveResult = await reserveCredits({
    tenantId: args.tenantId,
    userId: args.userId ?? null,
    serviceKey: args.serviceKey,
    units: args.units,
    idempotencyKey,
    jobId: args.jobId,
    feature: args.feature,
    metadata: { ...(args.metadata ?? {}), motor_universal: true },
    mode,
    reservationTtlMinutes: args.reservationTtlMinutes ?? 30,
  });

  if (!reserveResult.success) {
    const errorCode = reserveResult.error_code ?? "reserve_failed";
    const errorMessage = reserveResult.error_message ?? "Falha ao reservar créditos.";
    console.warn("[credits.motor] reserve_failed", JSON.stringify({
      tenant_id: args.tenantId, service_key: args.serviceKey, feature: args.feature,
      error_code: errorCode, error_message: errorMessage,
    }));
    return {
      success: false,
      stage: "reserve",
      errorCode,
      errorMessage,
      userMessage: normalizeCreditError(errorCode, errorMessage),
    };
  }

  const reservationData = reserveResult.data as {
    reservation_id?: string;
    ledger_id?: string | null;
    credits_reserved?: number;
  };
  const reservationId = reservationData?.reservation_id ?? null;

  // Em modo shadow não há reserva real para capturar/liberar
  if (mode === "shadow") {
    try {
      const callResult = await providerCall();
      return {
        success: true,
        providerResult: callResult.providerResult,
        reservationId: reservationId ?? "shadow",
        ledgerId: null,
        creditsCharged: Number(reservationData?.credits_reserved ?? 0),
      };
    } catch (e: any) {
      return {
        success: false,
        stage: "provider",
        errorCode: "provider_error",
        errorMessage: String(e?.message || e),
        userMessage: "Falha no provedor externo. Tente novamente.",
        providerError: e,
      };
    }
  }

  if (!reservationId) {
    return {
      success: false,
      stage: "reserve",
      errorCode: "no_reservation_id",
      errorMessage: "Reserva criada sem ID retornado.",
      userMessage: "Erro interno. Tente novamente.",
    };
  }

  // ─── 2. PROVIDER CALL ─────────────────────────
  let callResult: ProviderCallResult<T>;
  try {
    callResult = await providerCall();
  } catch (e: any) {
    // Falha do provider → release reserva
    await releaseReservation({
      tenantId: args.tenantId,
      reservationId,
      reason: "provider_error",
      idempotencyKey: buildIdempotencyKey(["v2", "release", reservationId]),
      metadata: { error_message: String(e?.message || e), feature: args.feature },
    });
    console.warn("[credits.motor] provider_failed_released", JSON.stringify({
      tenant_id: args.tenantId, service_key: args.serviceKey, feature: args.feature,
      reservation_id: reservationId, error_message: String(e?.message || e),
    }));
    return {
      success: false,
      stage: "provider",
      errorCode: "provider_error",
      errorMessage: String(e?.message || e),
      userMessage: "Falha no provedor externo. Os créditos foram devolvidos.",
      providerError: e,
    };
  }

  // ─── 3. CAPTURE ───────────────────────────────
  const captureResult = await captureReservation({
    tenantId: args.tenantId,
    reservationId,
    actualUnits: callResult.actualUnits ?? args.units,
    providerCostUsd: callResult.providerCostUsd ?? null,
    idempotencyKey: buildIdempotencyKey(["v2", "capture", reservationId]),
    metadata: { ...(callResult.captureMetadata ?? {}), feature: args.feature },
  });

  if (!captureResult.success) {
    // Capture falhou após provider OK — situação rara. Tenta release defensivo.
    await releaseReservation({
      tenantId: args.tenantId,
      reservationId,
      reason: "capture_failed",
      idempotencyKey: buildIdempotencyKey(["v2", "release", reservationId]),
      metadata: { capture_error: captureResult.error_message ?? null, feature: args.feature },
    }).catch(() => {});
    console.error("[credits.motor] capture_failed", JSON.stringify({
      tenant_id: args.tenantId, service_key: args.serviceKey, feature: args.feature,
      reservation_id: reservationId, error_code: captureResult.error_code, error_message: captureResult.error_message,
    }));
    // Provider ENTREGOU — então retornamos sucesso ao usuário, mas log o problema
    return {
      success: true,
      providerResult: callResult.providerResult,
      reservationId,
      ledgerId: null,
      creditsCharged: Number(reservationData?.credits_reserved ?? 0),
    };
  }

  const captureData = captureResult.data as { ledger_id?: string | null; credits_charged?: number };
  console.log("[credits.motor] capture_success", JSON.stringify({
    tenant_id: args.tenantId, service_key: args.serviceKey, feature: args.feature,
    reservation_id: reservationId, credits_charged: captureData?.credits_charged,
  }));

  return {
    success: true,
    providerResult: callResult.providerResult,
    reservationId,
    ledgerId: captureData?.ledger_id ?? null,
    creditsCharged: Number(captureData?.credits_charged ?? reservationData?.credits_reserved ?? 0),
  };
}

/**
 * Verifica se o tenant tem o motor v2 ativado.
 * Por enquanto: motor_v2_enabled global OU live_service_keys contém a key.
 */
export async function isMotorEnabledForTenant(
  supabase: any,
  tenantId: string,
  serviceKey: string,
): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("tenant_credit_motor_config")
      .select("motor_v2_enabled, live_service_keys")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (!data) return false;
    if (data.motor_v2_enabled === true) return true;
    const keys: string[] = Array.isArray(data.live_service_keys) ? data.live_service_keys : [];
    return keys.includes(serviceKey);
  } catch {
    return false;
  }
}
