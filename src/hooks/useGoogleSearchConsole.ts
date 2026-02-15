import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface DateRange {
  startDate: string;
  endDate: string;
}

async function callSearchConsole(action: string, tenantId: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("google-search-console", {
    body: { action, tenantId, ...params },
  });
  if (error) throw error;
  if (!data?.success) throw new Error(data?.error || "Erro desconhecido");
  return data.data;
}

export function useGoogleSearchConsole(siteUrl?: string, dateRange?: DateRange) {
  const { currentTenant } = useAuth();
  const currentTenantId = currentTenant?.id;
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["google-search-console", "summary", currentTenantId, siteUrl, dateRange],
    queryFn: () => callSearchConsole("summary", currentTenantId!, { siteUrl, dateRange }),
    enabled: !!currentTenantId && !!siteUrl,
    staleTime: 5 * 60 * 1000,
  });

  const dataQuery = useQuery({
    queryKey: ["google-search-console", "list", currentTenantId, siteUrl, dateRange],
    queryFn: () => callSearchConsole("list", currentTenantId!, { siteUrl, dateRange }),
    enabled: !!currentTenantId && !!siteUrl,
    staleTime: 5 * 60 * 1000,
  });

  const sitesQuery = useQuery({
    queryKey: ["google-search-console", "sites", currentTenantId],
    queryFn: () => callSearchConsole("sites", currentTenantId!),
    enabled: !!currentTenantId,
    staleTime: 10 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: (params: { siteUrl: string; dateRange?: DateRange }) =>
      callSearchConsole("sync", currentTenantId!, params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["google-search-console"] });
    },
  });

  return {
    summaryQuery,
    dataQuery,
    sitesQuery,
    syncMutation,
  };
}
