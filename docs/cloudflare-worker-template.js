/**
 * Cloudflare Worker - Multi-tenant SaaS Router
 *
 * Arquitetura simplificada com ACM (Advanced Certificate Manager):
 * - SSL para *.shops.comandocentral.com.br é automático via wildcard ACM
 * - Custom Hostnames são usados APENAS para domínios externos de clientes
 *
 * Suporta:
 * 1) Subdomínios da plataforma: {tenant}.shops.comandocentral.com.br (SSL via ACM)
 * 2) Domínios custom dos clientes: loja.cliente.com.br (SSL via Custom Hostname)
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
 * 
 * IMPORTANTE: Este Worker segue redirects do origin internamente quando o
 * destino é app.comandocentral.com.br com rota pública de storefront.
 * Isso evita loops de redirect quando o origin força canonical para app.
 */

const RESERVED_SLUGS = new Set(["app", "shops", "www", "api", "cdn", "admin"]);
const PLATFORM_BASE_RE = /\.shops\.comandocentral\.com\.br$/i;

// Cache do resolve-domain (segundos)
const RESOLVE_CACHE_TTL = 300;

// Máximo de redirects internos para evitar loops infinitos
const MAX_INTERNAL_REDIRECTS = 5;

// Rotas públicas de storefront que devem ter redirects seguidos internamente
// quando o origin redireciona para app.comandocentral.com.br
// IMPORTANTE: Inclui /assets/ para evitar CORS quando assets são redirecionados
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
  "/assets/",  // Assets do Vite - CRÍTICO para evitar CORS
  "/@vite/",   // Vite dev assets
  "/node_modules/", // Dev dependencies
];

// Rotas de auth/admin que NUNCA devem ser interceptadas (deixa redirect passar)
const AUTH_ADMIN_PREFIXES = [
  "/auth",
  "/login",
  "/logout",
  "/admin",
  "/account",
  "/dashboard",
  "/settings",
];

/**
 * Verifica se um path é rota pública de storefront
 */
function isPublicStorefrontPath(pathname) {
  const path = pathname.toLowerCase();
  
  // Primeiro verifica se é rota de auth/admin (nunca interceptar)
  for (const prefix of AUTH_ADMIN_PREFIXES) {
    if (path === prefix || path.startsWith(prefix + "/") || path.startsWith(prefix + "?")) {
      return false;
    }
  }
  
  // Verifica se é rota pública de storefront
  for (const prefix of PUBLIC_STOREFRONT_PREFIXES) {
    if (path === prefix || path.startsWith(prefix)) {
      return true;
    }
  }
  
  // Raiz também é pública
  if (path === "/" || path === "") {
    return true;
  }
  
  return false;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ORIGIN_HOST = env.ORIGIN_HOST || "orbit-commerce-os.lovable.app";
    const SUPABASE_URL = env.SUPABASE_URL || env.SUPABASE_URI;
    const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
    
    // Determinar o host público
    const edgeHost = url.hostname.toLowerCase();
    
    // Se estamos rodando no .workers.dev, rejeitar
    if (edgeHost.endsWith(".workers.dev")) {
      console.log(`[Worker] Direct access to workers.dev rejected: ${edgeHost}`);
      return new Response("Please access via the correct domain", { status: 404 });
    }
    
    // Para Custom Hostnames, Cloudflare pode passar o host original em headers
    const cfConnectingHost = request.headers.get("cf-connecting-host");
    const publicHost = (cfConnectingHost || edgeHost).toLowerCase().replace(/^www\./, '');

    console.log(`[Worker] Request: edgeHost=${edgeHost} cfConnectingHost=${cfConnectingHost || 'none'} publicHost=${publicHost} path=${url.pathname}`);

    // shops.comandocentral.com.br (sem tenant) → redireciona para o app
    if (publicHost === "shops.comandocentral.com.br") {
      return Response.redirect("https://app.comandocentral.com.br/", 302);
    }

    // 1) Resolver tenant
    const resolved = await resolveTenant(publicHost, { SUPABASE_URL, SUPABASE_ANON_KEY });

    if (!resolved?.tenantSlug) {
      console.log(`[Worker] Domain not configured: ${publicHost}`);
      return new Response("Domain not configured", { status: 404 });
    }

    const { tenantSlug, domainType } = resolved;
    console.log(`[Worker] Resolved: tenant=${tenantSlug} type=${domainType}`);

    // 2) Raiz "/" → redirect para /store/{tenant}
    if (url.pathname === "/" || url.pathname === "") {
      const redirectUrl = `https://${publicHost}/store/${tenantSlug}${url.search || ""}`;
      console.log(`[Worker] Redirecting / → ${redirectUrl}`);
      return Response.redirect(redirectUrl, 302);
    }

    // 3) Proxy para o origin com seguimento de redirects internos
    return await proxyWithRedirectFollow(request, {
      ORIGIN_HOST,
      publicHost,
      tenantSlug,
      domainType,
    });
  },
};

