import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ===========================================
// CONSTANTS & TYPES
// ===========================================

interface ImportRequest {
  job_id: string;
  source_url: string;
  platform: string;
}

interface CategoryCandidate {
  url: string;
  slug: string;
  name: string;
  parentSlug?: string;
  fromNav: boolean;
  isProductGrid: boolean;
  hasProducts: boolean;
  productCount: number;
  sortOrder: number;
  bannerDesktopUrl?: string;
  bannerMobileUrl?: string;
  imageUrl?: string;
  description?: string;
}

interface ImportStats {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  productsLinked: number;
}

// Hard blacklist - NEVER import these as categories
const BLACKLIST_HARD = [
  'checkout', 'cart', 'carrinho', 'login', 'signin', 'signup', 'cadastro', 'register',
  'minha-conta', 'my-account', 'account', 'conta', 'perfil', 'profile',
  'rastreio', 'tracking', 'rastrear', 'rastreamento',
  'search', 'busca', 'pesquisa',
  'blog', 'posts', 'artigos', 'noticias', 'news',
  'politica', 'policy', 'policies', 'termos', 'terms', 'privacidade', 'privacy',
  'contato', 'contact', 'fale-conosco',
  'faq', 'ajuda', 'help', 'suporte', 'support',
  'sobre', 'about', 'quem-somos', 'about-us',
  'wishlist', 'favoritos', 'favorites',
  'pedidos', 'orders', 'meus-pedidos',
  'enderecos', 'addresses',
  'pagamento', 'payment',
  'frete', 'shipping', 'entrega', 'delivery',
  'cupom', 'coupon', 'desconto', 'discount',
  'newsletter', 'assinar', 'subscribe',
  'cookies', 'gdpr', 'lgpd',
  'pages', 'pagina', 'paginas', 'institucional'
];

