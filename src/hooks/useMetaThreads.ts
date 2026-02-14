import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useMetaConnection } from "@/hooks/useMetaConnection";
import { toast } from "sonner";

interface ThreadsPost {
  id: string;
  text: string;
  timestamp: string;
  media_type: string;
  media_url?: string;
  permalink: string;
  is_quote_post: boolean;
}

interface ThreadsInsights {
  views: number;
  likes: number;
  replies: number;
  reposts: number;
  quotes: number;
}

interface PublishParams {
  text?: string;
  imageUrl?: string;
  videoUrl?: string;
  linkAttachment?: string;
  replyToId?: string;
}

export function useMetaThreads() {
  const { currentTenant } = useAuth();
  const { isConnected, connection } = useMetaConnection();
  const queryClient = useQueryClient();

  const hasThreads = isConnected && connection?.scopePacks?.includes("threads");
  const threadsProfile = connection?.assets?.threads_profile;

  // Lista posts recentes
  const postsQuery = useQuery({
    queryKey: ["meta-threads-posts", currentTenant?.id],
    queryFn: async (): Promise<ThreadsPost[]> => {
      const { data, error } = await supabase.functions.invoke("meta-threads-publish", {
        body: { tenantId: currentTenant!.id, action: "list" },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro ao listar posts");
      return data.data;
    },
    enabled: !!currentTenant?.id && hasThreads,
    staleTime: 60000,
  });

  // Publicar post
  const publishMutation = useMutation({
    mutationFn: async (params: PublishParams) => {
      const { data, error } = await supabase.functions.invoke("meta-threads-publish", {
        body: { tenantId: currentTenant!.id, ...params },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro ao publicar");
      return data.data;
    },
    onSuccess: () => {
      toast.success("Publicado no Threads!");
      queryClient.invalidateQueries({ queryKey: ["meta-threads-posts"] });
    },
    onError: (err) => toast.error(err.message),
  });

  // Insights de um post
  const getPostInsights = async (postId: string): Promise<ThreadsInsights> => {
    const { data, error } = await supabase.functions.invoke("meta-threads-insights", {
      body: { tenantId: currentTenant!.id, action: "post_insights", postId },
    });
    if (error || !data?.success) throw new Error(data?.error || "Erro ao buscar insights");
    return data.data;
  };

  // Insights do perfil
  const profileInsightsQuery = useQuery({
    queryKey: ["meta-threads-profile-insights", currentTenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("meta-threads-insights", {
        body: { tenantId: currentTenant!.id, action: "profile_insights" },
      });
      if (error || !data?.success) throw new Error(data?.error || "Erro ao buscar insights");
      return data.data;
    },
    enabled: !!currentTenant?.id && hasThreads,
    staleTime: 300000, // 5 min
  });

  return {
    // Status
    hasThreads,
    threadsProfile,

    // Posts
    posts: postsQuery.data ?? [],
    isLoadingPosts: postsQuery.isLoading,

    // Publish
    publish: publishMutation.mutate,
    isPublishing: publishMutation.isPending,

    // Insights
    getPostInsights,
    profileInsights: profileInsightsQuery.data ?? null,
    isLoadingInsights: profileInsightsQuery.isLoading,
  };
}