/**
 * Faz proxy para o origin e segue redirects internamente quando necessário
 * Isso evita loops quando o origin redireciona para app.comandocentral.com.br
 */
async function proxyWithRedirectFollow(originalRequest, config) {
  const { ORIGIN_HOST, publicHost, tenantSlug, domainType } = config;
  
  // URL original do request (para detectar loops)
  const originalPublicUrl = new URL(originalRequest.url);
  originalPublicUrl.hostname = publicHost;
  originalPublicUrl.protocol = "https:";
  const originalUrlStr = originalPublicUrl.toString();
  
  let currentUrl = new URL(originalRequest.url);
  currentUrl.hostname = ORIGIN_HOST;
  
  let redirectCount = 0;
  
  while (redirectCount < MAX_INTERNAL_REDIRECTS) {
    const headers = new Headers();
    for (const [key, value] of originalRequest.headers.entries()) {
      if (key.toLowerCase() === "host") continue;
      headers.set(key, value);
    }

    // Ajustar headers de origem
    if (headers.has("origin")) headers.set("origin", `https://${publicHost}`);
    if (headers.has("referer")) {
      try {
        const r = new URL(headers.get("referer"));
        r.hostname = publicHost;
        headers.set("referer", r.toString());
      } catch {}
    }

    // Headers de forwarding - CRÍTICO para o app saber o host público
    headers.set("X-Forwarded-Host", publicHost);
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Tenant-Slug", tenantSlug);
    headers.set("X-Domain-Type", domainType);

    const originRequest = new Request(currentUrl.toString(), {
      method: originalRequest.method,
      headers,
      body: redirectCount === 0 && originalRequest.method !== "GET" && originalRequest.method !== "HEAD" 
        ? originalRequest.body 
        : undefined,
      redirect: "manual",
    });

    console.log(`[Worker] Fetching (attempt ${redirectCount + 1}): ${currentUrl.toString()}`);
    const response = await fetch(originRequest);
    console.log(`[Worker] Response: status=${response.status}`);

    // Se não é redirect, retornar a resposta
    if (response.status < 300 || response.status >= 400) {
      const outHeaders = cloneHeaders(response.headers);
      rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: outHeaders,
      });
    }

    // É redirect - verificar se devemos seguir internamente ou retornar ao browser
    const location = response.headers.get("Location");
    if (!location) {
      // Redirect sem Location - retornar como está
      return response;
    }

    // Analisar o destino do redirect
    const redirectInfo = analyzeRedirect(location, publicHost, ORIGIN_HOST);
    console.log(`[Worker] Redirect analysis: location="${location}" action=${redirectInfo.action} reason=${redirectInfo.reason}`);

    if (redirectInfo.action === "follow") {
      // Seguir redirect internamente
      currentUrl = new URL(redirectInfo.targetUrl);
      redirectCount++;
      console.log(`[Worker] Following redirect internally to: ${currentUrl.toString()}`);
      continue;
    }

    if (redirectInfo.action === "rewrite") {
      const rewrittenUrl = redirectInfo.rewrittenUrl;
      
      // LOOP DETECTION: Se o redirect reescrito aponta para a mesma URL original,
      // seguimos internamente para app.comandocentral.com.br em vez de retornar 302
      if (rewrittenUrl === originalUrlStr) {
        console.log(`[Worker] LOOP DETECTED: rewritten URL equals original. Following internally instead.`);
        
        // Buscar conteúdo diretamente de app.comandocentral.com.br
        // O app.comandocentral.com.br resolve para o mesmo origin, então usamos o origin
        // mas se houver CDN/cache diferente, precisamos usar o host real
        const followUrl = new URL(location);
        // Manter o host original do redirect (app.comandocentral.com.br)
        // porque o origin está configurado para responder nesse host
        currentUrl = followUrl;
        redirectCount++;
        continue;
      }
      
      // Retornar redirect ao browser com URL reescrita
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

    // action === "passthrough" - retornar redirect como está
    const outHeaders = cloneHeaders(response.headers);
    rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);
    console.log(`[Worker] Passing through redirect as-is: ${location}`);
    
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  }

  // Limite de redirects atingido
  console.log(`[Worker] Max redirects (${MAX_INTERNAL_REDIRECTS}) exceeded`);
  return new Response("Too many redirects", { status: 508 });
}

/**
 * Analisa um redirect e decide o que fazer:
 * - "follow": seguir internamente (quando origin redireciona para app.comandocentral.com.br com rota pública)
 * - "rewrite": retornar ao browser com URL reescrita para o host público
 * - "passthrough": retornar ao browser sem modificar
 */
