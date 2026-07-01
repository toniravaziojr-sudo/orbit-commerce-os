/**
 * Resiliência de Conexões Externas — Helper transversal (v1)
 *
 * Regra oficial: docs/especificacoes/transversais/padroes-operacionais.md §8.
 *
 * Só marcamos uma conexão como inativa (`is_active=false`,
 * `health_status='needs_reauth'`) quando o provedor sinaliza explicitamente
 * que o vínculo foi revogado ou o refresh token é inválido. Qualquer outro
 * erro (429, 5xx, timeout, rede) é TRANSITÓRIO — mantém `is_active=true`,
 * incrementa `consecutive_failures`, agenda `next_retry_at`.
 *
 * Provider-agnostic: serve Mercado Livre, Meta, Google, gateways, Correios, etc.
 */

export type HealthStatus = "healthy" | "degraded" | "needs_reauth";
export type ErrorClass = "fatal" | "transient";

/** Termos que, no corpo da resposta, indicam revogação real do vínculo. */
const FATAL_TOKENS = [
  "invalid_grant",
  "invalid_token",
  "invalid_refresh_token",
  "revoked_token",
  "token_revoked",
  "unauthorized_client",
  "access_denied",
];

/**
 * Classifica a resposta do provedor.
 * - 429 e 5xx sempre transitório.
 * - 400/401/403 com termo fatal no corpo → fatal.
 * - Restante → transitório.
 */
export function classifyProviderError(status: number, body: unknown): ErrorClass {
  const text = typeof body === "string" ? body : JSON.stringify(body ?? "");
  const lower = text.toLowerCase();
  const hasFatalToken = FATAL_TOKENS.some((t) => lower.includes(t));

  if (status === 429) return "transient";
  if (status >= 500) return "transient";
  if ((status === 400 || status === 401 || status === 403) && hasFatalToken) return "fatal";
  return "transient";
}

/** Backoff exponencial: 1m → 5m → 15m → 1h → 6h → 24h (teto). */
export function computeNextRetry(consecutiveFailures: number): Date {
  const steps = [1, 5, 15, 60, 360, 1440]; // minutos
  const idx = Math.min(Math.max(consecutiveFailures - 1, 0), steps.length - 1);
  return new Date(Date.now() + steps[idx] * 60 * 1000);
}

interface SupabaseLike {
  from: (t: string) => any;
}

export async function markSuccess(
  supabase: SupabaseLike,
  table: string,
  id: string,
): Promise<void> {
  await supabase.from(table).update({
    consecutive_failures: 0,
    next_retry_at: null,
    last_success_at: new Date().toISOString(),
    last_error: null,
    health_status: "healthy",
    is_active: true,
  }).eq("id", id);
}

export async function markTransientFailure(
  supabase: SupabaseLike,
  table: string,
  id: string,
  reason: string,
  currentFailures: number = 0,
): Promise<{ nextRetryAt: Date; failures: number }> {
  const failures = currentFailures + 1;
  const nextRetryAt = computeNextRetry(failures);
  await supabase.from(table).update({
    consecutive_failures: failures,
    next_retry_at: nextRetryAt.toISOString(),
    last_error: `[transient] ${String(reason).slice(0, 500)}`,
    health_status: "degraded",
    // is_active permanece true — regra §8
  }).eq("id", id);
  return { nextRetryAt, failures };
}

export async function markFatal(
  supabase: SupabaseLike,
  table: string,
  id: string,
  reason: string,
): Promise<void> {
  await supabase.from(table).update({
    is_active: false,
    health_status: "needs_reauth",
    last_error: `[fatal] ${String(reason).slice(0, 500)}`,
    next_retry_at: null,
  }).eq("id", id);
}

/**
 * Registro em `marketplace_sync_logs`. Best-effort — nunca derruba o fluxo principal.
 */
export async function logSyncEvent(
  supabase: SupabaseLike,
  params: {
    tenant_id: string;
    connection_id: string;
    marketplace: string;
    sync_type: string; // 'token_refresh' | 'webhook_receive' | 'orders_sync' | ...
    status: "completed" | "partial" | "failed" | "pending" | "skipped";
    details?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.from("marketplace_sync_logs").insert(params);
  } catch (_e) {
    // silencioso
  }
}
