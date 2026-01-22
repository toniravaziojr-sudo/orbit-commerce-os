/**
 * Cloudflare Worker - Multi-tenant SaaS Router (PATH TRANSLATION + INTERNAL FOLLOW)
 * 
 * OBJETIVO FINAL:
 * - URL LIMPA no navegador (sem /store/{tenant})
 * - Domínio custom é o canônico quando existe
 * - Subdomínio padrão redireciona 301 para o custom quando existe
 * 
 * ESTRATÉGIA:
 * - Worker faz PATH TRANSLATION: browser pede /, Worker busca /store/{tenant} no origin
 * - Worker SEGUE redirects internamente (internal follow) - nunca devolve 302 com /store
 * - Browser só vê URL limpa
 * 
 * ENV VARIABLES (configure no Cloudflare):
 * - ORIGIN_HOST: origin do app (ex: orbit-commerce-os.lovable.app)
 * - SUPABASE_URL: URL do projeto Supabase
 * - SUPABASE_ANON_KEY: Anon key do Supabase
 */

const PLATFORM_SUBDOMAIN_RE = /^([a-z0-9-]+)\.shops\.comandocentral\.com\.br$/i;
const RESOLVE_CACHE_TTL = 300;
const MAX_INTERNAL_FOLLOWS = 5;

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

// ========== EDGE FUNCTION PROXY ROUTES ==========
// Mapeamento de paths públicos para Edge Functions do Supabase
// Usado para endpoints de integrações (Meta, Stripe, Shopee, etc.)
// IMPORTANTE: Adicionar novas integrações aqui!
// 
// SUPORTA DOIS FORMATOS:
// 1. app.comandocentral.com.br/integrations/meta/... (legacy)
// 2. integrations.comandocentral.com.br/meta/... (novo - subdomínio dedicado)

const EDGE_FUNCTION_ROUTES = {
  // Meta / Facebook / WhatsApp
  '/integrations/meta/deauthorize': 'meta-deauthorize-callback',
  '/integrations/meta/deletion-status': 'meta-deletion-status',
  '/integrations/meta/whatsapp-callback': 'meta-whatsapp-onboarding-callback',
  '/integrations/meta/whatsapp-webhook': 'meta-whatsapp-webhook',
  // Formato curto (subdomínio integrations)
  '/meta/deauthorize': 'meta-deauthorize-callback',
  '/meta/deletion-status': 'meta-deletion-status',
  '/meta/whatsapp-callback': 'meta-whatsapp-onboarding-callback',
  '/meta/whatsapp-webhook': 'meta-whatsapp-webhook',
  
  // Shopee
  '/integrations/shopee/callback': 'shopee-oauth-callback',
  '/integrations/shopee/webhook': 'shopee-webhook',
  '/shopee/callback': 'shopee-oauth-callback',
  '/shopee/webhook': 'shopee-webhook',
  
  // Mercado Pago (Billing)
  '/integrations/billing/webhook': 'billing-webhook',
  '/billing/webhook': 'billing-webhook',
  
  // Email (SendGrid Inbound Parse)
  '/integrations/emails/inbound': 'support-email-inbound',
  '/emails/inbound': 'support-email-inbound',
  
  // Mercado Livre
  '/integrations/meli/callback': 'meli-oauth-callback',
  '/integrations/meli/webhook': 'meli-webhook',
  '/meli/callback': 'meli-oauth-callback',
  '/meli/webhook': 'meli-webhook',
};

// Hosts permitidos para proxy de Edge Functions
const INTEGRATION_HOSTS = [
  'app.comandocentral.com.br',
  'integrations.comandocentral.com.br',
];

function isStaticPath(pathname) {
  const p = pathname.toLowerCase();
  return STATIC_PATHS.some(prefix => p.startsWith(prefix) || p === prefix.replace(/\/$/, ''));
}

function isApiPath(pathname) {
  return pathname.toLowerCase().startsWith('/api/');
}

function isIntegrationHost(hostname) {
  return INTEGRATION_HOSTS.includes(hostname.toLowerCase());
}

function isEdgeFunctionRoute(pathname) {
  return EDGE_FUNCTION_ROUTES.hasOwnProperty(pathname);
}

function getEdgeFunctionName(pathname) {
  return EDGE_FUNCTION_ROUTES[pathname] || null;
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

function buildOriginPath(pathname, tenantSlug) {
  // Assets sempre na raiz
  if (isStaticPath(pathname)) {
    return pathname;
  }
  
  // API também com path translation
  if (isApiPath(pathname)) {
    return `/store/${tenantSlug}${pathname}`;
  }
  
  // Páginas: / -> /store/{tenant}, /p/x -> /store/{tenant}/p/x
  if (pathname === '/' || pathname === '') {
    return `/store/${tenantSlug}`;
  }
  
  return `/store/${tenantSlug}${pathname}`;
}

function stripStorePrefix(pathname, tenantSlug) {
  const prefix = `/store/${tenantSlug}`;
  if (pathname === prefix) return '/';
  if (pathname.startsWith(prefix + '/')) return pathname.substring(prefix.length);
  return null;
}

async function resolveTenant(hostname, env) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = env;
  
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    const match = hostname.match(PLATFORM_SUBDOMAIN_RE);
    if (match) {
      return { tenantSlug: match[1], primaryPublicHost: null, domainType: 'platform_subdomain' };
    }
    return null;
  }

  // Cache
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

  const match = hostname.match(PLATFORM_SUBDOMAIN_RE);
  if (match) {
    return { tenantSlug: match[1], primaryPublicHost: null, domainType: 'platform_subdomain' };
  }

  return null;
}

