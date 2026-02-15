import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ============================================
// Hook: useMetaAds
// Manages Meta Ads campaigns, insights, audiences, creatives, adsets, balance
// ============================================

export interface MetaAdCampaign {
  id: string;
  tenant_id: string;
  meta_campaign_id: string;
  ad_account_id: string;
  name: string;
  status: string;
  objective: string | null;
  buying_type: string | null;
  daily_budget_cents: number | null;
  lifetime_budget_cents: number | null;
  bid_strategy: string | null;
  start_time: string | null;
  stop_time: string | null;
  special_ad_categories: string[];
  metadata: Record<string, any>;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MetaAdInsight {
  id: string;
  tenant_id: string;
  campaign_id: string | null;
  meta_campaign_id: string;
  date_start: string;
  date_stop: string;
  impressions: number;
  clicks: number;
  spend_cents: number;
  reach: number;
  cpc_cents: number;
  cpm_cents: number;
  ctr: number;
  conversions: number;
  conversion_value_cents: number;
  roas: number;
  frequency: number;
  meta_ad_campaigns?: { name: string; status: string; objective: string };
}

export interface MetaAdsSummary {
  impressions: number;
  clicks: number;
  spend_cents: number;
  reach: number;
  conversions: number;
  conversion_value_cents: number;
  ctr: number;
  roas: number;
}

export interface MetaAdAdset {
  id: string;
  tenant_id: string;
  meta_adset_id: string;
  meta_campaign_id: string;
  campaign_id: string | null;
  ad_account_id: string;
  name: string;
  status: string;
  optimization_goal: string | null;
  billing_event: string | null;
  bid_amount_cents: number | null;
  daily_budget_cents: number | null;
  lifetime_budget_cents: number | null;
  targeting: Record<string, any>;
  start_time: string | null;
  end_time: string | null;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface MetaAdAccountBalance {
  id: string;
  name: string;
  balance_cents: number;
  amount_spent_cents: number;
  currency: string;
  account_status: number;
}

export function useMetaAds() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Invoke edge function helper
  const invoke = useCallback(async (fn: string, body: Record<string, any>) => {
    const { data, error } = await supabase.functions.invoke(fn, {
      body: { tenant_id: tenantId, ...body },
    });
    if (error) throw error;
    if (data && !data.success) throw new Error(data.error || "Erro desconhecido");
    return data;
  }, [tenantId]);

  // ============ CAMPAIGNS ============
  const campaignsQuery = useQuery({
    queryKey: ["meta-ads-campaigns", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meta_ad_campaigns")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      return (data || []) as MetaAdCampaign[];
    },
    enabled: !!tenantId,
  });

  const syncCampaigns = useMutation({
    mutationFn: () => invoke("meta-ads-campaigns", { action: "sync" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
      toast.success(`${data.data?.synced || 0} campanhas sincronizadas`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createCampaign = useMutation({
    mutationFn: (params: { name: string; objective: string; status?: string; daily_budget_cents?: number }) =>
      invoke("meta-ads-campaigns", { action: "create", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
      toast.success("Campanha criada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateCampaign = useMutation({
    mutationFn: (params: { meta_campaign_id: string; name?: string; status?: string; daily_budget_cents?: number }) =>
      invoke("meta-ads-campaigns", { action: "update", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
      toast.success("Campanha atualizada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteCampaign = useMutation({
    mutationFn: (metaCampaignId: string) =>
      invoke("meta-ads-campaigns", { action: "delete", meta_campaign_id: metaCampaignId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
      toast.success("Campanha arquivada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ AD SETS ============
  const adsetsQuery = useQuery({
    queryKey: ["meta-ads-adsets", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meta_ad_adsets" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      return (data || []) as unknown as MetaAdAdset[];
    },
    enabled: !!tenantId,
  });

  const syncAdsets = useMutation({
    mutationFn: (params?: { meta_campaign_id?: string }) =>
      invoke("meta-ads-adsets", { action: "sync", ...params }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-adsets"] });
      toast.success(`${data.data?.synced || 0} conjuntos sincronizados`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateAdset = useMutation({
    mutationFn: (params: { meta_adset_id: string; name?: string; status?: string; daily_budget_cents?: number }) =>
      invoke("meta-ads-adsets", { action: "update", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-adsets"] });
      toast.success("Conjunto atualizado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ ACCOUNT BALANCE ============
  const balanceQuery = useQuery({
    queryKey: ["meta-ads-balance", tenantId],
    queryFn: async () => {
      const result = await invoke("meta-ads-adsets", { action: "balance" });
      return (result.data || []) as MetaAdAccountBalance[];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000, // 5 minutes cache
  });

  // ============ INSIGHTS ============
  const insightsQuery = useQuery({
    queryKey: ["meta-ads-insights", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meta_ad_insights")
        .select("*, meta_ad_campaigns(name, status, objective)")
        .eq("tenant_id", tenantId!)
        .order("date_start", { ascending: false })
        .limit(500);
      return (data || []) as MetaAdInsight[];
    },
    enabled: !!tenantId,
  });

  const syncInsights = useMutation({
    mutationFn: (params?: { date_preset?: string }) =>
      invoke("meta-ads-insights", { action: "sync", ...params }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-insights"] });
      toast.success(`${data.data?.synced || 0} métricas sincronizadas`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ AUDIENCES ============
  const audiencesQuery = useQuery({
    queryKey: ["meta-ads-audiences", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meta_ad_audiences")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const syncAudiences = useMutation({
    mutationFn: () => invoke("meta-ads-audiences", { action: "sync" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-audiences"] });
      toast.success(`${data.data?.synced || 0} públicos sincronizados`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ CREATIVES ============
  const creativesQuery = useQuery({
    queryKey: ["meta-ads-creatives", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meta_ad_creatives")
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  const syncCreatives = useMutation({
    mutationFn: () => invoke("meta-ads-creatives", { action: "sync" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-creatives"] });
      toast.success(`${data.data?.synced || 0} criativos sincronizados`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ SYNC ALL ============
  const syncAll = useMutation({
    mutationFn: async () => {
      await Promise.allSettled([
        invoke("meta-ads-campaigns", { action: "sync" }),
        invoke("meta-ads-insights", { action: "sync" }),
        invoke("meta-ads-audiences", { action: "sync" }),
        invoke("meta-ads-creatives", { action: "sync" }),
        invoke("meta-ads-adsets", { action: "sync" }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-ads-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-insights"] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-audiences"] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-creatives"] });
      queryClient.invalidateQueries({ queryKey: ["meta-ads-adsets"] });
      toast.success("Dados sincronizados com a Meta");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    campaigns: campaignsQuery.data || [],
    campaignsLoading: campaignsQuery.isLoading,
    insights: insightsQuery.data || [],
    insightsLoading: insightsQuery.isLoading,
    audiences: audiencesQuery.data || [],
    audiencesLoading: audiencesQuery.isLoading,
    creatives: creativesQuery.data || [],
    creativesLoading: creativesQuery.isLoading,
    adsets: adsetsQuery.data || [],
    adsetsLoading: adsetsQuery.isLoading,
    accountBalances: balanceQuery.data || [],
    balanceLoading: balanceQuery.isLoading,
    syncCampaigns,
    syncInsights,
    syncAudiences,
    syncCreatives,
    syncAdsets,
    syncAll,
    createCampaign,
    updateCampaign,
    updateAdset,
    deleteCampaign,
  };
}
