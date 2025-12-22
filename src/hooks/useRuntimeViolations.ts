import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface RuntimeViolation {
  id: string;
  tenant_id: string;
  host: string;
  path: string;
  violation_type: 'hardcoded_store_url' | 'app_domain_link' | 'preview_in_public' | 'content_hardcoded_url';
  details: Record<string, unknown> | null;
  source: string | null;
  resolved_at: string | null;
  created_at: string;
}

export function useRuntimeViolations(days: number = 1) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['runtime-violations', tenantId, days],
    queryFn: async () => {
      if (!tenantId) return [];

      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('storefront_runtime_violations')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as RuntimeViolation[];
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}

export function useViolationsStats() {
  const { data: violations = [] } = useRuntimeViolations(1);
  
  const stats = {
    total: violations.length,
    unresolved: violations.filter(v => !v.resolved_at).length,
    byType: {
      hardcoded_store_url: violations.filter(v => v.violation_type === 'hardcoded_store_url').length,
      app_domain_link: violations.filter(v => v.violation_type === 'app_domain_link').length,
      preview_in_public: violations.filter(v => v.violation_type === 'preview_in_public').length,
      content_hardcoded_url: violations.filter(v => v.violation_type === 'content_hardcoded_url').length,
    },
    hasIssues: violations.filter(v => !v.resolved_at).length > 0,
  };
  
  return stats;
}
