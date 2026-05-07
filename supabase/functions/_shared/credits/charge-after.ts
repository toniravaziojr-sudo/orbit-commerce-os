/**
 * Motor Universal de Créditos — Helper Postpaid (Cobrança Pós-Operação)
 *
 * Para casos onde a unidade real só é conhecida APÓS a chamada do provider
 * (ex: e-mail enviado, NFe emitida, vídeo gerado, transcrição). Não há
 * pré-reserva — usamos reserve+capture imediato, idempotente.
 *
 * Falhas de cobrança NUNCA quebram a operação (já entregue ao usuário);
 * apenas geram log estruturado. O motor v2 pode ser desligado por tenant.
 *
 * Uso:
 *   await chargeAfter({
 *     tenantId, userId, serviceKey: "email-system-send",
 *     units: { count: 1 }, jobId: messageId, feature: "send-system-email",
 *   });
 */

import {
  reserveCredits,
  captureReservation,
  buildIdempotencyKey,
} from "./charge.ts";
import { isMotorEnabledForTenant } from "./with-motor.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export interface ChargeAfterArgs {
  tenantId: string;
  userId?: string | null;
  serviceKey: string;
  units: Record<string, unknown>;
  jobId: string;
  feature: string;
  metadata?: Record<string, unknown>;
  providerCostUsd?: number | null;
  /** Se true, ignora flag motor_v2_enabled. Default false. */
  force?: boolean;
}

export interface ChargeAfterResult {
  charged: boolean;
  skipped?: string;
  creditsCharged?: number;
  ledgerId?: string | null;
  error?: string;
}

export async function chargeAfter(args: ChargeAfterArgs): Promise<ChargeAfterResult> {
  try {
    if (!args.force) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      const enabled = await isMotorEnabledForTenant(supabase, args.tenantId, args.serviceKey);
      if (!enabled) {
        return { charged: false, skipped: "motor_disabled_for_tenant" };
      }
    }

    const idemReserve = buildIdempotencyKey(["v2", "postpaid", "reserve", args.tenantId, args.jobId, args.serviceKey]);
    const reserveRes = await reserveCredits({
      tenantId: args.tenantId,
      userId: args.userId ?? null,
      serviceKey: args.serviceKey,
      units: args.units,
      idempotencyKey: idemReserve,
      jobId: args.jobId,
      feature: args.feature,
      metadata: { ...(args.metadata ?? {}), motor_universal: true, postpaid: true },
      mode: "live",
      reservationTtlMinutes: 5,
    });

    if (!reserveRes.success) {
      console.warn("[chargeAfter] reserve_failed", JSON.stringify({
        feature: args.feature, service_key: args.serviceKey, tenant_id: args.tenantId,
        error_code: reserveRes.error_code, error_message: reserveRes.error_message,
      }));
      return { charged: false, error: reserveRes.error_code ?? "reserve_failed" };
    }

    const reservationId = (reserveRes.data as any)?.reservation_id as string | undefined;
    if (!reservationId) return { charged: false, error: "no_reservation_id" };

    const captureRes = await captureReservation({
      tenantId: args.tenantId,
      reservationId,
      actualUnits: args.units,
      providerCostUsd: args.providerCostUsd ?? null,
      idempotencyKey: buildIdempotencyKey(["v2", "postpaid", "capture", reservationId]),
      metadata: { feature: args.feature, ...(args.metadata ?? {}) },
    });

    if (!captureRes.success) {
      console.error("[chargeAfter] capture_failed", JSON.stringify({
        feature: args.feature, reservation_id: reservationId,
        error_code: captureRes.error_code, error_message: captureRes.error_message,
      }));
      return { charged: false, error: captureRes.error_code ?? "capture_failed" };
    }

    const data = captureRes.data as { ledger_id?: string | null; credits_charged?: number };
    console.log("[chargeAfter] ok", JSON.stringify({
      feature: args.feature, service_key: args.serviceKey, tenant_id: args.tenantId,
      credits_charged: data?.credits_charged,
    }));

    // F1 — Telemetria universal: registra service_usage_events status='captured'
    // Falhas aqui NUNCA quebram a cobrança (já concluída no ledger).
    try {
      await recordChargeAfterUsageEvent({
        tenantId: args.tenantId,
        serviceKey: args.serviceKey,
        units: args.units,
        feature: args.feature,
        jobId: args.jobId,
        ledgerId: data?.ledger_id ?? null,
        creditsCharged: Number(data?.credits_charged ?? 0),
        providerCostUsd: args.providerCostUsd ?? null,
        idempotencyKey: idemReserve,
        userMetadata: args.metadata ?? {},
      });
    } catch (telemetryErr: any) {
      console.warn("[chargeAfter.telemetry] ignored", String(telemetryErr?.message || telemetryErr));
    }

    return {
      charged: true,
      creditsCharged: Number(data?.credits_charged ?? 0),
      ledgerId: data?.ledger_id ?? null,
    };
  } catch (e: any) {
    console.error("[chargeAfter] exception", String(e?.message || e));
    return { charged: false, error: String(e?.message || e) };
  }
}
