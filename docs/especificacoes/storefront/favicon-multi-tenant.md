# Favicon Multi-Tenant — Especificação

## Objetivo
Garantir que cada loja exiba seu próprio favicon em todos os contextos (aba do navegador, resultados do Google, PWA, atalhos), eliminando o problema de o Google mostrar o favicon do Comando Central no lugar do favicon do tenant.

## Causa raiz
Crawlers (Google, Bing) e muitos navegadores requisitam diretamente `/favicon.ico` na raiz do domínio, ignorando `<link rel="icon">` no HTML. Sem interceptação, o Cloudflare entregava o `public/favicon.ico` do app (Comando Central).

## Arquitetura

```
Browser/Crawler
   │  GET https://loja.cliente.com/favicon.ico
   ▼
Cloudflare Worker (shops-router)
   │  intercepta /favicon.ico, /favicon-*x*.png, /apple-touch-icon.png,
   │  /android-chrome-*x*.png, /site.webmanifest, /manifest.json,
   │  /browserconfig.xml, /safari-pinned-tab.svg
   ▼
Edge Function: storefront-favicon
   │  ?host=<dominio>&size=<n|ico>  ou  ?host=...&kind=manifest
   │  Resolve tenant via tenant_domains
   │  Lê store_settings.favicon_files / favicon_url
   ▼
302 -> URL final do favicon do tenant (via wsrv.nl)
       OU fallback Comando Central se tenant não configurou
```

## Comportamento

- **Tenant com favicon configurado** → 302 para o asset do tenant (redimensionado pelo wsrv.nl).
- **Tenant sem favicon** → 302 para o favicon do Comando Central (fallback universal).
- **Domínio desconhecido / falha de resolução** → fallback Comando Central.
- **`/site.webmanifest`** → JSON dinâmico com `name` da loja e ícones 192/512.

## Cache

- Assets de imagem: `Cache-Control: public, max-age=86400` (24h) no edge.
- Manifest: `s-maxage=86400`.
- Fallback de erro: `max-age=300` (curto, para se recuperar rápido).

## Injeção no HTML do storefront

A edge `storefront-html` injeta apenas referências relativas (`/favicon.ico`, `/favicon-32x32.png`, `/apple-touch-icon.png`, `/site.webmanifest`). Quem entrega o byte real é o Worker → `storefront-favicon`.

## Worker — rotas a interceptar

Para qualquer host de tenant (não `app.comandocentral.com.br`), o Worker deve interceptar:

- `/favicon.ico`
- `/favicon-16x16.png`, `/favicon-32x32.png`, `/favicon-48x48.png`
- `/apple-touch-icon.png`, `/apple-touch-icon-precomposed.png`
- `/android-chrome-192x192.png`, `/android-chrome-512x512.png`
- `/site.webmanifest`, `/manifest.json`
- `/browserconfig.xml`, `/safari-pinned-tab.svg` (fallback estático)

E reescrever para a edge function:

```
https://<SUPABASE_URL>/functions/v1/storefront-favicon?host=<host>&size=<n|ico>
https://<SUPABASE_URL>/functions/v1/storefront-favicon?host=<host>&kind=manifest
```

## Segurança
- Edge é pública (`verify_jwt = false`) — só serve assets de imagem por design.
- Resolução de tenant sempre via `tenant_domains` (DB), nunca confia em header de cliente.
- Em qualquer falha → fallback Comando Central (nunca quebra a página).

## Não-regressão
- Mudanças em `block-compiler` ou `storefront-html` não afetam favicon — pipelines independentes.
- Adicionar novo tamanho é uma linha em `PLATFORM_FALLBACK` + nova rota no Worker.
