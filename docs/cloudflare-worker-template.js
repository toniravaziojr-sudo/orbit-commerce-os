/**
 * Cloudflare Worker - Multi-tenant SaaS Router (VERSÃO DEFINITIVA)
 *
 * CORREÇÃO FINAL: Assets servidos na raiz, SPA fallback
 *
 * O Lovable/Vite serve assets em /assets/* na RAIZ do origin.
 * O Worker NÃO deve prefixar assets com /store/{tenant}.
 * Para rotas de página, o origin retorna o index.html (SPA).
 *
 * ENV vars:
 * - ORIGIN_HOST = orbit-commerce-os.lovable.app
 * - SUPABASE_URL = https://ojssezfjhdvvncsqyhyq.supabase.co
 * - SUPABASE_ANON_KEY = <sua anon key>
 */

const RESERVED_SLUGS = new Set(["app", "shops", "www", "api", "cdn", "admin"]);
const PLATFORM_BASE_RE = /\.shops\.comandocentral\.com\.br$/i;

const RESOLVE_CACHE_TTL = 300;
const MAX_INTERNAL_REDIRECTS = 5;

const PUBLIC_STOREFRONT_PREFIXES = [
  "/store/",
  "/products",
  "/product/",
  "/category/",
  "/categories",
  "/collections",
  "/cart",
  "/checkout",
  "/thank-you",
  "/obrigado",
  "/order/",
  "/orders",
  "/p/",
  "/c/",
  "/lp/",
  "/page/",
  "/conta",
  "/minhas-compras",
];

const AUTH_ADMIN_PREFIXES = [
  "/auth",
  "/login",
  "/logout",
  "/admin",
  "/dashboard",
  "/settings",
];

// Paths que SEMPRE vão para a RAIZ do origin (sem /store/{tenant})
const ROOT_ONLY_PATHS = [
  "/assets/",
  "/@vite/",
  "/node_modules/",
  "/src/",
  "/robots.txt",
  "/sitemap",
  "/manifest",
  "/favicon",
];

function isPublicStorefrontPath(pathname) {
  const path = (pathname || "/").toLowerCase();

  for (const prefix of AUTH_ADMIN_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")) return false;
  }

  for (const prefix of PUBLIC_STOREFRONT_PREFIXES) {
    if (path === prefix || path.startsWith(prefix)) return true;
  }

  return path === "/" || path === "";
}

function isRootOnlyPath(pathname) {
  const path = (pathname || "").toLowerCase();
  for (const prefix of ROOT_ONLY_PATHS) {
    if (path === prefix || path.startsWith(prefix)) return true;
  }
  return false;
}

function isApiPath(pathname) {
  const path = (pathname || "").toLowerCase();
  return path.startsWith("/api/");
}

function cleanPublicSearch(search) {
  if (!search) return "";
  const u = new URL("https://x.invalid/" + search.replace(/^\?/, ""));
  u.searchParams.delete("preview");
  u.searchParams.delete("previewId");
  u.searchParams.delete("previewToken");
  const out = u.searchParams.toString();
  return out ? `?${out}` : "";
}

