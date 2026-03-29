import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';

export function useTikTokContent() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // List videos from DB
  const { data: videos = [], isLoading: videosLoading } = useQuery({
    queryKey: ['tiktok-content-videos', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tiktok_content_videos')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('created_at', { ascending: false });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // List analytics from DB
  const { data: analytics = [], isLoading: analyticsLoading } = useQuery({
    queryKey: ['tiktok-content-analytics', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tiktok_content_analytics')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('date', { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Sync videos from TikTok
  const syncVideos = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-content-publish', {
        body: { action: 'sync' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Sync failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-content-videos'] });
      toast.success(`${data.synced} vídeos sincronizados`);
    },
    onError: (err: Error) => {
      onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'sincronizar' }),
    },
  });

  // Sync analytics
  const syncAnalytics = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-content-analytics', {
        body: { action: 'sync' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Sync failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-content-analytics'] });
      toast.success(`Analytics sincronizados para ${data.synced} vídeos`);
    },
    onError: (err: Error) => {
      onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'sincronizar' }),
    },
  });

  // Init upload
  const initUpload = useMutation({
    mutationFn: async (params: { title: string; description?: string; privacy_level?: string; video_size: number }) => {
      const { data, error } = await supabase.functions.invoke('tiktok-content-publish', {
        body: { action: 'init_upload', ...params },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Init upload failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-content-videos'] });
    },
    onError: (err: Error) => {
      onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'carregar' }),
    },
  });

  // Check status
  const checkStatus = useMutation({
    mutationFn: async (publishId: string) => {
      const { data, error } = await supabase.functions.invoke('tiktok-content-publish', {
        body: { action: 'check_status', publish_id: publishId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Status check failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-content-videos'] });
    },
  });

  // Delete video
  const deleteVideo = useMutation({
    mutationFn: async (videoId: string) => {
      const { data, error } = await supabase.functions.invoke('tiktok-content-publish', {
        body: { action: 'delete', video_id: videoId },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Delete failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-content-videos'] });
      toast.success('Vídeo removido');
    },
    onError: (err: Error) => {
      onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'excluir' }),
    },
  });

  // Sync all
  const syncAll = useMutation({
    mutationFn: async () => {
      await syncVideos.mutateAsync();
      await syncAnalytics.mutateAsync();
    },
  });

  return {
    videos,
    analytics,
    videosLoading,
    analyticsLoading,
    syncVideos,
    syncAnalytics,
    syncAll,
    initUpload,
    checkStatus,
    deleteVideo,
  };
}
