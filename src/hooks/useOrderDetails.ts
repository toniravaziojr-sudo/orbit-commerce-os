// =============================================
// USE ORDER DETAILS - Fetch order via secure edge function
// For ThankYou page and order detail views
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PaymentInstructions {
  method: string;
  status: string;
  pix_qr_code: string | null;
  pix_qr_code_url: string | null;
  pix_expires_at: string | null;
  boleto_url: string | null;
  boleto_barcode: string | null;
  boleto_due_date: string | null;
}

export interface OrderDetails {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method?: string;
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
  payment_instructions?: PaymentInstructions | null;
}

// Fetch order by ID or order_number via edge function (secure, bypasses RLS)
export function useOrderDetails(orderIdOrNumber?: string) {
  return useQuery({
    queryKey: ['order-details', orderIdOrNumber],
    queryFn: async (): Promise<OrderDetails | null> => {
      if (!orderIdOrNumber) return null;

      console.log('[useOrderDetails] Fetching order via edge function:', orderIdOrNumber);

      // Check if it looks like a UUID
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderIdOrNumber);

      const { data, error } = await supabase.functions.invoke('get-order', {
        body: isUUID 
          ? { order_id: orderIdOrNumber }
          : { order_number: orderIdOrNumber },
      });

      if (error) {
        console.error('[useOrderDetails] Edge function error:', error);
        throw error;
      }

      if (!data?.success) {
        console.error('[useOrderDetails] Request failed:', data?.error);
        throw new Error(data?.error || 'Erro ao buscar pedido');
      }

      if (!data.order) {
        console.log('[useOrderDetails] Order not found');
        return null;
      }

      console.log('[useOrderDetails] Order found:', data.order.order_number);
      return data.order as OrderDetails;
    },
    enabled: !!orderIdOrNumber,
    staleTime: 30000, // 30 seconds
  });
}
