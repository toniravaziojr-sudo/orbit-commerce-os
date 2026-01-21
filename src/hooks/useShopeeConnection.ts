import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface ShopeeConnectionStatus {
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
    shopId: number;
    region: string;
  } | null;
}

export function useShopeeConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["shopee-connection-status", currentTenant?.id],
    queryFn: async (): Promise<ShopeeConnectionStatus> => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shopee-connection-status?tenantId=${currentTenant.id}`,
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

  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("shopee-oauth-start", {
        body: { tenantId: currentTenant.id, region: "BR" },
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
        "shopee_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          queryClient.invalidateQueries({ queryKey: ["shopee-connection-status"] });
        }
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao conectar com Shopee");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("shopee-disconnect", {
        body: { tenantId: currentTenant.id },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao desconectar");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Conta da Shopee desconectada");
      queryClient.invalidateQueries({ queryKey: ["shopee-connection-status"] });
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao desconectar");
    },
  });

  return {
    status: statusQuery.data,
    isLoading: statusQuery.isLoading,
    isError: statusQuery.isError,
    refetch: statusQuery.refetch,
    platformConfigured: statusQuery.data?.platformConfigured ?? false,
    isConnected: statusQuery.data?.isConnected ?? false,
    isExpired: statusQuery.data?.isExpired ?? false,
    connection: statusQuery.data?.connection ?? null,
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
  };
}
