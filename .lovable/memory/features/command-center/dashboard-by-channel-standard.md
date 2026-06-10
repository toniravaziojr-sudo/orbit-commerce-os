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
8. **Gestor de Tráfego (`/ads`) — escopo declarado:** considera apenas Meta + Google + TikTok Ads + Loja Virtual. Marketplaces nunca entram. A aba Overview exibe lado a lado **"Receita atribuída (Ads)"** (pixels) e **"Receita Real Loja Virtual"** (caixa real, mesma fonte do Dashboard canal `storefront`) — proibido voltar a usar o rótulo genérico "Receita".

## Documento oficial
- `docs/especificacoes/sistema/central-comando.md` §1.0 (estrutura, visibilidade, fonte de cada métrica)
- `docs/especificacoes/marketing/gestor-trafego.md` (escopo + tabela de fontes de receita)
- `docs/especificacoes/transversais/mapa-ui.md` (sub-abas da Central de Comando)

