import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hooks de leitura do painel /platform/system-health.
 * Todas as RPCs são SECURITY DEFINER restritas a platform_admin.
 * Onda 1 — Visibilidade.
 */

export interface SystemHealthOverview {
  connections: {
    active: number;
    idle: number;
    idle_in_transaction: number;
    total: number;
    max: number;
  };
  database_size: number;
  cache_hit_ratio: number;
  captured_at: string;
}

export interface SlowQuery {
  query_sample: string;
  calls: number;
  total_time_ms: number;
  mean_time_ms: number;
  max_time_ms: number;
  rows_returned: number;
}

export interface CronJobStatus {
  jobid: number;
  jobname: string;
  schedule: string;
  active: boolean;
  last_run_at: string | null;
  last_status: string | null;
  last_duration_ms: number | null;
  failures_last_24h: number;
  successes_last_24h: number;
}

export interface QueueHealthEntry {
  pending_or_orphans: number;
  oldest_pending_at: string | null;
  oldest_age_seconds: number | null;
}

export type QueueHealthMap = Record<string, QueueHealthEntry>;

const REFRESH_FAST = 30_000;
const REFRESH_SLOW = 60_000;

export function useSystemHealthOverview() {
  return useQuery({
    queryKey: ['system-health', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_health_overview');
      if (error) throw error;
      return data as unknown as SystemHealthOverview;
    },
    refetchInterval: REFRESH_FAST,
    staleTime: 15_000,
  });
}

export function useTopSlowQueries(limit = 10) {
  return useQuery({
    queryKey: ['system-health', 'slow-queries', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_top_slow_queries', { p_limit: limit });
      if (error) throw error;
      return (data ?? []) as SlowQuery[];
    },
    refetchInterval: REFRESH_SLOW,
    staleTime: 30_000,
  });
}

export function useCronJobsStatus() {
  return useQuery({
    queryKey: ['system-health', 'cron'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_cron_jobs_status');
      if (error) throw error;
      return (data ?? []) as unknown as CronJobStatus[];
    },
    refetchInterval: REFRESH_SLOW,
    staleTime: 30_000,
  });
}

export function useQueueHealth() {
  return useQuery({
    queryKey: ['system-health', 'queues'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_queue_health');
      if (error) throw error;
      return (data ?? {}) as unknown as QueueHealthMap;
    },
    refetchInterval: REFRESH_FAST,
    staleTime: 15_000,
  });
}
