// ============================================
// GET-REVIEW-DATA - Secure order items lookup for review page
// Uses validated review token to return order items
// Replaces direct anonymous SELECT on order_items
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GetReviewDataRequest {
  token: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const payload: GetReviewDataRequest = await req.json();

    if (!payload.token) {
      return new Response(JSON.stringify({ success: false, error: 'Token required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[get-review-data] Validating token');

    // Validate token via existing RPC
    const { data: tokenRows, error: tokenError } = await supabase
      .rpc('validate_review_token', { p_token: payload.token });

    if (tokenError) {
      console.error('[get-review-data] Token validation error:', tokenError);
      throw tokenError;
    }

    if (!tokenRows || tokenRows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid token' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const tokenData = tokenRows[0];
    if (!tokenData.is_valid) {
      return new Response(JSON.stringify({ success: false, error: 'Token expired or already used' }), {
        status: 410,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[get-review-data] Token valid, fetching order items for order:', tokenData.order_id);

    // Fetch order items
    const { data: items, error: itemsError } = await supabase
      .from('order_items')
      .select('id, product_id, product_name, product_image_url, product_slug, quantity')
      .eq('order_id', tokenData.order_id);

    if (itemsError) {
      console.error('[get-review-data] Error fetching items:', itemsError);
      throw itemsError;
    }

    // Fetch existing reviews for these products by this customer
    const productIds = (items || []).map(i => i.product_id).filter(Boolean);
    let existingReviewProductIds: string[] = [];

    if (productIds.length > 0 && tokenData.customer_email) {
      const { data: existingReviews } = await supabase
        .from('product_reviews')
        .select('product_id')
        .eq('tenant_id', tokenData.tenant_id)
        .ilike('customer_email', tokenData.customer_email)
        .in('product_id', productIds);

      existingReviewProductIds = (existingReviews || []).map(r => r.product_id);
    }

    // Fetch store name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', tokenData.tenant_id)
      .single();

    return new Response(JSON.stringify({
      success: true,
      token_data: {
        token_id: tokenData.token_id,
        tenant_id: tokenData.tenant_id,
        order_id: tokenData.order_id,
        customer_id: tokenData.customer_id,
        customer_email: tokenData.customer_email,
        is_valid: tokenData.is_valid,
        store_url: tokenData.store_url,
      },
      items: items || [],
      existing_review_product_ids: existingReviewProductIds,
      store_name: tenant?.name || null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[get-review-data] Error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
