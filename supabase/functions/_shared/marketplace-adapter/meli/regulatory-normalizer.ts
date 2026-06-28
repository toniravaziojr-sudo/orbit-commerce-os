/**
 * Mercado Livre — Normalizador de números regulatórios (v2.4.4)
 *
 * O ML aceita ANVISA em DOIS formatos canônicos:
 *  - Notificação/Comunicação prévia (17 dígitos):  XXXXX.XXXXXX/XXXX-XX
 *  - Registro de produto (13 dígitos):             X.XXXX.XXXX.XXX-X
 *
 * O cadastro do produto pode persistir o número "cru" (só dígitos) ou
 * já formatado. O adaptador é responsável por entregar ao ML SEMPRE no
 * formato canônico — sem alterar o cadastro.
 *
 * Pure function. Sem I/O. Cobertura: pass-through quando já válido,
 * mask quando só dígitos, null quando inválido (adapter deve omitir).
 */

export type AnvisaKind = "notification" | "registration";

const RX_NOTIFICATION = /^\d{5}\.\d{6}\/\d{4}-\d{2}$/; // 17 dígitos
const RX_REGISTRATION = /^\d{1}\.\d{4}\.\d{4}\.\d{3}-\d{1}$/; // 13 dígitos

export interface AnvisaNormalizeResult {
  value: string | null;
  kind: AnvisaKind | null;
  reason?: "empty" | "invalid_length" | "non_numeric";
}

export function normalizeAnvisaNumber(raw: unknown): AnvisaNormalizeResult {
  if (raw === null || raw === undefined) return { value: null, kind: null, reason: "empty" };
  const s = String(raw).trim();
  if (!s) return { value: null, kind: null, reason: "empty" };

  // Pass-through quando já vier no formato oficial
  if (RX_NOTIFICATION.test(s)) return { value: s, kind: "notification" };
  if (RX_REGISTRATION.test(s)) return { value: s, kind: "registration" };

  const digits = s.replace(/\D+/g, "");
  if (!digits) return { value: null, kind: null, reason: "non_numeric" };

  if (digits.length === 17) {
    // XXXXX.XXXXXX/XXXX-XX
    const masked = `${digits.slice(0, 5)}.${digits.slice(5, 11)}/${digits.slice(11, 15)}-${digits.slice(15, 17)}`;
    return { value: masked, kind: "notification" };
  }
  if (digits.length === 13) {
    // X.XXXX.XXXX.XXX-X
    const masked = `${digits.slice(0, 1)}.${digits.slice(1, 5)}.${digits.slice(5, 9)}.${digits.slice(9, 12)}-${digits.slice(12, 13)}`;
    return { value: masked, kind: "registration" };
  }
  return { value: null, kind: null, reason: "invalid_length" };
}
