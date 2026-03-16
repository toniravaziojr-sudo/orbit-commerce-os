// =============================================
// USE RETRY LINKED ORDER - Busca bidirecional de vínculo retry
// Pedido original ↔ Pedido substituto
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface RetryLink {
  id: string;
  order_number: string;
}

interface RetryLinkedResult {
  /** Pedido que substituiu o atual (outro pedido apontando para este) */
  replacedBy: RetryLink | null;
  /** Pedido original do qual este é retentativa */
  retryOf: RetryLink | null;
  isLoading: boolean;
}

export function useRetryLinkedOrder(orderId?: string, retryFromOrderId?: string | null): RetryLinkedResult {
  // Query 1: Busca se existe pedido que SUBSTITUIU o atual
  const replacedByQuery = useQuery({
    queryKey: ['retry-replaced-by', orderId],
    queryFn: async (): Promise<RetryLink | null> => {
      if (!orderId) return null;

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('retry_from_order_id', orderId)
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('[useRetryLinkedOrder] replacedBy error:', error);
        return null;
      }

      return data ? { id: data.id, order_number: data.order_number } : null;
    },
    enabled: !!orderId,
    staleTime: 60000,
  });

  // Query 2: Busca o pedido ORIGINAL (de onde veio a retentativa)
  const retryOfQuery = useQuery({
    queryKey: ['retry-original', retryFromOrderId],
    queryFn: async (): Promise<RetryLink | null> => {
      if (!retryFromOrderId) return null;

      const { data, error } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('id', retryFromOrderId)
        .maybeSingle();

      if (error) {
        console.error('[useRetryLinkedOrder] retryOf error:', error);
        return null;
      }

      return data ? { id: data.id, order_number: data.order_number } : null;
    },
    enabled: !!retryFromOrderId,
    staleTime: 60000,
  });

  return {
    replacedBy: replacedByQuery.data ?? null,
    retryOf: retryOfQuery.data ?? null,
    isLoading: replacedByQuery.isLoading || retryOfQuery.isLoading,
  };
}
