// ============================================
// STOREFRONT BOOTSTRAP - Single-request storefront data loader
// v1.0.0: Bundles tenant, settings, menus, categories, and template in one call
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// ===== VERSION =====
const VERSION = "v1.0.0"; // Initial: single-request bootstrap for storefront
// ====================

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[storefront-bootstrap][${VERSION}] Request received`);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let body: { tenant_slug?: string; tenant_id?: string; include_products?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // defaults
    }

    const { tenant_slug, tenant_id: directTenantId, include_products = false } = body;

    if (!tenant_slug && !directTenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_slug ou tenant_id obrigatório' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 1. Resolve tenant
    let tenantId = directTenantId;
    let tenant: any = null;

    if (tenant_slug && !tenantId) {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name, slug, logo_url')
        .eq('slug', tenant_slug)
        .maybeSingle();

      if (error || !data) {
        return new Response(
          JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      tenant = data;
      tenantId = data.id;
    } else if (tenantId) {
      const { data } = await supabase
        .from('tenants')
        .select('id, name, slug, logo_url')
        .eq('id', tenantId)
        .maybeSingle();
      tenant = data;
    }

    if (!tenantId || !tenant) {
      return new Response(
        JSON.stringify({ success: false, error: 'Tenant não encontrado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 2. Run ALL queries in parallel via Promise.allSettled
    const parallelStart = Date.now();

    const queries: Promise<any>[] = [
      // Q1: Store settings
      supabase
        .from('store_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      
      // Q2: Header menu + items
      supabase
        .from('menus')
        .select('*, menu_items(*)')
        .eq('tenant_id', tenantId)
        .eq('location', 'header')
        .maybeSingle(),
      
      // Q3: Footer menu + items (footer_1 with legacy 'footer' fallback)
      supabase
        .from('menus')
        .select('*, menu_items(*)')
        .eq('tenant_id', tenantId)
        .in('location', ['footer', 'footer_1'])
        .maybeSingle(),
      
      // Q4: Active categories
      supabase
        .from('categories')
        .select('id, name, slug, description, is_active, sort_order, parent_id, image_url')
        .eq('tenant_id', tenantId)
        .eq('is_active', true)
        .order('sort_order'),
      
      // Q5: Published template set
      supabase
        .from('storefront_template_sets')
        .select('id, published_content, is_published, base_preset')
        .eq('tenant_id', tenantId)
        .eq('is_published', true)
        .maybeSingle(),
      
      // Q6: Custom domain (primary)
      supabase
        .from('tenant_domains')
        .select('domain')
        .eq('tenant_id', tenantId)
        .eq('type', 'custom')
        .eq('is_primary', true)
        .eq('status', 'verified')
        .eq('ssl_status', 'active')
        .maybeSingle(),
    ];

    // Optional: Include products (for home page initial render)
    if (include_products) {
      queries.push(
        supabase
          .from('products')
          .select('id, name, slug, price, compare_at_price, status, product_images(url, is_primary, alt_text, position)')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(50)
      );
    }

    const results = await Promise.allSettled(queries);
    const parallelDuration = Date.now() - parallelStart;

    console.log(`[storefront-bootstrap] ${results.length} queries completed in ${parallelDuration}ms`);

    // Extract results safely
    const getResult = (index: number) => {
      const r = results[index];
      if (r.status === 'fulfilled') {
        if (r.value.error) {
          console.error(`[storefront-bootstrap] Query ${index} supabase error:`, JSON.stringify(r.value.error));
        }
        return r.value.data;
      }
      console.error(`[storefront-bootstrap] Query ${index} failed:`, r.reason);
      return null;
    };

    const storeSettings = getResult(0);
    const headerMenuRaw = getResult(1);
    const footerMenuRaw = getResult(2);
    const categories = getResult(3);
    const templateSet = getResult(4);
    const customDomainRow = getResult(5);
    const products = include_products ? getResult(6) : undefined;

    // Format menus
    const formatMenu = (raw: any) => {
      if (!raw) return { menu: null, items: [] };
      const { menu_items, ...menu } = raw;
      return {
        menu,
        items: (menu_items || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      };
    };

    const response = {
      success: true,
      tenant,
      store_settings: storeSettings,
      header_menu: formatMenu(headerMenuRaw),
      footer_menu: formatMenu(footerMenuRaw),
      categories: categories || [],
      template: templateSet,
      custom_domain: customDomainRow?.domain || null,
      is_published: storeSettings?.is_published ?? false,
      ...(include_products ? { products: products || [] } : {}),
      _meta: {
        query_count: results.length,
        query_duration_ms: parallelDuration,
        version: VERSION,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=120',
      },
    });

  } catch (error) {
    console.error('[storefront-bootstrap] Fatal error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Erro interno' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
