/**
 * Motor Universal de Créditos — Helper Universal v2
 *
 * Uso obrigatório por toda edge function paga futura.
 * Nunca calcula markup manualmente. Nunca chama provider antes de preflight/reserva.
 *
 * Modos:
 *  - 'live'   → grava em wallet/ledger
 *  - 'shadow' → calcula sem debitar; registra apenas service_usage_events status='shadow'
 */

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

export type CreditMode = "live" | "shadow";

export interface CreditEnvelope<T = unknown> {
  success: boolean;
  error_code?: string | null;
  error_message?: string | null;
  data?: T;
}

interface BaseArgs {
  tenantId: string;
  userId?: string | null;
  serviceKey: string;
  units: Record<string, unknown>;
  idempotencyKey: string;
  feature?: string | null;
  jobId?: string | null;
  metadata?: Record<string, unknown>;
  mode?: CreditMode;
}

function getServiceClient(): SupabaseClient {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}

export function buildIdempotencyKey(parts: (string | number | null | undefined)[]): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== "").join("|");
}

export function normalizeCreditError(errorCode?: string | null, errorMessage?: string | null): string {
  const map: Record<string, string> = {
    insufficient_balance: "Saldo de créditos insuficiente.",
    pricing_not_found: "Preço do serviço não cadastrado.",
    pricing_inactive: "Preço do serviço inativo.",
    fx_not_found: "Cotação de câmbio indisponível.",
    invalid_reservation: "Reserva inválida ou já finalizada.",
    reservation_already_finalized: "Reserva já finalizada.",
    refund_exceeds_captured: "Estorno acima do valor capturado.",
    invalid_reference: "Referência de transação inválida.",
    forbidden: "Operação não autorizada.",
  };
  if (errorCode && map[errorCode]) return map[errorCode];
  return errorMessage || "Erro ao processar créditos.";
}

function logOp(op: string, args: { tenantId?: string; serviceKey?: string; idempotencyKey?: string; mode?: CreditMode; result?: unknown }) {
  console.log(`[credits.${op}]`, JSON.stringify({
    tenant_id: args.tenantId, service_key: args.serviceKey,
    idempotency_key: args.idempotencyKey, mode: args.mode, result: args.result,
  }));
}

/* ───────────── Estimate / Check ───────────── */

export async function estimateCredits(args: { tenantId: string; serviceKey: string; units: Record<string, unknown>; publicSafe?: boolean }): Promise<CreditEnvelope> {
  const supabase = getServiceClient();
  const fn = args.publicSafe ? "estimate_credits_public" : "estimate_credits_internal";
  const params = args.publicSafe
    ? { p_tenant_id: args.tenantId, p_service_key: args.serviceKey, p_units: args.units }
    : { p_service_key: args.serviceKey, p_units: args.units };
  const { data, error } = await supabase.rpc(fn, params);
  if (error) return { success: false, error_code: "rpc_error", error_message: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { success: row?.success ?? false, error_code: row?.error_code, error_message: row?.error_message, data: row };
}

export async function checkBalance(args: { tenantId: string; creditsNeeded: number }): Promise<CreditEnvelope> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("check_credit_balance_v2", {
    p_tenant_id: args.tenantId, p_credits_needed: args.creditsNeeded,
  });
  if (error) return { success: false, error_code: "rpc_error", error_message: error.message };
  const row = Array.isArray(data) ? data[0] : data;
  return { success: row?.success ?? false, data: row };
}

/* ───────────── Reserve / Capture / Release ───────────── */

export async function reserveCredits(args: BaseArgs & { reservationTtlMinutes?: number }): Promise<CreditEnvelope> {
  const supabase = getServiceClient();
  const mode = args.mode ?? "live";
  const { data, error } = await supabase.rpc("reserve_credits_v2", {
    p_tenant_id: args.tenantId,
    p_user_id: args.userId ?? null,
    p_service_key: args.serviceKey,
    p_units: args.units,
    p_idempotency_key: args.idempotencyKey,
    p_job_id: args.jobId ?? null,
    p_feature: args.feature ?? null,
    p_metadata: args.metadata ?? {},
    p_reservation_ttl_minutes: args.reservationTtlMinutes ?? 30,
    p_dry_run: mode === "shadow",
  });
  const row = Array.isArray(data) ? data[0] : data;
  const env: CreditEnvelope = error
    ? { success: false, error_code: "rpc_error", error_message: error.message }
    : { success: row?.success ?? false, error_code: row?.error_code, error_message: row?.error_message, data: row };
  logOp("reserve", { tenantId: args.tenantId, serviceKey: args.serviceKey, idempotencyKey: args.idempotencyKey, mode, result: env.success });
  return env;
}

