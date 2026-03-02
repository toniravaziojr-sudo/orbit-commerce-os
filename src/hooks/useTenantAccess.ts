import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';
import { useAdminModeSafe } from '@/contexts/AdminModeContext';
import { 
  TenantPlan, 
  planLevel, 
  isFeatureAllowed,
} from '@/config/feature-access';

export type TenantType = 'platform' | 'customer';

interface TenantFeatureOverride {
  feature_key: string;
  is_enabled: boolean;
}

export interface TenantAccessResult {
  /** Tenant type: platform or customer */
  tenantType: TenantType;
  /** Current plan */
  plan: TenantPlan;
  /** Whether this is a special tenant */
  isSpecial: boolean;
  /** Whether tenant is platform type */
  isPlatform: boolean;
  /** @alias isPlatform - backwards compat with useTenantType */
  isPlatformTenant: boolean;
  /** Whether tenant is customer type */
  isCustomerTenant: boolean;
  /** Whether tenant has unlimited access (plan=unlimited OR is_special=true) */
  isUnlimited: boolean;
  /** Numeric plan level (1-5) for comparisons */
  planLevel: number;
  /** Check if a specific feature is accessible */
  canAccess: (featureKey: string) => boolean;
  /** Whether to show module status indicators (platform operator in store mode) */
  showStatusIndicators: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Feature overrides for this tenant */
  overrides: TenantFeatureOverride[];
}

/**
 * Hook UNIFICADO para verificar tipo, plano e acesso do tenant.
 * 
 * Consolida useTenantType + useIsSpecialTenant + antigo useTenantAccess.
 * Uma única query à tabela tenants + uma query de overrides.
 * 
 * Retornos incluem:
 * - Tipo do tenant (platform/customer)
 * - Plano e nível do plano
 * - Feature gating via canAccess()
 * - Status indicators (para platform operators em store mode)
 */
export function useTenantAccess(): TenantAccessResult {
  const { currentTenant } = useAuth();
  const { isPlatformOperator, isLoading: platformLoading } = usePlatformOperator();
  const { isStoreMode } = useAdminModeSafe();

  // Fetch tenant details including plan and is_special
  const { data: tenantData, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant-access', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return null;

      const { data, error } = await supabase
        .from('tenants')
        .select('type, plan, is_special')
        .eq('id', currentTenant.id)
        .maybeSingle();

      if (error) {
        console.error('[useTenantAccess] Error fetching tenant:', error);
        return null;
      }

      return data;
    },
    enabled: !!currentTenant?.id,
    staleTime: 10 * 60 * 1000, // 10 minutes - rarely changes
  });

  // Fetch feature overrides for this tenant
  const { data: overridesData, isLoading: overridesLoading } = useQuery({
    queryKey: ['tenant-feature-overrides', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase
        .from('tenant_feature_overrides')
        .select('feature_key, is_enabled')
        .eq('tenant_id', currentTenant.id);

      if (error) {
        console.error('[useTenantAccess] Error fetching overrides:', error);
        return [];
      }

      return data as TenantFeatureOverride[];
    },
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract values with safe defaults
  const tenantType = (tenantData?.type as TenantType) || 'customer';
  const plan = (tenantData?.plan as TenantPlan) || 'start';
  const isSpecial = tenantData?.is_special ?? false;
  const overrides = overridesData ?? [];

  // Computed values
  const isPlatform = tenantType === 'platform';
  const isCustomerTenant = tenantType === 'customer';
  const isUnlimited = plan === 'unlimited' || isSpecial;
  const currentPlanLevel = planLevel(plan);

  // Status indicators: only for platform operators in store mode
  const showStatusIndicators = isPlatformOperator && isStoreMode;

  // Check feature access
  const canAccess = useMemo(() => {
    return (featureKey: string): boolean => {
      // Platform tenants don't use customer feature gating
      if (isPlatform) return true;

      // Check for override first
      const override = overrides.find(o => o.feature_key === featureKey);
      if (override !== undefined) return override.is_enabled;

      // Use feature config to check access
      return isFeatureAllowed(featureKey, plan, isUnlimited);
    };
  }, [isPlatform, overrides, plan, isUnlimited]);

  return {
    tenantType,
    plan,
    isSpecial,
    isPlatform,
    isPlatformTenant: isPlatform,
    isCustomerTenant,
    isUnlimited,
    planLevel: currentPlanLevel,
    canAccess,
    showStatusIndicators,
    isLoading: tenantLoading || overridesLoading || platformLoading,
    overrides,
  };
}
