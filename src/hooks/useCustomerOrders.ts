// =============================================
// USE CUSTOMER ORDERS - Real database orders for logged-in customers
// v2 - Uses order-lookup edge function (no direct DB reads)
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { normalizeEmail } from '@/lib/normalizeEmail';
import { normalizeOrderStatus, ORDER_STATUS_CONFIG } from '@/types/orderStatus';

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
  status: string;
  payment_status: string;
  shipping_status: string;
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

// List orders for a customer via edge function (secure, no direct DB reads)
export function useCustomerOrders(customerEmailOverride?: string) {
  const { email: authEmail, isLoading: authLoading } = useCurrentUserEmail();
  
  const rawEmail = customerEmailOverride || authEmail;
  const customerEmail = normalizeEmail(rawEmail);

  const ordersQuery = useQuery({
    queryKey: ['customer-orders', customerEmail],
    queryFn: async (): Promise<CustomerOrder[]> => {
      if (!customerEmail) return [];

      console.log('[useCustomerOrders] Fetching orders via edge function for:', customerEmail);

      const { data, error } = await supabase.functions.invoke('order-lookup', {
        body: { action: 'list', customer_email: customerEmail },
      });

      if (error) {
        console.error('[useCustomerOrders] Edge function error:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('[useCustomerOrders] Request failed:', data?.error);
        throw new Error(data?.error || 'Erro ao buscar pedidos');
      }

      console.log('[useCustomerOrders] Found orders:', data.orders?.length || 0);
      return (data.orders || []) as CustomerOrder[];
    },
    enabled: !authLoading && !!customerEmail,
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading || authLoading,
    error: ordersQuery.error,
    customerEmail,
    isMockMode: false,
  };
}

// Get single order by ID via edge function
export function useCustomerOrder(orderId?: string) {
  const orderQuery = useQuery({
    queryKey: ['customer-order', orderId],
    queryFn: async (): Promise<CustomerOrder | null> => {
      if (!orderId) return null;

      console.log('[useCustomerOrder] Fetching order via edge function:', orderId);

      const { data, error } = await supabase.functions.invoke('order-lookup', {
        body: { action: 'get', order_id: orderId },
      });

      if (error) {
        console.error('[useCustomerOrder] Edge function error:', error);
        throw error;
      }

      if (!data?.success) {
        throw new Error(data?.error || 'Erro ao buscar pedido');
      }

      return (data.order as CustomerOrder) || null;
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
export function getOrderStatusInfo(status: string) {
  const normalized = normalizeOrderStatus(status);
  const cfg = ORDER_STATUS_CONFIG[normalized];
  
  const colorMap: Record<string, string> = {
    outline: 'bg-yellow-100 text-yellow-800',
    secondary: 'bg-blue-100 text-blue-800',
    default: 'bg-green-100 text-green-800',
    destructive: 'bg-red-100 text-red-800',
  };
  
  return { 
    label: cfg?.label || status, 
    color: colorMap[cfg?.variant || 'outline'] || 'bg-gray-100 text-gray-800' 
  };
}
