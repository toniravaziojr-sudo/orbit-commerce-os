// =============================================
// USE PLATFORM ANNOUNCEMENTS HOOK
// Fetches active platform announcements for header display
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface PlatformAnnouncement {
  id: string;
  title: string;
  message: string;
  variant: 'info' | 'warning' | 'error' | 'success';
  link_url: string | null;
  link_text: string | null;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

/**
 * Fetch active platform announcements for display in the header
 */
export function usePlatformAnnouncements() {
  const { currentTenant } = useAuth();
  
  return useQuery({
    queryKey: ['platform-announcements-active'],
    queryFn: async (): Promise<PlatformAnnouncement[]> => {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from('platform_announcements')
        .select('*')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('created_at', { ascending: false })
        .limit(5);
      
      if (error) {
        console.error('Error fetching platform announcements:', error);
        return [];
      }
      
      return (data || []) as PlatformAnnouncement[];
    },
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    enabled: !!currentTenant?.id,
  });
}
