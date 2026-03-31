import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

export interface ThreadsConnectionData {
  threadsUserId: string | null;
  username: string | null;
  displayName: string | null;
  profilePictureUrl: string | null;
  connectedAt: string;
  tokenExpiresAt: string | null;
  isActive: boolean;
  lastError: string | null;
}

export function useThreadsConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["threads-connection", currentTenant?.id],
    queryFn: async (): Promise<{ isConnected: boolean; isExpired: boolean; connection: ThreadsConnectionData | null }> => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { data: conn, error } = await supabase
        .from("threads_connections" as any)
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .maybeSingle();

      if (error && (error as any).code !== "PGRST116") throw error;

      if (!conn) {
        return { isConnected: false, isExpired: false, connection: null };
      }

      const c = conn as any;
      const isExpired = c.token_expires_at ? new Date(c.token_expires_at) < new Date() : false;

      return {
        isConnected: !!c.is_active && !isExpired,
        isExpired,
        connection: {
          threadsUserId: c.threads_user_id,
          username: c.username,
          displayName: c.display_name,
          profilePictureUrl: c.profile_picture_url,
          connectedAt: c.connected_at,
          tokenExpiresAt: c.token_expires_at,
          isActive: c.is_active,
          lastError: c.last_error,
        },
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 30000,
  });

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Sessão inválida");
      }

      const { data, error } = await supabase.functions.invoke("threads-oauth-start", {
        body: { tenantId: currentTenant.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao iniciar conexão");
      }
      return data;
    },
    onSuccess: (data) => {
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.authUrl,
        "threads_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
      );

      // Listen for callback message
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "threads:connected") {
          window.removeEventListener("message", handleMessage);
          queryClient.invalidateQueries({ queryKey: ["threads-connection"] });
          if (event.data.success) {
            toast.success(`Threads conectado! (@${event.data.username || ""})`);
          } else {
            showErrorToast(new Error(event.data.error || "Falha ao conectar Threads"), { module: "threads", action: "conectar" });
          }
        }
      };
      window.addEventListener("message", handleMessage);

      // Check if popup was closed manually
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener("message", handleMessage);
          queryClient.invalidateQueries({ queryKey: ["threads-connection"] });
        }
      }, 500);
    },
    onError: (error) => showErrorToast(error, { module: "threads", action: "conectar" }),
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { error } = await supabase
        .from("threads_connections" as any)
        .update({ is_active: false, updated_at: new Date().toISOString() } as any)
        .eq("tenant_id", currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Threads desconectado");
      queryClient.invalidateQueries({ queryKey: ["threads-connection"] });
    },
    onError: (error) => showErrorToast(error, { module: "threads", action: "desconectar" }),
  });

  return {
    isConnected: statusQuery.data?.isConnected ?? false,
    isExpired: statusQuery.data?.isExpired ?? false,
    connection: statusQuery.data?.connection ?? null,
    isLoading: statusQuery.isLoading,
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    refetch: statusQuery.refetch,
  };
}
