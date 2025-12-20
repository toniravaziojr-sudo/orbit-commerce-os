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
 */

const RESERVED_SLUGS = new Set(["app", "shops", "www", "api", "cdn", "admin"]);
const PLATFORM_BASE_RE = /\.shops\.comandocentral\.com\.br$/i;

// Cache do resolve-domain (segundos)
const RESOLVE_CACHE_TTL = 300;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ORIGIN_HOST = env.ORIGIN_HOST || "orbit-commerce-os.lovable.app";
    const SUPABASE_URL = env.SUPABASE_URL || env.SUPABASE_URI;
    const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;
    
    // Determinar o host público
    // Quando via Worker Route: url.hostname já é o host correto (ex: tenant.shops.comandocentral.com.br)
    // Quando via Custom Hostname: cf-connecting-host tem o host original
    const edgeHost = url.hostname.toLowerCase();
    
    // Se estamos rodando no .workers.dev, não devemos servir storefronts
    // Isso só acontece quando alguém acessa diretamente o worker URL
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

    // 3) Proxy para o origin
    const originUrl = new URL(request.url);
    originUrl.hostname = ORIGIN_HOST;

    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
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

    // Headers de forwarding
    headers.set("X-Forwarded-Host", publicHost);
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Tenant-Slug", tenantSlug);
    headers.set("X-Domain-Type", domainType);

    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual",
    });

    const response = await fetch(originRequest);

    // 4) Clonar e modificar headers da resposta
    const outHeaders = cloneHeaders(response.headers);

    // Reescrever Set-Cookie Domain
    rewriteSetCookieDomains(response.headers, outHeaders, publicHost, ORIGIN_HOST);

    // Reescrever Location em 3xx
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (location) {
        const rewritten = rewriteLocationHeader(location, publicHost, ORIGIN_HOST);
        if (rewritten !== location) {
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

/**
 * Reescreve Location header para apontar para o host correto
 */
function rewriteLocationHeader(location, currentHostname, originHost) {
  try {
    // Path relativo
    if (location.startsWith("/")) {
      return `https://${currentHostname}${location}`;
    }

    // Scheme-relative
    if (location.startsWith("//")) {
      try {
        const u = new URL("https:" + location);
        u.hostname = currentHostname;
        u.protocol = "https:";
        return u.toString();
      } catch {
        return `https://${currentHostname}${location.slice(1)}`;
      }
    }

    const u = new URL(location);

    // Hosts que devem ser reescritos (NÃO incluir app.comandocentral.com.br para evitar loop)
    const rewriteHosts = new Set([
      "orbit-commerce-os.lovable.app",
      "shops.comandocentral.com.br",
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

  // Não reescrever cookies do app.comandocentral.com.br para evitar loops
  const badDomains = new Set([
    "orbit-commerce-os.lovable.app",
    "shops.comandocentral.com.br",
    originHost,
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
