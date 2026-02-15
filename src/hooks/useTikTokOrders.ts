// =============================================
// USE TIKTOK ORDERS
// Hook for TikTok Shop orders sync & listing
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface TikTokShopOrder {
  id: string;
  tenant_id: string;
  tiktok_order_id: string;
  order_id: string | null;
  status: string;
  tiktok_status: string | null;
  buyer_name: string | null;
  buyer_email: string | null;
  buyer_phone: string | null;
  shipping_address: Record<string, unknown> | null;
  order_total_cents: number;
  currency: string;
  items: Array<{
    tiktokSkuId: string;
    productName: string;
    quantity: number;
    salePriceCents: number;
    originalPriceCents: number;
    imageUrl: string | null;
  }>;
  order_data: Record<string, unknown>;
  synced_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface SyncResult {
  synced: number;
  errors: number;
  totalFromApi: number;
}

interface OrderFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export function useTikTokOrders(filters?: OrderFilters) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  // Lista pedidos do banco
  const ordersQuery = useQuery({
    queryKey: ['tiktok-shop-orders', currentTenant?.id, filters],
    queryFn: async (): Promise<TikTokShopOrder[]> => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase.functions.invoke('tiktok-shop-orders-sync', {
        body: { tenantId: currentTenant.id, action: 'list', filters: filters || {} },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao listar pedidos');
      return data.data || [];
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Sincronizar pedidos da API TikTok
  const syncMutation = useMutation({
    mutationFn: async (syncFilters?: { startDate?: string; endDate?: string }): Promise<SyncResult> => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-orders-sync', {
        body: {
          tenantId: currentTenant.id,
          action: 'sync',
          filters: syncFilters || {},
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao sincronizar');
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-orders'] });
      if (result.errors > 0) {
        toast.warning(`${result.synced} sincronizados, ${result.errors} com erro`);
      } else {
        toast.success(`${result.synced} pedido(s) sincronizado(s) do TikTok Shop`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao sincronizar pedidos');
    },
  });

  // Buscar detalhes de um pedido
  const detailMutation = useMutation({
    mutationFn: async (tiktokOrderId: string) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-orders-detail', {
        body: { tenantId: currentTenant.id, tiktokOrderId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar detalhes');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-orders'] });
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao buscar detalhes do pedido');
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    refetch: ordersQuery.refetch,

    syncOrders: syncMutation.mutate,
    isSyncing: syncMutation.isPending,

    getOrderDetail: detailMutation.mutate,
    isLoadingDetail: detailMutation.isPending,
  };
}