async function fetchWithInternalFollow(originUrl, request, originHost, publicHost, tenantSlug) {
  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    const lowerKey = key.toLowerCase();
    if (['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(lowerKey)) {
      continue;
    }
    headers.set(key, value);
  }

  headers.set('X-Forwarded-Host', publicHost);
  headers.set('X-Forwarded-Proto', 'https');
  headers.set('X-Tenant-Slug', tenantSlug);
  headers.set('X-Original-Host', publicHost);

  let currentUrl = originUrl;
  let follows = 0;

  while (follows < MAX_INTERNAL_FOLLOWS) {
    const res = await fetch(currentUrl, {
      method: request.method,
      headers,
      body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
      redirect: 'manual',
    });

    // Se não é redirect, retorna
    if (res.status < 300 || res.status >= 400) {
      return { response: res, followedRedirects: follows };
    }

    // É redirect - para métodos não-GET, não seguir internamente
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return { response: res, followedRedirects: follows };
    }

    const location = res.headers.get('Location');
    if (!location) {
      return { response: res, followedRedirects: follows };
    }

    follows++;

    // Determinar próxima URL
    let nextUrl;
    try {
      if (location.startsWith('/')) {
        nextUrl = `https://${originHost}${location}`;
      } else {
        const locUrl = new URL(location);
        const locHost = locUrl.hostname.toLowerCase();
        
        // Só seguir internamente se for para o origin ou hosts conhecidos
        if (locHost === originHost.toLowerCase() ||
            locHost.endsWith('.lovable.app') ||
            locHost === 'app.comandocentral.com.br') {
          nextUrl = locUrl.toString();
        } else {
          // Redirect externo - não seguir, devolver para o browser
          return { response: res, followedRedirects: follows - 1 };
        }
      }
    } catch {
      return { response: res, followedRedirects: follows - 1 };
    }

    currentUrl = nextUrl;
  }

  // Max follows reached - retornar último response
  const finalRes = await fetch(currentUrl, {
    method: request.method,
    headers,
    redirect: 'manual',
  });
  return { response: finalRes, followedRedirects: follows };
}

