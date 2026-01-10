/**
 * Import Batch - Processa um batch de itens para importação
 * Retorna resultado por item sem abortar o batch inteiro
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const DEPLOY_VERSION = '2026-01-09.2300'; // source_order_number + internal sequential numbering

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

    console.log(`[import-batch v${DEPLOY_VERSION}] Starting batch ${batchIndex} for job ${jobId}: ${module} (${items.length} items)`);

    const results = {
      batchIndex,
      processed: 0,
      imported: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      itemErrors: [] as ItemError[],
    };

    // Use batch processing for customers (much faster)
    if (module === 'customers') {
      try {
        await importCustomersBatch(supabase, tenantId, jobId, items, results);
        results.processed = items.length;
      } catch (error: any) {
        console.error('[import-batch] Batch customers error:', error);
        results.failed += items.length;
        results.processed = items.length;
        results.itemErrors.push({
          index: 0,
          identifier: 'batch',
          error: error?.message || String(error),
        });
      }
    } else if (module === 'orders') {
      // Use batch processing for orders (much faster than one-by-one)
      try {
        await importOrdersBatch(supabase, tenantId, jobId, items, results);
        results.processed = items.length;
      } catch (error: any) {
        console.error('[import-batch] Batch orders error:', error);
        results.failed += items.length;
        results.processed = items.length;
        results.itemErrors.push({
          index: 0,
          identifier: 'batch',
          error: error?.message || String(error),
        });
      }
    } else {
      // Process other modules individually (products, categories)
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          switch (module) {
            case 'products':
              await importProduct(supabase, tenantId, jobId, item, results, categoryMap);
              break;
            case 'categories':
              await importCategory(supabase, tenantId, jobId, item, results);
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

// Helper: Track imported item in import_items table
async function trackImportedItem(
  supabase: any, 
  tenantId: string, 
  jobId: string,
  module: string, 
  internalId: string, 
  externalId?: string
) {
  try {
    await supabase.from('import_items').upsert({
      tenant_id: tenantId,
      job_id: jobId,
      module,
      internal_id: internalId,
      external_id: externalId || null,
      status: 'success',
    }, {
      onConflict: 'tenant_id,module,internal_id',
      ignoreDuplicates: false,
    });
  } catch (error) {
    console.warn(`[import-batch] Could not track imported item:`, error);
  }
}

async function importProduct(supabase: any, tenantId: string, jobId: string, product: any, results: any, categoryMap?: Record<string, string>) {
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
    
    // Track the updated product as imported
    await trackImportedItem(supabase, tenantId, jobId, 'products', productId, product.external_id);
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

    // Track the new product as imported
    await trackImportedItem(supabase, tenantId, jobId, 'products', productId, product.external_id);

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

async function importCategory(supabase: any, tenantId: string, jobId: string, category: any, results: any) {
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
    
    // Track the updated category as imported
    await trackImportedItem(supabase, tenantId, jobId, 'categories', existing.id, category.external_id);
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

    const { data: newCategory, error } = await supabase
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
      })
      .select('id')
      .single();

    if (error) throw error;
    
    // Track the new category as imported
    await trackImportedItem(supabase, tenantId, jobId, 'categories', newCategory.id, category.external_id);
    results.imported++;
  }
}

async function importCustomersBatch(supabase: any, tenantId: string, jobId: string, customers: any[], results: any) {
  // Pre-fetch all existing emails in one query for this batch
  const emails = customers
    .map(c => (c.email || '').toString().trim().toLowerCase())
    .filter(e => e && e.includes('@'));
  
  if (emails.length === 0) {
    results.skipped += customers.length;
    return;
  }

  const { data: existingCustomers } = await supabase
    .from('customers')
    .select('id, email')
    .eq('tenant_id', tenantId)
    .in('email', emails);

  const existingMap = new Map((existingCustomers || []).map((c: any) => [c.email, c.id]));

  const toInsert: any[] = [];
  const toUpdate: { id: string; data: any; externalId?: string }[] = [];

  for (const customer of customers) {
    const email = (customer.email || '').toString().trim().toLowerCase();
    if (!email || !email.includes('@')) {
      results.skipped++;
      continue;
    }

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
    };

    const existingId = existingMap.get(email) as string | undefined;
    if (existingId) {
      toUpdate.push({ 
        id: existingId as string, 
        data: { ...customerData, updated_at: new Date().toISOString() },
        externalId: customer.external_id,
      });
    } else {
      toInsert.push({
        tenant_id: tenantId,
        email,
        ...customerData,
        _addresses: customer.addresses || [],
        _externalId: customer.external_id,
      });
    }
  }

  // Batch update existing customers
  for (const upd of toUpdate) {
    await supabase.from('customers').update(upd.data).eq('id', upd.id);
    // Track updated customer
    await trackImportedItem(supabase, tenantId, jobId, 'customers', upd.id, upd.externalId);
    results.updated++;
  }

  // Batch insert new customers
  if (toInsert.length > 0) {
    const insertData = toInsert.map(({ _addresses, _externalId, ...rest }) => rest);
    const { data: inserted, error } = await supabase
      .from('customers')
      .insert(insertData)
      .select('id, email');

    if (error) {
      console.error('[import-batch] Batch insert customers error:', error);
      results.failed += toInsert.length;
    } else if (inserted) {
      results.imported += inserted.length;

      // Map emails to new IDs for address insertion and tracking
      const emailToId = new Map(inserted.map((c: any) => [c.email, c.id]));
      
      // Track all imported customers
      for (const cust of toInsert) {
        const customerId = emailToId.get(cust.email);
        if (customerId) {
          await trackImportedItem(supabase, tenantId, jobId, 'customers', customerId as string, cust._externalId);
        }
      }

      // Collect all addresses to insert
      const allAddresses: any[] = [];
      for (const cust of toInsert) {
        const customerId = emailToId.get(cust.email);
        if (customerId && cust._addresses?.length > 0) {
          const validAddresses = cust._addresses.filter((addr: any) => addr.street || addr.city);
          for (const addr of validAddresses) {
            allAddresses.push({
              customer_id: customerId,
              label: addr.label || 'Endereço',
              recipient_name: addr.recipient_name || cust.full_name || 'Destinatário',
              street: addr.street || 'Não informado',
              number: addr.number || 'S/N',
              complement: addr.complement || null,
              neighborhood: addr.neighborhood || 'Não informado',
              city: addr.city || 'Não informado',
              state: addr.state || 'XX',
              postal_code: addr.postal_code || '00000000',
              country: addr.country || 'BR',
              is_default: addr.is_default ?? false,
            });
          }
        }
      }

      // Batch insert all addresses
      if (allAddresses.length > 0) {
        await supabase.from('customer_addresses').insert(allAddresses);
      }
    }
  }
}

async function importCustomer(supabase: any, tenantId: string, customer: any, results: any) {
  // This function is now a wrapper - actual batch processing happens in importCustomersBatch
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

// Map payment method to valid enum value
function mapPaymentMethod(raw: string | null | undefined): string | null {
  if (!raw) return null;
  
  const normalized = raw.toLowerCase().trim();
  
  // PIX variations
  if (normalized.includes('pix')) return 'pix';
  
  // Credit card variations
  if (normalized.includes('credit') || normalized.includes('crédito') || 
      normalized.includes('credito') || normalized.includes('cartão de crédito') ||
      normalized.includes('cartao de credito') || normalized.includes('card')) {
    return 'credit_card';
  }
  
  // Debit card variations
  if (normalized.includes('debit') || normalized.includes('débito') || normalized.includes('debito')) {
    return 'debit_card';
  }
  
  // Boleto variations
  if (normalized.includes('boleto') || normalized.includes('billet')) {
    return 'boleto';
  }
  
  // Mercado Pago
  if (normalized.includes('mercado pago') || normalized.includes('mercadopago')) {
    return 'mercado_pago';
  }
  
  // Pagar.me (when not specific method)
  if (normalized.includes('pagar.me') || normalized.includes('pagarme')) {
    return 'pagarme';
  }
  
  // Return null for unknown methods (will be saved as null, which is allowed)
  return null;
}

/**
 * Validate and map payment_status to valid enum value
 * Valid: 'pending' | 'processing' | 'approved' | 'declined'
 */
