import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TenantPlan, planLevel as getPlanLevel } from '@/config/feature-access';

export type TenantType = 'platform' | 'customer';

interface TenantDetails {
  type: TenantType;
  plan: TenantPlan;
  is_special: boolean;
}

/**
 * Hook para verificar o tipo e plano do tenant atual.
 * 
 * - type: 'platform' | 'customer'
 * - plan: 'start' | 'growth' | 'scale' | 'enterprise' | 'unlimited'
 * - is_special: boolean (acesso especial por tempo indeterminado)
 * 
 * Usado para diferenciar funcionalidades entre admin e clientes,
 * e para controle de acesso por plano.
 */
export function useTenantType() {
  const { currentTenant } = useAuth();
  
  const { data: tenantData, isLoading } = useQuery({
    queryKey: ['tenant-type', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) {
        console.log('[useTenantType] No currentTenant.id available');
        return null;
      }
      
      console.log('[useTenantType] Fetching details for tenant:', currentTenant.id);
      
      const { data, error } = await supabase
        .from('tenants')
        .select('type, plan, is_special')
        .eq('id', currentTenant.id)
        .maybeSingle();
      
      if (error) {
        console.error('[useTenantType] Error fetching tenant:', error);
        return { type: 'customer', plan: 'start', is_special: false } as TenantDetails;
      }
      
      console.log('[useTenantType] Query result:', data);
      
      return {
        type: (data?.type as TenantType) || 'customer',
        plan: (data?.plan as TenantPlan) || 'start',
        is_special: data?.is_special ?? false,
      } as TenantDetails;
    },
    enabled: !!currentTenant?.id,
    staleTime: 10 * 60 * 1000, // 10 minutos - raramente muda
  });
  
  const tenantType = tenantData?.type || 'customer';
  const plan = tenantData?.plan || 'start';
  const isSpecial = tenantData?.is_special ?? false;
  
  const isPlatformTenant = useMemo(() => {
    const result = tenantType === 'platform';
    console.log('[useTenantType] isPlatformTenant:', result, 'tenantType:', tenantType);
    return result;
  }, [tenantType]);
  
  const isCustomerTenant = useMemo(() => {
    return tenantType === 'customer';
  }, [tenantType]);

  const isUnlimited = useMemo(() => {
    return plan === 'unlimited' || isSpecial;
  }, [plan, isSpecial]);

  const planLevel = useMemo(() => {
    return getPlanLevel(plan);
  }, [plan]);
  
  return {
    tenantType,
    plan,
    isSpecial,
    isPlatformTenant,
    isCustomerTenant,
    isUnlimited,
    planLevel,
    isLoading,
  };
}
