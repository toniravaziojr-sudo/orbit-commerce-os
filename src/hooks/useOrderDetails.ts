// =============================================
// USE ORDER DETAILS - Fetch real order from database
// For ThankYou page and order detail views
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface OrderDetails {
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
  paid_at?: string;
  shipped_at?: string;
  delivered_at?: string;
  tracking_code?: string;
  shipping_carrier?: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  shipping_street?: string;
  shipping_number?: string;
  shipping_complement?: string;
  shipping_neighborhood?: string;
  shipping_city?: string;
  shipping_state?: string;
  shipping_postal_code?: string;
  items: {
    id: string;
    product_name: string;
    product_image_url?: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    sku: string;
  }[];
}

// Fetch order by ID or order_number
export function useOrderDetails(orderIdOrNumber?: string) {
  return useQuery({
    queryKey: ['order-details', orderIdOrNumber],
    queryFn: async (): Promise<OrderDetails | null> => {
      if (!orderIdOrNumber) return null;

      // Try to find by ID first, then by order_number
      let order;
      let error;

      // Check if it looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrNumber);

      if (isUUID) {
        const result = await supabase
          .from('orders')
          .select(`
            id, order_number, status, payment_status, shipping_status,
            total, subtotal, shipping_total, discount_total,
            created_at, paid_at, shipped_at, delivered_at,
            tracking_code, shipping_carrier,
            customer_name, customer_email, customer_phone,
            shipping_street, shipping_number, shipping_complement,
            shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code
          `)
          .eq('id', orderIdOrNumber)
          .maybeSingle();
        order = result.data;
        error = result.error;
      }
      
      // If not found by ID, try by order_number
      if (!order) {
        const result = await supabase
          .from('orders')
          .select(`
            id, order_number, status, payment_status, shipping_status,
            total, subtotal, shipping_total, discount_total,
            created_at, paid_at, shipped_at, delivered_at,
            tracking_code, shipping_carrier,
            customer_name, customer_email, customer_phone,
            shipping_street, shipping_number, shipping_complement,
            shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code
          `)
          .eq('order_number', orderIdOrNumber)
          .maybeSingle();
        order = result.data;
        error = result.error;
      }

      if (error) {
        console.error('Error fetching order:', error);
        throw error;
      }

      if (!order) return null;

      // Fetch order items
      const { data: items, error: itemsError } = await supabase
        .from('order_items')
        .select('id, product_name, product_image_url, quantity, unit_price, total_price, sku')
        .eq('order_id', order.id);

      if (itemsError) {
        console.error('Error fetching order items:', itemsError);
      }

      return {
        ...order,
        items: items || [],
      } as OrderDetails;
    },
    enabled: !!orderIdOrNumber,
    staleTime: 30000, // 30 seconds
  });
}
