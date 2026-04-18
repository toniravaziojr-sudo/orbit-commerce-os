# Memory: constraints/storefront-worker-prerender-bypass
Updated: 2026-04-18 (v2)

## Regras anti-regressão (Worker `shops-router`)

1. **Phase 4 é o caminho padrão.** Toda rota pública GET deve ir para `storefront-html` ANTES de qualquer fallback SPA, sem depender do header `Accept`. Bots e prefetches incluídos.
2. **`ctx.waitUntil` é obrigatório em TODA escrita na Cache API** (HTML, assets, bootstrap). Sem isso, o runtime aborta o `put` e o cache fica 0% HIT.
3. **HTML <2KB em rota pública = bypass.** Investigar imediatamente.

## Sinais de alarme
- HTML ~951 bytes (shell SPA vazio) com `cf-cache-status: DYNAMIC` e ausência de `X-CC-Render-Mode`.
- TTFB OK (~600ms) mas LCP/conteúdo visível 4–6s.
- `cf-cache-status: DYNAMIC` em 100% das requisições, mesmo após várias visitas.
- `storefront_prerendered_pages` com >20% de linhas `stale`.

## Diagnóstico rápido
1. `curl -sI https://<dominio>/` — checar tamanho, `X-CC-Render-Mode`, `X-CC-Cache`, `cf-cache-status`.
2. `curl -sI https://<dominio>/_debug` — checar `cache.usesWaitUntil: true`.
3. `psql -c "SELECT status, COUNT(*) FROM storefront_prerendered_pages GROUP BY status;"`.
4. Bater direto em `storefront-html?hostname=...&path=/` — se voltar 185KB com `x-render-mode: prerendered`, problema está no Worker.

## Documentação oficial
- Layer 2: §33 Padrão 7 (waitUntil) + §34 Princípio 5 (Phase 4 padrão) em `docs/REGRAS-DO-SISTEMA.md`.
- Layer 3: arquitetura Content-First em `docs/especificacoes/storefront/loja-virtual.md` (linhas ~161).
- Layer 3 transversal: Padrão 7 detalhado em `docs/especificacoes/transversais/padroes-operacionais.md`.
- Layer 5: incidente em `docs/tecnico/incidentes/2026-04-storefront-checkout-lentidao.md`.
- Worker template oficial: `docs/cloudflare-worker-template.js` (v2.0.0).
