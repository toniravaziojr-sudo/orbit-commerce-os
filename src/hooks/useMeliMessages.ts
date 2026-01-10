import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface MeliMessage {
  id: string;
  message_type: string;
  status: string;
  buyer_nickname: string | null;
  question_text: string | null;
  answer_text: string | null;
  answered_at: string | null;
  item_title: string | null;
  item_thumbnail: string | null;
  received_at: string;
  created_at: string;
  external_message_id: string;
  external_item_id: string | null;
  metadata: any;
}

interface UseMeliMessagesParams {
  status?: string;
  messageType?: string;
  page?: number;
  pageSize?: number;
}

export function useMeliMessages({ 
  status, 
  messageType,
  page = 1, 
  pageSize = 20 
}: UseMeliMessagesParams = {}) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ["meli-messages", currentTenant?.id, status, messageType, page, pageSize],
    queryFn: async () => {
      if (!currentTenant?.id) {
        return { messages: [], total: 0 };
      }

      let query = supabase
        .from("marketplace_messages")
        .select("*", { count: "exact" })
        .eq("tenant_id", currentTenant.id)
        .eq("marketplace", "mercadolivre")
        .order("received_at", { ascending: false });

      if (status && status !== "all") {
        query = query.eq("status", status);
      }

      if (messageType && messageType !== "all") {
        query = query.eq("message_type", messageType);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        messages: (data || []) as MeliMessage[],
        total: count || 0,
      };
    },
    enabled: !!currentTenant?.id,
  });

  // Sincronizar perguntas
  const syncMutation = useMutation({
    mutationFn: async (fullSync: boolean = false) => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("meli-sync-questions", {
        body: { tenantId: currentTenant.id, fullSync },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao sincronizar");
      }

      return data;
    },
    onSuccess: (data) => {
      toast.success(`Sincronização concluída: ${data.synced} mensagens`);
      queryClient.invalidateQueries({ queryKey: ["meli-messages"] });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao sincronizar mensagens");
    },
  });

  // Responder pergunta
  const answerMutation = useMutation({
    mutationFn: async ({ messageId, answer }: { messageId: string; answer: string }) => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("meli-answer-question", {
        body: { tenantId: currentTenant.id, messageId, answer },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao enviar resposta");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Resposta enviada com sucesso");
      queryClient.invalidateQueries({ queryKey: ["meli-messages"] });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao enviar resposta");
    },
  });

  return {
    messages: messagesQuery.data?.messages || [],
    total: messagesQuery.data?.total || 0,
    isLoading: messagesQuery.isLoading,
    isError: messagesQuery.isError,
    refetch: messagesQuery.refetch,
    sync: syncMutation.mutate,
    isSyncing: syncMutation.isPending,
    answerQuestion: answerMutation.mutate,
    isAnswering: answerMutation.isPending,
  };
}
