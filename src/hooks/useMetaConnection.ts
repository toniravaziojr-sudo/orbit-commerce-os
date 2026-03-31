import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { showErrorToast } from '@/lib/error-toast';

// V4: MetaScopePack mantido apenas para compatibilidade de leitura legada
export type MetaScopePack = "atendimento" | "publicacao" | "ads" | "leads" | "catalogo" | "whatsapp" | "threads" | "live_video" | "pixel" | "insights";

interface MetaAssets {
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username: string; page_id: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string; phone_numbers?: Array<{ id: string; display_phone_number: string; verified_name: string; quality_rating?: string }> }>;
  ad_accounts: Array<{ id: string; name: string }>;
  pixels: Array<{ id: string; name: string; ad_account_id: string }>;
  catalogs: Array<{ id: string; name: string }>;
  threads_profile: { id: string; username: string } | null;
  selected_phone_number?: { id: string; display_phone_number: string; verified_name: string; waba_id: string } | null;
}

interface MetaConnectionStatus {
  platformConfigured: boolean;
  isConnected: boolean;
  isExpired: boolean;
  isPendingAssetSelection: boolean;
  connection: {
    externalUserId: string;
    externalUsername: string;
    connectedAt: string;
    lastSyncAt: string | null;
    lastError: string | null;
    expiresAt: string;
    authProfile: string;
    scopePacks: MetaScopePack[]; // Legado — mantido para compatibilidade de UI
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

      // Buscar conexão do tenant (legado — compatibilidade temporária)
      const { data: connection, error } = await supabase
        .from("marketplace_connections")
        .select("*")
        .eq("tenant_id", currentTenant.id)
        .eq("marketplace", "meta")
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        throw error;
      }

      const isExpired = connection?.expires_at 
        ? new Date(connection.expires_at) < new Date() 
        : false;

      const metadata = connection?.metadata as {
        connected_by?: string;
        connected_at?: string;
        scope_packs?: MetaScopePack[];
        auth_profile_key?: string;
        grant_id?: string;
        assets?: MetaAssets;
        pending_asset_selection?: boolean;
      } | null;

      const isPendingAssetSelection = metadata?.pending_asset_selection === true;

      return {
        platformConfigured: true,
        isConnected: !!connection && connection.is_active && !isExpired && !isPendingAssetSelection,
        isExpired,
        isPendingAssetSelection,
        connection: connection ? {
          externalUserId: connection.external_user_id,
          externalUsername: connection.external_username || "",
          connectedAt: metadata?.connected_at || connection.created_at,
          lastSyncAt: connection.last_sync_at,
          lastError: connection.last_error,
          expiresAt: connection.expires_at || "",
          authProfile: metadata?.auth_profile_key || "meta_auth_external",
          scopePacks: metadata?.scope_packs || [],
          assets: metadata?.assets || {
            pages: [],
            instagram_accounts: [],
            whatsapp_business_accounts: [],
            ad_accounts: [],
            pixels: [],
            catalogs: [],
            threads_profile: null,
          },
        } : null,
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 30000,
  });

  // V4: Mutation para iniciar OAuth — sem scope packs
  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("meta-oauth-start", {
        body: { 
          tenantId: currentTenant.id,
          returnPath: "/integrations",
        },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao iniciar conexão");
      }

      return data;
    },
    onSuccess: (data) => {
      sessionStorage.setItem('oauth_in_progress', 'true');
      
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        data.authUrl,
        "meta_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "meta:connected") {
          window.removeEventListener("message", handleMessage);
          queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
          
          if (event.data.success) {
            toast.success("Conta Meta conectada com sucesso!");
          } else if (event.data.error) {
            showErrorToast(new Error(event.data.error || 'Falha ao conectar Meta'), { module: 'meta', action: 'processar' });
          }
        }
      };
      window.addEventListener("message", handleMessage);

      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener("message", handleMessage);
          queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
        }
      }, 500);
    },
    onError: (error) => showErrorToast(error, { module: 'meta', action: 'conectar' }),
  });

  // V4 Mutation para desconectar via edge function
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      const { data, error } = await supabase.functions.invoke("meta-disconnect", {
        body: { tenant_id: currentTenant.id },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao desconectar");
      return data;
    },
    onSuccess: () => {
      toast.success("Conta Meta desconectada");
      queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
      queryClient.invalidateQueries({ queryKey: ["meta-integrations"] });
    },
    onError: (error) => showErrorToast(error, { module: 'meta', action: 'desconectar' }),
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
    isPendingAssetSelection: statusQuery.data?.isPendingAssetSelection ?? false,
    connection: statusQuery.data?.connection ?? null,

    // Actions — V4: connect() não recebe mais scope packs
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
  };
}
