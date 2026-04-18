# Incidente — Lentidão Storefront → Checkout (Abril 2026)

## Sintoma
Lojas públicas demorando 4–6s para mostrar conteúdo. Transição para o checkout com tela branca de 1–2s.

## Diagnóstico Real (medições)

| Item | Resultado |
|---|---|
| HTML servido pelo Worker em `/` | 951 bytes (shell SPA vazio) |
| HTML real disponível no banco (`storefront_prerendered_pages`) | 185 KB pronto |
| Páginas com cache `active` no início | 1 de 89 (1%) — 88 marcadas como `stale` |
| Tempo de geração ao vivo via `storefront-html` (sem cache) | ~3,7s |
| Tempo entregando cache pronto via `storefront-html` | ~650ms |
| Erro silencioso em `storefront-bootstrap` | `column product_images_1.position does not exist` |
| Headers do Worker em produção | `x-cc-followed-redirects: 1` (sem `X-CC-Render-Mode: edge-html`) |
| `cf-cache-status` em 100% das requisições | `DYNAMIC` (cache Worker nunca aquecia) |

## Causa raiz (4 problemas encadeados)

1. **Worker em produção sem Phase 4** — versão deployada caía direto no shell SPA vazio.
2. **Cache 100% stale** — pipeline de revalidação parou de disparar `storefront-prerender`.
3. **Bug silencioso em `storefront-bootstrap`** — referenciava coluna inexistente `position` em `product_images` (correta: `sort_order`).
4. **Cache edge do Worker nunca aquecia** — `caches.default.put()` sem `ctx.waitUntil` era abortado pelo runtime do Cloudflare ao final da resposta.

## Correção aplicada

### Frente 3 — Bug coluna inexistente ✅
Substituído `position` por `sort_order` em `storefront-bootstrap`, `tiktok-shop-catalog-sync`, `ads-chat-v2`. `storefront-bootstrap` agora retorna 33 produtos em 668ms.

### Frente 2 — Cache regenerado + monitoramento contínuo ✅
- 86 páginas regeradas em ~27s. Estado: 86 active / 3 stale.
- Tabela `storefront_cache_health_log` + função `check_prerender_cache_health()` + cron diário 03:00 BRT.

### Frente 4 — Skeleton no first byte ✅ (Rodada 1)
`index.html` enriquecido com **3 layouts de skeleton** selecionados por rota antes do React montar:
- `/checkout` → form + summary + step timeline
- `/cart` ou `/carrinho` → lista de itens + resumo
- demais → grid de produtos genérico

### Frente A (v2.0.0) — Worker robusto ✅ (Rodada 1)
Novo `docs/cloudflare-worker-template.js` (a ser redeployado pelo usuário no Cloudflare):
1. **Phase 4 é o caminho padrão** — qualquer GET de rota pública vai para `storefront-html`, sem depender de `Accept: text/html`. Bots e prefetches incluídos.
2. **`ctx.waitUntil` em toda escrita de cache** — corrige o cache 0% HIT.
3. **Cache edge para `/assets/*`** — TTL 30 dias, imutável (Vite emite arquivos com hash).
4. **Micro-cache de 60s para `storefront-bootstrap`** — absorve picos de chamadas idênticas.
5. **Endpoint `/_debug`** agora reporta `cache.usesWaitUntil` para diagnóstico rápido.

### Frente C — Eliminar redirect apex → www ⏳ (instrução manual no Cloudflare)
**Ação no usuário:** no painel Cloudflare → Rules → Redirect Rules, garantir que NÃO há regra forçando redirect apex (`comandocentral.com.br`) → `www.` (ou vice-versa). O Worker já normaliza ambos. Cada redirect 301 adiciona ~50-100ms ao TTFB.

### Frente 5 / Frente D — Refator do `CheckoutStepWizard.tsx` ✅ (Rodada 2)
Decomposto em 7 arquivos sob `src/components/storefront/checkout/wizard/` (`types`, `ProgressTimeline`, `Step1PersonalData`, `Step2Address`, `Step3Shipping`, `Step4Payment`, `OrderSummarySidebar`). Step3 e Step4 carregados via `React.lazy` + prefetch ao entrar no step anterior. Resultado: chunk principal `CheckoutStepWizard` caiu de 76,78 KB → 68,78 KB; Step3 isolado em 3 KB, Step4 em 7 KB (só baixados se o usuário avançar). Sem mudança de UI ou contrato público.

