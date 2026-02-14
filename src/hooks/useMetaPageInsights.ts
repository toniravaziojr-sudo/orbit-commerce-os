import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface InsightValue {
  end_time: string;
  value: number | Record<string, number>;
}

interface InsightMetric {
  name: string;
  period: string;
  values: InsightValue[];
  title: string;
  description: string;
  id: string;
}

interface PageInfo {
  id: string;
  name: string;
}

interface IgAccountInfo {
  id: string;
  username: string;
  page_id: string;
}

async function fetchInsights(
  tenantId: string,
  action: string,
  params: Record<string, string> = {}
) {
  const { data, error } = await supabase.functions.invoke("meta-page-insights", {
    body: { tenantId, action, ...params },
  });
  if (error) throw new Error(error.message);
  if (!data?.success) throw new Error(data?.error || "Erro ao buscar insights");
  return data;
}

export function useMetaPageInsights(pageId?: string) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  // Listar páginas e contas IG disponíveis
  const pagesQuery = useQuery({
    queryKey: ["meta-page-insights", "list_pages", tenantId],
    queryFn: async () => {
      const res = await fetchInsights(tenantId!, "list_pages");
      return res.data as { pages: PageInfo[]; instagram_accounts: IgAccountInfo[] };
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // Insights de página (FB)
  const pageOverviewQuery = useQuery<InsightMetric[]>({
    queryKey: ["meta-page-insights", "page_overview", tenantId, pageId],
    queryFn: async () => {
      const res = await fetchInsights(tenantId!, "page_overview", {
        ...(pageId ? { pageId } : {}),
        period: "day",
      });
      return res.data as InsightMetric[];
    },
    enabled: !!tenantId,
    staleTime: 300000, // 5 min
  });

  // Demográficos FB
  const pageDemographicsQuery = useQuery<InsightMetric[]>({
    queryKey: ["meta-page-insights", "page_demographics", tenantId, pageId],
    queryFn: async () => {
      const res = await fetchInsights(tenantId!, "page_demographics", {
        ...(pageId ? { pageId } : {}),
      });
      return res.data as InsightMetric[];
    },
    enabled: !!tenantId,
    staleTime: 600000, // 10 min
  });

  // Insights IG
  const igOverviewQuery = useQuery<InsightMetric[]>({
    queryKey: ["meta-page-insights", "ig_overview", tenantId, pageId],
    queryFn: async () => {
      const res = await fetchInsights(tenantId!, "ig_overview", {
        ...(pageId ? { pageId } : {}),
        period: "day",
      });
      return res.data as InsightMetric[];
    },
    enabled: !!tenantId,
    staleTime: 300000,
  });

  // Demográficos IG
  const igDemographicsQuery = useQuery({
    queryKey: ["meta-page-insights", "ig_demographics", tenantId, pageId],
    queryFn: async () => {
      const res = await fetchInsights(tenantId!, "ig_demographics", {
        ...(pageId ? { pageId } : {}),
      });
      return res.data;
    },
    enabled: !!tenantId,
    staleTime: 600000,
  });

  return {
    // Páginas disponíveis
    pages: pagesQuery.data?.pages ?? [],
    igAccounts: pagesQuery.data?.instagram_accounts ?? [],
    isPagesLoading: pagesQuery.isLoading,

    // FB Page insights
    pageOverview: pageOverviewQuery.data ?? [],
    isPageOverviewLoading: pageOverviewQuery.isLoading,
    pageOverviewError: pageOverviewQuery.error,

    // FB Demographics
    pageDemographics: pageDemographicsQuery.data ?? [],
    isPageDemographicsLoading: pageDemographicsQuery.isLoading,

    // IG insights
    igOverview: igOverviewQuery.data ?? [],
    isIgOverviewLoading: igOverviewQuery.isLoading,
    igOverviewError: igOverviewQuery.error,

    // IG Demographics
    igDemographics: igDemographicsQuery.data,
    isIgDemographicsLoading: igDemographicsQuery.isLoading,

    // Refetch
    refetchAll: () => {
      pageOverviewQuery.refetch();
      pageDemographicsQuery.refetch();
      igOverviewQuery.refetch();
      igDemographicsQuery.refetch();
    },
  };
}
