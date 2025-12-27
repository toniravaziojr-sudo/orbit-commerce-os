// ============================================
// CHECKOUT CREATE ORDER - Server-side order creation
// Handles customer upsert, order creation, order items
// Uses service role to bypass RLS
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface OrderItem {
  product_id: string;
  product_name: string;
  sku: string;
  quantity: number;
  unit_price: number;
  image_url?: string;
}

interface DiscountData {
  discount_id: string;
  discount_code: string;
  discount_name: string;
  discount_type: string;
  discount_amount: number;
  free_shipping: boolean;
}

interface CreateOrderRequest {
  tenant_id: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    cpf: string;
  };
  shipping: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    postal_code: string;
    carrier?: string;
    service_code?: string;
    service_name?: string;
    estimated_days?: number;
  };
  items: OrderItem[];
  payment_method: 'pix' | 'boleto' | 'credit_card';
  subtotal: number;
  shipping_total: number;
  discount_total?: number;
  total: number;
  discount?: DiscountData;
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    gclid?: string;
    fbclid?: string;
    ttclid?: string;
    msclkid?: string;
    referrer_url?: string;
    referrer_domain?: string;
    landing_page?: string;
    attribution_source?: string;
    attribution_medium?: string;
    session_id?: string;
    first_touch_at?: string;
  };
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload: CreateOrderRequest = await req.json();
    console.log('[checkout-create-order] Starting order creation for tenant:', payload.tenant_id);

    // Validate required fields
    if (!payload.tenant_id || !payload.customer?.email || !payload.items?.length) {
      throw new Error('Missing required fields: tenant_id, customer.email, items');
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Normalize email
    const normalizedEmail = normalizeEmail(payload.customer.email);
    console.log('[checkout-create-order] Normalized email:', normalizedEmail);

    // 1. Generate order number
    const { data: orderNumberData, error: orderNumberError } = await supabase
      .rpc('generate_order_number', { p_tenant_id: payload.tenant_id });

    if (orderNumberError) {
      console.error('[checkout-create-order] Error generating order number:', orderNumberError);
      throw new Error(`Erro ao gerar número do pedido: ${orderNumberError.message}`);
    }

    const orderNumber = orderNumberData || `PED-${Date.now()}`;
    console.log('[checkout-create-order] Order number:', orderNumber);

    // 2. Upsert customer
    let customerId: string | null = null;

    // Check if customer exists
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', payload.tenant_id)
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log('[checkout-create-order] Updating existing customer:', customerId);
      
      await supabase
        .from('customers')
        .update({
          full_name: payload.customer.name,
          phone: payload.customer.phone,
          cpf: payload.customer.cpf,
          updated_at: new Date().toISOString(),
        })
        .eq('id', customerId);
    } else {
      console.log('[checkout-create-order] Creating new customer');
      
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          tenant_id: payload.tenant_id,
          email: normalizedEmail,
          full_name: payload.customer.name,
          phone: payload.customer.phone,
          cpf: payload.customer.cpf,
          status: 'active',
        })
        .select('id')
        .single();

      if (!customerError && newCustomer) {
        customerId = newCustomer.id;
        console.log('[checkout-create-order] New customer created:', customerId);
      } else {
        console.warn('[checkout-create-order] Could not create customer:', customerError);
      }
    }

    // 3. Create order
    console.log('[checkout-create-order] Creating order');
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        tenant_id: payload.tenant_id,
        order_number: orderNumber,
        customer_id: customerId,
        customer_name: payload.customer.name,
        customer_email: normalizedEmail,
        customer_phone: payload.customer.phone,
        status: 'pending',
        payment_status: 'pending',
        payment_method: payload.payment_method,
        subtotal: payload.subtotal,
        shipping_total: payload.shipping_total,
        discount_total: payload.discount_total || 0,
        total: payload.total,
        shipping_street: payload.shipping.street,
        shipping_number: payload.shipping.number,
        shipping_complement: payload.shipping.complement || null,
        shipping_neighborhood: payload.shipping.neighborhood,
        shipping_city: payload.shipping.city,
        shipping_state: payload.shipping.state,
        shipping_postal_code: payload.shipping.postal_code,
        shipping_carrier: payload.shipping.carrier || null,
        // Shipping service details (from Frenet or other provider)
        shipping_service_code: payload.shipping.service_code || null,
        shipping_service_name: payload.shipping.service_name || null,
        shipping_estimated_days: payload.shipping.estimated_days || null,
        // Discount fields
        discount_code: payload.discount?.discount_code || null,
        discount_name: payload.discount?.discount_name || null,
        discount_type: payload.discount?.discount_type || null,
        free_shipping: payload.discount?.free_shipping || false,
      })
      .select('id')
      .single();

    if (orderError) {
      console.error('[checkout-create-order] Error creating order:', orderError);
      throw new Error(`Erro ao criar pedido: ${orderError.message}`);
    }

    const orderId = order.id;
    console.log('[checkout-create-order] Order created:', orderId);

    // 4. Create order items
    console.log('[checkout-create-order] Creating order items');
    const orderItems = payload.items.map(item => ({
      order_id: orderId,
      product_id: item.product_id,
      product_name: item.product_name,
      sku: item.sku,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.unit_price * item.quantity,
      product_image_url: item.image_url || null,
    }));

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(orderItems);

    if (itemsError) {
      console.error('[checkout-create-order] Error creating order items:', itemsError);
    }

    // 5. Create discount redemption if discount was applied
    if (payload.discount?.discount_id) {
      console.log('[checkout-create-order] Creating discount redemption');
      const { error: redemptionError } = await supabase
        .from('discount_redemptions')
        .insert({
          tenant_id: payload.tenant_id,
          discount_id: payload.discount.discount_id,
          order_id: orderId,
          customer_email: normalizedEmail,
          amount: payload.discount.discount_amount,
          status: 'applied',
        });

      if (redemptionError) {
        console.error('[checkout-create-order] Error creating redemption:', redemptionError);
        // Non-blocking - order was created
      } else {
        console.log('[checkout-create-order] Discount redemption created');
      }
    }

    // 6. Save attribution data if provided
    if (payload.attribution) {
      console.log('[checkout-create-order] Saving attribution data');
      const { error: attrError } = await supabase
        .from('order_attribution')
        .insert({
          tenant_id: payload.tenant_id,
          order_id: orderId,
          ...payload.attribution,
        });

      if (attrError) {
        console.error('[checkout-create-order] Error saving attribution:', attrError);
        // Non-blocking
      } else {
        console.log('[checkout-create-order] Attribution saved:', payload.attribution.attribution_source);
      }
    }

      success: true,
      order_id: orderId,
      order_number: orderNumber,
      customer_id: customerId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[checkout-create-order] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Unknown error',
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
