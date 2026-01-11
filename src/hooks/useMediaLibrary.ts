// =============================================
// MEDIA LIBRARY HOOK - Agora usa tabela `files` (Uploads do sistema)
// =============================================

import { useQuery } from '@tanstack/react-query';
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

// Helper to determine media type from mime_type or file extension
export function getMediaType(mimeType?: string, fileUrl?: string): 'image' | 'video' | 'unknown' {
  // Check mime_type first
  if (mimeType) {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
  }
  
  // Fallback: check file extension in URL
  if (fileUrl) {
    const lowerUrl = fileUrl.toLowerCase();
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp', '.ico'];
    const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
    
    if (imageExtensions.some(ext => lowerUrl.includes(ext))) return 'image';
    if (videoExtensions.some(ext => lowerUrl.includes(ext))) return 'video';
  }
  
  return 'unknown';
}

interface UseMediaLibraryOptions {
  variant?: MediaVariant;
  mediaType?: MediaType;
}

interface FileMetadata {
  variant?: string;
  url?: string;
  public_url?: string;
  [key: string]: unknown;
}

export function useMediaLibrary(variantOrOptions?: MediaVariant | UseMediaLibraryOptions) {
  const { currentTenant } = useAuth();
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

  // Fetch media items from `files` table (within system folder tree)
  const { data: mediaItems = [], isLoading } = useQuery({
    queryKey: ['media-library-files', tenantId, variant, mediaType],
    queryFn: async () => {
      if (!tenantId) return [];

      // First, get the system folder ID
      const { data: systemFolder } = await supabase
        .from('files')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('is_system_folder', true)
        .maybeSingle();

      if (!systemFolder) return [];

      // Get all folder IDs within system tree (system folder + descendants)
      const { data: allFolders } = await supabase
        .from('files')
        .select('id, folder_id')
        .eq('tenant_id', tenantId)
        .eq('is_folder', true);

      const systemFolderIds = new Set<string>([systemFolder.id]);
      
      // Build tree of system folder descendants
      if (allFolders) {
        let changed = true;
        while (changed) {
          changed = false;
          for (const folder of allFolders) {
            if (folder.folder_id && systemFolderIds.has(folder.folder_id) && !systemFolderIds.has(folder.id)) {
              systemFolderIds.add(folder.id);
              changed = true;
            }
          }
        }
      }

      // Now fetch all FILES (not folders) within system tree
      const { data: files, error } = await supabase
        .from('files')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('is_folder', false)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching files for media library:', error);
        return [];
      }

      // Filter to only files within system folder tree
      const systemFiles = files.filter(f => 
        f.folder_id && systemFolderIds.has(f.folder_id)
      );

      // Transform to MediaItem format
      let items: MediaItem[] = systemFiles.map(file => {
        // Parse metadata safely
        const metadata = (typeof file.metadata === 'object' && file.metadata !== null ? file.metadata : {}) as FileMetadata;
        
        // Determine variant from metadata or filename
        const fileVariant: MediaVariant = 
          metadata.variant === 'mobile' ? 'mobile' :
          file.filename?.toLowerCase().includes('mobile') ? 'mobile' : 'desktop';

        // Get URL from metadata or construct from storage
        const fileUrl = metadata.url || metadata.public_url || '';

        return {
          id: file.id,
          tenant_id: file.tenant_id,
          file_path: file.storage_path || '',
          file_url: fileUrl,
          file_name: file.filename || 'Sem nome',
          variant: fileVariant,
          file_size: file.size_bytes,
          mime_type: file.mime_type,
          created_at: file.created_at,
        };
      });

      // Filter by variant if specified
      if (variant) {
        items = items.filter(item => item.variant === variant);
      }

      // Filter by media type
      if (mediaType === 'image') {
        items = items.filter(item => {
          const type = getMediaType(item.mime_type, item.file_url);
          return type === 'image' || type === 'unknown';
        });
      } else if (mediaType === 'video') {
        items = items.filter(item => {
          const type = getMediaType(item.mime_type, item.file_url);
          return type === 'video';
        });
      }

      return items;
    },
    enabled: !!tenantId,
  });

  return {
    mediaItems,
    isLoading,
  };
}
