// ============================================
// CHECKOUT CREATE ORDER - Server-side order creation v3.0
// Handles customer upsert, order creation, order items
// Uses service role to bypass RLS
// v2.0 — Shipping quote validation (Security Plan v3.1 Phase 2A)
// v3.0 — Canonical price recalculation (Security Plan v3.1 Phase 2B)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateCartFingerprint } from "../_shared/cart-fingerprint.ts";
// Meta CAPI is now handled client-side via marketing-capi-track edge function

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface OrderItem {
  product_id: string;
  variant_id?: string;
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
  payment_method_discount?: number;
  installments?: number;
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
  affiliate?: {
    affiliate_code: string;
    captured_at: string;
  };
  // Meta CAPI data from client (for server-side deduplication)
  meta_capi?: {
    fbp?: string;
    fbc?: string;
    event_source_url?: string;
    purchase_event_id?: string;
  };
  // Shipping quote ID for server-side validation (Security Plan v3.1)
  shipping_quote_id?: string;
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
      return new Response(JSON.stringify({
        success: false,
        error: 'Dados obrigatórios ausentes: tenant_id, email ou itens',
        code: 'MISSING_REQUIRED_FIELDS',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create Supabase client with service role (bypasses RLS)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Normalize email
    const normalizedEmail = normalizeEmail(payload.customer.email);
    console.log('[checkout-create-order] Normalized email:', normalizedEmail);

    // === VALIDATE PRODUCT IDs BEFORE PROCEEDING ===
    const productIds = payload.items.map(item => item.product_id);
    console.log('[checkout-create-order] Validating products:', productIds);

    const { data: existingProducts, error: productsError } = await supabase
      .from('products')
      .select('id, name')
      .eq('tenant_id', payload.tenant_id)
      .in('id', productIds);

    if (productsError) {
      console.error('[checkout-create-order] Error validating products:', productsError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao validar produtos do carrinho',
        code: 'PRODUCT_VALIDATION_ERROR',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const existingProductIds = new Set(existingProducts?.map(p => p.id) || []);
    const invalidProducts = payload.items.filter(item => !existingProductIds.has(item.product_id));

    if (invalidProducts.length > 0) {
      console.error('[checkout-create-order] Invalid products found:', invalidProducts.map(p => ({ id: p.product_id, name: p.product_name })));
      return new Response(JSON.stringify({
        success: false,
        error: `Alguns produtos no carrinho não estão mais disponíveis: ${invalidProducts.map(p => p.product_name).join(', ')}. Por favor, limpe o carrinho e adicione os produtos novamente.`,
        code: 'INVALID_PRODUCTS',
        invalid_product_ids: invalidProducts.map(p => p.product_id),
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[checkout-create-order] All products validated successfully');

    // === CANONICAL PRICE RECALCULATION (Security Plan v3.1 Phase 2B) ===
    // Fetch real prices from database — NEVER trust frontend-submitted prices
    // Supports both simple products (products.price) and variant products (product_variants.price)
    const { data: dbProducts, error: priceError } = await supabase
      .from('products')
      .select('id, price, compare_at_price')
      .eq('tenant_id', payload.tenant_id)
      .in('id', productIds);

    // Also fetch variant prices if any items have variant_id
    const variantIds = payload.items
      .filter(item => item.variant_id)
      .map(item => item.variant_id!);
    
    let variantPriceMap = new Map<string, number>();
    if (variantIds.length > 0) {
      const { data: dbVariants, error: variantError } = await supabase
        .from('product_variants')
        .select('id, price')
        .in('id', variantIds);
      
      if (!variantError && dbVariants) {
        for (const v of dbVariants) {
          variantPriceMap.set(v.id, Number(v.price) || 0);
        }
      } else {
        console.warn('[checkout-create-order][PRICE_AUDIT] Could not fetch variant prices:', variantError);
      }
    }

    let canonicalSubtotal = 0;
    const productPriceMap = new Map<string, number>();
    if (!priceError && dbProducts) {
      for (const p of dbProducts) {
        productPriceMap.set(p.id, Number(p.price) || 0);
      }
      for (const item of payload.items) {
        // Use variant price if variant_id exists, otherwise product price
        let dbPrice: number;
        if (item.variant_id && variantPriceMap.has(item.variant_id)) {
          dbPrice = variantPriceMap.get(item.variant_id)!;
        } else {
          dbPrice = productPriceMap.get(item.product_id) || 0;
        }
        canonicalSubtotal += dbPrice * item.quantity;
      }
      // Round to 2 decimal places
      canonicalSubtotal = Math.round(canonicalSubtotal * 100) / 100;
    } else {
      console.warn('[checkout-create-order][PRICE_AUDIT] Could not fetch DB prices, using submitted subtotal');
      canonicalSubtotal = payload.subtotal;
    }

    // === SHIPPING QUOTE VALIDATION (Security Plan v3.1 - SIMULATION MODE) ===
    let validatedQuoteId: string | null = null;
    let canonicalShipping = payload.shipping_total; // fallback to submitted
    if (payload.shipping_quote_id) {
      try {
        const cartFingerprint = await generateCartFingerprint(
          payload.items.map(item => ({
            product_id: item.product_id,
            variant_id: '',
            quantity: item.quantity,
          }))
        );

        const { data: quote, error: quoteError } = await supabase
          .from('shipping_quotes')
          .select('*')
          .eq('id', payload.shipping_quote_id)
          .eq('tenant_id', payload.tenant_id)
          .single();

        if (quoteError || !quote) {
          console.warn('[checkout-create-order][QUOTE_AUDIT] Quote not found:', payload.shipping_quote_id);
        } else {
          const issues: string[] = [];

          // Check expiry (2h TTL)
          if (new Date(quote.expires_at) < new Date()) {
            issues.push('EXPIRED');
          }
          // Check single-use
          if (quote.used_at) {
            issues.push('ALREADY_USED');
          }
          // Check CEP match
          const payloadCep = (payload.shipping.postal_code || '').replace(/\D/g, '');
          if (quote.cep !== payloadCep) {
            issues.push(`CEP_MISMATCH:${quote.cep}!=${payloadCep}`);
          }
          // Check cart fingerprint
          if (quote.cart_fingerprint !== cartFingerprint) {
            issues.push('CART_CHANGED');
          }

          if (issues.length > 0) {
            console.warn(`[checkout-create-order][QUOTE_AUDIT] SIMULATION - Issues: ${issues.join(', ')} for quote ${quote.id}`);
            // SIMULATION MODE: log only, do NOT reject
          } else {
            console.log('[checkout-create-order][QUOTE_AUDIT] Quote valid:', quote.id);
            validatedQuoteId = quote.id;

            // Use the shipping price from the server-side quote as canonical
            // NOTE: DB column is "all_options", not "options"
            const selectedOption = (quote.all_options as any[])?.find(
              (opt: any) => opt.service_code === payload.shipping.service_code
            );
            if (selectedOption?.price !== undefined) {
              canonicalShipping = Number(selectedOption.price);
              console.log(`[checkout-create-order][QUOTE_AUDIT] Canonical shipping from quote: ${canonicalShipping}`);
            } else {
              console.warn(`[checkout-create-order][QUOTE_AUDIT] Could not find service_code=${payload.shipping.service_code} in quote options, using submitted shipping`);
            }

            // Mark as used (used_by_order_id set after order creation below)
            await supabase
              .from('shipping_quotes')
              .update({ used_at: new Date().toISOString() })
              .eq('id', quote.id);
          }
        }
      } catch (quoteErr) {
        console.warn('[checkout-create-order][QUOTE_AUDIT] Validation error (non-blocking):', quoteErr);
      }
    } else {
      console.log('[checkout-create-order][QUOTE_AUDIT] No quote_id provided - skipping validation');
    }

    // === CANONICAL DISCOUNT VALIDATION ===
    let canonicalDiscount = 0;
    if (payload.discount?.discount_id) {
      const { data: dbDiscount } = await supabase
        .from('discounts')
        .select('discount_type, discount_value, min_order_value, max_discount_value, free_shipping')
        .eq('id', payload.discount.discount_id)
        .eq('tenant_id', payload.tenant_id)
        .eq('is_active', true)
        .single();

      if (dbDiscount) {
        if (dbDiscount.discount_type === 'percentage') {
          canonicalDiscount = Math.round(canonicalSubtotal * (Number(dbDiscount.discount_value) / 100) * 100) / 100;
          if (dbDiscount.max_discount_value && canonicalDiscount > Number(dbDiscount.max_discount_value)) {
            canonicalDiscount = Number(dbDiscount.max_discount_value);
          }
        } else if (dbDiscount.discount_type === 'fixed') {
          canonicalDiscount = Number(dbDiscount.discount_value) || 0;
        }
        // Free shipping overrides shipping cost
        if (dbDiscount.free_shipping) {
          canonicalShipping = 0;
        }
      } else {
        console.warn('[checkout-create-order][PRICE_AUDIT] Discount not found or inactive, using submitted discount');
        canonicalDiscount = payload.discount_total || 0;
      }
    } else {
      canonicalDiscount = payload.discount_total || 0;
    }

    // Calculate canonical total
    const canonicalTotal = Math.round((canonicalSubtotal + canonicalShipping - canonicalDiscount - (payload.payment_method_discount || 0)) * 100) / 100;
    const submittedTotal = payload.total;

    // Log drift detection
    const subtotalDrift = Math.abs(payload.subtotal - canonicalSubtotal);
    const totalDrift = Math.abs(submittedTotal - canonicalTotal);
    if (subtotalDrift > 0.01 || totalDrift > 0.01) {
      console.warn(`[checkout-create-order][PRICE_AUDIT] ⚠️ DRIFT DETECTED — submitted_total=${submittedTotal}, canonical_total=${canonicalTotal}, subtotal_drift=${subtotalDrift.toFixed(2)}, total_drift=${totalDrift.toFixed(2)}`);
    } else {
      console.log(`[checkout-create-order][PRICE_AUDIT] ✅ Prices match — canonical_total=${canonicalTotal}`);
    }

    // 1. Generate order number
    const { data: orderNumberData, error: orderNumberError } = await supabase
      .rpc('generate_order_number', { p_tenant_id: payload.tenant_id });

    if (orderNumberError) {
      console.error('[checkout-create-order] Error generating order number:', orderNumberError);
      return new Response(JSON.stringify({
        success: false,
        error: 'Erro ao gerar número do pedido',
        code: 'ORDER_NUMBER_ERROR',
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
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
    
    // Calculate installment value if applicable
    const installmentsCount = payload.installments || 1;
    const installmentValue = installmentsCount > 1 ? Math.round((canonicalTotal / installmentsCount) * 100) / 100 : null;
    
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
        payment_method_discount: payload.payment_method_discount || 0,
        installments: installmentsCount,
        installment_value: installmentValue,
        total: payload.total,
        canonical_total: canonicalTotal,
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
        // Shipping quote traceability (Security Plan v3.1)
        shipping_quote_id: validatedQuoteId || null,
      })
      .select('id')
      .single();

    if (orderError) {
      console.error('[checkout-create-order] Error creating order:', orderError);
      throw new Error(`Erro ao criar pedido: ${orderError.message}`);
    }

    const orderId = order.id;
    console.log('[checkout-create-order] Order created:', orderId);

    // === LINK SHIPPING QUOTE TO ORDER (Security Plan v3.1) ===
    if (validatedQuoteId) {
      try {
        const { error: linkError } = await supabase
          .from('shipping_quotes')
          .update({ used_by_order_id: orderId })
          .eq('id', validatedQuoteId);
        if (linkError) {
          console.error('[checkout-create-order][QUOTE_AUDIT] Failed to link quote to order:', linkError.message);
        } else {
          console.log(`[checkout-create-order][QUOTE_AUDIT] Quote ${validatedQuoteId} linked to order ${orderId}`);
        }
      } catch (linkErr) {
        console.warn('[checkout-create-order][QUOTE_AUDIT] Non-blocking quote link error:', linkErr);
      }
    }

    // === PRICE AUDIT RECORD (Security Plan v3.1 Phase 2B) ===
    try {
      const hasDrift = subtotalDrift > 0.01 || totalDrift > 0.01;
      const auditPayload = {
        order_id: orderId,
        tenant_id: payload.tenant_id,
        submitted_subtotal: payload.subtotal,
        submitted_shipping: payload.shipping_total,
        submitted_discount: payload.discount_total || 0,
        submitted_payment_discount: payload.payment_method_discount || 0,
        submitted_total: submittedTotal,
        canonical_subtotal: canonicalSubtotal,
        canonical_shipping: canonicalShipping,
        canonical_discount: canonicalDiscount,
        canonical_total: canonicalTotal,
        subtotal_drift: Math.round(subtotalDrift * 100) / 100,
        total_drift: Math.round(totalDrift * 100) / 100,
        has_drift: hasDrift,
        shipping_quote_id: validatedQuoteId || null,
        discount_id: payload.discount?.discount_id || null,
        validation_notes: hasDrift
          ? `Drift detected: submitted=${submittedTotal}, canonical=${canonicalTotal}`
          : 'Prices match',
      };
      console.log('[checkout-create-order][PRICE_AUDIT] Inserting audit record:', JSON.stringify(auditPayload));
      const { error: auditError } = await supabase
        .from('order_price_audit')
        .insert(auditPayload);
      if (auditError) {
        console.error('[checkout-create-order][PRICE_AUDIT] Audit insert FAILED:', auditError.message, auditError.details, auditError.hint, auditError.code);
      } else {
        console.log(`[checkout-create-order][PRICE_AUDIT] Audit recorded — has_drift=${hasDrift}, total_drift=${totalDrift.toFixed(2)}`);
      }
    } catch (auditErr) {
      console.error('[checkout-create-order][PRICE_AUDIT] Non-blocking audit insert error:', auditErr);
    }

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

    // 5. Create initial order_history entry
    console.log('[checkout-create-order] Creating initial order history entry');
    const { error: historyError } = await supabase
      .from('order_history')
      .insert({
        order_id: orderId,
        action: 'created',
        description: 'Pedido criado via checkout',
      });

    if (historyError) {
      console.error('[checkout-create-order] Error creating order history:', historyError);
      // Non-blocking - order was created
    } else {
      console.log('[checkout-create-order] Order history entry created');
    }

    // 6. Create discount redemption if discount was applied
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

    // 7. Save attribution data if provided
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

    // 8. Create affiliate conversion if affiliate data is present
    if (payload.affiliate?.affiliate_code) {
      console.log('[checkout-create-order] Processing affiliate conversion');
      
      // Find affiliate by code (link code or affiliate ID)
      let affiliateId: string | null = null;
      
      // First try to find by link code
      const { data: link } = await supabase
        .from('affiliate_links')
        .select('affiliate_id')
        .eq('tenant_id', payload.tenant_id)
        .eq('code', payload.affiliate.affiliate_code)
        .maybeSingle();
      
      if (link) {
        affiliateId = link.affiliate_id;
      } else {
        // Try to find affiliate directly by ID
        const { data: affiliate } = await supabase
          .from('affiliates')
          .select('id')
          .eq('tenant_id', payload.tenant_id)
          .eq('id', payload.affiliate.affiliate_code)
          .maybeSingle();
        
        if (affiliate) {
          affiliateId = affiliate.id;
        }
      }
      
      if (affiliateId) {
        // Check attribution window
        const capturedAt = new Date(payload.affiliate.captured_at);
        const now = new Date();
        const daysDiff = (now.getTime() - capturedAt.getTime()) / (1000 * 60 * 60 * 24);
        
        // Get tenant's attribution window (default 30 days)
        const { data: program } = await supabase
          .from('affiliate_programs')
          .select('attribution_window_days, commission_type, commission_value_cents, is_enabled')
          .eq('tenant_id', payload.tenant_id)
          .maybeSingle();
        
        const attributionWindow = program?.attribution_window_days || 30;
        
        if (program?.is_enabled && daysDiff <= attributionWindow) {
          // Calculate commission
          let commissionCents = 0;
          const orderTotalCents = Math.round(payload.total * 100);
          
          if (program.commission_type === 'percent') {
            commissionCents = Math.round(orderTotalCents * (program.commission_value_cents / 10000));
          } else {
            commissionCents = program.commission_value_cents;
          }
          
          // Create conversion (idempotent - UNIQUE constraint on tenant_id + order_id)
          const { error: conversionError } = await supabase
            .from('affiliate_conversions')
            .insert({
              tenant_id: payload.tenant_id,
              affiliate_id: affiliateId,
              order_id: orderId,
              order_total_cents: orderTotalCents,
              commission_cents: commissionCents,
              status: 'pending',
            });
          
          if (conversionError) {
            // Check if it's a duplicate (expected if order already has conversion)
            if (conversionError.code === '23505') {
              console.log('[checkout-create-order] Conversion already exists for this order');
            } else {
              console.error('[checkout-create-order] Error creating conversion:', conversionError);
            }
          } else {
            console.log('[checkout-create-order] Affiliate conversion created:', affiliateId, commissionCents);
          }
        } else {
          console.log('[checkout-create-order] Affiliate conversion skipped - outside attribution window or program disabled');
        }
      } else {
        console.warn('[checkout-create-order] Affiliate not found for code:', payload.affiliate.affiliate_code);
      }
    }

    // NOTE: Meta CAPI Purchase is now sent client-side via marketing-capi-track
    // edge function from the Thank You page, using the same event_id for deduplication

    // Generate retry_token for credit card orders (used if payment is declined)
    let retryToken: string | null = null;
    if (payload.payment_method === 'credit_card') {
      try {
        const { data: tokenData } = await supabase.rpc('generate_order_retry_token', { p_order_id: orderId });
        retryToken = tokenData || null;
        console.log('[checkout-create-order] Retry token generated for credit card order');
      } catch (e) {
        console.warn('[checkout-create-order] Failed to generate retry token:', e);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      order_id: orderId,
      order_number: orderNumber,
      customer_id: customerId,
      retry_token: retryToken,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[checkout-create-order] Unexpected error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Erro interno ao processar pedido. Tente novamente.',
      code: 'INTERNAL_ERROR',
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
