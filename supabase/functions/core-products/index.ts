// =============================================
// CORE-PRODUCTS: Canonical API for Product Operations
// All writes to products table must go through this API
// Implements: validation, audit, events
// =============================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface AuditEntry {
  tenant_id: string;
  entity_type: 'product';
  entity_id: string;
  action: string;
  before_json: Record<string, any> | null;
  after_json: Record<string, any>;
  changed_fields: string[];
  actor_user_id: string | null;
  source: string;
  correlation_id: string | null;
}

async function createAuditLog(supabase: any, entry: AuditEntry): Promise<void> {
  try {
    await supabase.from('core_audit_log').insert(entry);
  } catch (err) {
    console.error('[core-products] Audit log error:', err);
  }
}

async function emitEvent(
  supabase: any,
  tenantId: string,
  eventType: string,
  subject: string,
  payload: Record<string, any>,
  idempotencyKey: string
): Promise<void> {
  try {
    await supabase.from('events_inbox').insert({
      tenant_id: tenantId,
      event_type: eventType,
      subject,
      payload,
      idempotency_key: idempotencyKey,
      status: 'new',
    });
  } catch (err) {
    console.error('[core-products] Event emit error:', err);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from auth header
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let tenantId: string | null = null;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        userId = user.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('current_tenant_id')
          .eq('id', user.id)
          .single();
        tenantId = profile?.current_tenant_id;
      }
    }

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant not found', code: 'NO_TENANT' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify user belongs to tenant
    const { data: roleCheck } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .eq('tenant_id', tenantId)
      .single();

    if (!roleCheck) {
      return new Response(
        JSON.stringify({ success: false, error: 'Access denied', code: 'ACCESS_DENIED' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { action, product_id, ...payload } = body;
    const correlationId = crypto.randomUUID();

    switch (action) {
      case 'create': {
        const { sku, name, slug, price, ...rest } = payload;

        if (!name || !sku) {
          return new Response(
            JSON.stringify({ success: false, error: 'Name and SKU are required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for duplicate SKU
        const { data: existingSku } = await supabase
          .from('products')
          .select('id')
          .eq('tenant_id', tenantId)
          .eq('sku', sku)
          .single();

        if (existingSku) {
          return new Response(
            JSON.stringify({ success: false, error: 'SKU already exists', code: 'DUPLICATE_SKU' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for duplicate slug
        if (slug) {
          const { data: existingSlug } = await supabase
            .from('products')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('slug', slug)
            .single();

          if (existingSlug) {
            return new Response(
              JSON.stringify({ success: false, error: 'Slug already exists', code: 'DUPLICATE_SLUG' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const productData = {
          tenant_id: tenantId,
          sku,
          name,
          slug: slug || sku.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          price: price || 0,
          status: rest.status || 'draft',
          ...rest,
        };

        const { data: newProduct, error: insertError } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (insertError) {
          return new Response(
            JSON.stringify({ success: false, error: insertError.message, code: 'INSERT_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'product',
          entity_id: newProduct.id,
          action: 'create',
          before_json: null,
          after_json: productData,
          changed_fields: Object.keys(productData),
          actor_user_id: userId,
          source: 'core-products',
          correlation_id: correlationId,
        });

        await emitEvent(supabase, tenantId, 'product.created', newProduct.id, {
          product_id: newProduct.id,
          sku,
          name,
        }, `product_created_${newProduct.id}`);

        return new Response(
          JSON.stringify({ success: true, data: newProduct }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        if (!product_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: product, error: fetchError } = await supabase
          .from('products')
          .select('*')
          .eq('id', product_id)
          .eq('tenant_id', tenantId)
          .single();

        if (fetchError || !product) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const allowedFields = [
          'name', 'sku', 'slug', 'description', 'short_description',
          'price', 'compare_at_price', 'cost_price', 'stock_quantity',
          'low_stock_threshold', 'manage_stock', 'allow_backorder',
          'weight', 'width', 'height', 'depth', 'gtin', 'ncm', 'cest',
          'origin_code', 'tax_code', 'status', 'is_featured',
          'has_variants', 'product_format', 'stock_type',
          'seo_title', 'seo_description', 'brand', 'vendor', 'product_type',
          'tags', 'requires_shipping', 'taxable', 'uom',
          'promotion_start_date', 'promotion_end_date'
        ];

        const updateData: Record<string, any> = {};
        const changedFields: string[] = [];
        const beforeJson: Record<string, any> = {};

        for (const field of allowedFields) {
          if (field in payload && payload[field] !== product[field]) {
            beforeJson[field] = product[field];
            updateData[field] = payload[field];
            changedFields.push(field);
          }
        }

        if (changedFields.length === 0) {
          return new Response(
            JSON.stringify({ success: true, data: product }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Check for duplicate SKU if changing
        if (updateData.sku && updateData.sku !== product.sku) {
          const { data: existingSku } = await supabase
            .from('products')
            .select('id')
            .eq('tenant_id', tenantId)
            .eq('sku', updateData.sku)
            .neq('id', product_id)
            .single();

          if (existingSku) {
            return new Response(
              JSON.stringify({ success: false, error: 'SKU already exists', code: 'DUPLICATE_SKU' }),
              { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        const { data: updated, error: updateError } = await supabase
          .from('products')
          .update(updateData)
          .eq('id', product_id)
          .select()
          .single();

        if (updateError) {
          return new Response(
            JSON.stringify({ success: false, error: updateError.message, code: 'UPDATE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'product',
          entity_id: product_id,
          action: 'update',
          before_json: beforeJson,
          after_json: updateData,
          changed_fields: changedFields,
          actor_user_id: userId,
          source: 'core-products',
          correlation_id: correlationId,
        });

        // Emit stock change event if stock was updated
        if (changedFields.includes('stock_quantity')) {
          await emitEvent(supabase, tenantId, 'product.stock_changed', product_id, {
            product_id,
            sku: updated.sku,
            old_stock: beforeJson.stock_quantity,
            new_stock: updateData.stock_quantity,
          }, `product_stock_${product_id}_${Date.now()}`);
        }

        await emitEvent(supabase, tenantId, 'product.updated', product_id, {
          product_id,
          changed_fields: changedFields,
        }, `product_updated_${product_id}_${Date.now()}`);

        return new Response(
          JSON.stringify({ success: true, data: updated }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        if (!product_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { data: product } = await supabase
          .from('products')
          .select('*')
          .eq('id', product_id)
          .eq('tenant_id', tenantId)
          .single();

        if (!product) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product not found', code: 'NOT_FOUND' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Soft delete: set status to archived
        const { error: deleteError } = await supabase
          .from('products')
          .update({ status: 'archived', deleted_at: new Date().toISOString() })
          .eq('id', product_id);

        if (deleteError) {
          return new Response(
            JSON.stringify({ success: false, error: deleteError.message, code: 'DELETE_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'product',
          entity_id: product_id,
          action: 'delete',
          before_json: product,
          after_json: { status: 'archived', deleted_at: new Date().toISOString() },
          changed_fields: ['status', 'deleted_at'],
          actor_user_id: userId,
          source: 'core-products',
          correlation_id: correlationId,
        });

        return new Response(
          JSON.stringify({ success: true, data: { product_id } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'add_image': {
        if (!product_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { url, alt_text, is_primary, sort_order, file_id } = payload;

        if (!url) {
          return new Response(
            JSON.stringify({ success: false, error: 'Image URL required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // If this is primary, unset other primaries
        if (is_primary) {
          await supabase
            .from('product_images')
            .update({ is_primary: false })
            .eq('product_id', product_id);
        }

        const imageData = {
          product_id,
          url,
          alt_text: alt_text || null,
          is_primary: is_primary || false,
          sort_order: sort_order || 0,
          file_id: file_id || null,
        };

        const { data: newImage, error: insertError } = await supabase
          .from('product_images')
          .insert(imageData)
          .select()
          .single();

        if (insertError) {
          return new Response(
            JSON.stringify({ success: false, error: insertError.message, code: 'INSERT_FAILED' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, data: newImage }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_components': {
        if (!product_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { components } = payload;

        // Delete existing components
        await supabase
          .from('product_components')
          .delete()
          .eq('parent_product_id', product_id);

        // Insert new components
        if (components && components.length > 0) {
          const componentData = components.map((comp: any, index: number) => ({
            parent_product_id: product_id,
            component_product_id: comp.component_product_id,
            quantity: comp.quantity || 1,
            cost_price: comp.cost_price,
            sale_price: comp.sale_price,
            sort_order: index,
          }));

          await supabase.from('product_components').insert(componentData);
        }

        await createAuditLog(supabase, {
          tenant_id: tenantId,
          entity_type: 'product',
          entity_id: product_id,
          action: 'update_components',
          before_json: null,
          after_json: { components },
          changed_fields: ['components'],
          actor_user_id: userId,
          source: 'core-products',
          correlation_id: correlationId,
        });

        return new Response(
          JSON.stringify({ success: true, data: { product_id, components_count: components?.length || 0 } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update_related': {
        if (!product_id) {
          return new Response(
            JSON.stringify({ success: false, error: 'Product ID required', code: 'VALIDATION_ERROR' }),
            { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const { related_ids } = payload;

        // Delete existing relations
        await supabase
          .from('related_products')
          .delete()
          .eq('product_id', product_id);

        // Insert new relations
        if (related_ids && related_ids.length > 0) {
          const relations = related_ids.map((relatedId: string, index: number) => ({
            product_id,
            related_product_id: relatedId,
            position: index,
          }));

          await supabase.from('related_products').insert(relations);
        }

        return new Response(
          JSON.stringify({ success: true, data: { product_id, related_count: related_ids?.length || 0 } }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ success: false, error: 'Unknown action', code: 'UNKNOWN_ACTION' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error: any) {
    console.error('[core-products] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal error', code: 'INTERNAL_ERROR' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