// Category URL patterns (high confidence)
const CATEGORY_PATTERNS = [
  /\/(?:collections?|categoria|categorias|category|categories|c)\/([^/?#]+)/i,
  /\/(?:departamento|departamentos|department|departments|dept)\/([^/?#]+)/i,
  /\/(?:shop|loja|store)\/([^/?#]+)/i,
];

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = '';
    parsed.hash = '';
    let path = parsed.pathname;
    if (!path.endsWith('/')) path += '/';
    parsed.pathname = path;
    return parsed.href;
  } catch {
    return url;
  }
}

function extractSlugFromUrl(url: string): string | null {
  for (const pattern of CATEGORY_PATTERNS) {
    const match = pattern.exec(url);
    if (match && match[1]) {
      return match[1].toLowerCase().replace(/[^a-z0-9-]/g, '-');
    }
  }
  return null;
}

function isBlacklistedUrl(url: string): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    return BLACKLIST_HARD.some(term => 
      path.includes(`/${term}`) || path.includes(`/${term}/`) || path.endsWith(`/${term}`)
    );
  } catch {
    return true;
  }
}

function slugToName(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

// ===========================================
// CATEGORY PAGE VERIFICATION
// ===========================================

interface CategoryPageAnalysis {
  isCategory: boolean;
  hasProductGrid: boolean;
  productCount: number;
  bannerDesktopUrl?: string;
  bannerMobileUrl?: string;
  imageUrl?: string;
  title?: string;
  description?: string;
}

async function analyzeCategoryPage(
  categoryUrl: string,
  firecrawlApiKey: string
): Promise<CategoryPageAnalysis> {
  try {
    console.log(`[Categories] Analyzing page: ${categoryUrl}`);
    
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${firecrawlApiKey}`
      },
      body: JSON.stringify({
        url: categoryUrl,
        formats: ['html'],
        onlyMainContent: false,
        waitFor: 3000
      })
    });

    if (!response.ok) {
      console.log(`[Categories] Firecrawl failed for ${categoryUrl}`);
      return { isCategory: false, hasProductGrid: false, productCount: 0 };
    }

    const result = await response.json();
    const html = result?.data?.html || result?.html || '';
    
    if (!html) {
      return { isCategory: false, hasProductGrid: false, productCount: 0 };
    }

    // =====================================================
    // DETECT PRODUCT GRID - This is the KEY characteristic
    // =====================================================
    
    // Multiple patterns to detect product grids
    const productGridPatterns = [
      // Generic product cards/items
      /<(?:div|article|li)[^>]*class="[^"]*(?:product|item|card)[^"]*"[^>]*>/gi,
      // Product lists/grids
      /<(?:ul|div)[^>]*class="[^"]*(?:products?-list|products?-grid|product-collection|collection-products)[^"]*"/gi,
      // Shopify specific
      /<div[^>]*class="[^"]*(?:collection-products|product-grid)[^"]*"/gi,
      // WooCommerce
      /<ul[^>]*class="[^"]*products[^"]*"/gi,
      // Nuvemshop/Tray
      /<div[^>]*class="[^"]*(?:js-product-table|product-table)[^"]*"/gi,
      // Generic grid with product links
      /<a[^>]*href="[^"]*\/(?:product|produto|p)\/[^"]+"/gi,
    ];
    
    let totalProductMatches = 0;
    for (const pattern of productGridPatterns) {
      const matches = html.match(pattern) || [];
      totalProductMatches += matches.length;
    }
    
    // Count product links (more specific)
    const productLinkPatterns = [
      /<a[^>]*href="[^"]*\/(?:products?|produto|item|p)\/[^"]+"/gi,
      /<a[^>]*class="[^"]*product[^"]*"[^>]*href="[^"]+"/gi,
    ];
    
    let productLinkCount = 0;
    for (const pattern of productLinkPatterns) {
      const matches = html.match(pattern) || [];
      productLinkCount += matches.length;
    }
    
    // Count add to cart buttons (strong indicator)
    const addToCartPatterns = [
      /(?:add.?to.?cart|adicionar.?(?:ao|no|à).?carrinho|comprar|buy)/gi,
      /<button[^>]*(?:class="[^"]*(?:add-to-cart|buy-button|btn-buy)[^"]*"|data-action="add")[^>]*>/gi,
    ];
    
    let addToCartCount = 0;
    for (const pattern of addToCartPatterns) {
      const matches = html.match(pattern) || [];
      addToCartCount += matches.length;
    }
    
    // Check for price indicators
    const pricePatterns = [
      /R\$\s*\d+[,.]?\d*/g,
      /<[^>]*class="[^"]*(?:price|preco)[^"]*"[^>]*>/gi,
      /data-price="/gi,
    ];
    
    let priceCount = 0;
    for (const pattern of pricePatterns) {
      const matches = html.match(pattern) || [];
      priceCount += matches.length;
    }

    // Decision: Is this a category page?
    // Category pages have: product grid + multiple products + prices
    const hasProductGrid = totalProductMatches >= 3 || productLinkCount >= 3;
    const hasMultipleProducts = productLinkCount >= 2 || priceCount >= 3;
    const isCategory = hasProductGrid && hasMultipleProducts;
    
    const productCount = Math.max(productLinkCount, Math.floor(priceCount / 2));
    
    console.log(`[Categories] ${categoryUrl} - Grid: ${hasProductGrid}, Products: ${productCount}, IsCategory: ${isCategory}`);

    if (!isCategory) {
      return { isCategory: false, hasProductGrid: false, productCount: 0 };
    }

    // =====================================================
    // EXTRACT BANNERS (only for confirmed category pages)
    // =====================================================
    
    const banners: { desktop?: string; mobile?: string; thumbnail?: string } = {};
    const origin = new URL(categoryUrl).origin;
    
    // Look for banners INSIDE the main content (not in header/footer)
    // Remove header and footer from analysis for banner extraction
    let mainContent = html;
    mainContent = mainContent.replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '');
    mainContent = mainContent.replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
    
    // Banner patterns - looking for large hero images at the top of content
    const bannerPatterns = [
      // Category/collection banner
      /<img[^>]*class="[^"]*(?:category-banner|collection-banner|banner|hero)[^"]*"[^>]*src="([^"]+)"/i,
      /<div[^>]*class="[^"]*(?:category-banner|collection-banner|banner-category|hero)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i,
      // Picture element with srcset
      /<picture[^>]*>[\s\S]*?<source[^>]*media="\(min-width[^"]*"[^>]*srcset="([^"]+)"/i,
      // Background image
      /style="[^"]*background(?:-image)?:\s*url\(['"]?([^'")\s]+)['"]?\)[^"]*"[^>]*class="[^"]*(?:banner|hero|category)[^"]*"/i,
      // First large image after header (likely banner)
      /<main[^>]*>[\s\S]*?<img[^>]*(?:class="[^"]*(?:banner|hero|full)[^"]*"[^>]*)?src="([^"]+)"[^>]*(?:width="[89]\d{2,}|style="[^"]*width:\s*100%)/i,
    ];
    
    for (const pattern of bannerPatterns) {
      if (banners.desktop) break;
      const match = mainContent.match(pattern);
      if (match && match[1]) {
        banners.desktop = match[1];
      }
    }
    
    // Mobile banner
    const mobileBannerPatterns = [
      /<picture[^>]*>[\s\S]*?<source[^>]*media="\(max-width[^"]*"[^>]*srcset="([^"]+)"/i,
      /data-mobile-src="([^"]+)"/i,
      /<img[^>]*class="[^"]*mobile[^"]*banner[^"]*"[^>]*src="([^"]+)"/i,
    ];
    
    for (const pattern of mobileBannerPatterns) {
      if (banners.mobile) break;
      const match = mainContent.match(pattern);
      if (match && match[1]) {
        banners.mobile = match[1];
      }
    }
    
    // Category thumbnail/image
    const thumbnailPatterns = [
      /<img[^>]*class="[^"]*category-image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*alt="[^"]*(?:category|collection|categoria)[^"]*"[^>]*src="([^"]+)"/i,
    ];
    
    for (const pattern of thumbnailPatterns) {
      if (banners.thumbnail) break;
      const match = mainContent.match(pattern);
      if (match && match[1]) {
        banners.thumbnail = match[1];
      }
    }
    
    // Extract title (h1 inside content)
    const titleMatch = mainContent.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;
    
    // Extract description
    const descPatterns = [
      /<div[^>]*class="[^"]*(?:category-description|collection-description)[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
      /<p[^>]*class="[^"]*(?:category-desc|collection-desc)[^"]*"[^>]*>([^<]+)<\/p>/i,
    ];
    
    let description: string | undefined;
    for (const pattern of descPatterns) {
      const match = mainContent.match(pattern);
      if (match && match[1]) {
        description = match[1].replace(/<[^>]+>/g, '').trim().slice(0, 500);
        break;
      }
    }
    
    // Clean URLs
    const cleanUrl = (url?: string) => {
      if (!url) return undefined;
      if (url.startsWith('//')) return `https:${url}`;
      if (url.startsWith('/')) return `${origin}${url}`;
      return url;
    };
    
    return {
      isCategory: true,
      hasProductGrid: true,
      productCount,
      bannerDesktopUrl: cleanUrl(banners.desktop),
      bannerMobileUrl: cleanUrl(banners.mobile),
      imageUrl: cleanUrl(banners.thumbnail) || cleanUrl(banners.desktop),
      title,
      description,
    };
  } catch (error) {
    console.error(`[Categories] Error analyzing ${categoryUrl}:`, error);
    return { isCategory: false, hasProductGrid: false, productCount: 0 };
  }
}

// ===========================================
// CATEGORY DISCOVERY
// ===========================================

async function discoverCategories(
  sourceUrl: string,
  firecrawlApiKey: string
): Promise<CategoryCandidate[]> {
  const candidates = new Map<string, CategoryCandidate>();
  const origin = new URL(sourceUrl.startsWith('http') ? sourceUrl : `https://${sourceUrl}`).origin;

  console.log(`[Categories] Discovering from ${origin}`);

  // Step 1: Fetch page with Firecrawl
  const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${firecrawlApiKey}`
    },
    body: JSON.stringify({
      url: sourceUrl,
      formats: ['html', 'links'],
      onlyMainContent: false,
      waitFor: 3000
    })
  });

  if (!response.ok) {
    console.error('[Categories] Firecrawl error:', response.status);
    return [];
  }

  const result = await response.json();
  const html = result?.data?.html || result?.html || '';
  const links = result?.data?.links || result?.links || [];

  console.log(`[Categories] Fetched ${links.length} links from homepage`);

  // Step 2: Extract category-like URLs from header and footer
  const headerMatch = html.match(/<header[^>]*>([\s\S]*?)<\/header>/i);
  const footerMatch = html.match(/<footer[^>]*>([\s\S]*?)<\/footer>/i);
  
  const navHtml = (headerMatch?.[1] || '') + (footerMatch?.[1] || '');
  
  // Extract links from nav areas
  const navLinkPattern = /<a[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
  let navMatch;
  const navLinks = new Map<string, string>(); // url -> label
  
  while ((navMatch = navLinkPattern.exec(navHtml)) !== null) {
    const [, href, label] = navMatch;
    if (href && label) {
      const fullUrl = href.startsWith('/') ? `${origin}${href}` : href;
      if (fullUrl.startsWith(origin)) {
        navLinks.set(fullUrl, label.trim());
      }
    }
  }

  console.log(`[Categories] Found ${navLinks.size} nav links`);

  // Step 3: Collect candidate URLs
  let sortOrder = 0;
  const urlsToCheck: Array<{ url: string; slug: string; name: string; fromNav: boolean }> = [];

  // First priority: URLs from navigation
  for (const [url, label] of navLinks.entries()) {
    if (isBlacklistedUrl(url)) continue;
    
    const slug = extractSlugFromUrl(url);
    if (!slug) continue;
    if (candidates.has(slug)) continue;
    
    urlsToCheck.push({
      url: normalizeUrl(url),
      slug,
      name: label || slugToName(slug),
      fromNav: true
    });
  }

  // Second priority: All category-pattern links
  for (const link of links) {
    if (typeof link !== 'string' || !link.startsWith(origin)) continue;
    if (isBlacklistedUrl(link)) continue;

    const slug = extractSlugFromUrl(link);
    if (!slug) continue;
    if (urlsToCheck.some(u => u.slug === slug)) continue;

    urlsToCheck.push({
      url: normalizeUrl(link),
      slug,
      name: slugToName(slug),
      fromNav: false
    });
  }

  console.log(`[Categories] ${urlsToCheck.length} URLs to verify as category pages`);

  // Step 4: Verify each URL is actually a category page (has product grid)
  // Limit to first 30 to avoid timeout
  const limitedUrls = urlsToCheck.slice(0, 30);
  
  for (const urlInfo of limitedUrls) {
    const analysis = await analyzeCategoryPage(urlInfo.url, firecrawlApiKey);
    
    if (analysis.isCategory) {
      candidates.set(urlInfo.slug, {
        url: urlInfo.url,
        slug: urlInfo.slug,
        name: analysis.title || urlInfo.name,
        fromNav: urlInfo.fromNav,
        isProductGrid: analysis.hasProductGrid,
        hasProducts: analysis.productCount > 0,
        productCount: analysis.productCount,
        sortOrder: sortOrder++,
        bannerDesktopUrl: analysis.bannerDesktopUrl,
        bannerMobileUrl: analysis.bannerMobileUrl,
        imageUrl: analysis.imageUrl,
        description: analysis.description,
      });
      
      console.log(`[Categories] ✓ Confirmed: ${urlInfo.slug} (${analysis.productCount} products)`);
    } else {
      console.log(`[Categories] ✗ Not a category: ${urlInfo.slug}`);
    }
    
    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  const resultCategories = Array.from(candidates.values())
    .sort((a, b) => {
      // Prioritize nav links, then by product count
      if (a.fromNav !== b.fromNav) return a.fromNav ? -1 : 1;
      return b.productCount - a.productCount;
    });

  console.log(`[Categories] Found ${resultCategories.length} verified categories`);
  return resultCategories;
}

// ===========================================
// LINK PRODUCTS TO CATEGORIES
// ===========================================

async function linkProductsToCategories(
  supabase: any,
  tenantId: string,
  categorySlugToId: Map<string, string>
): Promise<number> {
  let linkedCount = 0;
  
  try {
    // Get all products for this tenant
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, slug, name')
      .eq('tenant_id', tenantId);
    
    if (productsError || !products?.length) {
      console.log('[Categories] No products found to link');
      return 0;
    }
    
    // Get import_items to find original category slugs from product imports
    const { data: importItems } = await supabase
      .from('import_items')
      .select('internal_id, data')
      .eq('tenant_id', tenantId)
      .eq('module', 'products');
    
    const productImportData = new Map<string, any>();
    if (importItems) {
      for (const item of importItems) {
        if (item.internal_id && item.data) {
          productImportData.set(item.internal_id, item.data);
        }
      }
    }
    
    // For each product, try to find matching categories
    for (const product of products) {
      const importData = productImportData.get(product.id);
      let categoriesToLink: string[] = [];
      
      // Check if import data has categories
      if (importData?.categories && Array.isArray(importData.categories)) {
        categoriesToLink = importData.categories;
      }
      
      // Also try to match product slug parts with category slugs
      for (const [catSlug, catId] of categorySlugToId.entries()) {
        // Check if category slug is contained in product slug or name
        if (product.slug.includes(catSlug) || 
            product.name.toLowerCase().includes(catSlug.replace(/-/g, ' '))) {
          if (!categoriesToLink.includes(catSlug)) {
            categoriesToLink.push(catSlug);
          }
        }
      }
      
      // Link product to categories
      for (const catSlug of categoriesToLink) {
        const categoryId = categorySlugToId.get(catSlug.toLowerCase());
        if (!categoryId) continue;
        
        // Check if link already exists
        const { data: existing } = await supabase
          .from('product_categories')
          .select('id')
          .eq('product_id', product.id)
          .eq('category_id', categoryId)
          .maybeSingle();
        
        if (!existing) {
          // Get max position for this category
          const { data: maxPos } = await supabase
            .from('product_categories')
            .select('position')
            .eq('category_id', categoryId)
            .order('position', { ascending: false })
            .limit(1)
            .maybeSingle();
          
          const nextPosition = (maxPos?.position ?? -1) + 1;
          
          const { error: linkError } = await supabase
            .from('product_categories')
            .insert({
              product_id: product.id,
              category_id: categoryId,
              position: nextPosition
            });
          
          if (!linkError) {
            linkedCount++;
          }
        }
      }
    }
    
    console.log(`[Categories] Linked ${linkedCount} product-category relationships`);
    return linkedCount;
  } catch (error) {
    console.error('[Categories] Error linking products:', error);
    return linkedCount;
  }
}

// ===========================================
// PERSISTENCE
// ===========================================

async function importCategory(
  supabase: any,
  tenantId: string,
  jobId: string,
  candidate: CategoryCandidate
): Promise<{ status: 'created' | 'updated' | 'skipped' | 'failed'; categoryId?: string }> {
  try {
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('slug', candidate.slug)
      .maybeSingle();

    let categoryId: string;

    if (existing) {
      const { data, error } = await supabase
        .from('categories')
        .update({
          name: candidate.name,
          description: candidate.description || null,
          sort_order: candidate.sortOrder,
          banner_desktop_url: candidate.bannerDesktopUrl || null,
          banner_mobile_url: candidate.bannerMobileUrl || null,
          image_url: candidate.imageUrl || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) throw error;
      categoryId = data.id;

      await supabase.from('import_items').upsert({
        tenant_id: tenantId,
        job_id: jobId,
        module: 'categories',
        internal_id: categoryId,
        external_id: candidate.url,
        status: 'success',
        data: { slug: candidate.slug, name: candidate.name, productCount: candidate.productCount }
      }, {
        onConflict: 'tenant_id,module,external_id',
        ignoreDuplicates: false
      });

      return { status: 'updated', categoryId };
    } else {
      const { data, error } = await supabase
        .from('categories')
        .insert({
          tenant_id: tenantId,
          name: candidate.name,
          slug: candidate.slug,
          description: candidate.description || null,
          is_active: true,
          sort_order: candidate.sortOrder,
          banner_desktop_url: candidate.bannerDesktopUrl || null,
          banner_mobile_url: candidate.bannerMobileUrl || null,
          image_url: candidate.imageUrl || null
        })
        .select('id')
        .single();

      if (error) throw error;
      categoryId = data.id;

      await supabase.from('import_items').upsert({
        tenant_id: tenantId,
        job_id: jobId,
        module: 'categories',
        internal_id: categoryId,
        external_id: candidate.url,
        status: 'success',
        data: { slug: candidate.slug, name: candidate.name, productCount: candidate.productCount }
      }, {
        onConflict: 'tenant_id,module,external_id',
        ignoreDuplicates: false
      });

      return { status: 'created', categoryId };
    }
  } catch (error) {
    console.error(`[Categories] Failed to import ${candidate.slug}:`, error);
    return { status: 'failed' };
  }
}

async function updateJobProgress(
  supabase: any,
  jobId: string,
  stats: ImportStats
) {
  await supabase.rpc('update_import_job_module', {
    p_job_id: jobId,
    p_module: 'categories',
    p_current: stats.created + stats.updated + stats.skipped + stats.failed,
    p_total: stats.total,
    p_imported: stats.created,
    p_updated: stats.updated,
    p_skipped: stats.skipped,
    p_failed: stats.failed
  });
}

// ===========================================
// MAIN HANDLER
// ===========================================

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ success: false, error: 'Não autorizado', code: 'UNAUTHORIZED' });
    }

    const body = await req.json() as ImportRequest;
    const { job_id, source_url, platform } = body;

    if (!job_id || !source_url) {
      return jsonResponse({ 
        success: false, 
        error: 'job_id e source_url são obrigatórios', 
        code: 'INVALID_REQUEST' 
      });
    }

    console.log(`[Categories] Starting import for job ${job_id}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')!;

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      console.error('[Categories] Auth error:', userError);
      return jsonResponse({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('id, tenant_id, status')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('[Categories] Job not found:', jobError);
      return jsonResponse({ success: false, error: 'Job não encontrado', code: 'JOB_NOT_FOUND' });
    }

    const { data: belongsToTenant } = await supabase.rpc('user_belongs_to_tenant', {
      _user_id: user.id,
      _tenant_id: job.tenant_id
    });

    if (!belongsToTenant) {
      console.error('[Categories] User does not belong to tenant');
      return jsonResponse({ success: false, error: 'Acesso negado ao tenant', code: 'FORBIDDEN' });
    }

    const tenantId = job.tenant_id;
    console.log(`[Categories] Validated tenant ${tenantId} for user ${user.id}`);

    await supabase
      .from('import_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job_id);

    // Discover categories with product grid verification
    const categories = await discoverCategories(source_url, firecrawlApiKey);

    if (categories.length === 0) {
      await updateJobProgress(supabase, job_id, {
        total: 0, created: 0, updated: 0, skipped: 0, failed: 0, productsLinked: 0
      });

      await supabase
        .from('import_jobs')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', job_id);

      return jsonResponse({
        success: true,
        stats: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0, productsLinked: 0 },
        message: 'Nenhuma categoria encontrada'
      });
    }

    const stats: ImportStats = {
      total: categories.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0,
      productsLinked: 0
    };

    // Map to store slug -> categoryId for product linking
    const categorySlugToId = new Map<string, string>();

    for (const category of categories) {
      const result = await importCategory(supabase, tenantId, job_id, category);
      stats[result.status]++;
      
      if (result.categoryId) {
        categorySlugToId.set(category.slug.toLowerCase(), result.categoryId);
      }

      if ((stats.created + stats.updated + stats.skipped + stats.failed) % 10 === 0) {
        await updateJobProgress(supabase, job_id, stats);
      }
    }

    // Link products to imported categories
    const linkedProducts = await linkProductsToCategories(supabase, tenantId, categorySlugToId);
    stats.productsLinked = linkedProducts;

    await updateJobProgress(supabase, job_id, stats);

    await supabase
      .from('import_jobs')
      .update({ 
        status: 'completed',
        completed_at: new Date().toISOString()
      })
      .eq('id', job_id);

    console.log(`[Categories] Import completed:`, stats);

    return jsonResponse({
      success: true,
      stats,
      message: `Importação concluída: ${stats.created} criadas, ${stats.updated} atualizadas, ${stats.productsLinked} produtos vinculados`
    });

  } catch (error) {
    console.error('[Categories] Unexpected error:', error);
    return jsonResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Erro interno',
      code: 'INTERNAL_ERROR'
    });
  }
});
