import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { showErrorToast } from '@/lib/error-toast';

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

export interface GoogleAdInsight {
  id: string;
  tenant_id: string;
  google_campaign_id: string;
  ad_account_id: string;
  date: string;
  impressions: number;
  clicks: number;
  cost_micros: number;
  conversions: number;
  conversions_value: number;
  ctr: number;
  average_cpc: number;
  average_cpm: number;
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

export interface GoogleAdGroup {
  id: string;
  tenant_id: string;
  google_adgroup_id: string;
  google_campaign_id: string;
  ad_account_id: string;
  name: string;
  status: string;
  ad_group_type: string | null;
}

export interface GoogleAd {
  id: string;
  tenant_id: string;
  google_ad_id: string;
  google_adgroup_id: string;
  google_campaign_id: string;
  ad_account_id: string;
  name: string;
  status: string;
  ad_type: string | null;
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
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'sincronizar' }),
  });

  const updateCampaign = useMutation({
    mutationFn: async (params: { google_campaign_id: string; status?: string; daily_budget_cents?: number; customer_id?: string }) => {
      const { google_campaign_id, status, daily_budget_cents, customer_id } = params;
      
      // Determine action
      let action = "update";
      const bodyPayload: any = { tenant_id: tenantId, campaign_id: google_campaign_id, customer_id };

      if (status === "ACTIVE" || status === "ENABLED") {
        action = "activate";
      } else if (status === "PAUSED") {
        action = "pause";
      } else if (daily_budget_cents !== undefined) {
        action = "update";
        bodyPayload.updates = { campaignBudget: { amountMicros: String(daily_budget_cents * 10000) } };
        bodyPayload.update_mask = "campaign_budget.amount_micros";
      }

      bodyPayload.action = action;

      const { data, error } = await supabase.functions.invoke("google-ads-campaigns", { body: bodyPayload });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao atualizar campanha");
      return data.data;
    },
    onSuccess: () => {
      toast.success("Campanha atualizada");
      queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns"] });
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'atualizar' }),
  });

  // --- Insights (per-campaign, for campaigns tab) ---
  const insightsQuery = useQuery({
    queryKey: ["google-ads-insights-list", tenantId],
    queryFn: async (): Promise<GoogleAdInsight[]> => {
      const { data, error } = await supabase.functions.invoke("google-ads-insights", {
        body: { tenant_id: tenantId, action: "list" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao listar insights");
      return data.data || [];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  // --- Insights Summary ---
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
      queryClient.invalidateQueries({ queryKey: ["google-ads-insights-list"] });
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'sincronizar' }),
  });

  // --- Ad Groups ---
  const adGroupsQuery = useQuery({
    queryKey: ["google-ads-adgroups", tenantId],
    queryFn: async (): Promise<GoogleAdGroup[]> => {
      const { data, error } = await supabase.functions.invoke("google-ads-adgroups", {
        body: { tenant_id: tenantId, action: "list" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao listar grupos de anúncios");
      return data.data || [];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  const syncAdGroups = useMutation({
    mutationFn: async (customerId?: string) => {
      const { data, error } = await supabase.functions.invoke("google-ads-adgroups", {
        body: { tenant_id: tenantId, action: "sync", customer_id: customerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar");
      return data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.synced} grupos de anúncios sincronizados`);
      queryClient.invalidateQueries({ queryKey: ["google-ads-adgroups"] });
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'sincronizar' }),
  });

  // --- Ads ---
  const adsQuery = useQuery({
    queryKey: ["google-ads-ads", tenantId],
    queryFn: async (): Promise<GoogleAd[]> => {
      const { data, error } = await supabase.functions.invoke("google-ads-ads", {
        body: { tenant_id: tenantId, action: "list" },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao listar anúncios");
      return data.data || [];
    },
    enabled: !!tenantId,
    staleTime: 60000,
  });

  const syncAds = useMutation({
    mutationFn: async (customerId?: string) => {
      const { data, error } = await supabase.functions.invoke("google-ads-ads", {
        body: { tenant_id: tenantId, action: "sync", customer_id: customerId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao sincronizar");
      return data.data;
    },
    onSuccess: (data) => {
      toast.success(`${data.synced} anúncios sincronizados`);
      queryClient.invalidateQueries({ queryKey: ["google-ads-ads"] });
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'sincronizar' }),
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
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'sincronizar' }),
  });

  // --- Sync All ---
  const syncAll = useMutation({
    mutationFn: async (customerId?: string) => {
      const results = await Promise.allSettled([
        supabase.functions.invoke("google-ads-campaigns", { body: { tenant_id: tenantId, action: "sync", customer_id: customerId } }),
        supabase.functions.invoke("google-ads-insights", { body: { tenant_id: tenantId, action: "sync", customer_id: customerId } }),
        supabase.functions.invoke("google-ads-audiences", { body: { tenant_id: tenantId, action: "sync", customer_id: customerId } }),
        supabase.functions.invoke("google-ads-adgroups", { body: { tenant_id: tenantId, action: "sync", customer_id: customerId } }),
        supabase.functions.invoke("google-ads-ads", { body: { tenant_id: tenantId, action: "sync", customer_id: customerId } }),
      ]);
      return results;
    },
    onSuccess: () => {
      toast.success("Google Ads sincronizado");
      queryClient.invalidateQueries({ queryKey: ["google-ads-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["google-ads-insights-summary"] });
      queryClient.invalidateQueries({ queryKey: ["google-ads-insights-list"] });
      queryClient.invalidateQueries({ queryKey: ["google-ads-audiences"] });
      queryClient.invalidateQueries({ queryKey: ["google-ads-adgroups"] });
      queryClient.invalidateQueries({ queryKey: ["google-ads-ads"] });
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'processar' }),
  });

  return {
    // Campaigns
    campaigns: campaignsQuery.data || [],
    campaignsLoading: campaignsQuery.isLoading,
    syncCampaigns,
    isSyncingCampaigns: syncCampaigns.isPending,
    updateCampaign,

    // Insights (per-campaign list)
    insights: insightsQuery.data || [],
    insightsLoading: insightsQuery.isLoading,

    // Insights Summary
    summary: insightsSummary.data || null,
    summaryLoading: insightsSummary.isLoading,
    syncInsights,
    isSyncingInsights: syncInsights.isPending,

    // Ad Groups
    adGroups: adGroupsQuery.data || [],
    adGroupsLoading: adGroupsQuery.isLoading,
    syncAdGroups,
    isSyncingAdGroups: syncAdGroups.isPending,

    // Ads
    ads: adsQuery.data || [],
    adsLoading: adsQuery.isLoading,
    syncAds,
    isSyncingAds: syncAds.isPending,

    // Audiences
    audiences: audiencesQuery.data || [],
    audiencesLoading: audiencesQuery.isLoading,
    syncAudiences,
    isSyncingAudiences: syncAudiences.isPending,

    // Sync All
    syncAll: syncAll.mutate,
    isSyncingAll: syncAll.isPending,
  };
}
