import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileItem } from '@/hooks/useFiles';
import { useEffect, useCallback } from 'react';

export interface FileUsage {
  type: 'logo' | 'favicon';
  label: string;
}

export interface FileUsageMap {
  [fileId: string]: FileUsage[];
}

/**
 * Normalizes a URL by removing query params (cache busting, version, etc.)
 */
function normalizeUrl(url: string | null): string | null {
  if (!url) return null;
  return url.split('?')[0].trim();
}

/**
 * Extracts bucket and storage path from a Supabase Storage URL
 * Pattern: .../storage/v1/object/public/{bucket}/{path}
 */
function extractStorageInfo(url: string | null): { bucket: string; path: string } | null {
  if (!url) return null;
  
  const cleanUrl = normalizeUrl(url);
  if (!cleanUrl) return null;
  
  const match = cleanUrl.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (match) {
    return { bucket: match[1], path: match[2] };
  }
  
  return null;
}

/**
 * Hook to detect which files are currently in use by store_settings (logo/favicon)
 * with STRICT matching logic - only ONE file per usage type.
 * 
 * Priority order for matching:
 * 1. file_id exact match (logo_file_id, favicon_file_id)
 * 2. bucket + storage_path exact match
 * 3. normalized URL exact match
 */
export function useFileUsageDetection() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  const { data: storeSettings, refetch: refetchSettings } = useQuery({
    queryKey: ['store-settings-urls', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('store_settings')
        .select('logo_url, favicon_url, logo_file_id, favicon_file_id, updated_at')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000,
  });

  // Subscribe to realtime changes on store_settings for this tenant
  useEffect(() => {
    if (!currentTenant?.id) return;

    const channel = supabase
      .channel(`store-settings-usage-${currentTenant.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'store_settings',
          filter: `tenant_id=eq.${currentTenant.id}`,
        },
        (payload) => {
          console.log('[useFileUsageDetection] Realtime update:', payload.eventType);
          // Immediate refetch on any change
          refetchSettings();
          // Also invalidate related queries
          queryClient.invalidateQueries({ queryKey: ['store-settings-urls', currentTenant.id] });
          queryClient.invalidateQueries({ queryKey: ['store-settings', currentTenant.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentTenant?.id, queryClient, refetchSettings]);

  /**
   * STRICT matching: Check if file matches a specific setting reference
   * Returns true ONLY for exact matches
   */
  const matchesReference = useCallback((
    file: FileItem,
    settingUrl: string | null,
    settingFileId: string | null
  ): boolean => {
    if (!settingUrl && !settingFileId) return false;
    if (file.is_folder) return false;

    // Priority 1: file_id exact match (strongest)
    if (settingFileId && file.id === settingFileId) {
      return true;
    }

    // If file_id is set but doesn't match, this file is NOT the current one
    if (settingFileId && file.id !== settingFileId) {
      return false;
    }

    // Priority 2 & 3: URL/path matching (only if no file_id set)
    if (!settingFileId && settingUrl) {
      const metadata = file.metadata as Record<string, unknown> | null;
      const fileUrl = metadata?.url as string | undefined;
      const fileBucket = metadata?.bucket as string | undefined;
      const filePath = file.storage_path;

      // Extract storage info from setting URL
      const settingStorageInfo = extractStorageInfo(settingUrl);
      
      // Priority 2: bucket + storage_path exact match
      if (settingStorageInfo) {
        const matchesBucketPath = (
          fileBucket === settingStorageInfo.bucket && 
          filePath === settingStorageInfo.path
        );
        if (matchesBucketPath) return true;
        
        // Also check if storage_path matches directly
        if (filePath === settingStorageInfo.path) return true;
      }

      // Priority 3: normalized URL exact match
      const normalizedFileUrl = normalizeUrl(fileUrl || null);
      const normalizedSettingUrl = normalizeUrl(settingUrl);
      
      if (normalizedFileUrl && normalizedSettingUrl && normalizedFileUrl === normalizedSettingUrl) {
        return true;
      }
    }

    return false;
  }, []);

  /**
   * Check if a file is in use and return usage details
   * STRICT: Only ONE file per usage type
   */
  const getFileUsage = useCallback((file: FileItem): FileUsage[] => {
    if (!storeSettings || file.is_folder) return [];

    const usages: FileUsage[] = [];

    // Check logo - STRICT match only
    if (matchesReference(
      file, 
      storeSettings.logo_url, 
      storeSettings.logo_file_id
    )) {
      usages.push({ type: 'logo', label: 'Logo' });
    }

    // Check favicon - STRICT match only
    if (matchesReference(
      file, 
      storeSettings.favicon_url, 
      storeSettings.favicon_file_id
    )) {
      usages.push({ type: 'favicon', label: 'Favicon' });
    }

    return usages;
  }, [storeSettings, matchesReference]);

  /**
   * Check if file is in use
   */
  const isFileInUse = useCallback((file: FileItem): boolean => {
    return getFileUsage(file).length > 0;
  }, [getFileUsage]);

  return {
    storeSettings,
    getFileUsage,
    isFileInUse,
    refetchUsage: refetchSettings,
  };
}
