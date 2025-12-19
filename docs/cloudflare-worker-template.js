/**
 * Cloudflare Worker - Shops Router (SaaS multi-tenant)
 * 
 * Roteia *.shops.comandocentral.com.br para o origin Lovable,
 * extraindo o tenantSlug do subdomínio automaticamente.
 * 
 * CONFIGURAÇÃO no Cloudflare:
 * 1. Variáveis de ambiente:
 *    - ORIGIN_HOST = orbit-commerce-os.lovable.app
 * 
 * 2. Rotas:
 *    - *.shops.comandocentral.com.br/* → shops-router
 *    - shops.comandocentral.com.br/* → shops-router
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ORIGIN_HOST = env.ORIGIN_HOST || "orbit-commerce-os.lovable.app";
    const hostname = url.hostname;

    // shops.comandocentral.com.br (sem tenant) -> redireciona pro app
    if (hostname === "shops.comandocentral.com.br") {
      return Response.redirect("https://app.comandocentral.com.br/", 302);
    }

    // Extrai tenantSlug do subdomínio: {tenant}.shops.comandocentral.com.br
    const match = hostname.match(/^([^.]+)\.shops\.comandocentral\.com\.br$/i);
    if (!match) {
      return new Response("Domain not configured", { status: 404 });
    }

    const tenantSlug = match[1].toLowerCase();
    
    // Bloqueia slugs reservados para evitar conflitos
    const reserved = new Set(["app", "shops", "www"]);
    if (reserved.has(tenantSlug)) {
      return new Response("Domain not configured", { status: 404 });
    }

    // Na raiz "/", redireciona para /store/{tenantSlug} (preserva querystring)
    if (url.pathname === "/" || url.pathname === "") {
      const redirectUrl = `https://${hostname}/store/${tenantSlug}${url.search || ""}`;
      return Response.redirect(redirectUrl, 302);
    }

    // Todo o resto (/store/*, /assets/*, /api/*, etc) -> proxy direto pro origin
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

    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual",
    });

    return fetch(originRequest);
  },
};
