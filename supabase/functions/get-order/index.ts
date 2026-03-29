// ============================================
// GET ORDER - Secure order lookup for thank-you page
// Uses service role to bypass RLS
// Returns order + items + payment instructions (PIX/Boleto)
// v2 - Shared rate limiting via database
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

// Rate limit config
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_REQUESTS = 15;

interface GetOrderRequest {
  order_id?: string;
  order_number?: string;
  tenant_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role (bypasses RLS + can call restricted functions)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // --- Shared Rate Limiting (database-backed) ---
    const clientIP = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || req.headers.get('x-real-ip')
      || 'unknown';
    const rateLimitKey = `get-order:${clientIP}`;

    const { data: rlData, error: rlError } = await supabase.rpc('check_rate_limit', {
      p_key: rateLimitKey,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
      p_max_requests: RATE_LIMIT_MAX_REQUESTS,
    });

    if (rlError) {
      console.warn('[get-order] Rate limit check failed (allowing request):', rlError.message);
    } else if (rlData === false) {
      console.warn('[get-order] Rate limited:', rateLimitKey);
      return new Response(JSON.stringify({
        success: false,
        error: 'Too many requests. Please try again later.',
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Retry-After': String(RATE_LIMIT_WINDOW_SECONDS) },
      });
    }

    const payload: GetOrderRequest = await req.json();
    console.log('[get-order] Request:', payload);

    // Normalize order_number
    const order_id = payload.order_id;
    const tenant_id = payload.tenant_id;
    const rawOrderNumber = payload.order_number?.replace(/^#/, '').trim();
    const order_number_with_hash = rawOrderNumber ? `#${rawOrderNumber}` : null;
    const order_number_without_hash = rawOrderNumber;

    console.log('[get-order] Normalized:', { order_id, tenant_id, order_number_with_hash, order_number_without_hash });

    if (!order_id && !rawOrderNumber) {
      return new Response(JSON.stringify({
        success: false,
        error: 'order_id or order_number is required',
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const orderSelect = `
      id, tenant_id, order_number, status, payment_status, shipping_status, payment_method,
      total, subtotal, shipping_total, discount_total,
      created_at, paid_at, shipped_at, delivered_at,
      tracking_code, shipping_carrier,
      customer_name, customer_email, customer_phone,
      shipping_street, shipping_number, shipping_complement,
      shipping_neighborhood, shipping_city, shipping_state, shipping_postal_code,
      installments, retry_token, retry_token_expires_at
    `;

    // Find order
    let order;
    const isUUID = order_id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(order_id);

    if (isUUID) {
      const { data, error } = await supabase
        .from('orders')
        .select(orderSelect)
        .eq('id', order_id)
        .maybeSingle();
      
      if (error) {
        console.error('[get-order] Error finding by ID:', error);
        throw error;
      }
      order = data;
    }

    // Try by order_number with # prefix
    if (!order && order_number_with_hash) {
      console.log('[get-order] Searching by order_number with hash:', order_number_with_hash, 'tenant:', tenant_id);
      
      let query = supabase
        .from('orders')
        .select(orderSelect)
        .eq('order_number', order_number_with_hash);
      
      if (tenant_id) {
        query = query.eq('tenant_id', tenant_id);
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[get-order] Error finding by order_number:', error);
      } else {
        order = data;
      }
    }

    // Fallback: without # prefix
    if (!order && order_number_without_hash) {
      console.log('[get-order] Fallback search without hash:', order_number_without_hash, 'tenant:', tenant_id);
      
      let query = supabase
        .from('orders')
        .select(orderSelect)
        .eq('order_number', order_number_without_hash);
      
      if (tenant_id) {
        query = query.eq('tenant_id', tenant_id);
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[get-order] Error finding without hash:', error);
      } else {
        order = data;
      }
    }

    // Fallback: order_id as order_number
    if (!order && order_id && !isUUID) {
      let query = supabase
        .from('orders')
        .select(orderSelect)
        .eq('order_number', order_id);
      
      if (tenant_id) {
        query = query.eq('tenant_id', tenant_id);
      }
      
      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.error('[get-order] Error finding by order_id as order_number:', error);
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
    // v8.23.0: Include product_id for marketing tracking (meta content_id resolution)
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, product_name, product_image_url, quantity, unit_price, total_price, sku')
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
          pix_qr_code: pd.qr_code || null,
          pix_qr_code_url: pd.qr_code_url || null,
          pix_expires_at: pd.pix_expires_at || null,
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

    // Strip sensitive fields and conditionally include retry_token
    const { retry_token, retry_token_expires_at, ...safeOrder } = order;
    
    // Only include retry_token if payment is not approved and token is still valid
    const includeRetryToken = retry_token 
      && retry_token_expires_at 
      && new Date(retry_token_expires_at) > new Date()
      && order.payment_status !== 'approved';

    return new Response(JSON.stringify({
      success: true,
      order: {
        ...safeOrder,
        items: items || [],
        payment_instructions: paymentInstructions,
        ...(includeRetryToken ? { retry_token } : {}),
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[get-order] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: "Erro interno" || 'Unknown error',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
