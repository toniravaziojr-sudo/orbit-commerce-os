/**
 * @deprecated Use useTenantAccess instead. This hook is kept for backwards compatibility.
 * It re-exports values from useTenantAccess to avoid breaking existing consumers.
 */
import { useTenantAccess } from '@/hooks/useTenantAccess';
import type { TenantPlan } from '@/config/feature-access';

export type TenantType = 'platform' | 'customer';

export function useTenantType() {
  const access = useTenantAccess();
  
  return {
    tenantType: access.tenantType,
    plan: access.plan,
    isSpecial: access.isSpecial,
    isPlatformTenant: access.isPlatform,
    isCustomerTenant: access.isCustomerTenant,
    isUnlimited: access.isUnlimited,
    planLevel: access.planLevel,
    isLoading: access.isLoading,
  };
}