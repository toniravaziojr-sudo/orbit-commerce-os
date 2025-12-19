/**
 * Cloudflare Worker - Custom Domain Router (single domain - loja.respeiteohomem.com.br)
 * 
 * CONFIGURAÇÃO no Cloudflare:
 * 1. Variáveis de ambiente:
 *    - ORIGIN_HOST = orbit-commerce-os.lovable.app
 * 
 * 2. Rota:
 *    - loja.respeiteohomem.com.br/* → cc-domain-router
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const ORIGIN_HOST = env.ORIGIN_HOST || "orbit-commerce-os.lovable.app";

    // Só na raiz "/" redireciona para /store/respeite-o-homem
    // USA URL ABSOLUTA EXPLÍCITA (evita erro de parse)
    if (url.pathname === "/" || url.pathname === "") {
      const redirectUrl = "https://" + url.hostname + "/store/respeite-o-homem";
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
    
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-Forwarded-Proto", "https");

    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
      redirect: "manual",
    });

    return fetch(originRequest);
  },
};
