import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
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
  /** Whether tenant has unlimited access (plan=unlimited OR is_special=true) */
  isUnlimited: boolean;
  /** Numeric plan level (1-5) for comparisons */
  planLevel: number;
  /** Check if a specific feature is accessible */
  canAccess: (featureKey: string) => boolean;
  /** Loading state */
  isLoading: boolean;
  /** Feature overrides for this tenant */
  overrides: TenantFeatureOverride[];
}

/**
 * Hook to check tenant access level and feature permissions.
 * 
 * This hook provides:
 * - Tenant type, plan, and special status
 * - Feature access checking with overrides support
 * - Plan level for comparisons
 * 
 * Access rules:
 * - Platform tenants: use platformAdminNavigation, no customer features
 * - Customer unlimited/special: all customer features allowed
 * - Customer with plan: check FEATURE_CONFIG + overrides
 * - Default: allow if feature not configured (backwards compatibility)
 */
export function useTenantAccess(): TenantAccessResult {
  const { currentTenant } = useAuth();

  // Fetch tenant details including plan and is_special
  const { data: tenantData, isLoading: tenantLoading } = useQuery({
    queryKey: ['tenant-access', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) {
        console.log('[useTenantAccess] No currentTenant.id available');
        return null;
      }

      console.log('[useTenantAccess] Fetching tenant access for:', currentTenant.id);

      const { data, error } = await supabase
        .from('tenants')
        .select('type, plan, is_special')
        .eq('id', currentTenant.id)
        .maybeSingle();

      if (error) {
        console.error('[useTenantAccess] Error fetching tenant:', error);
        return null;
      }

      console.log('[useTenantAccess] Tenant data:', data);
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

      console.log('[useTenantAccess] Fetching overrides for tenant:', currentTenant.id);

      const { data, error } = await supabase
        .from('tenant_feature_overrides')
        .select('feature_key, is_enabled')
        .eq('tenant_id', currentTenant.id);

      if (error) {
        console.error('[useTenantAccess] Error fetching overrides:', error);
        return [];
      }

      console.log('[useTenantAccess] Overrides:', data);
      return data as TenantFeatureOverride[];
    },
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Extract values with safe defaults
  const tenantType = (tenantData?.type as TenantType) || 'customer';
  // Cast plan to TenantPlan - the database enum matches our TypeScript type
  const plan = (tenantData?.plan as TenantPlan) || 'start';
  const isSpecial = tenantData?.is_special ?? false;
  const overrides = overridesData ?? [];

  // Computed values
  const isPlatform = tenantType === 'platform';
  const isUnlimited = plan === 'unlimited' || isSpecial;
  const currentPlanLevel = planLevel(plan);

  // Check feature access
  const canAccess = useMemo(() => {
    return (featureKey: string): boolean => {
      // Platform tenants don't use customer feature gating
      // They use PlatformAdminGate instead
      if (isPlatform) {
        console.log('[useTenantAccess] Platform tenant, canAccess returning true for:', featureKey);
        return true;
      }

      // Check for override first
      const override = overrides.find(o => o.feature_key === featureKey);
      if (override !== undefined) {
        console.log(`[useTenantAccess] Override found for ${featureKey}:`, override.is_enabled);
        return override.is_enabled;
      }

      // Use feature config to check access
      const allowed = isFeatureAllowed(featureKey, plan, isUnlimited);
      console.log(`[useTenantAccess] canAccess(${featureKey}):`, allowed, { plan, isUnlimited });
      return allowed;
    };
  }, [isPlatform, overrides, plan, isUnlimited]);

  return {
    tenantType,
    plan,
    isSpecial,
    isPlatform,
    isUnlimited,
    planLevel: currentPlanLevel,
    canAccess,
    isLoading: tenantLoading || overridesLoading,
    overrides,
  };
}
