import { usePlatformOperator } from '@/hooks/usePlatformOperator';
import { useAdminModeSafe } from '@/contexts/AdminModeContext';

/**
 * Hook to check if module status indicators should be shown.
 * 
 * UPDATED: Status indicators (green/orange badges) are now shown ONLY for:
 * - Platform operators (admin users)
 * - When in "Minha Loja" (store) mode
 * 
 * This allows the admin to see development status while using the platform
 * as a client, while regular tenants (including respeiteohomem) see a clean UI.
 */
export function useIsSpecialTenant() {
  const { isPlatformOperator, isLoading: platformLoading } = usePlatformOperator();
  const { isStoreMode } = useAdminModeSafe();

  // Show status indicators only for platform operators in store mode
  const showStatusIndicators = isPlatformOperator && isStoreMode;

  return {
    isSpecialTenant: showStatusIndicators,
    isRespeiteOHomem: false, // Deprecated - no longer used for status indicators
    isLoading: platformLoading,
  };
}
