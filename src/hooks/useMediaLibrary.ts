// =============================================
// MEDIA LIBRARY HOOK - Manage reusable images
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type MediaVariant = 'desktop' | 'mobile';

export interface MediaItem {
  id: string;
  tenant_id: string;
  file_path: string;
  file_url: string;
  file_name: string;
  variant: MediaVariant;
  file_size?: number;
  mime_type?: string;
  created_at: string;
}

export function useMediaLibrary(variant?: MediaVariant) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Fetch media items for the tenant (optionally filtered by variant)
  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ['media-library', tenantId, variant],
    queryFn: async () => {
      if (!tenantId) return [];
      
      let query = supabase
        .from('media_library')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });
      
      if (variant) {
        query = query.eq('variant', variant);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching media library:', error);
        return [];
      }
      
      return data as MediaItem[];
    },
    enabled: !!tenantId,
  });

  // Register a new media item
  const registerMedia = useMutation({
    mutationFn: async (params: {
      filePath: string;
      fileUrl: string;
      fileName: string;
      variant: MediaVariant;
      fileSize?: number;
      mimeType?: string;
    }) => {
      if (!tenantId) throw new Error('Tenant não encontrado');

      const { data, error } = await supabase
        .from('media_library')
        .insert({
          tenant_id: tenantId,
          file_path: params.filePath,
          file_url: params.fileUrl,
          file_name: params.fileName,
          variant: params.variant,
          file_size: params.fileSize,
          mime_type: params.mimeType,
        })
        .select()
        .single();

      if (error) {
        // Ignore duplicate errors (image already registered)
        if (error.code === '23505') {
          return null;
        }
        throw error;
      }

      return data as MediaItem;
    },
    onSuccess: () => {
      // Invalidate both variants and general query
      queryClient.invalidateQueries({ queryKey: ['media-library', tenantId] });
    },
  });

  // Delete a media item
  const deleteMedia = useMutation({
    mutationFn: async (mediaId: string) => {
      const { error } = await supabase
        .from('media_library')
        .delete()
        .eq('id', mediaId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-library', tenantId] });
    },
  });

  return {
    mediaItems,
    isLoading,
    registerMedia,
    deleteMedia,
  };
}
