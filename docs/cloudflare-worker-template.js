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
      return Response.redirect(`${url.origin}/store/respeite-o-homem`, 302);
    }

    // Todo o resto (/store/*, /assets/*, /api/*, etc) -> proxy direto pro origin
    // SEM REESCREVER O PATH
    const originUrl = new URL(request.url);
    originUrl.hostname = ORIGIN_HOST;

    // CRÍTICO: Criar novos headers SEM o Host original
    const headers = new Headers();
    for (const [key, value] of request.headers.entries()) {
      // Pula o header Host - vamos deixar o fetch usar o hostname correto
      if (key.toLowerCase() === "host") continue;
      headers.set(key, value);
    }
    
    // Adiciona headers de forwarding para debug
    headers.set("X-Forwarded-Host", url.hostname);
    headers.set("X-Forwarded-Proto", "https");

    // Cria a request para o origin
    const originRequest = new Request(originUrl.toString(), {
      method: request.method,
      headers,
      body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
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
 * - REMOVE o header Host original (causa do erro 1101 e MIME text/plain)
 * 
 * VARIÁVEIS DE AMBIENTE NECESSÁRIAS:
 * - ORIGIN_HOST = orbit-commerce-os.lovable.app
 */
