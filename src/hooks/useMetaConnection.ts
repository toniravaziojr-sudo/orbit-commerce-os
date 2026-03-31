import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { showErrorToast } from '@/lib/error-toast';

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
    scopePacks: MetaScopePack[];
    assets: MetaAssets;
  } | null;
}

export function useMetaConnection() {
  const { currentTenant, session } = useAuth();
  const queryClient = useQueryClient();

  const openPopupFlow = (url: string, markOauthInProgress = true) => {
    if (markOauthInProgress) {
      sessionStorage.setItem('oauth_in_progress', 'true');
    }

    const width = Math.max(720, Math.min(860, window.screen.availWidth - 32));
    const height = Math.max(900, Math.min(1100, window.screen.availHeight - 24));
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);

    const popup = window.open(
      url,
      "meta_oauth",
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes,resizable=yes`
    );

    popup?.focus();

    const enforcePopupSize = () => {
      if (!popup || popup.closed) return;
      try {
        popup.resizeTo(width, height);
        popup.moveTo(left, top);
        popup.focus();
      } catch {
        // Alguns navegadores/OS ignoram resize programático.
      }
    };

    setTimeout(enforcePopupSize, 250);

    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "meta:connected") {
        window.removeEventListener("message", handleMessage);
        queryClient.invalidateQueries({ queryKey: ["meta-connection-status"] });
        queryClient.invalidateQueries({ queryKey: ["meta-integrations"] });

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
        queryClient.invalidateQueries({ queryKey: ["meta-integrations"] });
      }
    }, 500);
  };

  // V4: Query status from tenant_meta_auth_grants + tenant_meta_integrations
  const statusQuery = useQuery({
    queryKey: ["meta-connection-status", currentTenant?.id],
    queryFn: async (): Promise<MetaConnectionStatus> => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      // V4: Check active grant
      const { data: grant, error: grantError } = await supabase
        .from("tenant_meta_auth_grants")
        .select("id, status, meta_user_id, meta_user_name, granted_scopes, granted_at, token_expires_at, last_error, last_validated_at, discovered_assets")
        .eq("tenant_id", currentTenant.id)
        .eq("status", "active")
        .order("granted_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (grantError && grantError.code !== "PGRST116") {
        throw grantError;
      }

      if (!grant) {
        return {
          platformConfigured: true,
          isConnected: false,
          isExpired: false,
          isPendingAssetSelection: false,
          connection: null,
        };
      }

      const isExpired = grant.token_expires_at
        ? new Date(grant.token_expires_at) < new Date()
        : false;

      // Check if asset selection is pending (no integrations active yet)
      const { data: integrations } = await supabase
        .from("tenant_meta_integrations")
        .select("integration_id, selected_assets, status")
        .eq("tenant_id", currentTenant.id)
        .eq("auth_grant_id", grant.id)
        .eq("status", "active");

      const hasActiveIntegrations = (integrations?.length || 0) > 0;

      // Build assets from discovered_assets + integrations
      const discovered = grant.discovered_assets as any || {};
      const businesses = discovered.businesses || [];
      const allPages: MetaAssets["pages"] = [];
      const allAdAccounts: MetaAssets["ad_accounts"] = [];
      const allIgAccounts: MetaAssets["instagram_accounts"] = [];
      const allWabas: MetaAssets["whatsapp_business_accounts"] = [];
      const allPixels: MetaAssets["pixels"] = [];
      const allCatalogs: MetaAssets["catalogs"] = [];
      let threadsProfile: MetaAssets["threads_profile"] = null;

      for (const biz of businesses) {
        if (biz.pages) allPages.push(...biz.pages);
        if (biz.ad_accounts) allAdAccounts.push(...biz.ad_accounts);
        if (biz.instagram_accounts) allIgAccounts.push(...biz.instagram_accounts);
        if (biz.whatsapp_business_accounts) allWabas.push(...biz.whatsapp_business_accounts);
        if (biz.pixels) allPixels.push(...biz.pixels);
      }

      // Enrich from integrations' selected_assets
      for (const integ of integrations || []) {
        const assets = integ.selected_assets as any;
        if (!assets) continue;
        if (assets.catalogs) {
          for (const cat of assets.catalogs) {
            if (!allCatalogs.some(c => c.id === cat.id)) allCatalogs.push(cat);
          }
        }
        if (assets.threads_profile) threadsProfile = assets.threads_profile;
      }

      const isPendingAssetSelection = !hasActiveIntegrations && !isExpired;

      return {
        platformConfigured: true,
        isConnected: !!grant && !isExpired && hasActiveIntegrations,
        isExpired,
        isPendingAssetSelection,
        connection: {
          externalUserId: grant.meta_user_id || "",
          externalUsername: grant.meta_user_name || "",
          connectedAt: grant.granted_at,
          lastSyncAt: grant.last_validated_at,
          lastError: grant.last_error,
          expiresAt: grant.token_expires_at || "",
          authProfile: "v4_grant",
          scopePacks: [],
          assets: {
            pages: allPages,
            instagram_accounts: allIgAccounts,
            whatsapp_business_accounts: allWabas,
            ad_accounts: allAdAccounts,
            pixels: allPixels,
            catalogs: allCatalogs,
            threads_profile: threadsProfile,
          },
        },
      };
    },
    enabled: !!currentTenant?.id,
    staleTime: 30000,
  });

  // V4: Mutation para iniciar OAuth — sem scope packs
  const connectMutation = useMutation({
    mutationFn: async () => {
      if (!currentTenant?.id) {
        throw new Error("Tenant não selecionado");
      }

      if (statusQuery.data?.isPendingAssetSelection) {
        return {
          authUrl: `${window.location.origin}/integrations/meta/callback?resume=1&tenantId=${currentTenant.id}`,
          isResume: true,
        };
      }

      if (!session?.access_token) {
        throw new Error("Sessão inválida");
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

      return {
        ...data,
        isResume: false,
      };
    },
    onSuccess: (data) => {
      openPopupFlow(data.authUrl, !data.isResume);
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