function mapPaymentStatus(raw: string | null | undefined): string {
  if (!raw) return 'pending';
  
  const normalized = raw.toLowerCase().trim();
  
  switch (normalized) {
    case 'approved':
    case 'paid':
    case 'confirmed':
    case 'completed':
    case 'aprovado':
      return 'approved';
    case 'processing':
    case 'pending_payment':
    case 'processando':
      return 'processing';
    case 'declined':
    case 'failed':
    case 'refused':
    case 'voided':
    case 'expired':
    case 'recusado':
    case 'expirado':
      return 'declined';
    case 'pending':
    case 'authorized':
    case 'pendente':
    default:
      return 'pending';
  }
}

/**
 * Validate and map shipping_status to valid enum value
 * Valid: 'pending' | 'processing' | 'shipped' | 'in_transit' | 'delivered'
 */
function mapShippingStatus(raw: string | null | undefined): string {
  if (!raw) return 'pending';
  
  const normalized = raw.toLowerCase().trim();
  
  switch (normalized) {
    case 'delivered':
    case 'fulfilled':
    case 'completed':
    case 'entregue':
      return 'delivered';
    case 'in_transit':
    case 'in-transit':
    case 'out_for_delivery':
    case 'em trânsito':
    case 'em_transito':
      return 'in_transit';
    case 'shipped':
    case 'dispatched':
    case 'partial':
    case 'partially_fulfilled':
    case 'enviado':
      return 'shipped';
    case 'processing':
    case 'preparing':
    case 'em separação':
    case 'em_separacao':
    case 'processando':
      return 'processing';
    case 'pending':
    case 'unfulfilled':
    case 'pendente':
    default:
      return 'pending';
  }
}

