/**
 * Cloudflare Worker - Multi-tenant SaaS Router (VERSÃO SIMPLIFICADA)
 *
 * Arquitetura domain-based:
 * - O React App já detecta o hostname e resolve o tenant
 * - O Worker só faz proxy transparente para o origin
 * - NÃO adiciona /store/{tenant} - o app resolve sozinho
 *
 * ENV vars:
 * - ORIGIN_HOST = orbit-commerce-os.lovable.app
 * - SUPABASE_URL = https://ojssezfjhdvvncsqyhyq.supabase.co
 * - SUPABASE_ANON_KEY = <sua anon key>
 */

const PLATFORM_BASE_RE = /\.shops\.comandocentral\.com\.br$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const ORIGIN_HOST = env.ORIGIN_HOST || "orbit-commerce-os.lovable.app";
    const SUPABASE_URL = env.SUPABASE_URL || env.SUPABASE_URI;
    const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

    const edgeHost = url.hostname.toLowerCase();
    
    // Rejeitar acesso direto pelo workers.dev
    if (edgeHost.endsWith(".workers.dev")) {
      return new Response("Please access via the correct domain", { status: 404 });
    }

    // Determinar o host público (cf-connecting-host tem prioridade)
    const cfConnectingHost = request.headers.get("cf-connecting-host");
    const publicHost = (cfConnectingHost || edgeHost).toLowerCase().replace(/^www\./, "");

    console.log(`[Worker] Request: host=${publicHost} path=${url.pathname}`);

    // ============================================
    // ENDPOINT DE DEBUG: /_debug
    // ============================================
    if (url.pathname === "/_debug" || url.pathname === "/_health") {
      const resolved = await resolveTenant(publicHost, { SUPABASE_URL, SUPABASE_ANON_KEY });
      const debugInfo = {
        timestamp: new Date().toISOString(),
        hostname: publicHost,
        cfConnectingHost: cfConnectingHost || null,
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
      };
      return new Response(JSON.stringify(debugInfo, null, 2), {
        status: 200,
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    }

    // shops.comandocentral.com.br sem tenant → manda pro app
    if (publicHost === "shops.comandocentral.com.br") {
      return Response.redirect("https://app.comandocentral.com.br/", 302);
    }

    // Resolver tenant para validação e canonicalização
    const resolved = await resolveTenant(publicHost, { SUPABASE_URL, SUPABASE_ANON_KEY });

    if (!resolved?.tenantSlug) {
      console.log(`[Worker] Domain not configured: ${publicHost}`);
      const debugInfo = {
        error: "Domain not configured",
        hostname: publicHost,
        supabaseConfigured: !!(SUPABASE_URL && SUPABASE_ANON_KEY),
        resolved: resolved,
        hint: "Check if domain is registered in tenant_domains table with status=verified and ssl_status=active",
      };
      return new Response(JSON.stringify(debugInfo, null, 2), { 
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    const tenantSlug = resolved.tenantSlug;
    const primaryPublicHost = (resolved.primaryPublicHost || "").toLowerCase().replace(/^www\./, "");
    const canonicalHost = primaryPublicHost || publicHost;

    console.log(`[Worker] Resolved: tenant=${tenantSlug} canonical=${canonicalHost}`);

    // ============================================
    // CANONICALIZAÇÃO: platform subdomain → custom domain
    // ============================================
    if (PLATFORM_BASE_RE.test(publicHost) && primaryPublicHost && publicHost !== primaryPublicHost) {
      const cleanSearch = cleanPublicSearch(url.search);
      const target = `https://${primaryPublicHost}${url.pathname}${cleanSearch}`;
      console.log(`[Worker] Canonical redirect: ${publicHost} -> ${primaryPublicHost}`);
      return Response.redirect(target, 301);
    }

    // ============================================
    // PROXY TRANSPARENTE PARA O ORIGIN
    // O React App detecta o hostname e resolve o tenant
    // NÃO adiciona /store/{tenant} - o app faz isso internamente
    // ============================================
    const originUrl = `https://${ORIGIN_HOST}${url.pathname}${url.search || ""}`;
    
    console.log(`[Worker] Proxy to origin: ${originUrl}`);

    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (key.toLowerCase() === "host") continue;
      headers.set(key, value);
    }

    // Headers para o app saber o contexto
    headers.set("Host", ORIGIN_HOST);
    headers.set("X-Forwarded-Host", publicHost);
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Tenant-Slug", tenantSlug);
    headers.set("X-Domain-Type", PLATFORM_BASE_RE.test(publicHost) ? "platform_subdomain" : "custom");

    const response = await fetch(originUrl, {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual", // NÃO seguir redirects automaticamente
    });

    console.log(`[Worker] Origin response: ${response.status}`);

    // ============================================
    // REESCREVER REDIRECTS DO ORIGIN
    // Se origin redireciona para lovable.app, reescrever para o host público
    // ============================================
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (location) {
        const rewrittenLocation = rewriteLocation(location, publicHost, ORIGIN_HOST, tenantSlug);
        console.log(`[Worker] Rewriting redirect: ${location} -> ${rewrittenLocation}`);
        
        const outHeaders = cloneHeaders(response.headers);
        outHeaders.set("Location", rewrittenLocation);
        outHeaders.set("X-CC-Original-Location", location);
        
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: outHeaders,
        });
      }
    }

    // Retornar resposta do origin
    const outHeaders = cloneHeaders(response.headers);
    outHeaders.set("X-CC-Tenant-Slug", tenantSlug);
    outHeaders.set("X-CC-Public-Host", publicHost);

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: outHeaders,
    });
  },
};

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

