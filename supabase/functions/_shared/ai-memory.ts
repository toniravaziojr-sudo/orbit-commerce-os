/**
 * Shared AI Memory Helper (v1.0.0)
 * Used by all AI edge functions to retrieve and inject memory context
 */

export interface AIMemory {
  id: string;
  category: string;
  content: string;
  importance: number;
  scope: string;
  created_at: string;
}

export interface ConversationSummary {
  summary: string;
  key_topics: string[];
  key_decisions: any;
  created_at: string;
}

/**
 * Fetches memories and conversation summaries for an AI agent,
 * then builds a context string to inject into the system prompt.
 */
export async function getMemoryContext(
  supabase: any,
  tenantId: string,
  userId: string,
  aiAgent: string,
  options?: { memoryLimit?: number; summaryLimit?: number }
): Promise<string> {
  const memoryLimit = options?.memoryLimit ?? 20;
  const summaryLimit = options?.summaryLimit ?? 5;

  const [memoriesResult, summariesResult] = await Promise.all([
    supabase.rpc("get_ai_memories", {
      p_tenant_id: tenantId,
      p_user_id: userId,
      p_ai_agent: aiAgent,
      p_limit: memoryLimit,
    }),
    supabase.rpc("get_recent_conversation_summaries", {
      p_tenant_id: tenantId,
      p_user_id: userId,
      p_ai_agent: aiAgent,
      p_limit: summaryLimit,
    }),
  ]);

  const memories: AIMemory[] = memoriesResult.data || [];
  const summaries: ConversationSummary[] = summariesResult.data || [];

  if (memories.length === 0 && summaries.length === 0) {
    return "";
  }

  let context = "\n\n## 🧠 MEMÓRIA PERSISTENTE\n\n";

  if (memories.length > 0) {
    const tenantMemories = memories.filter(m => m.scope === "tenant");
    const userMemories = memories.filter(m => m.scope === "user");

    if (tenantMemories.length > 0) {
      context += "### Fatos do Negócio (compartilhados)\n";
      for (const m of tenantMemories) {
        context += `- [${m.category}] ${m.content}\n`;
      }
      context += "\n";
    }

    if (userMemories.length > 0) {
      context += "### Preferências do Usuário (pessoais)\n";
      for (const m of userMemories) {
        context += `- [${m.category}] ${m.content}\n`;
      }
      context += "\n";
    }
  }

  if (summaries.length > 0) {
    context += "### Conversas Anteriores (resumos recentes)\n";
    for (const s of summaries) {
      const date = new Date(s.created_at).toLocaleDateString("pt-BR");
      const topics = s.key_topics?.length > 0 ? ` (${s.key_topics.join(", ")})` : "";
      context += `- [${date}${topics}] ${s.summary}\n`;
    }
    context += "\n";
  }

  context += `**REGRAS DE MEMÓRIA:**
- Use essas informações para personalizar suas respostas
- NÃO repita as memórias ao usuário a menos que seja relevante
- Se o usuário corrigir um fato memorizado, aceite a correção
- Quando o usuário mencionar preferências ou fatos importantes sobre o negócio, memorize-os

`;

  return context;
}

/**
 * Builds the memory extraction prompt for the AI to identify what should be memorized
 */
export function buildMemoryExtractionPrompt(): string {
  return `
Ao final de cada conversa significativa (3+ mensagens), identifique FATOS IMPORTANTES que devem ser memorizados.

Categorize cada fato como:
- **business_fact**: Informações sobre o negócio (nicho, público-alvo, diferencial, margem)
- **preference**: Preferências do usuário (tom de voz, formato de relatório, frequência)
- **decision**: Decisões tomadas (estratégia definida, orçamento aprovado)
- **product_insight**: Insights sobre produtos (best-sellers, sazonalidade, preço ideal)
- **persona**: Características da persona/avatar do cliente

Para cada fato, atribua uma importância de 1-10:
- 10: Crítico para o negócio (nicho, público, diferencial)
- 7-9: Muito relevante (preferências operacionais, decisões estratégicas)
- 4-6: Relevante (contexto geral, observações)
- 1-3: Menor importância (detalhes temporários)

Determine o escopo:
- **tenant**: Informações sobre o NEGÓCIO (compartilhadas entre todos os usuários da loja)
- **user**: Preferências PESSOAIS do usuário atual
`;
}
