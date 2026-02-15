// =============================================
// USE TIKTOK FULFILLMENT
// Hook for TikTok Shop fulfillment / shipping
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface TikTokShopFulfillment {
  id: string;
  tenant_id: string;
  tiktok_order_id: string;
  tiktok_shop_order_id: string | null;
  shipment_id: string | null;
  tracking_code: string | null;
  carrier_code: string | null;
  carrier_name: string | null;
  status: string;
  tiktok_package_id: string | null;
  tiktok_fulfillment_status: string | null;
  shipping_provider_id: string | null;
  pickup_slot: Record<string, unknown> | null;
  fulfillment_data: Record<string, unknown>;
  submitted_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShippingProvider {
  id: string;
  name: string;
}

interface SubmitFulfillmentData {
  tiktokOrderId: string;
  tiktokShopOrderId?: string;
  shipmentId?: string;
  trackingCode: string;
  carrierCode?: string;
  carrierName?: string;
  shippingProviderId?: string;
  pickupSlot?: Record<string, unknown>;
}

interface FulfillmentFilters {
  tiktokOrderId?: string;
  status?: string;
}

export function useTikTokFulfillment(filters?: FulfillmentFilters) {
  const { currentTenant } = useAuth();
  const queryClient = useQueryClient();

  // Lista fulfillments do banco
  const fulfillmentsQuery = useQuery({
    queryKey: ['tiktok-shop-fulfillments', currentTenant?.id, filters],
    queryFn: async (): Promise<TikTokShopFulfillment[]> => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase.functions.invoke('tiktok-shop-fulfillment', {
        body: { tenantId: currentTenant.id, action: 'list', data: filters || {} },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao listar fulfillments');
      return data.data || [];
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 2,
  });

  // Lista transportadoras disponíveis
  const shippingProvidersQuery = useQuery({
    queryKey: ['tiktok-shop-shipping-providers', currentTenant?.id],
    queryFn: async (): Promise<ShippingProvider[]> => {
      if (!currentTenant?.id) return [];

      const { data, error } = await supabase.functions.invoke('tiktok-shop-fulfillment', {
        body: { tenantId: currentTenant.id, action: 'shipping_providers' },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao listar transportadoras');
      return data.data || [];
    },
    enabled: !!currentTenant?.id,
    staleTime: 1000 * 60 * 30, // 30min cache
  });

  // Enviar fulfillment (informar rastreio ao TikTok)
  const submitMutation = useMutation({
    mutationFn: async (submitData: SubmitFulfillmentData) => {
      if (!currentTenant?.id) throw new Error('Tenant não selecionado');

      const { data, error } = await supabase.functions.invoke('tiktok-shop-fulfillment', {
        body: { tenantId: currentTenant.id, action: 'submit', data: submitData },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao enviar fulfillment');
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-fulfillments'] });
      queryClient.invalidateQueries({ queryKey: ['tiktok-shop-orders'] });
      toast.success('Rastreio enviado ao TikTok Shop com sucesso');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erro ao enviar fulfillment');
    },
  });

  return {
    fulfillments: fulfillmentsQuery.data || [],
    isLoading: fulfillmentsQuery.isLoading,
    refetch: fulfillmentsQuery.refetch,

    shippingProviders: shippingProvidersQuery.data || [],
    isLoadingProviders: shippingProvidersQuery.isLoading,

    submitFulfillment: submitMutation.mutate,
    isSubmitting: submitMutation.isPending,
  };
}