function rewriteLocationToClean(location, publicHost, originHost, tenantSlug) {
  try {
    if (location.startsWith('/')) {
      const stripped = stripStorePrefix(location, tenantSlug);
      const cleanPath = stripped !== null ? stripped : location;
      return `https://${publicHost}${cleanPath}`;
    }

    const locUrl = new URL(location);
    const locHost = locUrl.hostname.toLowerCase();

    const knownOrigins = new Set([
      originHost.toLowerCase(),
      'orbit-commerce-os.lovable.app',
      'app.comandocentral.com.br',
    ]);

    if (knownOrigins.has(locHost) || locHost.endsWith('.lovable.app')) {
      locUrl.hostname = publicHost;
      locUrl.protocol = 'https:';
      
      const stripped = stripStorePrefix(locUrl.pathname, tenantSlug);
      if (stripped !== null) {
        locUrl.pathname = stripped;
      }
      
      return locUrl.toString();
    }

    return location;
  } catch {
    return location;
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ORIGIN_HOST = env.ORIGIN_HOST || 'orbit-commerce-os.lovable.app';
    const SUPABASE_URL = env.SUPABASE_URL; // Obrigatório: configure no Cloudflare Dashboard

    const edgeHost = url.hostname.toLowerCase();
    
    if (edgeHost.endsWith('.workers.dev')) {
      return new Response('Access via correct domain', { status: 404 });
    }

    const cfHost = request.headers.get('cf-connecting-host');
    const publicHost = (cfHost || edgeHost).toLowerCase().replace(/^www\./, '');

    // ========== EDGE FUNCTION PROXY ==========
    // Proxy de integrações: /integrations/meta/* ou /meta/* → Edge Functions
    // Suporta: app.comandocentral.com.br e integrations.comandocentral.com.br
    if (isIntegrationHost(publicHost) && isEdgeFunctionRoute(url.pathname)) {
      const functionName = getEdgeFunctionName(url.pathname);
      const targetUrl = `${SUPABASE_URL}/functions/v1/${functionName}`;
      
      // Forward headers (exceto Host)
      const proxyHeaders = new Headers();
      for (const [key, value] of request.headers.entries()) {
        const lowerKey = key.toLowerCase();
        if (!['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(lowerKey)) {
          proxyHeaders.set(key, value);
        }
      }
      
      // Adicionar headers de contexto
      proxyHeaders.set('X-Forwarded-Host', publicHost);
      proxyHeaders.set('X-Forwarded-Proto', 'https');
      proxyHeaders.set('X-Original-Path', url.pathname);
      
      try {
        const proxyRes = await fetch(targetUrl, {
          method: request.method,
          headers: proxyHeaders,
          body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        });
        
        // Retornar resposta da Edge Function
        const resHeaders = new Headers();
        for (const [key, value] of proxyRes.headers.entries()) {
          resHeaders.set(key, value);
        }
        resHeaders.set('X-CC-Proxied-Function', functionName);
        
        return new Response(proxyRes.body, {
          status: proxyRes.status,
          statusText: proxyRes.statusText,
          headers: resHeaders,
        });
      } catch (e) {
        console.error(`[EdgeFunctionProxy] Error proxying to ${functionName}:`, e);
        return new Response(
          JSON.stringify({ error: 'Edge function proxy error', function: functionName }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }

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
          edgeFunctionRoutes: Object.keys(EDGE_FUNCTION_ROUTES),
          strategy: 'path_translation_with_internal_follow',
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
        const redirectUrl = `https://${primaryPublicHost}${url.pathname}${cleanPreviewParams(url.search)}`;
        return Response.redirect(redirectUrl, 301);
      }
    }

    // ========== PATH TRANSLATION ==========
    // Browser pede /, Worker busca /store/{tenant} no origin
    const originPath = buildOriginPath(url.pathname, tenantSlug);
    const originUrl = `https://${ORIGIN_HOST}${originPath}${url.search || ''}`;

    // ========== FETCH WITH INTERNAL FOLLOW ==========
    // Segue redirects internamente para não expor /store ao browser
    const { response: originRes, followedRedirects } = await fetchWithInternalFollow(
      originUrl, 
      request, 
      ORIGIN_HOST, 
      publicHost, 
      tenantSlug
    );

    // ========== SE AINDA VEIO REDIRECT, REESCREVE PARA URL LIMPA ==========
    if (originRes.status >= 300 && originRes.status < 400) {
      const location = originRes.headers.get('Location');
      if (location) {
        const cleanLocation = rewriteLocationToClean(location, publicHost, ORIGIN_HOST, tenantSlug);
        
        const resHeaders = new Headers();
        for (const [key, value] of originRes.headers.entries()) {
          if (key.toLowerCase() !== 'content-length' && key.toLowerCase() !== 'content-encoding') {
            resHeaders.set(key, value);
          }
        }
        resHeaders.set('Location', cleanLocation);
        resHeaders.set('X-CC-Original-Location', location);
        resHeaders.set('X-CC-Tenant', tenantSlug);
        resHeaders.set('X-CC-Followed-Redirects', String(followedRedirects));
        
        return new Response(null, {
          status: originRes.status,
          statusText: originRes.statusText,
          headers: resHeaders,
        });
      }
    }

    // ========== SPA FALLBACK ==========
    if (originRes.status === 404 && 
        request.method === 'GET' && 
        !isStaticPath(url.pathname) &&
        !isApiPath(url.pathname)) {
      
      const spaPath = `/store/${tenantSlug}`;
      const spaUrl = `https://${ORIGIN_HOST}${spaPath}`;
      
      const headers = new Headers();
      for (const [key, value] of request.headers.entries()) {
        if (!['host', 'connection', 'keep-alive', 'transfer-encoding', 'upgrade'].includes(key.toLowerCase())) {
          headers.set(key, value);
        }
      }
      headers.set('X-Forwarded-Host', publicHost);
      headers.set('X-Tenant-Slug', tenantSlug);
      
      const spaRes = await fetch(spaUrl, {
        method: 'GET',
        headers,
        redirect: 'manual',
      });
      
      if (spaRes.ok) {
        const resHeaders = new Headers();
        for (const [key, value] of spaRes.headers.entries()) {
          if (key.toLowerCase() !== 'content-length' && key.toLowerCase() !== 'content-encoding') {
            resHeaders.set(key, value);
          }
        }
        resHeaders.set('X-CC-SPA-Fallback', 'true');
        resHeaders.set('X-CC-Tenant', tenantSlug);
        
        return new Response(spaRes.body, {
          status: 200,
          headers: resHeaders,
        });
      }
    }

    // ========== PASS THROUGH RESPONSE ==========
    const resHeaders = new Headers();
    for (const [key, value] of originRes.headers.entries()) {
      if (key.toLowerCase() !== 'content-length' && key.toLowerCase() !== 'content-encoding') {
        resHeaders.set(key, value);
      }
    }
    resHeaders.set('X-CC-Tenant', tenantSlug);
    resHeaders.set('X-CC-Origin-Path', originPath);
    resHeaders.set('X-CC-Followed-Redirects', String(followedRedirects));

    return new Response(originRes.body, {
      status: originRes.status,
      statusText: originRes.statusText,
      headers: resHeaders,
    });
  },
};
