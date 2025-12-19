/**
 * Cloudflare Worker - Custom Domain Router (single domain - loja.respeiteohomem.com.br)
 * 
 * Regra simples:
 *  - "/" => redirect 302 para /store/respeite-o-homem
 *  - qualquer outro path => proxy direto para ORIGIN, preservando path
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
    if (url.pathname === "/" || url.pathname === "") {
      return Response.redirect(`https://${url.hostname}/store/respeite-o-homem`, 302);
    }

    // Todo o resto (/store/*, /assets/*, /api/*, etc) -> proxy direto pro origin
    // SEM REESCREVER O PATH
    const originUrl = new URL(request.url);
    originUrl.hostname = ORIGIN_HOST;

    const headers = new Headers(request.headers);
    headers.set("Host", ORIGIN_HOST);
    headers.set("X-Forwarded-Host", url.hostname);

    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers,
      body: request.method === "GET" || request.method === "HEAD" ? undefined : request.body,
      redirect: "manual",
    });

    return fetch(originRequest);
  },
};

/**
 * INSTRUÇÕES:
 * 
 * 1. Cole EXATAMENTE este código no Worker cc-domain-router
 * 2. Clique em "Implantar" (Deploy)
 * 3. Teste: https://loja.respeiteohomem.com.br/
 * 
 * O QUE ESTE CÓDIGO FAZ:
 * - "/" redireciona para /store/respeite-o-homem
 * - /assets/* vai direto pro origin (NÃO reescreve para /store/slug/assets/*)
 * - /store/* vai direto pro origin
 * - Qualquer outro path vai direto pro origin
 * 
 * IMPORTANTE: O código antigo estava reescrevendo /assets/* para 
 * /store/respeite-o-homem/assets/* - isso não existe no origin!
 */
