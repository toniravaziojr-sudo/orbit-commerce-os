import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type LearningStatus = "suggested" | "active" | "paused" | "archived";
export type LearningCategory =
  | "produto" | "publico" | "orcamento" | "funil" | "criativo"
  | "copy" | "oferta" | "performance" | "restricao" | "tracking" | "outro";

export interface AdsAILearning {
  id: string;
  tenant_id: string;
  title: string;
  description: string | null;
  category: LearningCategory;
  status: LearningStatus;
  source_type: "approval" | "rejection" | "adjustment" | "manual" | "system" | "user_feedback";
  source_action_id: string | null;
  source_plan_id: string | null;
  source_analysis_run_id: string | null;
  source_feedback_id: string | null;
  evidence_count: number;
  confidence: number;
  last_used_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export const LEARNING_CATEGORY_LABELS: Record<LearningCategory, string> = {
  produto: "Produto",
  publico: "Público",
  orcamento: "Orçamento",
  funil: "Funil",
  criativo: "Criativo",
  copy: "Copy",
  oferta: "Oferta",
  performance: "Performance",
  restricao: "Restrição",
  tracking: "Tracking",
  outro: "Outro",
};

export const LEARNING_STATUS_LABELS: Record<LearningStatus, string> = {
  suggested: "Sugerido",
  active: "Ativo",
  paused: "Pausado",
  archived: "Arquivado",
};

export function useAdsAILearnings() {
  const { currentTenant } = useAuth();
  const qc = useQueryClient();
  const tenantId = currentTenant?.id;

  const list = useQuery({
    queryKey: ["ads-ai-learnings", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await (supabase as any)
        .from("ads_ai_learnings")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("status", { ascending: true })
        .order("confidence", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as AdsAILearning[];
    },
    enabled: !!tenantId,
  });

  const create = useMutation({
    mutationFn: async (input: { title: string; description?: string; category: LearningCategory; status?: "active" | "suggested" }) => {
      if (!tenantId) throw new Error("no_tenant");
      const { error } = await (supabase as any).from("ads_ai_learnings").insert({
        tenant_id: tenantId,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        category: input.category,
        status: input.status || "active",
        source_type: "manual",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-ai-learnings", tenantId] });
      toast.success("Aprendizado criado.");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao criar aprendizado."),
  });

  const update = useMutation({
    mutationFn: async (input: { id: string; title?: string; description?: string | null; category?: LearningCategory }) => {
      const patch: any = {};
      if (input.title !== undefined) patch.title = input.title.trim();
      if (input.description !== undefined) patch.description = input.description?.trim() || null;
      if (input.category !== undefined) patch.category = input.category;
      const { error } = await (supabase as any).from("ads_ai_learnings").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-ai-learnings", tenantId] });
      toast.success("Aprendizado atualizado.");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar."),
  });

  const setStatus = useMutation({
    mutationFn: async (input: { id: string; status: LearningStatus }) => {
      const patch: any = { status: input.status };
      if (input.status === "archived") patch.archived_at = new Date().toISOString();
      const { error } = await (supabase as any).from("ads_ai_learnings").update(patch).eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-ai-learnings", tenantId] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao alterar status."),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("ads_ai_learnings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ads-ai-learnings", tenantId] });
      toast.success("Aprendizado removido.");
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover."),
  });

  return { learnings: list.data || [], isLoading: list.isLoading, create, update, setStatus, remove };
}
