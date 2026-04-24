/**
 * Shared AI Brain Context Helper (v1.0.0)
 * 
 * Lê a view ai_brain_active_view e formata os insights aprovados
 * como bloco de contexto para injetar no system prompt dos 4 agentes:
 * - vendas  (ai-support-chat em modo vendas)
 * - auxiliar (command-assistant-chat)
 * - landing (ai-landing-page-generate*)
 * - trafego (ads-autopilot-*)
 * 
 * Fluxo: captura → consolidação (cron) → aprovação humana (UI) → injeção aqui.
 */

export type BrainAgent = "vendas" | "auxiliar" | "landing" | "trafego";

export interface BrainInsight {
  id: string;
  insight_type: string;
  title: string;
  summary: string;
  recommendation: string | null;
  variations: string[] | null;
  product_id: string | null;
}

const SCOPE_COLUMN: Record<BrainAgent, string> = {
  vendas: "scope_vendas",
  auxiliar: "scope_auxiliar",
  landing: "scope_landing",
  trafego: "scope_trafego",
};

/**
 * Busca insights ativos aprovados para o agente solicitado.
 */
export async function getBrainInsights(
  supabase: any,
  tenantId: string,
  agent: BrainAgent,
  options?: { limit?: number; productId?: string | null }
): Promise<BrainInsight[]> {
  if (!tenantId) return [];

  const limit = options?.limit ?? 15;
  const scopeCol = SCOPE_COLUMN[agent];

  try {
    let query = supabase
      .from("ai_brain_active_view")
      .select("id, insight_type, title, summary, recommendation, variations, product_id")
      .eq("tenant_id", tenantId)
      .eq(scopeCol, true)
      .order("approved_at", { ascending: false })
      .limit(limit);

    // Se o agente tem um produto em foco, prioriza insights daquele produto
    // (sem excluir os insights globais — traz ambos)
    if (options?.productId) {
      query = query.or(`product_id.is.null,product_id.eq.${options.productId}`);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[brain-context] query error:", error.message);
      return [];
    }
    return (data || []) as BrainInsight[];
  } catch (e) {
    console.error("[brain-context] fetch failed:", e);
    return [];
  }
}

/**
 * Formata os insights como bloco de texto para concatenar no system prompt.
 * Retorna string vazia se não houver insights (não pollui o prompt).
 */
export function formatBrainInsightsForPrompt(
  insights: BrainInsight[],
  agent: BrainAgent
): string {
  if (!insights || insights.length === 0) return "";

  const agentLabel: Record<BrainAgent, string> = {
    vendas: "atendimento e vendas",
    auxiliar: "gestão do negócio",
    landing: "criação de landing pages",
    trafego: "gestão de tráfego pago",
  };

  let block = `\n\n## 🧩 APRENDIZADOS DO NEGÓCIO (aprovados pelo dono)\n\n`;
  block += `Estes padrões foram identificados em conversas reais com clientes e aprovados para orientar ${agentLabel[agent]}. `;
  block += `Use-os como verdade operacional — eles refletem o que de fato acontece nesta loja.\n\n`;

  // Agrupa por tipo para dar hierarquia ao modelo
  const byType: Record<string, BrainInsight[]> = {};
  for (const ins of insights) {
    const t = ins.insight_type || "geral";
    byType[t] = byType[t] || [];
    byType[t].push(ins);
  }

  const TYPE_LABELS: Record<string, string> = {
    linguagem: "Linguagem dos clientes",
    dor: "Dores recorrentes",
    objecao: "Objeções comuns",
    desejo: "Desejos expressos",
    duvida: "Dúvidas frequentes",
    elogio: "Elogios recorrentes",
    caso_uso: "Casos de uso",
    sistema: "Padrão sistêmico",
  };

  for (const [type, items] of Object.entries(byType)) {
    const label = TYPE_LABELS[type] || type;
    block += `### ${label}\n`;
    for (const ins of items) {
      block += `- **${ins.title}** — ${ins.summary}`;
      if (ins.recommendation) {
        block += ` _Como agir:_ ${ins.recommendation}`;
      }
      if (ins.variations && ins.variations.length > 0) {
        const sample = ins.variations.slice(0, 3).map(v => `"${v}"`).join(", ");
        block += ` _Exemplos:_ ${sample}`;
      }
      block += `\n`;
    }
    block += `\n`;
  }

  block += `**Regra:** Quando um aprendizado acima for relevante ao contexto atual, aplique-o naturalmente — sem citá-lo explicitamente ao cliente.\n`;

  return block;
}

/**
 * Atalho: busca + formata. Usar quando o agente quer só a string final.
 */
export async function getBrainContextForPrompt(
  supabase: any,
  tenantId: string,
  agent: BrainAgent,
  options?: { limit?: number; productId?: string | null }
): Promise<string> {
  const insights = await getBrainInsights(supabase, tenantId, agent, options);
  return formatBrainInsightsForPrompt(insights, agent);
}
