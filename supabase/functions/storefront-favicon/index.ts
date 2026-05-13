// ============================================
// STOREFRONT FAVICON - Edge Function
// Resolves favicon (multi-size) for tenant storefronts.
// - Crawlers (Google) request /favicon.ico directly; Cloudflare Worker
//   proxies those requests here.
// - Returns 302 redirect to the tenant's stored favicon (or platform fallback).
// - Special path: /site.webmanifest -> dynamic JSON with tenant identity.
//
// Public, cacheable, no JWT.
// ============================================

import { createClient } from 'npm:@supabase/supabase-js@2';
import { resolveTenantFromHostname } from '../_shared/resolveTenant.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Platform fallback (Comando Central) - absolute URLs so 302 always works.
const PLATFORM_FALLBACK = {
  ico: 'https://app.comandocentral.com.br/favicon.ico',
  '16': 'https://app.comandocentral.com.br/favicon-16x16.png',
  '32': 'https://app.comandocentral.com.br/favicon-32x32.png',
  '48': 'https://app.comandocentral.com.br/favicon-32x32.png',
  '180': 'https://app.comandocentral.com.br/apple-touch-icon.png',
  '192': 'https://app.comandocentral.com.br/android-chrome-192x192.png',
  '512': 'https://app.comandocentral.com.br/android-chrome-512x512.png',
  svg: 'https://app.comandocentral.com.br/favicon.svg',
};

// wsrv.nl image proxy - lets us serve any tenant image at any size.
function wsrvUrl(src: string, size: number, format: 'png' | 'webp' = 'png'): string {
  const u = new URL('https://wsrv.nl/');
  u.searchParams.set('url', src.replace(/^https?:\/\//, ''));
  u.searchParams.set('w', String(size));
  u.searchParams.set('h', String(size));
  u.searchParams.set('fit', 'cover');
  u.searchParams.set('output', format);
  u.searchParams.set('q', '90');
  return u.toString();
}

interface SizeInfo { size: number; isIco: boolean; }

function parseSize(sizeParam: string | null): SizeInfo {
  if (!sizeParam) return { size: 32, isIco: true };
  if (sizeParam === 'ico') return { size: 32, isIco: true };
  const n = parseInt(sizeParam, 10);
  if (Number.isFinite(n) && n >= 16 && n <= 1024) return { size: n, isIco: false };
  return { size: 32, isIco: true };
}

function pickStoredFavicon(
  faviconFiles: Record<string, string> | null | undefined,
  faviconUrl: string | null | undefined,
  size: number,
): string | null {
  if (faviconFiles && typeof faviconFiles === 'object') {
    // Try exact size, then closest larger, then closest smaller.
    const available = Object.keys(faviconFiles)
      .map((k) => ({ k, n: parseInt(k, 10) }))
      .filter((x) => Number.isFinite(x.n) && faviconFiles[x.k]);
    if (available.length) {
      const exact = available.find((x) => x.n === size);
      if (exact) return faviconFiles[exact.k];
      const larger = available.filter((x) => x.n >= size).sort((a, b) => a.n - b.n)[0];
      if (larger) return faviconFiles[larger.k];
      const smaller = available.sort((a, b) => b.n - a.n)[0];
      if (smaller) return faviconFiles[smaller.k];
    }
  }
  return faviconUrl || null;
}

function fallbackFor(size: number, isIco: boolean): string {
  if (isIco) return PLATFORM_FALLBACK.ico;
  if (size <= 16) return PLATFORM_FALLBACK['16'];
  if (size <= 32) return PLATFORM_FALLBACK['32'];
  if (size <= 48) return PLATFORM_FALLBACK['48'];
  if (size <= 180) return PLATFORM_FALLBACK['180'];
  if (size <= 192) return PLATFORM_FALLBACK['192'];
  return PLATFORM_FALLBACK['512'];
}

function redirect(target: string, cacheSeconds: number): Response {
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      Location: target,
      'Cache-Control': `public, max-age=${cacheSeconds}, s-maxage=${cacheSeconds}`,
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const host = (url.searchParams.get('host') || req.headers.get('x-forwarded-host') || '').toLowerCase().trim();
    const sizeParam = url.searchParams.get('size');
    const kind = url.searchParams.get('kind'); // 'manifest' for /site.webmanifest

    if (!host) {
      // No host context -> always fall back to platform favicon.
      const { size, isIco } = parseSize(sizeParam);
      return redirect(fallbackFor(size, isIco), 3600);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const resolved = await resolveTenantFromHostname(supabase, host);

    // Manifest request -> dynamic JSON
    if (kind === 'manifest') {
      let storeName = 'Loja';
      let icon192 = PLATFORM_FALLBACK['192'];
      let icon512 = PLATFORM_FALLBACK['512'];
      let themeColor = '#ffffff';
      let bgColor = '#ffffff';

      if (resolved.found) {
        const { data: ss } = await supabase
          .from('store_settings')
          .select('store_name, favicon_url, favicon_files, primary_color, secondary_color')
          .eq('tenant_id', resolved.tenant_id)
          .maybeSingle();

        if (ss?.store_name) storeName = ss.store_name;
        if (ss?.primary_color && /^#[0-9a-f]{6}$/i.test(ss.primary_color)) themeColor = ss.primary_color;
        if (ss?.secondary_color && /^#[0-9a-f]{6}$/i.test(ss.secondary_color)) bgColor = ss.secondary_color;

        const src192 = pickStoredFavicon(ss?.favicon_files as any, ss?.favicon_url, 192);
        const src512 = pickStoredFavicon(ss?.favicon_files as any, ss?.favicon_url, 512);
        if (src192) icon192 = wsrvUrl(src192, 192, 'png');
        if (src512) icon512 = wsrvUrl(src512, 512, 'png');
      }

      const manifest = {
        name: storeName,
        short_name: storeName.slice(0, 12),
        icons: [
          { src: icon192, sizes: '192x192', type: 'image/png' },
          { src: icon512, sizes: '512x512', type: 'image/png' },
        ],
        theme_color: themeColor,
        background_color: bgColor,
        display: 'standalone',
      };

      return new Response(JSON.stringify(manifest), {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/manifest+json; charset=utf-8',
          'Cache-Control': 'public, max-age=3600, s-maxage=86400',
        },
      });
    }

    // Image redirect path
    const { size, isIco } = parseSize(sizeParam);

    if (!resolved.found) {
      return redirect(fallbackFor(size, isIco), 600);
    }

    const { data: ss } = await supabase
      .from('store_settings')
      .select('favicon_url, favicon_files')
      .eq('tenant_id', resolved.tenant_id)
      .maybeSingle();

    const src = pickStoredFavicon(ss?.favicon_files as any, ss?.favicon_url, size);
    if (!src) {
      return redirect(fallbackFor(size, isIco), 3600);
    }

    // .ico requests -> serve a 32x32 PNG via wsrv (browsers/crawlers accept this).
    const target = wsrvUrl(src, isIco ? 32 : size, 'png');
    return redirect(target, 86400); // 24h cache
  } catch (err) {
    console.error('[storefront-favicon] error:', err);
    // Never fail the request - always serve a favicon.
    return redirect(PLATFORM_FALLBACK.ico, 300);
  }
});
