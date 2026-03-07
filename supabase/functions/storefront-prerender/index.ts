// ============================================
// STOREFRONT PRERENDER — Server-side pre-rendering job
// v1.0.0: Orchestrates HTML generation for all public routes
// Triggered by publish flow. Calls storefront-html for each route.
// Stores results in storefront_prerendered_pages for fast serving.
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const VERSION = "v1.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PrerenderRequest {
  tenant_id: string;
  trigger_type?: 'publish' | 'product_update' | 'category_update' | 'manual';
  // Optional: only re-render specific pages
  paths?: string[];
  // Optional: specific entity IDs that changed
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

    // Auth validation
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: PrerenderRequest = await req.json();
    const { tenant_id, trigger_type = 'publish', paths, entity_ids } = body;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: 'tenant_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has access to tenant
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('tenant_id', tenant_id)
      .single();

    if (!role) {
      return new Response(JSON.stringify({ error: 'No access to tenant' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get tenant hostname for calling storefront-html
    const { data: tenant } = await supabase
      .from('tenants')
      .select('slug, custom_domain')
      .eq('id', tenant_id)
      .single();

    if (!tenant) {
      return new Response(JSON.stringify({ error: 'Tenant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use custom domain if available, otherwise platform subdomain
    const hostname = tenant.custom_domain || `${tenant.slug}.shops.comandocentral.com.br`;

    // === Determine which pages to render ===
    const pagesToRender: { path: string; page_type: string; entity_id?: string }[] = [];

    if (paths && paths.length > 0) {
      // Specific paths requested (targeted invalidation)
      for (const p of paths) {
        const pageType = getPageTypeFromPath(p);
        pagesToRender.push({ path: p, page_type: pageType });
      }
    } else {
      // Full publish: render all public pages
      
      // 1. Home
      pagesToRender.push({ path: '/', page_type: 'home' });

      // 2. All active products
      const { data: products } = await supabase
        .from('products')
        .select('id, slug')
        .eq('tenant_id', tenant_id)
        .eq('status', 'active')
        .is('deleted_at', null)
        .limit(500);

      if (products) {
        for (const p of products) {
          pagesToRender.push({
            path: `/produto/${p.slug}`,
            page_type: 'product',
            entity_id: p.id,
          });
        }
      }

      // 3. All active categories
      const { data: categories } = await supabase
        .from('categories')
        .select('id, slug')
        .eq('tenant_id', tenant_id)
        .eq('is_active', true)
        .limit(100);

      if (categories) {
        for (const c of categories) {
          pagesToRender.push({
            path: `/categoria/${c.slug}`,
            page_type: 'category',
            entity_id: c.id,
          });
        }
      }

      // 4. Published institutional pages
      const { data: storePages } = await supabase
        .from('store_pages')
        .select('id, slug')
        .eq('tenant_id', tenant_id)
        .eq('is_published', true)
        .limit(50);

      if (storePages) {
        for (const sp of storePages) {
          pagesToRender.push({
            path: `/p/${sp.slug}`,
            page_type: 'institutional',
            entity_id: sp.id,
          });
        }
      }

      // 5. Blog index + posts
      pagesToRender.push({ path: '/blog', page_type: 'blog' });

      const { data: blogPosts } = await supabase
        .from('blog_posts')
        .select('id, slug')
        .eq('tenant_id', tenant_id)
        .eq('status', 'published')
        .limit(100);

      if (blogPosts) {
        for (const bp of blogPosts) {
          pagesToRender.push({
            path: `/blog/${bp.slug}`,
            page_type: 'blog_post',
            entity_id: bp.id,
          });
        }
      }
    }

    // Create job record
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
    console.log(`[storefront-prerender] Job ${jobId}: rendering ${pagesToRender.length} pages for ${hostname}`);

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
            // Call storefront-html to get the rendered HTML
            const renderUrl = `${storefrontHtmlUrl}?hostname=${encodeURIComponent(hostname)}&path=${encodeURIComponent(page.path)}`;
            const response = await fetch(renderUrl, {
              method: 'GET',
              headers: {
                'Accept': 'text/html',
              },
            });

            if (!response.ok) {
              throw new Error(`HTTP ${response.status} for ${page.path}`);
            }

            const htmlContent = await response.text();

            // Upsert into storefront_prerendered_pages
            const { error: upsertError } = await supabase
              .from('storefront_prerendered_pages')
              .upsert(
                {
                  tenant_id,
                  path: page.path,
                  page_type: page.page_type,
                  html_content: htmlContent,
                  entity_id: page.entity_id || null,
                  status: 'active',
                  error_message: null,
                  generated_at: new Date().toISOString(),
                  metadata: {
                    source_version: VERSION,
                    storefront_html_version: response.headers.get('X-Storefront-Version') || 'unknown',
                    render_time_ms: parseInt(response.headers.get('Server-Timing')?.match(/total;dur=(\d+)/)?.[1] || '0'),
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

      // Process batch results
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
            errors: errors.slice(-20), // Keep last 20 errors
          })
          .eq('id', jobId);
      }
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

    console.log(`[storefront-prerender] Job ${jobId}: completed. ${processedPages - failedPages}/${pagesToRender.length} pages rendered, ${failedPages} failed`);

    return new Response(JSON.stringify({
      success: true,
      job_id: jobId,
      total_pages: pagesToRender.length,
      rendered: processedPages - failedPages,
      failed: failedPages,
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
