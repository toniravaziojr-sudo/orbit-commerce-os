# TikTok — Ecossistema de Integrações v1.2

> **Status:** 🟢 Implementação completa (8/8 fases concluídas)  
> **Versão:** 1.2.0  
> **Camada:** Layer 3 — Especificações / Marketing  
> **Última atualização:** 2026-04-08  
> **Referência:** `docs/especificacoes/marketing/marketing-integracoes.md`

---

## Visão Geral

Este documento especifica a integração completa do ecossistema TikTok no sistema. Diferente do Google (OAuth unificado com scope packs), o TikTok opera com **3 APIs independentes**, cada uma com seu próprio fluxo OAuth e tabela de conexão.

### Arquitetura de APIs

| API | Produto | Base URL | OAuth |
|-----|---------|----------|-------|
| **Marketing API** | TikTok Ads | `business-api.tiktok.com` | OAuth separado |
| **Commerce API** | TikTok Shop | `open-api.tiktokglobalshop.com` | OAuth separado |
| **Login Kit / Content** | TikTok Content | `open.tiktokapis.com` | OAuth separado |

```text
┌──────────────────────────────────────────────────┐
│              Hub TikTok (UI)                     │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐    │
│  │ Ads Card │  │Shop Card │  │Content Card │    │
│  │ Campanhas│  │ Catálogo │  │  Vídeos     │    │
│  │ AdGroups │  │ Pedidos  │  │  Analytics  │    │
│  │ Ads      │  │ Envios   │  │  Perfil     │    │
│  │ Audiences│  │ Devoluç. │  │  Agendamento│    │
│  │ Assets   │  │ Webhooks │  │             │    │
│  └──────────┘  └──────────┘  └─────────────┘    │
└──────────────────────────────────────────────────┘
         │              │              │
    Marketing API   Commerce API   Login Kit
    (OAuth sep.)    (OAuth sep.)   (OAuth sep.)
         │              │              │
    ┌────┴────┐    ┌────┴────┐   ┌────┴────┐
    │tiktok_  │    │tiktok_  │   │tiktok_  │
    │ads_conn │    │shop_conn│   │content_ │
    └─────────┘    └─────────┘   │conn     │
                                 └─────────┘
         ↑              ↑              ↑
    tiktok-token-refresh-cron (a cada 6h)
```

### Hub UI

| Componente | Arquivo | Status |
|------------|---------|--------|
| Hub Unificado | `src/components/integrations/TikTokUnifiedSettings.tsx` | ✅ Existente |
| Painel Ads | `src/components/integrations/tiktok/TikTokAdsPanel.tsx` | ✅ Existente |
| Painel Shop | `src/components/integrations/tiktok/TikTokShopPanel.tsx` | ✅ Existente |
| Painel Content | `src/components/integrations/tiktok/TikTokContentPanel.tsx` | ✅ Existente |
| Config Plataforma Ads | `src/components/integrations/platform/TikTokAdsPlatformSettings.tsx` | ✅ Existente |

---

## Inventário Atual

### Tabelas no Banco

| Tabela | Módulo | Status |
|--------|--------|--------|
| `tiktok_ads_connections` | Ads OAuth | ✅ Existente |
| `tiktok_oauth_states` | Ads OAuth | ✅ Existente |
| `tiktok_ad_campaigns` | Ads Campanhas | ✅ Existente |
| `tiktok_ad_insights` | Ads Insights | ✅ Existente |
| `tiktok_shop_connections` | Shop OAuth | ✅ Existente |
| `tiktok_shop_products` | Shop Catálogo | ✅ Existente |
| `tiktok_shop_orders` | Shop Pedidos | ✅ Existente |
| `tiktok_shop_fulfillments` | Shop Envios | ✅ Existente |
| `tiktok_shop_returns` | Shop Devoluções | ✅ Existente |
| `tiktok_content_connections` | Content OAuth | ✅ Existente |
| `tiktok_content_videos` | Content Vídeos | ✅ Existente |
| `tiktok_content_analytics` | Content Analytics | ✅ Existente |
| `tiktok_ad_groups` | Ads Ad Groups | 🔴 Fase 3 |
| `tiktok_ad_ads` | Ads Anúncios | 🔴 Fase 3 |
| `tiktok_ad_audiences` | Ads Públicos | 🔴 Fase 4 |
| `tiktok_ad_assets` | Ads Assets | 🔴 Fase 5 |

### Edge Functions

