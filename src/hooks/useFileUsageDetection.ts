import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileItem } from '@/hooks/useFiles';
import { useEffect } from 'react';

export interface FileUsage {
  type: 'logo' | 'favicon';
  label: string;
}

export interface FileUsageMap {
  [fileId: string]: FileUsage[];
}

/**
 * Extracts the base storage path from a URL (removes query params and version)
 */
function extractStoragePathFromUrl(url: string | null): string | null {
  if (!url) return null;
  
  // Remove query params (cache busting, version, etc.)
  const urlWithoutParams = url.split('?')[0];
  
  // Extract path from Supabase storage URL
  // Pattern: .../storage/v1/object/public/{bucket}/{path}
  const match = urlWithoutParams.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
  return match ? match[1] : null;
}

/**
 * Compares two URLs/paths to see if they refer to the same file
 */
function urlsMatch(url1: string | null, url2: string | null): boolean {
  if (!url1 || !url2) return false;
  
  // Remove query params for comparison
  const clean1 = url1.split('?')[0];
  const clean2 = url2.split('?')[0];
  
  // Direct match
  if (clean1 === clean2) return true;
  
  // Check if one contains the other (path inside URL)
  if (clean1.includes(clean2) || clean2.includes(clean1)) return true;
  
  // Extract and compare storage paths
  const path1 = extractStoragePathFromUrl(url1);
  const path2 = extractStoragePathFromUrl(url2);
  if (path1 && path2 && path1 === path2) return true;
  
  return false;
}

/**
 * Hook to detect which files are currently in use by store_settings (logo/favicon)
 * with real-time updates when store_settings changes.
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
        .select('logo_url, favicon_url, updated_at')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
    // Reduce stale time for more responsive updates
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
   * Check if a file is in use and return usage details
   */
  const getFileUsage = (file: FileItem): FileUsage[] => {
    if (!storeSettings || file.is_folder) return [];

    const usages: FileUsage[] = [];

    // Get file identifiers
    const metadata = file.metadata as Record<string, unknown> | null;
    const fileUrl = metadata?.url as string | undefined;
    const fileSource = metadata?.source as string | undefined;
    const filePath = file.storage_path;

    // Check logo
    if (storeSettings.logo_url) {
      const isLogoMatch = 
        urlsMatch(fileUrl || null, storeSettings.logo_url) ||
        urlsMatch(filePath, storeSettings.logo_url) ||
        (storeSettings.logo_url.includes(filePath)) ||
        (fileSource === 'storefront_logo');
      
      if (isLogoMatch) {
        usages.push({ type: 'logo', label: 'Logo' });
      }
    }

    // Check favicon
    if (storeSettings.favicon_url) {
      const isFaviconMatch = 
        urlsMatch(fileUrl || null, storeSettings.favicon_url) ||
        urlsMatch(filePath, storeSettings.favicon_url) ||
        (storeSettings.favicon_url.includes(filePath)) ||
        (fileSource === 'storefront_favicon');
      
      if (isFaviconMatch) {
        usages.push({ type: 'favicon', label: 'Favicon' });
      }
    }

    return usages;
  };

  /**
   * Check if file is in use
   */
  const isFileInUse = (file: FileItem): boolean => {
    return getFileUsage(file).length > 0;
  };

  return {
    storeSettings,
    getFileUsage,
    isFileInUse,
    refetchUsage: refetchSettings,
  };
}
