import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface OlistConnectionStatus {
  platformConfigured: boolean;
  isConnected: boolean;
  isExpired: boolean;
  connection: {
    externalUserId: string;
    externalUsername: string;
    connectedAt: string;
    lastSyncAt: string | null;
    lastError: string | null;
    expiresAt: string | null;
    environment: string;
  } | null;
}

export function useOlistConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["olist-connection-status", currentTenant?.id],
    queryFn: async (): Promise<OlistConnectionStatus> => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/olist-connection-status?tenantId=${currentTenant.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || "Erro ao verificar status");
      }

      return result;
    },
    enabled: !!currentTenant?.id && !!session?.access_token,
    staleTime: 30000,
  });

  // Iniciar fluxo OAuth - retorna URL para abrir em popup/redirect
  const startOAuthMutation = useMutation({
    mutationFn: async (environment: "production" | "sandbox" = "production") => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("olist-oauth-start", {
        body: { 
          tenantId: currentTenant.id,
          environment,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao iniciar OAuth");
      }

      return data;
    },
    onSuccess: (data) => {
      // Abrir popup para OAuth
      if (data.authUrl) {
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;
        
        const popup = window.open(
          data.authUrl,
          "olist-oauth",
          `width=${width},height=${height},left=${left},top=${top},scrollbars=yes`
        );

        // Monitorar fechamento do popup
        if (popup) {
          const checkInterval = setInterval(() => {
            if (popup.closed) {
              clearInterval(checkInterval);
              // Invalidar queries para atualizar status
              queryClient.invalidateQueries({ queryKey: ["olist-connection-status"] });
            }
          }, 500);
        }
      }
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao conectar com Olist");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("olist-disconnect", {
        body: { tenantId: currentTenant.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao desconectar");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Conta Olist desconectada");
      queryClient.invalidateQueries({ queryKey: ["olist-connection-status"] });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao desconectar");
    },
  });

  const refreshTokenMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("olist-token-refresh", {
        body: { tenantId: currentTenant.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao renovar token");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Token renovado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["olist-connection-status"] });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao renovar token");
    },
  });

  // Verificar se token está próximo de expirar
  const isTokenExpiring = (): boolean => {
    if (!statusQuery.data?.connection?.expiresAt) return false;
    const expiresAt = new Date(statusQuery.data.connection.expiresAt);
    const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000);
    return expiresAt < twoHoursFromNow;
  };

  return {
    // Status
    isConnected: statusQuery.data?.isConnected ?? false,
    isExpired: statusQuery.data?.isExpired ?? false,
    isTokenExpiring: isTokenExpiring(),
    platformConfigured: statusQuery.data?.platformConfigured ?? false,
    connection: statusQuery.data?.connection ?? null,
    isLoading: statusQuery.isLoading,
    error: statusQuery.error,

    // Actions
    startOAuth: startOAuthMutation.mutate,
    disconnect: disconnectMutation.mutate,
    refreshToken: refreshTokenMutation.mutate,
    
    // States
    isStartingOAuth: startOAuthMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isRefreshing: refreshTokenMutation.isPending,

    // Refetch
    refetch: statusQuery.refetch,
  };
}