function stripStorePrefix(pathname, tenantSlug) {
  const p = pathname || "/";
  const prefix = `/store/${tenantSlug}`;
  if (p === prefix) return "/";
  if (p.startsWith(prefix + "/")) return p.slice(prefix.length) || "/";
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const ORIGIN_HOST = env.ORIGIN_HOST || "orbit-commerce-os.lovable.app";
    const SUPABASE_URL = env.SUPABASE_URL || env.SUPABASE_URI;
    const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

    // DEBUG: Verificar variáveis de ambiente
    console.log(`[Worker] ENV Check: ORIGIN_HOST=${ORIGIN_HOST}, SUPABASE_URL=${SUPABASE_URL ? 'SET' : 'MISSING'}, SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY ? 'SET' : 'MISSING'}`);

    const edgeHost = url.hostname.toLowerCase();
    if (edgeHost.endsWith(".workers.dev")) {
      return new Response("Please access via the correct domain", { status: 404 });
    }

    const cfConnectingHost = request.headers.get("cf-connecting-host");
    const publicHost = (cfConnectingHost || edgeHost).toLowerCase().replace(/^www\./, "");

    console.log(`[Worker] Request: host=${publicHost} path=${url.pathname}`);

    // shops.comandocentral.com.br sem tenant → manda pro app
    if (publicHost === "shops.comandocentral.com.br") {
      return Response.redirect("https://app.comandocentral.com.br/", 302);
    }

    // Resolver tenant
    const resolved = await resolveTenant(publicHost, { SUPABASE_URL, SUPABASE_ANON_KEY });

    // DEBUG: Mostrar resultado da resolução
    console.log(`[Worker] resolveTenant returned:`, JSON.stringify(resolved));

    if (!resolved?.tenantSlug) {
      console.log(`[Worker] Domain not configured: ${publicHost}`);
      // Retornar mais detalhes para debug
      const debugInfo = {
        error: "Domain not configured",
        hostname: publicHost,
        supabaseConfigured: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
        resolved: resolved,
      };
      return new Response(JSON.stringify(debugInfo, null, 2), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const tenantSlug = resolved.tenantSlug;
    const primaryPublicHost = (resolved.primaryPublicHost || "").toLowerCase().replace(/^www\./, "");
    const canonicalHost = primaryPublicHost || publicHost;
    const isCustomHost = !PLATFORM_BASE_RE.test(publicHost);

    console.log(`[Worker] Resolved: tenant=${tenantSlug} canonical=${canonicalHost} isCustom=${isCustomHost}`);

    // ============================================
    // ASSETS E ARQUIVOS ESTÁTICOS: SEMPRE NA RAIZ
    // ============================================
    if (isRootOnlyPath(url.pathname)) {
      console.log(`[Worker] Root-only path (asset/static): ${url.pathname}`);
      return await proxyToRoot(request, ORIGIN_HOST, url.pathname + (url.search || ""), publicHost, tenantSlug);
    }

    // ============================================
    // API: Prefixar com /store/{tenant}
    // ============================================
    if (isApiPath(url.pathname)) {
      const originPath = `/store/${tenantSlug}${url.pathname}`;
      console.log(`[Worker] API path: ${url.pathname} -> ${originPath}`);
      return await proxySimple(request, ORIGIN_HOST, originPath + (url.search || ""), publicHost, tenantSlug);
    }

    // ============================================
    // CANONICALIZAÇÃO: redirecionar platform → custom
    // ============================================
    if (isPublicStorefrontPath(url.pathname) && publicHost !== canonicalHost) {
      const target = `https://${canonicalHost}${url.pathname}${cleanPublicSearch(url.search)}`;
      console.log(`[Worker] Canonical redirect: ${publicHost} -> ${canonicalHost}`);
      return Response.redirect(target, 301);
    }

    // ============================================
    // URL LIMPA: se browser pedir /store/{tenant}..., redirect 301 para path limpo
    // ============================================
    const stripped = stripStorePrefix(url.pathname, tenantSlug);
    if (isCustomHost && stripped !== null) {
      const target = `https://${publicHost}${stripped}${cleanPublicSearch(url.search)}`;
      console.log(`[Worker] Clean URL redirect: ${url.pathname} -> ${stripped}`);
      return Response.redirect(target, 301);
    }

    // ============================================
    // PÁGINAS (SPA): Buscar no origin COM /store/{tenant}
    // ============================================
    let originPath;
    if (isCustomHost) {
      originPath = `/store/${tenantSlug}${url.pathname === "/" ? "" : url.pathname}`;
    } else {
      // Platform: verificar se já tem prefixo
      if (stripped === null) {
        originPath = `/store/${tenantSlug}${url.pathname === "/" ? "" : url.pathname}`;
      } else {
        originPath = url.pathname;
      }
    }

    console.log(`[Worker] Proxying SPA page: ${url.pathname} -> ${originPath}`);

    return await proxyWithSpaFallback(request, {
      ORIGIN_HOST,
      publicHost,
      tenantSlug,
      domainType: isCustomHost ? "custom" : "platform_subdomain",
      originPath,
      isCustomHost,
      search: url.search,
    });
  },
};

/**
 * Proxy direto para a RAIZ do origin (sem prefixo de tenant)
 * Usado para: /assets/*, /@vite/*, /robots.txt, etc.
 */
async function proxyToRoot(request, originHost, originPath, publicHost, tenantSlug) {
  const originUrl = `https://${originHost}${originPath}`;

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() === "host") continue;
    headers.set(key, value);
  }
  headers.set("X-Forwarded-Host", publicHost);
  headers.set("X-Tenant-Slug", tenantSlug);

  console.log(`[Worker] Fetching from root: ${originUrl}`);

  const response = await fetch(originUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "follow",
  });

  console.log(`[Worker] Root fetch result: ${response.status}`);

  const outHeaders = cloneHeaders(response.headers);
  outHeaders.set("X-CC-Origin-Path", originPath);
  outHeaders.set("X-CC-Strategy", "root");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
}

