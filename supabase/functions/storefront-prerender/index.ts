// ============================================
// STOREFRONT PRERENDER — Server-side pre-rendering job
// v2.0.0 (Onda 19):
//   - Scope-aware invalidation (publishes only what changed)
//   - Resilience: 429 retry with Retry-After, stragglers serial queue
//   - Smaller batches + sleep to avoid platform rate-limits
//   - Status `partial` when failures persist (cron reconcile picks up)
//   - Metrics: retried_pages, straggler_count, total_429
//
// SCOPE CONTRACT:
//   { tenant_id, scope: { type: 'global' | 'product' | 'category' | 'home' | 'page' | 'post', ids?: string[] } }
//   - Backwards-compatible: if `paths` is given, behaves like before.
//   - Backwards-compatible: if neither `scope` nor `paths`, defaults to `{ type: 'global' }`.
// ============================================
import { createClient } from "npm:@supabase/supabase-js@2";
import { errorResponse } from "../_shared/error-response.ts";

const VERSION = "v2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type ScopeType = 'global' | 'product' | 'category' | 'home' | 'page' | 'post';

interface PrerenderScope {
  type: ScopeType;
  ids?: string[];
}

interface PrerenderRequest {
  tenant_id: string;
  trigger_type?: 'publish' | 'product_update' | 'category_update' | 'menu_update' | 'manual' | 'reconcile';
  paths?: string[];
  entity_ids?: string[];
  scope?: PrerenderScope;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Parse Retry-After from response (header or body message like "Retry after 45581ms")
function parseRetryAfterMs(response: Response, bodyText?: string): number {
  const header = response.headers.get('retry-after');
  if (header) {
    const n = parseInt(header, 10);
    if (!isNaN(n)) return Math.min(n * 1000, 60000);
  }
  if (bodyText) {
    const match = bodyText.match(/Retry after (\d+)ms/i);
    if (match) return Math.min(parseInt(match[1], 10), 60000);
  }
  return 5000; // default fallback
}

Deno.serve(async (req) => {
  console.log(`[storefront-prerender][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: PrerenderRequest = await req.json();
    const { tenant_id, trigger_type = 'publish', paths, scope: rawScope } = body;
    const scope: PrerenderScope = rawScope || (paths && paths.length ? { type: 'global' } : { type: 'global' });
    console.log(`[storefront-prerender] tenant_id=${tenant_id}, trigger=${trigger_type}, scope=${JSON.stringify(scope)}`);

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth (verify_jwt=false)
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const isServiceRole = token === supabaseServiceKey;
    if (!authHeader || !token) {
      console.log('[storefront-prerender] Auth OK: no-auth (verify_jwt=false)');
    } else if (isServiceRole) {
      console.log('[storefront-prerender] Auth OK: service-role');
    } else {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
        const { data: role } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('tenant_id', tenant_id)
          .single();
        if (!role) {
          return new Response(JSON.stringify({ error: 'No access to tenant' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (authErr: any) {
        return new Response(JSON.stringify({ error: 'Auth error' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
    }

    // Tenant + hostname
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants').select('slug').eq('id', tenant_id).single();
    if (tenantError || !tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    const { data: customDomain } = await supabase
      .from('tenant_domains').select('domain')
      .eq('tenant_id', tenant_id).eq('is_primary', true).eq('status', 'active').maybeSingle();
    const hostname = customDomain?.domain || `${tenant.slug}.shops.comandocentral.com.br`;
    console.log(`[storefront-prerender] hostname=${hostname}`);

    const publishVersion = Date.now();

    // === Build pagesToRender based on scope ===
    const pagesToRender: { path: string; page_type: string; entity_id?: string }[] = [];

    if (paths && paths.length > 0) {
      // Legacy explicit paths
      for (const p of paths) pagesToRender.push({ path: p, page_type: getPageTypeFromPath(p) });
    } else if (scope.type === 'home') {
      pagesToRender.push({ path: '/', page_type: 'home' });
    } else if (scope.type === 'product' && scope.ids?.length) {
      const { data: products } = await supabase
        .from('products').select('id, slug')
        .eq('tenant_id', tenant_id).in('id', scope.ids).is('deleted_at', null);
      for (const p of (products || [])) {
        pagesToRender.push({ path: `/produto/${p.slug}`, page_type: 'product', entity_id: p.id });
      }
    } else if (scope.type === 'category' && scope.ids?.length) {
      const { data: cats } = await supabase
        .from('categories').select('id, slug')
        .eq('tenant_id', tenant_id).in('id', scope.ids);
      for (const c of (cats || [])) {
        pagesToRender.push({ path: `/categoria/${c.slug}`, page_type: 'category', entity_id: c.id });
      }
    } else if (scope.type === 'page' && scope.ids?.length) {
      const { data: pgs } = await supabase
        .from('store_pages').select('id, slug')
        .eq('tenant_id', tenant_id).in('id', scope.ids).eq('is_published', true);
      for (const sp of (pgs || [])) {
        pagesToRender.push({ path: `/page/${sp.slug}`, page_type: 'institutional', entity_id: sp.id });
      }
    } else if (scope.type === 'post' && scope.ids?.length) {
      const { data: posts } = await supabase
        .from('blog_posts').select('id, slug')
        .eq('tenant_id', tenant_id).in('id', scope.ids).eq('status', 'published');
      for (const bp of (posts || [])) {
        pagesToRender.push({ path: `/blog/${bp.slug}`, page_type: 'blog_post', entity_id: bp.id });
      }
    } else {
      // GLOBAL — render everything
      pagesToRender.push({ path: '/', page_type: 'home' });
      const { data: products } = await supabase
        .from('products').select('id, slug').eq('tenant_id', tenant_id)
        .eq('status', 'active').is('deleted_at', null).limit(500);
      for (const p of (products || [])) pagesToRender.push({ path: `/produto/${p.slug}`, page_type: 'product', entity_id: p.id });

      const { data: categories } = await supabase
        .from('categories').select('id, slug').eq('tenant_id', tenant_id).eq('is_active', true).limit(100);
      for (const c of (categories || [])) pagesToRender.push({ path: `/categoria/${c.slug}`, page_type: 'category', entity_id: c.id });

      const { data: storePages } = await supabase
        .from('store_pages').select('id, slug').eq('tenant_id', tenant_id).eq('is_published', true).limit(50);
      for (const sp of (storePages || [])) pagesToRender.push({ path: `/page/${sp.slug}`, page_type: 'institutional', entity_id: sp.id });

      pagesToRender.push({ path: '/blog', page_type: 'blog' });
      const { data: blogPosts } = await supabase
        .from('blog_posts').select('id, slug').eq('tenant_id', tenant_id).eq('status', 'published').limit(100);
      for (const bp of (blogPosts || [])) pagesToRender.push({ path: `/blog/${bp.slug}`, page_type: 'blog_post', entity_id: bp.id });
    }

    console.log(`[storefront-prerender] Total pages to render: ${pagesToRender.length} (scope=${scope.type})`);

    // Job record
    const { data: job } = await supabase
      .from('storefront_prerender_jobs')
      .insert({
        tenant_id,
        status: 'running',
        trigger_type,
        total_pages: pagesToRender.length,
        publish_version: publishVersion,
        metadata: { scope, version: VERSION },
      })
      .select('id').single();
    const jobId = job?.id;

    const storefrontHtmlUrl = `${supabaseUrl}/functions/v1/storefront-html`;
    const errors: any[] = [];
    let processedPages = 0;
    let failedPages = 0;
    let retriedPages = 0;
    let total429 = 0;

    // Fetch one page with retry on 429 (up to 3 attempts, recreating fetch each time)
    async function fetchPageWithRetry(page: { path: string; page_type: string; entity_id?: string }, maxAttempts = 3): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
      let attempt = 0;
      while (attempt < maxAttempts) {
        attempt++;
        const renderUrl = `${storefrontHtmlUrl}?hostname=${encodeURIComponent(hostname)}&path=${encodeURIComponent(page.path)}`;
        try {
          const response = await fetch(renderUrl, {
            method: 'GET',
            headers: { 'Accept': 'text/html', 'X-Prerender-Bypass': '1' },
          });

          if (response.status === 429) {
            total429++;
            const text = await response.text().catch(() => '');
            const waitMs = parseRetryAfterMs(response, text);
            console.warn(`[storefront-prerender] 429 on ${page.path}, waiting ${waitMs}ms (attempt ${attempt}/${maxAttempts})`);
            if (attempt < maxAttempts) {
              await sleep(waitMs);
              retriedPages++;
              continue;
            }
            return { ok: false, error: `Rate limit after ${maxAttempts} attempts (last wait ${waitMs}ms)` };
          }

          if (!response.ok) {
            // 5xx → retry once with backoff; 4xx → fail immediately
            if (response.status >= 500 && attempt < maxAttempts) {
              await sleep(1000 * attempt);
              retriedPages++;
              continue;
            }
            return { ok: false, error: `HTTP ${response.status}` };
          }

          const html = await response.text();
          return { ok: true, html };
        } catch (err: any) {
          if (attempt < maxAttempts) {
            await sleep(1000 * attempt);
            retriedPages++;
            continue;
          }
          return { ok: false, error: err.message || 'fetch error' };
        }
      }
      return { ok: false, error: 'unknown' };
    }

    async function persistPage(page: { path: string; page_type: string; entity_id?: string }, html: string, sourceVersion: string, renderMode: string) {
      const { error: upsertError } = await supabase
        .from('storefront_prerendered_pages')
        .upsert({
          tenant_id,
          path: page.path,
          page_type: page.page_type,
          html_content: html,
          entity_id: page.entity_id || null,
          status: 'pending',
          publish_version: publishVersion,
          error_message: null,
          generated_at: new Date().toISOString(),
          metadata: {
            source_version: VERSION,
            storefront_html_version: sourceVersion,
            render_mode: renderMode,
            html_size_bytes: html.length,
          },
        }, { onConflict: 'tenant_id,path' });
      if (upsertError) throw new Error(`Upsert error: ${upsertError.message}`);
    }

    // === Render in batches of 3 with 750ms pause ===
    const BATCH_SIZE = 3;
    const BATCH_PAUSE_MS = 750;
    const stragglers: typeof pagesToRender = [];

    for (let i = 0; i < pagesToRender.length; i += BATCH_SIZE) {
      const batch = pagesToRender.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(
        batch.map(async (page) => {
          const result = await fetchPageWithRetry(page, 3);
          if (!result.ok) {
            // If failure was rate-limit related, send to stragglers; otherwise hard fail now
            if (result.error.startsWith('Rate limit')) {
              stragglers.push(page);
              return { path: page.path, success: false, error: result.error, deferred: true };
            }
            return { path: page.path, success: false, error: result.error, deferred: false };
          }
          try {
            await persistPage(page, result.html, 'unknown', 'live');
            return { path: page.path, success: true };
          } catch (e: any) {
            return { path: page.path, success: false, error: e.message, deferred: false };
          }
        })
      );

      for (const result of batchResults) {
        processedPages++;
        if (result.status === 'fulfilled') {
          if (!result.value.success && !result.value.deferred) {
            failedPages++;
            errors.push({ path: result.value.path, error: result.value.error });
          }
        } else {
          failedPages++;
          errors.push({ error: result.reason?.message || 'Unknown error' });
        }
      }

      if (jobId) {
        await supabase.from('storefront_prerender_jobs').update({
          processed_pages: processedPages,
          failed_pages: failedPages,
          errors: errors.slice(-20),
          metadata: { scope, version: VERSION, retried_pages: retriedPages, total_429: total429, straggler_count: stragglers.length },
        }).eq('id', jobId);
      }

      if (i + BATCH_SIZE < pagesToRender.length) {
        await sleep(BATCH_PAUSE_MS);
      }
    }

    // === Process stragglers SERIALLY with 2s gap ===
    if (stragglers.length > 0) {
      console.log(`[storefront-prerender] Processing ${stragglers.length} stragglers serially`);
      for (const page of stragglers) {
        await sleep(2000);
        const result = await fetchPageWithRetry(page, 3);
        if (!result.ok) {
          failedPages++;
          errors.push({ path: page.path, error: `straggler-failed: ${result.error}` });
        } else {
          try {
            await persistPage(page, result.html, 'unknown', 'live');
          } catch (e: any) {
            failedPages++;
            errors.push({ path: page.path, error: `straggler-persist: ${e.message}` });
          }
        }
      }
    }

    // === Atomic activation ===
    const successCount = pagesToRender.length - failedPages;
    const isPartialSuccess = successCount > 0;
    const isFullSuccess = failedPages === 0;

    if (isPartialSuccess) {
      const { data: activationResult, error: activationError } = await supabase
        .rpc('atomic_activate_prerender_version', { p_tenant_id: tenant_id, p_publish_version: publishVersion });
      if (activationError) {
        console.error(`[storefront-prerender] Atomic activation error:`, activationError);
      } else if (activationResult && !activationResult.success) {
        console.error(`[storefront-prerender] Activation rolled back: ${activationResult.error}`);
      } else {
        console.log(`[storefront-prerender] Activated v${publishVersion}: ${activationResult?.activated || successCount} pages`);
      }
    }

    // Job final status: completed (full ok) | partial (some failed, will be reconciled) | failed (all failed)
    const finalStatus = failedPages === 0 ? 'completed' : (failedPages === pagesToRender.length ? 'failed' : 'partial');

    if (jobId) {
      await supabase.from('storefront_prerender_jobs').update({
        status: finalStatus,
        processed_pages: processedPages,
        failed_pages: failedPages,
        errors,
        completed_at: new Date().toISOString(),
        metadata: {
          scope,
          version: VERSION,
          retried_pages: retriedPages,
          total_429: total429,
          straggler_count: stragglers.length,
        },
      }).eq('id', jobId);
    }

    console.log(`[storefront-prerender] Job ${jobId}: ${finalStatus}. ${successCount}/${pagesToRender.length} ok, ${failedPages} failed, ${retriedPages} retried, ${total429} 429s, ${stragglers.length} stragglers`);

    return new Response(JSON.stringify({
      success: true,
      job_id: jobId,
      publish_version: publishVersion,
      scope,
      total_pages: pagesToRender.length,
      rendered: successCount,
      failed: failedPages,
      retried: retriedPages,
      stragglers: stragglers.length,
      total_429: total429,
      activated: isPartialSuccess,
      status: finalStatus,
      errors: errors.slice(0, 5),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[storefront-prerender] Fatal error:', error);
    return new Response(JSON.stringify({ error: "Erro interno. Se o problema persistir, entre em contato com o suporte." }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getPageTypeFromPath(path: string): string {
  if (path === '/' || path === '') return 'home';
  if (path.startsWith('/produto/')) return 'product';
  if (path.startsWith('/categoria/')) return 'category';
  if (path.startsWith('/page/')) return 'institutional';
  if (path.startsWith('/p/')) return 'institutional';
  if (path === '/blog') return 'blog';
  if (path.startsWith('/blog/')) return 'blog_post';
  return 'unknown';
}
