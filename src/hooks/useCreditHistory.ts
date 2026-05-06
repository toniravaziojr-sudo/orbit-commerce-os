/**
 * useCreditHistory — Etapa 1B Fase A3.2
 *
 * Hook de leitura do extrato/histórico de créditos via RPC SECURITY DEFINER
 * `public.get_credit_history`. Não consulta `credit_wallet` (saldo continua
 * sendo responsabilidade de `useCreditWallet`).
 *
 * Fonte canônica: credit_ledger (enriquecido com service_usage_events e creative_jobs).
 * Mascaramento de campos sensíveis (cost/sell/markup/provider/service_key) é feito
 * server-side pela RPC quando o caller não é platform_admin.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type CreditTransactionType =
  | "reserve"
  | "capture"
  | "release"
  | "refund"
  | "adjust"
  | "purchase"
  | "bonus"
  | "consume";

export type CreditOperationStatus =
  | "reserved"
  | "captured"
  | "released"
  | "completed"
  | "failed";

export interface CreditHistoryFilters {
  /** Tenant alvo. Tenant comum só pode passar o próprio. Admin pode qualquer. */
  tenantId?: string;
  startDate?: string | null;
  endDate?: string | null;
  transactionType?: CreditTransactionType | null;
  operationStatus?: CreditOperationStatus | null;
  category?: string | null;
  serviceKey?: string | null;
  provider?: string | null;
  jobId?: string | null;
  /** Apenas admin. Forçado para false server-side se não-admin. */
  includePlatform?: boolean;
  /** Clampado [1..100] (server-side também faz). */
  limit?: number;
  offset?: number;
}

export interface CreditHistoryItem {
  event_id: string | null;
  ledger_id: string;
  tenant_id: string;
  created_at: string;
  transaction_type: CreditTransactionType | string;
  operation_status: CreditOperationStatus | string | null;
  category: string | null;
  service_key_public: string | null;
  /** Apenas admin. Tenant recebe NULL. */
  service_key: string | null;
  /** Apenas admin. Tenant recebe NULL. */
  provider: string | null;
  feature: string | null;
  credits_delta: number;
  balance_before: number | null;
  balance_after: number | null;
  description: string | null;
  job_id: string | null;
  creative_job_id: string | null;
  creative_product_name: string | null;
  /** Apenas admin. */
  source_function: string | null;
  /** Apenas admin. */
  cost_usd: number | null;
  sell_usd: number | null;
  markup_pct_snap: number | null;
  cost_brl: number | null;
  sell_brl: number | null;
  fx_rate_usd_brl: number | null;
  metadata_public: Record<string, unknown> | null;
  /** Apenas admin. */
  metadata_admin: Record<string, unknown> | null;
  total_count: number;
}

export interface UseCreditHistoryResult {
  data: CreditHistoryItem[];
  totalCount: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => void;
}

function clampLimit(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

function clampOffset(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.floor(n));
}

export function useCreditHistory(
  filters: CreditHistoryFilters = {}
): UseCreditHistoryResult {
  const { currentTenant } = useAuth();
  const tenantId = filters.tenantId ?? currentTenant?.id ?? null;

  const limit = clampLimit(filters.limit);
  const offset = clampOffset(filters.offset);

  const queryKey = [
    "credit-history",
    tenantId,
    filters.startDate ?? null,
    filters.endDate ?? null,
    filters.transactionType ?? null,
    filters.operationStatus ?? null,
    filters.category ?? null,
    filters.serviceKey ?? null,
    filters.provider ?? null,
    filters.jobId ?? null,
    !!filters.includePlatform,
    limit,
    offset,
  ];

  const query = useQuery({
    queryKey,
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_credit_history", {
        p_tenant_id: tenantId!,
        p_start_date: filters.startDate ?? null,
        p_end_date: filters.endDate ?? null,
        p_transaction_type: filters.transactionType ?? null,
        p_operation_status: filters.operationStatus ?? null,
        p_category: filters.category ?? null,
        p_service_key: filters.serviceKey ?? null,
        p_provider: filters.provider ?? null,
        p_job_id: filters.jobId ?? null,
        p_include_platform: !!filters.includePlatform,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        // Sanitiza mensagem para não vazar detalhes técnicos a tenant comum.
        const msg = (error.message || "").toLowerCase();
        if (msg.includes("forbidden") || (error as { code?: string }).code === "42501") {
          throw new Error("Sem permissão para acessar este extrato.");
        }
        throw new Error("Não foi possível carregar o extrato de créditos.");
      }

      return (data ?? []) as CreditHistoryItem[];
    },
  });

  const items = query.data ?? [];
  const totalCount = items.length > 0 ? Number(items[0].total_count ?? 0) : 0;

  return {
    data: items,
    totalCount,
    isLoading: query.isLoading,
    isError: query.isError,
    error: (query.error as Error) ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}
