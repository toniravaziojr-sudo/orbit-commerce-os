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

interface UseCustomerOrdersOptions {
  page?: number;
  pageSize?: number;
}

export function useCustomerOrders(customerId: string | undefined, options: UseCustomerOrdersOptions = {}) {
  const { page = 1, pageSize = 10 } = options;

  const ordersQuery = useQuery({
    queryKey: ['customer-orders', customerId, page, pageSize],
    queryFn: async () => {
      if (!customerId) return { orders: [], totalCount: 0 };

      // Get total count
      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('customer_id', customerId);

      // Fetch orders for this customer with pagination
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, status, total, created_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error) {
        console.error('Error fetching customer orders:', error);
        throw error;
      }

      // Fetch item counts for each order
      const ordersWithCounts: CustomerOrder[] = await Promise.all(
        (orders || []).map(async (order) => {
          const { count: itemCount } = await supabase
            .from('order_items')
            .select('*', { count: 'exact', head: true })
            .eq('order_id', order.id);

          return {
            ...order,
            items_count: itemCount || 0,
          };
        })
      );

      return {
        orders: ordersWithCounts,
        totalCount: count || 0,
      };
    },
    enabled: !!customerId,
  });

  return {
    orders: ordersQuery.data?.orders || [],
    totalCount: ordersQuery.data?.totalCount || 0,
    isLoading: ordersQuery.isLoading,
    error: ordersQuery.error,
  };
}
