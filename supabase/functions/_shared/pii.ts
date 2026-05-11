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
 * F2.13.2.B (revisão Correção PII-Hash) — Resumo estrutural sanitizado
 * de payload Meta WhatsApp.
 *
 * Substitui o `body_preview` cru de `whatsapp_webhook_raw_audit` por
 * JSON técnico determinístico, preservando observabilidade
 * (tipos, contadores, wa_message_ids para dedupe, phone_number_ids,
 * hashes determinísticos de wa_id/from/recipient_id) sem expor PII.
 *
 * Hash de PII (wa_id/from/recipient_id):
 *  - Se `LOG_HASH_SECRET` estiver presente no ambiente → HMAC-SHA256
 *    truncado a 12 hex chars.
 *  - Caso contrário → SHA-256 puro truncado a 12 hex chars (fallback
 *    temporário até pepper dedicado existir). NUNCA usar
 *    META_APP_SECRET como pepper de logs.
 *  - FNV-1a (não criptográfico) foi REMOVIDO desta função: PII
 *    previsível como telefone/wa_id é facilmente correlacionável e
 *    bruteforçável com hash não criptográfico.
 *
 * Cap rígido de 2 KB. Em caso de payload não-JSON, devolve resumo
 * mínimo com parse_error sanitizado, content_type e byte_length.
 */
async function piiHash(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const secret = (() => {
    try { return (globalThis as any).Deno?.env?.get?.("LOG_HASH_SECRET") ?? null; } catch { return null; }
  })();
  let buf: ArrayBuffer;
  if (secret && typeof secret === "string" && secret.length > 0) {
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    buf = await crypto.subtle.sign("HMAC", key, data);
  } else {
    buf = await crypto.subtle.digest("SHA-256", data);
  }
  const bytes = new Uint8Array(buf).slice(0, 6);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function summarizeWebhookBody(
  rawBodyText: string,
  contentType?: string | null,
): Promise<string> {
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
    const waIdRaw = new Set<string>();
    const fromRaw = new Set<string>();
    const recipientRaw = new Set<string>();
    const msgTypes = new Set<string>();
    const textLengths: number[] = [];
    let messages = 0;
    let statuses = 0;
    let hasMedia = false;

    for (const e of entries) {
      const changes = Array.isArray(e?.changes) ? e.changes : [];
      for (const c of changes) {
        const v = c?.value ?? {};
        if (v?.metadata?.phone_number_id) {
          phoneNumberIds.add(String(v.metadata.phone_number_id));
        }
        const contacts = Array.isArray(v?.contacts) ? v.contacts : [];
        for (const ct of contacts) {
          if (ct?.wa_id) waIdRaw.add(String(ct.wa_id));
        }
        const msgs = Array.isArray(v?.messages) ? v.messages : [];
        for (const m of msgs) {
          messages++;
          if (m?.id) waMessageIds.push(String(m.id));
          if (m?.type) msgTypes.add(String(m.type));
          if (m?.from) fromRaw.add(String(m.from));
          if (typeof m?.text?.body === "string") textLengths.push(m.text.body.length);
          if (m?.image || m?.audio || m?.video || m?.document) hasMedia = true;
        }
        const sts = Array.isArray(v?.statuses) ? v.statuses : [];
        for (const s of sts) {
          statuses++;
          if (s?.recipient_id) recipientRaw.add(String(s.recipient_id));
        }
      }
    }

    const hashAll = async (set: Set<string>): Promise<string[]> =>
      Array.from(new Set(await Promise.all(Array.from(set).map(piiHash))));
    const [waIdHashes, fromHashes, recipientHashes] = await Promise.all([
      hashAll(waIdRaw),
      hashAll(fromRaw),
      hashAll(recipientRaw),
    ]);

    const summary = {
      object: typeof payload?.object === "string" ? payload.object : null,
      entries: entries.length,
      messages,
      statuses,
      msg_types: Array.from(msgTypes),
      phone_number_ids: Array.from(phoneNumberIds),
      wa_message_ids: waMessageIds,
      wa_id_hashes: waIdHashes,
      from_hashes: fromHashes,
      recipient_id_hashes: recipientHashes,
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
