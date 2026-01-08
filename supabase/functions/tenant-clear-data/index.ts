import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ClearDataRequest {
  tenantId: string;
  modules: ('products' | 'categories' | 'customers' | 'orders' | 'all')[];
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

    console.log(`Starting data clear for tenant ${tenantId}, modules: ${modules.join(', ')}`);

    const deleted: Record<string, number> = {};
    const shouldClearAll = modules.includes('all');

    // Helper to delete and count
    const deleteAndCount = async (table: string, filter?: { column: string; value: string }) => {
      let query = supabase.from(table).delete();
      
      if (filter) {
        query = query.eq(filter.column, filter.value);
      }
      
      const { data, error } = await query.select('id');
      
      if (error) {
        console.error(`Error deleting from ${table}:`, error.message);
        return 0;
      }
      
      return data?.length || 0;
    };

    // Clear products and related tables
    if (shouldClearAll || modules.includes('products')) {
      // First, get all product IDs for this tenant
      const { data: productIds } = await supabase
        .from('products')
        .select('id')
        .eq('tenant_id', tenantId);

      const pIds = productIds?.map(p => p.id) || [];

      if (pIds.length > 0) {
        // Delete product_categories
        const { data: pcDeleted } = await supabase
          .from('product_categories')
          .delete()
          .in('product_id', pIds)
          .select('id');
        deleted['product_categories'] = pcDeleted?.length || 0;

        // Delete product_images
        const { data: piDeleted } = await supabase
          .from('product_images')
          .delete()
          .in('product_id', pIds)
          .select('id');
        deleted['product_images'] = piDeleted?.length || 0;

        // Delete product_variants
        const { data: pvDeleted } = await supabase
          .from('product_variants')
          .delete()
          .in('product_id', pIds)
          .select('id');
        deleted['product_variants'] = pvDeleted?.length || 0;

        // Delete cart_items with these products
        const { data: ciDeleted } = await supabase
          .from('cart_items')
          .delete()
          .in('product_id', pIds)
          .select('id');
        deleted['cart_items'] = ciDeleted?.length || 0;

        // Delete buy_together_rules
        const { data: bt1Deleted } = await supabase
          .from('buy_together_rules')
          .delete()
          .in('trigger_product_id', pIds)
          .select('id');
        const { data: bt2Deleted } = await supabase
          .from('buy_together_rules')
          .delete()
          .in('suggested_product_id', pIds)
          .select('id');
        deleted['buy_together_rules'] = (bt1Deleted?.length || 0) + (bt2Deleted?.length || 0);
      }

      // Delete products
      const { data: productsDeleted } = await supabase
        .from('products')
        .delete()
        .eq('tenant_id', tenantId)
        .select('id');
      deleted['products'] = productsDeleted?.length || 0;
    }

    // Clear categories
    if (shouldClearAll || modules.includes('categories')) {
      const { data: categoriesDeleted } = await supabase
        .from('categories')
        .delete()
        .eq('tenant_id', tenantId)
        .select('id');
      deleted['categories'] = categoriesDeleted?.length || 0;
    }

    // Clear customers and related tables
    if (shouldClearAll || modules.includes('customers')) {
      // Get all customer IDs for this tenant
      const { data: customerIds } = await supabase
        .from('customers')
        .select('id')
        .eq('tenant_id', tenantId);

      const cIds = customerIds?.map(c => c.id) || [];

      if (cIds.length > 0) {
        // Delete customer_addresses
        const { data: caDeleted } = await supabase
          .from('customer_addresses')
          .delete()
          .in('customer_id', cIds)
          .select('id');
        deleted['customer_addresses'] = caDeleted?.length || 0;

        // Delete customer_notes
        const { data: cnDeleted } = await supabase
          .from('customer_notes')
          .delete()
          .in('customer_id', cIds)
          .select('id');
        deleted['customer_notes'] = cnDeleted?.length || 0;

        // Delete customer_tag_assignments
        const { data: ctaDeleted } = await supabase
          .from('customer_tag_assignments')
          .delete()
          .in('customer_id', cIds)
          .select('id');
        deleted['customer_tag_assignments'] = ctaDeleted?.length || 0;

        // Delete customer_notifications
        const { data: notifDeleted } = await supabase
          .from('customer_notifications')
          .delete()
          .in('customer_id', cIds)
          .select('id');
        deleted['customer_notifications'] = notifDeleted?.length || 0;
      }

      // Delete customers
      const { data: customersDeleted } = await supabase
        .from('customers')
        .delete()
        .eq('tenant_id', tenantId)
        .select('id');
      deleted['customers'] = customersDeleted?.length || 0;
    }

    // Clear orders and related tables
    if (shouldClearAll || modules.includes('orders')) {
      // Get all order IDs for this tenant
      const { data: orderIds } = await supabase
        .from('orders')
        .select('id')
        .eq('tenant_id', tenantId);

      const oIds = orderIds?.map(o => o.id) || [];

      if (oIds.length > 0) {
        // Delete order_items
        const { data: oiDeleted } = await supabase
          .from('order_items')
          .delete()
          .in('order_id', oIds)
          .select('id');
        deleted['order_items'] = oiDeleted?.length || 0;

        // Delete order_history
        const { data: ohDeleted } = await supabase
          .from('order_history')
          .delete()
          .in('order_id', oIds)
          .select('id');
        deleted['order_history'] = ohDeleted?.length || 0;
      }

      // Delete orders
      const { data: ordersDeleted } = await supabase
        .from('orders')
        .delete()
        .eq('tenant_id', tenantId)
        .select('id');
      deleted['orders'] = ordersDeleted?.length || 0;
    }

    // Clear import jobs
    if (shouldClearAll) {
      const { data: importJobsDeleted } = await supabase
        .from('import_jobs')
        .delete()
        .eq('tenant_id', tenantId)
        .select('id');
      deleted['import_jobs'] = importJobsDeleted?.length || 0;
    }

    console.log('Data clear completed:', deleted);

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
