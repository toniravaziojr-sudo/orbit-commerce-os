// =============================================
// USE CUSTOMER ORDERS - Real database orders for logged-in customers
// No more mock data - uses Supabase auth email (normalized)
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { normalizeEmail } from '@/lib/normalizeEmail';
export interface OrderItem {
  id: string;
  product_name: string;
  product_image_url?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CustomerOrder {
  id: string;
  order_number: string;
  status: 'pending' | 'awaiting_payment' | 'paid' | 'processing' | 'shipped' | 'in_transit' | 'delivered' | 'cancelled' | 'returned';
  payment_status: 'pending' | 'processing' | 'approved' | 'declined';
  shipping_status: 'pending' | 'processing' | 'shipped' | 'in_transit' | 'delivered';
  total: number;
  subtotal: number;
  shipping_total: number;
  discount_total: number;
  created_at: string;
  shipped_at?: string;
  delivered_at?: string;
  tracking_code?: string;
  shipping_carrier?: string;
  items: OrderItem[];
  items_count?: number;
  customer_name: string;
  customer_email: string;
}

// Hook to get current user email
function useCurrentUserEmail(): { email: string | null; isLoading: boolean } {
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setEmail(session?.user?.email || null);
      setIsLoading(false);
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setEmail(session?.user?.email || null);
    });

    return () => subscription.unsubscribe();
  }, []);

  return { email, isLoading };
}

// List orders for a customer by email (normalized)
export function useCustomerOrders(customerEmailOverride?: string) {
  const { email: authEmail, isLoading: authLoading } = useCurrentUserEmail();
  
  // Use override if provided (for admin viewing), otherwise use logged-in user's email
  // Always normalize email to ensure consistent matching
  const rawEmail = customerEmailOverride || authEmail;
  const customerEmail = normalizeEmail(rawEmail);

  const ordersQuery = useQuery({
    queryKey: ['customer-orders', customerEmail],
    queryFn: async (): Promise<CustomerOrder[]> => {
      if (!customerEmail) return [];

      console.log('[useCustomerOrders] Fetching orders for (normalized):', customerEmail);

      // Real query - fetch orders by customer email (normalized)
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, shipping_status,
          total, subtotal, shipping_total, discount_total,
          created_at, shipped_at, delivered_at, tracking_code, shipping_carrier,
          customer_name, customer_email
        `)
        .eq('customer_email', customerEmail)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[useCustomerOrders] Error fetching orders:', error);
        throw error;
      }

      console.log('[useCustomerOrders] Found orders:', orders?.length || 0);

      // Fetch items for each order
      const ordersWithItems: CustomerOrder[] = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('id, product_name, product_image_url, quantity, unit_price, total_price')
            .eq('order_id', order.id);

          return {
            ...order,
            items: items || [],
          } as CustomerOrder;
        })
      );

      return ordersWithItems;
    },
    enabled: !authLoading && !!customerEmail,
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading || authLoading,
    error: ordersQuery.error,
    customerEmail,
    isMockMode: false, // No more mock mode
  };
}

// Get single order by ID
export function useCustomerOrder(orderId?: string) {
  const orderQuery = useQuery({
    queryKey: ['customer-order', orderId],
    queryFn: async (): Promise<CustomerOrder | null> => {
      if (!orderId) return null;

      console.log('[useCustomerOrder] Fetching order:', orderId);

      // Try by ID first, then by order_number
      let order;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);

      if (isUUID) {
        const result = await supabase
          .from('orders')
          .select(`
            id, order_number, status, payment_status, shipping_status,
            total, subtotal, shipping_total, discount_total,
            created_at, shipped_at, delivered_at, tracking_code, shipping_carrier,
            customer_name, customer_email
          `)
          .eq('id', orderId)
          .maybeSingle();
        order = result.data;
      }
      
      if (!order) {
        const result = await supabase
          .from('orders')
          .select(`
            id, order_number, status, payment_status, shipping_status,
            total, subtotal, shipping_total, discount_total,
            created_at, shipped_at, delivered_at, tracking_code, shipping_carrier,
            customer_name, customer_email
          `)
          .eq('order_number', orderId)
          .maybeSingle();
        order = result.data;
      }

      if (!order) return null;

      // Fetch items
      const { data: items } = await supabase
        .from('order_items')
        .select('id, product_name, product_image_url, quantity, unit_price, total_price')
        .eq('order_id', order.id);

      return { ...order, items: items || [] } as CustomerOrder;
    },
    enabled: !!orderId,
  });

  return {
    order: orderQuery.data || null,
    isLoading: orderQuery.isLoading,
    error: orderQuery.error,
    isMockMode: false,
  };
}

// Get status label and color
export function getOrderStatusInfo(status: CustomerOrder['status']) {
  const statusMap: Record<CustomerOrder['status'], { label: string; color: string }> = {
    pending: { label: 'Pendente', color: 'bg-yellow-100 text-yellow-800' },
    awaiting_payment: { label: 'Aguardando pagamento', color: 'bg-yellow-100 text-yellow-800' },
    paid: { label: 'Pago', color: 'bg-green-100 text-green-800' },
    processing: { label: 'Em separação', color: 'bg-blue-100 text-blue-800' },
    shipped: { label: 'Enviado', color: 'bg-purple-100 text-purple-800' },
    in_transit: { label: 'Em trânsito', color: 'bg-purple-100 text-purple-800' },
    delivered: { label: 'Entregue', color: 'bg-green-100 text-green-800' },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-800' },
    returned: { label: 'Devolvido', color: 'bg-gray-100 text-gray-800' },
  };
  return statusMap[status] || { label: status, color: 'bg-gray-100 text-gray-800' };
}
