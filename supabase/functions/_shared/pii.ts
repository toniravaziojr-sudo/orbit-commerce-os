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
 * Allowlist canônica de headers para auditoria raw (F2.13.2.B).
 * Cabeçalhos sensíveis (authorization, cookie, bearer*) e ruído
 * (accept, accept-encoding, baggage, cf-visitor, cf-ew-via,
 *  cf-worker, cdn-loop, x-forwarded-port) NÃO entram.
 */
const HEADER_ALLOWLIST = new Set<string>([
  "x-hub-signature-256",
  "x-hub-signature",
  "content-type",
  "content-length",
  "user-agent",
  "x-request-id",
  "cf-ray",
  "cf-ipcountry",
  "cf-connecting-ip",
  "x-forwarded-for",
  "x-forwarded-proto",
  "host",
  "sb-request-id",
  "traceparent",
  "x-amzn-trace-id",
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

/**
 * F2.13.2.B — Resumo estrutural sanitizado de payload Meta WhatsApp.
 *
 * Substitui o `body_preview` cru de `whatsapp_webhook_raw_audit` por
 * JSON técnico determinístico, preservando observabilidade
 * (tipos, contadores, wa_message_ids para dedupe, phone_number_ids,
 * hashes de wa_id/from/recipient_id) sem expor PII.
 *
 * Cap rígido de 2 KB. Em caso de payload não-JSON, devolve resumo
 * mínimo com parse_error sanitizado, content_type e byte_length.
 */
export function summarizeWebhookBody(
  rawBodyText: string,
  contentType?: string | null,
): string {
  const byteLength = rawBodyText.length;
  const fallback = (parseError: string | null) =>
    JSON.stringify({
      parse_error: parseError ? safeTruncate(parseError, 160) : null,
      content_type: contentType ? safeTruncate(contentType, 80) : null,
      byte_length: byteLength,
    });

  let payload: any;
  try {
    payload = JSON.parse(rawBodyText);
  } catch (err) {
    return fallback(err instanceof Error ? err.message : String(err));
  }

  try {
    const entries = Array.isArray(payload?.entry) ? payload.entry : [];
    const phoneNumberIds = new Set<string>();
    const waMessageIds: string[] = [];
    const waIdHashSet = new Set<string>();
    const fromHashSet = new Set<string>();
    const recipientHashSet = new Set<string>();
    const msgTypes = new Set<string>();
    const textLengths: number[] = [];
    let messages = 0;
    let statuses = 0;
    let hasMedia = false;

    // Hash síncrono curto (FNV-1a 32-bit hex 8) para uso síncrono em
    // contexto de auditoria. Não expõe o valor original; suficiente
    // para correlação cross-request dentro do mesmo tenant/dia.
    const shortHash = (value: string): string => {
      let h = 0x811c9dc5;
      for (let i = 0; i < value.length; i++) {
        h ^= value.charCodeAt(i);
        h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
      }
      return h.toString(16).padStart(8, "0");
    };

    for (const e of entries) {
      const changes = Array.isArray(e?.changes) ? e.changes : [];
      for (const c of changes) {
        const v = c?.value ?? {};
        if (v?.metadata?.phone_number_id) {
          phoneNumberIds.add(String(v.metadata.phone_number_id));
        }
        const contacts = Array.isArray(v?.contacts) ? v.contacts : [];
        for (const ct of contacts) {
          if (ct?.wa_id) waIdHashSet.add(shortHash(String(ct.wa_id)));
        }
        const msgs = Array.isArray(v?.messages) ? v.messages : [];
        for (const m of msgs) {
          messages++;
          if (m?.id) waMessageIds.push(String(m.id));
          if (m?.type) msgTypes.add(String(m.type));
          if (m?.from) fromHashSet.add(shortHash(String(m.from)));
          if (typeof m?.text?.body === "string") textLengths.push(m.text.body.length);
          if (m?.image || m?.audio || m?.video || m?.document) hasMedia = true;
        }
        const sts = Array.isArray(v?.statuses) ? v.statuses : [];
        for (const s of sts) {
          statuses++;
          if (s?.recipient_id) recipientHashSet.add(shortHash(String(s.recipient_id)));
        }
      }
    }

    const summary = {
      object: typeof payload?.object === "string" ? payload.object : null,
      entries: entries.length,
      messages,
      statuses,
      msg_types: Array.from(msgTypes),
      phone_number_ids: Array.from(phoneNumberIds),
      wa_message_ids: waMessageIds,
      wa_id_hashes: Array.from(waIdHashSet),
      from_hashes: Array.from(fromHashSet),
      recipient_id_hashes: Array.from(recipientHashSet),
      text_lengths: textLengths,
      has_media: hasMedia,
      parse_error: null as string | null,
    };

    let out = JSON.stringify(summary);
    if (out.length > 2048) {
      // Hard cap: trunca arrays grandes e remarca parse_error
      summary.wa_message_ids = summary.wa_message_ids.slice(0, 20);
      summary.wa_id_hashes = summary.wa_id_hashes.slice(0, 20);
      summary.from_hashes = summary.from_hashes.slice(0, 20);
      summary.recipient_id_hashes = summary.recipient_id_hashes.slice(0, 20);
      summary.text_lengths = summary.text_lengths.slice(0, 20);
      summary.parse_error = "summary_truncated_2kb_cap";
      out = JSON.stringify(summary).slice(0, 2048);
    }
    return out;
  } catch (err) {
    return fallback(err instanceof Error ? err.message : String(err));
  }
}
