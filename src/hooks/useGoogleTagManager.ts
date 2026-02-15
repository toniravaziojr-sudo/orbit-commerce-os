import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface GTMContainer {
  id: string;
  tenant_id: string;
  account_id: string;
  account_name: string | null;
  container_id: string;
  container_name: string;
  container_public_id: string | null;
  domain_name: string[];
  usage_context: string[];
  tag_manager_url: string | null;
  fingerprint: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

interface GTMScripts {
  publicId: string;
  headSnippet: string;
  bodySnippet: string;
  environment: {
    name: string;
    type: string;
    authorizationCode: string | null;
  };
}

async function callTagManager(action: string, tenantId: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("google-tag-manager", {
    body: { action, tenantId, ...params },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
  return data.data;
}

export function useGoogleTagManager() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const containersQuery = useQuery<GTMContainer[]>({
    queryKey: ["google-tag-manager", "containers", tenantId],
    queryFn: () => callTagManager("list", tenantId!),
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: () => callTagManager("sync", tenantId!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["google-tag-manager"] }),
  });

  const scriptsMutation = useMutation<GTMScripts, Error, { accountId: string; containerId: string }>({
    mutationFn: (params) => callTagManager("scripts", tenantId!, params),
  });

  return {
    containersQuery,
    syncMutation,
    scriptsMutation,
  };
}
