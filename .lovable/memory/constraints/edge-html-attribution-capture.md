---
name: Edge HTML Attribution Capture
description: First-touch attribution must be captured by Edge HTML on storefront pages, NOT by React on /checkout — otherwise UTMs/click IDs/landing_page are lost
type: constraint
---

## Regra
A captura de atribuição de primeiro toque (first-touch) é responsabilidade do **Edge HTML** (`supabase/functions/storefront-html/index.ts`), não do React.

O storefront público renderiza home, categoria, produto e carrinho como HTML server-side **sem React**. O hook `useAttribution` só roda quando a SPA inicializa em `/checkout`. Se a captura ficar no React, o `landing_page` vira sempre `/checkout`, o `referrer` vira o próprio domínio, e UTMs/click IDs do anúncio (gclid, fbclid, ttclid, msclkid) nunca são gravados em `order_attribution`.

## Contrato obrigatório
1. **Edge HTML injeta script inline** em toda página pública (home/produto/categoria/etc.) que:
   - Lê `utm_*`, `gclid`, `fbclid`, `ttclid`, `msclkid` da URL.
   - Lê `document.referrer` (descarta se for o próprio domínio).
   - Grava `localStorage.attribution_data` com `landing_page = primeira página real`, `session_id`, `first_touch_at`, `attribution_source`, `attribution_medium`.
   - Mantém o registro existente quando não há novo click ID nem UTM (modelo first-touch).
   - Pula execução em rotas `checkout|carrinho|cart|obrigado|conta|minha-conta`.
   - Cookie fallback `_sf_attr` (90d).

2. **React `useAttribution`** apenas:
   - Lê o que o Edge HTML gravou.
   - Atualiza somente se a URL atual trouxer novo click ID ou UTM.
   - **Nunca** sobrescreve com `landing_page=/checkout` ou referrer same-domain.
   - Se chegar em rota checkout-like sem dados prévios, NÃO grava — o Edge HTML não rodou (acesso direto ao checkout) e poluir o first-touch é pior que ficar `direct/none`.

3. **Função de derivação** (`source/medium`) deve ficar idêntica nos dois lados (Edge inline JS + `deriveAttribution` do React).

## Sintoma de regressão
Pedidos com `attribution_source = unknown`, `landing_page = /checkout`, `referrer_domain = <próprio domínio>` e todos os click IDs/UTMs vazios — apesar do tráfego vir comprovadamente de Google Ads/Meta Ads.

## Como validar
Após qualquer mudança em `storefront-html/index.ts` ou em `useAttribution.ts`:
- Abrir loja com `?utm_source=google&utm_medium=cpc&gclid=TEST123`.
- Navegar até checkout e fechar pedido.
- Verificar `order_attribution` do pedido: `utm_source=google`, `gclid=TEST123`, `landing_page` apontando para a primeira página visitada (não `/checkout`), `attribution_source=google_ads`.

## Arquivos-âncora
- `supabase/functions/storefront-html/index.ts` — bloco "FIRST-TOUCH ATTRIBUTION CAPTURE (Edge HTML)" dentro de `generateMarketingPixelScripts`.
- `src/hooks/useAttribution.ts` — `captureAttribution`.
- `supabase/functions/checkout-create-order/index.ts` — leitura do payload de atribuição → `order_attribution`.
