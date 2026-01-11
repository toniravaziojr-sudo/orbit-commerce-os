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
}

interface ImportStats {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
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
    // Remove query and hash
    parsed.search = '';
    parsed.hash = '';
    // Ensure trailing slash for consistency
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
  if (fromNav) return 1.0; // NAV items are always high confidence
  
  let score = 0;
  const path = new URL(url).pathname.toLowerCase();
  
  // High confidence patterns
  if (/\/(?:collections?|categoria|category|c)\//.test(path)) score += 0.5;
  if (/\/(?:departamento|department)\//.test(path)) score += 0.4;
  if (/\/(?:shop|loja)\//.test(path)) score += 0.3;
  
  // Reduce score for suspicious patterns
  if (url.includes('?variant=') || url.includes('?ref=')) score -= 0.3;
  if (url.includes('/product') || url.includes('/produto')) score -= 0.5;
  if (/\/[a-f0-9-]{36}/.test(path)) score -= 0.4; // UUID in path
  
  return Math.max(0, Math.min(1, score));
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

  // Step 2: Extract from links (NAV detection via HTML structure would require parsing)
  // For now, we treat all links equally and use pattern matching
  let sortOrder = 0;
  for (const link of links) {
    if (typeof link !== 'string' || !link.startsWith(origin)) continue;
    if (isBlacklistedUrl(link)) continue;

    const slug = extractSlugFromUrl(link);
    if (!slug) continue;

    // Deduplicate by slug
    if (candidates.has(slug)) continue;

    const normalizedUrl = normalizeUrl(link);
    const score = calculateScore(link, false);

    // Only include if score meets threshold (0.4 for general links)
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
      
      for (const match of urlMatches.slice(0, 100)) { // Limit sitemap URLs
        const url = match.replace(/<\/?loc>/g, '');
        if (!url.startsWith(origin)) continue;
        if (isBlacklistedUrl(url)) continue;

        const slug = extractSlugFromUrl(url);
        if (!slug || candidates.has(slug)) continue;

        const score = calculateScore(url, false);
        if (score < 0.5) continue; // Higher threshold for sitemap

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

  const resultCategories = Array.from(candidates.values())
    .sort((a, b) => b.score - a.score || a.sortOrder - b.sortOrder)
    .slice(0, 100); // Limit to 100 categories max

  console.log(`[Categories] Found ${resultCategories.length} candidates`);
  return resultCategories;
}

// ===========================================
// PERSISTENCE
// ===========================================

async function importCategory(
  supabase: any,
  tenantId: string,
  jobId: string,
  candidate: CategoryCandidate
): Promise<'created' | 'updated' | 'skipped' | 'failed'> {
  try {
    // Check if category exists
    const { data: existing } = await supabase
      .from('categories')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('slug', candidate.slug)
      .maybeSingle();

    let categoryId: string;

    if (existing) {
      // Update existing category
      const { data, error } = await supabase
        .from('categories')
        .update({
          name: candidate.name,
          sort_order: candidate.sortOrder,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select('id')
        .single();

      if (error) throw error;
      categoryId = data.id;

      // Track in import_items (upsert)
      await supabase.from('import_items').upsert({
        tenant_id: tenantId,
        job_id: jobId,
        module: 'categories',
        internal_id: categoryId,
        external_id: candidate.url, // Canonical URL as external_id
        status: 'success',
        data: { slug: candidate.slug, name: candidate.name }
      }, {
        onConflict: 'tenant_id,module,external_id',
        ignoreDuplicates: false
      });

      return 'updated';
    } else {
      // Create new category
      const { data, error } = await supabase
        .from('categories')
        .insert({
          tenant_id: tenantId,
          name: candidate.name,
          slug: candidate.slug,
          is_active: true,
          sort_order: candidate.sortOrder
        })
        .select('id')
        .single();

      if (error) throw error;
      categoryId = data.id;

      // Track in import_items
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

      return 'created';
    }
  } catch (error) {
    console.error(`[Categories] Failed to import ${candidate.slug}:`, error);
    return 'failed';
  }
}

async function updateJobProgress(
  supabase: any,
  jobId: string,
  stats: ImportStats
) {
  // Use the atomic RPC to update progress/stats without overwriting other modules
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ===========================================
    // STEP 1: Validate request and authentication
    // ===========================================
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

    // ===========================================
    // STEP 2: Multi-tenant security validation
    // ===========================================
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY')!;

    // Create client with user's token to validate authentication
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userSupabase.auth.getUser();
    if (userError || !user) {
      console.error('[Categories] Auth error:', userError);
      return jsonResponse({ success: false, error: 'Usuário não autenticado', code: 'UNAUTHORIZED' });
    }

    // Service role client for data operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Fetch job to get tenant_id (DO NOT trust tenant_id from frontend)
    const { data: job, error: jobError } = await supabase
      .from('import_jobs')
      .select('id, tenant_id, status')
      .eq('id', job_id)
      .single();

    if (jobError || !job) {
      console.error('[Categories] Job not found:', jobError);
      return jsonResponse({ success: false, error: 'Job não encontrado', code: 'JOB_NOT_FOUND' });
    }

    // Validate user belongs to job's tenant
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

    // ===========================================
    // STEP 3: Update job status to processing
    // ===========================================
    await supabase
      .from('import_jobs')
      .update({ 
        status: 'processing',
        started_at: new Date().toISOString()
      })
      .eq('id', job_id);

    // ===========================================
    // STEP 4: Discover categories
    // ===========================================
    const categories = await discoverCategories(source_url, firecrawlApiKey);

    if (categories.length === 0) {
      // No categories found - complete job
      await updateJobProgress(supabase, job_id, {
        total: 0, created: 0, updated: 0, skipped: 0, failed: 0
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
        stats: { total: 0, created: 0, updated: 0, skipped: 0, failed: 0 },
        message: 'Nenhuma categoria encontrada'
      });
    }

    // ===========================================
    // STEP 5: Import categories
    // ===========================================
    const stats: ImportStats = {
      total: categories.length,
      created: 0,
      updated: 0,
      skipped: 0,
      failed: 0
    };

    for (const category of categories) {
      const result = await importCategory(supabase, tenantId, job_id, category);
      stats[result]++;

      // Update progress periodically (every 10 items)
      if ((stats.created + stats.updated + stats.skipped + stats.failed) % 10 === 0) {
        await updateJobProgress(supabase, job_id, stats);
      }
    }

    // ===========================================
    // STEP 6: Finalize job
    // ===========================================
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
      message: `Importação concluída: ${stats.created} criadas, ${stats.updated} atualizadas`
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
