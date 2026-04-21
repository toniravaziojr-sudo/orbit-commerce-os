// =============================================================
// Phase 3 — Pipeline único de renderização de templates
// =============================================================
// Fonte única de verdade para resolver `{{variaveis}}` em
// templates de notificação (WhatsApp, e-mail, timeline).
//
// Garantias mandatórias:
//   1. Modo `strict`: variável obrigatória ausente => falha (não envia)
//   2. Modo `lenient`: substitui faltantes por "" e devolve a lista
//      de variáveis ausentes para registro como evento interno
//   3. Trava final `assertNoPlaceholders`: rejeita qualquer string que
//      ainda contenha `{{...}}` ou prefixo técnico `[Template: ...]`
//
// Esta camada NÃO conhece WhatsApp, SendGrid ou banco. Apenas resolve
// strings. Os adapters (run-notifications, meta-whatsapp-send) chamam
// este helper antes de enviar para o canal e antes de persistir na
// timeline do /support.
// =============================================================

export interface RenderOptions {
  /**
   * - `strict`: lança erro se faltar variável referenciada no template
   * - `lenient`: substitui faltantes por "" e retorna em `missing`
   */
  mode?: "strict" | "lenient";
  /** Variáveis referenciadas mas explicitamente opcionais (não falham em strict) */
  optionalVars?: string[];
}

export interface RenderResult {
  /** String final, pronta para envio/exibição. */
  text: string;
  /** Variáveis encontradas no template (na ordem de aparição, sem duplicatas). */
  referencedVars: string[];
  /** Variáveis referenciadas mas ausentes/vazias no payload. */
  missing: string[];
  /** Indica se houve qualquer ausência. */
  hasMissing: boolean;
}

export class TemplateRenderError extends Error {
  public readonly missing: string[];
  public readonly templateName?: string;
  constructor(message: string, missing: string[], templateName?: string) {
    super(message);
    this.name = "TemplateRenderError";
    this.missing = missing;
    this.templateName = templateName;
  }
}

const PLACEHOLDER_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;
const TECH_PREFIX_PATTERN = /^\s*\[Template:\s*[^\]]+\]\s*/i;

/**
 * Renderiza um template substituindo `{{var}}` pelos valores do payload.
 * Não envia, não persiste. Apenas devolve o resultado.
 */
export function renderTemplate(
  template: string,
  payload: Record<string, unknown> | null | undefined,
  options: RenderOptions = {},
): RenderResult {
  const mode = options.mode ?? "strict";
  const optional = new Set(options.optionalVars ?? []);
  const safePayload = payload ?? {};

  const referencedVars: string[] = [];
  const missing: string[] = [];

  // Remove qualquer prefixo técnico de template já presente na string fonte
  // (defesa contra strings legadas que vêm com "[Template: x] ...")
  const cleanedSource = (template ?? "").replace(TECH_PREFIX_PATTERN, "");

  const text = cleanedSource.replace(PLACEHOLDER_PATTERN, (_match, varName: string) => {
    if (!referencedVars.includes(varName)) referencedVars.push(varName);

    const raw = (safePayload as Record<string, unknown>)[varName];
    const value = raw == null ? "" : String(raw).trim();

    if (value.length === 0) {
      if (!optional.has(varName) && !missing.includes(varName)) missing.push(varName);
      return ""; // será validado abaixo conforme o modo
    }
    return value;
  });

  if (mode === "strict" && missing.length > 0) {
    throw new TemplateRenderError(
      `Template render failed: missing required variable(s): ${missing.join(", ")}`,
      missing,
    );
  }

  return { text, referencedVars, missing, hasMissing: missing.length > 0 };
}

/**
 * Trava final: garante que a string pronta para sair NÃO contém
 * mais nenhum placeholder cru nem prefixo técnico de template.
 * Lança se algo escapou.
 */
export function assertNoPlaceholders(text: string, ctx: { stage: string; templateName?: string }): void {
  if (PLACEHOLDER_PATTERN.test(text)) {
    PLACEHOLDER_PATTERN.lastIndex = 0; // reset state global
    const sample = text.match(PLACEHOLDER_PATTERN)?.slice(0, 5).join(", ") ?? "";
    throw new TemplateRenderError(
      `[${ctx.stage}] Conteúdo final ainda contém placeholders crus (${sample}). Bloqueado para não vazar ao cliente.`,
      [],
      ctx.templateName,
    );
  }
  PLACEHOLDER_PATTERN.lastIndex = 0;

  if (TECH_PREFIX_PATTERN.test(text)) {
    throw new TemplateRenderError(
      `[${ctx.stage}] Conteúdo final começa com prefixo técnico "[Template: ...]". Bloqueado.`,
      [],
      ctx.templateName,
    );
  }
}

/**
 * Helper de conveniência: renderiza em modo lenient (não joga erro),
 * mas devolve uma versão "amigável" pronta para mostrar a humanos como
 * EVENTO INTERNO quando o envio real precisa ser bloqueado.
 *
 * Não substitui placeholders por strings visíveis — substitui por "—"
 * apenas em modo cosmético quando o caller marcar `cosmetic: true`.
 */
export function renderForInternalLog(
  template: string,
  payload: Record<string, unknown> | null | undefined,
): { text: string; missing: string[] } {
  const result = renderTemplate(template, payload, { mode: "lenient" });
  // Para o log interno trocamos vazios visíveis por "—" para ficar legível ao operador
  const friendly = result.text.replace(/\s{2,}/g, " ").trim();
  return { text: friendly, missing: result.missing };
}
