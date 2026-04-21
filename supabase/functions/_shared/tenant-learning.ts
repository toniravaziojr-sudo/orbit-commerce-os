// ============================================================
// TENANT LEARNING MEMORY — Helpers compartilhados (Fase 1)
// Usado por ai-support-chat (leitura + captura) e
// ai-learning-aggregator (escrita/promoção)
// ============================================================

export type LearningEventType =
  | "continuity"
  | "cart_created"
  | "checkout_generated"
  | "order_paid"
  | "handoff_success"
  | "complaint"
  | "human_correction_negative"
  | "human_correction_positive";

export const EVENT_WEIGHTS: Record<LearningEventType, number> = {
  continuity: 1,
  cart_created: 5,
  checkout_generated: 10,
  order_paid: 25,
  handoff_success: 8,
  complaint: -20,
  human_correction_negative: -15,
  human_correction_positive: 10,
};

export interface CaptureEventArgs {
  tenant_id: string;
  ai_agent?: string;
  conversation_id?: string | null;
  event_type: LearningEventType;
  customer_message?: string | null;
  ai_response?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Captura um evento de aprendizado de forma fire-and-forget (não bloqueia).
 * Usado dentro de loops do ai-support-chat para não impactar latência.
 */
export async function captureLearningEvent(
  supabase: any,
  args: CaptureEventArgs,
): Promise<void> {
  try {
    const weight = EVENT_WEIGHTS[args.event_type] ?? 0;
    await supabase.from("tenant_learning_events").insert({
      tenant_id: args.tenant_id,
      ai_agent: args.ai_agent ?? "support",
      conversation_id: args.conversation_id ?? null,
      event_type: args.event_type,
      weight,
      customer_message: args.customer_message ?? null,
      ai_response: args.ai_response ?? null,
      metadata: args.metadata ?? {},
    });
  } catch (e) {
    console.warn("[tenant-learning] capture error (non-fatal):", e);
  }
}

/**
 * Normaliza texto para comparação semântica leve (Fase 1).
 * Lowercase + remove acentos + remove pontuação + colapsa espaços.
 */
export function normalizeText(input: string): string {
  return (input || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface LearningHit {
  id: string;
  learning_type: string;
  pattern_text: string;
  response_text: string | null;
  success_score: number;
  evidence_count: number;
  similarity: number;
}

/**
 * Busca os top N aprendizados ativos relevantes para a mensagem atual.
 * Usa full-text search em portugues (pattern_normalized).
 */
export async function getRelevantLearning(
  supabase: any,
  tenantId: string,
  queryText: string,
  aiAgent = "support",
  limit = 5,
): Promise<LearningHit[]> {
  try {
    if (!queryText || queryText.trim().length < 3) return [];
    const { data, error } = await supabase.rpc("get_relevant_tenant_learning", {
      p_tenant_id: tenantId,
      p_query_text: queryText,
      p_ai_agent: aiAgent,
      p_limit: limit,
    });
    if (error) {
      console.warn("[tenant-learning] read error:", error.message);
      return [];
    }
    return (data || []) as LearningHit[];
  } catch (e) {
    console.warn("[tenant-learning] read exception:", e);
    return [];
  }
}

/**
 * Formata o bloco de aprendizado para injetar no system prompt.
 * Mantém enxuto: max ~800 tokens estimados.
 */
export function formatLearningForPrompt(hits: LearningHit[]): string {
  if (!hits || hits.length === 0) return "";

  const byType: Record<string, LearningHit[]> = {};
  for (const h of hits) {
    (byType[h.learning_type] ||= []).push(h);
  }

  const lines: string[] = [
    "\n\n### 📚 Padrões aprendidos deste negócio (use quando aplicável):",
  ];

  if (byType.faq?.length) {
    lines.push("\n**Perguntas frequentes deste tenant:**");
    for (const h of byType.faq.slice(0, 3)) {
      lines.push(
        `- "${truncate(h.pattern_text, 90)}" → ${truncate(h.response_text || "", 160)}`,
      );
    }
  }

  if (byType.objection?.length) {
    lines.push("\n**Objeções recorrentes e abordagem que destrava:**");
    for (const h of byType.objection.slice(0, 3)) {
      lines.push(
        `- Cliente diz: "${truncate(h.pattern_text, 70)}" → responda na linha de: "${truncate(h.response_text || "", 160)}"`,
      );
    }
  }

  if (byType.winning_response?.length) {
    lines.push("\n**Abordagens que mais avançam a conversa neste negócio:**");
    for (const h of byType.winning_response.slice(0, 2)) {
      lines.push(`- ${truncate(h.response_text || h.pattern_text, 200)}`);
    }
  }

  lines.push(
    "\nEsses padrões são sugestivos, não roteirizados. Adapte ao contexto da conversa atual.",
  );

  return lines.join("\n");
}

/**
 * Marca aprendizados como usados (telemetria assíncrona).
 */
export async function markLearningUsed(
  supabase: any,
  ids: string[],
): Promise<void> {
  if (!ids || ids.length === 0) return;
  try {
    await supabase.rpc("mark_learning_used", { p_learning_ids: ids });
  } catch (e) {
    console.warn("[tenant-learning] mark_used error:", e);
  }
}

function truncate(s: string, n: number): string {
  if (!s) return "";
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
