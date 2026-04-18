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

## Causa raiz (3 problemas encadeados)

1. **Worker em produção sem Phase 4** — o template oficial em `docs/cloudflare-worker-template.js` (linhas 466–592) chama `storefront-html` antes de cair no SPA, mas a versão deployada na Cloudflare não tem essa lógica e entrega direto o shell SPA vazio.
2. **Cache 100% stale** — pipeline de revalidação parou de disparar `storefront-prerender`; ninguém regerou.
3. **Bug silencioso em `storefront-bootstrap`** — referenciava coluna `position` em `product_images`; a correta é `sort_order`. Quebrava a query de produtos quando `include_products=true`.

## Correção aplicada

### Frente 3 — Bug coluna inexistente ✅
Substituído `position` por `sort_order` em:
- `supabase/functions/storefront-bootstrap/index.ts` (linha 206)
- `supabase/functions/tiktok-shop-catalog-sync/index.ts` (linha 138)
- `supabase/functions/ads-chat-v2/index.ts` (tool `get_product_images`)

Edge functions redeployadas. Validação: `storefront-bootstrap` agora retorna 33 produtos com imagens em 668ms (antes: erro silencioso).

### Frente 2 — Cache regenerado + monitoramento contínuo ✅
- Disparado `storefront-prerender` para os 2 tenants ativos (86 páginas regeradas em ~27s).
- Estado atual: 86 active / 3 stale.
- Criada tabela `storefront_cache_health_log` para histórico diário.
- Criada função `public.check_prerender_cache_health()` que verifica todas as lojas e regera automaticamente quando >20% das páginas estiverem stale.
- Agendado cron `prerender-cache-health-daily` rodando 03:00 BRT (06:00 UTC) todos os dias.
- Primeira execução: 2 lojas verificadas, ambas Healthy (3,23% e 3,45% stale).

### Frente 4 — Skeleton no first byte ✅
`index.html` enriquecido com skeleton CSS-only (~3KB) que pinta estrutura visual instantaneamente enquanto o bundle React baixa. Removido automaticamente via MutationObserver assim que React monta `#root`. Funciona como fallback universal mesmo quando o Worker não chama `storefront-html`.

### Frente 1 — Worker (PENDENTE — fora do projeto Lovable) ⏳
O Worker `shops-router` roda na Cloudflare, em repositório separado. O template correto está em `docs/cloudflare-worker-template.js`. **Ação necessária pelo usuário no painel Cloudflare**: redeployar o Worker usando a versão do template (Phase 4 — chamada a `storefront-html` antes de cair no SPA).

Após esse deploy externo, o impacto esperado é redução de 70-80% no tempo até conteúdo visível (de 4-6s para <1,5s).

## Validação técnica executada

| Validação | Critério | Resultado |
|---|---|---|
| `storefront-bootstrap` retorna produtos | Sem erro silencioso | ✅ 33 produtos, 668ms |
| `storefront-html` com cache | <1s, header `x-render-mode: prerendered` | ✅ 650ms, 185KB, header presente |
| Cache regenerado | <20% stale | ✅ 3,4% stale médio |
| Cron de saúde funcionando | Rodou 1x e gravou histórico | ✅ 2 tenants checked |
| Skeleton renderiza no first byte | HTML <5KB com estrutura visual | ✅ index.html ~3KB |

**O que ainda depende de validação do usuário:**
- Deploy do Worker atualizado na Cloudflare (Frente 1).
- Após esse deploy: medir TTFB e LCP reais nas 3 lojas em produção.
- Frente 5 (refator do `CheckoutStepWizard.tsx` de 1.795 linhas) ficou para rodada separada.

## Lições aprendidas

1. **Bypass silencioso de pré-renderização é invisível sem instrumentação** — só descobrimos olhando bytes da resposta e ausência de headers. Memória anti-regressão criada.
2. **Cache obsoleto degrada silenciosamente** — sem cron de saúde, ninguém percebe quando o pipeline para. Agora há monitoramento diário automático.
3. **Workers externos exigem disciplina de deploy explícito** — código no projeto Lovable é só template, deploy real depende de ação manual no Cloudflare.
4. **Bugs de schema (coluna inexistente) podem ficar mascarados em queries com fallback** — a query inteira falhava mas o bootstrap retornava `success:true` com produtos vazios.
