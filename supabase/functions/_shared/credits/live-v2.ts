/**
 * Motor de Créditos v2 — Helper Live (Fase A3.1)
 *
 * Encapsula chamadas às RPCs reserve_credits_v2, capture_reservation e
 * release_reservation com idempotência canônica para o piloto live Fal-only
 * (creative-image-generate / Respeite o Homem).
 *
 * - Não decide regra de negócio; apenas RPC + log estruturado.
 * - 200 OK + success:false em qualquer falha controlada (motor financeiro).
 * - Idempotência (Fase A3.1):
 *     reserve: v2|reserve|<tenant>|<job>|<service_key>|<variation_index>
 *     capture: v2|capture|<reservation_id>
 *     release: v2|release|<reservation_id>
 */

const LOG = '[creative-image.live]';

export interface LiveReserveArgs {
  tenantId: string;
  userId: string | null;
  serviceKey: string;
  units: Record<string, unknown>;
  jobId: string;
  variationIndex: number;
  feature: string;
  metadata: Record<string, unknown>;
  reservationTtlMinutes?: number;
}

export interface LiveReserveResult {
  success: boolean;
  reservationId: string | null;
  ledgerId: string | null;
  creditsReserved: number;
  errorCode: string | null;
  errorMessage: string | null;
  raw: any;
}

export interface LiveCaptureArgs {
  tenantId: string;
  reservationId: string;
  actualUnits: Record<string, unknown>;
  providerCostUsd: number | null;
  metadata: Record<string, unknown>;
}

export interface LiveReleaseArgs {
  tenantId: string;
  reservationId: string;
  reason: string;
  metadata: Record<string, unknown>;
}

export function buildReserveIdempotencyKey(args: {
  tenantId: string;
  jobId: string;
  serviceKey: string;
  variationIndex: number;
}): string {
  return [
    'v2|reserve',
    args.tenantId,
    args.jobId,
    args.serviceKey,
    args.variationIndex,
  ].join('|');
}

export function buildCaptureIdempotencyKey(reservationId: string): string {
  return `v2|capture|${reservationId}`;
}

export function buildReleaseIdempotencyKey(reservationId: string): string {
  return `v2|release|${reservationId}`;
}

export async function callReserveCreditsV2(
  supabase: any,
  args: LiveReserveArgs,
): Promise<LiveReserveResult> {
  const idemp = buildReserveIdempotencyKey({
    tenantId: args.tenantId,
    jobId: args.jobId,
    serviceKey: args.serviceKey,
    variationIndex: args.variationIndex,
  });

  console.log(LOG, JSON.stringify({
    evt: 'reserve_started',
    tenant_id: args.tenantId,
    service_key: args.serviceKey,
    job_id: args.jobId,
    variation_index: args.variationIndex,
    idempotency_key: idemp,
  }));

  try {
    const { data, error } = await supabase.rpc('reserve_credits_v2', {
      p_tenant_id: args.tenantId,
      p_user_id: args.userId,
      p_service_key: args.serviceKey,
      p_units: args.units,
      p_idempotency_key: idemp,
      p_job_id: args.jobId,
      p_feature: args.feature,
      p_metadata: args.metadata,
      p_reservation_ttl_minutes: args.reservationTtlMinutes ?? 30,
      p_dry_run: false,
    });

    if (error) {
      console.warn(LOG, JSON.stringify({
        evt: 'reserve_failed',
        error_code: 'RPC_ERROR',
        error_message: error.message,
        idempotency_key: idemp,
      }));
      return {
        success: false,
        reservationId: null,
        ledgerId: null,
        creditsReserved: 0,
        errorCode: 'RPC_ERROR',
        errorMessage: error.message,
        raw: error,
      };
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.success !== true) {
      console.warn(LOG, JSON.stringify({
        evt: 'reserve_failed',
        error_code: row?.error_code ?? 'UNKNOWN',
        error_message: row?.error_message ?? null,
        idempotency_key: idemp,
      }));
      return {
        success: false,
        reservationId: null,
        ledgerId: null,
        creditsReserved: 0,
        errorCode: row?.error_code ?? 'UNKNOWN',
        errorMessage: row?.error_message ?? null,
        raw: row,
      };
    }

    console.log(LOG, JSON.stringify({
      evt: 'reserve_success',
      reservation_id: row.reservation_id,
      ledger_id: row.ledger_id,
      credits_reserved: row.credits_reserved,
      idempotency_key: idemp,
    }));

    return {
      success: true,
      reservationId: row.reservation_id ?? null,
      ledgerId: row.ledger_id ?? null,
      creditsReserved: Number(row.credits_reserved ?? 0),
      errorCode: null,
      errorMessage: null,
      raw: row,
    };
  } catch (e: any) {
    console.warn(LOG, JSON.stringify({
      evt: 'reserve_failed',
      error_code: 'EXCEPTION',
      error_message: String(e?.message || e),
      idempotency_key: idemp,
    }));
    return {
      success: false,
      reservationId: null,
      ledgerId: null,
      creditsReserved: 0,
      errorCode: 'EXCEPTION',
      errorMessage: String(e?.message || e),
      raw: null,
    };
  }
}

