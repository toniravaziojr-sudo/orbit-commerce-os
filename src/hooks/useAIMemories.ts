import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface AIMemory {
  id: string;
  tenant_id: string;
  user_id: string | null;
  ai_agent: string;
  category: string;
  content: string;
  importance: number;
  metadata: Record<string, any> | null;
  source_conversation_id: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConversationSummary {
  id: string;
  tenant_id: string;
  user_id: string;
  ai_agent: string;
  conversation_id: string;
  summary: string;
  key_topics: string[] | null;
  key_decisions: any;
  message_count: number | null;
  created_at: string;
}

export function useAIMemories() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const { data: memories = [], isLoading: isLoadingMemories } = useQuery({
    queryKey: ["ai-memories", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("ai_memories")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("importance", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as AIMemory[];
    },
    enabled: !!tenantId,
  });

  const { data: summaries = [], isLoading: isLoadingSummaries } = useQuery({
    queryKey: ["ai-summaries", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("ai_conversation_summaries")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as ConversationSummary[];
    },
    enabled: !!tenantId,
  });

  const deleteMemory = useMutation({
    mutationFn: async (memoryId: string) => {
      const { error } = await supabase
        .from("ai_memories")
        .delete()
        .eq("id", memoryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memories"] });
      toast.success("Memória removida");
    },
    onError: () => toast.error("Erro ao remover memória"),
  });

  const updateMemory = useMutation({
    mutationFn: async ({ id, content, importance, category }: { id: string; content: string; importance: number; category: string }) => {
      const { error } = await supabase
        .from("ai_memories")
        .update({ content, importance, category, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-memories"] });
      toast.success("Memória atualizada");
    },
    onError: () => toast.error("Erro ao atualizar memória"),
  });

  const deleteSummary = useMutation({
    mutationFn: async (summaryId: string) => {
      const { error } = await supabase
        .from("ai_conversation_summaries")
        .delete()
        .eq("id", summaryId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-summaries"] });
      toast.success("Resumo removido");
    },
    onError: () => toast.error("Erro ao remover resumo"),
  });

  return {
    memories,
    summaries,
    isLoadingMemories,
    isLoadingSummaries,
    deleteMemory: deleteMemory.mutate,
    updateMemory: updateMemory.mutate,
    deleteSummary: deleteSummary.mutate,
  };
}
