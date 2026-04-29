// =============================================================
// Sanitiza conteúdo de mensagem para exibição na timeline /support.
// Bloqueia conteúdo "cru" de templates legados (anteriores ao Phase 3
// do template-renderer) que ficaram persistidos em messages.content
// com placeholders `{{var}}` ou prefixo técnico `[Template: ...]`.
//
// Anti-regression: nenhum conteúdo cru deve ser apresentado a humanos
// (atendente ou cliente). Para futuros envios, run-notifications v1.5.0+
// já bloqueia na origem; este helper é a defesa para o histórico legado.
// =============================================================

const PLACEHOLDER_PATTERN = /\{\{\s*[\w.-]+\s*\}\}/;
const TECH_PREFIX_PATTERN = /^\s*\[Template:\s*[^\]]+\]/i;

export interface SanitizedContent {
  /** Texto seguro para exibir. Pode ser uma versão amigável quando o original era cru. */
  text: string;
  /** Se true, o original continha placeholders/prefixo técnico e foi substituído. */
  wasLegacyLeak: boolean;
}

/**
 * Decide se uma string é "conteúdo cru" de template (vazamento legado).
 */
export function isLegacyTemplateLeak(content: string | null | undefined): boolean {
  if (!content) return false;
  return TECH_PREFIX_PATTERN.test(content) || PLACEHOLDER_PATTERN.test(content);
}

/**
 * Devolve uma versão segura para exibição. Quando detecta vazamento legado,
 * substitui por uma mensagem clara de "conteúdo legado oculto".
 */
export function sanitizeMessageContent(content: string | null | undefined): SanitizedContent {
  const raw = (content ?? "").toString();
  if (!raw) return { text: "", wasLegacyLeak: false };

  if (isLegacyTemplateLeak(raw)) {
    return {
      text: "Notificação enviada (conteúdo legado oculto — template não renderizado na época).",
      wasLegacyLeak: true,
    };
  }

  return { text: raw, wasLegacyLeak: false };
}
