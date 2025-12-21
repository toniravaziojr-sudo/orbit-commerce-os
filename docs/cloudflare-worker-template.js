/**
 * Cloudflare Worker - Multi-tenant SaaS Router (TRANSPARENT PROXY)
 * 
 * OBJETIVO FINAL:
 * - URL LIMPA no navegador (sem /store/{tenant})
 * - Domínio custom é o canônico quando existe
 * - Subdomínio padrão redireciona 301 para o custom quando existe
 * 
 * ESTRATÉGIA CORRETA:
 * - O Worker faz PROXY TRANSPARENTE (NÃO adiciona /store/{tenant})
 * - O React App detecta tenant host e usa rotas na RAIZ
 * - O Worker só resolve tenant, canonicaliza hosts, e faz SPA fallback
 * 
 * ENV VARIABLES (configure no Cloudflare):
 * - ORIGIN_HOST: origin do app (ex: orbit-commerce-os.lovable.app)
 * - SUPABASE_URL: URL do projeto Supabase
 * - SUPABASE_ANON_KEY: Anon key do Supabase
 */

const PLATFORM_SUBDOMAIN_RE = /^([a-z0-9-]+)\.shops\.comandocentral\.com\.br$/i;
const RESOLVE_CACHE_TTL = 300;

// Paths que sempre vão para a raiz do origin (assets do Vite)
const STATIC_PATHS = [
  '/assets/',
  '/@vite/',
  '/node_modules/',
  '/src/',
  '/favicon',
  '/robots.txt',
  '/sitemap',
  '/manifest',
];

function isStaticPath(pathname) {
  const p = pathname.toLowerCase();
  return STATIC_PATHS.some(prefix => p.startsWith(prefix) || p === prefix.replace(/\/$/, ''));
}

function cleanPreviewParams(search) {
  if (!search) return '';
  const params = new URLSearchParams(search.replace(/^\?/, ''));
  params.delete('preview');
  params.delete('previewId');
  params.delete('previewToken');
  params.delete('draft');
  const out = params.toString();
  return out ? `?${out}` : '';
}

