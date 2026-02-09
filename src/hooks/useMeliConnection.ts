import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MeliConnectionStatus {
  platformConfigured: boolean;
  isConnected: boolean;
  isExpired: boolean;
  connection: {
    externalUserId: string;
    externalUsername: string;
    connectedAt: string;
    lastSyncAt: string | null;
    lastError: string | null;
    expiresAt: string;
  } | null;
}

export function useMeliConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();

  // Query para status da conexão
  const statusQuery = useQuery({
    queryKey: ["meli-connection-status", currentTenant?.id],
    queryFn: async (): Promise<MeliConnectionStatus> => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("meli-connection-status", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: null,
      });

      // Para GET com query params, precisamos usar fetch direto
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/meli-connection-status?tenantId=${currentTenant.id}`,
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
    staleTime: 30000, // 30 segundos
  });

  // Mutation para iniciar OAuth
  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("meli-oauth-start", {
        body: { tenantId: currentTenant.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao iniciar conexão");
      }

      return data;
    },
    onSuccess: (data) => {
      // Abrir popup para OAuth
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        "meli_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      // Listen for postMessage from popup (success/error)
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return;
        if (event.data?.type === 'meli_connected' || event.data?.type === 'meli_error') {
          window.removeEventListener('message', handleMessage);
          queryClient.invalidateQueries({ queryKey: ["meli-connection-status"] });
          
          if (event.data.type === 'meli_connected') {
            toast.success("Mercado Livre conectado com sucesso!");
          } else {
            toast.error("Erro ao conectar: " + (event.data.value || "Tente novamente"));
          }
        }
      };
      window.addEventListener('message', handleMessage);

      // Fallback: check if popup closed without sending message
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          // Remove listener after timeout
          setTimeout(() => window.removeEventListener('message', handleMessage), 1000);
          queryClient.invalidateQueries({ queryKey: ["meli-connection-status"] });
        }
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao conectar com Mercado Livre");
    },
  });

  // Mutation para desconectar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("meli-disconnect", {
        body: { tenantId: currentTenant.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao desconectar");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Conta do Mercado Livre desconectada");
      queryClient.invalidateQueries({ queryKey: ["meli-connection-status"] });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao desconectar");
    },
  });

  return {
    // Status
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isError: statusQuery.isError,
    refetch: statusQuery.refetch,

    // Helpers
    platformConfigured: statusQuery.data?.platformConfigured ?? false,
    isConnected: statusQuery.data?.isConnected ?? false,
    isExpired: statusQuery.data?.isExpired ?? false,
    connection: statusQuery.data?.connection ?? null,

    // Actions
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
  };
}