export async function callCaptureReservation(
  supabase: any,
  args: LiveCaptureArgs,
): Promise<{ success: boolean; raw: any; errorCode: string | null; errorMessage: string | null }> {
  const idemp = buildCaptureIdempotencyKey(args.reservationId);
  console.log(LOG, JSON.stringify({
    evt: 'capture_started',
    reservation_id: args.reservationId,
    idempotency_key: idemp,
  }));

  try {
    const { data, error } = await supabase.rpc('capture_reservation', {
      p_tenant_id: args.tenantId,
      p_reservation_id: args.reservationId,
      p_actual_units: args.actualUnits,
      p_provider_cost_usd: args.providerCostUsd,
      p_idempotency_key: idemp,
      p_metadata: args.metadata,
    });
    if (error) {
      console.error(LOG, JSON.stringify({
        evt: 'capture_failed',
        reservation_id: args.reservationId,
        error_code: 'RPC_ERROR',
        error_message: error.message,
      }));
      return { success: false, raw: error, errorCode: 'RPC_ERROR', errorMessage: error.message };
    }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row || row.success !== true) {
      console.error(LOG, JSON.stringify({
        evt: 'capture_failed',
        reservation_id: args.reservationId,
        error_code: row?.error_code ?? 'UNKNOWN',
        error_message: row?.error_message ?? null,
      }));
      return {
        success: false,
        raw: row,
        errorCode: row?.error_code ?? 'UNKNOWN',
        errorMessage: row?.error_message ?? null,
      };
    }
    console.log(LOG, JSON.stringify({
      evt: 'capture_success',
      reservation_id: args.reservationId,
      capture_ledger_id: row.ledger_id ?? null,
    }));
    return { success: true, raw: row, errorCode: null, errorMessage: null };
  } catch (e: any) {
    console.error(LOG, JSON.stringify({
      evt: 'capture_failed',
      reservation_id: args.reservationId,
      error_code: 'EXCEPTION',
      error_message: String(e?.message || e),
    }));
    return { success: false, raw: null, errorCode: 'EXCEPTION', errorMessage: String(e?.message || e) };
  }
}

export async function callReleaseReservation(
  supabase: any,
  args: LiveReleaseArgs,
): Promise<{ success: boolean; raw: any }> {
  const idemp = buildReleaseIdempotencyKey(args.reservationId);
  console.log(LOG, JSON.stringify({
    evt: 'release_started',
    reservation_id: args.reservationId,
    reason: args.reason,
    idempotency_key: idemp,
  }));
  try {
    const { data, error } = await supabase.rpc('release_reservation', {
      p_tenant_id: args.tenantId,
      p_reservation_id: args.reservationId,
      p_reason: args.reason,
      p_idempotency_key: idemp,
      p_metadata: args.metadata,
    });
    if (error) {
      console.warn(LOG, JSON.stringify({
        evt: 'release_failed',
        reservation_id: args.reservationId,
        error_message: error.message,
      }));
      return { success: false, raw: error };
    }
    console.log(LOG, JSON.stringify({
      evt: 'release_success',
      reservation_id: args.reservationId,
    }));
    return { success: true, raw: data };
  } catch (e: any) {
    console.warn(LOG, JSON.stringify({
      evt: 'release_failed',
      reservation_id: args.reservationId,
      error_message: String(e?.message || e),
    }));
    return { success: false, raw: null };
  }
}

/**
 * Carrega live_service_keys do tenant para o gate fino do Motor v2.
 * Retorna conjunto vazio em qualquer falha (fail-closed).
 */
export async function loadLiveServiceKeys(supabase: any, tenantId: string): Promise<Set<string>> {
  try {
    const { data, error } = await supabase
      .from('tenant_credit_motor_config')
      .select('live_service_keys')
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (error || !data) return new Set();
    const keys: string[] = Array.isArray(data.live_service_keys) ? data.live_service_keys : [];
    return new Set(keys);
  } catch {
    return new Set();
  }
}
