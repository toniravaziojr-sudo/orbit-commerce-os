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
  score: number;
  sortOrder: number;
  bannerDesktopUrl?: string;
  bannerMobileUrl?: string;
  imageUrl?: string;
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
  'cookies', 'gdpr', 'lgpd'
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
  const path = new URL(url).pathname.toLowerCase();
  return BLACKLIST_HARD.some(term => 
    path.includes(`/${term}`) || path.includes(`/${term}/`)
  );
}

function slugToName(slug: string): string {
  return slug
    .replace(/-/g, ' ')
    .replace(/_/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function calculateScore(url: string, fromNav: boolean): number {
  if (fromNav) return 1.0;
  
  let score = 0;
  const path = new URL(url).pathname.toLowerCase();
  
  if (/\/(?:collections?|categoria|category|c)\//.test(path)) score += 0.5;
  if (/\/(?:departamento|department)\//.test(path)) score += 0.4;
  if (/\/(?:shop|loja)\//.test(path)) score += 0.3;
  
  if (url.includes('?variant=') || url.includes('?ref=')) score -= 0.3;
  if (url.includes('/product') || url.includes('/produto')) score -= 0.5;
  if (/\/[a-f0-9-]{36}/.test(path)) score -= 0.4;
  
  return Math.max(0, Math.min(1, score));
}

// ===========================================
// BANNER EXTRACTION
// ===========================================

async function extractCategoryBanners(
  categoryUrl: string,
  firecrawlApiKey: string
): Promise<{ bannerDesktopUrl?: string; bannerMobileUrl?: string; imageUrl?: string }> {
  try {
    console.log(`[Categories] Extracting banners from ${categoryUrl}`);
    
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
        waitFor: 2000
      })
    });

    if (!response.ok) {
      console.log(`[Categories] Firecrawl failed for ${categoryUrl}`);
      return {};
    }

    const result = await response.json();
    const html = result?.data?.html || result?.html || '';
    
    if (!html) return {};

    // Extract banner images from common patterns
    const banners: { desktop?: string; mobile?: string; thumbnail?: string } = {};
    
    // Pattern 1: Shopify collection banner
    const shopifyBannerMatch = html.match(/<img[^>]*class="[^"]*collection[^"]*banner[^"]*"[^>]*src="([^"]+)"/i);
    if (shopifyBannerMatch) {
      banners.desktop = shopifyBannerMatch[1];
    }
    
    // Pattern 2: Hero/banner section images
    const heroPatterns = [
      /<section[^>]*(?:class|id)="[^"]*(?:hero|banner|header)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i,
      /<div[^>]*(?:class|id)="[^"]*(?:category-banner|collection-banner|page-banner)[^"]*"[^>]*>[\s\S]*?<img[^>]*src="([^"]+)"/i,
      /<picture[^>]*>[\s\S]*?<source[^>]*srcset="([^"]+)"[^>]*media="\(min-width/i,
    ];
    
    for (const pattern of heroPatterns) {
      if (banners.desktop) break;
      const match = html.match(pattern);
      if (match) {
        banners.desktop = match[1];
      }
    }
    
    // Pattern 3: Mobile banner (picture with media query)
    const mobileSourceMatch = html.match(/<picture[^>]*>[\s\S]*?<source[^>]*srcset="([^"]+)"[^>]*media="\(max-width/i);
    if (mobileSourceMatch) {
      banners.mobile = mobileSourceMatch[1];
    }
    
    // Pattern 4: Data attributes for responsive images
    const responsiveMatch = html.match(/data-desktop-src="([^"]+)"[^>]*data-mobile-src="([^"]+)"/i);
    if (responsiveMatch) {
      banners.desktop = banners.desktop || responsiveMatch[1];
      banners.mobile = responsiveMatch[2];
    }
    
    // Pattern 5: Category thumbnail/image
    const thumbnailPatterns = [
      /<img[^>]*class="[^"]*category-image[^"]*"[^>]*src="([^"]+)"/i,
      /<img[^>]*(?:alt|title)="[^"]*(?:category|collection)[^"]*"[^>]*src="([^"]+)"/i,
    ];
    
    for (const pattern of thumbnailPatterns) {
      if (banners.thumbnail) break;
      const match = html.match(pattern);
      if (match) {
        banners.thumbnail = match[1];
      }
    }
    
    // Clean up URLs (ensure absolute)
    const origin = new URL(categoryUrl).origin;
    const cleanUrl = (url?: string) => {
      if (!url) return undefined;
      if (url.startsWith('//')) return `https:${url}`;
      if (url.startsWith('/')) return `${origin}${url}`;
      return url;
    };
    
    return {
      bannerDesktopUrl: cleanUrl(banners.desktop),
      bannerMobileUrl: cleanUrl(banners.mobile),
      imageUrl: cleanUrl(banners.thumbnail) || cleanUrl(banners.desktop),
    };
  } catch (error) {
    console.error(`[Categories] Error extracting banners from ${categoryUrl}:`, error);
    return {};
  }
}

