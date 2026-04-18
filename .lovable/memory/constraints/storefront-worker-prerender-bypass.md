# Memory: constraints/storefront-worker-prerender-bypass
Updated: 2026-04-18

## Regra anti-regressão
Nunca aceitar que uma rota pública de loja retorne HTML <2KB do Worker sem investigar bypass do pré-render. Resposta correta tem ≥100KB e header `X-CC-Render-Mode: edge-html` ou `X-Prerender-At`.

## Sinal de alarme
- Site retornando ~951 bytes (shell SPA vazio) com `cf-cache-status: DYNAMIC` e ausência de `X-CC-Render-Mode`.
- Tempo TTFB OK (~600ms) mas LCP/conteúdo visível 4–6s.
- Tabela `storefront_prerendered_pages` com >20% das linhas em status `stale`.

## Como diagnosticar rápido
1. `curl -sI https://<dominio>/` — checar tamanho e headers `X-CC-*`.
2. `psql -c "SELECT status, COUNT(*) FROM storefront_prerendered_pages GROUP BY status;"`.
3. Bater direto em `storefront-html?hostname=...&path=/` — se voltar 185KB com `x-render-mode: prerendered`, o problema está no Worker.

## Documentação oficial
- Layer 2: contrato Worker ↔ HTML pré-renderizado em `docs/REGRAS-DO-SISTEMA.md`.
- Layer 3: arquitetura Content-First em `docs/especificacoes/storefront/`.
- Layer 5: incidente completo em `docs/tecnico/incidentes/2026-04-storefront-checkout-lentidao.md`.
- Worker template: `docs/cloudflare-worker-template.js` (Phase 4, linhas 466–592).
