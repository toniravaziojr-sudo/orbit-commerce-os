// =============================================
// MEDIA LIBRARY HOOK - Manage reusable images and videos
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type MediaVariant = 'desktop' | 'mobile';
export type MediaType = 'image' | 'video' | 'all';

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

// Helper to determine media type from mime_type
export function getMediaType(mimeType?: string): 'image' | 'video' | 'unknown' {
  if (!mimeType) return 'unknown';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  return 'unknown';
}

interface UseMediaLibraryOptions {
  variant?: MediaVariant;
  mediaType?: MediaType;
}

export function useMediaLibrary(variantOrOptions?: MediaVariant | UseMediaLibraryOptions) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();
  const tenantId = currentTenant?.id;

  // Handle both old signature (variant only) and new signature (options object)
  let variant: MediaVariant | undefined;
  let mediaType: MediaType = 'all';

  if (typeof variantOrOptions === 'string') {
    variant = variantOrOptions;
  } else if (variantOrOptions) {
    variant = variantOrOptions.variant;
    mediaType = variantOrOptions.mediaType || 'all';
  }

  // Fetch media items for the tenant (filtered by variant and mediaType)
  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ['media-library', tenantId, variant, mediaType],
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
      
      // Filter by media type client-side since PostgreSQL pattern matching is complex
      let items = data as MediaItem[];
      
      if (mediaType === 'image') {
        items = items.filter(item => item.mime_type?.startsWith('image/'));
      } else if (mediaType === 'video') {
        items = items.filter(item => item.mime_type?.startsWith('video/'));
      }
      
      return items;
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
      // Invalidate all media library queries
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
