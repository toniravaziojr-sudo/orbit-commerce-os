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

    // ========================================
    // Clear IMPORTED products and related tables
    // ========================================
    if (shouldClearAll || modules.includes('products')) {
      const importedProductIds = await getImportedIds('products');
      console.log(`Found ${importedProductIds.length} imported products to delete`);

      if (importedProductIds.length > 0) {
        const { data: pcDeleted } = await supabase
          .from('product_categories')
          .delete()
          .in('product_id', importedProductIds)
          .select('id');
        deleted['product_categories'] = pcDeleted?.length || 0;

        const { data: piDeleted } = await supabase
          .from('product_images')
          .delete()
          .in('product_id', importedProductIds)
          .select('id');
        deleted['product_images'] = piDeleted?.length || 0;

        const { data: pvDeleted } = await supabase
          .from('product_variants')
          .delete()
          .in('product_id', importedProductIds)
          .select('id');
        deleted['product_variants'] = pvDeleted?.length || 0;

        const { data: ciDeleted } = await supabase
          .from('cart_items')
          .delete()
          .in('product_id', importedProductIds)
          .select('id');
        deleted['cart_items'] = ciDeleted?.length || 0;

        const { data: bt1Deleted } = await supabase
          .from('buy_together_rules')
          .delete()
          .in('trigger_product_id', importedProductIds)
          .select('id');
        const { data: bt2Deleted } = await supabase
          .from('buy_together_rules')
          .delete()
          .in('suggested_product_id', importedProductIds)
          .select('id');
        deleted['buy_together_rules'] = (bt1Deleted?.length || 0) + (bt2Deleted?.length || 0);

        const { data: productsDeleted } = await supabase
          .from('products')
          .delete()
          .in('id', importedProductIds)
          .select('id');
        deleted['products'] = productsDeleted?.length || 0;
      } else {
        deleted['products'] = 0;
      }

      const { data: importItemsDeleted } = await supabase
        .from('import_items')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('module', 'products')
        .select('id');
      deleted['import_items_products'] = importItemsDeleted?.length || 0;
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
        const { error: pcError, count: pcCount } = await supabase
          .from('product_categories')
          .delete({ count: 'exact' })
          .in('category_id', importedCategoryIds);
        
        if (pcError) {
          console.error('Error deleting product_categories:', pcError);
        }
        deleted['product_categories_from_categories'] = pcCount || 0;

        // STEP 2: Then delete categories
        const { error: catError, count: catCount } = await supabase
          .from('categories')
          .delete({ count: 'exact' })
          .in('id', importedCategoryIds);
        
        if (catError) {
          console.error('Error deleting categories:', catError);
        }
        deleted['categories'] = catCount || 0;
      } else {
        deleted['categories'] = 0;
        deleted['product_categories_from_categories'] = 0;
      }

      // STEP 3: Delete import_items for categories module
      const { count: importItemsCount } = await supabase
        .from('import_items')
        .delete({ count: 'exact' })
        .eq('tenant_id', tenantId)
        .eq('module', 'categories');
      deleted['import_items_categories'] = importItemsCount || 0;
    }

    // ========================================
    // Clear IMPORTED customers and related tables
    // ========================================
    if (shouldClearAll || modules.includes('customers')) {
      const importedCustomerIds = await getImportedIds('customers');
      console.log(`Found ${importedCustomerIds.length} imported customers to delete`);

      if (importedCustomerIds.length > 0) {
        const { data: caDeleted } = await supabase
          .from('customer_addresses')
          .delete()
          .in('customer_id', importedCustomerIds)
          .select('id');
        deleted['customer_addresses'] = caDeleted?.length || 0;

        const { data: cnDeleted } = await supabase
          .from('customer_notes')
          .delete()
          .in('customer_id', importedCustomerIds)
          .select('id');
        deleted['customer_notes'] = cnDeleted?.length || 0;

        const { data: ctaDeleted } = await supabase
          .from('customer_tag_assignments')
          .delete()
          .in('customer_id', importedCustomerIds)
          .select('id');
        deleted['customer_tag_assignments'] = ctaDeleted?.length || 0;

        const { data: notifDeleted } = await supabase
          .from('customer_notifications')
          .delete()
          .in('customer_id', importedCustomerIds)
          .select('id');
        deleted['customer_notifications'] = notifDeleted?.length || 0;

        const { data: customersDeleted } = await supabase
          .from('customers')
          .delete()
          .in('id', importedCustomerIds)
          .select('id');
        deleted['customers'] = customersDeleted?.length || 0;
      } else {
        deleted['customers'] = 0;
      }

      const { data: importItemsDeleted } = await supabase
        .from('import_items')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('module', 'customers')
        .select('id');
      deleted['import_items_customers'] = importItemsDeleted?.length || 0;
    }

    // ========================================
    // Clear IMPORTED orders and related tables
    // ========================================
    if (shouldClearAll || modules.includes('orders')) {
      const importedOrderIds = await getImportedIds('orders');
      console.log(`Found ${importedOrderIds.length} imported orders to delete`);

      if (importedOrderIds.length > 0) {
        const { data: oiDeleted } = await supabase
          .from('order_items')
          .delete()
          .in('order_id', importedOrderIds)
          .select('id');
        deleted['order_items'] = oiDeleted?.length || 0;

        const { data: ohDeleted } = await supabase
          .from('order_history')
          .delete()
          .in('order_id', importedOrderIds)
          .select('id');
        deleted['order_history'] = ohDeleted?.length || 0;

        const { data: ordersDeleted } = await supabase
          .from('orders')
          .delete()
          .in('id', importedOrderIds)
          .select('id');
        deleted['orders'] = ordersDeleted?.length || 0;
      } else {
        deleted['orders'] = 0;
      }

      const { data: importItemsDeleted } = await supabase
        .from('import_items')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('module', 'orders')
        .select('id');
      deleted['import_items_orders'] = importItemsDeleted?.length || 0;
    }

    // ========================================
    // Clear IMPORTED structure (menus, pages)
    // ========================================
    if (shouldClearAll || modules.includes('structure')) {
      const { data: structureJobs } = await supabase
        .from('import_jobs')
        .select('id')
        .eq('tenant_id', tenantId)
        .contains('modules', ['structure']);

      if (structureJobs && structureJobs.length > 0) {
        const importedMenuIds = await getImportedIds('menus');
        const importedPageIds = await getImportedIds('pages');

        if (importedMenuIds.length > 0) {
          const { data: menuItemsDeleted } = await supabase
            .from('menu_items')
            .delete()
            .in('menu_id', importedMenuIds)
            .select('id');
          deleted['menu_items'] = menuItemsDeleted?.length || 0;

          const { data: menusDeleted } = await supabase
            .from('menus')
            .delete()
            .in('id', importedMenuIds)
            .select('id');
          deleted['menus'] = menusDeleted?.length || 0;
        }

        if (importedPageIds.length > 0) {
          const { data: templatesDeleted } = await supabase
            .from('store_page_templates')
            .delete()
            .in('page_id', importedPageIds)
            .select('id');
          deleted['store_page_templates'] = templatesDeleted?.length || 0;

          const { data: pagesDeleted } = await supabase
            .from('store_pages')
            .delete()
            .in('id', importedPageIds)
            .select('id');
          deleted['store_pages'] = pagesDeleted?.length || 0;
        }

        await supabase
          .from('import_items')
          .delete()
          .eq('tenant_id', tenantId)
          .in('module', ['menus', 'pages']);
      }
    }

    // ========================================
    // Clean up import_jobs
    // ========================================
    if (shouldClearAll) {
      const { data: jobsDeleted } = await supabase
        .from('import_jobs')
        .delete()
        .eq('tenant_id', tenantId)
        .select('id');
      deleted['import_jobs'] = jobsDeleted?.length || 0;
    }

    console.log('Clear completed:', deleted);

    return new Response(
      JSON.stringify({
        success: true,
        deleted,
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
