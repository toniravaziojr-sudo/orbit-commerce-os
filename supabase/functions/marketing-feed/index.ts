import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function escapeCsv(str: string): string {
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tenantSlug = url.searchParams.get('tenant');
    const format = url.searchParams.get('format') || 'google'; // google, meta, csv
    
    if (!tenantSlug) {
      return new Response('Missing tenant parameter', { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get tenant by slug
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('id, slug, name')
      .eq('slug', tenantSlug)
      .single();

    if (tenantError || !tenant) {
      return new Response('Tenant not found', { status: 404 });
    }

    // Get canonical domain for the tenant
    const { data: domains } = await supabase
      .from('tenant_domains')
      .select('hostname, is_primary, status, ssl_active')
      .eq('tenant_id', tenant.id)
      .eq('status', 'verified')
      .order('is_primary', { ascending: false });

    let baseUrl = `https://${tenant.slug}.shops.comandocentral.com.br`;
    
    // Check for custom domain
    const customDomain = domains?.find(d => 
      d.ssl_active && 
      d.status === 'verified' && 
      !d.hostname.includes('.shops.')
    );
    
    if (customDomain) {
      baseUrl = `https://${customDomain.hostname}`;
    }

    // Get store settings for brand name
    const { data: storeSettings } = await supabase
      .from('store_settings')
      .select('store_name, default_currency')
      .eq('tenant_id', tenant.id)
      .single();

    const storeName = storeSettings?.store_name || tenant.name;
    const currency = storeSettings?.default_currency || 'BRL';

    // Get products
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select(`
        id,
        name,
        slug,
        description,
        price,
        compare_at_price,
        sku,
        stock_quantity,
        is_active,
        brand,
        images,
        weight,
        categories:product_categories(
          category:categories(name, slug)
        )
      `)
      .eq('tenant_id', tenant.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (productsError) {
      console.error('Products error:', productsError);
      return new Response('Error fetching products', { status: 500 });
    }

    const now = new Date().toISOString();

    // Update feed status
    await supabase.from('product_feed_status').upsert({
      tenant_id: tenant.id,
      provider: format === 'meta' ? 'meta' : 'google',
      last_generated_at: now,
      product_count: products?.length || 0,
      status: 'success',
    }, { onConflict: 'tenant_id,provider' });

    if (format === 'csv' || format === 'meta') {
      // Meta Catalog CSV format
      const headers = ['id', 'title', 'description', 'availability', 'condition', 'price', 'link', 'image_link', 'brand', 'google_product_category'];
      
      let csv = headers.join(',') + '\n';
      
      for (const product of products || []) {
        const availability = (product.stock_quantity ?? 0) > 0 ? 'in stock' : 'out of stock';
        const imageUrl = product.images?.[0] || '';
        const productUrl = `${baseUrl}/produto/${product.slug}`;
        const priceFormatted = `${(product.price || 0).toFixed(2)} ${currency}`;
      const categoryData = product.categories?.[0]?.category as { name?: string; slug?: string } | undefined;
      const categoryName = categoryData?.name || '';
        
        const row = [
          escapeCsv(product.id),
          escapeCsv(product.name || ''),
          escapeCsv((product.description || '').replace(/\n/g, ' ').substring(0, 5000)),
          availability,
          'new',
          priceFormatted,
          productUrl,
          imageUrl,
          escapeCsv(product.brand || storeName),
          escapeCsv(categoryName),
        ];
        
        csv += row.join(',') + '\n';
      }

      return new Response(csv, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="${tenant.slug}-catalog.csv"`,
        },
      });
    }

    // Google Merchant XML format
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>${escapeXml(storeName)}</title>
<link>${baseUrl}</link>
<description>Product feed for ${escapeXml(storeName)}</description>
`;

    for (const product of products || []) {
      const availability = (product.stock_quantity ?? 0) > 0 ? 'in_stock' : 'out_of_stock';
      const imageUrl = product.images?.[0] || '';
      const productUrl = `${baseUrl}/produto/${product.slug}`;
      const catData = product.categories?.[0]?.category as { name?: string; slug?: string } | undefined;
      const categoryName = catData?.name || '';

      xml += `<item>
<g:id>${escapeXml(product.id)}</g:id>
<g:title>${escapeXml(product.name || '')}</g:title>
<g:description>${escapeXml((product.description || '').replace(/\n/g, ' ').substring(0, 5000))}</g:description>
<g:link>${productUrl}</g:link>
<g:image_link>${escapeXml(imageUrl)}</g:image_link>
<g:availability>${availability}</g:availability>
<g:price>${(product.price || 0).toFixed(2)} ${currency}</g:price>
${product.compare_at_price ? `<g:sale_price>${(product.price || 0).toFixed(2)} ${currency}</g:sale_price>` : ''}
<g:brand>${escapeXml(product.brand || storeName)}</g:brand>
<g:condition>new</g:condition>
<g:identifier_exists>false</g:identifier_exists>
${product.sku ? `<g:gtin>${escapeXml(product.sku)}</g:gtin>` : ''}
${categoryName ? `<g:google_product_category>${escapeXml(categoryName)}</g:google_product_category>` : ''}
${product.weight ? `<g:shipping_weight>${product.weight} kg</g:shipping_weight>` : ''}
</item>
`;
    }

    xml += `</channel>
</rss>`;

    return new Response(xml, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/xml; charset=utf-8',
      },
    });

  } catch (error) {
    console.error('[marketing-feed] Exception:', error);
    return new Response('Internal server error', { status: 500 });
  }
});
