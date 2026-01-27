import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
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

/**
 * Hook para verificar acesso a módulos específicos baseado no plano do tenant.
 * 
 * Retorna:
 * - hasAccess: se o módulo está liberado (full ou partial)
 * - accessLevel: 'none' | 'partial' | 'full'
 * - blockedFeatures: lista de features bloqueadas dentro do módulo
 * - requiresUpgrade: se precisa fazer upgrade para acessar
 */
export function useModuleAccess(moduleKey: string): ModuleAccessInfo & { isLoading: boolean } {
  const { currentTenant } = useAuth();

  const { data, isLoading } = useQuery({
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
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  return {
    hasAccess: data?.hasAccess ?? true,
    accessLevel: data?.accessLevel ?? 'full',
    blockedFeatures: data?.blockedFeatures ?? [],
    allowedFeatures: data?.allowedFeatures ?? [],
    planKey: data?.planKey ?? 'basico',
    requiresUpgrade: data?.requiresUpgrade ?? false,
    isLoading,
  };
}

/**
 * Hook para buscar todos os acessos a módulos do tenant de uma vez.
 */
export function useAllModuleAccess() {
  const { currentTenant } = useAuth();

  return useQuery({
    queryKey: ['all-module-access', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return {};

      const { data, error } = await supabase
        .rpc('get_tenant_module_access', { p_tenant_id: currentTenant.id });

      if (error) {
        console.error('[useAllModuleAccess] Error:', error);
        return {};
      }

      const modules: Record<string, ModuleAccessInfo> = {};
      (data as ModuleAccessRecord[] || []).forEach((row) => {
        modules[row.module_key] = {
          hasAccess: row.access_level === 'full' || row.access_level === 'partial',
          accessLevel: row.access_level as AccessLevel,
          blockedFeatures: row.blocked_features ?? [],
          allowedFeatures: row.allowed_features ?? [],
          planKey: 'unknown', // Would need join to get this
          requiresUpgrade: row.access_level === 'none',
        };
      });

      return modules;
    },
    enabled: !!currentTenant?.id,
    staleTime: 5 * 60 * 1000,
  });
}
