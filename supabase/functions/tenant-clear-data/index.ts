import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClearDataRequest {
  tenantId: string;
  modules: ('products' | 'categories' | 'customers' | 'orders' | 'structure' | 'visual' | 'storefront' | 'all')[];
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

    // ========================================
    // Helper: Get imported item IDs from import_items table
    // This ensures we ONLY delete imported items, not manually created ones
    // ========================================
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
      // Get only imported product IDs
      const importedProductIds = await getImportedIds('products');
      console.log(`Found ${importedProductIds.length} imported products to delete`);

      if (importedProductIds.length > 0) {
        // Delete product_categories for imported products
        const { data: pcDeleted } = await supabase
          .from('product_categories')
          .delete()
          .in('product_id', importedProductIds)
          .select('id');
        deleted['product_categories'] = pcDeleted?.length || 0;

        // Delete product_images for imported products
        const { data: piDeleted } = await supabase
          .from('product_images')
          .delete()
          .in('product_id', importedProductIds)
          .select('id');
        deleted['product_images'] = piDeleted?.length || 0;

        // Delete product_variants for imported products
        const { data: pvDeleted } = await supabase
          .from('product_variants')
          .delete()
          .in('product_id', importedProductIds)
          .select('id');
        deleted['product_variants'] = pvDeleted?.length || 0;

        // Delete cart_items with imported products
        const { data: ciDeleted } = await supabase
          .from('cart_items')
          .delete()
          .in('product_id', importedProductIds)
          .select('id');
        deleted['cart_items'] = ciDeleted?.length || 0;

        // Delete buy_together_rules for imported products
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

        // Delete imported products
        const { data: productsDeleted } = await supabase
          .from('products')
          .delete()
          .in('id', importedProductIds)
          .select('id');
        deleted['products'] = productsDeleted?.length || 0;
      } else {
        deleted['products'] = 0;
      }

      // Clean up import_items for products
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
    // ========================================
    if (shouldClearAll || modules.includes('categories')) {
      const importedCategoryIds = await getImportedIds('categories');
      console.log(`Found ${importedCategoryIds.length} imported categories to delete`);

      if (importedCategoryIds.length > 0) {
        const { data: categoriesDeleted } = await supabase
          .from('categories')
          .delete()
          .in('id', importedCategoryIds)
          .select('id');
        deleted['categories'] = categoriesDeleted?.length || 0;
      } else {
        deleted['categories'] = 0;
      }

      // Clean up import_items for categories
      const { data: importItemsDeleted } = await supabase
        .from('import_items')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('module', 'categories')
        .select('id');
      deleted['import_items_categories'] = importItemsDeleted?.length || 0;
    }

    // ========================================
    // Clear IMPORTED customers and related tables
    // ========================================
    if (shouldClearAll || modules.includes('customers')) {
      const importedCustomerIds = await getImportedIds('customers');
      console.log(`Found ${importedCustomerIds.length} imported customers to delete`);

      if (importedCustomerIds.length > 0) {
        // Delete customer_addresses for imported customers
        const { data: caDeleted } = await supabase
          .from('customer_addresses')
          .delete()
          .in('customer_id', importedCustomerIds)
          .select('id');
        deleted['customer_addresses'] = caDeleted?.length || 0;

        // Delete customer_notes for imported customers
        const { data: cnDeleted } = await supabase
          .from('customer_notes')
          .delete()
          .in('customer_id', importedCustomerIds)
          .select('id');
        deleted['customer_notes'] = cnDeleted?.length || 0;

        // Delete customer_tag_assignments for imported customers
        const { data: ctaDeleted } = await supabase
          .from('customer_tag_assignments')
          .delete()
          .in('customer_id', importedCustomerIds)
          .select('id');
        deleted['customer_tag_assignments'] = ctaDeleted?.length || 0;

        // Delete customer_notifications for imported customers
        const { data: notifDeleted } = await supabase
          .from('customer_notifications')
          .delete()
          .in('customer_id', importedCustomerIds)
          .select('id');
        deleted['customer_notifications'] = notifDeleted?.length || 0;

        // Delete imported customers
        const { data: customersDeleted } = await supabase
          .from('customers')
          .delete()
          .in('id', importedCustomerIds)
          .select('id');
        deleted['customers'] = customersDeleted?.length || 0;
      } else {
        deleted['customers'] = 0;
      }

      // Clean up import_items for customers
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
        // Delete order_items for imported orders
        const { data: oiDeleted } = await supabase
          .from('order_items')
          .delete()
          .in('order_id', importedOrderIds)
          .select('id');
        deleted['order_items'] = oiDeleted?.length || 0;

        // Delete order_history for imported orders
        const { data: ohDeleted } = await supabase
          .from('order_history')
          .delete()
          .in('order_id', importedOrderIds)
          .select('id');
        deleted['order_history'] = ohDeleted?.length || 0;

        // Delete imported orders
        const { data: ordersDeleted } = await supabase
          .from('orders')
          .delete()
          .in('id', importedOrderIds)
          .select('id');
        deleted['orders'] = ordersDeleted?.length || 0;
      } else {
        deleted['orders'] = 0;
      }

      // Clean up import_items for orders
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
    // Note: Structure imports are tracked via import_jobs, not import_items
    // We delete only items that have source indicators
    // ========================================
    if (shouldClearAll || modules.includes('structure')) {
      // Check if there was a structure import job
      const { data: structureJobs } = await supabase
        .from('import_jobs')
        .select('id')
        .eq('tenant_id', tenantId)
        .contains('modules', ['structure']);

      if (structureJobs && structureJobs.length > 0) {
        // Get imported menu IDs from import_items
        const importedMenuIds = await getImportedIds('menus');
        const importedPageIds = await getImportedIds('pages');

        if (importedMenuIds.length > 0) {
          // Delete menu_items for imported menus
          const { data: menuItemsDeleted } = await supabase
            .from('menu_items')
            .delete()
            .in('menu_id', importedMenuIds)
            .select('id');
          deleted['menu_items'] = menuItemsDeleted?.length || 0;

          // Delete imported menus
          const { data: menusDeleted } = await supabase
            .from('menus')
            .delete()
            .in('id', importedMenuIds)
            .select('id');
          deleted['menus'] = menusDeleted?.length || 0;
        }

        if (importedPageIds.length > 0) {
          // Delete templates for imported pages
          const { data: templatesDeleted } = await supabase
            .from('store_page_templates')
            .delete()
            .in('page_id', importedPageIds)
            .select('id');
          deleted['store_page_templates'] = templatesDeleted?.length || 0;

          // Delete imported pages
          const { data: pagesDeleted } = await supabase
            .from('store_pages')
            .delete()
            .in('id', importedPageIds)
            .select('id');
          deleted['store_pages'] = pagesDeleted?.length || 0;
        }

        // Clean up import_items for structure
        await supabase
          .from('import_items')
          .delete()
          .eq('tenant_id', tenantId)
          .in('module', ['menus', 'pages']);
      }

      // Delete imported blog_posts (if tracked)
      const importedBlogIds = await getImportedIds('blog_posts');
      if (importedBlogIds.length > 0) {
        const { data: blogPostsDeleted } = await supabase
          .from('blog_posts')
          .delete()
          .in('id', importedBlogIds)
          .select('id');
        deleted['blog_posts'] = blogPostsDeleted?.length || 0;
      }
    }

    // ========================================
    // Clear IMPORTED storefront (builder templates)
    // Only delete templates that came from import
    // ========================================
    if (shouldClearAll || modules.includes('storefront')) {
      // Check if there was a storefront/visual import job
      const { data: storefrontJobs } = await supabase
        .from('import_jobs')
        .select('id, created_at')
        .eq('tenant_id', tenantId)
        .or('modules.cs.{storefront},modules.cs.{visual},modules.cs.{structure}');

      if (storefrontJobs && storefrontJobs.length > 0) {
        // Get the earliest import job date
        const earliestImport = storefrontJobs
          .map(j => new Date(j.created_at))
          .sort((a, b) => a.getTime() - b.getTime())[0];

        // Delete storefront_page_templates created after the first import
        // This is a safe heuristic: imported templates are created during/after import
        const { data: templatesDeleted } = await supabase
          .from('storefront_page_templates')
          .delete()
          .eq('tenant_id', tenantId)
          .gte('created_at', earliestImport.toISOString())
          .select('id');
        deleted['storefront_page_templates'] = templatesDeleted?.length || 0;

        // Delete store_page_versions from imports
        const { data: versionsDeleted } = await supabase
          .from('store_page_versions')
          .delete()
          .eq('tenant_id', tenantId)
          .gte('created_at', earliestImport.toISOString())
          .select('id');
        deleted['store_page_versions'] = versionsDeleted?.length || 0;
      } else {
        deleted['storefront_page_templates'] = 0;
        deleted['store_page_versions'] = 0;
      }
    }

    // ========================================
    // Clear IMPORTED visual (store_settings from import only)
    // Reset only fields that were set during import
    // ========================================
    if (shouldClearAll || modules.includes('visual')) {
      // Check if there was a visual import job
      const { data: visualJobs } = await supabase
        .from('import_jobs')
        .select('id')
        .eq('tenant_id', tenantId)
        .contains('modules', ['visual']);

      if (visualJobs && visualJobs.length > 0) {
        // Get current store_settings to find imported files to delete
        const { data: storeSettings } = await supabase
          .from('store_settings')
          .select('logo_url, favicon_url')
          .eq('tenant_id', tenantId)
          .single();

        // Delete imported files from storage (only in imports/ folder)
        const { data: storedFiles } = await supabase
          .storage
          .from('store-assets')
          .list(`${tenantId}/imports`);

        if (storedFiles && storedFiles.length > 0) {
          const allFilePaths = storedFiles.map(f => `${tenantId}/imports/${f.name}`);
          const { error: storageError } = await supabase
            .storage
            .from('store-assets')
            .remove(allFilePaths);
          
          if (!storageError) {
            deleted['storage_files'] = allFilePaths.length;
          } else {
            console.error('Error deleting storage files:', storageError);
          }
        }

        // Reset store_settings visual fields that were imported
        // Only reset if logo/favicon are from imports folder
        const updateFields: Record<string, any> = {
          updated_at: new Date().toISOString()
        };

        if (storeSettings?.logo_url?.includes('/imports/')) {
          updateFields.logo_url = null;
        }
        if (storeSettings?.favicon_url?.includes('/imports/')) {
          updateFields.favicon_url = null;
        }

        // Reset colors and social links that were set during import
        // These can be identified by checking import_jobs metadata
        const { data: visualJobDetails } = await supabase
          .from('import_jobs')
          .select('stats')
          .eq('tenant_id', tenantId)
          .contains('modules', ['visual'])
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (visualJobDetails?.stats?.visual?.imported_fields) {
          const importedFields = visualJobDetails.stats.visual.imported_fields;
          importedFields.forEach((field: string) => {
            updateFields[field] = null;
          });
        }

        if (Object.keys(updateFields).length > 1) {
          const { error: settingsError } = await supabase
            .from('store_settings')
            .update(updateFields)
            .eq('tenant_id', tenantId);
          
          if (!settingsError) {
            deleted['store_settings_reset'] = Object.keys(updateFields).length - 1; // minus updated_at
          }
        }

        // Delete imported homepage_blocks
        const { data: homepageBlocksDeleted } = await supabase
          .from('homepage_blocks')
          .delete()
          .eq('tenant_id', tenantId)
          .select('id');
        deleted['homepage_blocks'] = homepageBlocksDeleted?.length || 0;
      }
    }

    // ========================================
    // Clear import jobs (always when clearing all, or when explicitly requested)
    // ========================================
    if (shouldClearAll) {
      const { data: importJobsDeleted } = await supabase
        .from('import_jobs')
        .delete()
        .eq('tenant_id', tenantId)
        .select('id');
      deleted['import_jobs'] = importJobsDeleted?.length || 0;
    }

    console.log('Imported data clear completed:', deleted);

    return new Response(
      JSON.stringify({ success: true, deleted }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Clear data error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
