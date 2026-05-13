---
name: Multi-Tenant Favicon Standard
description: Favicon per tenant served via Worker -> storefront-favicon edge, fallback Comando Central
type: feature
---

# Favicon Multi-Tenant — Regra

## Problema resolvido
Google e crawlers requisitam `/favicon.ico` direto na raiz, ignorando `<link rel="icon">` do HTML, e por isso recebiam o favicon do Comando Central no domínio do tenant.

## Arquitetura
- Cloudflare Worker `shops-router` intercepta, em hosts de tenant, os caminhos: `/favicon.ico`, `/favicon-{16,32,48}x{16,32,48}.png`, `/apple-touch-icon{,-precomposed}.png`, `/android-chrome-{192,512}x{192,512}.png`, `/site.webmanifest`, `/manifest.json`, `/browserconfig.xml`, `/safari-pinned-tab.svg`.
- Worker chama edge `storefront-favicon` com `?host=<host>&size=<n|ico>` ou `&kind=manifest`.
- Edge resolve tenant via `tenant_domains`, lê `store_settings.favicon_files`/`favicon_url`, devolve 302 para wsrv.nl com tamanho correto.
- `app.comandocentral.com.br` NÃO é interceptado.

## Fallback
Sempre Comando Central (`https://app.comandocentral.com.br/favicon.ico` e variantes), nunca quebra.

## Cache
24h no edge (assets), 24h no manifest, 5min em fallback de erro.

## HTML
`storefront-html` injeta apenas paths relativos (`/favicon.ico`, `/favicon-32x32.png`, etc.). Worker entrega o byte real. Não usa mais `wsrv.nl` direto no `<link rel="icon">`.

## Anti-regressão
- Mexer em `block-compiler` ou `storefront-html` não pode remover as tags `<link rel="icon" href="/favicon-...">`.
- Adicionar tamanho novo = atualizar `PLATFORM_FALLBACK` na edge + `FAVICON_PATHS`/`faviconParamsFor` no Worker.
- NUNCA confiar em header de cliente para resolver host — usar sempre `tenant_domains`.

## Doc oficial
`docs/especificacoes/storefront/favicon-multi-tenant.md`

## Snippet do Worker
`docs/cloudflare-worker-favicon-snippet.js` (cole no `shops-router`).
