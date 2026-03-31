import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantAccess } from "@/hooks/useTenantAccess";
import { useMemo } from "react";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";
import {
  META_INTEGRATION_CATALOG,
  type MetaIntegrationDef,
} from "@/config/metaIntegrationCatalog";


export type IntegrationLayerStatus = "available" | "blocked_auth" | "blocked_plan" | "blocked_config";

export interface MetaIntegrationState {
  /** Integration definition from catalog */
  def: MetaIntegrationDef;
  /** Whether integration is operationally active (has row with status=active) */
  isActive: boolean;
  /** Current DB status */
  dbStatus: string | null;
  /** Auth capability — grant has required scopes? */
  authCapable: boolean;
  /** Reason auth is blocked (missing scopes) */
  authBlockReason: string | null;
  /** Plan allows this feature? */
  planAllowed: boolean;
  /** Plan block reason */
  planBlockReason: string | null;
  /** Overall computed status for UI */
  layerStatus: IntegrationLayerStatus;
  /** Can the user toggle this integration on? */
  canActivate: boolean;
  /** Human-readable reason why it can't be activated */
  blockReason: string | null;
}

export interface ActiveGrantInfo {
  id: string;
  grantedScopes: string[];
  status: string;
  tokenExpiresAt: string | null;
  authProfile: string;
  metaUserName: string | null;
}

export function useMetaIntegrations() {
  const { currentTenant } = useAuth();
  const { canAccess } = useTenantAccess();
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

      // Layer 1: Auth capability
      const grantedScopes = grant?.grantedScopes ?? [];
      const missingScopes = def.requiredScopes.filter(
        (s) => !grantedScopes.includes(s)
      );
      const authCapable = grant !== null && missingScopes.length === 0;
      const authBlockReason =
        !grant
          ? "Conecte sua conta Meta primeiro"
          : missingScopes.length > 0
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

      if (!authCapable) {
        layerStatus = "blocked_auth";
        blockReason = authBlockReason;
      } else if (!planAllowed) {
        layerStatus = "blocked_plan";
        blockReason = planBlockReason;
      }

      const canActivate = authCapable && planAllowed;

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
      };
    });
  }, [dbIntegrations, grant, canAccess]);

  // Toggle mutation
  const toggleMutation = useMutation({
    mutationFn: async ({
      integrationId,
      action,
    }: {
      integrationId: string;
      action: "activate" | "deactivate";
    }) => {
      if (!tenantId) throw new Error("Tenant não selecionado");

      const { data, error } = await supabase.functions.invoke(
        "meta-integrations-manage",
        {
          body: {
            tenant_id: tenantId,
            integration_id: integrationId,
            action,
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

  return {
    integrationStates,
    grant,
    isLoading,
    refetch,
    toggle: toggleMutation.mutate,
    isToggling: toggleMutation.isPending,
    togglingId: toggleMutation.variables?.integrationId ?? null,
  };
}
