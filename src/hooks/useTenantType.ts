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
      if (!currentTenant?.id) return null;
      
      const { data, error } = await supabase
        .from('tenants')
        .select('type')
        .eq('id', currentTenant.id)
        .maybeSingle();
      
      if (error) {
        console.error('[useTenantType] Error fetching tenant type:', error);
        return 'customer' as TenantType; // fallback seguro
      }
      
      // Cast necessário porque o tipo não está no types.ts ainda
      return (data?.type as TenantType) || 'customer';
    },
    enabled: !!currentTenant?.id,
    staleTime: 10 * 60 * 1000, // 10 minutos - raramente muda
  });
  
  const isPlatformTenant = useMemo(() => {
    return tenantType === 'platform';
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
