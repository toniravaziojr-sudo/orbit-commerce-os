// =============================================
// USE TIKTOK AD GROUPS
// Hook for managing TikTok Ads ad groups
// =============================================

import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from '@/lib/error-toast';

export interface TikTokAdGroup {
  id: string;
  tenant_id: string;
  tiktok_adgroup_id: string;
  campaign_id: string | null;
  tiktok_campaign_id: string;
  advertiser_id: string;
  name: string;
  status: string;
  promotion_type: string | null;
  placement_type: string | null;
  bid_type: string | null;
  bid_price_cents: number | null;
  budget_mode: string | null;
  budget_cents: number | null;
  optimize_goal: string | null;
  billing_event: string | null;
  schedule_start_time: string | null;
  schedule_end_time: string | null;
  targeting: Record<string, any>;
  metadata: Record<string, any>;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TikTokAd {
  id: string;
  tenant_id: string;
  tiktok_ad_id: string;
  adgroup_id: string | null;
  tiktok_adgroup_id: string;
  tiktok_campaign_id: string;
  advertiser_id: string;
  name: string;
  status: string;
  ad_format: string | null;
  ad_text: string | null;
  landing_page_url: string | null;
  call_to_action: string | null;
  image_ids: string[];
  video_id: string | null;
  thumbnail_url: string | null;
  display_name: string | null;
  identity_id: string | null;
  identity_type: string | null;
  tracking_pixel_id: string | null;
  deeplink: string | null;
  metadata: Record<string, any>;
  synced_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useTikTokAdGroups() {
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

  // ============ AD GROUPS ============
  const adGroupsQuery = useQuery({
    queryKey: ["tiktok-ads-adgroups", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tiktok_ad_groups" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      return (data || []) as unknown as TikTokAdGroup[];
    },
    enabled: !!tenantId,
  });

  const syncAdGroups = useMutation({
    mutationFn: () => invoke("tiktok-ads-adgroups", { action: "sync" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-adgroups"] });
      toast.success(`${data.data?.synced || 0} grupos de anúncios sincronizados`);
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'sincronizar' }),
  });

  const createAdGroup = useMutation({
    mutationFn: (params: { name: string; tiktok_campaign_id: string; promotion_type?: string; budget_mode?: string; budget_cents?: number; optimize_goal?: string; status?: string }) =>
      invoke("tiktok-ads-adgroups", { action: "create", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-adgroups"] });
      toast.success("Grupo de anúncios criado");
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'criar' }),
  });

  const updateAdGroup = useMutation({
    mutationFn: (params: { tiktok_adgroup_id: string; name?: string; status?: string; budget_cents?: number; bid_price_cents?: number }) =>
      invoke("tiktok-ads-adgroups", { action: "update", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-adgroups"] });
      toast.success("Grupo de anúncios atualizado");
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'atualizar' }),
  });

  const deleteAdGroup = useMutation({
    mutationFn: (tiktokAdgroupId: string) =>
      invoke("tiktok-ads-adgroups", { action: "delete", tiktok_adgroup_id: tiktokAdgroupId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-adgroups"] });
      toast.success("Grupo de anúncios removido");
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'remover' }),
  });

  // ============ ADS ============
  const adsQuery = useQuery({
    queryKey: ["tiktok-ads-ads", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tiktok_ad_ads" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      return (data || []) as unknown as TikTokAd[];
    },
    enabled: !!tenantId,
  });

  const syncAds = useMutation({
    mutationFn: () => invoke("tiktok-ads-ads", { action: "sync" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-ads"] });
      toast.success(`${data.data?.synced || 0} anúncios sincronizados`);
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'sincronizar' }),
  });

  const createAd = useMutation({
    mutationFn: (params: { name: string; tiktok_adgroup_id: string; ad_format?: string; ad_text?: string; landing_page_url?: string; call_to_action?: string; video_id?: string; image_ids?: string[]; status?: string }) =>
      invoke("tiktok-ads-ads", { action: "create", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-ads"] });
      toast.success("Anúncio criado");
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'criar' }),
  });

  const updateAd = useMutation({
    mutationFn: (params: { tiktok_ad_id: string; name?: string; status?: string; ad_text?: string; landing_page_url?: string }) =>
      invoke("tiktok-ads-ads", { action: "update", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-ads"] });
      toast.success("Anúncio atualizado");
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'atualizar' }),
  });

  const deleteAd = useMutation({
    mutationFn: (tiktokAdId: string) =>
      invoke("tiktok-ads-ads", { action: "delete", tiktok_ad_id: tiktokAdId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-ads"] });
      toast.success("Anúncio removido");
    },
    onError: (err) => showErrorToast(err, { module: 'anúncios', action: 'remover' }),
  });

  return {
    adGroups: adGroupsQuery.data || [],
    adGroupsLoading: adGroupsQuery.isLoading,
    ads: adsQuery.data || [],
    adsLoading: adsQuery.isLoading,
    syncAdGroups,
    syncAds,
    createAdGroup,
    updateAdGroup,
    deleteAdGroup,
    createAd,
    updateAd,
    deleteAd,
  };
}