/**
 * Proxy simples com prefixo de tenant (para APIs)
 */
async function proxySimple(request, originHost, originPath, publicHost, tenantSlug) {
  const originUrl = `https://${originHost}${originPath}`;

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() === "host") continue;
    headers.set(key, value);
  }
  headers.set("X-Forwarded-Host", publicHost);
  headers.set("X-Tenant-Slug", tenantSlug);

  console.log(`[Worker] Simple proxy: ${originUrl}`);

  const response = await fetch(originUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "follow",
  });

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: cloneHeaders(response.headers),
  });
}

/**
 * Proxy para páginas SPA com fallback para index.html
 * Se o origin retornar 404, tenta buscar a raiz (SPA fallback)
 */
async function proxyWithSpaFallback(request, config) {
  const { ORIGIN_HOST, publicHost, tenantSlug, domainType, originPath, isCustomHost, search } = config;

  const originUrl = `https://${ORIGIN_HOST}${originPath}${search || ""}`;

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() === "host") continue;
    headers.set(key, value);
  }

  if (headers.has("origin")) headers.set("origin", `https://${publicHost}`);
  if (headers.has("referer")) {
    try {
      const r = new URL(headers.get("referer"));
      r.hostname = publicHost;
      headers.set("referer", r.toString());
    } catch {}
  }

  headers.set("X-Forwarded-Host", publicHost);
  headers.set("X-Forwarded-Proto", "https");
  headers.set("X-Tenant-Slug", tenantSlug);
  headers.set("X-Domain-Type", domainType);

  console.log(`[Worker] SPA fetch: ${originUrl}`);

  let response = await fetch(originUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "manual",
  });

  console.log(`[Worker] SPA fetch result: ${response.status}`);

  // Handle redirects
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    if (location) {
      const rewrittenLocation = rewriteLocation(location, publicHost, ORIGIN_HOST, tenantSlug, isCustomHost);
      const outHeaders = cloneHeaders(response.headers);
      rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);
      outHeaders.set("Location", rewrittenLocation);
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders,
      });
    }
  }

  // Se 404 e é uma rota de página, tenta SPA fallback (buscar index.html na raiz)
  if (response.status === 404 && request.method === "GET") {
    console.log(`[Worker] 404 detected, trying SPA fallback`);
    
    // Tenta buscar o index.html na raiz do tenant
    const spaUrl = `https://${ORIGIN_HOST}/store/${tenantSlug}`;
    const spaResponse = await fetch(spaUrl, {
      method: "GET",
      headers,
      redirect: "follow",
    });

    console.log(`[Worker] SPA fallback result: ${spaResponse.status}`);

    if (spaResponse.status === 200) {
      const outHeaders = cloneHeaders(spaResponse.headers);
      outHeaders.set("X-CC-SPA-Fallback", "true");
      rewriteSetCookieDomains(spaResponse.headers, outHeaders, publicHost, ORIGIN_HOST);
      return new Response(spaResponse.body, {
        status: 200,
        statusText: "OK",
        headers: outHeaders,
      });
    }
  }

  const outHeaders = cloneHeaders(response.headers);
  rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
}

