import { useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type TenantType = 'platform' | 'customer';

/**
 * Hook para verificar o tipo do tenant atual.
 * 
 * - 'platform': Tenant da plataforma (Comando Central) - único, acesso admin
 * - 'customer': Tenant de cliente normal
 * 
 * Usado para diferenciar funcionalidades entre admin e clientes,
 * e no futuro para diferenciar planos (ex: basic, pro, enterprise).
 */
export function useTenantType() {
  const { currentTenant } = useAuth();
  
  const { data: tenantType, isLoading } = useQuery({
    queryKey: ['tenant-type', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) {
        console.log('[useTenantType] No currentTenant.id available');
        return null;
      }
      
      console.log('[useTenantType] Fetching type for tenant:', currentTenant.id);
      
      const { data, error } = await supabase
        .from('tenants')
        .select('type')
        .eq('id', currentTenant.id)
        .maybeSingle();
      
      if (error) {
        console.error('[useTenantType] Error fetching tenant type:', error);
        return 'customer' as TenantType; // fallback seguro
      }
      
      console.log('[useTenantType] Query result:', data);
      
      // Cast necessário porque o tipo não está no types.ts ainda
      const type = (data?.type as TenantType) || 'customer';
      console.log('[useTenantType] Resolved type:', type);
      
      return type;
    },
    enabled: !!currentTenant?.id,
    staleTime: 10 * 60 * 1000, // 10 minutos - raramente muda
  });
  
  const isPlatformTenant = useMemo(() => {
    const result = tenantType === 'platform';
    console.log('[useTenantType] isPlatformTenant:', result, 'tenantType:', tenantType);
    return result;
  }, [tenantType]);
  
  const isCustomerTenant = useMemo(() => {
    return tenantType === 'customer' || !tenantType;
  }, [tenantType]);
  
  return {
    tenantType: tenantType || 'customer',
    isPlatformTenant,
    isCustomerTenant,
    isLoading,
  };
}