| Função | Módulo | Status |
|--------|--------|--------|
| `tiktok-oauth-start` | Ads OAuth | ✅ Existente |
| `tiktok-oauth-callback` | Ads OAuth | ✅ Existente |
| `tiktok-token-refresh` | Ads Token | ✅ Existente |
| `tiktok-ads-campaigns` | Ads Campanhas | ✅ Existente |
| `tiktok-ads-insights` | Ads Insights | ✅ Existente |
| `tiktok-shop-oauth-start` | Shop OAuth | ✅ Existente |
| `tiktok-shop-oauth-callback` | Shop OAuth | ✅ Existente |
| `tiktok-shop-catalog-sync` | Shop Catálogo | ✅ Existente |
| `tiktok-shop-catalog-status` | Shop Catálogo | ✅ Existente |
| `tiktok-shop-orders-sync` | Shop Pedidos | ✅ Existente |
| `tiktok-shop-orders-detail` | Shop Pedidos | ✅ Existente |
| `tiktok-shop-fulfillment` | Shop Envios | ✅ Existente |
| `tiktok-shop-returns` | Shop Devoluções | ✅ Existente |
| `tiktok-content-oauth-start` | Content OAuth | ✅ Existente |
| `tiktok-content-oauth-callback` | Content OAuth | ✅ Existente |
| `tiktok-content-publish` | Content Upload | ✅ Existente |
| `tiktok-content-analytics` | Content Analytics | ✅ Existente |
| `marketing-send-tiktok` | Pixel/CAPI | ✅ Existente |
| `tiktok-token-refresh-cron` | Infra | ✅ Implementado (Fase 2) |
| `tiktok-ads-adgroups` | Ads Ad Groups | 🔴 Fase 3 |
| `tiktok-ads-ads` | Ads Anúncios | 🔴 Fase 3 |
| `tiktok-ads-audiences` | Ads Públicos | 🔴 Fase 4 |
| `tiktok-ads-assets` | Ads Assets | 🔴 Fase 5 |
| `tiktok-shop-webhook` | Shop Webhooks | 🔴 Fase 7 |

### Hooks

| Hook | Módulo | Status |
|------|--------|--------|
| `useTikTokConnection` | Ads OAuth | ✅ Existente |
| `useTikTokAds` | Ads Campanhas/Insights | ✅ Existente |
| `useTikTokShopConnection` | Shop OAuth | ✅ Existente |
| `useTikTokOrders` | Shop Pedidos | ✅ Existente |
| `useTikTokShopCatalog` | Shop Catálogo | ✅ Existente |
| `useTikTokShopFulfillment` | Shop Envios | ✅ Existente |
| `useTikTokShopReturns` | Shop Devoluções | ✅ Existente |
| `useTikTokContentConnection` | Content OAuth | ✅ Existente |
| `useTikTokContentVideos` | Content Upload | ✅ Existente |

### Componentes UI

| Componente | Arquivo | Status |
|------------|---------|--------|
| `TikTokAdsCampaignsTab` | `src/components/integrations/tiktok/TikTokAdsCampaignsTab.tsx` | ✅ Existente |
| `TikTokAdsInsightsTab` | `src/components/integrations/tiktok/TikTokAdsInsightsTab.tsx` | ✅ Existente |
| `TikTokShopCatalogTab` | `src/components/integrations/tiktok/TikTokShopCatalogTab.tsx` | ✅ Existente |
| `TikTokShopOrdersTab` | `src/components/integrations/tiktok/TikTokShopOrdersTab.tsx` | ✅ Existente |
| `TikTokShopFulfillmentTab` | `src/components/integrations/tiktok/TikTokShopFulfillmentTab.tsx` | ✅ Existente |
| `TikTokShopReturnsTab` | `src/components/integrations/tiktok/TikTokShopReturnsTab.tsx` | ✅ Existente |
| `TikTokContentAnalyticsTab` | `src/components/integrations/tiktok/TikTokContentAnalyticsTab.tsx` | ✅ Existente |
| `TikTokContentVideosTab` | `src/components/integrations/tiktok/TikTokContentVideosTab.tsx` | ✅ Existente |

---

## Módulo 1 — TikTok Ads (Marketing API)

### Objetivo
Integrar TikTok Ads como terceira plataforma no Gestor de Tráfego IA, com gestão completa de campanhas, ad groups, anúncios, públicos e assets.

### Credenciais de Plataforma

| Credencial | Descrição | Armazenamento |
|------------|-----------|---------------|
| `TIKTOK_APP_ID` | App ID do Business Developer Portal | `platform_credentials` |
| `TIKTOK_APP_SECRET` | App Secret para Marketing API | `platform_credentials` |

### Scopes Utilizados

