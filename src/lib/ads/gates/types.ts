// =============================================================================
// Tipos compartilhados pelos gates do Gestor de Tráfego IA
//
// v2.1 (Onda C.3): GateIssue agora carrega `node_type` + `node_id`, separação
// entre `message` (user-friendly PT-BR) e `technical_reason`, e `suggested_action`
// para que a UI possa abrir o editor no nó/campo correto.
// =============================================================================

export type GateSeverity = "info" | "warning" | "blocker";

export type GateNodeType = "campaign" | "ad_set" | "ad" | "creative" | "platform";

export interface GateIssue {
  /** Tipo do nó a que esta validação pertence. */
  node_type: GateNodeType;
  /** Identificador do nó (index em string para ad_set/ad, ou nome lógico). */
  node_id: string | null;
  /** Rótulo humano do nó: "Campanha", "Conjunto 1", "Anúncio 2"… */
  node: string;
  /** Campo canônico do plano (ex.: "adset.0.conversion_event"). */
  field: string;
  /** Nível: blocker bloqueia aprovação; warning não bloqueia. */
  severity: GateSeverity;
  /** Mensagem em linguagem simples PT-BR pronta para a UI. */
  message: string;
  /** Detalhe técnico (não exibido para o usuário final). */
  technical_reason?: string | null;
  /** O que o usuário deve fazer (texto curto, opcional). */
  suggested_action?: string | null;
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
