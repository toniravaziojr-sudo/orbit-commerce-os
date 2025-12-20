/**
 * Cloudflare Worker - Multi-tenant SaaS Router (SaaS-aware)
 *
 * Suporta:
 * 1) Subdomínios da plataforma: {tenant}.shops.comandocentral.com.br
 * 2) Domínios custom dos clientes: loja.cliente.com.br (via resolve-domain no Supabase)
 * 3) Custom Hostnames (Cloudflare for SaaS) - usa CF-Connecting-Host para obter host real
 *
 * ENV vars:
 * - ORIGIN_HOST = orbit-commerce-os.lovable.app
 * - SUPABASE_URL (ou SUPABASE_URI) = https://ojssezfjhdvvncsqyhyq.supabase.co
 * - SUPABASE_ANON_KEY = <sua anon key>
 *
 * Worker Routes:
 * - *.shops.comandocentral.com.br/*
 * - shops.comandocentral.com.br/*
 *
 * IMPORTANTE:
 * - SSL/TLS do zone deve estar em Full (Strict)
 * - Quando existe Custom Hostname, o Worker usa CF-Connecting-Host para obter o host real
 * - Isso evita loops de redirect quando o tráfego passa via Fallback Origin
 */

const RESERVED_SLUGS = new Set(["app", "shops", "www", "api", "cdn", "admin"]);
const PLATFORM_BASE_RE = /\.shops\.comandocentral\.com\.br$/i;

// Cache do resolve-domain (segundos)
const RESOLVE_CACHE_TTL = 300;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // CRÍTICO: Quando existe Custom Hostname, o Cloudflare envia o host real via CF-Connecting-Host
    // O url.hostname pode ser o Fallback Origin, causando loops de redirect
    const edgeHost = url.hostname;
    
    // Normalizar publicHost: pegar só o primeiro valor se vier com vírgula (X-Forwarded-Host pode ter lista)
    const publicHostRaw = request.headers.get("cf-connecting-host") 
      || request.headers.get("x-forwarded-host") 
      || edgeHost;
    const publicHost = String(publicHostRaw).split(",")[0].trim().toLowerCase();

    const ORIGIN_HOST = env.ORIGIN_HOST || "orbit-commerce-os.lovable.app";
    const SUPABASE_URL = env.SUPABASE_URL || env.SUPABASE_URI;
    const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

    // Debug log (remover depois de confirmar funcionamento)
    console.log(`[Worker] edgeHost=${edgeHost} publicHost=${publicHost} path=${url.pathname}`);

    // shops.comandocentral.com.br (sem tenant) -> redireciona pro app
    // IMPORTANTE: usar publicHost para a comparação, não edgeHost
    if (publicHost === "shops.comandocentral.com.br") {
      return Response.redirect("https://app.comandocentral.com.br/", 302);
    }

    // 1) Resolver tenantSlug + tipo de domínio usando publicHost (não edgeHost)
    const resolved = await resolveTenant(publicHost, {
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
    });

    if (!resolved?.tenantSlug) {
      console.log(`[Worker] Domain not configured: ${publicHost}`);
      return new Response("Domain not configured", { status: 404 });
    }

    const tenantSlug = resolved.tenantSlug;
    const domainType = resolved.domainType;

    console.log(`[Worker] Resolved: publicHost=${publicHost} tenantSlug=${tenantSlug} domainType=${domainType}`);

    // 2) Raiz "/" -> 302 para /store/{tenant}
    // IMPORTANTE: usar publicHost no redirect, não edgeHost
    if (url.pathname === "/" || url.pathname === "") {
      const redirectUrl = `https://${publicHost}/store/${tenantSlug}${url.search || ""}`;
      console.log(`[Worker] Redirecting / to ${redirectUrl}`);
      return Response.redirect(redirectUrl, 302);
    }

    // 3) Proxy para o origin (Lovable)
    const originUrl = new URL(request.url);
    originUrl.hostname = ORIGIN_HOST;

    // Recriar headers sem Host original
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (key.toLowerCase() === "host") continue;
      headers.set(key, value);
    }

    // Ajustes de origem usando publicHost (reduz CORS/CSRF "surpresa")
    if (headers.has("origin")) headers.set("origin", `https://${publicHost}`);
    if (headers.has("referer")) {
      try {
        const r = new URL(headers.get("referer"));
        r.hostname = publicHost;
        headers.set("referer", r.toString());
      } catch {
        // ignora
      }
    }

    // Forwarding headers úteis - USAR publicHost
    headers.set("X-Forwarded-Host", publicHost);
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Tenant-Slug", tenantSlug);
    headers.set("X-Domain-Type", domainType);

    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual", // captura redirects para reescrever Location
    });

    console.log(`[Worker] Fetching origin: ${originUrl.toString()}`);
    const response = await fetch(originRequest);

    // 4) Clonar headers para poder modificar Location e Set-Cookie
    const outHeaders = cloneHeaders(response.headers);

    // 5) Reescrever Set-Cookie Domain=... usando publicHost
    await rewriteSetCookieDomainsIfPossible(response.headers, outHeaders, publicHost, ORIGIN_HOST);

    // 6) Reescrever Location em respostas 3xx usando publicHost
    // SEMPRE logar 3xx para debug de loops
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      console.log(`[Worker][3xx] status=${response.status} publicHost=${publicHost} path=${url.pathname} Location_original=${location || "(none)"}`);
      
      if (location) {
        const rewritten = rewriteLocationHeader(location, publicHost, ORIGIN_HOST);
        if (rewritten !== location) {
          console.log(`[Worker][3xx] Location_rewritten=${rewritten}`);
          outHeaders.set("Location", rewritten);
        }
      }
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  },
};

