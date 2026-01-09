import { useAuth } from '@/hooks/useAuth';
import { RESPEITE_O_HOMEM_TENANT_ID } from '@/config/tenant-anchors';

/**
 * Hook to check if the current tenant is the special "Respeite o Homem" tenant
 * Used for showing module status indicators ONLY for this specific tenant
 * Platform admins do NOT see these indicators - only the respeiteohomem tenant
 */
export function useIsSpecialTenant() {
  const { currentTenant } = useAuth();

  // Check ONLY by tenant ID - must be exactly the Respeite o Homem tenant
  const isRespeiteOHomem = currentTenant?.id === RESPEITE_O_HOMEM_TENANT_ID;

  return {
    isSpecialTenant: isRespeiteOHomem,
    isRespeiteOHomem,
    isLoading: false,
  };
}
