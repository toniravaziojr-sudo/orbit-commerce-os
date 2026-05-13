// =============================================================
// Cloudflare Worker — favicon multi-tenant interception
// Cole estes trechos no Worker `shops-router` (ou equivalente).
// =============================================================
//
// Pré-requisitos (já existentes no Worker):
//   env.SUPABASE_URL          (ex.: https://ojssezfjhdvvncsqyhyq.supabase.co)
//   env.SUPABASE_ANON_KEY     (anon key, não usada aqui mas mantida)
//
// Hosts a tratar:
//   - *.shops.comandocentral.com.br (subdomínios da plataforma)
//   - Domínios customizados de tenants (qualquer host que não seja
//     app.comandocentral.com.br)
// NUNCA interceptar para app.comandocentral.com.br — ele tem favicon próprio.

const FAVICON_PATHS = new Set([
  '/favicon.ico',
  '/favicon-16x16.png',
  '/favicon-32x32.png',
  '/favicon-48x48.png',
  '/apple-touch-icon.png',
  '/apple-touch-icon-precomposed.png',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/site.webmanifest',
  '/manifest.json',
  '/browserconfig.xml',
  '/safari-pinned-tab.svg',
]);

function faviconParamsFor(pathname) {
  switch (pathname) {
    case '/favicon.ico':                       return { size: 'ico' };
    case '/favicon-16x16.png':                 return { size: '16' };
    case '/favicon-32x32.png':                 return { size: '32' };
    case '/favicon-48x48.png':                 return { size: '48' };
    case '/apple-touch-icon.png':
    case '/apple-touch-icon-precomposed.png':  return { size: '180' };
    case '/android-chrome-192x192.png':        return { size: '192' };
    case '/android-chrome-512x512.png':        return { size: '512' };
    case '/site.webmanifest':
    case '/manifest.json':                     return { kind: 'manifest' };
    case '/safari-pinned-tab.svg':             return { size: 'svg' };
    case '/browserconfig.xml':                 return { kind: 'browserconfig' };
    default:                                    return null;
  }
}

// Chame esta função no início do fetch handler do Worker, ANTES de qualquer
// outra lógica de roteamento. Se ela retornar um Response, devolva-o direto.
async function handleFaviconRequest(request, env) {
  const url = new URL(request.url);

  // Só intercepta para hosts de tenant
  const host = url.hostname.toLowerCase();
  if (host === 'app.comandocentral.com.br') return null;

  if (!FAVICON_PATHS.has(url.pathname)) return null;

  // browserconfig.xml: resposta estática mínima (Microsoft Tiles)
  if (url.pathname === '/browserconfig.xml') {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
<browserconfig><msapplication><tile>
<square150x150logo src="/android-chrome-192x192.png"/>
<TileColor>#ffffff</TileColor>
</tile></msapplication></browserconfig>`;
    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=86400',
      },
    });
  }

  const params = faviconParamsFor(url.pathname);
  if (!params) return null;

  // Cache de borda do Worker (mesma URL alvo = mesmo cache key)
  const cacheKey = new Request(
    `https://favicon.cache/${host}${url.pathname}`,
    { method: 'GET' },
  );
  const cache = caches.default;
  const cached = await cache.match(cacheKey);
  if (cached) return cached;

  const target = new URL(`${env.SUPABASE_URL}/functions/v1/storefront-favicon`);
  target.searchParams.set('host', host);
  if (params.kind) target.searchParams.set('kind', params.kind);
  if (params.size) target.searchParams.set('size', params.size);

  // redirect: 'manual' para que o 302 da edge passe direto até o cliente
  let upstream;
  try {
    upstream = await fetch(target.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: { 'x-forwarded-host': host },
    });
  } catch (e) {
    // Fallback Comando Central em caso de erro de rede
    return Response.redirect('https://app.comandocentral.com.br/favicon.ico', 302);
  }

  // Repassa a resposta com cache no edge
  const headers = new Headers(upstream.headers);
  headers.set('Cache-Control', 'public, max-age=86400, s-maxage=86400');
  const response = new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers,
  });

  if (response.status === 200 || response.status === 302) {
    // ctx.waitUntil seria ideal, aqui é simplificado
    cache.put(cacheKey, response.clone()).catch(() => {});
  }

  return response;
}

// =============================================================
// USO no fetch handler do Worker:
//
// export default {
//   async fetch(request, env, ctx) {
//     const faviconResp = await handleFaviconRequest(request, env);
//     if (faviconResp) return faviconResp;
//
//     // ... resto do roteamento existente do shops-router ...
//   }
// }
// =============================================================