function cleanPublicSearch(search) {
  if (!search) return "";
  const u = new URL("https://x.invalid/" + search.replace(/^\?/, ""));
  u.searchParams.delete("preview");
  u.searchParams.delete("previewId");
  u.searchParams.delete("previewToken");
  const out = u.searchParams.toString();
  return out ? `?${out}` : "";
}

function rewriteLocation(location, publicHost, originHost, tenantSlug) {
  try {
    // Path relativo
    if (location.startsWith("/")) {
      // Remover /store/{tenant} se presente
      const stripped = stripStorePrefix(location, tenantSlug);
      const cleanPath = stripped !== null ? stripped : location;
      return `https://${publicHost}${cleanPath}`;
    }

    // URL absoluta
    const u = new URL(location);
    const targetHost = u.hostname.toLowerCase();

    // Lista de hosts do origin que devem ser reescritos
    const originHosts = new Set([
      "orbit-commerce-os.lovable.app",
      "shops.comandocentral.com.br",
      "app.comandocentral.com.br",
      originHost.toLowerCase(),
    ]);

    if (originHosts.has(targetHost) || targetHost.endsWith(".lovable.app")) {
      u.hostname = publicHost;
      u.protocol = "https:";
      
      // Remover /store/{tenant} se presente
      const stripped = stripStorePrefix(u.pathname, tenantSlug);
      if (stripped !== null) u.pathname = stripped;
      
      return u.toString();
    }

    return location;
  } catch {
    return location;
  }
}

function stripStorePrefix(pathname, tenantSlug) {
  const p = pathname || "/";
  const prefix = `/store/${tenantSlug}`;
  if (p === prefix) return "/";
  if (p.startsWith(prefix + "/")) return p.slice(prefix.length) || "/";
  return null;
}

function cloneHeaders(headers) {
  const out = new Headers();
  for (const [key, value] of headers.entries()) {
    // Remover headers problemáticos
    if (key.toLowerCase() === "content-encoding") continue;
    if (key.toLowerCase() === "content-length") continue;
    out.append(key, value);
  }
  return out;
}

async function resolveTenant(hostname, { SUPABASE_URL, SUPABASE_ANON_KEY }) {
  // Tentar cache primeiro
  if (SUPABASE_URL && SUPABASE_ANON_KEY) {
    const cacheKey = new Request(`https://resolve-domain-cache.internal/${hostname}`);
    try {
      const cached = await caches.default.match(cacheKey);
      if (cached) {
        const data = await cached.json();
        if (data?.tenantSlug) {
          console.log(`[Worker] Tenant from cache: ${data.tenantSlug}`);
          return data;
        }
      }
    } catch {}

    // Chamar edge function
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

        // Aceitar snake_case e camelCase
        const tenantSlug = data.tenant_slug || data.tenantSlug;
        const primaryPublicHost = data.primary_public_host || data.primaryPublicHost || null;

        if (data.found && tenantSlug) {
          const result = {
            tenantSlug: tenantSlug,
            primaryPublicHost: primaryPublicHost,
          };

          // Cachear resultado
          try {
            const cacheRes = new Response(JSON.stringify(result), {
              headers: { "Cache-Control": "max-age=300" },
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

  // Fallback: extrair tenant de platform subdomain
  const platformMatch = hostname.match(/^([a-z0-9-]+)\.shops\.comandocentral\.com\.br$/i);
  if (platformMatch) {
    return {
      tenantSlug: platformMatch[1],
      primaryPublicHost: null,
    };
  }

  return null;
}
