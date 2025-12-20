/**
 * Cloudflare Worker - Multi-tenant SaaS Router (canonical + clean URLs)
 *
 * VERSÃO ATUALIZADA - Com canonicalização e URLs limpas
 *
 * Objetivos:
 * - 301 real para host canônico (primary_public_host)
 * - Domínio custom com URL limpa (sem /store/{tenant} no browser)
 * - Rewrite interno para origin /store/{tenant}...
 *
 * ENV vars:
 * - ORIGIN_HOST = orbit-commerce-os.lovable.app
 * - SUPABASE_URL = https://ojssezfjhdvvncsqyhyq.supabase.co
 * - SUPABASE_ANON_KEY = <sua anon key>
 *
 * Worker Routes (zona comandocentral.com.br):
 * - *.shops.comandocentral.com.br/*
 * - shops.comandocentral.com.br/*
 *
 * Requisitos Cloudflare:
 * - SSL/TLS: Full (Strict)
 * - ACM: Wildcard certificate para *.shops.comandocentral.com.br
 * - DNS: shops CNAME → origin, *.shops CNAME → shops (ambos Proxy ON)
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

const PUBLIC_ASSET_API_PREFIXES = [
  "/assets/",
  "/@vite/",
  "/api/",
  "/favicon",
  "/manifest",
  "/robots.txt",
  "/sitemap",
  "/node_modules/",
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

// Arquivos que SEMPRE existem na raiz do origin (não precisam de /store/{tenant})
const ROOT_ONLY_PATHS = [
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

function isPublicAssetOrApiPath(pathname) {
  const path = (pathname || "").toLowerCase();
  for (const prefix of PUBLIC_ASSET_API_PREFIXES) {
    if (path === prefix || path.startsWith(prefix)) return true;
  }
  return false;
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
  // Remover sinais de preview públicos
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
  return null; // não tem prefixo
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

    // Para custom hostnames (for SaaS), o host original costuma vir aqui:
    const cfConnectingHost = request.headers.get("cf-connecting-host");
    const publicHost = (cfConnectingHost || edgeHost).toLowerCase().replace(/^www\./, "");

    console.log(`[Worker] Request: edgeHost=${edgeHost} cfConnectingHost=${cfConnectingHost || 'none'} publicHost=${publicHost} path=${url.pathname}`);

    // shops.comandocentral.com.br sem tenant → manda pro app
    if (publicHost === "shops.comandocentral.com.br") {
      return Response.redirect("https://app.comandocentral.com.br/", 302);
    }

    // Resolver tenant + canonical host (idealmente via resolve-domain para ambos: custom e platform)
    const resolved = await resolveTenant(publicHost, { SUPABASE_URL, SUPABASE_ANON_KEY });

    if (!resolved?.tenantSlug) {
      console.log(`[Worker] Domain not configured: ${publicHost}`);
      return new Response("Domain not configured", { status: 404 });
    }

    const tenantSlug = resolved.tenantSlug;
    const domainType = resolved.domainType || (PLATFORM_BASE_RE.test(publicHost) ? "platform_subdomain" : "custom");
    const primaryPublicHost = (resolved.primaryPublicHost || "").toLowerCase().replace(/^www\./, "");
    const canonicalHost = primaryPublicHost || publicHost;

    console.log(`[Worker] Resolved: tenant=${tenantSlug} type=${domainType} canonical=${canonicalHost}`);

    const isStorefront = isPublicStorefrontPath(url.pathname) || isPublicAssetOrApiPath(url.pathname);

    // 1) Canonicalização por host (301 REAL no edge)
    // Se existe um domínio custom primário e o usuário está no domínio platform, redireciona
    // MAS: NÃO redirecionar assets/api - esses devem ser servidos diretamente
    const pathLower = (url.pathname || "/").toLowerCase();
    const isAssetOrApi = pathLower.startsWith("/assets/") || 
                          pathLower.startsWith("/@vite/") || 
                          pathLower.startsWith("/node_modules/") ||
                          pathLower.startsWith("/src/") ||
                          pathLower.startsWith("/api/");
    
    if (isStorefront && publicHost !== canonicalHost && !isAssetOrApi) {
      const target = `https://${canonicalHost}${url.pathname}${cleanPublicSearch(url.search)}`;
      console.log(`[Worker] Canonical redirect: ${publicHost} -> ${canonicalHost}`);
      return Response.redirect(target, 301);
    }

    // 2) URL limpa no domínio custom:
    // Se custom e o browser pedir /store/{tenant}..., devolve 301 para path limpo.
    // MAS: NÃO limpar assets - o browser não deve ver /assets com /store/{tenant} de qualquer forma
    const isCustomHost = !PLATFORM_BASE_RE.test(publicHost); // custom domain não termina com .shops...
    const stripped = stripStorePrefix(url.pathname, tenantSlug);

    if (isCustomHost && stripped !== null && !isAssetOrApi) {
      const target = `https://${publicHost}${stripped}${cleanPublicSearch(url.search)}`;
      console.log(`[Worker] Clean URL redirect: ${url.pathname} -> ${stripped}`);
      return Response.redirect(target, 301);
    }

    // 3) Rewrite interno para origin:
    // REGRA CRÍTICA: O origin Lovable serve assets DENTRO de /store/{tenant}/
    // Então /assets/... no browser deve virar /store/{tenant}/assets/... no origin
    
    // Exceções que ficam na raiz (sem /store/{tenant}):
    const shouldBypassStorePrefix = isRootOnlyPath(url.pathname);
    
    let originPath = url.pathname;

    if (!shouldBypassStorePrefix) {
      // TODOS os paths (incluindo /assets, /api, páginas) recebem /store/{tenant} no origin
      if (isCustomHost) {
        // Domínio custom: sempre prefixar com /store/{tenant}
        originPath = `/store/${tenantSlug}${url.pathname === "/" ? "" : url.pathname}`;
      } else {
        // Domínio platform: verificar se já tem o prefixo
        if (stripped === null) {
          // Não tem prefixo, adicionar
          originPath = `/store/${tenantSlug}${url.pathname === "/" ? "" : url.pathname}`;
        } else {
          // Já tem /store/{tenant}, manter como está
          originPath = url.pathname;
        }
      }
    }
    // Se for root-only (robots.txt, sitemap, etc.), mantém originPath = url.pathname

    console.log(`[Worker] Proxying: ${url.pathname} -> ${originPath}`);

    // Proxy para origin (seguindo redirects internos quando necessário)
    return await proxyWithRedirectFollow(request, {
      ORIGIN_HOST,
      publicHost,
      tenantSlug,
      domainType,
      originPath,
      isCustomHost,
    });
  },
};

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

    console.log(`[Worker] Fetching (attempt ${redirectCount + 1}): ${currentUrl.toString()}`);
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

    console.log(`[Worker] Redirect analysis: location="${location}" action=${redirectInfo.action} reason=${redirectInfo.reason}`);

    if (redirectInfo.action === "follow") {
      currentUrl = new URL(redirectInfo.targetUrl);
      redirectCount++;
      console.log(`[Worker] Following redirect internally to: ${currentUrl.toString()}`);
      continue;
    }

    if (redirectInfo.action === "rewrite") {
      const rewrittenUrl = redirectInfo.rewrittenUrl;

      if (rewrittenUrl === originalUrlStr) {
        // Loop potencial: segue internamente
        console.log(`[Worker] LOOP DETECTED: rewritten URL equals original. Following internally instead.`);
        currentUrl = new URL(location);
        redirectCount++;
        continue;
      }

      const outHeaders = cloneHeaders(response.headers);
      rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);
      outHeaders.set("Location", rewrittenUrl);

      console.log(`[Worker] Returning rewritten redirect: ${rewrittenUrl}`);

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders,
      });
    }

    const outHeaders = cloneHeaders(response.headers);
    rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);
    console.log(`[Worker] Passing through redirect as-is: ${location}`);
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  }

  console.log(`[Worker] Max redirects (${MAX_INTERNAL_REDIRECTS}) exceeded`);
  return new Response("Too many redirects", { status: 508 });
}

function analyzeRedirect(location, ctx) {
  const { publicHost, originHost, tenantSlug, isCustomHost } = ctx;

  // Para domínio custom, remover /store/{tenant} dos redirects para o browser
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
    const targetPath = u.pathname;

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
      if (isPublicStorefrontPath(targetPath) || isPublicAssetOrApiPath(targetPath)) {
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
  // 1) Sempre tentar resolve-domain (custom e platform), para obter primary_public_host
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const cacheKey = new Request(`https://resolve-domain-cache.internal/${hostname}`);
    try {
      const cached = await caches.default.match(cacheKey);
      if (cached) {
        const data = await cached.json();
        console.log(`[Worker] Cache hit: ${hostname} -> ${data.tenantSlug}`);
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
            primaryPublicHost: payload.primary_public_host || payload.primary_public_host?.toLowerCase(),
            canonicalOrigin: payload.canonical_origin,
          };

          console.log(`[Worker] Resolved via API: ${hostname} -> ${result.tenantSlug} (canonical: ${result.primaryPublicHost})`);

          await caches.default.put(
            cacheKey,
            new Response(JSON.stringify(result), {
              headers: { "Content-Type": "application/json", "Cache-Control": `max-age=${RESOLVE_CACHE_TTL}` },
            })
          );

          return result;
        }
      } else {
        console.log(`[Worker] resolve-domain failed: ${resolveResponse.status}`);
      }
    } catch (err) {
      console.error(`[Worker] Error resolving domain: ${err?.message || err}`);
    }
  }

  // 2) Fallback: se for platform subdomain, parse direto (sem canonicalização por custom)
  if (PLATFORM_BASE_RE.test(hostname)) {
    const match = hostname.match(/^([^.]+)\.shops\.comandocentral\.com\.br$/i);
    if (!match) return null;

    const tenantSlug = String(match[1]).toLowerCase();
    if (RESERVED_SLUGS.has(tenantSlug)) return null;

    console.log(`[Worker] Fallback parse: ${hostname} -> ${tenantSlug}`);
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

  const badDomains = new Set([
    "orbit-commerce-os.lovable.app",
    "shops.comandocentral.com.br",
    "app.comandocentral.com.br",
    originHost.toLowerCase(),
  ]);

  for (const c of cookies) {
    const m = c.match(/;\s*Domain=([^;]+)/i);
    if (m) {
      const domain = m[1].trim().replace(/^\./, "").toLowerCase();
      if (badDomains.has(domain)) {
        outHeaders.append("Set-Cookie", c.replace(/;\s*Domain=([^;]+)/i, `; Domain=${currentHostname}`));
        continue;
      }
    }
    outHeaders.append("Set-Cookie", c);
  }
}