export async function captureReservation(args: { tenantId: string; reservationId: string; actualUnits: Record<string, unknown>; providerCostUsd?: number | null; idempotencyKey?: string; metadata?: Record<string, unknown> }): Promise<CreditEnvelope> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("capture_reservation", {
    p_tenant_id: args.tenantId,
    p_reservation_id: args.reservationId,
    p_actual_units: args.actualUnits,
    p_provider_cost_usd: args.providerCostUsd ?? null,
    p_idempotency_key: args.idempotencyKey ?? null,
    p_metadata: args.metadata ?? {},
  });
  const row = Array.isArray(data) ? data[0] : data;
  const env: CreditEnvelope = error
    ? { success: false, error_code: "rpc_error", error_message: error.message }
    : { success: row?.success ?? false, error_code: row?.error_code, error_message: row?.error_message, data: row };
  logOp("capture", { tenantId: args.tenantId, idempotencyKey: args.idempotencyKey, result: env.success });
  return env;
}

export async function releaseReservation(args: { tenantId: string; reservationId: string; reason?: string; idempotencyKey?: string; metadata?: Record<string, unknown> }): Promise<CreditEnvelope> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("release_reservation", {
    p_tenant_id: args.tenantId,
    p_reservation_id: args.reservationId,
    p_reason: args.reason ?? null,
    p_idempotency_key: args.idempotencyKey ?? null,
    p_metadata: args.metadata ?? {},
  });
  const row = Array.isArray(data) ? data[0] : data;
  const env: CreditEnvelope = error
    ? { success: false, error_code: "rpc_error", error_message: error.message }
    : { success: row?.success ?? false, error_code: row?.error_code, error_message: row?.error_message, data: row };
  logOp("release", { tenantId: args.tenantId, idempotencyKey: args.idempotencyKey, result: env.success });
  return env;
}

/* ───────────── Charge direto / Refund / Platform Cost ───────────── */

export async function chargeCredits(args: BaseArgs): Promise<CreditEnvelope> {
  const supabase = getServiceClient();
  const mode = args.mode ?? "live";
  const { data, error } = await supabase.rpc("charge_credits_v2", {
    p_tenant_id: args.tenantId,
    p_user_id: args.userId ?? null,
    p_service_key: args.serviceKey,
    p_units: args.units,
    p_idempotency_key: args.idempotencyKey,
    p_feature: args.feature ?? null,
    p_job_id: args.jobId ?? null,
    p_metadata: args.metadata ?? {},
    p_dry_run: mode === "shadow",
  });
  const row = Array.isArray(data) ? data[0] : data;
  const env: CreditEnvelope = error
    ? { success: false, error_code: "rpc_error", error_message: error.message }
    : { success: row?.success ?? false, error_code: row?.error_code, error_message: row?.error_message, data: row };
  logOp("charge", { tenantId: args.tenantId, serviceKey: args.serviceKey, idempotencyKey: args.idempotencyKey, mode, result: env.success });
  return env;
}

export async function refundCredits(args: { tenantId: string; referenceLedgerId: string; credits: number; reason?: string; idempotencyKey?: string; metadata?: Record<string, unknown> }): Promise<CreditEnvelope> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("refund_credits", {
    p_tenant_id: args.tenantId,
    p_reference_ledger_id: args.referenceLedgerId,
    p_credits: args.credits,
    p_reason: args.reason ?? null,
    p_idempotency_key: args.idempotencyKey ?? null,
    p_metadata: args.metadata ?? {},
  });
  const row = Array.isArray(data) ? data[0] : data;
  return error
    ? { success: false, error_code: "rpc_error", error_message: error.message }
    : { success: row?.success ?? false, error_code: row?.error_code, error_message: row?.error_message, data: row };
}

export async function recordPlatformCost(args: { serviceKey: string; units: Record<string, unknown>; costUsd: number; origin: string; originId?: string | null; metadata?: Record<string, unknown>; idempotencyKey?: string }): Promise<CreditEnvelope> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("record_platform_cost", {
    p_service_key: args.serviceKey,
    p_units: args.units,
    p_cost_usd: args.costUsd,
    p_origin: args.origin,
    p_origin_id: args.originId ?? null,
    p_metadata: args.metadata ?? {},
    p_idempotency_key: args.idempotencyKey ?? null,
  });
  const row = Array.isArray(data) ? data[0] : data;
  return error
    ? { success: false, error_code: "rpc_error", error_message: error.message }
    : { success: row?.success ?? false, error_code: row?.error_code, error_message: row?.error_message, data: row };
}
