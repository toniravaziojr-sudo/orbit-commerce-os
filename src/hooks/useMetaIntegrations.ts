import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { useMemo } from "react";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";
import {
  META_INTEGRATION_CATALOG,
  META_APPROVED_PUBLIC_SCOPES,
  type MetaIntegrationDef,
} from "@/config/metaIntegrationCatalog";


export type IntegrationLayerStatus = "available" | "blocked_auth" | "blocked_plan" | "blocked_config";

export interface MetaIntegrationState {
  def: MetaIntegrationDef;
  isActive: boolean;
  dbStatus: string | null;
  authCapable: boolean;
  authBlockReason: string | null;
  planAllowed: boolean;
  planBlockReason: string | null;
  layerStatus: IntegrationLayerStatus;
  canActivate: boolean;
  blockReason: string | null;
  /** Currently selected assets for this integration */
  selectedAssets: any | null;
}

export interface ActiveGrantInfo {
  id: string;
  grantedScopes: string[];
  status: string;
  tokenExpiresAt: string | null;
  authProfile: string;
  metaUserName: string | null;
  discoveredAssets: DiscoveredAssets | null;
}

/** Structure of discovered_assets from the Meta OAuth callback */
export interface DiscoveredBusiness {
  id: string;
  name: string;
  pages: Array<{ id: string; name: string; access_token?: string }>;
  instagram_accounts: Array<{ id: string; username?: string; page_id?: string }>;
  whatsapp_business_accounts: Array<{ id: string; name: string; phone_numbers?: Array<{ id: string; display_phone_number?: string; verified_name?: string }> }>;
  ad_accounts: Array<{ id: string; name: string }>;
  pixels: Array<{ id: string; name: string; ad_account_id?: string }>;
}

export interface DiscoveredAssets {
  businesses: DiscoveredBusiness[];
}

export function useMetaIntegrations() {
  const { currentTenant } = useAuth();
  const { canAccess, isUnlimited } = useTenantAccess();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Fetch integrations + grant info from edge function
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["meta-integrations", tenantId],
    queryFn: async () => {
      if (!tenantId) return null;

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = (await supabase.auth.getSession()).data.session;
      
      const response = await fetch(
        `${supabaseUrl}/functions/v1/meta-integrations-manage?tenant_id=${tenantId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );

      const result = await response.json();
      if (!result.success) throw new Error(result.message);

      return result as {
        success: boolean;
        integrations: Array<{
          id: string;
          integration_id: string;
          status: string;
          auth_grant_id: string | null;
          metadata: any;
          selected_assets: any;
        }>;
        grant: ActiveGrantInfo | null;
      };
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  const grant = data?.grant ?? null;
  const dbIntegrations = data?.integrations ?? [];

  // Compute full state for each catalog integration
  const integrationStates: MetaIntegrationState[] = useMemo(() => {
    return META_INTEGRATION_CATALOG.map((def) => {
      const dbRow = dbIntegrations.find((i) => i.integration_id === def.id);
      const isActive = dbRow?.status === "active";
      const dbStatus = dbRow?.status ?? null;
      const selectedAssets = dbRow?.selected_assets ?? null;

      // Layer 0: Public approval
      const scopesApprovedForPublic = def.requiredScopes.length === 0 || 
        def.requiredScopes.every((s) => META_APPROVED_PUBLIC_SCOPES.includes(s));
      const publiclyAvailable = isUnlimited || scopesApprovedForPublic;

      // Layer 1: Auth capability
      const grantedScopes = grant?.grantedScopes ?? [];
      const missingScopes = def.requiredScopes.filter(
        (s) => !grantedScopes.includes(s)
      );
      const authCapable = grant !== null && (isUnlimited || missingScopes.length === 0);
      const authBlockReason =
        !grant
          ? "Conecte sua conta Meta primeiro"
          : !isUnlimited && missingScopes.length > 0
          ? `Permissões ausentes: ${missingScopes.join(", ")}`
          : null;

      // Layer 2: Plan/feature
      const planAllowed = def.featureKey ? canAccess(def.featureKey) : true;
      const planBlockReason = !planAllowed
        ? "Funcionalidade não disponível no seu plano"
        : null;

      // Layer 3: Overall status
      let layerStatus: IntegrationLayerStatus = "available";
      let blockReason: string | null = null;

      if (!publiclyAvailable) {
        layerStatus = "blocked_config";
        blockReason = "Em breve — aguardando aprovação de permissões pela Meta";
      } else if (!authCapable) {
        layerStatus = "blocked_auth";
        blockReason = authBlockReason;
      } else if (!planAllowed) {
        layerStatus = "blocked_plan";
        blockReason = planBlockReason;
      }

      const canActivate = publiclyAvailable && authCapable && planAllowed;

      return {
        def,
        isActive,
        dbStatus,
        authCapable,
        authBlockReason,
        planAllowed,
        planBlockReason,
        layerStatus,
        canActivate,
        blockReason,
        selectedAssets,
      };
    });
  }, [dbIntegrations, grant, canAccess, isUnlimited]);

  // Toggle mutation (activate/deactivate)
  const toggleMutation = useMutation({
    mutationFn: async ({
      integrationId,
      action,
      selectedAssets,
    }: {
      integrationId: string;
      action: "activate" | "deactivate";
      selectedAssets?: any;
    }) => {
      if (!tenantId) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase.functions.invoke(
        "meta-integrations-manage",
        {
          body: {
            tenant_id: tenantId,
            integration_id: integrationId,
            action,
            selected_assets: selectedAssets || undefined,
          },
        }
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Erro ao gerenciar integração");
      return data;
    },
    onSuccess: (_, variables) => {
      const label =
        META_INTEGRATION_CATALOG.find((i) => i.id === variables.integrationId)?.label ??
        variables.integrationId;
      toast.success(
        variables.action === "activate"
          ? `${label} ativado com sucesso`
          : `${label} desativado`
      );
      queryClient.invalidateQueries({ queryKey: ["meta-integrations"] });
    },
    onError: (error) =>
      showErrorToast(error, { module: "meta", action: "gerenciar" }),
  });

  // Save assets mutation (update assets on existing active integration)
  const saveAssetsMutation = useMutation({
    mutationFn: async ({
      integrationId,
      selectedAssets,
    }: {
      integrationId: string;
      selectedAssets: any;
    }) => {
      if (!tenantId) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase.functions.invoke(
        "meta-integrations-manage",
        {
          body: {
            tenant_id: tenantId,
            integration_id: integrationId,
            action: "save_assets",
            selected_assets: selectedAssets,
          },
        }
      );

      if (error) throw error;
      if (!data?.success) throw new Error(data?.message || "Erro ao salvar ativos");
      return data;
    },
    onSuccess: () => {
      toast.success("Ativo atualizado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["meta-integrations"] });
    },
    onError: (error) =>
      showErrorToast(error, { module: "meta", action: "salvar ativos" }),
  });

  return {
    integrationStates,
    grant,
    isLoading,
    refetch,
    toggle: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
    togglingId: toggleMutation.variables?.integrationId ?? null,
    saveAssets: saveAssetsMutation.mutate,
    isSavingAssets: saveAssetsMutation.isPending,
  };
}
