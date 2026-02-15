import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

// =====================
// Types
// =====================

export interface GoogleAdCampaign {
  id: string;
  tenant_id: string;
  google_campaign_id: string;
  ad_account_id: string;
  name: string;
  status: string;
  campaign_type: string | null;
  bidding_strategy_type: string | null;
  budget_amount_micros: number | null;
  budget_type: string;
  start_date: string | null;
  end_date: string | null;
  target_cpa_micros: number | null;
  target_roas: number | null;
  optimization_score: number | null;
  metadata: Record<string, any>;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GoogleAdInsightsSummary {
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
  spend: number;
  ctr: number;
  cpc: number;
  roas: number;
}

export interface GoogleAdAudience {
  id: string;
  tenant_id: string;
  google_audience_id: string;
  ad_account_id: string;
  name: string;
  audience_type: string;
  description: string | null;
  membership_status: string | null;
  size_estimate: number | null;
  synced_at: string | null;
}

// =====================
// Hook
// =====================

export function useGoogleAds() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // --- Campaigns ---
  const campaignsQuery = useQuery({
    queryKey: ["google-ads-campaigns", tenantId],
    queryFn: async (): Promise<GoogleAdCampaign[]> => {
      const { data, error } = await supabase.functions.invoke("google-ads-campaigns", {
        body: { tenant_id: tenantId, action: "list" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao listar campanhas");
      return data.data || [];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  const syncCampaigns = useMutation({
    mutationFn: async (customerId?: string) => {
      const { data, error } = await supabase.functions.invoke("google-ads-campaigns", {
        body: { tenant_id: tenantId, action: "sync", customer_id: customerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar");
      return data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.synced} campanhas sincronizadas`);
      queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao sincronizar campanhas"),
  });

  // --- Insights ---
  const insightsSummary = useQuery({
    queryKey: ["google-ads-insights-summary", tenantId],
    queryFn: async (): Promise<GoogleAdInsightsSummary> => {
      const { data, error } = await supabase.functions.invoke("google-ads-insights", {
        body: { tenant_id: tenantId, action: "summary" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao buscar resumo");
      return data.data;
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  const syncInsights = useMutation({
    mutationFn: async (params?: { customer_id?: string; date_from?: string; date_to?: string }) => {
      const { data, error } = await supabase.functions.invoke("google-ads-insights", {
        body: { tenant_id: tenantId, action: "sync", ...params },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar");
      return data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.synced} registros de insights sincronizados`);
      queryClient.invalidateQueries({ queryKey: ["google-ads-insights-summary"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao sincronizar insights"),
  });

  // --- Audiences ---
  const audiencesQuery = useQuery({
    queryKey: ["google-ads-audiences", tenantId],
    queryFn: async (): Promise<GoogleAdAudience[]> => {
      const { data, error } = await supabase.functions.invoke("google-ads-audiences", {
        body: { tenant_id: tenantId, action: "list" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao listar audiências");
      return data.data || [];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  const syncAudiences = useMutation({
    mutationFn: async (customerId?: string) => {
      const { data, error } = await supabase.functions.invoke("google-ads-audiences", {
        body: { tenant_id: tenantId, action: "sync", customer_id: customerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar");
      return data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.synced} audiências sincronizadas`);
      queryClient.invalidateQueries({ queryKey: ["google-ads-audiences"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro ao sincronizar audiências"),
  });

  // --- Sync All ---
  const syncAll = useMutation({
    mutationFn: async (customerId?: string) => {
      const results = await Promise.allSettled([
        supabase.functions.invoke("google-ads-campaigns", { body: { tenant_id: tenantId, action: "sync", customer_id: customerId } }),
        supabase.functions.invoke("google-ads-insights", { body: { tenant_id: tenantId, action: "sync", customer_id: customerId } }),
        supabase.functions.invoke("google-ads-audiences", { body: { tenant_id: tenantId, action: "sync", customer_id: customerId } }),
      ]);
      return results;
    },
    onSuccess: () => {
      toast.success("Google Ads sincronizado");
      queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["google-ads-insights-summary"] });
      queryClient.invalidateQueries({ queryKey: ["google-ads-audiences"] });
    },
    onError: (err: any) => toast.error(err.message || "Erro na sincronização"),
  });

  return {
    // Campaigns
    campaigns: campaignsQuery.data || [],
    campaignsLoading: campaignsQuery.isLoading,
    syncCampaigns: syncCampaigns.mutate,
    isSyncingCampaigns: syncCampaigns.isPending,

    // Insights
    summary: insightsSummary.data || null,
    summaryLoading: insightsSummary.isLoading,
    syncInsights: syncInsights.mutate,
    isSyncingInsights: syncInsights.isPending,

    // Audiences
    audiences: audiencesQuery.data || [],
    audiencesLoading: audiencesQuery.isLoading,
    syncAudiences: syncAudiences.mutate,
    isSyncingAudiences: syncAudiences.isPending,

    // Sync All
    syncAll: syncAll.mutate,
    isSyncingAll: syncAll.isPending,
  };
}
