/**
 * Cloudflare Worker - Multi-tenant SaaS Router (canonical + clean URLs)
 *
 * VERSÃO ATUALIZADA COM FALLBACK PARA ASSETS
 *
 * Objetivos:
 * - 301 real para host canônico (primary_public_host)
 * - Domínio custom com URL limpa (sem /store/{tenant} no browser)
 * - Fallback automático para assets: tenta /store/{tenant}/assets, se 404 tenta /assets
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
];

const AUTH_ADMIN_PREFIXES = [
  "/auth",
  "/login",
  "/logout",
  "/admin",
  "/account",
  "/dashboard",
  "/settings",
];

// Paths que devem ser buscados NA RAIZ do origin (sem /store/{tenant})
const ROOT_ONLY_PATHS = [
  "/robots.txt",
  "/sitemap",
  "/manifest",
  "/favicon",
];

// Paths de assets que precisam de fallback (tentar com e sem /store/{tenant})
const ASSET_PATHS = [
  "/assets/",
  "/@vite/",
  "/node_modules/",
  "/src/",
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

function isAssetPath(pathname) {
  const path = (pathname || "").toLowerCase();
  for (const prefix of ASSET_PATHS) {
    if (path.startsWith(prefix)) return true;
  }
  return false;
}

function isApiPath(pathname) {
  const path = (pathname || "").toLowerCase();
  return path.startsWith("/api/");
}

function isRootOnlyPath(pathname) {
  const path = (pathname || "").toLowerCase();
  for (const prefix of ROOT_ONLY_PATHS) {
    if (path === prefix || path.startsWith(prefix)) return true;
  }
  return false;
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

    if (!resolved?.tenantSlug) {
      console.log(`[Worker] Domain not configured: ${publicHost}`);
      return new Response("Domain not configured", { status: 404 });
    }

    const tenantSlug = resolved.tenantSlug;
    const primaryPublicHost = (resolved.primaryPublicHost || "").toLowerCase().replace(/^www\./, "");
    const canonicalHost = primaryPublicHost || publicHost;
    const isCustomHost = !PLATFORM_BASE_RE.test(publicHost);

    console.log(`[Worker] Resolved: tenant=${tenantSlug} canonical=${canonicalHost} isCustom=${isCustomHost}`);

    // ASSETS: Tratamento especial com fallback
    if (isAssetPath(url.pathname)) {
      return await handleAssetWithFallback(request, {
        ORIGIN_HOST,
        publicHost,
        tenantSlug,
        pathname: url.pathname,
        search: url.search,
      });
    }

    // ROOT-ONLY paths (robots.txt, sitemap, etc.)
    if (isRootOnlyPath(url.pathname)) {
      return await proxySimple(request, ORIGIN_HOST, url.pathname, publicHost, tenantSlug);
    }

    // API paths: também prefixar com /store/{tenant}
    if (isApiPath(url.pathname)) {
      const originPath = `/store/${tenantSlug}${url.pathname}`;
      return await proxySimple(request, ORIGIN_HOST, originPath, publicHost, tenantSlug);
    }

    // Canonicalização: redirecionar platform → custom se existir
    if (isPublicStorefrontPath(url.pathname) && publicHost !== canonicalHost) {
      const target = `https://${canonicalHost}${url.pathname}${cleanPublicSearch(url.search)}`;
      console.log(`[Worker] Canonical redirect: ${publicHost} -> ${canonicalHost}`);
      return Response.redirect(target, 301);
    }

    // URL limpa: se custom e browser pedir /store/{tenant}..., redirect 301 para path limpo
    const stripped = stripStorePrefix(url.pathname, tenantSlug);
    if (isCustomHost && stripped !== null) {
      const target = `https://${publicHost}${stripped}${cleanPublicSearch(url.search)}`;
      console.log(`[Worker] Clean URL redirect: ${url.pathname} -> ${stripped}`);
      return Response.redirect(target, 301);
    }

    // Proxy para origin: prefixar com /store/{tenant}
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

    console.log(`[Worker] Proxying page: ${url.pathname} -> ${originPath}`);

    return await proxyWithRedirectFollow(request, {
      ORIGIN_HOST,
      publicHost,
      tenantSlug,
      domainType: isCustomHost ? "custom" : "platform_subdomain",
      originPath,
      isCustomHost,
    });
  },
};

/**
 * Handler especial para assets com fallback:
 * 1. Tenta /assets/... (raiz) - onde o Vite/Lovable realmente serve
 * 2. Se 404, tenta /store/{tenant}/assets/...
 * 3. Retorna o primeiro que der 200
 */
