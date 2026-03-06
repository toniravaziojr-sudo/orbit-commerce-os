// ============================================
// STOREFRONT BOOTSTRAP - Single-request storefront data loader
// v4.0.0: Accepts hostname for unified resolve+bootstrap (eliminates 1 roundtrip)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { resolveTenantFromHostname } from '../_shared/resolveTenant.ts';

// ===== VERSION =====
const VERSION = "v4.0.0"; // Unified resolve-domain + bootstrap
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

    let body: { 
      tenant_slug?: string; 
      tenant_id?: string; 
      hostname?: string;
      include_products?: boolean;
    } = {};
    try {
      body = await req.json();
    } catch {
      // defaults
    }

    const { tenant_slug, tenant_id: directTenantId, hostname, include_products = false } = body;

    // === STEP 1: Resolve tenant ===
    let tenantId = directTenantId;
    let tenant: any = null;
    let resolvedDomain: any = null;

    if (hostname && !tenant_slug && !directTenantId) {
      // NEW: Resolve from hostname (unified flow — eliminates resolve-domain call)
      const resolveResult = await resolveTenantFromHostname(supabase, hostname);
      
      if (!resolveResult.found) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: 'Tenant não encontrado para este domínio',
            resolve_error: resolveResult.error || null,
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      tenantId = resolveResult.tenant_id;
      resolvedDomain = {
        tenant_slug: resolveResult.tenant_slug,
        tenant_id: resolveResult.tenant_id,
        domain_type: resolveResult.domain_type,
        canonical_origin: resolveResult.canonical_origin,
        primary_public_host: resolveResult.primary_public_host,
        is_primary: resolveResult.is_primary,
        has_custom_primary: resolveResult.has_custom_primary,
      };

      // Fetch full tenant data
      const { data } = await supabase
        .from('tenants')
        .select('id, name, slug, logo_url')
        .eq('id', tenantId)
        .maybeSingle();
      tenant = data;

    } else if (tenant_slug && !tenantId) {
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

    // === STEP 2: Run ALL queries in parallel ===
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
      
      // Q6: Custom domain (primary) — skip if already resolved from hostname
      resolvedDomain
        ? Promise.resolve({ data: resolvedDomain.has_custom_primary ? { domain: resolvedDomain.primary_public_host } : null, error: null })
        : supabase
            .from('tenant_domains')
            .select('domain')
            .eq('tenant_id', tenantId)
            .eq('type', 'custom')
            .eq('is_primary', true)
            .eq('status', 'verified')
            .eq('ssl_status', 'active')
            .maybeSingle(),
      
      // Q7: Global layout
      supabase
        .from('storefront_global_layout')
        .select('published_header_config, published_footer_config, published_checkout_header_config, published_checkout_footer_config, header_config, footer_config, checkout_header_config, checkout_footer_config, header_enabled, footer_enabled, show_footer_1, show_footer_2')
        .eq('tenant_id', tenantId)
        .maybeSingle(),
      
      // Q8: Page overrides
      supabase
        .from('storefront_page_templates')
        .select('page_type, page_overrides')
        .eq('tenant_id', tenantId)
        .in('page_type', ['category', 'product', 'cart', 'checkout', 'home']),

      // Q9: Published store pages
      supabase
        .from('store_pages')
        .select('id, slug, type')
        .eq('tenant_id', tenantId)
        .eq('is_published', true),

      // Q10: Footer 2 menu + items
      supabase
        .from('menus')
        .select('*, menu_items(*)')
        .eq('tenant_id', tenantId)
        .eq('location', 'footer_2')
        .maybeSingle(),
    ];

    // Optional: Include products
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
    const globalLayoutRaw = getResult(6);
    const pageOverridesRaw = getResult(7);
    const storePages = getResult(8);
    const footer2MenuRaw = getResult(9);
    const products = include_products ? getResult(10) : undefined;

    // Format menus
    const formatMenu = (raw: any) => {
      if (!raw) return { menu: null, items: [] };
      const { menu_items, ...menu } = raw;
      return {
        menu,
        items: (menu_items || []).sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
      };
    };

    // Format global layout
    const globalLayout = globalLayoutRaw ? {
      header_config: globalLayoutRaw.published_header_config || globalLayoutRaw.header_config || null,
      footer_config: globalLayoutRaw.published_footer_config || globalLayoutRaw.footer_config || null,
      checkout_header_config: globalLayoutRaw.published_checkout_header_config || globalLayoutRaw.checkout_header_config || null,
      checkout_footer_config: globalLayoutRaw.published_checkout_footer_config || globalLayoutRaw.checkout_footer_config || null,
      header_enabled: globalLayoutRaw.header_enabled ?? true,
      footer_enabled: globalLayoutRaw.footer_enabled ?? true,
      show_footer_1: globalLayoutRaw.show_footer_1 ?? true,
      show_footer_2: globalLayoutRaw.show_footer_2 ?? true,
    } : null;

    // Format page overrides
    const pageOverrides: Record<string, any> = {};
    if (Array.isArray(pageOverridesRaw)) {
      for (const row of pageOverridesRaw) {
        if (row.page_type && row.page_overrides) {
          pageOverrides[row.page_type] = row.page_overrides;
        }
      }
    }

    // Extract categorySettings from template
    let categorySettings = null;
    if (templateSet?.published_content) {
      const content = templateSet.published_content as Record<string, any>;
      const themeSettings = content?.themeSettings as Record<string, any> | undefined;
      const pageSettings = themeSettings?.pageSettings as Record<string, any> | undefined;
      categorySettings = pageSettings?.category || null;
    }

    const response = {
      success: true,
      tenant,
      store_settings: storeSettings,
      header_menu: formatMenu(headerMenuRaw),
      footer_menu: formatMenu(footerMenuRaw),
      footer_2_menu: formatMenu(footer2MenuRaw),
      categories: categories || [],
      template: templateSet,
      custom_domain: customDomainRow?.domain || null,
      is_published: storeSettings?.is_published ?? false,
      global_layout: globalLayout,
      page_overrides: pageOverrides,
      category_settings: categorySettings,
      pages: storePages || [],
      // Include resolved domain info when hostname was used
      ...(resolvedDomain ? { resolved_domain: resolvedDomain } : {}),
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