async function resolveTenant(hostname, env) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    // Fallback: extract from platform subdomain
    const match = hostname.match(PLATFORM_SUBDOMAIN_RE);
    if (match) {
      return { tenantSlug: match[1], primaryPublicHost: null, domainType: 'platform_subdomain' };
    }
    return null;
  }

  // Try cache first
  const cacheKey = new Request(`https://resolve-cache.internal/${hostname}`);
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const data = await cached.json();
      if (data?.tenantSlug) return data;
    }
  } catch {}

  try {
    const endpoint = `${SUPABASE_URL}/functions/v1/resolve-domain`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ hostname }),
    });

    if (res.ok) {
      const data = await res.json();
      const tenantSlug = data.tenant_slug || data.tenantSlug;
      const primaryPublicHost = data.primary_public_host || data.primaryPublicHost || null;
      const domainType = data.domain_type || 'custom';

      if (data.found && tenantSlug) {
        const result = { tenantSlug, primaryPublicHost, domainType };
        try {
          await caches.default.put(
            cacheKey,
            new Response(JSON.stringify(result), {
              headers: { 'Cache-Control': `max-age=${RESOLVE_CACHE_TTL}` },
            })
          );
        } catch {}
        return result;
      }
    }
  } catch (e) {
    console.error('[resolveTenant] Error:', e);
  }

  // Fallback for platform subdomain
  const match = hostname.match(PLATFORM_SUBDOMAIN_RE);
  if (match) {
    return { tenantSlug: match[1], primaryPublicHost: null, domainType: 'platform_subdomain' };
  }

  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ORIGIN_HOST = env.ORIGIN_HOST || 'orbit-commerce-os.lovable.app';

    // Get the public hostname (what the user sees)
    const edgeHost = url.hostname.toLowerCase();
    
    // Ignore workers.dev
    if (edgeHost.endsWith('.workers.dev')) {
      return new Response('Access via correct domain', { status: 404 });
    }

    // Use cf-connecting-host if available (original user host)
    const cfHost = request.headers.get('cf-connecting-host');
    const publicHost = (cfHost || edgeHost).toLowerCase().replace(/^www\./, '');

    // ========== DEBUG ENDPOINT ==========
    if (url.pathname === '/_debug' || url.pathname === '/_health') {
      const resolved = await resolveTenant(publicHost, env);
      const isCanonical = resolved?.primaryPublicHost 
        ? publicHost === resolved.primaryPublicHost.toLowerCase().replace(/^www\./, '')
        : true;

      return new Response(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          hostname: publicHost,
          edgeHost,
          path: url.pathname,
          envConfigured: {
            ORIGIN_HOST: !!ORIGIN_HOST,
            SUPABASE_URL: !!env.SUPABASE_URL,
            SUPABASE_ANON_KEY: !!env.SUPABASE_ANON_KEY,
          },
          resolved: {
            tenantSlug: resolved?.tenantSlug || null,
            primaryPublicHost: resolved?.primaryPublicHost || null,
            domainType: resolved?.domainType || null,
          },
          isCanonical,
          strategy: 'transparent_proxy',
          status: resolved?.tenantSlug ? 'OK' : 'TENANT_NOT_FOUND',
        }, null, 2),
        { 
          status: 200, 
          headers: { 
            'Content-Type': 'application/json', 
            'Cache-Control': 'no-store',
            'Access-Control-Allow-Origin': '*',
          } 
        }
      );
    }

    // ========== ROOT SHOPS DOMAIN ==========
    if (publicHost === 'shops.comandocentral.com.br') {
      return Response.redirect('https://app.comandocentral.com.br/', 302);
    }

    // ========== RESOLVE TENANT ==========
    const resolved = await resolveTenant(publicHost, env);
    
    if (!resolved?.tenantSlug) {
      return new Response(
        JSON.stringify({
          error: 'Domain not configured',
          hostname: publicHost,
          hint: 'This domain is not linked to any tenant',
        }, null, 2),
        { 
          status: 404, 
          headers: { 'Content-Type': 'application/json' } 
        }
      );
    }

    const { tenantSlug, primaryPublicHost, domainType } = resolved;

    // ========== CANONICAL REDIRECT (platform subdomain → custom domain) ==========
    if (domainType === 'platform_subdomain' && primaryPublicHost) {
      const normalizedPrimary = primaryPublicHost.toLowerCase().replace(/^www\./, '');
      if (publicHost !== normalizedPrimary) {
        // Platform subdomain should redirect to custom domain
        const redirectUrl = `https://${primaryPublicHost}${url.pathname}${cleanPreviewParams(url.search)}`;
        return Response.redirect(redirectUrl, 301);
      }
    }

    // ========== TRANSPARENT PROXY TO ORIGIN ==========
    // IMPORTANTE: O Worker faz proxy TRANSPARENTE - NÃO adiciona /store/{tenant}
    // O React app usa isOnTenantHost() baseado no X-Forwarded-Host para detectar tenant host
    // e rotear na raiz automaticamente
    
    const originUrl = `https://${ORIGIN_HOST}${url.pathname}${url.search}`;

    const proxyHeaders = new Headers();
    for (const [key, value] of request.headers.entries()) {
      const lowerKey = key.toLowerCase();
      // Skip hop-by-hop headers
      if (['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(lowerKey)) {
        continue;
      }
      proxyHeaders.set(key, value);
    }

    // CRITICAL: Pass the public host so the React app knows we're on a tenant domain
    proxyHeaders.set('X-Forwarded-Host', publicHost);
    proxyHeaders.set('X-Forwarded-Proto', 'https');
    proxyHeaders.set('X-Tenant-Slug', tenantSlug);
    proxyHeaders.set('X-Original-Host', publicHost);

    const originRes = await fetch(originUrl, {
      method: request.method,
      headers: proxyHeaders,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual', // Handle redirects ourselves
    });

    // ========== HANDLE REDIRECTS FROM ORIGIN ==========
    if (originRes.status >= 300 && originRes.status < 400) {
      const location = originRes.headers.get('Location');
      if (location) {
        let newLocation = location;
        
        try {
          // Rewrite redirect to use public host
          if (location.startsWith('/')) {
            newLocation = `https://${publicHost}${location}`;
          } else {
            const locUrl = new URL(location);
            const locHost = locUrl.hostname.toLowerCase();
            
            // If redirecting to origin or lovable domain, rewrite to public host
            if (locHost === ORIGIN_HOST.toLowerCase() || 
                locHost.endsWith('.lovable.app') ||
                locHost === 'app.comandocentral.com.br') {
              locUrl.hostname = publicHost;
              locUrl.protocol = 'https:';
              
              // Strip /store/{tenant} prefix if present (origin might add it)
              const storePrefix = `/store/${tenantSlug}`;
              if (locUrl.pathname === storePrefix) {
                locUrl.pathname = '/';
              } else if (locUrl.pathname.startsWith(storePrefix + '/')) {
                locUrl.pathname = locUrl.pathname.substring(storePrefix.length);
              }
              
              newLocation = locUrl.toString();
            }
          }
        } catch {}

        const resHeaders = new Headers(originRes.headers);
        resHeaders.set('Location', newLocation);
        resHeaders.set('X-CC-Original-Location', location);
        resHeaders.set('X-CC-Tenant', tenantSlug);
        
        return new Response(originRes.body, {
          status: originRes.status,
          statusText: originRes.statusText,
          headers: resHeaders,
        });
      }
    }

    // ========== SPA FALLBACK ==========
    // If origin returns 404 for a page route, return the SPA index
    if (originRes.status === 404 && 
        request.method === 'GET' && 
        !isStaticPath(url.pathname) &&
        !url.pathname.startsWith('/api/')) {
      
      // Try fetching root (SPA entry point)
      const spaRes = await fetch(`https://${ORIGIN_HOST}/`, {
        method: 'GET',
        headers: proxyHeaders,
        redirect: 'manual',
      });
      
      if (spaRes.ok) {
        const resHeaders = new Headers(spaRes.headers);
        resHeaders.set('X-CC-SPA-Fallback', 'true');
        resHeaders.set('X-CC-Tenant', tenantSlug);
        
        return new Response(spaRes.body, {
          status: 200,
          headers: resHeaders,
        });
      }
    }

    // ========== PASS THROUGH RESPONSE ==========
    const resHeaders = new Headers(originRes.headers);
    resHeaders.set('X-CC-Tenant', tenantSlug);
    resHeaders.set('X-CC-Origin-Path', url.pathname);

    return new Response(originRes.body, {
      status: originRes.status,
      statusText: originRes.statusText,
      headers: resHeaders,
    });
  },
};
