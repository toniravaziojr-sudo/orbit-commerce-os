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
  categoryMap?: Record<string, string>; // slug -> id mapping for linking products to categories
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

    const body = await req.json() as ImportRequest;
    const { tenantId, platform, module, data, categoryMap } = body;

    // Validate required fields
    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Nenhum dado para importar' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting import: ${module} from ${platform} for tenant ${tenantId}`);
    console.log(`Processing ${data.length} items`);
    if (categoryMap) {
      console.log(`Category map available with ${Object.keys(categoryMap).length} categories`);
    }

    const results = {
      imported: 0,
      skipped: 0,
      failed: 0,
      errors: [] as any[],
    };

    // Process in batches of 50 to avoid timeouts
    const batchSize = 50;
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      
      for (const item of batch) {
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
        } catch (error: any) {
          results.failed++;
          const itemIdentifier = item.name || item.email || item.order_number || item.slug || 'unknown';
          const errorMessage = error?.message || String(error);
          console.error(`Failed to import ${module} item "${itemIdentifier}":`, errorMessage);
          results.errors.push({
            item: itemIdentifier,
            error: errorMessage,
          });
        }
      }
      
      console.log(`Batch ${Math.floor(i / batchSize) + 1} processed: ${results.imported} imported so far`);
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

async function importProduct(supabase: any, tenantId: string, product: any, results: any, categoryMap?: Record<string, string>) {
  // Check for duplicate by slug
  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', product.slug)
    .maybeSingle();

  let productId: string;

  if (existing) {
    productId = existing.id;
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
    productId = newProduct.id;

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

  // Link product to categories via product_categories
  if (product.categories?.length > 0 && categoryMap) {
    for (const catSlug of product.categories) {
      const categoryId = categoryMap[catSlug];
      if (categoryId) {
        // Check if link already exists
        const { data: existingLink } = await supabase
          .from('product_categories')
          .select('id')
          .eq('product_id', productId)
          .eq('category_id', categoryId)
          .maybeSingle();
        
        if (!existingLink) {
          // Get max position for this category
          const { data: maxPos } = await supabase
            .from('product_categories')
            .select('position')
            .eq('category_id', categoryId)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const nextPosition = (maxPos?.position ?? -1) + 1;
          
          await supabase.from('product_categories').insert({
            product_id: productId,
            category_id: categoryId,
            position: nextPosition,
          });
          
          console.log(`Linked product ${product.slug} to category ${catSlug}`);
        }
      }
    }
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
  // Validate email
  const email = (customer.email || '').toString().trim().toLowerCase();
  if (!email || !email.includes('@')) {
    results.skipped++;
    console.log(`Skipping customer without valid email: ${JSON.stringify(customer).slice(0, 100)}`);
    return;
  }

  // Check for duplicate by email
  const { data: existing } = await supabase
    .from('customers')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from('customers')
      .update({
        full_name: customer.full_name || 'Cliente',
        phone: customer.phone,
        cpf: customer.cpf,
        birth_date: customer.birth_date,
        gender: customer.gender,
        accepts_marketing: customer.accepts_marketing ?? false,
        status: customer.status || 'active',
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
        email: email,
        full_name: customer.full_name || 'Cliente',
        phone: customer.phone,
        cpf: customer.cpf,
        birth_date: customer.birth_date,
        gender: customer.gender,
        accepts_marketing: customer.accepts_marketing ?? false,
        status: customer.status || 'active',
      })
      .select('id')
      .single();

    if (error) throw error;

    // Import addresses if available
    if (customer.addresses?.length > 0) {
      const validAddresses = customer.addresses.filter((addr: any) => 
        addr.street && addr.city
      );
      
      if (validAddresses.length > 0) {
        const addressInserts = validAddresses.map((addr: any) => ({
          customer_id: newCustomer.id,
          label: addr.label || 'Endereço',
          recipient_name: addr.recipient_name || customer.full_name || 'Destinatário',
          street: addr.street || '',
          number: addr.number || '',
          complement: addr.complement,
          neighborhood: addr.neighborhood || '',
          city: addr.city || '',
          state: addr.state || '',
          postal_code: addr.postal_code || '',
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
  // Validate order_number
  const orderNumber = (order.order_number || '').toString().trim();
  if (!orderNumber) {
    results.skipped++;
    console.log(`Skipping order without order number: ${JSON.stringify(order).slice(0, 100)}`);
    return;
  }

  // Check for duplicate by order_number
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

  // Find or create customer
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
      // Create minimal customer record
      const { data: newCustomer } = await supabase
        .from('customers')
        .insert({
          tenant_id: tenantId,
          email: customerEmail,
          full_name: order.customer_name || 'Cliente',
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
      order_number: orderNumber,
      status: order.status || 'pending',
      payment_status: order.payment_status || 'pending',
      payment_method: order.payment_method,
      shipping_status: order.shipping_status,
      subtotal: order.subtotal || 0,
      discount_total: order.discount_total || 0,
      shipping_total: order.shipping_total || 0,
      total: order.total || 0,
      currency: order.currency || 'BRL',
      customer_email: customerEmail || null,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      shipping_street: order.shipping_address?.street,
      shipping_number: order.shipping_address?.number,
      shipping_complement: order.shipping_address?.complement,
      shipping_neighborhood: order.shipping_address?.neighborhood,
      shipping_city: order.shipping_address?.city,
      shipping_state: order.shipping_address?.state,
      shipping_postal_code: order.shipping_address?.postal_code,
      shipping_country: order.shipping_address?.country || 'BR',
      notes: order.notes,
      paid_at: order.paid_at,
      shipped_at: order.shipped_at,
      delivered_at: order.delivered_at,
      created_at: order.created_at || new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;

  // Import order items
  if (order.items?.length > 0) {
    const validItems = order.items.filter((item: any) => item.product_name);
    
    if (validItems.length > 0) {
      const itemInserts = validItems.map((item: any) => ({
        order_id: newOrder.id,
        product_name: item.product_name || 'Produto',
        product_sku: item.product_sku,
        variant_name: item.variant_name,
        quantity: item.quantity || 1,
        unit_price: item.unit_price || 0,
        total_price: item.total_price || (item.unit_price || 0) * (item.quantity || 1),
      }));

      await supabase.from('order_items').insert(itemInserts);
    }
  }

  results.imported++;
}