/**
 * Resolve tenant a partir do hostname
 * - Plataforma: {tenant}.shops.comandocentral.com.br
 * - Custom: loja.cliente.com.br (via resolve-domain no Supabase, com cache)
 */
async function resolveTenant(hostname, { SUPABASE_URL, SUPABASE_ANON_KEY }) {
  // A) Plataforma: {tenant}.shops.comandocentral.com.br
  if (PLATFORM_BASE_RE.test(hostname)) {
    const match = hostname.match(/^([^.]+)\.shops\.comandocentral\.com\.br$/i);
    if (!match) return null;

    const tenantSlug = String(match[1]).toLowerCase();
    if (RESERVED_SLUGS.has(tenantSlug)) return null;

    return { tenantSlug, domainType: "platform_subdomain" };
  }

  // B) Domínio custom (externo) -> resolve-domain no Supabase
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.log(`[Worker] Custom domain ${hostname} but no Supabase config`);
    return null;
  }

  // Cache (5 min) para reduzir chamadas ao Supabase
  const cacheKey = new Request(`https://resolve-domain-cache.internal/${hostname}`);
  try {
    const cached = await caches.default.match(cacheKey);
    if (cached) {
      const data = await cached.json();
      if (data?.tenantSlug) {
        console.log(`[Worker] Cache hit for ${hostname} -> ${data.tenantSlug}`);
        return data;
      }
    }
  } catch {
    // ignora cache corrompido
  }

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
      console.log(`[Worker] Domain not found in database: ${hostname}`);
      return null;
    }

    const result = {
      tenantSlug: String(payload.tenant_slug).toLowerCase(),
      domainType: payload.domain_type || "custom",
    };

    console.log(`[Worker] Resolved custom domain: ${hostname} -> ${result.tenantSlug}`);

    // Guarda cache
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

/**
 * Reescreve Location:
 * - path relativo (/auth) -> https://{host}/auth
 * - scheme-relative (//app.com...) -> https://{host}/...
 * - absoluto apontando para app.* ou ORIGIN_HOST -> troca hostname para o host atual
 */
function rewriteLocationHeader(location, currentHostname, originHost) {
  try {
    // 1) Path relativo absoluto
    if (location.startsWith("/")) {
      return `https://${currentHostname}${location}`;
    }

    // 2) Scheme-relative (//host/path) - corrigir para não montar URL inválida
    if (location.startsWith("//")) {
      try {
        const u2 = new URL("https:" + location);
        u2.hostname = currentHostname;
        u2.protocol = "https:";
        return u2.toString();
      } catch {
        return `https://${currentHostname}${location.slice(1)}`;
      }
    }

    const u = new URL(location);

    // Padrões que devem ser reescritos para o hostname atual
    const rewriteHosts = new Set([
      "app.comandocentral.com.br",
      "www.app.comandocentral.com.br",
      "orbit-commerce-os.lovable.app",
      "shops.comandocentral.com.br", // fallback origin também deve ser reescrito
      originHost,
    ]);

    if (rewriteHosts.has(u.hostname)) {
      u.hostname = currentHostname;
      u.protocol = "https:";
      return u.toString();
    }

    return location;
  } catch {
    return location;
  }
}

/**
 * Clona headers preservando múltiplos valores
 */
function cloneHeaders(h) {
  const out = new Headers();
  for (const [k, v] of h.entries()) out.append(k, v);
  return out;
}

/**
 * Reescreve Domain=... em Set-Cookie quando possível.
 * - Em Workers modernos existe headers.getSetCookie()
 * - Caso não exista, não mexe (evita quebrar cookies múltiplos)
 */
async function rewriteSetCookieDomainsIfPossible(inHeaders, outHeaders, currentHostname, originHost) {
  // Workers modernos têm getSetCookie()
  if (typeof inHeaders.getSetCookie !== "function") return false;

  const cookies = inHeaders.getSetCookie();
  if (!Array.isArray(cookies) || cookies.length === 0) return false;

  // Limpa e re-adiciona todos os cookies com Domain reescrito
  outHeaders.delete("Set-Cookie");

  for (const c of cookies) {
    outHeaders.append("Set-Cookie", rewriteCookieDomain(c, currentHostname, originHost));
  }

  return true;
}

/**
 * Reescreve Domain=app.comandocentral.com.br / orbit-commerce... / originHost / fallback -> currentHostname
 */
function rewriteCookieDomain(setCookieValue, currentHostname, originHost) {
  const badDomains = new Set([
    "app.comandocentral.com.br",
    "www.app.comandocentral.com.br",
    "orbit-commerce-os.lovable.app",
    "shops.comandocentral.com.br", // fallback origin
    originHost,
  ]);

  const m = setCookieValue.match(/;\s*Domain=([^;]+)/i);
  if (!m) return setCookieValue;

  const domain = m[1].trim().replace(/^\./, "").toLowerCase();

  if (badDomains.has(domain)) {
    return setCookieValue.replace(/;\s*Domain=([^;]+)/i, `; Domain=${currentHostname}`);
  }

  return setCookieValue;
}
