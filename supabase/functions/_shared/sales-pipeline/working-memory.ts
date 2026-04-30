// ============================================================
// Pipeline F2 — Onda 2 — Working Memory
//
// Camada de leitura/escrita sobre conversation_sales_state (Onda 1).
// É a fonte única de verdade da memória persistente da conversa de vendas.
//
// Responsabilidades:
//   - load(): carregar (ou criar) o registro 1:1 da conversa
//   - hashQuestion(): gerar hash determinístico anti-repetição
//   - asked(): testa se uma pergunta-âncora já foi feita
//   - markAsked(): registra hash de pergunta feita
//   - record(): persiste alterações pontuais (presented_families,
//     customer_declared_pain, upsell, signals etc.)
//
// Tudo via service_role (chamado dentro de Edge Function).
// ============================================================

export type SalesStage =
  | "social_only"
  | "exploring"
  | "needs_known"
  | "evaluating"
  | "buying_intent"
  | "closing"
  | "post_sale";

export const SALES_STAGES: SalesStage[] = [
  "social_only",
  "exploring",
  "needs_known",
  "evaluating",
  "buying_intent",
  "closing",
  "post_sale",
];

export interface ConversationSalesState {
  id: string;
  conversation_id: string;
  tenant_id: string;
  stage: SalesStage;
  last_greeting_at: string | null;
  presented_families: string[];
  presented_product_ids: string[];
  customer_named_families: string[];
  customer_declared_pain: string | null;
  asked_question_hashes: string[];
  commercial_signals: Record<string, unknown>;
  upsell_offered_count: number;
  upsell_declined: boolean;
  extras: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Cliente Supabase mínimo: tipamos só o que usamos para evitar acoplar
// com a versão do supabase-js no edge runtime.
export interface SupaLike {
  from: (table: string) => any;
}

const TABLE = "conversation_sales_state";

/**
 * Carrega o estado da conversa. Se não existir, cria com defaults.
 * Sempre retorna um registro válido.
 */
export async function loadSalesState(
  supabase: SupaLike,
  args: { conversationId: string; tenantId: string }
): Promise<ConversationSalesState> {
  const { conversationId, tenantId } = args;

  const { data: existing, error: selErr } = await supabase
    .from(TABLE)
    .select("*")
    .eq("conversation_id", conversationId)
    .maybeSingle();

  if (selErr) {
    console.warn("[working-memory] select error:", selErr.message);
  }

  if (existing) return existing as ConversationSalesState;

  // Cria — se duas requisições concorrerem, o UNIQUE em conversation_id
  // evita duplicata; tratamos o conflito relendo.
  const { data: inserted, error: insErr } = await supabase
    .from(TABLE)
    .insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      stage: "exploring" as SalesStage,
    })
    .select("*")
    .single();

  if (insErr) {
    // 23505 = unique_violation → já foi criado em paralelo, relê.
    if ((insErr as { code?: string }).code === "23505") {
      const { data: again } = await supabase
        .from(TABLE)
        .select("*")
        .eq("conversation_id", conversationId)
        .single();
      if (again) return again as ConversationSalesState;
    }
    throw new Error(`[working-memory] insert failed: ${insErr.message}`);
  }

  return inserted as ConversationSalesState;
}

// ------------------------------------------------------------
// Anti-repetição de perguntas-âncora
// ------------------------------------------------------------

/**
 * Hash leve e determinístico (FNV-1a 32-bit) de uma pergunta normalizada.
 * Não usamos crypto pesado — só queremos comparar "já perguntei isso?".
 */
export function hashQuestion(text: string): string {
  const normalized = (text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  let h = 0x811c9dc5;
  for (let i = 0; i < normalized.length; i++) {
    h ^= normalized.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return `q_${h.toString(16)}`;
}

export function alreadyAsked(state: ConversationSalesState, questionText: string): boolean {
  return state.asked_question_hashes.includes(hashQuestion(questionText));
}

// ------------------------------------------------------------
// Update parcial idempotente
// ------------------------------------------------------------

export interface SalesStatePatch {
  stage?: SalesStage;
  last_greeting_at?: string | null;
  add_presented_families?: string[];
  add_presented_product_ids?: string[];
  add_customer_named_families?: string[];
  customer_declared_pain?: string | null;
  add_asked_question_hashes?: string[];
  merge_commercial_signals?: Record<string, unknown>;
  inc_upsell_offered_count?: number;
  upsell_declined?: boolean;
  merge_extras?: Record<string, unknown>;
}

function uniqueMerge<T>(base: T[], extra?: T[]): T[] {
  if (!extra || extra.length === 0) return base;
  const set = new Set<T>(base);
  for (const v of extra) if (v != null) set.add(v);
  return Array.from(set);
}

/**
 * Aplica um patch leve sobre o registro. Faz merge local e grava.
 * Retorna o estado pós-update.
 */
export async function patchSalesState(
  supabase: SupaLike,
  current: ConversationSalesState,
  patch: SalesStatePatch
): Promise<ConversationSalesState> {
  const next: Partial<ConversationSalesState> = {};

  if (patch.stage && patch.stage !== current.stage) next.stage = patch.stage;
  if (patch.last_greeting_at !== undefined) next.last_greeting_at = patch.last_greeting_at;
  if (patch.customer_declared_pain !== undefined) {
    next.customer_declared_pain = patch.customer_declared_pain;
  }
  if (patch.upsell_declined !== undefined) next.upsell_declined = patch.upsell_declined;

  const mergedFamilies = uniqueMerge(current.presented_families, patch.add_presented_families);
  if (mergedFamilies.length !== current.presented_families.length) {
    next.presented_families = mergedFamilies;
  }
  const mergedProducts = uniqueMerge(current.presented_product_ids, patch.add_presented_product_ids);
  if (mergedProducts.length !== current.presented_product_ids.length) {
    next.presented_product_ids = mergedProducts;
  }
  const mergedNamed = uniqueMerge(current.customer_named_families, patch.add_customer_named_families);
  if (mergedNamed.length !== current.customer_named_families.length) {
    next.customer_named_families = mergedNamed;
  }
  const mergedHashes = uniqueMerge(current.asked_question_hashes, patch.add_asked_question_hashes);
  if (mergedHashes.length !== current.asked_question_hashes.length) {
    next.asked_question_hashes = mergedHashes;
  }

  if (patch.merge_commercial_signals) {
    next.commercial_signals = { ...current.commercial_signals, ...patch.merge_commercial_signals };
  }
  if (patch.merge_extras) {
    next.extras = { ...current.extras, ...patch.merge_extras };
  }
  if (patch.inc_upsell_offered_count && patch.inc_upsell_offered_count > 0) {
    next.upsell_offered_count = current.upsell_offered_count + patch.inc_upsell_offered_count;
  }

  if (Object.keys(next).length === 0) return current;

  const { data, error } = await supabase
    .from(TABLE)
    .update(next)
    .eq("id", current.id)
    .select("*")
    .single();

  if (error) {
    console.warn("[working-memory] patch failed:", error.message);
    return { ...current, ...next } as ConversationSalesState;
  }
  return data as ConversationSalesState;
}
