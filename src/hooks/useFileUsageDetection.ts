import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileItem } from '@/hooks/useFiles';

export interface FileUsage {
  type: 'logo' | 'favicon';
  label: string;
}

export interface FileUsageMap {
  [fileId: string]: FileUsage[];
}

/**
 * Hook to detect which files are currently in use by store_settings (logo/favicon)
 */
export function useFileUsageDetection() {
  const { currentTenant } = useAuth();

  const { data: storeSettings } = useQuery({
    queryKey: ['store-settings-urls', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('store_settings')
        .select('logo_url, favicon_url')
        .eq('tenant_id', currentTenant.id)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!currentTenant?.id,
  });

  /**
   * Check if a file is in use and return usage details
   */
  const getFileUsage = (file: FileItem): FileUsage[] => {
    if (!storeSettings || file.is_folder) return [];

    const usages: FileUsage[] = [];

    // Check by storage_path match in URL or by metadata source
    const metadata = file.metadata as Record<string, unknown> | null;
    const fileUrl = metadata?.url as string | undefined;
    const fileSource = metadata?.source as string | undefined;

    // Check logo
    if (storeSettings.logo_url) {
      const isLogoMatch = 
        (fileUrl && storeSettings.logo_url === fileUrl) ||
        (storeSettings.logo_url.includes(file.storage_path)) ||
        (fileSource === 'storefront_logo');
      
      if (isLogoMatch) {
        usages.push({ type: 'logo', label: 'Logo' });
      }
    }

    // Check favicon
    if (storeSettings.favicon_url) {
      const isFaviconMatch = 
        (fileUrl && storeSettings.favicon_url === fileUrl) ||
        (storeSettings.favicon_url.includes(file.storage_path)) ||
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
  };
}
