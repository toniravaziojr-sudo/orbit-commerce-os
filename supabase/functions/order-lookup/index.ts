// ============================================
// ORDER-LOOKUP - Secure order listing for logged-in customers
// Replaces direct anonymous SELECT on orders/order_items
// Uses service_role to bypass RLS, validates auth JWT
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface OrderLookupRequest {
  action: 'list' | 'get';
  customer_email?: string;  // for 'list'
  order_id?: string;        // for 'get' (UUID or order_number)
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate JWT - only authenticated users can list their orders
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ success: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify the user's JWT to get their email
    const supabaseAuth = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!);
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user?.email) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: OrderLookupRequest = await req.json();
    const userEmail = user.email.trim().toLowerCase();

    console.log('[order-lookup]', payload.action, 'for', userEmail);

    const orderSelect = `
      id, order_number, status, payment_status, shipping_status,
      total, subtotal, shipping_total, discount_total,
      created_at, shipped_at, delivered_at, tracking_code, shipping_carrier,
      customer_name, customer_email
    `;

    if (payload.action === 'list') {
      // List orders for authenticated user's email
      // Ghost Order Rule: only show orders confirmed by gateway
      const { data: orders, error } = await supabase
        .from('orders')
        .select(orderSelect)
        .eq('customer_email', userEmail)
        .not('payment_gateway_id', 'is', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('[order-lookup] Error listing orders:', error);
        throw error;
      }

      // Fetch items for each order
      const ordersWithItems = await Promise.all(
        (orders || []).map(async (order) => {
          const { data: items } = await supabase
            .from('order_items')
            .select('id, product_name, product_image_url, quantity, unit_price, total_price')
            .eq('order_id', order.id);
          return { ...order, items: items || [] };
        })
      );

      return new Response(JSON.stringify({ success: true, orders: ordersWithItems }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (payload.action === 'get') {
      const orderId = payload.order_id;
      if (!orderId) {
        return new Response(JSON.stringify({ success: false, error: 'order_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      let order;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);

      if (isUUID) {
        const { data } = await supabase
          .from('orders')
          .select(orderSelect)
          .eq('id', orderId)
          .eq('customer_email', userEmail)
          .maybeSingle();
        order = data;
      }

      if (!order) {
        const { data } = await supabase
          .from('orders')
          .select(orderSelect)
          .eq('order_number', orderId)
          .eq('customer_email', userEmail)
          .maybeSingle();
        order = data;
      }

      if (!order) {
        return new Response(JSON.stringify({ success: true, order: null }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const { data: items } = await supabase
        .from('order_items')
        .select('id, product_name, product_image_url, quantity, unit_price, total_price')
        .eq('order_id', order.id);

      return new Response(JSON.stringify({
        success: true,
        order: { ...order, items: items || [] },
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[order-lookup] Error:', error);
    return new Response(JSON.stringify({ success: false, error: "Erro interno. Se o problema persistir, entre em contato com o suporte." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