async function handleAssetWithFallback(request, config) {
  const { ORIGIN_HOST, publicHost, tenantSlug, pathname, search } = config;

  const headers = new Headers();
  for (const [key, value] of request.headers.entries()) {
    if (key.toLowerCase() === "host") continue;
    headers.set(key, value);
  }
  headers.set("X-Forwarded-Host", publicHost);
  headers.set("X-Tenant-Slug", tenantSlug);

  // Primeiro: tentar SEM /store/{tenant} (na raiz) - é onde o Vite serve os assets
  const urlRoot = `https://${ORIGIN_HOST}${pathname}${search || ""}`;

  console.log(`[Worker] Asset attempt 1 (root): ${urlRoot}`);

  let response = await fetch(urlRoot, {
    method: request.method,
    headers,
    redirect: "follow",
  });

  console.log(`[Worker] Asset attempt 1 result: ${response.status}`);

  if (response.status === 200) {
    // Success na raiz
    const outHeaders = cloneHeaders(response.headers);
    outHeaders.set("X-Asset-Strategy", "root");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  }

  // Segundo: tentar COM /store/{tenant}
  const withTenantPath = `/store/${tenantSlug}${pathname}`;
  const urlWithTenant = `https://${ORIGIN_HOST}${withTenantPath}${search || ""}`;

  console.log(`[Worker] Asset attempt 2 (tenant): ${urlWithTenant}`);

  response = await fetch(urlWithTenant, {
    method: request.method,
    headers,
    redirect: "follow",
  });

  console.log(`[Worker] Asset attempt 2 result: ${response.status}`);

  const outHeaders = cloneHeaders(response.headers);
  outHeaders.set("X-Asset-Strategy", response.status === 200 ? "tenant" : "none");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: outHeaders,
  });
}

