// =============================================
// USE TIKTOK RETURNS
// Hook for TikTok Shop returns / after-sales
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface TikTokShopReturn {
  id: string;
  tenant_id: string;
  tiktok_order_id: string;
  tiktok_return_id: string | null;
  tiktok_shop_order_id: string | null;
  order_id: string | null;
  return_type: string;
  status: string;
  tiktok_status: string | null;
  reason: string | null;
  buyer_comments: string | null;
  seller_comments: string | null;
  refund_amount_cents: number;
  currency: string;
  return_tracking_code: string | null;
  return_carrier: string | null;
  return_shipping_status: string | null;
  items: Record<string, unknown>[];
  return_data: Record<string, unknown>;
  requested_at: string | null;
  resolved_at: string | null;
  synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface ReturnFilters {
  status?: string;
  tiktokOrderId?: string;
}

interface SyncFilters {
  dateFrom?: string;
  dateTo?: string;
}

export function useTikTokReturns(filters?: ReturnFilters) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  // List returns from local DB
  const returnsQuery = useQuery({
    queryKey: ['tiktok-shop-returns', currentTenant?.id, filters],
    queryFn: async (): Promise<TikTokShopReturn[]> => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase.functions.invoke('tiktok-shop-returns', {
        body: { tenantId: currentTenant.id, action: 'list', data: filters || {} },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao listar devoluções');
      return data.data || [];
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Sync returns from TikTok API
  const syncMutation = useMutation({
    mutationFn: async (syncFilters?: SyncFilters) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-returns', {
        body: { tenantId: currentTenant.id, action: 'sync', data: syncFilters || {} },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao sincronizar devoluções');
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-returns'] });
      toast.success(`${result?.synced || 0} devolução(ões) sincronizada(s)`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao sincronizar devoluções');
    },
  });

  // Approve return
  const approveMutation = useMutation({
    mutationFn: async ({ returnId, sellerComments }: { returnId: string; sellerComments?: string }) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-returns', {
        body: { tenantId: currentTenant.id, action: 'approve', data: { returnId, sellerComments } },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao aprovar devolução');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-returns'] });
      toast.success('Devolução aprovada com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao aprovar devolução');
    },
  });

  // Reject return
  const rejectMutation = useMutation({
    mutationFn: async ({ returnId, reason }: { returnId: string; reason?: string }) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-returns', {
        body: { tenantId: currentTenant.id, action: 'reject', data: { returnId, reason } },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao rejeitar devolução');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-returns'] });
      toast.success('Devolução rejeitada');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao rejeitar devolução');
    },
  });

  return {
    returns: returnsQuery.data || [],
    isLoading: returnsQuery.isLoading,
    refetch: returnsQuery.refetch,

    syncReturns: syncMutation.mutate,
    isSyncing: syncMutation.isPending,

    approveReturn: approveMutation.mutate,
    isApproving: approveMutation.isPending,

    rejectReturn: rejectMutation.mutate,
    isRejecting: rejectMutation.isPending,
  };
}
