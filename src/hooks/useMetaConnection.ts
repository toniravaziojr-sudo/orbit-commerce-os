import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type MetaScopePack = "atendimento" | "publicacao" | "ads" | "leads" | "catalogo" | "whatsapp" | "threads" | "live_video" | "pixel" | "insights";

interface MetaAssets {
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string }>;
  ad_accounts: Array<{ id: string; name: string }>;
  catalogs: Array<{ id: string; name: string }>;
  threads_profile: { id: string; username: string } | null;
}

interface MetaConnectionStatus {
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
    scopePacks: MetaScopePack[];
    assets: MetaAssets;
  } | null;
}

export function useMetaConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();

  // Query para status da conexão
  const statusQuery = useQuery({
    queryKey: ["meta-connection-status", currentTenant?.id],
    queryFn: async (): Promise<MetaConnectionStatus> => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      // Verificar se a plataforma está configurada (META_APP_ID existe)
      // Para isso, vamos tentar buscar a conexão e ver o que retorna
      
      // Buscar conexão do tenant
      const { data: connection, error } = await supabase
        .from("marketplace_connections")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("marketplace", "meta")
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      // Verificar se expirou
      const isExpired = connection?.expires_at 
        ? new Date(connection.expires_at) < new Date() 
        : false;

      // Extrair metadata
      const metadata = connection?.metadata as {
        connected_by?: string;
        connected_at?: string;
        scope_packs?: MetaScopePack[];
        assets?: MetaAssets;
      } | null;

      return {
        platformConfigured: true, // Assumimos que está configurado se chegou aqui
        isConnected: !!connection && connection.is_active && !isExpired,
        isExpired,
        connection: connection ? {
          externalUserId: connection.external_user_id,
          externalUsername: connection.external_username || "",
          connectedAt: metadata?.connected_at || connection.created_at,
          lastSyncAt: connection.last_sync_at,
          lastError: connection.last_error,
          expiresAt: connection.expires_at || "",
          scopePacks: metadata?.scope_packs || [],
          assets: metadata?.assets || {
            pages: [],
            instagram_accounts: [],
            whatsapp_business_accounts: [],
            ad_accounts: [],
            catalogs: [],
            threads_profile: null,
          },
        } : null,
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 30000, // 30 segundos
  });

  // Mutation para iniciar OAuth
  const connectMutation = useMutation({
    mutationFn: async (scopePacks: MetaScopePack[] = ["atendimento"]) => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("meta-oauth-start", {
        body: { 
          tenantId: currentTenant.id,
          scopePacks,
          returnPath: "/integrations",
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao iniciar conexão");
      }

      return data;
    },
    onSuccess: (data) => {
      // Marcar que OAuth está em progresso (protege contra loaders durante o fluxo)
      sessionStorage.setItem('oauth_in_progress', 'true');
      
      // Abrir popup para OAuth
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        "meta_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      // Escutar mensagem do popup (quando o OAuth terminar)
      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "meta:connected") {
          window.removeEventListener("message", handleMessage);
          // Invalidar query para atualizar status
          queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
          
          if (event.data.success) {
            toast.success("Conta Meta conectada com sucesso!");
          } else if (event.data.error) {
            toast.error(event.data.error);
          }
        }
      };
      window.addEventListener("message", handleMessage);

      // Fallback: verificar periodicamente se o popup fechou (caso postMessage falhe)
      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener("message", handleMessage);
          // Invalidar query para atualizar status
          queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
        }
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao conectar com Meta");
    },
  });

  // Mutation para desconectar
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      // Simplesmente desativar a conexão
      const { error } = await supabase
        .from("marketplace_connections")
        .update({ is_active: false })
        .eq("tenant_id", currentTenant.id)
        .eq("marketplace", "meta");

      if (error) {
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Conta Meta desconectada");
      queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
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
