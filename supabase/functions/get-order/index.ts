// ============================================
// GET ORDER - Secure order lookup for thank-you page
// Uses service role to bypass RLS
// Returns order + items + payment instructions (PIX/Boleto)
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

    // Normalize order_number - accept with or without # prefix
    // The DB stores order_number WITH # (e.g., "#5001")
    // The client may send "5001" or "#5001" - we need to handle both
    const order_id = payload.order_id;
    const rawOrderNumber = payload.order_number?.replace(/^#/, '').trim();
    
    // The DB has the # prefix, so we need to search with it
    const order_number_with_hash = rawOrderNumber ? `#${rawOrderNumber}` : null;
    // Also keep version without hash for fallback search
    const order_number_without_hash = rawOrderNumber;

    console.log('[get-order] Normalized:', { order_id, order_number_with_hash, order_number_without_hash });

    if (!order_id && !rawOrderNumber) {
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
          id, order_number, status, payment_status, shipping_status, payment_method,
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

    // If not found by ID, try by order_number (with # prefix as stored in DB)
    if (!order && order_number_with_hash) {
      console.log('[get-order] Searching by order_number with hash:', order_number_with_hash);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, shipping_status, payment_method,
          total, subtotal, shipping_total, discount_total,
          created_at, paid_at, shipped_at, delivered_at,
          tracking_code, shipping_carrier,
          customer_name, customer_email, customer_phone,
          shipping_street, shipping_number, shipping_complement,
          shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code
        `)
        .eq('order_number', order_number_with_hash)
        .maybeSingle();
      
      if (error) {
        console.error('[get-order] Error finding by order_number:', error);
        throw error;
      }
      order = data;
    }

    // Fallback: try without # prefix (for legacy order formats like PED-25-000057)
    if (!order && order_number_without_hash) {
      console.log('[get-order] Fallback search without hash:', order_number_without_hash);
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, shipping_status, payment_method,
          total, subtotal, shipping_total, discount_total,
          created_at, paid_at, shipped_at, delivered_at,
          tracking_code, shipping_carrier,
          customer_name, customer_email, customer_phone,
          shipping_street, shipping_number, shipping_complement,
          shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code
        `)
        .eq('order_number', order_number_without_hash)
        .maybeSingle();
      
      if (error) {
        console.error('[get-order] Error finding without hash:', error);
        throw error;
      }
      order = data;
    }

    // Also try order_id as order_number (fallback for UUID-like strings)
    if (!order && order_id && !isUUID) {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, payment_status, shipping_status, payment_method,
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

    // Fetch payment transaction for PIX/Boleto data (if payment pending)
    let paymentInstructions = null;
    if (order.payment_status === 'pending') {
      const { data: transaction, error: txError } = await supabase
        .from('payment_transactions')
        .select('id, method, status, payment_data, created_at')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (txError) {
        console.error('[get-order] Error fetching payment transaction:', txError);
      }

      if (transaction?.payment_data) {
        const pd = transaction.payment_data as Record<string, unknown>;
        paymentInstructions = {
          method: transaction.method,
          status: transaction.status,
          // PIX data
          pix_qr_code: pd.qr_code || null,
          pix_qr_code_url: pd.qr_code_url || null,
          pix_expires_at: pd.pix_expires_at || null,
          // Boleto data
          boleto_url: pd.boleto_url || null,
          boleto_barcode: pd.boleto_barcode || null,
          boleto_due_date: pd.boleto_due_date || null,
        };
        console.log('[get-order] Payment instructions found:', {
          method: transaction.method,
          has_pix_qr: !!pd.qr_code,
          has_boleto: !!pd.boleto_url,
        });
      }
    }

    console.log('[get-order] Found order:', order.order_number, 'with', items?.length || 0, 'items');

    return new Response(JSON.stringify({
      success: true,
      order: {
        ...order,
        items: items || [],
        payment_instructions: paymentInstructions,
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
