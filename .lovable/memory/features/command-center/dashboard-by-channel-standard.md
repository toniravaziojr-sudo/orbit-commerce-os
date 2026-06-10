---
name: dashboard-by-channel-standard
description: Sub-abas do Dashboard (Geral, Loja Virtual, ML, Shopee, TikTok), critério de visibilidade por conexão ativa, selo de fonte em cada card e separação Loja x Marketplaces
type: feature
---

# Dashboard por Canal — Padrão (v2026-06-09)

## Regras invioláveis

1. **Sub-abas obrigatórias do Dashboard da Central de Comando:**
   - `Geral` (sempre visível): receita = loja + todos marketplaces; investimento = Meta + Google + TikTok Ads.
   - `Loja Virtual` (sempre visível): só `sales_channel = 'storefront'`.
   - `Mercado Livre`, `Shopee`, `TikTok Shop`: **só aparecem quando `marketplace_connections.is_active = true`** para o respectivo `marketplace`. Não exige pedido sincronizado.

2. **Fonte única de filtro por canal:** `src/lib/dashboard/channelFilter.ts` (`applyChannelFilter`, `channelIncludesAds`, `channelLabel`). Reusado em `useDashboardMetrics` e nos hooks de `useReports` (product/payment/state/city). Proibido replicar a lógica em outros lugares.

3. **Critério de "marketplace ativo":** hook `useActiveMarketplaces` lê `marketplace_connections` por tenant. Único critério aceito.

4. **Investimento em anúncios:**
   - Abas `Geral` e `Loja Virtual`: somam `meta_ad_insights + google_ad_insights + tiktok_ad_insights` (`channelIncludesAds = true`).
   - Abas de marketplace: card mostra **"Em breve"** com selo `Fonte: Em breve`. Proibido somar Ads de plataforma na aba de marketplace (não é a mesma origem).
   - Pendência declarada: coleta de Ads internos do ML, Shopee e TikTok Shop Ads. Quando existir, atualizar `channelIncludesAds` e o doc.

5. **Selo de fonte por card:** quando o Dashboard está em modo sub-abas (`showSourceBadges = true`), cards de Faturamento, Investimento e ROI exibem `Fonte: Caixa real`, `Fonte: Meta + Google + TikTok Ads` ou `Fonte: Em breve`. Elimina a confusão histórica entre "Receita" do Dashboard (caixa real) e "Receita" do Gestor de Tráfego (atribuída pelo pixel).

6. **"Venda realizada" continua sendo:** `status IN ('paid','processing','ready_to_invoice','shipped','delivered')` AND `payment_gateway_id IS NOT NULL` (Ghost Order Rule). Vale para todas as sub-abas. Definido em `docs/especificacoes/sistema/relatorios.md`.

7. **Sub-abas de marketplace exibem botão "Ver detalhes no <marketplace>"** que leva para `/marketplaces/{nome}`. Nunca duplicar a gestão (anúncios, listings, sync) que já existe lá.
8. **Gestor de Tráfego (`/ads`) — escopo declarado:** considera **exclusivamente mídia paga** (Meta + Google + TikTok Ads). Receita geral da loja virtual, marketplaces e canais orgânicos **não** entram. A aba Overview exibe lado a lado **"Receita Atribuída (Ads)"** (pixels) e **"Receita Real de Ads (pagos)"** (pedidos efetivados × atribuição last-click por `fbclid`/`gclid`/`ttclid` ou `utm_medium` paid em `order_attribution`), com **ROAS Atribuído** e **ROAS Real (Ads)** separados. Proibido reintroduzir card de "Receita Real Loja Virtual" — receita geral da loja é exclusiva do Dashboard.
9. **Alerta de cobertura de rastreio (Gestor de Tráfego):** quando houver investimento no período e a cobertura `pedidos_pagos_com_atribuicao_ads / total_pedidos_pagos < 50%`, o Overview DEVE exibir card de aviso amarelo explicando que ROAS Real está subestimado por perda de `fbclid`/`gclid`/`ttclid` e instruindo o lojista a forçar UTM (`utm_source`, `utm_medium=cpc`, `utm_campaign`) em todas as campanhas. ROAS Atribuído ≠ ROAS Real **não é bug** — é janela da plataforma (até 7d clique + 1d view-through) vs caixa auditável. Proibido "corrigir" igualando os dois.

## Documento oficial
- `docs/especificacoes/sistema/central-comando.md` §1.0 (estrutura, visibilidade, fonte de cada métrica)
- `docs/especificacoes/marketing/gestor-trafego.md` (escopo + tabela de fontes de receita)
- `docs/especificacoes/transversais/mapa-ui.md` (sub-abas da Central de Comando)