/**
 * Reescreve Location header para o host público
 */
function rewriteLocation(location, publicHost, originHost, tenantSlug, isCustomHost) {
  try {
    if (location.startsWith("/")) {
      // Path relativo
      let path = location;
      if (isCustomHost) {
        const stripped = stripStorePrefix(path, tenantSlug);
        if (stripped !== null) path = stripped;
      }
      return `https://${publicHost}${path}`;
    }

    const u = new URL(location);
    const targetHost = u.hostname.toLowerCase();

    const originHosts = new Set([
      "orbit-commerce-os.lovable.app",
      "shops.comandocentral.com.br",
      originHost.toLowerCase(),
    ]);

    if (originHosts.has(targetHost) || targetHost.endsWith(".shops.comandocentral.com.br")) {
      u.hostname = publicHost;
      u.protocol = "https:";
      if (isCustomHost) {
        const stripped = stripStorePrefix(u.pathname, tenantSlug);
        if (stripped !== null) u.pathname = stripped;
      }
      return u.toString();
    }

    return location;
  } catch {
    return location;
  }
}

async function resolveTenant(hostname, { SUPABASE_URL, SUPABASE_ANON_KEY }) {
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const cacheKey = new Request(`https://resolve-domain-cache.internal/${hostname}`);
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
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ hostname }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log(`[Worker] resolveTenant result:`, JSON.stringify(data));

        // IMPORTANTE: A Edge Function retorna snake_case (tenant_slug, primary_public_host)
        // Aceitar ambos os formatos para robustez
        const tenantSlug = data.tenant_slug || data.tenantSlug;
        const primaryPublicHost = data.primary_public_host || data.primaryPublicHost || null;

        if (data.found && tenantSlug) {
          const result = {
            tenantSlug: tenantSlug,
            primaryPublicHost: primaryPublicHost,
          };

          try {
            const cacheRes = new Response(JSON.stringify(result), {
              headers: { "Cache-Control": `max-age=${RESOLVE_CACHE_TTL}` },
            });
            await caches.default.put(cacheKey, cacheRes);
          } catch {}

          return result;
        }
      }
    } catch (e) {
      console.error(`[Worker] resolveTenant error:`, e);
    }
  }

  // Fallback: extrair slug do hostname platform
  const match = hostname.match(/^([^.]+)\.shops\.comandocentral\.com\.br$/i);
  if (match && match[1] && !RESERVED_SLUGS.has(match[1].toLowerCase())) {
    return { tenantSlug: match[1].toLowerCase(), primaryPublicHost: null };
  }

  return null;
}

function cloneHeaders(sourceHeaders) {
  const out = new Headers();
  for (const [key, value] of sourceHeaders.entries()) {
    const k = key.toLowerCase();
    if (k.startsWith("cf-") || k === "x-real-ip" || k === "x-forwarded-for") continue;
    out.append(key, value);
  }
  return out;
}

function rewriteSetCookieDomains(sourceHeaders, targetHeaders, publicHost, originHost) {
  const cookies = sourceHeaders.getAll ? sourceHeaders.getAll("set-cookie") : [];
  if (!cookies.length) return;

  targetHeaders.delete("set-cookie");

  for (const cookie of cookies) {
    let rewritten = cookie
      .replace(new RegExp(`domain=${originHost}`, "gi"), `domain=${publicHost}`)
      .replace(/domain=\.?orbit-commerce-os\.lovable\.app/gi, `domain=${publicHost}`)
      .replace(/domain=\.?shops\.comandocentral\.com\.br/gi, `domain=${publicHost}`);
    targetHeaders.append("set-cookie", rewritten);
  }
}
