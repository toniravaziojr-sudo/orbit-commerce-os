// =============================================
// USE TIKTOK ADS
// Hook for managing TikTok Ads campaigns and insights
// Follows same pattern as useMetaAds
// =============================================

import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface TikTokAdCampaign {
  id: string;
  tenant_id: string;
  tiktok_campaign_id: string;
  advertiser_id: string;
  name: string;
  status: string;
  objective_type: string | null;
  budget_mode: string | null;
  budget_cents: number | null;
  bid_type: string | null;
  optimize_goal: string | null;
  start_time: string | null;
  end_time: string | null;
  campaign_type: string | null;
  special_industries: string[];
  metadata: Record<string, any>;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export interface TikTokAdInsight {
  id: string;
  tenant_id: string;
  campaign_id: string | null;
  tiktok_campaign_id: string;
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
  video_views: number;
  video_watched_2s: number;
  video_watched_6s: number;
  likes: number;
  comments: number;
  shares: number;
  follows: number;
  tiktok_ad_campaigns?: { name: string; status: string; objective_type: string };
}

export function useTikTokAds() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

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
    queryKey: ["tiktok-ads-campaigns", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tiktok_ad_campaigns" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      return (data || []) as unknown as TikTokAdCampaign[];
    },
    enabled: !!tenantId,
  });

  const syncCampaigns = useMutation({
    mutationFn: () => invoke("tiktok-ads-campaigns", { action: "sync" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-campaigns"] });
      toast.success(`${data.data?.synced || 0} campanhas sincronizadas`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const createCampaign = useMutation({
    mutationFn: (params: { name: string; objective_type: string; budget_mode?: string; budget_cents?: number; status?: string }) =>
      invoke("tiktok-ads-campaigns", { action: "create", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-campaigns"] });
      toast.success("Campanha criada no TikTok");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateCampaign = useMutation({
    mutationFn: (params: { tiktok_campaign_id: string; name?: string; status?: string; budget_cents?: number }) =>
      invoke("tiktok-ads-campaigns", { action: "update", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-campaigns"] });
      toast.success("Campanha atualizada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteCampaign = useMutation({
    mutationFn: (tiktokCampaignId: string) =>
      invoke("tiktok-ads-campaigns", { action: "delete", tiktok_campaign_id: tiktokCampaignId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-campaigns"] });
      toast.success("Campanha removida");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ INSIGHTS ============
  const insightsQuery = useQuery({
    queryKey: ["tiktok-ads-insights", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tiktok_ad_insights" as any)
        .select("*, tiktok_ad_campaigns(name, status, objective_type)")
        .eq("tenant_id", tenantId!)
        .order("date_start", { ascending: false })
        .limit(100);
      return (data || []) as unknown as TikTokAdInsight[];
    },
    enabled: !!tenantId,
  });

  const syncInsights = useMutation({
    mutationFn: (params?: { date_start?: string; date_end?: string }) =>
      invoke("tiktok-ads-insights", { action: "sync", ...params }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-insights"] });
      toast.success(`${data.data?.synced || 0} métricas sincronizadas`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  // ============ SYNC ALL ============
  const syncAll = useMutation({
    mutationFn: async () => {
      await Promise.allSettled([
        invoke("tiktok-ads-campaigns", { action: "sync" }),
        invoke("tiktok-ads-insights", { action: "sync" }),
      ]);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-campaigns"] });
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-insights"] });
      toast.success("Dados sincronizados com o TikTok Ads");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return {
    campaigns: campaignsQuery.data || [],
    campaignsLoading: campaignsQuery.isLoading,
    insights: insightsQuery.data || [],
    insightsLoading: insightsQuery.isLoading,
    syncCampaigns,
    syncInsights,
    syncAll,
    createCampaign,
    updateCampaign,
    deleteCampaign,
  };
}
