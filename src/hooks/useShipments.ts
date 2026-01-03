// =============================================
// USE SHIPMENTS - Hook para gerenciar remessas/entregas
// Suporta tanto a tabela orders (legado) quanto shipments (novo)
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

// Tipos legados (baseado em orders)
export interface Shipment {
  id: string;
  order_number: string;
  customer_name: string;
  shipping_status: string;
  shipping_carrier: string | null;
  tracking_code: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
}

interface ShipmentStats {
  pendingCount: number;
  inTransitCount: number;
  deliveredCount: number;
  deliveryRate: number;
}

interface UseShipmentsOptions {
  page?: number;
  pageSize?: number;
  status?: string;
}

// =============================================
// NOVOS TIPOS - Baseado na tabela shipments
// =============================================

export type DeliveryStatus = 
  | 'label_created'
  | 'posted'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed'
  | 'returned'
  | 'canceled'
  | 'unknown';

export interface ShipmentRecord {
  id: string;
  tenant_id: string;
  order_id: string;
  carrier: string;
  tracking_code: string;
  delivery_status: DeliveryStatus;
  last_status_at: string;
  estimated_delivery_at: string | null;
  delivered_at: string | null;
  source: string;
  source_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Campos de polling
  last_polled_at: string | null;
  next_poll_at: string | null;
  poll_error_count: number;
  last_poll_error: string | null;
}

export interface ShipmentEvent {
  id: string;
  tenant_id: string;
  shipment_id: string;
  status: string;
  description: string | null;
  location: string | null;
  occurred_at: string;
  provider_event_id: string | null;
  raw_payload: Record<string, unknown> | null;
  created_at: string;
}

// Labels para exibição
export const deliveryStatusLabels: Record<DeliveryStatus, string> = {
  label_created: 'Etiqueta Gerada',
  posted: 'Postado',
  in_transit: 'Em Trânsito',
  out_for_delivery: 'Saiu para Entrega',
  delivered: 'Entregue',
  failed: 'Falha na Entrega',
  returned: 'Devolvido',
  canceled: 'Cancelado',
  unknown: 'Desconhecido',
};

// Cores para badges
export const deliveryStatusColors: Record<DeliveryStatus, string> = {
  label_created: 'bg-gray-100 text-gray-800',
  posted: 'bg-blue-100 text-blue-800',
  in_transit: 'bg-yellow-100 text-yellow-800',
  out_for_delivery: 'bg-orange-100 text-orange-800',
  delivered: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  returned: 'bg-purple-100 text-purple-800',
  canceled: 'bg-gray-100 text-gray-800',
  unknown: 'bg-gray-100 text-gray-800',
};

// =============================================
// HOOK LEGADO - Baseado em orders (mantido para compatibilidade)
// =============================================

