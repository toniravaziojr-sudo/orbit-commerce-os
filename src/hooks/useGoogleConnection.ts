import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export type GoogleScopePack = "youtube" | "ads" | "merchant" | "analytics" | "search_console" | "business" | "tag_manager";

export interface GoogleAssets {
  youtube_channels?: Array<{ id: string; title: string; thumbnail_url?: string; subscriber_count?: number }>;
  ad_accounts?: Array<{ id: string; name: string }>;
  ads_note?: string;
  merchant_accounts?: Array<{ id: string; name: string }>;
  analytics_properties?: Array<{ id: string; name: string; measurement_id?: string | null }>;
  search_console_sites?: Array<{ url: string; permission_level?: string }>;
  business_locations?: Array<{ name: string; location_id: string }>;
  tag_manager_accounts?: Array<{ id: string; name: string }>;
}

interface GoogleConnectionData {
  googleUserId: string | null;
  googleEmail: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  connectedAt: string;
  lastSyncAt: string | null;
  lastError: string | null;
  tokenExpiresAt: string | null;
  connectionStatus: string;
  scopePacks: GoogleScopePack[];
  grantedScopes: string[];
  assets: GoogleAssets;
}

interface GoogleConnectionStatus {
  isConnected: boolean;
  isExpired: boolean;
  connection: GoogleConnectionData | null;
}

export function useGoogleConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["google-connection-status", currentTenant?.id],
    queryFn: async (): Promise<GoogleConnectionStatus> => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { data: conn, error } = await supabase
        .from("google_connections" as any)
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
          googleUserId: c.google_user_id,
          googleEmail: c.google_email,
          displayName: c.display_name,
          avatarUrl: c.avatar_url,
          connectedAt: c.created_at,
          lastSyncAt: c.last_sync_at,
          lastError: c.last_error,
          tokenExpiresAt: c.token_expires_at,
          connectionStatus: c.connection_status,
          scopePacks: (c.scope_packs || []) as GoogleScopePack[],
          grantedScopes: c.granted_scopes || [],
          assets: (c.assets || {}) as GoogleAssets,
        },
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 30000,
  });

  const connectMutation = useMutation({
    mutationFn: async (scopePacks: GoogleScopePack[] = ["youtube"]) => {
      if (!currentTenant?.id || !session?.access_token) {
        throw new Error("Sessão inválida");
      }

      const { data, error } = await supabase.functions.invoke("google-oauth-start", {
        body: { tenantId: currentTenant.id, scopePacks, returnPath: "/integrations" },
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || "Erro ao iniciar conexão");
      }
      return data;
    },
    onSuccess: (data) => {
      // Open popup
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        data.authUrl,
        "google_oauth",
        `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`
      );

      const handleMessage = (event: MessageEvent) => {
        if (event.data?.type === "google:connected") {
          window.removeEventListener("message", handleMessage);
          queryClient.invalidateQueries({ queryKey: ["google-connection-status"] });
          if (event.data.success) {
            toast.success(`Google conectado! (${event.data.account || ""})`);
          } else {
            toast.error(event.data.error || "Erro ao conectar");
          }
        }
      };
      window.addEventListener("message", handleMessage);

      const checkPopup = setInterval(() => {
        if (popup?.closed) {
          clearInterval(checkPopup);
          window.removeEventListener("message", handleMessage);
          queryClient.invalidateQueries({ queryKey: ["google-connection-status"] });
        }
      }, 500);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao conectar com Google");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) throw new Error("Tenant não selecionado");

      const { error } = await supabase
        .from("google_connections" as any)
        .update({ is_active: false, connection_status: "disconnected" } as any)
        .eq("tenant_id", currentTenant.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Google desconectado");
      queryClient.invalidateQueries({ queryKey: ["google-connection-status"] });
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
    isConnected: statusQuery.data?.isConnected ?? false,
    isExpired: statusQuery.data?.isExpired ?? false,
    connection: statusQuery.data?.connection ?? null,
    connect: connectMutation.mutate,
    disconnect: disconnectMutation.mutate,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
  };
}
