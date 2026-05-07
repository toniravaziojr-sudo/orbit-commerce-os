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

    // Normalização de jobId: RPC reserve_credits_v2 exige UUID em p_job_id.
    // Providers externos (SendGrid X-Message-Id, etc.) retornam strings arbitrárias.
    // Se já for UUID, mantemos. Caso contrário, derivamos UUID v5 determinístico
    // namespaced por (tenantId, serviceKey, jobId externo) — mesmo input → mesmo UUID,
    // tenants/serviços diferentes não colidem.
    const externalJobId = args.jobId;
    const billingJobId = isUuid(externalJobId)
      ? externalJobId
      : await deriveBillingJobIdV5(args.tenantId, args.serviceKey, externalJobId);
    const jobIdWasDerived = billingJobId !== externalJobId;

    const enrichedMetadata: Record<string, unknown> = {
      ...(args.metadata ?? {}),
      motor_universal: true,
      postpaid: true,
      provider_job_id: externalJobId,
      ...(jobIdWasDerived ? { billing_job_id_derived: true, billing_job_id: billingJobId } : {}),
    };

    const idemReserve = buildIdempotencyKey(["v2", "postpaid", "reserve", args.tenantId, billingJobId, args.serviceKey]);
    const reserveRes = await reserveCredits({
      tenantId: args.tenantId,
      userId: args.userId ?? null,
      serviceKey: args.serviceKey,
      units: args.units,
      idempotencyKey: idemReserve,
      jobId: billingJobId,
      feature: args.feature,
      metadata: enrichedMetadata,
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

// ---------------------------------------------------------------------------
// F1 — Telemetria universal de chargeAfter (service_usage_events captured)
// ---------------------------------------------------------------------------

interface RecordUsageArgs {
  tenantId: string;
  serviceKey: string;
  units: Record<string, unknown>;
  feature: string;
  jobId: string;
  ledgerId: string | null;
  creditsCharged: number;
  providerCostUsd?: number | null;
  idempotencyKey: string;
  userMetadata: Record<string, unknown>;
}

/**
 * Registra evento de uso (status='captured', cost_owner='tenant') espelhando
 * o débito já realizado em credit_ledger pelo chargeAfter.
 *
 * Idempotência:
 *  - UNIQUE parcial em service_usage_events(credit_ledger_id) garante 1 evento
 *    por linha de ledger. Retry com mesmo ledger_id não duplica.
 *  - Quando ledger_id é nulo (raro), usa fallback determinístico em metadata.
 *
 * NUNCA toca wallet/ledger. Erros são silenciosos (cobrança já entregue).
 */
async function recordChargeAfterUsageEvent(args: RecordUsageArgs): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Resolve category/provider canônicos do catálogo (sem expor pricing/markup).
  let category = "unknown";
  let provider = "unknown";
  try {
    const { data: pricing } = await supabase
      .from("service_pricing")
      .select("category, provider")
      .eq("service_key", args.serviceKey)
      .limit(1)
      .maybeSingle();
    if (pricing) {
      category = pricing.category ?? "unknown";
      provider = pricing.provider ?? "unknown";
    }
  } catch (_) { /* segue com unknown */ }

  const insertRow: Record<string, unknown> = {
    tenant_id: args.tenantId,
    service_key: args.serviceKey,
    category,
    provider,
    units_json: args.units ?? {},
    status: "captured",
    cost_owner: "tenant",
    origin_function: args.feature,
    credit_ledger_id: args.ledgerId,
    metadata: {
      motor_version: "v2",
      mode: "live",
      source: "charge_after_telemetry_v1",
      feature: args.feature,
      job_id: args.jobId,
      credits_charged: args.creditsCharged,
      provider_cost_usd_snapshot: args.providerCostUsd ?? null,
      idempotency_key: args.idempotencyKey,
      // metadata segura para painel admin (tenant nunca lê via RLS)
      user_metadata: sanitizeUserMetadata(args.userMetadata),
    },
  };

  const { error } = await supabase.from("service_usage_events").insert(insertRow);
  if (error) {
    const msg = error.message || "";
    if (msg.includes("duplicate key") || msg.includes("uq_sue_credit_ledger_id") || msg.includes("unique")) {
      console.log("[chargeAfter.telemetry] idempotent_skip", JSON.stringify({
        ledger_id: args.ledgerId, service_key: args.serviceKey,
      }));
      return;
    }
    console.warn("[chargeAfter.telemetry] insert_failed", msg);
    return;
  }
  console.log("[chargeAfter.telemetry] recorded", JSON.stringify({
    tenant_id: args.tenantId, service_key: args.serviceKey,
    ledger_id: args.ledgerId, credits_charged: args.creditsCharged,
  }));
}

/** Remove chaves potencialmente sensíveis antes de persistir em metadata. */
function sanitizeUserMetadata(m: Record<string, unknown>): Record<string, unknown> {
  if (!m || typeof m !== "object") return {};
  const BLOCKED = new Set([
    "cost_usd", "markup_pct", "sell_usd", "fx_rate",
    "api_key", "token", "authorization", "secret", "password",
  ]);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(m)) {
    if (BLOCKED.has(k.toLowerCase())) continue;
    out[k] = v;
  }
  return out;
}
