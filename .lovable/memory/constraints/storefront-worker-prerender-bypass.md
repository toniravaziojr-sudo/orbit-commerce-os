# Memory: constraints/storefront-worker-prerender-bypass
Updated: 2026-04-18 (v3)

## Regras anti-regressão (Worker `shops-router`)

1. **Phase 4 é o caminho padrão.** Toda rota pública GET deve ir para `storefront-html` ANTES de qualquer fallback SPA, sem depender do header `Accept`. Bots e prefetches incluídos.
2. **`ctx.waitUntil` é obrigatório em TODA escrita na Cache API** (HTML, assets, bootstrap). Sem isso, o runtime aborta o `put` e o cache fica 0% HIT.
3. **Antes de `caches.default.put`, REMOVER `Set-Cookie`, `Vary` e `Pragma`** da response. A Cache API do Cloudflare rejeita silenciosamente respostas com esses headers — o `put` retorna sem erro mas nada é gravado. Sintoma idêntico ao da regra #2 (sempre MISS), mas a causa é outra. Set-Cookie costuma ser injetado pelo Supabase Gateway (`__cf_bm`) e vaza até o cache se não for filtrado.
4. **HTML <2KB em rota pública = bypass.** Investigar imediatamente.

## Sinais de alarme
- HTML ~951 bytes (shell SPA vazio) com `cf-cache-status: DYNAMIC` e ausência de `X-CC-Render-Mode`.
- TTFB OK (~600ms) mas LCP/conteúdo visível 4–6s.
- `X-CC-Cache: MISS` em 100% das requisições para a mesma URL/PoP, mesmo após várias visitas (regra #3 ou #2).
- `cf-cache-status: DYNAMIC` em 100% das requisições.
- `storefront_prerendered_pages` com >20% de linhas `stale`.

## Diagnóstico rápido
1. `curl -s -D - -o /dev/null https://<dominio>/` (GET real, NÃO HEAD) — Phase 4 só responde para GET. Checar `X-CC-Render-Mode`, `X-CC-Cache`, `cf-cache-status`, tamanho do body.
2. 5 requests seguidos na MESMA URL: `X-CC-Cache` deve ir de MISS → HIT a partir da 2ª. Se ficar sempre MISS, conferir Set-Cookie na response.
3. `curl -sI https://<dominio>/_debug` — checar `cache.usesWaitUntil: true` e `strategy: edge_rendered_html_first_v2`.
4. `psql -c "SELECT status, COUNT(*) FROM storefront_prerendered_pages GROUP BY status;"`.
5. Bater direto em `storefront-html?hostname=...&path=/` — se voltar 185KB com `x-render-mode: prerendered`, problema está no Worker.

## Documentação oficial
- Layer 2: §33 Padrão 7 (waitUntil + sanitize headers) + §34 Princípio 5 (Phase 4 padrão) em `docs/REGRAS-DO-SISTEMA.md`.
- Layer 3: arquitetura Content-First em `docs/especificacoes/storefront/loja-virtual.md` (linhas ~161).
- Layer 3 transversal: Padrão 7 detalhado em `docs/especificacoes/transversais/padroes-operacionais.md`.
- Layer 5: incidente em `docs/tecnico/incidentes/2026-04-storefront-checkout-lentidao.md`.
- Worker template oficial: `docs/cloudflare-worker-template.js` (v2.0.1).
