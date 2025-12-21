/**
 * Cloudflare Worker - Multi-tenant SaaS Router (URL LIMPA)
 *
 * Objetivo:
 * - Browser vê URLs limpas (sem /store/{tenant})
 * - Origin recebe /store/{tenant} internamente
 * - Worker faz "path translation" e SPA fallback
 *
 * ENV vars:
 * - ORIGIN_HOST = orbit-commerce-os.lovable.app
 * - SUPABASE_URL = https://ojssezfjhdvvncsqyhyq.supabase.co
 * - SUPABASE_ANON_KEY = <sua anon key>
 */

const PLATFORM_BASE_RE = /\.shops\.comandocentral\.com\.br$/i;
const RESOLVE_CACHE_TTL = 300;
const MAX_INTERNAL_REDIRECTS = 5;

// Paths que devem ir SEMPRE na RAIZ do origin (Vite/Lovable assets)
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

function isRootOnlyPath(pathname) {
  const p = (pathname || "/").toLowerCase();
  return ROOT_ONLY_PATHS.some((x) => p === x || p.startsWith(x));
}

function isApiPath(pathname) {
  const p = (pathname || "").toLowerCase();
  return p.startsWith("/api/");
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

function cloneHeaders(h) {
  const out = new Headers();
  for (const [k, v] of h.entries()) {
    const lk = k.toLowerCase();
    if (lk === "content-length") continue;
    if (lk === "content-encoding") continue;
    out.append(k, v);
  }
  return out;
}

function buildOriginPath({ pathname, tenantSlug }) {
  // Assets/static na raiz
  if (isRootOnlyPath(pathname)) return pathname;

  // API sob /store/{tenant}/api/*
  if (isApiPath(pathname)) return `/store/${tenantSlug}${pathname}`;

  // Páginas: / -> /store/{tenant}
  if (pathname === "/" || pathname === "") return `/store/${tenantSlug}`;

  // Páginas: /p/x -> /store/{tenant}/p/x
  return `/store/${tenantSlug}${pathname}`;
}

function rewriteLocationToCleanPublic(location, publicHost, originHost, tenantSlug) {
  try {
    // Relativo
    if (location.startsWith("/")) {
      const stripped = stripStorePrefix(location, tenantSlug);
      const cleanPath = stripped !== null ? stripped : location;
      return `https://${publicHost}${cleanPath}`;
    }

    // Absoluto
    const u = new URL(location);
    const targetHost = u.hostname.toLowerCase();

    const originHosts = new Set([
      originHost.toLowerCase(),
      "orbit-commerce-os.lovable.app",
      "app.comandocentral.com.br",
      "shops.comandocentral.com.br",
    ]);

    if (originHosts.has(targetHost) || targetHost.endsWith(".lovable.app")) {
      u.hostname = publicHost;
      u.protocol = "https:";
      const stripped = stripStorePrefix(u.pathname, tenantSlug);
      if (stripped !== null) u.pathname = stripped;
      return u.toString();
    }

    // Redirect externo - não mexe
    return location;
  } catch {
    return location;
  }
}

async function fetchWithInternalFollow({
  request,
  originHost,
  originUrl,
  publicHost,
  tenantSlug,
}) {
  const headers = new Headers();
  for (const [k, v] of request.headers.entries()) {
    if (k.toLowerCase() === "host") continue;
    headers.set(k, v);
  }

  headers.set("Host", originHost);
  headers.set("X-Forwarded-Host", publicHost);
  headers.set("X-Forwarded-Proto", "https");
  headers.set("X-Tenant-Slug", tenantSlug);
  headers.set("X-Domain-Type", "custom_or_platform");

  let currentUrl = originUrl;
  let redirects = 0;

  while (true) {
    const res = await fetch(currentUrl, {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? request.body
          : undefined,
      redirect: "manual",
    });

    // Se não é redirect, retorna
    if (!(res.status >= 300 && res.status < 400)) return res;

    // Para métodos não-GET, não seguir internamente
    if (request.method !== "GET" && request.method !== "HEAD") return res;

    const loc = res.headers.get("Location");
    if (!loc) return res;

    redirects += 1;
    if (redirects > MAX_INTERNAL_REDIRECTS) return res;

    // Seguimos internamente apenas redirects para o próprio origin
    let nextUrl;
    try {
      if (loc.startsWith("/")) {
        nextUrl = `https://${originHost}${loc}`;
      } else {
        const u = new URL(loc);
        const h = u.hostname.toLowerCase();
        if (h === originHost.toLowerCase() || h.endsWith(".lovable.app")) {
          nextUrl = u.toString();
        } else {
          // Externo: devolve redirect
          return res;
        }
      }
    } catch {
      return res;
    }

    currentUrl = nextUrl;
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
        const tenantSlug = data.tenant_slug || data.tenantSlug;
        const primaryPublicHost =
          data.primary_public_host || data.primaryPublicHost || null;

        if (data.found && tenantSlug) {
          const result = { tenantSlug, primaryPublicHost };
          try {
            await caches.default.put(
              cacheKey,
              new Response(JSON.stringify(result), {
                headers: { "Cache-Control": `max-age=${RESOLVE_CACHE_TTL}` },
              })
            );
          } catch {}
          return result;
        }
      }
    } catch {}
  }

  // Fallback: platform subdomain -> slug
  const m = hostname.match(/^([a-z0-9-]+)\.shops\.comandocentral\.com\.br$/i);
  if (m?.[1]) return { tenantSlug: m[1], primaryPublicHost: null };

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

    // Debug endpoint
    if (url.pathname === "/_debug" || url.pathname === "/_health") {
      const resolved = await resolveTenant(publicHost, { SUPABASE_URL, SUPABASE_ANON_KEY });
      return new Response(
        JSON.stringify(
          {
            timestamp: new Date().toISOString(),
            hostname: publicHost,
            edgeHost,
            path: url.pathname,
            envConfigured: {
              ORIGIN_HOST: !!ORIGIN_HOST,
              SUPABASE_URL: !!SUPABASE_URL,
              SUPABASE_ANON_KEY: !!SUPABASE_ANON_KEY,
            },
            resolved: resolved ? {
              tenantSlug: resolved.tenantSlug,
              primaryPublicHost: resolved.primaryPublicHost,
              isCanonical: publicHost === (resolved.primaryPublicHost || "").toLowerCase().replace(/^www\./, ""),
            } : null,
            status: resolved?.tenantSlug ? "OK" : "TENANT_NOT_FOUND",
          },
          null,
          2
        ),
        { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } }
      );
    }

    // Domínio raiz do catálogo de tenants
    if (publicHost === "shops.comandocentral.com.br") {
      return Response.redirect("https://app.comandocentral.com.br/", 302);
    }

    const resolved = await resolveTenant(publicHost, { SUPABASE_URL, SUPABASE_ANON_KEY });
    if (!resolved?.tenantSlug) {
      return new Response(
        JSON.stringify(
          {
            error: "Domain not configured",
            hostname: publicHost,
            supabaseConfigured: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
          },
          null,
          2
        ),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    const tenantSlug = resolved.tenantSlug;
    const primaryPublicHost = (resolved.primaryPublicHost || "").toLowerCase().replace(/^www\./, "");

    // Canonical: platform -> custom
    if (PLATFORM_BASE_RE.test(publicHost) && primaryPublicHost && publicHost !== primaryPublicHost) {
      const target = `https://${primaryPublicHost}${url.pathname}${cleanPublicSearch(url.search)}`;
      return Response.redirect(target, 301);
    }

    // 1) Traduz path do browser para path do origin
    const originPath = buildOriginPath({ pathname: url.pathname, tenantSlug });
    const originUrl = `https://${ORIGIN_HOST}${originPath}${url.search || ""}`;

    // 2) Fetch no origin seguindo redirects internos
    let originRes = await fetchWithInternalFollow({
      request,
      originHost: ORIGIN_HOST,
      originUrl,
      publicHost,
      tenantSlug,
    });

    // 3) Se ainda veio redirect, reescreve Location para host público e URL limpa
    if (originRes.status >= 300 && originRes.status < 400) {
      const loc = originRes.headers.get("Location");
      if (loc) {
        const outHeaders = cloneHeaders(originRes.headers);
        outHeaders.set("Location", rewriteLocationToCleanPublic(loc, publicHost, ORIGIN_HOST, tenantSlug));
        outHeaders.set("X-CC-Original-Location", loc);
        return new Response(originRes.body, { status: originRes.status, headers: outHeaders });
      }
    }

    // 4) SPA fallback: se GET e veio 404 para rota de página, tenta servir /store/{tenant}
    if (
      originRes.status === 404 &&
      request.method === "GET" &&
      !isRootOnlyPath(url.pathname) &&
      !isApiPath(url.pathname)
    ) {
      const spaUrl = `https://${ORIGIN_HOST}/store/${tenantSlug}`;
      const spaHeaders = new Headers();
      for (const [k, v] of request.headers.entries()) {
        if (k.toLowerCase() === "host") continue;
        spaHeaders.set(k, v);
      }
      spaHeaders.set("Host", ORIGIN_HOST);
      spaHeaders.set("X-Forwarded-Host", publicHost);
      spaHeaders.set("X-Tenant-Slug", tenantSlug);
      
      originRes = await fetch(spaUrl, { method: "GET", headers: spaHeaders, redirect: "manual" });
      const outHeaders = cloneHeaders(originRes.headers);
      outHeaders.set("X-CC-SPA-Fallback", "true");
      return new Response(originRes.body, { status: 200, headers: outHeaders });
    }

    const outHeaders = cloneHeaders(originRes.headers);
    outHeaders.set("X-CC-Tenant", tenantSlug);
    outHeaders.set("X-CC-Origin-Path", originPath);

    return new Response(originRes.body, {
      status: originRes.status,
      statusText: originRes.statusText,
      headers: outHeaders,
    });
  },
};
