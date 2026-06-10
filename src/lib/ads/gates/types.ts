// =============================================================================
// Tipos compartilhados pelos gates do Gestor de Tráfego IA
// =============================================================================

export type GateSeverity = "info" | "warning" | "blocker";

export interface GateIssue {
  /** Campo canônico do plano (ex.: "adset.0.conversion_event"). */
  field: string;
  /** Nível: blocker bloqueia aprovação; warning não bloqueia. */
  severity: GateSeverity;
  /** Mensagem em linguagem simples PT-BR pronta para a UI. */
  message: string;
  /** Categoria humana do nó: "Campanha", "Conjunto 1", "Anúncio 2"… */
  node: string;
  /** Classe do campo: obrigatório, recomendado, opcional, requires_user_input. */
  kind: "required" | "recommended" | "optional" | "requires_user_input";
}

export interface GateResult {
  passed: boolean;
  blockers: GateIssue[];
  warnings: GateIssue[];
  summary: string | null;
}

export const EMPTY_GATE: GateResult = {
  passed: true,
  blockers: [],
  warnings: [],
  summary: null,
};
