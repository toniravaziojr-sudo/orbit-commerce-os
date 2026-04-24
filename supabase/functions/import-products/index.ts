/**
 * import-products — Canonical motor for product imports
 * 
 * Extracted from the monolithic import-batch.
 * Called by: individual module button AND wizard orchestrator.
 * 
 * Contract:
 *   Input:  { jobId, tenantId, platform, items: NormalizedProduct[], batchIndex?, categoryMap? }
 *   Output: ImportResponse envelope { success, results: { created, updated, unchanged, skipped, errors, itemErrors } }
 * 
 * Merge rule: Upsert by tenant_id + slug. Full update on existing products.
 */

import {
  corsResponse,
  jsonResponse,
  createImportResults,
  createImportResponse,
  trackImportedItem,
  slugify,
  hashCode,
  parseNumericField,
  parseIntField,
  type ImportResults,
  type ItemError,
} from '../_shared/import-helpers.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';

const VERSION = '2026-04-01.0001';

interface ProductImportRequest {
  jobId: string;
  tenantId: string;
  platform: string;
  items: any[];
  batchIndex?: number;
  categoryMap?: Record<string, string>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json() as ProductImportRequest;
    const { jobId, tenantId, platform, items, batchIndex = 0, categoryMap } = body;

    if (!tenantId) return jsonResponse({ success: false, error: 'tenantId é obrigatório' });
    if (!jobId) return jsonResponse({ success: false, error: 'jobId é obrigatório' });
    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse({ success: false, error: 'Nenhum item no batch' });
    }

    console.log(`[import-products v${VERSION}] Batch ${batchIndex}: ${items.length} products for job ${jobId}`);

    const results = createImportResults();

    for (let i = 0; i < items.length; i++) {
      const product = items[i];
      try {
        await importProduct(supabase, tenantId, jobId, product, results, categoryMap, platform);
      } catch (error: any) {
        results.errors++;
        const identifier = product.name || product.title || product.slug || product.sku || `item-${i}`;
        const errorMessage = error?.message || String(error);
        console.error(`[import-products] Item ${i} failed:`, identifier, errorMessage);
        results.itemErrors.push({ index: i + (batchIndex * items.length), identifier, error: errorMessage });
      }
    }

    // Update job progress
    try {
      await supabase.rpc('update_import_job_batch', {
        p_job_id: jobId,
        p_batch_processed: results.created + results.updated + results.unchanged + results.skipped + results.errors,
        p_batch_imported: results.created + results.updated,
        p_batch_failed: results.errors,
        p_batch_skipped: results.skipped + results.unchanged,
        p_errors: results.itemErrors.slice(0, 10),
      });
    } catch (updateError) {
      console.warn('[import-products] Could not update job progress:', updateError);
    }

    return jsonResponse(createImportResponse(results, { version: VERSION, startTime }));
  } catch (error: any) {
    console.error('[import-products] Fatal error:', error);
    return jsonResponse({
      success: false,
      results: { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: 1, itemErrors: [] },
      error: error?.message || String(error),
    });
  }
});

// ===========================================
// PRODUCT IMPORT LOGIC
// ===========================================

async function importProduct(
  supabase: any,
  tenantId: string,
  jobId: string,
  product: any,
  results: ImportResults,
  categoryMap?: Record<string, string>,
  platform?: string
) {
  const productName = (product.name || product.title || '').toString().trim();
  if (!productName || productName === 'Produto sem nome' || productName === 'Produto importado') {
    results.skipped++;
    return;
  }

  const effectiveSlug = product.slug || slugify(productName);

  const { data: existing } = await supabase
    .from('products')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('slug', effectiveSlug)
    .maybeSingle();

  let productId: string;

  const effectiveSku = product.sku && product.sku.trim()
    ? product.sku.trim()
    : `IMP-${effectiveSlug.substring(0, 20)}-${hashCode(effectiveSlug + tenantId).toString(36).toUpperCase()}`;

  const effectivePrice = parseNumericField(product.price);
  const effectiveComparePrice = parseNumericField(product.compare_at_price);
  const effectiveCostPrice = parseNumericField(product.cost_price);
  const effectiveStock = parseIntField(product.stock_quantity);
  const effectiveWeight = parseNumericField(product.weight);

  const trackingId = product.external_id || `${platform || 'import'}:product:${effectiveSlug}`;

  if (existing) {
    productId = existing.id;
    const { error } = await supabase
      .from('products')
      .update({
        name: productName,
        description: product.description,
        short_description: product.short_description,
        price: effectivePrice,
        compare_at_price: effectiveComparePrice || null,
        cost_price: effectiveCostPrice || null,
        sku: effectiveSku,
        barcode: product.barcode,
        weight: effectiveWeight || null,
        width: product.width,
        height: product.height,
        depth: product.depth,
        stock_quantity: effectiveStock,
        is_featured: product.is_featured,
        status: product.status || 'active',
        seo_title: product.seo_title,
        seo_description: product.seo_description,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (error) throw error;

    await trackImportedItem(supabase, tenantId, jobId, 'products', productId, trackingId, 'updated');
    results.updated++;
  } else {
    const { data: newProduct, error } = await supabase
      .from('products')
      .insert({
        tenant_id: tenantId,
        name: productName,
        slug: effectiveSlug,
        description: product.description,
        short_description: product.short_description,
        price: effectivePrice,
        compare_at_price: effectiveComparePrice || null,
        cost_price: effectiveCostPrice || null,
        sku: effectiveSku,
        barcode: product.barcode,
        weight: effectiveWeight || null,
        width: product.width,
        height: product.height,
        depth: product.depth,
        stock_quantity: effectiveStock,
        is_featured: product.is_featured,
        status: product.status || 'active',
        seo_title: product.seo_title,
        seo_description: product.seo_description,
      })
      .select('id')
      .single();

    if (error) throw error;
    productId = newProduct.id;

    await trackImportedItem(supabase, tenantId, jobId, 'products', productId, trackingId, 'created');

    // Images
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

    // Variants
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

    results.created++;
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
