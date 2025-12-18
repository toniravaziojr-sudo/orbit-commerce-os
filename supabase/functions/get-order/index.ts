// ============================================
// GET ORDER - Secure order lookup for thank-you page
// Uses service role to bypass RLS
// Returns order + items by ID or order_number
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GetOrderRequest {
  order_id?: string;
  order_number?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: GetOrderRequest = await req.json();
    console.log('[get-order] Request:', payload);

    const { order_id, order_number } = payload;

    if (!order_id && !order_number) {
      return new Response(JSON.stringify({
        success: false,
        error: 'order_id or order_number is required',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Find order
    let order;
    const isUUID = order_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id);

    if (isUUID) {
      const { data, error } = await supabase
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
        .eq('id', order_id)
        .maybeSingle();
      
      if (error) {
        console.error('[get-order] Error finding by ID:', error);
        throw error;
      }
      order = data;
    }

    // If not found by ID, try by order_number
    if (!order && order_number) {
      const { data, error } = await supabase
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
        .eq('order_number', order_number)
        .maybeSingle();
      
      if (error) {
        console.error('[get-order] Error finding by order_number:', error);
        throw error;
      }
      order = data;
    }

    // Also try order_id as order_number (fallback)
    if (!order && order_id && !isUUID) {
      const { data, error } = await supabase
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
        .eq('order_number', order_id)
        .maybeSingle();
      
      if (error) {
        console.error('[get-order] Error finding by order_id as order_number:', error);
        throw error;
      }
      order = data;
    }

    if (!order) {
      console.log('[get-order] Order not found');
      return new Response(JSON.stringify({
        success: true,
        order: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_name, product_image_url, quantity, unit_price, total_price, sku')
      .eq('order_id', order.id);

    if (itemsError) {
      console.error('[get-order] Error fetching items:', itemsError);
    }

    console.log('[get-order] Found order:', order.order_number, 'with', items?.length || 0, 'items');

    return new Response(JSON.stringify({
      success: true,
      order: {
        ...order,
        items: items || [],
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[get-order] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