function analyzeRedirect(location, publicHost, originHost) {
  try {
    // Path relativo → reescrever para host público
    if (location.startsWith("/")) {
      return {
        action: "rewrite",
        rewrittenUrl: `https://${publicHost}${location}`,
        reason: "relative_path",
      };
    }

    // Scheme-relative
    if (location.startsWith("//")) {
      try {
        const u = new URL("https:" + location);
        u.hostname = publicHost;
        u.protocol = "https:";
        return {
          action: "rewrite",
          rewrittenUrl: u.toString(),
          reason: "scheme_relative",
        };
      } catch {
        return {
          action: "rewrite",
          rewrittenUrl: `https://${publicHost}${location.slice(1)}`,
          reason: "scheme_relative_fallback",
        };
      }
    }

    const u = new URL(location);
    const targetHost = u.hostname.toLowerCase();
    const targetPath = u.pathname;

    // Hosts do origin → reescrever
    const originHosts = new Set([
      "orbit-commerce-os.lovable.app",
      "shops.comandocentral.com.br",
      originHost.toLowerCase(),
    ]);

    if (originHosts.has(targetHost)) {
      u.hostname = publicHost;
      u.protocol = "https:";
      return {
        action: "rewrite",
        rewrittenUrl: u.toString(),
        reason: "origin_host",
      };
    }

    // app.comandocentral.com.br com rota pública → REESCREVER para o host público
    // O origin está redirecionando para app.comandocentral.com.br, mas o browser
    // deve ver apenas o host do tenant. Se depois de reescrever a URL fica
    // igual à original (loop potencial), retornamos 200 e buscamos o conteúdo.
    if (targetHost === "app.comandocentral.com.br") {
      if (isPublicStorefrontPath(targetPath)) {
        // Reescrever para o host público
        u.hostname = publicHost;
        u.protocol = "https:";
        
        return {
          action: "rewrite",
          rewrittenUrl: u.toString(),
          reason: "app_public_storefront_rewrite",
        };
      } else {
        // Rota de auth/admin - deixar passar sem modificar
        return {
          action: "passthrough",
          reason: "app_auth_admin",
        };
      }
    }

    // Outros hosts → passthrough
    return {
      action: "passthrough",
      reason: "external_host",
    };

  } catch (err) {
    console.log(`[Worker] Error analyzing redirect: ${err?.message || err}`);
    return {
      action: "passthrough",
      reason: "parse_error",
    };
  }
}

/**
 * Resolve tenant:
 * - Plataforma: {tenant}.shops.comandocentral.com.br (parse direto)
 * - Custom: loja.cliente.com.br (via resolve-domain, com cache)
 */
async function resolveTenant(hostname, { SUPABASE_URL, SUPABASE_ANON_KEY }) {
  // A) Subdomínio da plataforma
  if (PLATFORM_BASE_RE.test(hostname)) {
    const match = hostname.match(/^([^.]+)\.shops\.comandocentral\.com\.br$/i);
    if (!match) return null;

    const tenantSlug = String(match[1]).toLowerCase();
    if (RESERVED_SLUGS.has(tenantSlug)) return null;

    return { tenantSlug, domainType: "platform_subdomain" };
  }

  // B) Domínio custom → resolve-domain
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log(`[Worker] Custom domain ${hostname} but no Supabase config`);
    return null;
  }

  // Cache
  const cacheKey = new Request(`https://resolve-domain-cache.internal/${hostname}`);
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const data = await cached.json();
      if (data?.tenantSlug) {
        console.log(`[Worker] Cache hit: ${hostname} → ${data.tenantSlug}`);
        return data;
      }
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

    if (!resolveResponse.ok) {
      console.log(`[Worker] resolve-domain failed: ${resolveResponse.status}`);
      return null;
    }

    const payload = await resolveResponse.json();
    if (!payload?.found || !payload?.tenant_slug) {
      console.log(`[Worker] Domain not found: ${hostname}`);
      return null;
    }

    const result = {
      tenantSlug: String(payload.tenant_slug).toLowerCase(),
      domainType: payload.domain_type || "custom",
    };

    console.log(`[Worker] Resolved: ${hostname} → ${result.tenantSlug}`);

    // Salvar no cache
    await caches.default.put(
      cacheKey,
      new Response(JSON.stringify(result), {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": `max-age=${RESOLVE_CACHE_TTL}`,
        },
      })
    );

    return result;
  } catch (err) {
    console.error(`[Worker] Error resolving domain: ${err?.message || err}`);
    return null;
  }
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

  // Domínios que devem ter cookies reescritos para o host público
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
