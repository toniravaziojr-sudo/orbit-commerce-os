/**
 * Cloudflare Worker - Multi-tenant SaaS Router
 * 
 * Roteia tráfego para o origin Lovable, suportando:
 * 1. Subdomínios da plataforma: {tenant}.shops.comandocentral.com.br
 * 2. Domínios custom dos clientes: loja.cliente.com.br
 * 
 * CONFIGURAÇÃO no Cloudflare:
 * 1. Variáveis de ambiente:
 *    - ORIGIN_HOST = orbit-commerce-os.lovable.app
 *    - SUPABASE_URL = https://ojssezfjhdvvncsqyhyq.supabase.co (para resolve-domain)
 *    - SUPABASE_ANON_KEY = <sua anon key> (para resolve-domain)
 * 
 * 2. Rotas:
 *    - *.shops.comandocentral.com.br/* → shops-router
 *    - shops.comandocentral.com.br/* → shops-router
 * 
 * 3. Custom Hostnames (APENAS para domínios externos dos clientes):
 *    - NÃO cadastrar subdomínios *.shops.comandocentral.com.br como Custom Hostname
 *    - Cada domínio custom EXTERNO precisa ser registrado via API no Cloudflare for SaaS
 * 
 * IMPORTANTE:
 * - SSL/TLS do zone deve estar em Full (Strict)
 * - Subdomínios *.shops.* são resolvidos via DNS wildcard + Worker routes
 * - Custom Hostnames são APENAS para domínios externos (ex: loja.cliente.com.br)
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    const ORIGIN_HOST = env.ORIGIN_HOST || "orbit-commerce-os.lovable.app";
    const SUPABASE_URL = env.SUPABASE_URL || env.SUPABASE_URI; // fallback para ambos os nomes
    const SUPABASE_ANON_KEY = env.SUPABASE_ANON_KEY;

    const hostname = url.hostname;

    // shops.comandocentral.com.br (sem tenant) -> redireciona pro app
    if (hostname === "shops.comandocentral.com.br") {
      return Response.redirect("https://app.comandocentral.com.br/", 302);
    }

    let tenantSlug = null;
    let domainType = "platform_subdomain";

    // Tenta extrair tenant do subdomínio: {tenant}.shops.comandocentral.com.br
    const match = hostname.match(/^([^.]+)\.shops\.comandocentral\.com\.br$/i);
    if (match) {
      tenantSlug = match[1].toLowerCase();

      // Bloqueia slugs reservados para evitar conflitos
      const reserved = new Set(["app", "shops", "www", "api", "cdn", "admin"]);
      if (reserved.has(tenantSlug)) {
        return new Response("Domain not configured", { status: 404 });
      }
    } else {
      // Domínio custom (ex: loja.cliente.com.br) - precisa resolver via API
      if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
        console.log(`[Worker] Custom domain ${hostname} but no Supabase config`);
        return new Response("Domain not configured", { status: 404 });
      }

      try {
        const resolveUrl = `${SUPABASE_URL}/functions/v1/resolve-domain`;
        const resolveResponse = await fetch(resolveUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ hostname }),
        });

        if (!resolveResponse.ok) {
          console.log(`[Worker] resolve-domain failed: ${resolveResponse.status}`);
          return new Response("Domain not configured", { status: 404 });
        }

        const data = await resolveResponse.json();

        if (!data.found || !data.tenant_slug) {
          console.log(`[Worker] Domain not found in database: ${hostname}`);
          return new Response("Domain not configured", { status: 404 });
        }

        tenantSlug = data.tenant_slug;
        domainType = data.domain_type || "custom";

        console.log(`[Worker] Resolved custom domain: ${hostname} -> ${tenantSlug}`);
      } catch (err) {
        console.error(`[Worker] Error resolving domain: ${err.message}`);
        return new Response("Domain resolution error", { status: 500 });
      }
    }

    if (!tenantSlug) {
      return new Response("Domain not configured", { status: 404 });
    }

    // CRÍTICO: SPA/React Router -> na raiz "/" faz 302 para /store/{tenant}
    // NÃO usar rewrite interno, pois a URL do navegador ficaria em "/" e o React Router
    // entraria na rota do Dashboard (protegido), causando redirect para /auth
    if (url.pathname === "/" || url.pathname === "") {
      const redirectUrl = `https://${hostname}/store/${tenantSlug}${url.search || ""}`;
      console.log(`[Worker] Redirecting / to ${redirectUrl}`);
      return Response.redirect(redirectUrl, 302);
    }

    // Monta a URL do origin
    const originUrl = new URL(request.url);
    originUrl.hostname = ORIGIN_HOST;

    // CRÍTICO: Criar novos headers SEM o Host original
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      if (key.toLowerCase() === "host") continue;
      headers.set(key, value);
    }

    headers.set("X-Forwarded-Host", hostname);
    headers.set("X-Forwarded-Proto", "https");
    headers.set("X-Tenant-Slug", tenantSlug);
    headers.set("X-Domain-Type", domainType);

    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual", // Importante: captura redirects para reescrever
    });

    console.log(`[Worker] Fetching origin: ${originUrl.toString()}`);
    const response = await fetch(originRequest);

    // Reescrever headers Location em respostas 3xx (redirects)
    // Isso garante que redirects do origin não "vazem" para app.comandocentral.com.br
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("Location");
      if (location) {
        const rewrittenLocation = rewriteLocationHeader(location, hostname);
        if (rewrittenLocation !== location) {
          console.log(`[Worker] Rewriting Location: ${location} -> ${rewrittenLocation}`);
          // Clone response com Location reescrito
          const newHeaders = new Headers(response.headers);
          newHeaders.set("Location", rewrittenLocation);
          return new Response(response.body, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders,
          });
        }
      }
    }

    return response;
  },
};

/**
 * Reescreve Location headers de redirects para manter no domínio correto
 * - Paths relativos (/auth, /store/...) são convertidos para absolutos no host atual
 * - URLs absolutas apontando para app.* ou origin são reescritas para o host atual
 */
function rewriteLocationHeader(location, currentHostname) {
  try {
    // Se for path relativo, converte para absoluto no host atual
    // Isso evita que redirects relativos do origin "vazem" para outro domínio
    if (location.startsWith("/")) {
      return `https://${currentHostname}${location}`;
    }

    const url = new URL(location);

    // Padrões que devem ser reescritos para o hostname atual
    const patternsToRewrite = new Set([
      "app.comandocentral.com.br",
      "orbit-commerce-os.lovable.app",
    ]);

    if (patternsToRewrite.has(url.hostname)) {
      url.hostname = currentHostname;
      return url.toString();
    }

    // Se o Location está apontando para outro host, mantém como está
    return location;
  } catch (e) {
    // Fallback: retorna como está
    return location;
  }
}