/**
 * Proxy simples sem tratamento de redirects
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

  console.log(`[Worker] Simple proxy: ${originPath}`);

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

async function proxyWithRedirectFollow(originalRequest, config) {
  const { ORIGIN_HOST, publicHost, tenantSlug, domainType, originPath, isCustomHost } = config;

  const originalPublicUrl = new URL(originalRequest.url);
  originalPublicUrl.hostname = publicHost;
  originalPublicUrl.protocol = "https:";
  const originalUrlStr = originalPublicUrl.toString();

  const base = new URL(originalRequest.url);
  base.hostname = ORIGIN_HOST;
  base.protocol = "https:";
  base.pathname = originPath;

  let currentUrl = base;
  let redirectCount = 0;

  while (redirectCount < MAX_INTERNAL_REDIRECTS) {
    const headers = new Headers();
    for (const [key, value] of originalRequest.headers.entries()) {
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

    const originRequest = new Request(currentUrl.toString(), {
      method: originalRequest.method,
      headers,
      body:
        redirectCount === 0 && originalRequest.method !== "GET" && originalRequest.method !== "HEAD"
          ? originalRequest.body
          : undefined,
      redirect: "manual",
    });

    console.log(`[Worker] Fetching: ${currentUrl.toString()}`);
    const response = await fetch(originRequest);
    console.log(`[Worker] Response: status=${response.status}`);

    if (response.status < 300 || response.status >= 400) {
      const outHeaders = cloneHeaders(response.headers);
      rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders,
      });
    }

    const location = response.headers.get("Location");
    if (!location) return response;

    const redirectInfo = analyzeRedirect(location, {
      publicHost,
      originHost: ORIGIN_HOST,
      tenantSlug,
      isCustomHost,
    });

    console.log(`[Worker] Redirect: ${location} -> ${redirectInfo.action}`);

    if (redirectInfo.action === "follow") {
      currentUrl = new URL(redirectInfo.targetUrl);
      redirectCount++;
      continue;
    }

    if (redirectInfo.action === "rewrite") {
      const rewrittenUrl = redirectInfo.rewrittenUrl;

      if (rewrittenUrl === originalUrlStr) {
        console.log(`[Worker] LOOP DETECTED, following internally`);
        currentUrl = new URL(location);
        redirectCount++;
        continue;
      }

      const outHeaders = cloneHeaders(response.headers);
      rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);
      outHeaders.set("Location", rewrittenUrl);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders,
      });
    }

    const outHeaders = cloneHeaders(response.headers);
    rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  }

  console.log(`[Worker] Max redirects exceeded`);
  return new Response("Too many redirects", { status: 508 });
}

function analyzeRedirect(location, ctx) {
  const { publicHost, originHost, tenantSlug, isCustomHost } = ctx;

  const stripIfCustom = (path) => {
    if (!isCustomHost) return path;
    const stripped = stripStorePrefix(path, tenantSlug);
    return stripped !== null ? stripped : path;
  };

  try {
    if (location.startsWith("/")) {
      const path = stripIfCustom(location);
      return {
        action: "rewrite",
        rewrittenUrl: `https://${publicHost}${path}`,
        reason: "relative_path",
      };
    }

    if (location.startsWith("//")) {
      const u = new URL("https:" + location);
      u.hostname = publicHost;
      u.protocol = "https:";
      u.pathname = stripIfCustom(u.pathname);
      return { action: "rewrite", rewrittenUrl: u.toString(), reason: "scheme_relative" };
    }

    const u = new URL(location);
    const targetHost = u.hostname.toLowerCase();

    const originHosts = new Set([
      "orbit-commerce-os.lovable.app",
      "shops.comandocentral.com.br",
      originHost.toLowerCase(),
    ]);

    if (originHosts.has(targetHost)) {
      u.hostname = publicHost;
      u.protocol = "https:";
      u.pathname = stripIfCustom(u.pathname);
      return { action: "rewrite", rewrittenUrl: u.toString(), reason: "origin_host" };
    }

    if (targetHost === "app.comandocentral.com.br") {
      if (isPublicStorefrontPath(u.pathname)) {
        u.hostname = publicHost;
        u.protocol = "https:";
        u.pathname = stripIfCustom(u.pathname);
        return { action: "rewrite", rewrittenUrl: u.toString(), reason: "app_public_rewrite" };
      }
      return { action: "passthrough", reason: "app_auth_admin" };
    }

    return { action: "passthrough", reason: "external_host" };
  } catch {
    return { action: "passthrough", reason: "parse_error" };
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
      const resolveUrl = `${SUPABASE_URL}/functions/v1/resolve-domain`;
      const resolveResponse = await fetch(resolveUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ hostname }),
      });

      if (resolveResponse.ok) {
        const payload = await resolveResponse.json();
        if (payload?.found && payload?.tenant_slug) {
          const result = {
            tenantSlug: String(payload.tenant_slug).toLowerCase(),
            domainType: payload.domain_type || (PLATFORM_BASE_RE.test(hostname) ? "platform_subdomain" : "custom"),
            primaryPublicHost: payload.primary_public_host?.toLowerCase(),
          };

          await caches.default.put(
            cacheKey,
            new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${RESOLVE_CACHE_TTL}` },
            })
          );

          return result;
        }
      }
    } catch (err) {
      console.error(`[Worker] Error resolving: ${err?.message || err}`);
    }
  }

  if (PLATFORM_BASE_RE.test(hostname)) {
    const match = hostname.match(/^([^.]+)\.shops\.comandocentral\.com\.br$/i);
    if (!match) return null;

    const tenantSlug = String(match[1]).toLowerCase();
    if (RESERVED_SLUGS.has(tenantSlug)) return null;

    return { tenantSlug, domainType: "platform_subdomain" };
  }

  return null;
}

function cloneHeaders(h) {
  const out = new Headers();
  for (const [k, v] of h.entries()) out.append(k, v);
  return out;
}

function rewriteSetCookieDomains(inHeaders, outHeaders, currentHostname, originHost) {
  if (typeof inHeaders.getSetCookie !== "function") return;

  const cookies = inHeaders.getSetCookie();
  if (!Array.isArray(cookies) || cookies.length === 0) return;

  outHeaders.delete("Set-Cookie");

  for (const cookie of cookies) {
    let newCookie = cookie;
    if (newCookie.toLowerCase().includes(`domain=${originHost.toLowerCase()}`)) {
      newCookie = newCookie.replace(new RegExp(`domain=${originHost}`, "gi"), `domain=${currentHostname}`);
    }
    outHeaders.append("Set-Cookie", newCookie);
  }
}
