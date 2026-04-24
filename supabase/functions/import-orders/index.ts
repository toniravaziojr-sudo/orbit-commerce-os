/**
 * import-orders — Canonical motor for order imports
 * 
 * Extracted from the monolithic import-batch.
 * Called by: individual module button AND wizard orchestrator.
 * 
 * Contract:
 *   Input:  { jobId, tenantId, platform, items: NormalizedOrder[], batchIndex? }
 *   Output: ImportResponse envelope { success, results: { created, updated, unchanged, skipped, errors, itemErrors } }
 * 
 * Merge rule: Deduplicate by tenant_id + source_order_number. Existing orders are skipped (never merged).
 */

import {
  corsResponse,
  jsonResponse,
  createImportResults,
  createImportResponse,
  trackImportedItemsBatch,
  mapPaymentMethod,
  mapPaymentStatus,
  mapShippingStatus,
  type ImportItemTracking,
} from '../_shared/import-helpers.ts';
import { createClient } from 'npm:@supabase/supabase-js@2';

const VERSION = '2026-04-01.0001';

interface OrderImportRequest {
  jobId: string;
  tenantId: string;
  platform: string;
  items: any[];
  batchIndex?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const startTime = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const body = await req.json() as OrderImportRequest;
    const { jobId, tenantId, platform, items, batchIndex = 0 } = body;

    if (!tenantId) return jsonResponse({ success: false, error: 'tenantId é obrigatório' });
    if (!jobId) return jsonResponse({ success: false, error: 'jobId é obrigatório' });
    if (!Array.isArray(items) || items.length === 0) {
      return jsonResponse({ success: false, error: 'Nenhum item no batch' });
    }

    console.log(`[import-orders v${VERSION}] Batch ${batchIndex}: ${items.length} orders for job ${jobId}`);

    const results = createImportResults();

    try {
      await importOrdersBatch(supabase, tenantId, jobId, items, results, platform || 'import');
    } catch (error: any) {
      console.error('[import-orders] Batch error:', error);
      results.errors += items.length;
      results.itemErrors.push({
        index: 0,
        identifier: 'orders-batch',
        error: error?.message || String(error),
      });
    }

    // Update job progress
    try {
      await supabase.rpc('update_import_job_batch', {
        p_job_id: jobId,
        p_batch_processed: results.created + results.updated + results.unchanged + results.skipped + results.errors,
        p_batch_imported: results.created,
        p_batch_failed: results.errors,
        p_batch_skipped: results.skipped,
        p_errors: results.itemErrors.slice(0, 10),
      });
    } catch (updateError) {
      console.warn('[import-orders] Could not update job progress:', updateError);
    }

    return jsonResponse(createImportResponse(results, { version: VERSION, startTime }));
  } catch (error: any) {
    console.error('[import-orders] Fatal error:', error);
    return jsonResponse({
      success: false,
      results: { created: 0, updated: 0, unchanged: 0, skipped: 0, errors: 1, itemErrors: [] },
      error: error?.message || String(error),
    });
  }
});

// ===========================================
// ORDER BATCH IMPORT LOGIC
// ===========================================

