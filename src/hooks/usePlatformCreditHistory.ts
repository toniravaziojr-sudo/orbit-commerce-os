/**
 * usePlatformCreditHistory — Etapa 1D Fase A3.2
 *
 * Variante admin do useCreditHistory. Não compartilha hook com tenant para
 * evitar regressão no extrato de /account/billing já validado.
 *
 * Requisitos desta etapa:
 * - tenantId é OBRIGATÓRIO (não chama RPC se vazio).
 * - "Todos os tenants" NÃO está habilitado nesta etapa.
 * - Aceita filtros admin avançados.
 * - Retorna campos sensíveis quando o caller for platform_admin (a RPC decide).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  CreditHistoryItem,
  CreditHistoryFilters,
} from "@/hooks/useCreditHistory";

export interface UsePlatformCreditHistoryParams
  extends Omit<CreditHistoryFilters, "tenantId"> {
  /** Obrigatório nesta etapa. Sem tenantId, a query fica desabilitada. */
  tenantId: string | null;
}

export interface UsePlatformCreditHistoryResult {
  data: CreditHistoryItem[];
  totalCount: number;
  isLoading: boolean;
  isFetching: boolean;
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

export function usePlatformCreditHistory(
  params: UsePlatformCreditHistoryParams
): UsePlatformCreditHistoryResult {
  const tenantId = params.tenantId ?? null;
  const limit = clampLimit(params.limit);
  const offset = clampOffset(params.offset);

  const queryKey = [
    "platform-credit-history",
    tenantId,
    params.startDate ?? null,
    params.endDate ?? null,
    params.transactionType ?? null,
    params.operationStatus ?? null,
    params.category ?? null,
    params.serviceKey ?? null,
    params.provider ?? null,
    params.jobId ?? null,
    !!params.includePlatform,
    limit,
    offset,
  ];

  const query = useQuery({
    queryKey,
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_credit_history", {
        p_tenant_id: tenantId!,
        p_start_date: params.startDate ?? null,
        p_end_date: params.endDate ?? null,
        p_transaction_type: params.transactionType ?? null,
        p_operation_status: params.operationStatus ?? null,
        p_category: params.category ?? null,
        p_service_key: params.serviceKey ?? null,
        p_provider: params.provider ?? null,
        p_job_id: params.jobId ?? null,
        p_include_platform: !!params.includePlatform,
        p_limit: limit,
        p_offset: offset,
      });

      if (error) {
        const code = (error as { code?: string }).code;
        const msg = (error.message || "").toLowerCase();
        if (code === "42501" || msg.includes("forbidden")) {
          throw new Error("Acesso negado ao extrato de créditos.");
        }
        throw new Error("Falha ao carregar extrato de créditos da plataforma.");
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
    isFetching: query.isFetching,
    isError: query.isError,
    error: (query.error as Error) ?? null,
    refetch: () => {
      void query.refetch();
    },
  };
}
