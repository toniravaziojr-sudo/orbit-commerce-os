import { useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { showErrorToast } from "@/lib/error-toast";

export interface TikTokAdAsset {
  id: string;
  tenant_id: string;
  tiktok_asset_id: string;
  advertiser_id: string;
  asset_type: string;
  file_name: string | null;
  file_url: string | null;
  width: number;
  height: number;
  duration: number;
  file_size: number;
  format: string | null;
  signature: string | null;
  metadata: Record<string, any>;
  synced_at: string;
  created_at: string;
  updated_at: string;
}

export function useTikTokAdAssets() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  const invoke = useCallback(
    async (body: Record<string, any>) => {
      const { data, error } = await supabase.functions.invoke("tiktok-ads-assets", {
        body: { tenant_id: tenantId, ...body },
      });
      if (error) throw error;
      if (data && !data.success) throw new Error(data.error || "Erro desconhecido");
      return data;
    },
    [tenantId]
  );

  const assetsQuery = useQuery({
    queryKey: ["tiktok-ads-assets", tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from("tiktok_ad_assets" as any)
        .select("*")
        .eq("tenant_id", tenantId!)
        .order("updated_at", { ascending: false })
        .limit(200);
      return (data || []) as unknown as TikTokAdAsset[];
    },
    enabled: !!tenantId,
  });

  const syncAssets = useMutation({
    mutationFn: () => invoke({ action: "sync" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-assets"] });
      toast.success(`${data.data?.synced || 0} ativos sincronizados`);
    },
    onError: (err) => showErrorToast(err, { module: "anúncios", action: "processar" }),
  });

  const uploadImage = useMutation({
    mutationFn: (params: { image_url: string; file_name?: string }) =>
      invoke({ action: "upload_image", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-assets"] });
      toast.success("Imagem enviada ao TikTok");
    },
    onError: (err) => showErrorToast(err, { module: "anúncios", action: "processar" }),
  });

  const uploadVideo = useMutation({
    mutationFn: (params: { video_url: string; file_name?: string }) =>
      invoke({ action: "upload_video", ...params }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tiktok-ads-assets"] });
      toast.success("Vídeo enviado ao TikTok");
    },
    onError: (err) => showErrorToast(err, { module: "anúncios", action: "processar" }),
  });

  const images = (assetsQuery.data || []).filter((a) => a.asset_type === "image");
  const videos = (assetsQuery.data || []).filter((a) => a.asset_type === "video");

  return {
    assets: assetsQuery.data || [],
    images,
    videos,
    assetsLoading: assetsQuery.isLoading,
    syncAssets,
    uploadImage,
    uploadVideo,
  };
}
