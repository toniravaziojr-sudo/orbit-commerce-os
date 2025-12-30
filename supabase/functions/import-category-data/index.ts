// Extract ALL products and banners from a category page
// Downloads assets and uploads to storage for internalization
// Handles Shopify pagination for complete product extraction

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CategoryDataResult {
  success: boolean;
  products: string[]; // Product handles/slugs
  bannerDesktopUrl?: string; // Internalized URL
  bannerMobileUrl?: string;  // Internalized URL
  productCount: number;
  error?: string;
}

// Extract banner images from HTML
function extractBannerFromHtml(html: string, baseUrl: string): { desktop?: string; mobile?: string } {
  const result: { desktop?: string; mobile?: string } = {};
  
  const normalizeUrl = (src: string): string => {
    if (!src) return '';
    if (src.startsWith('//')) return `https:${src}`;
    if (src.startsWith('/')) return `${baseUrl}${src}`;
    if (src.startsWith('http')) return src;
    return `${baseUrl}/${src}`;
  };

  // Try multiple banner patterns
  const bannerPatterns = [
    /<div[^>]*class=\"[^\"]*collection-hero[^\"]*\"[^>]*>[\s\S]*?<img[^>]*src=[\"']([^\"]+)[\"'][^>]*>/gi,
    /<img[^>]*class=\"[^\"]*(?:collection|category)[-_]?(?:banner|hero|image)[^\"]*\"[^>]*src=[\"']([^\"]+)[\"'][^>]*>/gi,
    /class=\"[^\"]*(?:collection|category)[-_]?(?:banner|hero)[^\"]*\"[^>]*style=\"[^\"]*background[-_]?image:\s*url\(['"]?([^'\")\s]+)['"]?\)/gi,
    /<section[^>]*class=\"[^\"]*(?:hero|banner|collection-header)[^\"]*\"[^>]*>[\s\S]*?<img[^>]*src=[\"']([^\"]+)[\"'][^>]*>/gi,
  ];

  for (const pattern of bannerPatterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const imgUrl = match[1] || match[2];
      if (imgUrl && !result.desktop) {
        result.desktop = normalizeUrl(imgUrl);
        if (match[2]) result.mobile = normalizeUrl(match[2]);
      }
    }
    if (result.desktop) break;
  }

  // Try srcset for responsive variants
  if (!result.desktop) {
    const srcsetPattern = /<img[^>]*srcset=[\"']([^\"]+)[\"'][^>]*>/gi;
    let srcsetMatch;
    while ((srcsetMatch = srcsetPattern.exec(html)) !== null) {
      const srcset = srcsetMatch[1];
      const entries = srcset.split(',').map(s => {
        const parts = s.trim().split(/\s+/);
        return { url: parts[0], width: parseInt(parts[1] || '0') };
      }).filter(e => e.url);

      if (entries.length > 0) {
        entries.sort((a, b) => b.width - a.width);
        result.desktop = normalizeUrl(entries[0].url);
        if (entries.length > 1) result.mobile = normalizeUrl(entries[entries.length - 1].url);
        break;
      }
    }
  }

  return result;
}

// Extract ALL products from Shopify collection with pagination
async function extractShopifyProducts(categoryUrl: string): Promise<string[]> {
  const allHandles: string[] = [];
  let page = 1;
  const limit = 250;
  
  try {
    // Get base collection URL
    const urlObj = new URL(categoryUrl);
    const baseUrl = urlObj.origin + urlObj.pathname.replace(/\/$/, '');
    
    while (true) {
      const jsonUrl = `${baseUrl}/products.json?limit=${limit}&page=${page}`;
      console.log(`Fetching Shopify products page ${page}: ${jsonUrl}`);
      
      const response = await fetch(jsonUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        },
      });
      
      if (!response.ok) {
        console.log(`Shopify JSON endpoint returned ${response.status}`);
        break;
      }
      
      const data = await response.json();
      const products = data.products || [];
      
      if (products.length === 0) break;
      
      for (const product of products) {
        if (product.handle) {
          allHandles.push(product.handle.toLowerCase());
        }
      }
      
      console.log(`Page ${page}: Found ${products.length} products, total so far: ${allHandles.length}`);
      
      // If less than limit, we've reached the end
      if (products.length < limit) break;
      
      page++;
      
      // Safety limit
      if (page > 50) break;
    }
  } catch (error) {
    console.error('Error fetching Shopify products:', error);
  }
  
  return allHandles;
}

