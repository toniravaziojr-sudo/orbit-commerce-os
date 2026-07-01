// ============================================
// storefront-robots — robots.txt por tenant
// Onda 1 SEO / Fundação Técnica
// Servido publicamente via Worker Cloudflare (rota /robots.txt).
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveTenantFromHostname } from '../_shared/resolveTenant.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-forwarded-host',
};

// Rotas SPA-only / sensíveis — nunca devem ser indexadas
const DISALLOW_PATHS = [
  '/carrinho',
  '/cart',
  '/checkout',
  '/obrigado',
  '/rastreio',
  '/conta',
  '/minha-conta',
  '/busca',
  '/search',
  '/api/',
];

function buildRobots(sitemapUrl: string | null, blockAll = false): string {
  if (blockAll) {
    return [
      'User-agent: *',
      'Disallow: /',
      '',
    ].join('\n');
  }
  const lines: string[] = [];
  lines.push('User-agent: *');
  lines.push('Allow: /');
  for (const p of DISALLOW_PATHS) lines.push(`Disallow: ${p}`);
  lines.push('');
  if (sitemapUrl) {
    lines.push(`Sitemap: ${sitemapUrl}`);
    lines.push('');
  }
  return lines.join('\n');
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

  let body: string;
  try {
    if (!host) {
      body = buildRobots(null);
    } else {
      const resolved = await resolveTenantFromHostname(supabase, host);
      if (!resolved.found) {
        // Domínio desconhecido → bloqueia tudo para não vazar conteúdo
        body = buildRobots(null, true);
      } else {
        const sitemapUrl = `${resolved.canonical_origin}/sitemap.xml`;
        body = buildRobots(sitemapUrl);
      }
    }
  } catch (e) {
    console.error('[storefront-robots] error:', e);
    body = buildRobots(null);
  }

  return new Response(body, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/plain; charset=utf-8',
      // 1h cache (bordas do Worker também cacheiam)
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
});
