import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface LiveStream {
  id: string;
  tenant_id: string;
  page_id: string;
  live_video_id: string | null;
  stream_url: string | null;
  secure_stream_url: string | null;
  title: string | null;
  description: string | null;
  status: string;
  planned_start_time: string | null;
  started_at: string | null;
  ended_at: string | null;
  viewer_count: number;
  metadata: Record<string, any>;
  created_at: string;
}

interface CreateLiveParams {
  pageId: string;
  title?: string;
  description?: string;
  plannedStartTime?: string;
}

export function useMetaLives() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Lista de lives
  const streamsQuery = useQuery({
    queryKey: ["meta-live-streams", tenantId],
    queryFn: async (): Promise<LiveStream[]> => {
      const { data, error } = await supabase.functions.invoke("meta-live-create", {
        body: { action: "list", tenantId },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro ao listar lives");
      return data.data;
    },
    enabled: !!tenantId && !!session,
  });

  // Criar live
  const createMutation = useMutation({
    mutationFn: async (params: CreateLiveParams) => {
      const { data, error } = await supabase.functions.invoke("meta-live-create", {
        body: { action: "create", tenantId, ...params },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro ao criar live");
      return data.data;
    },
    onSuccess: () => {
      toast.success("Transmissão criada!");
      queryClient.invalidateQueries({ queryKey: ["meta-live-streams"] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Go live
  const goLiveMutation = useMutation({
    mutationFn: async (streamId: string) => {
      const { data, error } = await supabase.functions.invoke("meta-live-manage", {
        body: { action: "go_live", tenantId, streamId },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro ao iniciar");
      return data.data;
    },
    onSuccess: () => {
      toast.success("Transmissão ao vivo iniciada!");
      queryClient.invalidateQueries({ queryKey: ["meta-live-streams"] });
    },
    onError: (err) => toast.error(err.message),
  });

  // End live
  const endMutation = useMutation({
    mutationFn: async (streamId: string) => {
      const { data, error } = await supabase.functions.invoke("meta-live-manage", {
        body: { action: "end", tenantId, streamId },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro ao encerrar");
      return data.data;
    },
    onSuccess: () => {
      toast.success("Transmissão encerrada");
      queryClient.invalidateQueries({ queryKey: ["meta-live-streams"] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Check status
  const checkStatusMutation = useMutation({
    mutationFn: async (streamId: string) => {
      const { data, error } = await supabase.functions.invoke("meta-live-manage", {
        body: { action: "status", tenantId, streamId },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro ao verificar status");
      return data.data;
    },
  });

  return {
    streams: streamsQuery.data || [],
    isLoading: streamsQuery.isLoading,
    refetch: streamsQuery.refetch,
    
    create: createMutation.mutate,
    isCreating: createMutation.isPending,
    
    goLive: goLiveMutation.mutate,
    isGoingLive: goLiveMutation.isPending,
    
    endStream: endMutation.mutate,
    isEnding: endMutation.isPending,
    
    checkStatus: checkStatusMutation.mutateAsync,
  };
}
