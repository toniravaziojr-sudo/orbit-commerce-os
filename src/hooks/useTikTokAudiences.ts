import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

export interface TikTokAudience {
  id: string;
  tenant_id: string;
  tiktok_audience_id: string;
  advertiser_id: string;
  name: string;
  audience_type: string;
  cover_num: number;
  is_valid: boolean;
  is_expired: boolean;
  rules: Record<string, any>;
  metadata: Record<string, any>;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export function useTikTokAudiences() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const invoke = useCallback(
    async (body: Record<string, any>) => {
      const { data, error } = await supabase.functions.invoke("tiktok-ads-audiences", {
        body: { tenant_id: tenantId, ...body },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro desconhecido");
      return data;
    },
    [tenantId]
  );

  const audiencesQuery = useQuery({
    queryKey: ["tiktok-ads-audiences", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tiktok_ad_audiences" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false });
      return (data || []) as unknown as TikTokAudience[];
    },
    enabled: !!tenantId,
  });

  const syncAudiences = useMutation({
    mutationFn: () => invoke({ action: "sync" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-audiences"] });
      toast.success(`${data.data?.synced || 0} públicos sincronizados`);
    },
    onError: (err) => showErrorToast(err, { module: "anúncios", action: "processar" }),
  });

  const createAudience = useMutation({
    mutationFn: (params: { name: string; audience_type?: string; rules?: any }) =>
      invoke({ action: "create", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-audiences"] });
      toast.success("Público criado no TikTok");
    },
    onError: (err) => showErrorToast(err, { module: "anúncios", action: "processar" }),
  });

  const deleteAudience = useMutation({
    mutationFn: (tiktokAudienceId: string) =>
      invoke({ action: "delete", tiktok_audience_id: tiktokAudienceId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-audiences"] });
      toast.success("Público removido");
    },
    onError: (err) => showErrorToast(err, { module: "anúncios", action: "processar" }),
  });

  return {
    audiences: audiencesQuery.data || [],
    audiencesLoading: audiencesQuery.isLoading,
    syncAudiences,
    createAudience,
    deleteAudience,
  };
}
