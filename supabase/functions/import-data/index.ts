import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ImportRequest {
  tenantId: string;
  platform: string;
  module: 'products' | 'categories' | 'customers' | 'orders';
  data: any[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { tenantId, platform, module, data } = await req.json() as ImportRequest;

    console.log(`Starting import: ${module} from ${platform} for tenant ${tenantId}`);
    console.log(`Processing ${data.length} items`);

    const results = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [] as any[],
    };

    for (const item of data) {
      try {
        switch (module) {
          case 'products':
            await importProduct(supabase, tenantId, item, results);
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
      } catch (error: any) {
        results.failed++;
        results.errors.push({
          item: item.name || item.email || item.order_number || 'unknown',
          error: error?.message || String(error),
        });
      }
    }

    console.log(`Import completed: ${results.imported} imported, ${results.skipped} skipped, ${results.failed} failed`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Import error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function importProduct(supabase: any, tenantId: string, product: any, results: any) {
  // Check for duplicate by slug
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', product.slug)
    .maybeSingle();

  if (existing) {
    // Update existing product
    const { error } = await supabase
      .from('products')
      .update({
        name: product.name,
        description: product.description,
        short_description: product.short_description,
        price: product.price,
        compare_at_price: product.compare_at_price,
        cost_price: product.cost_price,
        sku: product.sku,
        barcode: product.barcode,
        weight: product.weight,
        width: product.width,
        height: product.height,
        depth: product.depth,
        stock_quantity: product.stock_quantity,
        is_featured: product.is_featured,
        status: product.status,
        seo_title: product.seo_title,
        seo_description: product.seo_description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw error;
    results.imported++;
  } else {
    // Insert new product
    const { data: newProduct, error } = await supabase
      .from('products')
      .insert({
        tenant_id: tenantId,
        name: product.name,
        slug: product.slug,
        description: product.description,
        short_description: product.short_description,
        price: product.price,
        compare_at_price: product.compare_at_price,
        cost_price: product.cost_price,
        sku: product.sku,
        barcode: product.barcode,
        weight: product.weight,
        width: product.width,
        height: product.height,
        depth: product.depth,
        stock_quantity: product.stock_quantity,
        is_featured: product.is_featured,
        status: product.status,
        seo_title: product.seo_title,
        seo_description: product.seo_description,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Import images if available
    if (product.images?.length > 0) {
      const imageInserts = product.images.map((img: any, index: number) => ({
        product_id: newProduct.id,
        url: img.url,
        alt: img.alt,
        is_primary: img.is_primary || index === 0,
        position: img.position || index,
      }));

      await supabase.from('product_images').insert(imageInserts);
    }

    // Import variants if available
    if (product.variants?.length > 0) {
      const variantInserts = product.variants.map((v: any) => ({
        product_id: newProduct.id,
        name: v.name,
        sku: v.sku,
        price: v.price,
        compare_at_price: v.compare_at_price,
        stock_quantity: v.stock_quantity,
        options: v.options,
      }));

      await supabase.from('product_variants').insert(variantInserts);
    }

    results.imported++;
  }
}

async function importCategory(supabase: any, tenantId: string, category: any, results: any) {
  // Check for duplicate by slug
  const { data: existing } = await supabase
    .from('categories')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', category.slug)
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
        is_active: category.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw error;
    results.imported++;
  } else {
    // Resolve parent_id from parent_slug if provided
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
        slug: category.slug,
        description: category.description,
        image_url: category.image_url,
        banner_desktop_url: category.banner_desktop_url,
        banner_mobile_url: category.banner_mobile_url,
        parent_id: parentId,
        seo_title: category.seo_title,
        seo_description: category.seo_description,
        sort_order: category.sort_order,
        is_active: category.is_active,
      });

    if (error) throw error;
    results.imported++;
  }
}

async function importCustomer(supabase: any, tenantId: string, customer: any, results: any) {
  // Check for duplicate by email
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', customer.email.toLowerCase())
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('customers')
      .update({
        full_name: customer.full_name,
        phone: customer.phone,
        cpf: customer.cpf,
        birth_date: customer.birth_date,
        gender: customer.gender,
        accepts_marketing: customer.accepts_marketing,
        status: customer.status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw error;
    results.imported++;
  } else {
    const { data: newCustomer, error } = await supabase
      .from('customers')
      .insert({
        tenant_id: tenantId,
        email: customer.email.toLowerCase(),
        full_name: customer.full_name,
        phone: customer.phone,
        cpf: customer.cpf,
        birth_date: customer.birth_date,
        gender: customer.gender,
        accepts_marketing: customer.accepts_marketing,
        status: customer.status,
      })
      .select('id')
      .single();

    if (error) throw error;

    // Import addresses if available
    if (customer.addresses?.length > 0) {
      const addressInserts = customer.addresses.map((addr: any) => ({
        customer_id: newCustomer.id,
        label: addr.label,
        recipient_name: addr.recipient_name,
        street: addr.street,
        number: addr.number,
        complement: addr.complement,
        neighborhood: addr.neighborhood,
        city: addr.city,
        state: addr.state,
        postal_code: addr.postal_code,
        country: addr.country,
        is_default: addr.is_default,
      }));

      await supabase.from('customer_addresses').insert(addressInserts);
    }

    results.imported++;
  }
}

async function importOrder(supabase: any, tenantId: string, order: any, results: any) {
  // Check for duplicate by order_number
  const { data: existing } = await supabase
    .from('orders')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('order_number', order.order_number)
    .maybeSingle();

  if (existing) {
    results.skipped++;
    return;
  }

  // Find or create customer
  let customerId = null;
  if (order.customer_email) {
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('email', order.customer_email.toLowerCase())
      .maybeSingle();

    if (customer) {
      customerId = customer.id;
    } else {
      // Create minimal customer record
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          email: order.customer_email.toLowerCase(),
          full_name: order.customer_name,
          phone: order.customer_phone,
        })
        .select('id')
        .single();

      customerId = newCustomer?.id;
    }
  }

  const { data: newOrder, error } = await supabase
    .from('orders')
    .insert({
      tenant_id: tenantId,
      customer_id: customerId,
      order_number: order.order_number,
      status: order.status,
      payment_status: order.payment_status,
      payment_method: order.payment_method,
      shipping_status: order.shipping_status,
      subtotal: order.subtotal,
      discount_total: order.discount_total,
      shipping_total: order.shipping_total,
      total: order.total,
      currency: order.currency,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      shipping_street: order.shipping_address?.street,
      shipping_number: order.shipping_address?.number,
      shipping_complement: order.shipping_address?.complement,
      shipping_neighborhood: order.shipping_address?.neighborhood,
      shipping_city: order.shipping_address?.city,
      shipping_state: order.shipping_address?.state,
      shipping_postal_code: order.shipping_address?.postal_code,
      shipping_country: order.shipping_address?.country,
      notes: order.notes,
      paid_at: order.paid_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      created_at: order.created_at,
    })
    .select('id')
    .single();

  if (error) throw error;

  // Import order items
  if (order.items?.length > 0) {
    const itemInserts = order.items.map((item: any) => ({
      order_id: newOrder.id,
      product_name: item.product_name,
      product_sku: item.product_sku,
      variant_name: item.variant_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      total_price: item.total_price,
    }));

    await supabase.from('order_items').insert(itemInserts);
  }

  results.imported++;
}
