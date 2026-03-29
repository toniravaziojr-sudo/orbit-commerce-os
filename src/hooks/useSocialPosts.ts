import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { showErrorToast } from '@/lib/error-toast';

export interface SocialPostEntry {
  id: string;
  platform: string;
  status: string;
  published_at: string | null;
  scheduled_at: string | null;
  attempt_count: number | null;
  last_error_code: string | null;
  last_error_message: string | null;
  next_retry_at: string | null;
  execution_log: any[] | null;
  warning_flags: any[] | null;
  meta_post_id: string | null;
  created_at: string;
}

export function useSocialPosts(calendarItemId: string | undefined) {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ["social-posts", calendarItemId],
    queryFn: async () => {
      if (!calendarItemId || !currentTenant?.id) return [];

      const { data, error } = await supabase
        .from("social_posts")
        .select("id, platform, status, published_at, scheduled_at, attempt_count, last_error_code, last_error_message, next_retry_at, execution_log, warning_flags, meta_post_id, created_at")
        .eq("calendar_item_id", calendarItemId)
        .eq("tenant_id", currentTenant.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as SocialPostEntry[];
    },
    enabled: !!calendarItemId && !!currentTenant?.id,
  });
}

export function useSocialPostActions() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const performAction = useMutation({
    mutationFn: async ({ action, socialPostId, newPostId, reason }: {
      action: "retry_platform" | "dismiss_failure" | "supersede";
      socialPostId: string;
      newPostId?: string;
      reason?: string;
    }) => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase.functions.invoke("media-social-post-actions", {
        body: {
          action,
          social_post_id: socialPostId,
          tenant_id: currentTenant.id,
          new_post_id: newPostId,
          reason,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao executar ação");
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
      queryClient.invalidateQueries({ queryKey: ["media-calendar-items"] });

      const messages: Record<string, string> = {
        retry_platform: "Publicação reenviada!",
        dismiss_failure: "Falha encerrada.",
        supersede: "Publicação substituída.",
      };
      toast.success(messages[variables.action] || "Ação concluída!");
    },
    onError: (error: any) => {
      onError: (err) => showErrorToast(err, { module: 'social', action: 'processar' }),
    },
  });

  return { performAction };
}
