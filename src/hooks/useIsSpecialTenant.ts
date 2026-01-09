import { useAuth } from '@/hooks/useAuth';
import { useTenantType } from '@/hooks/useTenantType';
import { RESPEITE_O_HOMEM_TENANT_ID } from '@/config/tenant-anchors';

/**
 * Hook to check if the current tenant is the special "Respeite o Homem" tenant
 * Used for showing module status indicators and other special tenant features
 */
export function useIsSpecialTenant() {
  const { currentTenant } = useAuth();
  const { isSpecial, isLoading } = useTenantType();

  // Check by ID (primary) or by is_special flag (secondary)
  const isRespeiteOHomem = currentTenant?.id === RESPEITE_O_HOMEM_TENANT_ID;
  const isSpecialTenant = isRespeiteOHomem || isSpecial;

  return {
    isSpecialTenant,
    isRespeiteOHomem,
    isLoading,
  };
}