## Validação técnica executada

| Validação | Critério | Resultado |
|---|---|---|
| `storefront-bootstrap` retorna produtos | Sem erro silencioso | ✅ 33 produtos, 668ms |
| `storefront-html` com cache | <1s, header `x-render-mode: prerendered` | ✅ 650ms, 185KB |
| Cache regenerado | <20% stale | ✅ 3,4% stale médio |
| Cron de saúde funcionando | Rodou e gravou histórico | ✅ 2 tenants checked |
| Skeleton específico por rota no first byte | HTML diferenciando /cart, /checkout, default | ✅ index.html v2.0.0 |
| Worker template v2.0.0 | Phase 4 padrão + waitUntil + assets/bootstrap cache | ✅ template entregue |
| Worker v2.0.0 deployado em produção | `/_debug` reportando `strategy: edge_rendered_html_first_v2` + `usesWaitUntil: true` | ✅ confirmado em www.respeiteohomem.com.br |
| HTML pré-renderizado entregue na home | >100KB + header `x-render-mode: prerendered` | ✅ 186KB, TTFB 728ms (1ª) / 98ms (2ª, cache HIT do Worker) |
| Cache edge do Worker aquecendo | `x-cc-cache: MISS` → `HIT` na 2ª visita | ✅ corrigido (`ctx.waitUntil` funcional) |
| Skeleton no /checkout no first byte | HTML <15KB com classes `cc-skeleton` | ✅ 10,5KB com 3 layouts de skeleton |
| Refator do CheckoutStepWizard sem regressão | TypeScript sem erros + chunks lazy gerados | ✅ Step3 (3KB) e Step4 (7KB) carregando sob demanda |

## Resultado consolidado em produção (medido em 18/04/2026)

| Métrica | Antes | Depois | Ganho |
|---|---|---|---|
| HTML servido no first byte (home) | 951 bytes (shell vazio) | 186.325 bytes (HTML real) | **+19.500%** de conteúdo útil |
| TTFB home (cache HIT do Worker) | 4-6s (geração ao vivo) | 98ms | **~50x mais rápido** |
| TTFB home (cache MISS) | 4-6s | 728ms | **~7x mais rápido** |
| HTML do /checkout no first byte | tela branca + 951b shell | 10,5KB com skeleton estrutural | sem flash branco |
| Bundle inicial do checkout | 76,78 KB monolítico | 68,78 KB + 2 chunks lazy (3+7KB) | **-10% no critical path** |
| `cf-cache-status` em rotas públicas | DYNAMIC em 100% | DYNAMIC (Cloudflare), mas `x-cc-cache: HIT` no Worker | cache do Worker funcional |

**Observação sobre `cf-cache-status: DYNAMIC`:** o cache do *Cloudflare* permanece DYNAMIC porque o Worker intercepta toda requisição. O cache que importa é o `x-cc-cache` (Cache API do Worker), que está aquecendo corretamente (`MISS` → `HIT`).

**O que ainda depende de validação do usuário (testes funcionais):**
1. Validar fluxo real de compra em uma loja (carrinho → 4 steps → finalizar pedido) confirmando que pagamento aprovado, pixel disparado e pedido criado normalmente.
2. (Opcional) Verificar a regra de redirect apex→www no Cloudflare (Frente C). Já vimos que `respeiteohomem.com.br` faz 301 para `www.` em 273ms — se eliminar esse redirect, ganham mais ~250ms na primeira visita.

## Lições aprendidas

1. **Bypass silencioso de pré-renderização é invisível sem instrumentação** — só descobrimos olhando bytes da resposta.
2. **Cache obsoleto degrada silenciosamente** — sem cron de saúde, ninguém percebe.
3. **Workers externos exigem disciplina de deploy explícito** — código no Lovable é só template.
4. **Bugs de schema podem ficar mascarados em queries com fallback** — bootstrap retornava `success:true` com produtos vazios.
5. **Cache edge sem `ctx.waitUntil` é abortado silenciosamente** — sintoma é `cf-cache-status: DYNAMIC` em 100% das requisições, mesmo com `caches.default.put` "bem-sucedido". Promovido a §33 Padrão 7.
6. **Worker condicional ao header `Accept` é frágil** — bots, prefetches e clientes que omitem `Accept` recebem shell SPA vazio. Caminho rápido deve ser sempre o padrão. Promovido a §34 Princípio 5.
