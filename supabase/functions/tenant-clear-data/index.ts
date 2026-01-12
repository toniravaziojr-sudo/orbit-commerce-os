import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClearDataRequest {
  tenantId: string;
  modules: ('products' | 'categories' | 'customers' | 'orders' | 'structure' | 'all')[];
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

    const body = await req.json() as ClearDataRequest;
    const { tenantId, modules } = body;

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenantId é obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!modules || modules.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'Selecione pelo menos um módulo para limpar' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting IMPORTED data clear for tenant ${tenantId}, modules: ${modules.join(', ')}`);

    const deleted: Record<string, number> = {};
    const errors: string[] = [];
    const shouldClearAll = modules.includes('all');

    // Helper: Get imported item IDs from import_items table
    const getImportedIds = async (module: string): Promise<string[]> => {
      const { data, error } = await supabase
        .from('import_items')
        .select('internal_id')
        .eq('tenant_id', tenantId)
        .eq('module', module)
        .eq('status', 'success')
        .not('internal_id', 'is', null);
      
      if (error) {
        console.error(`Error getting imported IDs for ${module}:`, error.message);
        return [];
      }
      
      return (data || []).map(item => item.internal_id).filter(Boolean);
    };

    // Helper: Safe delete with error logging (doesn't fail the entire operation)
    const safeDelete = async (table: string, column: string, ids: string[]): Promise<number> => {
      if (ids.length === 0) return 0;
      
      try {
        const { count, error } = await supabase
          .from(table)
          .delete({ count: 'exact' })
          .in(column, ids);
        
        if (error) {
          console.warn(`Error deleting from ${table}:`, error.message);
          errors.push(`${table}: ${error.message}`);
          return 0;
        }
        
        return count || 0;
      } catch (err) {
        console.warn(`Exception deleting from ${table}:`, err);
        return 0;
      }
    };

    // ========================================
    // Clear IMPORTED products and related tables
    // ========================================
    if (shouldClearAll || modules.includes('products')) {
      const importedProductIds = await getImportedIds('products');
      console.log(`Found ${importedProductIds.length} imported products to delete`);

      if (importedProductIds.length > 0) {
        deleted['product_categories'] = await safeDelete('product_categories', 'product_id', importedProductIds);
        deleted['product_images'] = await safeDelete('product_images', 'product_id', importedProductIds);
        deleted['product_variants'] = await safeDelete('product_variants', 'product_id', importedProductIds);
        deleted['cart_items'] = await safeDelete('cart_items', 'product_id', importedProductIds);
        deleted['buy_together_trigger'] = await safeDelete('buy_together_rules', 'trigger_product_id', importedProductIds);
        deleted['buy_together_suggested'] = await safeDelete('buy_together_rules', 'suggested_product_id', importedProductIds);
        
        // Delete products
        deleted['products'] = await safeDelete('products', 'id', importedProductIds);
      } else {
        deleted['products'] = 0;
      }

      // Clean import_items for products module
      const { count } = await supabase
        .from('import_items')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('module', 'products');
      deleted['import_items_products'] = count || 0;
    }

    // ========================================
    // Clear IMPORTED categories
    // FIX: Delete product_categories BEFORE categories (FK constraint)
    // ========================================
    if (shouldClearAll || modules.includes('categories')) {
      const importedCategoryIds = await getImportedIds('categories');
      console.log(`Found ${importedCategoryIds.length} imported categories to delete`);

      if (importedCategoryIds.length > 0) {
        // STEP 1: Delete product_categories FIRST (to avoid FK error)
        deleted['product_categories_from_categories'] = await safeDelete('product_categories', 'category_id', importedCategoryIds);

        // STEP 2: Then delete categories
        deleted['categories'] = await safeDelete('categories', 'id', importedCategoryIds);
      } else {
        deleted['categories'] = 0;
      }

      // Clean import_items for categories module
      const { count } = await supabase
        .from('import_items')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('module', 'categories');
      deleted['import_items_categories'] = count || 0;
    }

    // ========================================
    // Clear IMPORTED customers and related tables
    // CRITICAL: Handle ALL FK constraints properly
    // ========================================
    if (shouldClearAll || modules.includes('customers')) {
      const importedCustomerIds = await getImportedIds('customers');
      console.log(`Found ${importedCustomerIds.length} imported customers to delete`);

      if (importedCustomerIds.length > 0) {
        // STEP 1: Unlink orders from customers (set customer_id to NULL)
        const { error: unlinkError, count: unlinkCount } = await supabase
          .from('orders')
          .update({ customer_id: null })
          .in('customer_id', importedCustomerIds);
        
        if (unlinkError) {
          console.error('Error unlinking orders from customers:', unlinkError);
          errors.push(`orders unlink: ${unlinkError.message}`);
        } else {
          console.log(`Unlinked ${unlinkCount || 0} orders from customers`);
        }

        // STEP 2: Delete all FK-dependent tables
        deleted['customer_addresses'] = await safeDelete('customer_addresses', 'customer_id', importedCustomerIds);
        deleted['customer_notes'] = await safeDelete('customer_notes', 'customer_id', importedCustomerIds);
        deleted['customer_tag_assignments'] = await safeDelete('customer_tag_assignments', 'customer_id', importedCustomerIds);
        deleted['customer_notifications'] = await safeDelete('customer_notifications', 'customer_id', importedCustomerIds);
        deleted['carts'] = await safeDelete('carts', 'customer_id', importedCustomerIds);
        deleted['checkouts'] = await safeDelete('checkouts', 'customer_id', importedCustomerIds);
        deleted['checkout_sessions'] = await safeDelete('checkout_sessions', 'customer_id', importedCustomerIds);
        deleted['product_reviews'] = await safeDelete('product_reviews', 'customer_id', importedCustomerIds);
        deleted['notification_logs_customer'] = await safeDelete('notification_logs', 'customer_id', importedCustomerIds);
        deleted['post_sale_backfill_items'] = await safeDelete('post_sale_backfill_items', 'customer_id', importedCustomerIds);
        deleted['conversations_customer'] = await safeDelete('conversations', 'customer_id', importedCustomerIds);
        deleted['conversation_participants'] = await safeDelete('conversation_participants', 'customer_id', importedCustomerIds);

        // STEP 3: Delete customers
        deleted['customers'] = await safeDelete('customers', 'id', importedCustomerIds);
      } else {
        deleted['customers'] = 0;
      }

      // Clean import_items for customers module
      const { count } = await supabase
        .from('import_items')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('module', 'customers');
      deleted['import_items_customers'] = count || 0;
    }

    // ========================================
    // Clear IMPORTED orders and related tables
    // CRITICAL: Delete ALL FK-dependent tables first
    // ========================================
    if (shouldClearAll || modules.includes('orders')) {
      const importedOrderIds = await getImportedIds('orders');
      console.log(`Found ${importedOrderIds.length} imported orders to delete`);

      if (importedOrderIds.length > 0) {
        // STEP 1: Delete all FK-dependent tables
        deleted['order_items'] = await safeDelete('order_items', 'order_id', importedOrderIds);
        deleted['order_history'] = await safeDelete('order_history', 'order_id', importedOrderIds);
        deleted['payment_transactions'] = await safeDelete('payment_transactions', 'order_id', importedOrderIds);
        deleted['checkout_sessions_order'] = await safeDelete('checkout_sessions', 'order_id', importedOrderIds);
        deleted['discount_redemptions'] = await safeDelete('discount_redemptions', 'order_id', importedOrderIds);
        deleted['shipments'] = await safeDelete('shipments', 'order_id', importedOrderIds);
        deleted['notification_logs_order'] = await safeDelete('notification_logs', 'order_id', importedOrderIds);
        deleted['marketing_events_log'] = await safeDelete('marketing_events_log', 'order_id', importedOrderIds);
        deleted['order_attribution'] = await safeDelete('order_attribution', 'order_id', importedOrderIds);
        deleted['conversations_order'] = await safeDelete('conversations', 'order_id', importedOrderIds);
        deleted['fiscal_invoices'] = await safeDelete('fiscal_invoices', 'order_id', importedOrderIds);
        deleted['affiliate_conversions'] = await safeDelete('affiliate_conversions', 'order_id', importedOrderIds);

        // STEP 2: Delete orders
        deleted['orders'] = await safeDelete('orders', 'id', importedOrderIds);
      } else {
        deleted['orders'] = 0;
      }

      // Clean import_items for orders module
      const { count } = await supabase
        .from('import_items')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('module', 'orders');
      deleted['import_items_orders'] = count || 0;
    }

    // ========================================
    // Clear IMPORTED structure (menus, pages)
    // ========================================
    if (shouldClearAll || modules.includes('structure')) {
      const importedMenuIds = await getImportedIds('menus');
      const importedPageIds = await getImportedIds('pages');

      if (importedMenuIds.length > 0) {
        deleted['menu_items'] = await safeDelete('menu_items', 'menu_id', importedMenuIds);
        deleted['menus'] = await safeDelete('menus', 'id', importedMenuIds);
      }

      if (importedPageIds.length > 0) {
        deleted['store_page_templates'] = await safeDelete('store_page_templates', 'page_id', importedPageIds);
        deleted['store_pages'] = await safeDelete('store_pages', 'id', importedPageIds);
      }

      // Clean import_items for structure modules
      await supabase
        .from('import_items')
        .delete()
        .eq('tenant_id', tenantId)
        .in('module', ['menus', 'pages']);
    }

    // ========================================
    // Clean up import_jobs when clearing all
    // ========================================
    if (shouldClearAll) {
      const { count } = await supabase
        .from('import_jobs')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenantId);
      deleted['import_jobs'] = count || 0;
    }

    console.log('Clear completed:', deleted);
    if (errors.length > 0) {
      console.warn('Clear warnings:', errors);
    }

    return new Response(
      JSON.stringify({
        success: true,
        deleted,
        warnings: errors.length > 0 ? errors : undefined,
        message: 'Dados importados removidos com sucesso',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error clearing data:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao limpar dados',
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
