/**
 * @deprecated Use useTenantAccess().showStatusIndicators instead.
 * This hook is kept for backwards compatibility.
 */
import { useTenantAccess } from '@/hooks/useTenantAccess';

export function useIsSpecialTenant() {
  const { showStatusIndicators, isLoading } = useTenantAccess();

  return {
    isSpecialTenant: showStatusIndicators,
    isRespeiteOHomem: false, // Deprecated
    isLoading,
  };
}
