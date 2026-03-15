// ============================================
// GET RETRY CHECKOUT DATA - Validates retry_token and returns
// prefill data for checkout (customer, items, shipping).
// NO sensitive data (CPF) is returned — CPF stays server-side.
// Used by Step 5: "Tentar com outra forma de pagamento"
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface RetryCheckoutRequest {
  retry_token: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: RetryCheckoutRequest = await req.json();

    if (!payload.retry_token || typeof payload.retry_token !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Token de retentativa inválido.',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Validate token and load order data server-side
    const { data: orderRows, error: tokenError } = await supabase.rpc('validate_order_retry_token', {
      p_token: payload.retry_token,
    });

    if (tokenError || !orderRows || orderRows.length === 0) {
      console.error('[get-retry-checkout-data] Token validation failed:', tokenError?.message);
      return new Response(JSON.stringify({
        success: false,
        error: 'Token de retentativa inválido ou expirado.',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const order = orderRows[0];

    if (!order.is_valid) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Este link de retentativa expirou ou o pedido já foi pago.',
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, product_name, sku, quantity, unit_price, total_price, product_image_url')
      .eq('order_id', order.order_id);

    if (itemsError) {
      console.error('[get-retry-checkout-data] Error fetching items:', itemsError.message);
    }

    // Fetch tenant slug for redirect
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', order.tenant_id)
      .single();

    console.log('[get-retry-checkout-data] Token valid, returning checkout prefill for order:', order.order_number);

    // Return SAFE prefill data — NO CPF
    return new Response(JSON.stringify({
      success: true,
      checkout_prefill: {
        original_order_id: order.order_id,
        order_number: order.order_number,
        tenant_id: order.tenant_id,
        tenant_slug: tenant?.slug || '',
        total: Number(order.total),
        customer: {
          name: order.customer_name,
          email: order.customer_email,
          phone: order.customer_phone || '',
          // CPF NOT included — resolved server-side by checkout-create-order
        },
        shipping: {
          street: order.shipping_street || '',
          number: order.shipping_number || '',
          complement: order.shipping_complement || '',
          neighborhood: order.shipping_neighborhood || '',
          city: order.shipping_city || '',
          state: order.shipping_state || '',
          postal_code: order.shipping_postal_code || '',
        },
        items: (items || []).map((item: any) => ({
          product_id: item.product_id,
          product_name: item.product_name,
          sku: item.sku || '',
          quantity: item.quantity,
          unit_price: item.unit_price,
          image_url: item.product_image_url || '',
        })),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[get-retry-checkout-data] Unexpected error:', error.message);
    return new Response(JSON.stringify({
      success: false,
      error: 'Erro inesperado ao carregar dados para retentativa.',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
