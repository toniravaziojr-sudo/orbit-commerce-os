import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface CustomerOrder {
  id: string;
  order_number: string;
  status: string;
  total: number;
  created_at: string;
  items_count: number;
}

export function useCustomerOrders(customerId: string | undefined) {
  const ordersQuery = useQuery({
    queryKey: ['customer-orders', customerId],
    queryFn: async () => {
      if (!customerId) return [];

      // Fetch orders for this customer
      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching customer orders:', error);
        throw error;
      }

      // Fetch item counts for each order
      const ordersWithCounts: CustomerOrder[] = await Promise.all(
        (orders || []).map(async (order) => {
          const { count } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id);

          return {
            ...order,
            items_count: count || 0,
          };
        })
      );

      return ordersWithCounts;
    },
    enabled: !!customerId,
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    error: ordersQuery.error,
  };
}
