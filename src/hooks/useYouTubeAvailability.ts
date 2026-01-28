// ============================================
// USE YOUTUBE AVAILABILITY - Check if YouTube is available for current tenant
// ============================================

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { usePlatformOperator } from "./usePlatformOperator";

interface YouTubeAvailability {
  isAvailable: boolean;
  reason?: 'platform_admin' | 'feature_enabled' | 'admin_tenant' | 'not_enabled';
  rolloutStatus?: string;
}

/**
 * Hook to check if YouTube integration is available for the current tenant.
 * 
 * YouTube follows a staged rollout:
 * 1. Platform admins always have access
 * 2. Admin tenant (owned by platform admin) has access
 * 3. All tenants have access only when youtube_enabled_for_all_tenants is true
 * 
 * This prevents issues with:
 * - OAuth Consent Screen in "Testing" mode (only test users can authorize)
 * - Unverified app user cap limits
 */
export function useYouTubeAvailability() {
  const { currentTenant } = useAuth();
  const { isPlatformOperator } = usePlatformOperator();

  const { data, isLoading } = useQuery({
    queryKey: ["youtube-availability", currentTenant?.id, isPlatformOperator],
    queryFn: async (): Promise<YouTubeAvailability> => {
      // Platform operators always have access
      if (isPlatformOperator) {
        return { isAvailable: true, reason: 'platform_admin' };
      }

      if (!currentTenant?.id) {
        return { isAvailable: false, reason: 'not_enabled' };
      }

      // Check feature flag
      const { data: flag } = await supabase
        .from("billing_feature_flags")
        .select("is_enabled, metadata")
        .eq("flag_key", "youtube_enabled_for_all_tenants")
        .single();

      if (flag?.is_enabled) {
        return { 
          isAvailable: true, 
          reason: 'feature_enabled',
          rolloutStatus: (flag.metadata as any)?.rollout_status 
        };
      }

      // Check if tenant owner is a platform admin (admin tenant)
      const { data: isAdminTenant } = await supabase.rpc(
        'is_youtube_available_for_tenant',
        { p_tenant_id: currentTenant.id }
      );

      if (isAdminTenant) {
        return { 
          isAvailable: true, 
          reason: 'admin_tenant',
          rolloutStatus: (flag?.metadata as any)?.rollout_status || 'testing'
        };
      }

      return { 
        isAvailable: false, 
        reason: 'not_enabled',
        rolloutStatus: (flag?.metadata as any)?.rollout_status || 'testing'
      };
    },
    enabled: !!currentTenant?.id || isPlatformOperator,
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

  return {
    isAvailable: data?.isAvailable ?? false,
    reason: data?.reason,
    rolloutStatus: data?.rolloutStatus,
    isLoading,
  };
}
