import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ScrapedProduct {
  name: string;
  slug: string;
  price: number;
  compareAtPrice?: number;
  description: string;
  imageUrl: string;
}

function parsePrice(priceStr: string): number {
  const cleaned = priceStr.replace(/[^\d,]/g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

function extractProductsFromHTML(html: string): ScrapedProduct[] {
  const products: ScrapedProduct[] = [];
  
  // Normalize HTML - remove newlines and extra spaces
  const normalizedHtml = html.replace(/\n/g, ' ').replace(/\s+/g, ' ');
  
  // Split by product-card divs - more flexible pattern
  const productSections = normalizedHtml.split(/product-card\s+slideUp"\s+data-product-id="/);
  
  console.log(`Found ${productSections.length - 1} product sections`);
  
  for (let i = 1; i < productSections.length; i++) {
    const section = productSections[i];
    
    try {
      // Extract product URL and name - look for the products/ URL pattern
      const linkMatch = section.match(/href="https:\/\/www\.respeiteohomem\.com\.br\/products\/([^?"]+)[^"]*"[^>]*>\s*<span class="visually-hidden">([^<]+)<\/span>/);
      
      if (!linkMatch) {
        // Try alternative pattern
        const altMatch = section.match(/products\/([a-z0-9-]+)[^"]*"[^>]*class="wide-link"[^>]*>\s*<span[^>]*>([^<]+)/);
        if (!altMatch) {
          console.log(`Section ${i}: No link match found`);
          continue;
        }
      }
      
      const match = linkMatch || section.match(/products\/([a-z0-9-]+)[^"]*"[^>]*class="wide-link"[^>]*>\s*<span[^>]*>([^<]+)/);
      if (!match) continue;
      
      const slug = match[1];
      const name = match[2].trim();
      
      // Extract featured image
      let imageUrl = '';
      const imageMatch = section.match(/data-src="([^"]*cdn\/shop\/[^"]+)"/);
      if (imageMatch) {
        imageUrl = imageMatch[1].replace(/\{width\}/g, '720').replace(/&amp;/g, '&');
        if (imageUrl.startsWith('//')) {
          imageUrl = 'https:' + imageUrl;
        }
      }
      
      // Extract current price
      let price = 0;
      const priceMatch = section.match(/card-price__current[^"]*">R\$\s*([\d.,]+)/);
      if (priceMatch) {
        price = parsePrice(priceMatch[1]);
      }
      
      // Extract compare at price (original price)
      let compareAtPrice: number | undefined;
      const compareMatch = section.match(/card-price__sale--discounted-from">\s*R\$\s*([\d.,]+)/);
      if (compareMatch) {
        compareAtPrice = parsePrice(compareMatch[1]);
      }
      
      // Extract description
      let description = '';
      const descMatch = section.match(/product-card__description">\s*([^<]+)/);
      if (descMatch) {
        description = descMatch[1].trim();
      }
      
      console.log(`Extracted: ${name} | ${slug} | ${price} | ${imageUrl ? 'has image' : 'no image'}`);
      
      products.push({
        name,
        slug,
        price,
        compareAtPrice,
        description,
        imageUrl,
      });
    } catch (e) {
      console.error(`Error parsing section ${i}:`, e);
    }
  }

  return products;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tenantId, url } = await req.json();

    if (!tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'tenant_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Starting scrape for tenant: ${tenantId}, URL: ${url}`);

    const targetUrl = url || 'https://www.respeiteohomem.com.br/collections/tratamento-para-calvicie';
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch page: ${response.status}`);
    }

    const html = await response.text();
    console.log(`Fetched HTML, length: ${html.length}`);

    const scrapedProducts = extractProductsFromHTML(html);
    console.log(`Scraped ${scrapedProducts.length} products`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get existing products for this tenant
    const { data: existingProducts, error: fetchError } = await supabase
      .from('products')
      .select('id, name, slug, description, short_description')
      .eq('tenant_id', tenantId);

    if (fetchError) {
      throw new Error(`Failed to fetch products: ${fetchError.message}`);
    }

    console.log(`Found ${existingProducts?.length || 0} existing products`);

    const results = {
      updated: 0,
      imagesAdded: 0,
      matched: 0,
      errors: [] as string[],
    };

    // Create a map of normalized names/slugs to existing products
    const productMap = new Map<string, typeof existingProducts[0]>();
    existingProducts?.forEach(p => {
      const normalizedSlug = p.slug.toLowerCase().replace(/-/g, '');
      const normalizedName = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      productMap.set(normalizedSlug, p);
      productMap.set(normalizedName, p);
    });

    for (const scraped of scrapedProducts) {
      const normalizedScrapedSlug = scraped.slug.toLowerCase().replace(/-/g, '');
      const normalizedScrapedName = scraped.name.toLowerCase().replace(/[^a-z0-9]/g, '');
      
      const existing = productMap.get(normalizedScrapedSlug) || productMap.get(normalizedScrapedName);

      if (existing) {
        results.matched++;
        try {
          // Update product description if empty
          if ((!existing.short_description || existing.short_description === '') && scraped.description) {
            const { error: updateError } = await supabase
              .from('products')
              .update({ 
                short_description: scraped.description,
                compare_at_price: scraped.compareAtPrice || null,
              })
              .eq('id', existing.id);

            if (updateError) {
              console.error(`Error updating product ${existing.name}:`, updateError);
              results.errors.push(`${existing.name}: ${updateError.message}`);
            } else {
              results.updated++;
              console.log(`Updated product: ${existing.name}`);
            }
          }

          // Check if product already has images
          const { data: existingImages } = await supabase
            .from('product_images')
            .select('id')
            .eq('product_id', existing.id)
            .limit(1);

          // Add image if none exists and we have an image URL
          if ((!existingImages || existingImages.length === 0) && scraped.imageUrl) {
            const { error: imageError } = await supabase
              .from('product_images')
              .insert({
                product_id: existing.id,
                url: scraped.imageUrl,
                alt_text: scraped.name,
                is_primary: true,
                sort_order: 0,
              });

            if (imageError) {
              console.error(`Error adding image for ${existing.name}:`, imageError);
              results.errors.push(`Image for ${existing.name}: ${imageError.message}`);
            } else {
              results.imagesAdded++;
              console.log(`Added image for: ${existing.name}`);
            }
          }
        } catch (e) {
          const error = e as Error;
          console.error(`Error processing ${existing.name}:`, error);
          results.errors.push(`${existing.name}: ${error.message}`);
        }
      } else {
        console.log(`No match found for scraped product: ${scraped.name} (${scraped.slug})`);
      }
    }

    console.log('Scrape complete:', results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        scraped: scrapedProducts.length,
        scrapedProducts: scrapedProducts.map(p => ({ name: p.name, slug: p.slug })),
        ...results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Scrape error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
