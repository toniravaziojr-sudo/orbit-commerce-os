import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

type OlistAccountType = "marketplace";

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
    accountType: OlistAccountType;
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

  // Olist usa conexão por token (não OAuth), então temos uma mutation para testar e salvar
  const connectMutation = useMutation({
    mutationFn: async ({ apiToken, accountType }: { apiToken: string; accountType: OlistAccountType }) => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("olist-connect", {
        body: { 
          tenantId: currentTenant.id, 
          apiToken,
          accountType,
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao conectar");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Conta Olist conectada com sucesso!");
      queryClient.invalidateQueries({ queryKey: ["olist-connection-status"] });
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

  const testConnectionMutation = useMutation({
    mutationFn: async ({ apiToken, accountType }: { apiToken: string; accountType: OlistAccountType }) => {
      const { data, error } = await supabase.functions.invoke("olist-test-connection", {
        body: { apiToken, accountType },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Token inválido ou sem permissão");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Conexão testada com sucesso!");
    },
    onError: (error) => {
      toast.error(error.message || "Falha no teste de conexão");
    },
  });

  return {
    // Status
    isConnected: statusQuery.data?.isConnected ?? false,
    isExpired: statusQuery.data?.isExpired ?? false,
    platformConfigured: statusQuery.data?.platformConfigured ?? true, // Olist não precisa de config global
    connection: statusQuery.data?.connection ?? null,
    isLoading: statusQuery.isLoading,
    error: statusQuery.error,

    // Actions
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    testConnection: testConnectionMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
    isTesting: testConnectionMutation.isPending,

    // Refetch
    refetch: statusQuery.refetch,
  };
}
