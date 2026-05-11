// =============================================================
// _shared/pii.ts — Helpers de sanitização de PII para logs runtime
// =============================================================
// Política: docs/especificacoes/transversais/politica-pii-logs.md
// Escopo F2.13.2.A: usado APENAS em console.log/warn/error.
// Persistência operacional (raw_payload, agenda_command_log,
// meta_webhook_audit_raw) NÃO usa estes helpers nesta fase.
// =============================================================

/**
 * Mascara telefone preservando DDI+DDD (4 primeiros) e os 4 últimos.
 * Ex.: "5573991681425" → "5573****1425"
 * Para valores curtos (<8 dígitos), mascara o miolo conservadoramente.
 */
export function maskPhone(value?: string | null): string {
  if (!value) return "";
  const digits = String(value).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length <= 4) return "****";
  if (digits.length <= 8) return `${digits.slice(0, 2)}****${digits.slice(-2)}`;
  return `${digits.slice(0, 4)}****${digits.slice(-4)}`;
}

/**
 * Trunca valores longos para uso seguro em log de contexto.
 * Sempre devolve string. Anexa "…(+N)" quando truncado.
 */
export function safeTruncate(value: unknown, maxLength = 120): string {
  if (value === null || value === undefined) return "";
  const str = typeof value === "string" ? value : (() => {
    try { return JSON.stringify(value); } catch { return String(value); }
  })();
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength)}…(+${str.length - maxLength})`;
}

/**
 * Versão para erros: extrai .message quando possível e trunca.
 * Nunca propaga stack completo para log padrão.
 */
export function safeError(value: unknown, maxLength = 200): string {
  if (!value) return "";
  if (value instanceof Error) return safeTruncate(value.message || String(value), maxLength);
  if (typeof value === "object") {
    const anyVal = value as { message?: unknown; error?: unknown };
    if (typeof anyVal.message === "string") return safeTruncate(anyVal.message, maxLength);
    if (typeof anyVal.error === "string") return safeTruncate(anyVal.error, maxLength);
  }
  return safeTruncate(value, maxLength);
}

/**
 * Hash determinístico curto (sha256 hex, primeiros 12 chars) para
 * correlacionar valores sensíveis em log sem expor o conteúdo.
 * Uso típico: rastrear dois logs do mesmo texto sem logar o texto.
 */
export async function hashForLog(value?: string | null): Promise<string> {
  if (!value) return "";
  const data = new TextEncoder().encode(String(value));
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .slice(0, 6)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Allowlist de headers para uso futuro em F2.13.2.B (auditoria raw).
 * NÃO aplicar em persistência nesta fase — helper preparado apenas.
 * Apenas headers técnicos não-sensíveis são preservados.
 */
const HEADER_ALLOWLIST = new Set<string>([
  "content-type",
  "content-length",
  "user-agent",
  "x-request-id",
  "x-hub-signature",
  "x-hub-signature-256",
  "x-forwarded-for",
  "cf-connecting-ip",
  "cf-ray",
]);

export function safeHeaders(
  headers: Headers | Record<string, string> | null | undefined,
): Record<string, string> {
  if (!headers) return {};
  const out: Record<string, string> = {};
  const entries: Array<[string, string]> = headers instanceof Headers
    ? Array.from(headers.entries())
    : Object.entries(headers);
  for (const [k, v] of entries) {
    const key = k.toLowerCase();
    if (HEADER_ALLOWLIST.has(key)) {
      out[key] = String(v);
    }
  }
  return out;
}
