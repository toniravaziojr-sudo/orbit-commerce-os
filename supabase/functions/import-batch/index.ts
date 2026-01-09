/**
 * Import Batch - Processa um batch de itens para importação
 * Retorna resultado por item sem abortar o batch inteiro
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEPLOY_VERSION = '2026-01-08.2115';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface BatchRequest {
  jobId: string;
  tenantId: string;
  platform: string;
  module: 'products' | 'categories' | 'customers' | 'orders';
  items: any[];
  batchIndex: number;
  categoryMap?: Record<string, string>;
}

interface ItemError {
  index: number;
  identifier: string;
  error: string;
}

Deno.serve(async (req) => {
  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json() as BatchRequest;
    const { jobId, tenantId, platform, module, items, batchIndex, categoryMap } = body;

    // Validate required fields
    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!jobId) {
      return new Response(
        JSON.stringify({ success: false, error: 'jobId é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum item no batch' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[import-batch] Starting batch ${batchIndex} for job ${jobId}: ${module} (${items.length} items)`);

    const results = {
      batchIndex,
      processed: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      itemErrors: [] as ItemError[],
    };

    // Process each item individually (don't abort on single item failure)
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      try {
        switch (module) {
          case 'products':
            await importProduct(supabase, tenantId, item, results, categoryMap);
            break;
          case 'categories':
            await importCategory(supabase, tenantId, item, results);
            break;
          case 'customers':
            await importCustomer(supabase, tenantId, item, results);
            break;
          case 'orders':
            await importOrder(supabase, tenantId, item, results);
            break;
        }
        results.processed++;
      } catch (error: any) {
        results.failed++;
        results.processed++;
        const identifier = item.name || item.email || item.order_number || item.slug || item.sku || `item-${i}`;
        const errorMessage = error?.message || String(error);
        console.error(`[import-batch] Item ${i} failed:`, identifier, errorMessage);
        results.itemErrors.push({
          index: i,
          identifier,
          error: errorMessage,
        });
      }
    }

    // Update job progress
    try {
      await supabase.rpc('update_import_job_batch', {
        p_job_id: jobId,
        p_batch_processed: results.processed,
        p_batch_imported: results.imported + results.updated,
        p_batch_failed: results.failed,
        p_batch_skipped: results.skipped,
        p_errors: results.itemErrors.slice(0, 10), // Keep only first 10 errors
      });
    } catch (updateError) {
      console.warn('[import-batch] Could not update job progress:', updateError);
    }

    const duration = Date.now() - startTime;
    console.log(`[import-batch] Batch ${batchIndex} completed in ${duration}ms:`, {
      processed: results.processed,
      imported: results.imported,
      updated: results.updated,
      skipped: results.skipped,
      failed: results.failed,
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        version: DEPLOY_VERSION,
        results,
        duration_ms: duration,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[import-batch] Fatal error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error?.message || String(error),
        debugId: `batch-${Date.now()}`,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

// ========== Import Functions ==========

async function importProduct(supabase: any, tenantId: string, product: any, results: any, categoryMap?: Record<string, string>) {
  // CRITICAL: Validate product name - NEVER create "Produto sem nome"
  const productName = (product.name || product.title || '').toString().trim();
  if (!productName || productName === 'Produto sem nome' || productName === 'Produto importado') {
    throw new Error('Produto sem nome válido - importação rejeitada');
  }

  // Generate slug if missing
  const effectiveSlug = product.slug || slugify(productName);
  
  // Check for duplicate by slug
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', effectiveSlug)
    .maybeSingle();

  let productId: string;

  // Generate SKU if not provided - deterministic based on slug
  const effectiveSku = product.sku || `IMP-${effectiveSlug.substring(0, 20)}-${hashCode(effectiveSlug + tenantId).toString(36).toUpperCase()}`;

  // Validate and parse price (handle Brazilian format R$ 49,90)
  let effectivePrice = 0;
  if (product.price !== undefined && product.price !== null) {
    if (typeof product.price === 'string') {
      // Remove currency symbols and normalize
      const cleaned = product.price.replace(/[R$\s]/g, '').replace(/\./g, '').replace(',', '.');
      effectivePrice = parseFloat(cleaned) || 0;
    } else {
      effectivePrice = Number(product.price) || 0;
    }
  }

  if (existing) {
    productId = existing.id;
    // Update existing product
    const { error } = await supabase
      .from('products')
      .update({
        name: productName,
        description: product.description,
        short_description: product.short_description,
        price: effectivePrice,
        compare_at_price: product.compare_at_price,
        cost_price: product.cost_price,
        sku: effectiveSku,
        barcode: product.barcode,
        weight: product.weight,
        width: product.width,
        height: product.height,
        depth: product.depth,
        stock_quantity: product.stock_quantity,
        is_featured: product.is_featured,
        status: product.status || 'active',
        seo_title: product.seo_title,
        seo_description: product.seo_description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw error;
    results.updated++;
  } else {
    // Insert new product
    const { data: newProduct, error } = await supabase
      .from('products')
      .insert({
        tenant_id: tenantId,
        name: productName,
        slug: effectiveSlug,
        description: product.description,
        short_description: product.short_description,
        price: effectivePrice,
        compare_at_price: product.compare_at_price,
        cost_price: product.cost_price,
        sku: effectiveSku,
        barcode: product.barcode,
        weight: product.weight,
        width: product.width,
        height: product.height,
        depth: product.depth,
        stock_quantity: product.stock_quantity,
        is_featured: product.is_featured,
        status: product.status || 'active',
        seo_title: product.seo_title,
        seo_description: product.seo_description,
      })
      .select('id')
      .single();

    if (error) throw error;
    productId = newProduct.id;

    // Import images if available
    if (product.images?.length > 0) {
      const imageInserts = product.images
        .filter((img: any) => img.url && img.url.trim())
        .map((img: any, index: number) => ({
          product_id: newProduct.id,
          url: img.url,
          alt_text: img.alt || null,
          is_primary: img.is_primary || index === 0,
          sort_order: img.position || index,
        }));

      if (imageInserts.length > 0) {
        await supabase.from('product_images').insert(imageInserts);
      }
    }

    // Import variants if available
    if (product.variants?.length > 0) {
      const variantInserts = product.variants.map((v: any) => ({
        product_id: newProduct.id,
        name: v.name,
        sku: v.sku || `${effectiveSku}-V${Math.random().toString(36).substr(2, 3).toUpperCase()}`,
        price: v.price,
        compare_at_price: v.compare_at_price,
        stock_quantity: v.stock_quantity,
        options: v.options,
      }));

      await supabase.from('product_variants').insert(variantInserts);
    }

    results.imported++;
  }

  // Link product to categories
  if (product.categories?.length > 0 && categoryMap) {
    for (const catSlug of product.categories) {
      const categoryId = categoryMap[catSlug];
      if (categoryId) {
        const { data: existingLink } = await supabase
          .from('product_categories')
          .select('id')
          .eq('product_id', productId)
          .eq('category_id', categoryId)
          .maybeSingle();
        
        if (!existingLink) {
          await supabase.from('product_categories').insert({
            product_id: productId,
            category_id: categoryId,
            position: 0,
          });
        }
      }
    }
  }
}

// Simple hash function for deterministic SKU generation
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash);
}

async function importCategory(supabase: any, tenantId: string, category: any, results: any) {
  const effectiveSlug = category.slug || slugify(category.name || `categoria-${Date.now()}`);
  
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', effectiveSlug)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('categories')
      .update({
        name: category.name,
        description: category.description,
        image_url: category.image_url,
        banner_desktop_url: category.banner_desktop_url,
        banner_mobile_url: category.banner_mobile_url,
        seo_title: category.seo_title,
        seo_description: category.seo_description,
        sort_order: category.sort_order,
        is_active: category.is_active ?? true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw error;
    results.updated++;
  } else {
    let parentId = null;
    if (category.parent_slug) {
      const { data: parent } = await supabase
        .from('categories')
        .select('id')
        .eq('tenant_id', tenantId)
        .eq('slug', category.parent_slug)
        .maybeSingle();
      parentId = parent?.id || null;
    }

    const { error } = await supabase
      .from('categories')
      .insert({
        tenant_id: tenantId,
        name: category.name,
        slug: effectiveSlug,
        description: category.description,
        image_url: category.image_url,
        banner_desktop_url: category.banner_desktop_url,
        banner_mobile_url: category.banner_mobile_url,
        parent_id: parentId,
        seo_title: category.seo_title,
        seo_description: category.seo_description,
        sort_order: category.sort_order,
        is_active: category.is_active ?? true,
      });

    if (error) throw error;
    results.imported++;
  }
}

async function importCustomer(supabase: any, tenantId: string, customer: any, results: any) {
  const email = (customer.email || '').toString().trim().toLowerCase();
  if (!email || !email.includes('@')) {
    results.skipped++;
    return;
  }

  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .maybeSingle();

  const customerData = {
    full_name: customer.full_name || 'Cliente',
    phone: customer.phone || null,
    cpf: customer.cpf || null,
    birth_date: customer.birth_date || null,
    gender: customer.gender || null,
    accepts_marketing: customer.accepts_marketing ?? false,
    status: customer.status || 'active',
    total_orders: customer.total_orders || null,
    total_spent: customer.total_spent || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from('customers')
      .update(customerData)
      .eq('id', existing.id);

    if (error) throw error;
    results.updated++;
  } else {
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenantId,
        email: email,
        ...customerData,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Import addresses
    if (customer.addresses?.length > 0) {
      const validAddresses = customer.addresses.filter((addr: any) => addr.street || addr.city);
      if (validAddresses.length > 0) {
        const addressInserts = validAddresses.map((addr: any) => ({
          customer_id: newCustomer.id,
          label: addr.label || 'Endereço',
          recipient_name: addr.recipient_name || customer.full_name || 'Destinatário',
          street: addr.street || 'Não informado',
          number: addr.number || 'S/N',
          complement: addr.complement || null,
          neighborhood: addr.neighborhood || 'Não informado',
          city: addr.city || 'Não informado',
          state: addr.state || 'XX',
          postal_code: addr.postal_code || '00000000',
          country: addr.country || 'BR',
          is_default: addr.is_default ?? false,
        }));
        await supabase.from('customer_addresses').insert(addressInserts);
      }
    }

    results.imported++;
  }
}

async function importOrder(supabase: any, tenantId: string, order: any, results: any) {
  const orderNumber = (order.order_number || '').toString().trim();
  if (!orderNumber) {
    results.skipped++;
    return;
  }

  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (existing) {
    results.skipped++;
    return;
  }

  let customerId = null;
  const customerEmail = (order.customer_email || '').toString().trim().toLowerCase();
  
  if (customerEmail && customerEmail.includes('@')) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', customerEmail)
      .maybeSingle();

    if (customer) {
      customerId = customer.id;
    } else {
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          email: customerEmail,
          full_name: order.customer_name || 'Cliente',
          phone: order.customer_phone || null,
        })
        .select('id')
        .single();
      customerId = newCustomer?.id;
    }
  }

  // Build order data with all supported fields
  const orderData = {
    tenant_id: tenantId,
    customer_id: customerId,
    order_number: orderNumber,
    status: order.status || 'pending',
    payment_status: order.payment_status || 'pending',
    payment_method: order.payment_method || null,
    payment_gateway: order.payment_gateway || null,
    payment_gateway_id: order.payment_gateway_id || null,
    shipping_status: order.shipping_status || 'pending',
    subtotal: order.subtotal || 0,
    discount_total: order.discount_total || 0,
    shipping_total: order.shipping_total || 0,
    tax_total: order.tax_total || 0,
    total: order.total || 0,
    customer_email: customerEmail || null,
    customer_name: order.customer_name || null,
    customer_phone: order.customer_phone || null,
    // Shipping address
    shipping_street: order.shipping_address?.street || null,
    shipping_number: order.shipping_address?.number || null,
    shipping_complement: order.shipping_address?.complement || null,
    shipping_neighborhood: order.shipping_address?.neighborhood || null,
    shipping_city: order.shipping_address?.city || null,
    shipping_state: order.shipping_address?.state || null,
    shipping_postal_code: order.shipping_address?.postal_code || null,
    shipping_country: order.shipping_address?.country || 'BR',
    // Billing address
    billing_street: order.billing_address?.street || null,
    billing_number: order.billing_address?.number || null,
    billing_complement: order.billing_address?.complement || null,
    billing_neighborhood: order.billing_address?.neighborhood || null,
    billing_city: order.billing_address?.city || null,
    billing_state: order.billing_address?.state || null,
    billing_postal_code: order.billing_address?.postal_code || null,
    billing_country: order.billing_address?.country || null,
    // Discount info
    discount_code: order.discount_code || null,
    discount_name: order.discount_code || null,
    discount_type: order.discount_type || null,
    // Shipping service
    shipping_service_code: order.shipping_service_code || null,
    shipping_service_name: order.shipping_service_name || null,
    // Notes
    customer_notes: order.notes || null,
    // Tracking
    tracking_code: order.tracking_code || null,
    shipping_carrier: order.tracking_carrier || null,
    // Timestamps
    paid_at: order.paid_at || null,
    shipped_at: order.shipped_at || null,
    delivered_at: order.delivered_at || null,
    cancelled_at: order.cancelled_at || null,
    cancellation_reason: order.cancellation_reason || null,
    created_at: order.created_at || new Date().toISOString(),
  };

  const { data: newOrder, error } = await supabase
    .from('orders')
    .insert(orderData)
    .select('id')
    .single();

  if (error) throw error;

  // Import order items
  if (order.items?.length > 0) {
    const validItems = order.items.filter((item: any) => item.product_name);
    if (validItems.length > 0) {
      const itemInserts = validItems.map((item: any) => ({
        order_id: newOrder.id,
        sku: item.product_sku || `SKU-${Date.now()}`,
        product_name: item.product_name || 'Produto',
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        discount_amount: 0,
        total_price: (item.quantity || 1) * (item.unit_price || 0),
      }));
      await supabase.from('order_items').insert(itemInserts);
    }
  }

  results.imported++;
}

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 100);
}