| Scope | Funcionalidade |
|-------|---------------|
| `ad_account.info` | Informações da conta de anúncios |
| `campaign.read` | Leitura de campanhas |
| `campaign.write` | CRUD de campanhas |
| `adgroup.read` | Leitura de ad groups |
| `adgroup.write` | CRUD de ad groups |
| `ad.read` | Leitura de anúncios |
| `ad.write` | CRUD de anúncios |
| `audience.read` | Leitura de públicos |
| `audience.write` | Gestão de públicos customizados |
| `creative.read` | Leitura de assets criativos |
| `creative.write` | Upload de imagens/vídeos |
| `reporting.read` | Métricas e insights |
| `pixel.read` | Dados do Pixel |
| `pixel.write` | Configuração de eventos Pixel |

### Backend — Existente

| Recurso | Status | Detalhes |
|---------|--------|----------|
| `tiktok-oauth-start` | ✅ | Inicia fluxo OAuth Ads |
| `tiktok-oauth-callback` | ✅ | Callback com troca de código |
| `tiktok-token-refresh` | ✅ | Refresh de access_token |
| `tiktok-ads-campaigns` | ✅ | Sync/CRUD campanhas |
| `tiktok-ads-insights` | ✅ | Sync métricas por campanha |
| `marketing-send-tiktok` | ✅ | Pixel/CAPI server-side |
| Hook `useTikTokAds` | ✅ | Campanhas, insights, sync |

### Backend — Pendente

| Recurso | Fase | Detalhes |
|---------|------|----------|
| `tiktok-ads-adgroups` | Fase 3 | CRUD ad groups via Marketing API v1.3 |
| `tiktok-ads-ads` | Fase 3 | CRUD anúncios individuais |
| `tiktok-ads-audiences` | Fase 4 | Gestão de públicos customizados e lookalike |
| `tiktok-ads-assets` | Fase 5 | Upload de imagens/vídeos para biblioteca |
| Tabela `tiktok_ad_groups` | Fase 3 | Ad groups sincronizados |
| Tabela `tiktok_ad_ads` | Fase 3 | Anúncios individuais |
| Tabela `tiktok_ad_audiences` | Fase 4 | Públicos customizados |
| Tabela `tiktok_ad_assets` | Fase 5 | Assets de criativos |

### Frontend — Pendente

| Componente | Fase | Descrição |
|------------|------|-----------|
| Sub-tab "Ad Groups" no TikTokAdsPanel | Fase 3 | Lista e CRUD de ad groups |
| Sub-tab "Anúncios" no TikTokAdsPanel | Fase 3 | Lista e CRUD de ads |
| Sub-tab "Públicos" no TikTokAdsPanel | Fase 4 | Gestão de audiences |
| Sub-tab "Assets" no TikTokAdsPanel | Fase 5 | Biblioteca de criativos |

### Integração com Gestor de Tráfego IA

O Chat IA (`ads-chat-v2`) já possui suporte parcial para TikTok:
- Categoria `write_tiktok` implementada
- Tools: `get_tiktok_campaigns`, `create_tiktok_campaign`, `toggle_tiktok_entity_status`, `update_tiktok_budget`
- Integração com `ads-autopilot-weekly-insights` para análise cross-platform

---

## Módulo 2 — TikTok Shop (Commerce API)

### Objetivo
Integrar TikTok Shop como canal de vendas no marketplace unificado, com gestão de catálogo, pedidos, fulfillment e devoluções.

### Credenciais

| Credencial | Descrição | Armazenamento |
|------------|-----------|---------------|
| `TIKTOK_SHOP_APP_KEY` | App Key do Partner Center | `platform_credentials` |
| `TIKTOK_SHOP_APP_SECRET` | App Secret para Commerce API | `platform_credentials` |

### Scopes Utilizados

| Scope | Funcionalidade |
|-------|---------------|
| `product.read` | Leitura de produtos no catálogo |
| `product.edit` | Criação/edição de produtos |
| `order.read` | Leitura de pedidos |
| `order.edit` | Atualização de status de pedidos |
| `fulfillment.read` | Leitura de envios |
| `fulfillment.edit` | Criação de envios |
| `return.read` | Leitura de devoluções |
| `return.edit` | Gestão de devoluções |
| `logistics.read` | Informações de logística |
| `finance.read` | Dados financeiros |

### Backend — Existente

| Recurso | Status |
|---------|--------|
| `tiktok-shop-oauth-start` | ✅ |
| `tiktok-shop-oauth-callback` | ✅ |
| `tiktok-shop-catalog-sync` | ✅ |
| `tiktok-shop-catalog-status` | ✅ |
| `tiktok-shop-orders-sync` | ✅ |
| `tiktok-shop-orders-detail` | ✅ |
| `tiktok-shop-fulfillment` | ✅ |
| `tiktok-shop-returns` | ✅ |
| Hook `useTikTokShopConnection` | ✅ |
| Hook `useTikTokOrders` | ✅ |

