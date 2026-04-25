// ============================================================
// tool-telemetry.ts — D9
//
// Helper de telemetria de execuções de tools do agente F2.
// Grava em `ai_support_tool_calls` (tenant-scoped, imutável).
//
// Regras:
//  - Fire-and-forget: NUNCA bloqueia o turno.
//  - Sanitização obrigatória do result_preview (sem PII, máx 500 chars).
//  - Aceita tools bloqueadas com block_type estruturado.
// ============================================================

export type BlockType =
  | "pipeline_state_block"
  | "guardrail"
  | "missing_variant"
  | "tool_disabled"
  | "channel_restriction"
  | "other";

export type BusinessContextSource =
  | "tenant_business_context"
  | "ai_business_snapshot"
  | "neutral";

export interface ToolCallTelemetryRecord {
  tenant_id: string;
  conversation_id?: string | null;
  message_id?: string | null;
  turn_correlation_id: string;
  iteration: number;
  tool_name: string;
  args?: Record<string, unknown>;
  result_preview?: string | null;
  success: boolean;
  error_message?: string | null;
  duration_ms?: number | null;
  blocked?: boolean;
  block_type?: BlockType | null;
  block_reason?: string | null;
  pipeline_state_before?: string | null;
  pipeline_state_after?: string | null;
  business_context_source?: BusinessContextSource | null;
  model?: string | null;
}

/**
 * Lista de chaves consideradas PII — removidas do args antes de gravar.
 * Mantemos a estrutura, só zeramos o valor e marcamos como redacted.
 */
const PII_KEYS = new Set([
  "phone",
  "telefone",
  "celular",
  "email",
  "e_mail",
  "cpf",
  "cnpj",
  "rg",
  "address",
  "endereco",
  "endereço",
  "street",
  "rua",
  "zip",
  "cep",
  "card",
  "card_number",
  "cvv",
  "password",
  "senha",
  "token",
  "access_token",
  "refresh_token",
]);

function redactArgs(args: Record<string, unknown> | undefined): Record<string, unknown> {
  if (!args || typeof args !== "object") return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(args)) {
    if (PII_KEYS.has(k.toLowerCase())) {
      out[k] = "[redacted]";
      continue;
    }
    if (v && typeof v === "object" && !Array.isArray(v)) {
      out[k] = redactArgs(v as Record<string, unknown>);
    } else {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Sanitiza e trunca o resultado para 500 chars.
 * Remove ocorrências óbvias de PII via regex defensiva (telefone, email, CPF).
 */
export function sanitizeResultPreview(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let s = String(raw);
  // emails
  s = s.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[email]");
  // telefones BR (11 dígitos com/sem máscara)
  s = s.replace(/(\+?55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, "[phone]");
  // CPF/CNPJ
  s = s.replace(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, "[cpf]");
  s = s.replace(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, "[cnpj]");
  // CEP
  s = s.replace(/\d{5}-?\d{3}/g, "[cep]");
  if (s.length > 500) s = s.slice(0, 497) + "...";
  return s;
}

/**
 * Insere telemetria de uma execução de tool. Fire-and-forget.
 * Erros são logados mas NUNCA propagados.
 */
export function recordToolCall(
  supabase: { from: (t: string) => any },
  record: ToolCallTelemetryRecord,
): void {
  try {
    const payload = {
      tenant_id: record.tenant_id,
      conversation_id: record.conversation_id ?? null,
      message_id: record.message_id ?? null,
      turn_correlation_id: record.turn_correlation_id,
      iteration: record.iteration,
      tool_name: record.tool_name,
      args: redactArgs(record.args),
      result_preview: sanitizeResultPreview(record.result_preview),
      success: record.success,
      error_message: record.error_message ?? null,
      duration_ms: record.duration_ms ?? null,
      blocked: record.blocked ?? false,
      block_type: record.block_type ?? null,
      block_reason: record.block_reason ?? null,
      pipeline_state_before: record.pipeline_state_before ?? null,
      pipeline_state_after: record.pipeline_state_after ?? null,
      business_context_source: record.business_context_source ?? null,
      model: record.model ?? null,
    };

    Promise.resolve(supabase.from("ai_support_tool_calls").insert(payload))
      .then((res: any) => {
        if (res?.error) {
          console.warn("[tool-telemetry] insert error:", res.error.message);
        }
      })
      .catch((e: any) => {
        console.warn("[tool-telemetry] insert exception:", e?.message || e);
      });
  } catch (e) {
    console.warn("[tool-telemetry] record exception:", (e as Error).message);
  }
}
