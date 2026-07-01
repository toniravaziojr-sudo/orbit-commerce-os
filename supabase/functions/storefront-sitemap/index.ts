// ============================================
// storefront-sitemap — sitemap.xml por tenant
// Onda 1 SEO / Fundação Técnica
// Contém: home, categorias ativas, produtos ativos,
// store_pages publicadas com no_index=false (institucionais + landing_pages),
// blog e posts publicados.
// Landing pages nascem com no_index=true (trigger), então só aparecem
// no sitemap quando o lojista ativar explicitamente "SEO orgânico".
// Cache 15 min. Hard cap 45.000 URLs.
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveTenantFromHostname } from '../_shared/resolveTenant.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-host',
};

const MAX_URLS = 45_000;

interface UrlEntry { loc: string; lastmod?: string; }

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toIsoDate(d: string | null | undefined): string | undefined {
  if (!d) return undefined;
  try { return new Date(d).toISOString(); } catch { return undefined; }
}

function buildSitemap(entries: UrlEntry[]): string {
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8"?>');
  parts.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
  for (const e of entries) {
    parts.push('  <url>');
    parts.push(`    <loc>${xmlEscape(e.loc)}</loc>`);
    if (e.lastmod) parts.push(`    <lastmod>${e.lastmod}</lastmod>`);
    parts.push('  </url>');
  }
  parts.push('</urlset>');
  return parts.join('\n');
}

function emptySitemap(): string {
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = new URL(req.url);
  const host = (url.searchParams.get('host') || req.headers.get('x-forwarded-host') || '').toLowerCase().trim();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  );

  let body = emptySitemap();

  try {
    if (host) {
      const resolved = await resolveTenantFromHostname(supabase, host);
      if (resolved.found) {
        const origin = resolved.canonical_origin.replace(/\/+$/, '');
        const tenantId = resolved.tenant_id;
        const entries: UrlEntry[] = [];

        // Home
        entries.push({ loc: `${origin}/` });

        // Rodar consultas em paralelo (limitadas)
        const [catsRes, prodsRes, pagesRes, postsRes] = await Promise.all([
          supabase.from('categories')
            .select('slug, updated_at')
            .eq('tenant_id', tenantId)
            .eq('is_active', true)
            .limit(5000),
          supabase.from('products')
            .select('slug, updated_at')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .is('deleted_at', null)
            .not('slug', 'is', null)
            .limit(MAX_URLS),
          supabase.from('store_pages')
            .select('slug, type, updated_at, no_index, is_published')
            .eq('tenant_id', tenantId)
            .eq('is_published', true)
            .in('type', ['institutional', 'landing_page'])
            .limit(2000),
          supabase.from('blog_posts')
            .select('slug, updated_at, published_at')
            .eq('tenant_id', tenantId)
            .eq('status', 'published')
            .limit(5000),
        ]);

        // Categorias
        for (const c of (catsRes.data ?? [])) {
          if (!c.slug) continue;
          entries.push({ loc: `${origin}/categoria/${c.slug}`, lastmod: toIsoDate(c.updated_at as any) });
          if (entries.length >= MAX_URLS) break;
        }

        // Produtos
        if (entries.length < MAX_URLS) {
          for (const p of (prodsRes.data ?? [])) {
            if (!p.slug) continue;
            entries.push({ loc: `${origin}/produto/${p.slug}`, lastmod: toIsoDate(p.updated_at as any) });
            if (entries.length >= MAX_URLS) break;
          }
        }

        // Páginas (institucional + landing) — só as indexáveis
        if (entries.length < MAX_URLS) {
          for (const pg of (pagesRes.data ?? [])) {
            if (!pg.slug) continue;
            if (pg.no_index === true) continue; // Onda 1: no_index é o campo canônico
            const prefix = pg.type === 'landing_page' ? '/lp' : '/page';
            entries.push({ loc: `${origin}${prefix}/${pg.slug}`, lastmod: toIsoDate(pg.updated_at as any) });
            if (entries.length >= MAX_URLS) break;
          }
        }

        // Blog index + posts
        if (entries.length < MAX_URLS) {
          const posts = postsRes.data ?? [];
          if (posts.length > 0) {
            entries.push({ loc: `${origin}/blog` });
          }
          for (const post of posts) {
            if (!post.slug) continue;
            entries.push({ loc: `${origin}/blog/${post.slug}`, lastmod: toIsoDate((post.updated_at || post.published_at) as any) });
            if (entries.length >= MAX_URLS) break;
          }
        }

        body = buildSitemap(entries);
      }
    }
  } catch (e) {
    console.error('[storefront-sitemap] error:', e);
    body = emptySitemap();
  }

  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/xml; charset=utf-8',
      // 15 min de cache (edge + navegador)
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  });
});
