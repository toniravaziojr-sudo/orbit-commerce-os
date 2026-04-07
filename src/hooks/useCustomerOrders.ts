// =============================================
// USE CUSTOMER ORDERS - Real database orders
// v3 - Admin view uses direct DB query; storefront uses edge function
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { normalizeEmail } from '@/lib/normalizeEmail';
import { normalizeOrderStatus, ORDER_STATUS_CONFIG } from '@/types/orderStatus';
import { useAuth } from '@/hooks/useAuth';

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

// Admin view: fetch orders for a specific customer email directly from DB
export function useCustomerOrders(customerEmailOverride?: string) {
  const { currentTenant } = useAuth();
  const { email: authEmail, isLoading: authLoading } = useCurrentUserEmail();
  
  const rawEmail = customerEmailOverride || authEmail;
  const customerEmail = normalizeEmail(rawEmail);
  const tenantId = currentTenant?.id;

  // If customerEmailOverride is provided, we're in admin mode → query DB directly
  const isAdminMode = !!customerEmailOverride;

  const ordersQuery = useQuery({
    queryKey: ['customer-orders', customerEmail, tenantId, isAdminMode],
    queryFn: async (): Promise<CustomerOrder[]> => {
      if (!customerEmail) return [];

      if (isAdminMode && tenantId) {
        // ADMIN MODE: Direct DB query filtered by the customer's email + tenant
        console.log('[useCustomerOrders] Admin mode - querying DB for:', customerEmail);

        const { data: orders, error } = await supabase
          .from('orders')
          .select('id, order_number, status, payment_status, shipping_status, total, subtotal, shipping_total, discount_total, created_at, shipped_at, delivered_at, tracking_code, shipping_carrier, customer_name, customer_email')
          .eq('tenant_id', tenantId)
          .ilike('customer_email', customerEmail)
          .order('created_at', { ascending: false })
          .limit(100);

        if (error) {
          console.error('[useCustomerOrders] DB error:', error);
          throw error;
        }

        // Fetch items for each order
        const orderIds = (orders || []).map(o => o.id);
        let itemsMap: Record<string, OrderItem[]> = {};
        
        if (orderIds.length > 0) {
          const { data: items } = await supabase
            .from('order_items')
            .select('id, order_id, product_name, product_image_url, quantity, unit_price, total_price')
            .in('order_id', orderIds);

          if (items) {
            for (const item of items) {
              const oid = (item as any).order_id;
              if (!itemsMap[oid]) itemsMap[oid] = [];
              itemsMap[oid].push({
                id: item.id,
                product_name: item.product_name,
                product_image_url: item.product_image_url || undefined,
                quantity: item.quantity,
                unit_price: item.unit_price,
                total_price: item.total_price,
              });
            }
          }
        }

        return (orders || []).map(o => ({
          ...o,
          subtotal: o.subtotal || 0,
          shipping_total: o.shipping_total || 0,
          discount_total: o.discount_total || 0,
          items: itemsMap[o.id] || [],
          customer_name: o.customer_name || '',
          customer_email: o.customer_email || '',
        })) as CustomerOrder[];
      } else {
        // STOREFRONT MODE: Use edge function (for logged-in customers viewing their own orders)
        console.log('[useCustomerOrders] Storefront mode - edge function for:', customerEmail);

        const { data, error } = await supabase.functions.invoke('order-lookup', {
          body: { action: 'list', customer_email: customerEmail },
        });

        if (error) {
          console.error('[useCustomerOrders] Edge function error:', error);
          throw error;
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Erro ao buscar pedidos');
        }

        return (data.orders || []) as CustomerOrder[];
      }
    },
    enabled: !authLoading && !!customerEmail && (!isAdminMode || !!tenantId),
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

      const { data, error } = await supabase.functions.invoke('order-lookup', {
        body: { action: 'get', order_id: orderId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao buscar pedido');

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
  
  // Use custom color if defined (e.g. yellow for chargeback_detected)
  if (cfg?.color) {
    const bgMap: Record<string, string> = {
      'text-yellow-700': 'bg-yellow-100 text-yellow-800',
      'text-green-700': 'bg-green-100 text-green-800',
    };
    return {
      label: cfg.label,
      color: bgMap[cfg.color] || 'bg-gray-100 text-gray-800',
    };
  }
  
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