// Extract products from HTML (fallback for non-Shopify or CORS issues)
function extractProductsFromHtml(html: string): string[] {
  const handles = new Set<string>();
  
  // Pattern for product URLs
  const productUrlPattern = /\/products?\/([^\ "'\/\\s?#<>]+)/gi;
  let match;
  
  while ((match = productUrlPattern.exec(html)) !== null) {
    const handle = match[1].toLowerCase();
    // Filter out common non-product handles
    if (handle && 
        !handle.includes('.') && 
        handle !== 'products' &&
        handle !== 'all' &&
        handle !== 'undefined' &&
        !handle.startsWith('cdn') &&
        handle.length > 1 &&
        handle.length < 100) {
      handles.add(handle);
    }
  }
  
  // Also look for data attributes
  const dataHandlePattern = /data-(?:product-)?handle=[\"']([^\"]+)[\"']/gi;
  while ((match = dataHandlePattern.exec(html)) !== null) {
    const handle = match[1].toLowerCase();
    if (handle && handle.length > 1 && handle.length < 100) {
      handles.add(handle);
    }
  }
  
  return Array.from(handles);
}

// Download image and upload to storage
async function internalizeAsset(
  supabase: any,
  sourceUrl: string,
  tenantId: string,
  variant: 'desktop' | 'mobile',
  slug: string
): Promise<string | null> {
  try {
    console.log(`Downloading asset: ${sourceUrl}`);
    
    // Download the image
    const response = await fetch(sourceUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'image/*,*/*',
      },
    });
    
    if (!response.ok) {
      console.error(`Failed to download: ${response.status}`);
      return null;
    }
    
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const buffer = await response.arrayBuffer();
    
    // Determine file extension
    let ext = 'jpg';
    if (contentType.includes('png')) ext = 'png';
    else if (contentType.includes('webp')) ext = 'webp';
    else if (contentType.includes('gif')) ext = 'gif';
    
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedSlug = slug.replace(/[^a-z0-9-]/gi, '-').substring(0, 50);
    const filePath = `${tenantId}/banners/${variant}/${sanitizedSlug}-${timestamp}.${ext}`;
    
    console.log(`Uploading to storage: ${filePath}`);
    
    // Upload to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(filePath, buffer, {
        contentType,
        upsert: true,
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return null;
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('product-images')
      .getPublicUrl(filePath);
    
    const publicUrl = urlData?.publicUrl;
    console.log(`Asset internalized: ${publicUrl}`);
    
    return publicUrl;
  } catch (error) {
    console.error('Error internalizing asset:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { categoryUrl, categorySlug, tenantId, platform } = await req.json();

    if (!categoryUrl || !tenantId) {
      return new Response(
        JSON.stringify({ success: false, error: 'categoryUrl e tenantId são obrigatórios' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Extracting data from category: ${categoryUrl} (platform: ${platform})`);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Parse base URL
    let baseUrl = '';
    try {
      const urlObj = new URL(categoryUrl);
      baseUrl = urlObj.origin;
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'URL inválida' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Step 1: Extract products
    let productHandles: string[] = [];
    const isShopify = platform?.toLowerCase() === 'shopify';
    
    if (isShopify) {
      // Use Shopify API with pagination
      productHandles = await extractShopifyProducts(categoryUrl);
    }
    
    // Fallback to HTML extraction if Shopify API failed or non-Shopify
    if (productHandles.length === 0) {
      console.log('Falling back to HTML extraction...');
      const response = await fetch(categoryUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'text/html,application/xhtml+xml',
        },
      });
      
      if (response.ok) {
        const html = await response.text();
        productHandles = extractProductsFromHtml(html);
      }
    }
    
    console.log(`Found ${productHandles.length} products:`, productHandles);

    // Step 2: Extract and internalize banners
    let bannerDesktopUrl: string | null = null;
    let bannerMobileUrl: string | null = null;
    
    // Fetch HTML for banner extraction
    const response = await fetch(categoryUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });
    
    if (response.ok) {
      const html = await response.text();
      const banners = extractBannerFromHtml(html, baseUrl);
      
      const slug = categorySlug || categoryUrl.split('/').pop() || 'category';
      
      // Internalize desktop banner
      if (banners.desktop) {
        bannerDesktopUrl = await internalizeAsset(supabase, banners.desktop, tenantId, 'desktop', slug);
        
        // If internalization failed, keep original URL as fallback
        if (!bannerDesktopUrl) {
          bannerDesktopUrl = banners.desktop;
        }
      }
      
      // Internalize mobile banner (or use desktop as fallback)
      const mobileSource = banners.mobile || banners.desktop;
      if (mobileSource) {
        if (mobileSource !== banners.desktop || !bannerDesktopUrl) {
          bannerMobileUrl = await internalizeAsset(supabase, mobileSource, tenantId, 'mobile', slug);
          if (!bannerMobileUrl) {
            bannerMobileUrl = mobileSource;
          }
        } else {
          // Same image for desktop and mobile - reuse
          bannerMobileUrl = bannerDesktopUrl;
        }
      }
    }

    // Step 3: Register internalized assets in media_library
    const assetsToRegister = [];
    
    if (bannerDesktopUrl && bannerDesktopUrl.includes('supabase.co')) {
      const fileName = `Banner ${categorySlug || 'categoria'} - Desktop`;
      const filePath = bannerDesktopUrl.split('/product-images/')[1] || '';
      
      assetsToRegister.push({
        tenant_id: tenantId,
        file_url: bannerDesktopUrl,
        file_path: filePath,
        file_name: fileName,
        variant: 'desktop',
        mime_type: 'image/jpeg',
      });
    }
    
    if (bannerMobileUrl && bannerMobileUrl !== bannerDesktopUrl && bannerMobileUrl.includes('supabase.co')) {
      const fileName = `Banner ${categorySlug || 'categoria'} - Mobile`;
      const filePath = bannerMobileUrl.split('/product-images/')[1] || '';
      
      assetsToRegister.push({
        tenant_id: tenantId,
        file_url: bannerMobileUrl,
        file_path: filePath,
        file_name: fileName,
        variant: 'mobile',
        mime_type: 'image/jpeg',
      });
    }
    
    // Insert into media_library with dedupe
    for (const asset of assetsToRegister) {
      const { error } = await supabase
        .from('media_library')
        .upsert(asset, { 
          onConflict: 'tenant_id,file_url',
          ignoreDuplicates: true,
        });
      
      if (error) {
        console.log(`Media library insert note: ${error.message}`);
      } else {
        console.log(`Registered in media_library: ${asset.file_name}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        products: productHandles,
        productCount: productHandles.length,
        bannerDesktopUrl,
        bannerMobileUrl,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error extracting category data:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro ao extrair dados da categoria',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
