/**
 * Cloudflare Worker Template - Domain Routing for Multi-Tenant Storefront
 * 
 * Este worker roteia requisições de domínios personalizados para o tenant correto.
 * 
 * IMPORTANTE: 
 * - Só resolve tenant na raiz "/" (redirect para /store/:slug)
 * - Para todos outros paths, faz proxy direto para o origin (preservando path)
 * 
 * CONFIGURAÇÃO:
 * 1. Crie um Worker no Cloudflare Dashboard
 * 2. Configure as variáveis de ambiente:
 *    - SUPABASE_URL: URL do projeto Supabase
 *    - RESOLVE_DOMAIN_URL: URL da edge function resolve-domain
 *    - ORIGIN_HOST: Host de origem (ex: orbit-commerce-os.lovable.app)
 * 3. Configure as rotas para o domínio customizado
 * 
 * USO:
 * - Domínios dos clientes apontam (CNAME) para o origin host
 * - Este worker intercepta as requisições e resolve o tenant
 * - Requisições são encaminhadas para o storefront correto
 */

// Cache para lookup de domínios (TTL: 5 minutos)
const CACHE_TTL = 300;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    // Normalizar hostname: lowercase, sem porta, sem trailing dot
    const hostname = url.hostname.toLowerCase().split(':')[0].replace(/\.$/, '');
    const pathname = url.pathname;
    
    console.log(`[Worker] Incoming request: ${hostname}${pathname}`);

    // Verificar se é um hostname do Lovable (não precisa processar)
    if (hostname.endsWith('.lovable.app') || hostname.endsWith('.workers.dev')) {
      console.log(`[Worker] Lovable/Workers host, passthrough`);
      return fetch(request);
    }

    // Verificar se é um hostname base conhecido (não precisa resolver tenant)
    const baseHostnames = [
      'shops.respeiteohomem.com.br',
      'localhost',
      '127.0.0.1'
    ];
    
    if (baseHostnames.some(h => hostname === h || hostname.endsWith(`.${h}`))) {
      console.log(`[Worker] Base hostname, passthrough`);
      return fetch(request);
    }

    const originHost = env.ORIGIN_HOST || 'orbit-commerce-os.lovable.app';

    try {
      // ============================================
      // CASO 1: Raiz "/" - Resolver tenant e redirect
      // ============================================
      if (pathname === '/' || pathname === '') {
        console.log(`[Worker] Root path, resolving tenant for: ${hostname}`);
        
        const tenantInfo = await resolveTenant(hostname, env, ctx);
        
        if (!tenantInfo.found) {
          console.log(`[Worker] Tenant not found for: ${hostname}`);
          return new Response('Domínio não encontrado', { 
            status: 404,
            headers: { 'Content-Type': 'text/html; charset=utf-8' }
          });
        }

        console.log(`[Worker] Resolved: ${hostname} -> ${tenantInfo.tenant_slug}`);
        
        // Redirect 302 para /store/:slug no mesmo domínio custom
        const redirectUrl = `https://${hostname}/store/${tenantInfo.tenant_slug}`;
        console.log(`[Worker] Redirecting to: ${redirectUrl}`);
        
        return Response.redirect(redirectUrl, 302);
      }

      // ============================================
      // CASO 2: Qualquer outro path - Proxy direto para origin
      // ============================================
      // Isso inclui: /assets/*, /store/*, /api/*, /favicon.ico, /robots.txt, etc.
      
      const upstreamUrl = new URL(`https://${originHost}${pathname}${url.search}`);
      console.log(`[Worker] Proxying to: ${upstreamUrl.toString()}`);
      
      // Clonar headers e ajustar Host
      const headers = new Headers(request.headers);
      headers.set('Host', originHost);
      headers.set('X-Forwarded-Host', hostname);
      headers.set('X-Original-Host', hostname);
      
      const upstreamRequest = new Request(upstreamUrl.toString(), {
        method: request.method,
        headers: headers,
        body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
        redirect: 'manual'
      });

      const response = await fetch(upstreamRequest);
      
      // Clonar response para poder modificar headers se necessário
      const responseHeaders = new Headers(response.headers);
      
      // Adicionar CORS headers para permitir requests do domínio custom
      responseHeaders.set('Access-Control-Allow-Origin', '*');
      responseHeaders.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      responseHeaders.set('Access-Control-Allow-Headers', 'authorization, x-client-info, apikey, content-type');
      
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders
      });

    } catch (error) {
      console.error(`[Worker] Error: ${error.message}`);
      return new Response('Erro interno do servidor', { 
        status: 500,
        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
      });
    }
  }
};

/**
 * Resolve tenant pelo hostname usando a edge function
 * Implementa cache para evitar consultas repetidas
 */
async function resolveTenant(hostname, env, ctx) {
  const cacheKey = `tenant:${hostname}`;
  
  // Tentar cache primeiro (usando KV se disponível)
  if (env.TENANT_CACHE) {
    const cached = await env.TENANT_CACHE.get(cacheKey, { type: 'json' });
    if (cached) {
      console.log(`[Worker] Cache hit for: ${hostname}`);
      return cached;
    }
  }

  // Chamar edge function para resolver
  const resolveUrl = env.RESOLVE_DOMAIN_URL || 
    `${env.SUPABASE_URL}/functions/v1/resolve-domain`;
  
  console.log(`[Worker] Calling resolve-domain: ${resolveUrl}?hostname=${hostname}`);
  
  const response = await fetch(`${resolveUrl}?hostname=${encodeURIComponent(hostname)}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      // Não precisa de Authorization pois resolve-domain tem verify_jwt = false
    }
  });

  if (!response.ok) {
    console.error(`[Worker] resolve-domain failed: ${response.status}`);
    return { found: false };
  }

  const result = await response.json();
  console.log(`[Worker] resolve-domain response:`, JSON.stringify(result));

  // Cachear resultado (se encontrado)
  if (result.found && env.TENANT_CACHE) {
    ctx.waitUntil(
      env.TENANT_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL })
    );
  }

  return result;
}

/**
 * INSTRUÇÕES DE DEPLOY:
 * 
 * 1. No Cloudflare Dashboard, vá em Workers & Pages
 * 2. Crie um novo Worker chamado "cc-domain-router" (ou atualize o existente)
 * 3. Cole este código
 * 4. Configure as variáveis de ambiente em Settings > Variables:
 *    - ORIGIN_HOST = orbit-commerce-os.lovable.app
 *    - SUPABASE_URL = https://ojssezfjhdvvncsqyhyq.supabase.co
 *    - RESOLVE_DOMAIN_URL = https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/resolve-domain
 * 
 * 5. Configure a rota em Triggers > Routes:
 *    - Pattern: loja.respeiteohomem.com.br/*
 *    - Zone: respeiteohomem.com.br
 *    
 *    IMPORTANTE: NÃO use wildcard *.respeiteohomem.com.br/* 
 *    pois isso intercepta TODOS os subdomínios (incluindo Shopify, etc.)
 *    Use rotas específicas para cada domínio custom.
 * 
 * 6. No DNS do Cloudflare:
 *    - CNAME loja -> orbit-commerce-os.lovable.app (Somente DNS, nuvem cinza)
 *    OU
 *    - A loja -> 185.158.133.1 (se necessário, mas prefira CNAME)
 * 
 * TESTE:
 * - https://loja.respeiteohomem.com.br/ deve redirecionar para /store/respeite-o-homem
 * - https://loja.respeiteohomem.com.br/assets/*.css deve retornar CSS com content-type correto
 * - https://loja.respeiteohomem.com.br/store/respeite-o-homem deve carregar a loja
 */