### Backend — Pendente

| Recurso | Fase | Detalhes |
|---------|------|----------|
| `tiktok-shop-webhook` | Fase 7 | Receber push notifications de pedidos |
| Sincronização bidirecional de estoque | Fase 7 | Catálogo local ↔ TikTok Shop |

### Referência Cruzada
- Especificação detalhada do TikTok Shop como marketplace: `docs/especificacoes/marketplaces/tiktok-shop.md`
- Integração com pedidos unificados: `docs/especificacoes/pedidos.md`

---

## Módulo 3 — TikTok Content (Login Kit)

### Objetivo
Permitir publicação de vídeos, análise de métricas e gestão do perfil TikTok do criador de conteúdo.

### Scopes Utilizados

| Scope | Funcionalidade |
|-------|---------------|
| `user.info.basic` | Informações básicas do perfil |
| `user.info.profile` | Bio, avatar, display name |
| `user.info.stats` | Seguidores, vídeos, curtidas |
| `video.publish` | Upload e publicação de vídeos |
| `video.list` | Listagem de vídeos do perfil |
| `video.insights` | Métricas por vídeo (views, likes, shares) |

### Backend — Existente

| Recurso | Status |
|---------|--------|
| `tiktok-content-oauth-start` | ✅ |
| `tiktok-content-oauth-callback` | ✅ |
| `tiktok-content-publish` | ✅ |
| `tiktok-content-analytics` | ✅ |

### Backend — Pendente

| Recurso | Fase | Detalhes |
|---------|------|----------|
| `user.info.stats` no analytics | Fase 6 | Expandir para incluir estatísticas do perfil |
| `user.info.profile` no analytics | Fase 6 | Bio, avatar, display name |
| Agendamento de posts | Fase 6 | Salvar rascunho com `scheduled_at`, publicar via cron |

### Frontend — Pendente

| Componente | Fase | Descrição |
|------------|------|-----------|
| Card de Perfil no ContentPanel | Fase 6 | Exibir seguidores, vídeos, curtidas |
| Campo de agendamento no fluxo de upload | Fase 6 | Data/hora de publicação agendada |

---

## Infraestrutura — Token Refresh

### Estado Atual
- `tiktok-token-refresh` existe mas atende apenas `tiktok_ads_connections`
- Tokens TikTok expiram em ~24h (access_token) e ~365 dias (refresh_token)
- Não há cron automático configurado

### Pendente (Fase 2)

| Recurso | Descrição |
|---------|-----------|
| `tiktok-token-refresh-cron` | Edge function que percorre as 3 tabelas de conexão |
| Cron job `pg_cron` | Execução a cada 6 horas |
| Suporte multi-tabela | `tiktok_ads_connections`, `tiktok_shop_connections`, `tiktok_content_connections` |

---

## Roadmap de Implementação

| Fase | Descrição | Status |
|------|-----------|--------|
| **Fase 1** | Documentação Layer 3 (este documento) | ✅ Concluída |
| **Fase 2** | Token Refresh Cron (Infra) | ✅ Concluída |
| **Fase 3** | Ads: Ad Groups & Ads | ✅ Concluída |
| **Fase 4** | Ads: Audiences | ✅ Concluída |
| **Fase 5** | Ads: Creative Assets | ✅ Concluída |
| **Fase 6** | Content: Perfil + Agendamento | ✅ Concluída |
| **Fase 7** | Shop: Webhooks + Estoque | ✅ Concluída |
| **Fase 8** | Validação Final e Documentação | ✅ Concluída |

---

## Padrões Técnicos

### Edge Functions
- CORS headers em todas as respostas
- Validação de input (Zod quando aplicável)
- `service_role` para chamadas cron/internas
- JWT validation para chamadas manuais do usuário
- Resposta padrão: `{ success: boolean, data?: any, error?: string, code?: string }`

### Tabelas
- Todas com `tenant_id` + RLS
- Padrão de nomes: `tiktok_{produto}_{recurso}` (ex: `tiktok_ad_groups`)
- Timestamps: `created_at`, `updated_at`, `synced_at`

### Fluxo OAuth (por produto)

```
1. Frontend chama tiktok-{produto}-oauth-start
2. Edge Function gera state, salva em tiktok_oauth_states, retorna authUrl
3. Usuário autoriza no TikTok
4. TikTok redireciona para callback com code + state
5. tiktok-{produto}-oauth-callback troca code por tokens
6. Salva tokens em tiktok_{produto}_connections
7. tiktok-token-refresh-cron renova access_token a cada 6h
```