export function useShipments(options: UseShipmentsOptions = {}) {
  const { currentTenant } = useAuth();
  const { page = 1, pageSize = 20, status } = options;

  const shipmentsQuery = useQuery({
    queryKey: ['shipments', currentTenant?.id, page, pageSize, status],
    queryFn: async () => {
      if (!currentTenant?.id) return { shipments: [], totalCount: 0 };

      let query = supabase
        .from('orders')
        .select('id, order_number, customer_name, shipping_status, shipping_carrier, tracking_code, shipping_city, shipping_state, shipped_at, delivered_at, created_at', { count: 'exact' })
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false });

      if (status) {
        query = query.eq('shipping_status', status as 'pending' | 'processing' | 'shipped' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'returned' | 'failed');
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      query = query.range(from, to);

      const { data, count, error } = await query;

      if (error) {
        console.error('Error fetching shipments:', error);
        throw error;
      }

      return {
        shipments: (data || []) as Shipment[],
        totalCount: count || 0,
      };
    },
    enabled: !!currentTenant?.id,
  });

  const statsQuery = useQuery({
    queryKey: ['shipment-stats', currentTenant?.id],
    queryFn: async () => {
      if (!currentTenant?.id) return { pendingCount: 0, inTransitCount: 0, deliveredCount: 0, deliveryRate: 0 };

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      const { count: pendingCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .in('shipping_status', ['pending', 'processing']);

      const { count: inTransitCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .in('shipping_status', ['shipped', 'in_transit', 'out_for_delivery']);

      const { count: deliveredCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('shipping_status', 'delivered')
        .gte('delivered_at', monthStart);

      const { count: totalShipped } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .not('shipped_at', 'is', null);

      const deliveryRate = totalShipped && totalShipped > 0 ? ((deliveredCount || 0) / totalShipped) * 100 : 0;

      return {
        pendingCount: pendingCount || 0,
        inTransitCount: inTransitCount || 0,
        deliveredCount: deliveredCount || 0,
        deliveryRate,
      };
    },
    enabled: !!currentTenant?.id,
  });

  return {
    shipments: shipmentsQuery.data?.shipments || [],
    totalCount: shipmentsQuery.data?.totalCount || 0,
    stats: statsQuery.data || { pendingCount: 0, inTransitCount: 0, deliveredCount: 0, deliveryRate: 0 },
    isLoading: shipmentsQuery.isLoading,
    isStatsLoading: statsQuery.isLoading,
  };
}

// =============================================
// NOVOS HOOKS - Baseados na tabela shipments
// =============================================

// Hook para buscar remessas de um pedido específico
export function useOrderShipments(orderId: string | undefined) {
  return useQuery({
    queryKey: ['order-shipments', orderId],
    queryFn: async () => {
      if (!orderId) return [];

      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as ShipmentRecord[];
    },
    enabled: !!orderId,
  });
}

// Hook para buscar eventos de uma remessa
export function useShipmentEvents(shipmentId: string | undefined) {
  return useQuery({
    queryKey: ['shipment-events', shipmentId],
    queryFn: async () => {
      if (!shipmentId) return [];

      const { data, error } = await supabase
        .from('shipment_events')
        .select('*')
        .eq('shipment_id', shipmentId)
        .order('occurred_at', { ascending: false });

      if (error) throw error;
      return data as ShipmentEvent[];
    },
    enabled: !!shipmentId,
  });
}

// Hook para criar/atualizar remessa via edge function
export function useIngestShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      order_id?: string;
      order_number?: string;
      tracking_code: string;
      carrier: string;
      status?: string;
      source?: string;
      source_id?: string;
      metadata?: Record<string, unknown>;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('shipment-ingest', {
        body: data,
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Erro ao processar remessa');

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['order-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
      toast.success(result.is_new ? 'Remessa criada!' : 'Remessa atualizada!');
    },
    onError: (error: Error) => {
      console.error('Erro ao processar remessa:', error);
      toast.error('Erro ao processar remessa');
    },
  });
}

// Hook para criar remessa via shipping-create-shipment
export function useCreateShipment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      order_id: string;
      provider_override?: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('shipping-create-shipment', {
        body: data,
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Erro ao criar remessa');

      return result;
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['order-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['shipments'] });
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['orders-for-shipment'] });
      toast.success(`Remessa criada! Código: ${result.tracking_code}`);
    },
    onError: (error: Error) => {
      console.error('Erro ao criar remessa:', error);
      toast.error(error.message || 'Erro ao criar remessa');
    },
  });
}

// Hook para obter etiqueta
export function usePrintLabel() {
  return useMutation({
    mutationFn: async (data: {
      tracking_code: string;
      provider_shipment_id?: string;
    }) => {
      const { data: result, error } = await supabase.functions.invoke('shipping-get-label', {
        body: data,
      });

      if (error) throw error;
      if (!result?.success) throw new Error(result?.error || 'Erro ao obter etiqueta');

      return result;
    },
    onSuccess: (result) => {
      if (result.label_url) {
        window.open(result.label_url, '_blank');
      } else if (result.label_base64) {
        const byteCharacters = atob(result.label_base64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: result.label_type || 'application/pdf' });
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
      } else {
        toast.info('Etiqueta não disponível');
      }
    },
    onError: (error: Error) => {
      console.error('Erro ao obter etiqueta:', error);
      toast.error(error.message || 'Erro ao obter etiqueta');
    },
  });
}

// Hook para atualizar rastreamento de uma remessa
export function useRefreshTracking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (shipmentId: string) => {
      const { data: result, error } = await supabase.functions.invoke('tracking-poll-single', {
        body: { shipment_id: shipmentId },
      });

      if (error) throw error;
      return result;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-shipments'] });
      queryClient.invalidateQueries({ queryKey: ['shipment-events'] });
      queryClient.invalidateQueries({ queryKey: ['order-shipments'] });
      toast.success('Rastreamento atualizado');
    },
    onError: (error: Error) => {
      console.error('Erro ao atualizar rastreamento:', error);
      toast.error(error.message || 'Erro ao atualizar rastreamento');
    },
  });
}

// Hook para listar remessas do tenant com filtros
export function useShipmentsList(options: {
  search?: string;
  status?: DeliveryStatus | 'all';
  limit?: number;
} = {}) {
  const { currentTenant } = useAuth();
  const { search, status = 'all', limit = 100 } = options;

  return useQuery({
    queryKey: ['admin-shipments', currentTenant?.id, search, status, limit],
    queryFn: async () => {
      if (!currentTenant?.id) return [];

      let query = supabase
        .from('shipments')
        .select(`
          *,
          order:orders!inner(order_number, customer_name, customer_email)
        `)
        .eq('tenant_id', currentTenant.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status !== 'all') {
        query = query.eq('delivery_status', status);
      }

      if (search) {
        query = query.or(`tracking_code.ilike.%${search}%,order.order_number.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as (ShipmentRecord & { order: { order_number: string; customer_name: string; customer_email: string } })[];
    },
    enabled: !!currentTenant?.id,
  });
}
