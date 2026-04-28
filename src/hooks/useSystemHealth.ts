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

function toRpcError(error: unknown, fallback: string) {
  if (!error) return new Error(fallback);
  if (error instanceof Error) return error;

  if (typeof error === 'object') {
    const message = 'message' in error && typeof error.message === 'string'
      ? error.message
      : 'details' in error && typeof error.details === 'string'
        ? error.details
        : fallback;

    return new Error(message);
  }

  return new Error(String(error));
}

export function useSystemHealthOverview() {
  return useQuery({
    queryKey: ['system-health', 'overview'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_system_health_overview');
      if (error) throw toRpcError(error, 'Falha ao carregar visão geral da saúde do sistema');
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
      if (error) throw toRpcError(error, 'Falha ao carregar queries lentas');
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
      if (error) throw toRpcError(error, 'Falha ao carregar tarefas automatizadas');
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
      if (error) throw toRpcError(error, 'Falha ao carregar filas monitoradas');
      return (data ?? {}) as unknown as QueueHealthMap;
    },
    refetchInterval: REFRESH_FAST,
    staleTime: 15_000,
  });
}

// ===== Onda 2 — Resiliência observável =====

export interface ResilienceKpis {
  orphan_inbound: number;
  open_incidents: number;
  payment_divergences_24h: number;
  captured_at: string;
}

export interface WhatsAppIncident {
  id: string;
  tenant_id: string;
  tenant_name: string;
  incident_type: string;
  severity: string;
  title: string;
  detail: string | null;
  status: string;
  detected_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
  metadata: Record<string, unknown> | null;
}

export interface WhatsAppOrphanInbound {
  id: string;
  tenant_id: string;
  tenant_name: string;
  provider: string;
  external_message_id: string | null;
  from_phone: string | null;
  message_type: string | null;
  age_minutes: number;
  created_at: string;
  processing_status: string | null;
  processing_error: string | null;
}

export interface PaymentDivergence {
  transaction_id: string;
  tenant_id: string;
  tenant_name: string;
  provider: string;
  provider_transaction_id: string | null;
  status: string;
  method: string | null;
  amount: number;
  paid_amount: number | null;
  order_id: string | null;
  order_exists: boolean;
  divergence_type: 'no_order' | 'order_missing' | 'amount_mismatch' | 'unknown';
  paid_at: string | null;
  created_at: string;
}

export function useResilienceKpis() {
  return useQuery({
    queryKey: ['system-health', 'resilience-kpis'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_resilience_kpis');
      if (error) throw toRpcError(error, 'Falha ao carregar indicadores de resiliência');
      return data as unknown as ResilienceKpis;
    },
    refetchInterval: REFRESH_FAST,
    staleTime: 15_000,
  });
}

export function useWhatsAppIncidents(limit = 50) {
  return useQuery({
    queryKey: ['system-health', 'wa-incidents', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_whatsapp_incidents', { p_limit: limit });
      if (error) throw toRpcError(error, 'Falha ao carregar incidentes do WhatsApp');
      return (data ?? []) as unknown as WhatsAppIncident[];
    },
    refetchInterval: REFRESH_SLOW,
    staleTime: 30_000,
  });
}

export function useWhatsAppOrphanInbound(limit = 50) {
  return useQuery({
    queryKey: ['system-health', 'wa-orphan-inbound', limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_whatsapp_orphan_inbound', { p_limit: limit });
      if (error) throw toRpcError(error, 'Falha ao carregar mensagens não processadas');
      return (data ?? []) as unknown as WhatsAppOrphanInbound[];
    },
    refetchInterval: REFRESH_FAST,
    staleTime: 15_000,
  });
}

export function usePaymentDivergences(windowHours = 24, limit = 100) {
  return useQuery({
    queryKey: ['system-health', 'payment-divergences', windowHours, limit],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_payment_divergences', {
        p_window_hours: windowHours,
        p_limit: limit,
      });
      if (error) throw toRpcError(error, 'Falha ao carregar divergências de pagamento');
      return (data ?? []) as unknown as PaymentDivergence[];
    },
    refetchInterval: REFRESH_SLOW,
    staleTime: 30_000,
  });
}

export async function resolveWhatsAppIncident(incidentId: string, note?: string) {
  const { data, error } = await supabase.rpc('resolve_whatsapp_incident', {
    p_incident_id: incidentId,
    p_resolution_note: note ?? null,
  });
  if (error) throw toRpcError(error, 'Falha ao resolver incidente');
  return data as unknown as { success: boolean; incident_id: string; updated: number };
}
