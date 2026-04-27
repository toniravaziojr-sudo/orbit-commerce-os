import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hooks de leitura do painel /platform/system-health.
 * Todas as RPCs são SECURITY DEFINER restritas a platform_admin.
 * Onda 1 — Visibilidade.
 */

export interface SystemHealthOverview {
  total_connections: number;
  active_connections: number;
  idle_connections: number;
  max_connections: number;
  connection_usage_pct: number;
  cache_hit_ratio: number;
  index_hit_ratio: number;
  database_size_mb: number;
  captured_at: string;
}

export interface SlowQuery {
  query: string;
  calls: number;
  total_exec_time_ms: number;
  mean_exec_time_ms: number;
  rows: number;
}

export interface CronJobStatus {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  failures_24h: number;
  successes_24h: number;
}

export interface QueueHealth {
  queue_name: string;
  queued: number;
  processing: number;
  failed: number;
  oldest_pending_minutes: number | null;
}

const REFRESH_MS = 30_000;

export function useSystemHealthOverview() {
  return useQuery({
    queryKey: ['system-health', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_health_overview');
      if (error) throw error;
      return (Array.isArray(data) ? data[0] : data) as SystemHealthOverview;
    },
    refetchInterval: REFRESH_MS,
    staleTime: 15_000,
  });
}

export function useTopSlowQueries(limit = 10) {
  return useQuery({
    queryKey: ['system-health', 'slow-queries', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_slow_queries', { p_limit: limit });
      if (error) throw error;
      return (data || []) as SlowQuery[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useCronJobsStatus() {
  return useQuery({
    queryKey: ['system-health', 'cron'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cron_jobs_status');
      if (error) throw error;
      return (data || []) as CronJobStatus[];
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useQueueHealth() {
  return useQuery({
    queryKey: ['system-health', 'queues'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_queue_health');
      if (error) throw error;
      return (data || []) as QueueHealth[];
    },
    refetchInterval: 30_000,
    staleTime: 15_000,
  });
}
