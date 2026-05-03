import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ContextHealthScores {
  tenant_id: string;
  brand_context_score: number;
  language_score: number;
  objections_score: number;
  knowledge_base_score: number;
  products_semantics_score: number;
  approved_insights_score: number;
  snapshot_freshness_score: number;
  channel_config_score: number;
  general_ai_config_score: number;
  overall_score: number;
  products_total_active: number;
  products_with_semantics: number;
}

export interface ContextHealthGap {
  dimension: string;
  label: string;
  origin: string;
  current_status: string;
  impact: string;
  recommended_action: string;
  priority: "alta" | "media" | "baixa";
  score: number;
}

const DIM_META: Array<{
  key: keyof ContextHealthScores;
  label: string;
  origin: string;
  impact: string;
  action: string;
}> = [
  { key: "brand_context_score", label: "Contexto de marca", origin: "Cadastro de marca",
    impact: "IA não conhece claims proibidas, tom oficial nem foco da marca.",
    action: "Gerar contexto de marca com IA" },
  { key: "language_score", label: "Linguagem do nicho", origin: "Dicionário de linguagem",
    impact: "IA usa termos genéricos e pode falar fora do vocabulário do público.",
    action: "Gerar dicionário de linguagem" },
  { key: "objections_score", label: "Objeções padrão", origin: "Mapa de objeções",
    impact: "IA improvisa em dúvidas comuns (preço, prazo, devolução).",
    action: "Configurar objeções comuns" },
  { key: "knowledge_base_score", label: "Base de conhecimento (FAQ/políticas)", origin: "Knowledge Base",
    impact: "IA não responde políticas formais com fonte (frete, troca, garantia).",
    action: "Criar FAQ/políticas" },
  { key: "products_semantics_score", label: "Semântica comercial dos produtos", origin: "Catálogo + payload comercial",
    impact: "IA pode ignorar produtos complementares e vender só o óbvio.",
    action: "Inferir semântica comercial dos produtos" },
  { key: "approved_insights_score", label: "Insights aprovados (90d)", origin: "Central de Insights",
    impact: "IA não aprende com padrões observados em conversas reais.",
    action: "Revisar insights pendentes" },
  { key: "snapshot_freshness_score", label: "Frescor do snapshot do tenant", origin: "Snapshot do contexto",
    impact: "IA opera com visão desatualizada do negócio.",
    action: "Atualizar snapshot do tenant" },
  { key: "channel_config_score", label: "Configuração por canal", origin: "Config de canais",
    impact: "Cada canal (WhatsApp, e-mail, web) sem regras específicas.",
    action: "Configurar regras por canal" },
  { key: "general_ai_config_score", label: "Configuração geral da IA", origin: "Config principal",
    impact: "Persona, prompt-base e modo vendas incompletos.",
    action: "Completar configuração geral da IA" },
];

export function useAiContextHealth() {
  const { currentTenant } = useAuth();

  const scoresQuery = useQuery({
    queryKey: ["ai-context-health", currentTenant?.id],
    queryFn: async (): Promise<ContextHealthScores | null> => {
      if (!currentTenant?.id) return null;
      const { data, error } = await supabase
        .from("ai_context_health_view" as any)
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!currentTenant?.id,
    staleTime: 60_000,
  });

  const gaps: ContextHealthGap[] = scoresQuery.data
    ? DIM_META.map((m) => {
        const score = (scoresQuery.data as any)[m.key] as number;
        const priority: ContextHealthGap["priority"] =
          score < 30 ? "alta" : score < 70 ? "media" : "baixa";
        const status = score >= 80 ? "Saudável" : score >= 40 ? "Parcial" : "Vazio/Crítico";
        return {
          dimension: m.key,
          label: m.label,
          origin: m.origin,
          current_status: status,
          impact: m.impact,
          recommended_action: m.action,
          priority,
          score,
        };
      })
        .filter((g) => g.score < 80)
        .sort((a, b) => a.score - b.score)
    : [];

  return {
    scores: scoresQuery.data,
    gaps,
    isLoading: scoresQuery.isLoading,
    error: scoresQuery.error,
    refetch: scoresQuery.refetch,
  };
}

export interface ProductPreviewItem {
  product_id: string;
  product_name: string;
  product_role: string | null;
  customer_needs: string[];
  use_cases: string[];
  is_pack_or_bundle: boolean;
  base_product_id: string | null;
  base_product_name: string | null;
  complementary_product_ids: string[];
  confidence_score: number;
  reasoning: string;
  gap?: string;
}

export async function fetchProductIntelligencePreview(input: {
  tenant_id: string;
  limit?: number;
  filter?: "all" | "no_semantics" | "low_confidence";
}) {
  const { data, error } = await supabase.functions.invoke("ai-context-product-preview", {
    body: input,
  });
  if (error) throw error;
  return data as {
    success: boolean;
    items: ProductPreviewItem[];
    segment: string | null;
    total: number;
    ai_used: boolean;
    error?: string;
  };
}
