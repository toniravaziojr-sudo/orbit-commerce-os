/**
 * Cloudflare Worker Template - Domain Routing for Multi-Tenant Storefront
 * 
 * Este worker roteia requisições de domínios personalizados para o tenant correto.
 * 
 * CONFIGURAÇÃO:
 * 1. Crie um Worker no Cloudflare Dashboard
 * 2. Configure as variáveis de ambiente:
 *    - SUPABASE_URL: URL do projeto Supabase
 *    - RESOLVE_DOMAIN_URL: URL da edge function resolve-domain
 *    - ORIGIN_HOST: Host de origem (ex: orbit-commerce-os.lovable.app)
 * 3. Configure as rotas para o Custom Hostname (shops.seudominio.com.br)
 * 
 * USO:
 * - Domínios dos clientes apontam (CNAME) para shops.seudominio.com.br
 * - Este worker intercepta as requisições e resolve o tenant
 * - Requisições são encaminhadas para o storefront correto
 */

// Cache para lookup de domínios (TTL: 5 minutos)
const CACHE_TTL = 300;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const hostname = url.hostname;
    
    console.log(`[Worker] Incoming request: ${hostname}${url.pathname}`);

    // Bypass para assets estáticos e health checks
    if (url.pathname.startsWith('/_next') || 
        url.pathname.startsWith('/static') ||
        url.pathname === '/health' ||
        url.pathname === '/favicon.ico') {
      return fetch(request);
    }

    // Verificar se é um hostname customizado (não é o hostname base)
    const baseHostnames = [
      'shops.respeiteohomem.com.br',
      'localhost',
      '127.0.0.1'
    ];
    
    if (baseHostnames.some(h => hostname.includes(h))) {
      // É o hostname base, não precisa resolver tenant
      return fetch(request);
    }

    try {
      // Tentar resolver o tenant pelo hostname
      const tenantInfo = await resolveTenant(hostname, env, ctx);
      
      if (!tenantInfo.found) {
        console.log(`[Worker] Tenant not found for: ${hostname}`);
        // Retornar 404 ou redirecionar para página padrão
        return new Response('Domínio não encontrado', { 
          status: 404,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }

      console.log(`[Worker] Resolved: ${hostname} -> ${tenantInfo.tenant_slug}`);

      // Reescrever a URL para o storefront do tenant
      const originUrl = new URL(request.url);
      originUrl.hostname = env.ORIGIN_HOST || 'orbit-commerce-os.lovable.app';
      
      // Se não está no path do store, adicionar
      if (!originUrl.pathname.startsWith('/store/')) {
        originUrl.pathname = `/store/${tenantInfo.tenant_slug}${originUrl.pathname}`;
      }

      // Criar nova requisição com o host de origem
      const originRequest = new Request(originUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'manual'
      });

      // Encaminhar para origem
      const response = await fetch(originRequest);

      // Copiar resposta e ajustar headers se necessário
      const newResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

      return newResponse;

    } catch (error) {
      console.error(`[Worker] Error: ${error.message}`);
      return new Response('Erro interno', { status: 500 });
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

  // Cachear resultado (se encontrado)
  if (result.found && env.TENANT_CACHE) {
    ctx.waitUntil(
      env.TENANT_CACHE.put(cacheKey, JSON.stringify(result), { expirationTtl: CACHE_TTL })
    );
  }

  return result;
}

/**
 * Exemplo de configuração wrangler.toml:
 * 
 * name = "storefront-router"
 * main = "worker.js"
 * compatibility_date = "2024-01-01"
 * 
 * [vars]
 * ORIGIN_HOST = "orbit-commerce-os.lovable.app"
 * SUPABASE_URL = "https://ojssezfjhdvvncsqyhyq.supabase.co"
 * RESOLVE_DOMAIN_URL = "https://ojssezfjhdvvncsqyhyq.supabase.co/functions/v1/resolve-domain"
 * 
 * [[kv_namespaces]]
 * binding = "TENANT_CACHE"
 * id = "YOUR_KV_NAMESPACE_ID"
 * 
 * [triggers]
 * routes = [
 *   { pattern = "shops.respeiteohomem.com.br/*", zone_name = "respeiteohomem.com.br" }
 * ]
 */
