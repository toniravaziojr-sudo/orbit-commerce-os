import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { useTenantType } from '@/hooks/useTenantType';
import { supabase } from '@/integrations/supabase/client';

export type AccessLevel = 'none' | 'partial' | 'full';

export interface ModuleAccessInfo {
  hasAccess: boolean;
  accessLevel: AccessLevel;
  blockedFeatures: string[];
  allowedFeatures: string[];
  planKey: string;
  requiresUpgrade: boolean;
}

interface ModuleAccessRecord {
  module_key: string;
  access_level: string;
  blocked_features: string[] | null;
  allowed_features: string[] | null;
  notes: string | null;
}

// Resultado para tenants com acesso total (especiais, unlimited, platform)
const FULL_ACCESS_RESULT: ModuleAccessInfo = {
  hasAccess: true,
  accessLevel: 'full',
  blockedFeatures: [],
  allowedFeatures: [],
  planKey: 'unlimited',
  requiresUpgrade: false,
};

/**
 * Hook para verificar acesso a módulos específicos baseado no plano do tenant.
 * 
 * IMPORTANTE: Tenants especiais (is_special=true), com plano unlimited, ou
 * do tipo platform têm acesso total - a RPC nem é chamada.
 * 
 * Retorna:
 * - hasAccess: se o módulo está liberado (full ou partial)
 * - accessLevel: 'none' | 'partial' | 'full'
 * - blockedFeatures: lista de features bloqueadas dentro do módulo
 * - requiresUpgrade: se precisa fazer upgrade para acessar
 */
export function useModuleAccess(moduleKey: string): ModuleAccessInfo & { isLoading: boolean } {
  const { currentTenant } = useAuth();
  const { isUnlimited, isPlatformTenant, isLoading: tenantTypeLoading } = useTenantType();

  // Early return: tenants especiais/unlimited/platform têm acesso total
  const shouldBypass = isUnlimited || isPlatformTenant;

  const { data, isLoading: queryLoading } = useQuery({
    queryKey: ['module-access', currentTenant?.id, moduleKey],
    queryFn: async (): Promise<ModuleAccessInfo> => {
      if (!currentTenant?.id) {
        return {
          hasAccess: false,
          accessLevel: 'none',
          blockedFeatures: [],
          allowedFeatures: [],
          planKey: 'basico',
          requiresUpgrade: true,
        };
      }

      const { data, error } = await supabase
        .rpc('check_module_access', {
          p_tenant_id: currentTenant.id,
          p_module_key: moduleKey,
        });

      if (error) {
        console.error('[useModuleAccess] Error:', error);
        // Default: permitir acesso para não bloquear em caso de erro
        return {
          hasAccess: true,
          accessLevel: 'full',
          blockedFeatures: [],
          allowedFeatures: [],
          planKey: 'unknown',
          requiresUpgrade: false,
        };
      }

      const result = data as any;
      return {
        hasAccess: result?.has_access ?? true,
        accessLevel: (result?.access_level as AccessLevel) ?? 'full',
        blockedFeatures: result?.blocked_features ?? [],
        allowedFeatures: result?.allowed_features ?? [],
        planKey: result?.plan_key ?? 'basico',
        requiresUpgrade: result?.requires_upgrade ?? false,
      };
    },
    // Só executa a query se NÃO for tenant especial/unlimited/platform
    enabled: !!currentTenant?.id && !shouldBypass && !tenantTypeLoading,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Se é tenant especial, retorna acesso total imediatamente
  if (shouldBypass) {
    return {
      ...FULL_ACCESS_RESULT,
      isLoading: tenantTypeLoading,
    };
  }

  return {
    hasAccess: data?.hasAccess ?? true,
    accessLevel: data?.accessLevel ?? 'full',
    blockedFeatures: data?.blockedFeatures ?? [],
    allowedFeatures: data?.allowedFeatures ?? [],
    planKey: data?.planKey ?? 'basico',
    requiresUpgrade: data?.requiresUpgrade ?? false,
    isLoading: queryLoading || tenantTypeLoading,
  };
}

/**
 * Hook para buscar todos os acessos a módulos do tenant de uma vez.
 * 
 * IMPORTANTE: Tenants especiais/unlimited/platform recebem objeto vazio da RPC,
 * o que significa acesso total a tudo.
 */
export function useAllModuleAccess() {
  const { currentTenant } = useAuth();
  const { isUnlimited, isPlatformTenant, isLoading: tenantTypeLoading } = useTenantType();

  // Early return: tenants especiais/unlimited/platform têm acesso total
  const shouldBypass = isUnlimited || isPlatformTenant;

  return useQuery({
    queryKey: ['all-module-access', currentTenant?.id],
    queryFn: async (): Promise<Record<string, ModuleAccessInfo>> => {
      if (!currentTenant?.id) return {};

      const { data, error } = await supabase
        .rpc('get_tenant_module_access', { p_tenant_id: currentTenant.id });

      if (error) {
        console.error('[useAllModuleAccess] Error:', error);
        return {};
      }

      // RPC retorna JSONB array - parse adequadamente
      const modules: Record<string, ModuleAccessInfo> = {};
      
      // Se data for null, undefined ou array vazio = acesso total (sem restrições)
      if (!data || (Array.isArray(data) && data.length === 0)) {
        return {};
      }

      // Converter JSONB array para Record (cast via unknown para contornar tipagem estrita do Supabase)
      const rows = (Array.isArray(data) ? data : []) as unknown as ModuleAccessRecord[];
      rows.forEach((row) => {
        if (row && row.module_key) {
          modules[row.module_key] = {
            hasAccess: row.access_level === 'full' || row.access_level === 'partial',
            accessLevel: (row.access_level as AccessLevel) || 'full',
            blockedFeatures: row.blocked_features ?? [],
            allowedFeatures: row.allowed_features ?? [],
            planKey: 'unknown',
            requiresUpgrade: row.access_level === 'none',
          };
        }
      });

      return modules;
    },
    enabled: !!currentTenant?.id && !shouldBypass && !tenantTypeLoading,
    staleTime: 5 * 60 * 1000,
  });
}
