import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-toast';

export function useTikTokContentProfile() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Get profile from local connection data
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ['tiktok-content-profile', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tiktok_content_connections')
        .select('display_name, avatar_url, bio_description, follower_count, following_count, likes_count, video_count, profile_synced_at')
        .eq('tenant_id', tenantId!)
        .eq('is_active', true)
        .single();
      return data;
    },
    enabled: !!tenantId,
  });

  // Sync profile from TikTok API
  const syncProfile = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-content-profile', {
        body: { action: 'sync_profile' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Sync failed');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-content-profile'] });
      toast.success('Perfil sincronizado');
    },
    onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'sincronizar perfil' }),
  });

  // Scheduled posts
  const { data: scheduledPosts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['tiktok-content-scheduled', tenantId],
    queryFn: async () => {
      const { data } = await supabase
        .from('tiktok_content_scheduled_posts')
        .select('*')
        .eq('tenant_id', tenantId!)
        .order('scheduled_at', { ascending: true });
      return data || [];
    },
    enabled: !!tenantId,
  });

  // Create scheduled post
  const createScheduledPost = useMutation({
    mutationFn: async (params: {
      title: string;
      description?: string;
      privacy_level?: string;
      video_storage_path?: string;
      video_size?: number;
      scheduled_at: string;
    }) => {
      const { data, error } = await supabase
        .from('tiktok_content_scheduled_posts')
        .insert({
          tenant_id: tenantId!,
          created_by: (await supabase.auth.getUser()).data.user!.id,
          ...params,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-content-scheduled'] });
      toast.success('Post agendado com sucesso');
    },
    onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'agendar post' }),
  });

  // Delete scheduled post
  const deleteScheduledPost = useMutation({
    mutationFn: async (postId: string) => {
      const { error } = await supabase
        .from('tiktok_content_scheduled_posts')
        .delete()
        .eq('id', postId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-content-scheduled'] });
      toast.success('Post removido');
    },
    onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'excluir post' }),
  });

  // Trigger publish of due posts
  const publishScheduled = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('tiktok-content-profile', {
        body: { action: 'publish_scheduled' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Publish failed');
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-content-scheduled'] });
      toast.success(`${data.published} post(s) publicado(s)`);
    },
    onError: (err) => showErrorToast(err, { module: 'tiktok', action: 'publicar agendados' }),
  });

  return {
    profile,
    profileLoading,
    syncProfile,
    scheduledPosts,
    postsLoading,
    createScheduledPost,
    deleteScheduledPost,
    publishScheduled,
  };
}