async function importOrdersBatch(
  supabase: any,
  tenantId: string,
  jobId: string,
  orders: any[],
  results: ReturnType<typeof createImportResults>,
  platform: string
) {
  // Extract all source order numbers (remove # prefix)
  const sourceOrderNumbers = orders
    .map(o => {
      const num = (o.order_number || '').toString().trim();
      return num.replace(/^#/, '');
    })
    .filter(n => n);

  if (sourceOrderNumbers.length === 0) {
    results.skipped += orders.length;
    return;
  }

  // Pre-fetch existing orders for deduplication
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

  const existingSourceNumbers = new Set<string>();
  (existingBySource || []).forEach((o: any) => {
    if (o.source_order_number) existingSourceNumbers.add(o.source_order_number);
  });
  (existingByOrderNum || []).forEach((o: any) => {
    if (o.order_number) existingSourceNumbers.add(o.order_number);
  });

  const seenInBatch = new Set<string>();

  // Filter and sort
  const newOrders = orders
    .filter(o => {
      let sourceNumber = (o.order_number || '').toString().trim().replace(/^#/, '');
      if (!sourceNumber) return false;
      if (existingSourceNumbers.has(sourceNumber)) { results.skipped++; return false; }
      if (seenInBatch.has(sourceNumber)) { results.skipped++; return false; }
      seenInBatch.add(sourceNumber);
      return true;
    })
    .sort((a, b) => {
      const dateA = new Date(a.created_at || '1970-01-01').getTime();
      const dateB = new Date(b.created_at || '1970-01-01').getTime();
      return dateA - dateB;
    });

  if (newOrders.length === 0) return;

  // Pre-fetch/create customers
  const customerEmails = [...new Set(
    newOrders.map(o => (o.customer_email || '').toString().trim().toLowerCase()).filter(e => e && e.includes('@'))
  )];

  let customerMap = new Map<string, string>();
  if (customerEmails.length > 0) {
    const { data: existingCustomers } = await supabase
      .from('customers')
      .select('id, email')
      .eq('tenant_id', tenantId)
      .in('email', customerEmails);
    customerMap = new Map((existingCustomers || []).map((c: any) => [c.email, c.id]));
  }

  // Create missing customers
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

  if (customersToCreate.length > 0) {
    const { data: newCustomers, error: custError } = await supabase
      .from('customers')
      .insert(customersToCreate)
      .select('id, email');
    if (!custError && newCustomers) {
      for (const c of newCustomers) customerMap.set(c.email, c.id);
    }
  }

  // Get current max order number for sequential numbering
  const { data: maxOrderData } = await supabase
    .from('orders')
    .select('order_number')
    .eq('tenant_id', tenantId)
    .order('order_number', { ascending: false })
    .limit(100);

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

  const { count: orderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  let nextInternalNumber = maxOrderNum > 0 ? maxOrderNum + 1 : (orderCount === 0 ? 1 : maxOrderNum + 1);

  console.log(`[import-orders] Starting internal numbering from ${nextInternalNumber}`);

  // Build order inserts
  const orderInserts: any[] = [];
  const orderItemsMap: Map<string, any[]> = new Map();

  for (const order of newOrders) {
    let sourceOrderNumber = (order.order_number || '').toString().trim().replace(/^#/, '');
    const internalOrderNumber = `#${nextInternalNumber}`;
    nextInternalNumber++;

    const customerEmail = (order.customer_email || '').toString().trim().toLowerCase();
    const customerName = order.customer_name || 'Cliente';
    const customerId = customerEmail ? customerMap.get(customerEmail) || null : null;

    orderInserts.push({
      tenant_id: tenantId,
      customer_id: customerId,
      order_number: internalOrderNumber,
      source_order_number: sourceOrderNumber,
      source_platform: platform,
      status: order.status || 'pending',
      payment_status: mapPaymentStatus(order.payment_status),
      payment_method: mapPaymentMethod(order.payment_method),
      payment_gateway: order.payment_gateway || null,
      payment_gateway_id: order.payment_gateway_id || null,
      shipping_status: mapShippingStatus(order.shipping_status),
      subtotal: order.subtotal || 0,
      discount_total: order.discount_total || 0,
      shipping_total: order.shipping_total || 0,
      tax_total: order.tax_total || 0,
      total: order.total || 0,
      customer_email: customerEmail || null,
      customer_name: customerName,
      customer_phone: order.customer_phone || null,
      shipping_street: order.shipping_address?.street || null,
      shipping_number: order.shipping_address?.number || null,
      shipping_complement: order.shipping_address?.complement || null,
      shipping_neighborhood: order.shipping_address?.neighborhood || null,
      shipping_city: order.shipping_address?.city || null,
      shipping_state: order.shipping_address?.state || null,
      shipping_postal_code: order.shipping_address?.postal_code || null,
      shipping_country: order.shipping_address?.country || 'BR',
      billing_street: order.billing_address?.street || null,
      billing_number: order.billing_address?.number || null,
      billing_complement: order.billing_address?.complement || null,
      billing_neighborhood: order.billing_address?.neighborhood || null,
      billing_city: order.billing_address?.city || null,
      billing_state: order.billing_address?.state || null,
      billing_postal_code: order.billing_address?.postal_code || null,
      billing_country: order.billing_address?.country || null,
      discount_code: order.discount_code || null,
      discount_name: order.discount_code || null,
      discount_type: order.discount_type || null,
      shipping_service_code: order.shipping_service_code || null,
      shipping_service_name: order.shipping_service_name || null,
      customer_notes: order.notes || null,
      tracking_code: order.tracking_code || null,
      shipping_carrier: order.tracking_carrier || null,
      paid_at: order.paid_at || null,
      shipped_at: order.shipped_at || null,
      delivered_at: order.delivered_at || null,
      cancelled_at: order.cancelled_at || null,
      cancellation_reason: order.cancellation_reason || null,
      created_at: order.created_at || new Date().toISOString(),
      is_first_sale: false,
    });

    if (order.items?.length > 0) {
      orderItemsMap.set(internalOrderNumber, order.items);
    }
  }

  // Update tenant's next_order_number
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
      console.error('[import-orders] Batch insert error:', orderError);
      results.errors += orderInserts.length;
      results.itemErrors.push({ index: 0, identifier: 'orders-batch', error: orderError.message });
      return;
    }

    if (insertedOrders) {
      results.created += insertedOrders.length;

      const orderIdMap = new Map(insertedOrders.map((o: any) => [o.order_number, o.id]));
      const sourceNumberMap = new Map<string, string>();
      for (const order of orderInserts) {
        sourceNumberMap.set(order.order_number, order.source_order_number);
      }

      // Batch tracking
      const trackingItems: ImportItemTracking[] = insertedOrders.map((o: any) => ({
        internalId: o.id,
        externalId: `${platform}:order:${sourceNumberMap.get(o.order_number) || o.id}`,
        result: 'created' as const,
      }));

      if (trackingItems.length > 0) {
        await trackImportedItemsBatch(supabase, tenantId, jobId, 'orders', trackingItems);
      }

      // Insert order items
      const allOrderItems: any[] = [];
      for (const [orderNumber, items] of orderItemsMap) {
        const orderId = orderIdMap.get(orderNumber);
        if (!orderId) continue;
        for (const item of items.filter((i: any) => i.product_name)) {
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

      if (allOrderItems.length > 0) {
        await supabase.from('order_items').insert(allOrderItems);
      }
    }
  }
}