/**
 * Batch import orders - optimized for speed with internal sequential numbering
 * Pre-fetches existing orders and customers, then does bulk inserts
 * CRITICAL: Uses source_order_number for deduplication, generates internal order_number
 */
async function importOrdersBatch(supabase: any, tenantId: string, jobId: string, orders: any[], results: any, platform: string = 'shopify') {
  // Extract all source order numbers (remove # prefix if present)
  const sourceOrderNumbers = orders
    .map(o => {
      const num = (o.order_number || '').toString().trim();
      return num.replace(/^#/, ''); // Remove # prefix
    })
    .filter(n => n);
  
  if (sourceOrderNumbers.length === 0) {
    results.skipped += orders.length;
    return;
  }

  // Pre-fetch existing orders by source_order_number (CRITICAL: prevent duplicates)
  // Check both order_number (legacy) and source_order_number (new)
  const { data: existingBySource } = await supabase
    .from('orders')
    .select('source_order_number, order_number')
    .eq('tenant_id', tenantId)
    .in('source_order_number', sourceOrderNumbers);

  const { data: existingByOrderNum } = await supabase
    .from('orders')
    .select('order_number')
    .eq('tenant_id', tenantId)
    .in('order_number', sourceOrderNumbers);

  // Build set of existing source order numbers
  const existingSourceNumbers = new Set<string>();
  (existingBySource || []).forEach((o: any) => {
    if (o.source_order_number) existingSourceNumbers.add(o.source_order_number);
  });
  (existingByOrderNum || []).forEach((o: any) => {
    if (o.order_number) existingSourceNumbers.add(o.order_number);
  });
  
  // Also track order numbers within this batch to prevent duplicate inserts
  const seenInBatch = new Set<string>();

  // Filter out existing orders AND duplicates within the same batch
  // Then sort by created_at for chronological numbering
  const newOrders = orders
    .filter(o => {
      let sourceNumber = (o.order_number || '').toString().trim();
      sourceNumber = sourceNumber.replace(/^#/, ''); // Remove # prefix
      
      if (!sourceNumber) return false;
      
      // Skip if already exists in database (by source_order_number or order_number)
      if (existingSourceNumbers.has(sourceNumber)) {
        results.skipped++;
        return false;
      }
      
      // Skip if already seen in this batch (prevent duplicates within batch)
      if (seenInBatch.has(sourceNumber)) {
        results.skipped++;
        return false;
      }
      
      seenInBatch.add(sourceNumber);
      return true;
    })
    .sort((a, b) => {
      // Sort by created_at for chronological numbering
      const dateA = new Date(a.created_at || '1970-01-01').getTime();
      const dateB = new Date(b.created_at || '1970-01-01').getTime();
      return dateA - dateB;
    });

  if (newOrders.length === 0) {
    return;
  }

  // Extract unique customer emails
  const customerEmails = [...new Set(
    newOrders
      .map(o => (o.customer_email || '').toString().trim().toLowerCase())
      .filter(e => e && e.includes('@'))
  )];

  // Pre-fetch existing customers
  let customerMap = new Map<string, string>();
  if (customerEmails.length > 0) {
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id, email')
      .eq('tenant_id', tenantId)
      .in('email', customerEmails);

    customerMap = new Map((existingCustomers || []).map((c: any) => [c.email, c.id]));
  }

  // Find customers that need to be created
  const customersToCreate: any[] = [];
  const seenEmails = new Set<string>();
  
  for (const order of newOrders) {
    const email = (order.customer_email || '').toString().trim().toLowerCase();
    if (email && email.includes('@') && !customerMap.has(email) && !seenEmails.has(email)) {
      seenEmails.add(email);
      customersToCreate.push({
        tenant_id: tenantId,
        email,
        full_name: order.customer_name || 'Cliente',
        phone: order.customer_phone || null,
      });
    }
  }

  // Bulk create missing customers
  if (customersToCreate.length > 0) {
    const { data: newCustomers, error: custError } = await supabase
      .from('customers')
      .insert(customersToCreate)
      .select('id, email');

    if (!custError && newCustomers) {
      for (const c of newCustomers) {
        customerMap.set(c.email, c.id);
      }
    }
  }

  // Get the current max order number for this tenant to generate internal sequential numbers
  const { data: maxOrderData } = await supabase
    .from('orders')
    .select('order_number')
    .eq('tenant_id', tenantId)
    .order('order_number', { ascending: false })
    .limit(100); // Get last 100 to find max numeric

  // Find the highest numeric order number
  let maxOrderNum = 0;
  if (maxOrderData) {
    for (const order of maxOrderData) {
      const numMatch = order.order_number?.match(/^#?(\d+)$/);
      if (numMatch) {
        const num = parseInt(numMatch[1], 10);
        if (num > maxOrderNum) maxOrderNum = num;
      }
    }
  }

  // Get tenant's next_order_number as alternative starting point
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('next_order_number')
    .eq('id', tenantId)
    .single();
  
  // Use whichever is higher: max existing order or tenant's next_order_number
  // IMPORTANT: For imports, we do NOT use the 1000 rule - we start from 1 if no orders exist
  const tenantNextNum = tenantData?.next_order_number || 0;
  let nextInternalNumber = Math.max(maxOrderNum + 1, 1); // Start from 1 for imports, not 1000
  
  // Only use tenant's next_order_number if it's higher AND we have no existing orders
  if (maxOrderNum === 0 && tenantNextNum > 0) {
    // Check if this is a fresh tenant (no imports yet)
    const { count: orderCount } = await supabase
      .from('orders')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);
    
    if (orderCount === 0 && tenantNextNum >= 1000) {
      // This is a fresh store - but for imports, still start from 1
      // The 1000 rule is ONLY for new stores without imports
      nextInternalNumber = 1;
    }
  }

  console.log(`[import-batch] Starting internal numbering from ${nextInternalNumber} (maxExisting: ${maxOrderNum})`);

  // Build order inserts with internal sequential numbering
  const orderInserts: any[] = [];
  const orderItemsMap: Map<string, any[]> = new Map(); // keyed by internal order_number

  for (const order of newOrders) {
    let sourceOrderNumber = (order.order_number || '').toString().trim();
    sourceOrderNumber = sourceOrderNumber.replace(/^#/, ''); // Ensure # is removed
    
    // Generate internal sequential order number
    const internalOrderNumber = `#${nextInternalNumber}`;
    nextInternalNumber++;
    
    const customerEmail = (order.customer_email || '').toString().trim().toLowerCase();
    const customerName = order.customer_name || (customerEmail ? 'Cliente' : 'Cliente');
    
    const customerId = customerEmail ? customerMap.get(customerEmail) || null : null;

    const mappedPaymentMethod = mapPaymentMethod(order.payment_method);
    const mappedPaymentStatus = mapPaymentStatus(order.payment_status);
    const mappedShippingStatus = mapShippingStatus(order.shipping_status);

    const orderData = {
      tenant_id: tenantId,
      customer_id: customerId,
      order_number: internalOrderNumber, // Internal sequential number (e.g., #1, #2, #3)
      source_order_number: sourceOrderNumber, // Original from source (e.g., 3381)
      source_platform: 'shopify', // Platform identifier
      status: order.status || 'pending',
      payment_status: mappedPaymentStatus,
      payment_method: mappedPaymentMethod,
      payment_gateway: order.payment_gateway || null,
      payment_gateway_id: order.payment_gateway_id || null,
      shipping_status: mappedShippingStatus,
      subtotal: order.subtotal || 0,
      discount_total: order.discount_total || 0,
      shipping_total: order.shipping_total || 0,
      tax_total: order.tax_total || 0,
      total: order.total || 0,
      customer_email: customerEmail || null,
      customer_name: customerName,
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

    orderInserts.push(orderData);
    
    // Store items for later insertion (keyed by internal order number)
    if (order.items?.length > 0) {
      orderItemsMap.set(internalOrderNumber, order.items);
    }
  }

  // Update tenant's next_order_number to the new max
  await supabase
    .from('tenants')
    .update({ next_order_number: nextInternalNumber })
    .eq('id', tenantId);

  // Bulk insert orders
  if (orderInserts.length > 0) {
    const { data: insertedOrders, error: orderError } = await supabase
      .from('orders')
      .insert(orderInserts)
      .select('id, order_number');

    if (orderError) {
      console.error('[import-batch] Batch orders insert error:', orderError);
      results.failed += orderInserts.length;
      results.itemErrors.push({
        index: 0,
        identifier: 'orders-batch',
        error: orderError.message,
      });
      return;
    }

    if (insertedOrders) {
      results.imported += insertedOrders.length;

      // Build order_number -> id map for items
      const orderIdMap = new Map(insertedOrders.map((o: any) => [o.order_number, o.id]));
      
      // Track all imported orders
      for (const insertedOrder of insertedOrders) {
        await trackImportedItem(supabase, tenantId, jobId, 'orders', insertedOrder.id);
      }

      // Collect all order items
      const allOrderItems: any[] = [];
      for (const [orderNumber, items] of orderItemsMap) {
        const orderId = orderIdMap.get(orderNumber);
        if (!orderId) continue;

        const validItems = items.filter((item: any) => item.product_name);
        for (const item of validItems) {
          allOrderItems.push({
            order_id: orderId,
            sku: item.product_sku || `SKU-${orderNumber}-${allOrderItems.length}`,
            product_name: item.product_name || 'Produto',
            quantity: item.quantity || 1,
            unit_price: item.unit_price || 0,
            discount_amount: 0,
            total_price: (item.quantity || 1) * (item.unit_price || 0),
          });
        }
      }

      // Bulk insert order items
      if (allOrderItems.length > 0) {
        await supabase.from('order_items').insert(allOrderItems);
      }
    }
  }
}

// Legacy single-order import function (kept for reference)
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
  const customerName = order.customer_name || (customerEmail ? 'Cliente' : null);
  
  // CRITICAL: customer_name cannot be null
  if (!customerName) {
    throw new Error('Pedido sem nome de cliente - customer_name é obrigatório');
  }
  
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
          full_name: customerName,
          phone: order.customer_phone || null,
        })
        .select('id')
        .single();
      customerId = newCustomer?.id;
    }
  }

  // Map payment method to valid enum value
  const mappedPaymentMethod = mapPaymentMethod(order.payment_method);
  // Map payment_status and shipping_status to valid enum values
  const mappedPaymentStatus = mapPaymentStatus(order.payment_status);
  const mappedShippingStatus = mapShippingStatus(order.shipping_status);

  // Build order data with all supported fields
  const orderData = {
    tenant_id: tenantId,
    customer_id: customerId,
    order_number: orderNumber,
    status: order.status || 'pending',
    payment_status: mappedPaymentStatus,
    payment_method: mappedPaymentMethod,
    payment_gateway: order.payment_gateway || null,
    payment_gateway_id: order.payment_gateway_id || null,
    shipping_status: mappedShippingStatus,
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
