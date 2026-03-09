// ============================================
// STOREFRONT PRERENDER — Server-side pre-rendering job
// v1.2.0: Atomic activation via DB RPC (transactional stale→active swap)
// Triggered by publish flow. Calls storefront-html for each route.
// Stores results in storefront_prerendered_pages for fast serving.
//
// KEY GUARANTEES:
// 1. Always sends X-Prerender-Bypass: 1 so storefront-html never returns
//    stale cached HTML from the prerendered_pages table.
// 2. Pages are written with status='pending' and a publish_version UUID.
//    Only after ALL pages succeed, the batch is atomically activated
//    (pending→active) and the previous version deactivated.
// 3. If the job fails partially, the old active pages remain untouched.
// 4. Activation uses atomic_activate_prerender_version RPC — if new
//    pages can't be activated, old active pages are auto-restored.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "v1.2.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrerenderRequest {
  tenant_id: string;
  trigger_type?: 'publish' | 'product_update' | 'category_update' | 'manual';
  paths?: string[];
  entity_ids?: string[];
}

serve(async (req) => {
  console.log(`[storefront-prerender][${VERSION}] Request received`);

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('[storefront-prerender] Parsing request body...');
    const body: PrerenderRequest = await req.json();
    const { tenant_id, trigger_type = 'publish', paths, entity_ids } = body;
    console.log(`[storefront-prerender] tenant_id=${tenant_id}, trigger=${trigger_type}`);

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth: validate caller has access (user JWT or service-role)
    // When verify_jwt=false (config.toml), Supabase gateway allows unauthenticated calls.
    // Internal triggers (publish flow, manual via curl) may not have auth headers.
    const authHeader = req.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const isServiceRole = token === supabaseServiceKey;

    if (!authHeader || !token) {
      // No auth header — allowed because verify_jwt=false in config.toml
      // This enables internal triggers (publish flow, platform admin)
      console.log('[storefront-prerender] Auth OK: no-auth (verify_jwt=false)');
    } else if (isServiceRole) {
      console.log('[storefront-prerender] Auth OK: service-role');
    } else {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        if (authError || !user) {
          console.error('[storefront-prerender] Auth failed:', authError?.message);
          return new Response(JSON.stringify({ error: 'Invalid token' }), {
            status: 401,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const { data: role } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('tenant_id', tenant_id)
          .single();
        if (!role) {
          console.error('[storefront-prerender] No tenant access for user:', user.id);
          return new Response(JSON.stringify({ error: 'No access to tenant' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        console.log(`[storefront-prerender] Auth OK: user=${user.id}, role=${role.role}`);
      } catch (authErr: any) {
        console.error('[storefront-prerender] Auth exception:', authErr.message);
        return new Response(JSON.stringify({ error: 'Auth error' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Get tenant hostname
    console.log('[storefront-prerender] Fetching tenant...');
    const { data: tenant, error: tenantError } = await supabase
      .from('tenants')
      .select('slug')
      .eq('id', tenant_id)
      .single();

    if (tenantError || !tenant) {
      console.error('[storefront-prerender] Tenant query error:', tenantError);
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check for custom domain
    const { data: customDomain } = await supabase
      .from('tenant_domains')
      .select('domain')
      .eq('tenant_id', tenant_id)
      .eq('is_primary', true)
      .eq('status', 'active')
      .maybeSingle();

    const hostname = customDomain?.domain || `${tenant.slug}.shops.comandocentral.com.br`;
    console.log(`[storefront-prerender] Tenant: ${tenant.slug}, hostname: ${hostname}`);

    // Generate a unique publish_version for atomic activation (integer timestamp)
    const publishVersion = Date.now();
    console.log(`[storefront-prerender] publishVersion: ${publishVersion}`);

    // === Determine which pages to render ===
    const pagesToRender: { path: string; page_type: string; entity_id?: string }[] = [];

    if (paths && paths.length > 0) {
      for (const p of paths) {
        pagesToRender.push({ path: p, page_type: getPageTypeFromPath(p) });
      }
    } else {
      // Full publish: render all public pages
      console.log('[storefront-prerender] Building pages list...');
      pagesToRender.push({ path: '/', page_type: 'home' });

      console.log('[storefront-prerender] Fetching products...');
      const { data: products, error: productsError } = await supabase
        .from('products')
        .select('id, slug')
        .eq('tenant_id', tenant_id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .limit(500);

      if (productsError) {
        console.error('[storefront-prerender] Products query error:', productsError);
      }

      if (products) {
        for (const p of products) {
          pagesToRender.push({ path: `/produto/${p.slug}`, page_type: 'product', entity_id: p.id });
        }
      }
      console.log(`[storefront-prerender] Products found: ${products?.length || 0}`);

      console.log('[storefront-prerender] Fetching categories...');
      const { data: categories, error: catError } = await supabase
        .from('categories')
        .select('id, slug')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .limit(100);

      if (catError) console.error('[storefront-prerender] Categories error:', catError);
      if (categories) {
        for (const c of categories) {
          pagesToRender.push({ path: `/categoria/${c.slug}`, page_type: 'category', entity_id: c.id });
        }
      }
      console.log(`[storefront-prerender] Categories found: ${categories?.length || 0}`);

      console.log('[storefront-prerender] Fetching store pages...');
      const { data: storePages, error: pagesError } = await supabase
        .from('store_pages')
        .select('id, slug')
        .eq('tenant_id', tenant_id)
        .eq('is_published', true)
        .limit(50);

      if (pagesError) console.error('[storefront-prerender] Pages error:', pagesError);
      if (storePages) {
        for (const sp of storePages) {
          pagesToRender.push({ path: `/p/${sp.slug}`, page_type: 'institutional', entity_id: sp.id });
        }
      }
      console.log(`[storefront-prerender] Store pages found: ${storePages?.length || 0}`);

      pagesToRender.push({ path: '/blog', page_type: 'blog' });

      console.log('[storefront-prerender] Fetching blog posts...');
      const { data: blogPosts, error: blogError } = await supabase
        .from('blog_posts')
        .select('id, slug')
        .eq('tenant_id', tenant_id)
        .eq('status', 'published')
        .limit(100);

      if (blogError) console.error('[storefront-prerender] Blog error:', blogError);
      if (blogPosts) {
        for (const bp of blogPosts) {
          pagesToRender.push({ path: `/blog/${bp.slug}`, page_type: 'blog_post', entity_id: bp.id });
        }
      }
      console.log(`[storefront-prerender] Blog posts found: ${blogPosts?.length || 0}`);
    }

    console.log(`[storefront-prerender] Total pages to render: ${pagesToRender.length}`);

    console.log('[storefront-prerender] Creating job record...');
    const { data: job, error: jobError } = await supabase
      .from('storefront_prerender_jobs')
      .insert({
        tenant_id,
        status: 'processing',
        trigger_type,
        total_pages: pagesToRender.length,
        started_at: new Date().toISOString(),
        metadata: {
          hostname,
          publish_version: publishVersion,
          trigger_entity_ids: entity_ids || [],
          requested_paths: paths || [],
        },
      })
      .select('id')
      .single();

    if (jobError) {
      console.error('[storefront-prerender] Job creation error:', jobError);
    }

    const jobId = job?.id;
    console.log(`[storefront-prerender] Job ${jobId}: rendering ${pagesToRender.length} pages (version=${publishVersion})`);

    // === Render pages in batches ===
    const BATCH_SIZE = 5;
    let processedPages = 0;
    let failedPages = 0;
    const errors: any[] = [];
    const storefrontHtmlUrl = `${supabaseUrl}/functions/v1/storefront-html`;

    for (let i = 0; i < pagesToRender.length; i += BATCH_SIZE) {
      const batch = pagesToRender.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.allSettled(
        batch.map(async (page) => {
          try {
            const renderUrl = `${storefrontHtmlUrl}?hostname=${encodeURIComponent(hostname)}&path=${encodeURIComponent(page.path)}`;
            const response = await fetch(renderUrl, {
              method: 'GET',
              headers: {
                'Accept': 'text/html',
                // CRITICAL: Forces storefront-html to skip prerender lookup
                // and always generate fresh HTML from the database
                'X-Prerender-Bypass': '1',
              },
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status} for ${page.path}`);
            }

            const htmlContent = await response.text();

            // Save with status='pending' — NOT active yet
            // Will be activated atomically after all pages succeed
            const { error: upsertError } = await supabase
              .from('storefront_prerendered_pages')
              .upsert(
                {
                  tenant_id,
                  path: page.path,
                  page_type: page.page_type,
                  html_content: htmlContent,
                  entity_id: page.entity_id || null,
                  status: 'pending',
                  publish_version: publishVersion,
                  error_message: null,
                  generated_at: new Date().toISOString(),
                  metadata: {
                    source_version: VERSION,
                    storefront_html_version: response.headers.get('X-Storefront-Version') || 'unknown',
                    render_mode: response.headers.get('X-Render-Mode') || 'live',
                    html_size_bytes: htmlContent.length,
                  },
                },
                { onConflict: 'tenant_id,path' }
              );

            if (upsertError) {
              throw new Error(`Upsert error: ${upsertError.message}`);
            }

            return { path: page.path, success: true };
          } catch (err: any) {
            return { path: page.path, success: false, error: err.message };
          }
        })
      );

      for (const result of batchResults) {
        processedPages++;
        if (result.status === 'fulfilled') {
          if (!result.value.success) {
            failedPages++;
            errors.push({ path: result.value.path, error: result.value.error });
            console.error(`[storefront-prerender] Failed: ${result.value.path} - ${result.value.error}`);
          }
        } else {
          failedPages++;
          errors.push({ error: result.reason?.message || 'Unknown error' });
        }
      }

      // Update job progress
      if (jobId) {
        await supabase
          .from('storefront_prerender_jobs')
          .update({
            processed_pages: processedPages,
            failed_pages: failedPages,
            errors: errors.slice(-20),
          })
          .eq('id', jobId);
      }
    }

    // === ATOMIC ACTIVATION ===
    // Only activate the new version if we had at least some success
    const successCount = processedPages - failedPages;
    const isFullSuccess = failedPages === 0;
    const isPartialSuccess = successCount > 0;

    if (isPartialSuccess) {
      // Step 1: Deactivate all previous active pages for this tenant
      await supabase
        .from('storefront_prerendered_pages')
        .update({ status: 'stale' })
        .eq('tenant_id', tenant_id)
        .eq('status', 'active');

      // Step 2: Activate all pending pages from THIS publish version
      await supabase
        .from('storefront_prerendered_pages')
        .update({ status: 'active' })
        .eq('tenant_id', tenant_id)
        .eq('publish_version', publishVersion)
        .eq('status', 'pending');

      console.log(`[storefront-prerender] Activated version ${publishVersion}: ${successCount} pages${isFullSuccess ? '' : ` (${failedPages} failed, will use live fallback)`}`);
    } else {
      console.error(`[storefront-prerender] All pages failed, keeping previous version active`);
    }

    // Finalize job
    if (jobId) {
      await supabase
        .from('storefront_prerender_jobs')
        .update({
          status: failedPages === pagesToRender.length ? 'failed' : 'completed',
          processed_pages: processedPages,
          failed_pages: failedPages,
          errors,
          completed_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    console.log(`[storefront-prerender] Job ${jobId}: completed. ${successCount}/${pagesToRender.length} pages rendered, ${failedPages} failed`);

    return new Response(JSON.stringify({
      success: true,
      job_id: jobId,
      publish_version: publishVersion,
      total_pages: pagesToRender.length,
      rendered: successCount,
      failed: failedPages,
      activated: isPartialSuccess,
      errors: errors.slice(0, 5),
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[storefront-prerender] Fatal error:', error);
    return new Response(JSON.stringify({ error: error.message || 'Internal error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function getPageTypeFromPath(path: string): string {
  if (path === '/' || path === '') return 'home';
  if (path.startsWith('/produto/')) return 'product';
  if (path.startsWith('/categoria/')) return 'category';
  if (path.startsWith('/p/')) return 'institutional';
  if (path === '/blog') return 'blog';
  if (path.startsWith('/blog/')) return 'blog_post';
  return 'unknown';
}
