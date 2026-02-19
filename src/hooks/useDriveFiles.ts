import { useState, useCallback, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { FileItem } from '@/hooks/useFiles';

export type DriveFileType = 'image' | 'video' | 'document' | 'all';

export interface PathItem {
  id: string | null;
  name: string;
}

export interface UseDriveFilesOptions {
  initialFolderId?: string | null;
  fileType?: DriveFileType;
  initialSearch?: string;
}

// Determine which bucket a file belongs to based on metadata or path
function getBucketForFile(file: FileItem): string {
  const metadata = file.metadata as Record<string, unknown> | null;
  const source = metadata?.source as string | undefined;
  const bucket = metadata?.bucket as string | undefined;
  
  if (bucket) return bucket;
  if (source?.startsWith('storefront_') || file.storage_path.includes('tenants/')) {
    return 'store-assets';
  }
  return 'tenant-files';
}

// Get MIME type patterns for filtering
function getMimePatterns(fileType: DriveFileType): string[] {
  switch (fileType) {
    case 'image':
      return ['image/'];
    case 'video':
      return ['video/'];
    case 'document':
      return ['application/pdf', 'application/msword', 'application/vnd.', 'text/'];
    case 'all':
    default:
      return [];
  }
}

export function useDriveFiles(options: UseDriveFilesOptions = {}) {
  const { currentTenant } = useAuth();
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(options.initialFolderId ?? null);
  const [searchQuery, setSearchQuery] = useState(options.initialSearch ?? '');
  const [fileType, setFileType] = useState<DriveFileType>(options.fileType ?? 'all');

  // Fetch files for current folder
  const { data: filesData, isLoading: isLoadingFiles } = useQuery({
    queryKey: ['drive-files', currentTenant?.id, currentFolderId, searchQuery, fileType],
    queryFn: async () => {
      if (!currentTenant?.id) return { files: [], folders: [] };

      let query = supabase
        .from('files')
        .select('*')
        .eq('tenant_id', currentTenant.id);

      // If searching, search across all files
      if (searchQuery.trim()) {
        query = query.ilike('original_name', `%${searchQuery.trim()}%`);
      } else {
        // Otherwise, filter by current folder
        if (currentFolderId) {
          query = query.eq('folder_id', currentFolderId);
        } else {
          query = query.is('folder_id', null);
        }
      }

      query = query
        .order('is_system_folder', { ascending: false })
        .order('is_folder', { ascending: false })
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;

      const items = data as FileItem[];
      
      // Separate folders and files
      let folders = items.filter(item => item.is_folder);
      let files = items.filter(item => !item.is_folder);

      // Apply file type filter
      if (fileType !== 'all') {
        const mimePatterns = getMimePatterns(fileType);
        files = files.filter(file => {
          if (!file.mime_type) return false;
          return mimePatterns.some(pattern => file.mime_type?.startsWith(pattern));
        });
      }

      return { files, folders };
    },
    enabled: !!currentTenant?.id,
  });

  // Fetch all folders for breadcrumb path calculation
  const { data: allFolders } = useQuery({
    queryKey: ['drive-all-folders', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('files')
        .select('id, original_name, folder_id, is_system_folder')
        .eq('tenant_id', currentTenant.id)
        .eq('is_folder', true)
        .order('original_name', { ascending: true });

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  // Calculate breadcrumb path
  const currentPath = useMemo((): PathItem[] => {
    const path: PathItem[] = [{ id: null, name: 'Meu Drive' }];
    
    if (!currentFolderId || !allFolders) return path;

    const buildPath = (folderId: string | null): PathItem[] => {
      if (!folderId) return [];
      
      const folder = allFolders.find(f => f.id === folderId);
      if (!folder) return [];

      const parentPath = folder.folder_id ? buildPath(folder.folder_id) : [];
      return [...parentPath, { id: folder.id, name: folder.original_name }];
    };

    return [...path, ...buildPath(currentFolderId)];
  }, [currentFolderId, allFolders]);

  // Navigate to a folder
  const navigateTo = useCallback((folderId: string | null) => {
    setCurrentFolderId(folderId);
    setSearchQuery(''); // Clear search when navigating
  }, []);

  // Navigate up to parent
  const navigateUp = useCallback(() => {
    if (!currentFolderId || !allFolders) {
      setCurrentFolderId(null);
      return;
    }

    const currentFolder = allFolders.find(f => f.id === currentFolderId);
    setCurrentFolderId(currentFolder?.folder_id ?? null);
  }, [currentFolderId, allFolders]);

  // Get file URL (sync version that returns URL directly for display)
  const getFileUrl = useCallback(async (file: FileItem): Promise<string | null> => {
    try {
      const metadata = file.metadata as Record<string, unknown> | null;
      
      // 1. Check if there's a direct URL in metadata
      const metadataUrl = metadata?.url as string | undefined;
      if (metadataUrl) {
        return metadataUrl;
      }
      
      // 2. Use bucket + storage_path to get public URL
      const bucket = getBucketForFile(file);
      
      // Try public URL first
      const { data: publicData } = supabase.storage
        .from(bucket)
        .getPublicUrl(file.storage_path);
      
      if (publicData?.publicUrl) {
        return publicData.publicUrl;
      }
      
      // Fallback to signed URL
      const { data: signedData, error } = await supabase.storage
        .from(bucket)
        .createSignedUrl(file.storage_path, 3600);

      if (error) {
        console.error('Error getting signed URL:', error);
        return null;
      }
      
      return signedData?.signedUrl || null;
    } catch (err) {
      console.error('Error in getFileUrl:', err);
      return null;
    }
  }, []);

  // Format file size for display
  const formatFileSize = useCallback((bytes: number | null): string => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  return {
    files: filesData?.files ?? [],
    folders: filesData?.folders ?? [],
    currentPath,
    currentFolderId,
    isLoading: isLoadingFiles,
    searchQuery,
    fileType,
    // Actions
    navigateTo,
    navigateUp,
    setSearchQuery,
    setFileType,
    getFileUrl,
    formatFileSize,
  };
}
