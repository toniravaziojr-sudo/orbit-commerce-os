import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface HealthCheckTarget {
  id: string;
  tenant_id: string;
  label: string;
  storefront_base_url: string;
  shops_base_url: string | null;
  test_coupon_code: string | null;
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface HealthCheck {
  id: string;
  target_id: string | null;
  tenant_id: string;
  ran_at: string;
  environment: string;
  check_suite: string;
  status: 'pass' | 'fail' | 'partial';
  summary: string | null;
  details: {
    suites?: Array<{
      suite: string;
      status: 'pass' | 'fail' | 'partial';
      checks: Array<{
        name: string;
        status: 'pass' | 'fail';
        message: string;
        duration_ms?: number;
      }>;
      duration_ms: number;
    }>;
  } | null;
  duration_ms: number | null;
  created_at: string;
}

export function useHealthCheckTargets() {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['health-check-targets', tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      const { data, error } = await supabase
        .from('system_health_check_targets')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as HealthCheckTarget[];
    },
    enabled: !!tenantId,
  });
}

export function useHealthChecks(days: number = 7) {
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useQuery({
    queryKey: ['health-checks', tenantId, days],
    queryFn: async () => {
      if (!tenantId) return [];

      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('system_health_checks')
        .select('*')
        .eq('tenant_id', tenantId)
        .gte('ran_at', since.toISOString())
        .order('ran_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data as HealthCheck[];
    },
    enabled: !!tenantId,
    refetchInterval: 60000, // Refresh every minute
  });
}

export function useHealthCheckStats() {
  const { data: checks } = useHealthChecks(1); // Last 24h

  const stats = {
    total: checks?.length ?? 0,
    passed: checks?.filter(c => c.status === 'pass').length ?? 0,
    failed: checks?.filter(c => c.status === 'fail').length ?? 0,
    partial: checks?.filter(c => c.status === 'partial').length ?? 0,
    lastCheck: checks?.[0] ?? null,
    uptime: 0,
  };

  if (stats.total > 0) {
    stats.uptime = Math.round((stats.passed / stats.total) * 100);
  }

  return stats;
}

export function useCreateHealthCheckTarget() {
  const queryClient = useQueryClient();
  const { currentTenant } = useAuth();
  const tenantId = currentTenant?.id;

  return useMutation({
    mutationFn: async (target: Omit<HealthCheckTarget, 'id' | 'tenant_id' | 'created_at' | 'updated_at'>) => {
      if (!tenantId) throw new Error('No tenant');

      const { data, error } = await supabase
        .from('system_health_check_targets')
        .insert({ ...target, tenant_id: tenantId })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-check-targets'] });
    },
  });
}

export function useUpdateHealthCheckTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<HealthCheckTarget> & { id: string }) => {
      const { data, error } = await supabase
        .from('system_health_check_targets')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-check-targets'] });
    },
  });
}

export function useDeleteHealthCheckTarget() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('system_health_check_targets')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-check-targets'] });
    },
  });
}

export function useRunHealthCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('health-check-run');
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      // Wait a bit for the check to complete, then refresh
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['health-checks'] });
      }, 2000);
    },
  });
}
