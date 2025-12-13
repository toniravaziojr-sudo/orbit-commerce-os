import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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

      // Get current month start
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Get pending shipments
      const { count: pendingCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .in('shipping_status', ['pending', 'processing']);

      // Get in transit shipments
      const { count: inTransitCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .in('shipping_status', ['shipped', 'in_transit', 'out_for_delivery']);

      // Get delivered this month
      const { count: deliveredCount } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('tenant_id', currentTenant.id)
        .eq('shipping_status', 'delivered')
        .gte('delivered_at', monthStart);

      // Calculate delivery rate (delivered / total shipped)
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