// ===========================================
// CATEGORY DISCOVERY
// ===========================================

async function discoverCategories(
  sourceUrl: string,
  firecrawlApiKey: string,
  extractBanners: boolean = true
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
      waitFor: 2000
    })
  });

  if (!response.ok) {
    console.error('[Categories] Firecrawl error:', response.status);
    return [];
  }

  const result = await response.json();
  const links = result?.data?.links || result?.links || [];

  console.log(`[Categories] Fetched ${links.length} links`);

  // Step 2: Extract from links
  let sortOrder = 0;
  for (const link of links) {
    if (typeof link !== 'string' || !link.startsWith(origin)) continue;
    if (isBlacklistedUrl(link)) continue;

    const slug = extractSlugFromUrl(link);
    if (!slug) continue;
    if (candidates.has(slug)) continue;

    const normalizedUrl = normalizeUrl(link);
    const score = calculateScore(link, false);

    if (score < 0.4) continue;

    candidates.set(slug, {
      url: normalizedUrl,
      slug,
      name: slugToName(slug),
      fromNav: false,
      score,
      sortOrder: sortOrder++
    });
  }

  // Step 3: Try sitemap for additional categories
  try {
    const sitemapUrl = `${origin}/sitemap.xml`;
    const sitemapResponse = await fetch(sitemapUrl, { 
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    
    if (sitemapResponse.ok) {
      const sitemapText = await sitemapResponse.text();
      const urlMatches = sitemapText.match(/<loc>([^<]+)<\/loc>/g) || [];
      
      for (const match of urlMatches.slice(0, 100)) {
        const url = match.replace(/<\/?loc>/g, '');
        if (!url.startsWith(origin)) continue;
        if (isBlacklistedUrl(url)) continue;

        const slug = extractSlugFromUrl(url);
        if (!slug || candidates.has(slug)) continue;

        const score = calculateScore(url, false);
        if (score < 0.5) continue;

        candidates.set(slug, {
          url: normalizeUrl(url),
          slug,
          name: slugToName(slug),
          fromNav: false,
          score,
          sortOrder: sortOrder++
        });
      }
    }
  } catch (e) {
    console.log('[Categories] Sitemap not available or error:', e);
  }

  // Step 4: Extract banners for top categories (limit to avoid timeout)
  if (extractBanners) {
    const topCategories = Array.from(candidates.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, 10); // Limit banner extraction to top 10 categories
    
    for (const category of topCategories) {
      const banners = await extractCategoryBanners(category.url, firecrawlApiKey);
      category.bannerDesktopUrl = banners.bannerDesktopUrl;
      category.bannerMobileUrl = banners.bannerMobileUrl;
      category.imageUrl = banners.imageUrl;
      
      // Update in map
      candidates.set(category.slug, category);
    }
  }

  const resultCategories = Array.from(candidates.values())
    .sort((a, b) => b.score - a.score || a.sortOrder - b.sortOrder)
    .slice(0, 100);

  console.log(`[Categories] Found ${resultCategories.length} candidates`);
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
      const productSlugParts = product.slug.split('-');
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
        data: { slug: candidate.slug, name: candidate.name }
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
        data: { slug: candidate.slug, name: candidate.name }
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

    // Discover categories with banner extraction
    const categories = await discoverCategories(source_url, firecrawlApiKey, true);

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
