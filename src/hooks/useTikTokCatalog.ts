// =============================================
// USE TIKTOK CATALOG
// Hook for TikTok Shop catalog sync & status
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface TikTokShopProduct {
  id: string;
  tenant_id: string;
  product_id: string;
  tiktok_product_id: string | null;
  tiktok_sku_id: string | null;
  status: string;
  sync_action: string;
  last_synced_at: string | null;
  last_error: string | null;
  tiktok_status: string | null;
  tiktok_category_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  products?: {
    id: string;
    name: string;
    slug: string;
    price: number;
    images?: Array<{ url: string; is_primary: boolean }>;
  };
}

interface SyncResult {
  synced: number;
  errors: number;
  total: number;
  results: Array<{
    productId: string;
    success: boolean;
    error?: string;
    tiktokProductId?: string;
  }>;
}

interface StatusResult {
  checked: number;
  updated: number;
  products: Array<{
    productId: string;
    tiktokProductId: string;
    status: string;
    previousStatus: string;
  }>;
}

export function useTikTokCatalog() {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  // Lista produtos sincronizados
  const syncedProductsQuery = useQuery({
    queryKey: ['tiktok-shop-catalog', currentTenant?.id],
    queryFn: async (): Promise<TikTokShopProduct[]> => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase.functions.invoke('tiktok-shop-catalog-sync', {
        body: { tenantId: currentTenant.id, action: 'list' },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao listar catálogo');
      return data.data || [];
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Sincronizar produtos
  const syncMutation = useMutation({
    mutationFn: async (productIds?: string[]): Promise<SyncResult> => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-catalog-sync', {
        body: {
          tenantId: currentTenant.id,
          action: 'sync',
          productIds,
        },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao sincronizar');
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-catalog'] });
      if (result.errors > 0) {
        toast.warning(`${result.synced} sincronizados, ${result.errors} com erro`);
      } else {
        toast.success(`${result.synced} produto(s) sincronizado(s) com TikTok Shop`);
      }
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao sincronizar catálogo');
    },
  });

  // Verificar status
  const statusMutation = useMutation({
    mutationFn: async (productIds?: string[]): Promise<StatusResult> => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-catalog-status', {
        body: { tenantId: currentTenant.id, productIds },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao verificar status');
      return data.data;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-catalog'] });
      toast.success(`${result.checked} verificado(s), ${result.updated} atualizado(s)`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao verificar status');
    },
  });

  return {
    syncedProducts: syncedProductsQuery.data || [],
    isLoading: syncedProductsQuery.isLoading,
    refetch: syncedProductsQuery.refetch,

    syncProducts: syncMutation.mutate,
    isSyncing: syncMutation.isPending,

    checkStatus: statusMutation.mutate,
    isCheckingStatus: statusMutation.isPending,
  };
}
