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
| Hub Unificado | `src/components/integrations/TikTokUnifiedSettings.tsx` | ✅ |
| Painel Ads | `src/components/integrations/tiktok/TikTokAdsPanel.tsx` | ✅ |
| Painel Shop | `src/components/integrations/tiktok/TikTokShopPanel.tsx` | ✅ |
| Painel Content | `src/components/integrations/tiktok/TikTokContentPanel.tsx` | ✅ |
| Config Plataforma Ads | `src/components/integrations/platform/TikTokAdsPlatformSettings.tsx` | ✅ |

---

## Inventário Completo

### Tabelas no Banco (18 tabelas)

| Tabela | Módulo | Status |
|--------|--------|--------|
| `tiktok_ads_connections` | Ads OAuth | ✅ |
| `tiktok_oauth_states` | Ads OAuth | ✅ |
| `tiktok_ad_campaigns` | Ads Campanhas | ✅ |
| `tiktok_ad_insights` | Ads Insights | ✅ |
| `tiktok_ad_groups` | Ads Ad Groups | ✅ |
| `tiktok_ad_ads` | Ads Anúncios | ✅ |
| `tiktok_ad_audiences` | Ads Públicos | ✅ |
| `tiktok_ad_assets` | Ads Assets | ✅ |
| `tiktok_shop_connections` | Shop OAuth | ✅ |
| `tiktok_shop_products` | Shop Catálogo + Estoque | ✅ |
| `tiktok_shop_orders` | Shop Pedidos | ✅ |
| `tiktok_shop_fulfillments` | Shop Envios | ✅ |
| `tiktok_shop_returns` | Shop Devoluções | ✅ |
| `tiktok_shop_webhook_events` | Shop Webhooks | ✅ |
| `tiktok_content_connections` | Content OAuth | ✅ |
| `tiktok_content_videos` | Content Vídeos | ✅ |
| `tiktok_content_analytics` | Content Analytics | ✅ |
| `tiktok_content_scheduled_posts` | Content Agendamento | ✅ |

### Edge Functions (25 funções)

| Função | Módulo | Status |
|--------|--------|--------|
| `tiktok-oauth-start` | Ads OAuth | ✅ |
| `tiktok-oauth-callback` | Ads OAuth | ✅ |
| `tiktok-token-refresh` | Ads Token | ✅ |
| `tiktok-token-refresh-cron` | Infra (Cron 6h) | ✅ |
| `tiktok-ads-campaigns` | Ads Campanhas | ✅ |
| `tiktok-ads-insights` | Ads Insights | ✅ |
| `tiktok-ads-adgroups` | Ads Ad Groups | ✅ |
| `tiktok-ads-ads` | Ads Anúncios | ✅ |
| `tiktok-ads-audiences` | Ads Públicos | ✅ |
| `tiktok-ads-assets` | Ads Assets | ✅ |
| `marketing-send-tiktok` | Pixel/CAPI | ✅ |
| `tiktok-shop-oauth-start` | Shop OAuth | ✅ |
| `tiktok-shop-oauth-callback` | Shop OAuth | ✅ |
| `tiktok-shop-catalog-sync` | Shop Catálogo | ✅ |
| `tiktok-shop-catalog-status` | Shop Catálogo | ✅ |
| `tiktok-shop-orders-sync` | Shop Pedidos | ✅ |
| `tiktok-shop-orders-detail` | Shop Pedidos | ✅ |
| `tiktok-shop-fulfillment` | Shop Envios | ✅ |
| `tiktok-shop-returns` | Shop Devoluções | ✅ |
| `tiktok-shop-webhook` | Shop Webhooks | ✅ |
| `tiktok-shop-stock-sync` | Shop Estoque | ✅ |
| `tiktok-content-oauth-start` | Content OAuth | ✅ |
| `tiktok-content-oauth-callback` | Content OAuth | ✅ |
| `tiktok-content-publish` | Content Upload | ✅ |
| `tiktok-content-analytics` | Content Analytics | ✅ |
| `tiktok-content-profile` | Content Perfil | ✅ |

### Hooks (14 hooks)

| Hook | Módulo | Status |
|------|--------|--------|
| `useTikTokAdsConnection` | Ads OAuth | ✅ |
| `useTikTokAds` | Ads Campanhas/Insights | ✅ |
| `useTikTokAdGroups` | Ads Ad Groups | ✅ |
| `useTikTokAdAssets` | Ads Assets | ✅ |
| `useTikTokAudiences` | Ads Públicos | ✅ |
| `useTikTokShopConnection` | Shop OAuth | ✅ |
| `useTikTokCatalog` | Shop Catálogo | ✅ |
| `useTikTokOrders` | Shop Pedidos | ✅ |
| `useTikTokFulfillment` | Shop Envios | ✅ |
| `useTikTokReturns` | Shop Devoluções | ✅ |
| `useTikTokShopWebhooks` | Shop Webhooks/Estoque | ✅ |
| `useTikTokContentConnection` | Content OAuth | ✅ |
| `useTikTokContent` | Content Vídeos/Analytics | ✅ |
| `useTikTokContentProfile` | Content Perfil/Agendamento | ✅ |

### Componentes UI (18 componentes)

| Componente | Arquivo | Status |
|------------|---------|--------|
| `TikTokAdsPanel` | `tiktok/TikTokAdsPanel.tsx` | ✅ |
| `TikTokAdsCampaignsTab` | `tiktok/TikTokAdsCampaignsTab.tsx` | ✅ |
| `TikTokAdsInsightsTab` | `tiktok/TikTokAdsInsightsTab.tsx` | ✅ |
| `TikTokAdsAdGroupsTab` | `tiktok/TikTokAdsAdGroupsTab.tsx` | ✅ |
| `TikTokAdsAdsTab` | `tiktok/TikTokAdsAdsTab.tsx` | ✅ |
| `TikTokAdsAudiencesTab` | `tiktok/TikTokAdsAudiencesTab.tsx` | ✅ |
| `TikTokAdsAssetsTab` | `tiktok/TikTokAdsAssetsTab.tsx` | ✅ |
| `TikTokShopPanel` | `tiktok/TikTokShopPanel.tsx` | ✅ |
| `TikTokShopCatalogTab` | `tiktok/TikTokShopCatalogTab.tsx` | ✅ |
| `TikTokShopOrdersTab` | `tiktok/TikTokShopOrdersTab.tsx` | ✅ |
| `TikTokShopFulfillmentTab` | `tiktok/TikTokShopFulfillmentTab.tsx` | ✅ |
| `TikTokShopReturnsTab` | `tiktok/TikTokShopReturnsTab.tsx` | ✅ |
| `TikTokShopWebhooksTab` | `tiktok/TikTokShopWebhooksTab.tsx` | ✅ |
| `TikTokContentPanel` | `tiktok/TikTokContentPanel.tsx` | ✅ |
| `TikTokContentVideosTab` | `tiktok/TikTokContentVideosTab.tsx` | ✅ |
| `TikTokContentAnalyticsTab` | `tiktok/TikTokContentAnalyticsTab.tsx` | ✅ |
| `TikTokContentProfileTab` | `tiktok/TikTokContentProfileTab.tsx` | ✅ |
| `TikTokContentScheduleTab` | `tiktok/TikTokContentScheduleTab.tsx` | ✅ |

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

### Backend Completo

| Recurso | Status |
|---------|--------|
| `tiktok-oauth-start` | ✅ Inicia fluxo OAuth Ads |
| `tiktok-oauth-callback` | ✅ Callback com troca de código |
| `tiktok-token-refresh` | ✅ Refresh de access_token |
| `tiktok-ads-campaigns` | ✅ Sync/CRUD campanhas |
| `tiktok-ads-insights` | ✅ Sync métricas por campanha |
| `tiktok-ads-adgroups` | ✅ CRUD ad groups via Marketing API v1.3 |
| `tiktok-ads-ads` | ✅ CRUD anúncios individuais |
| `tiktok-ads-audiences` | ✅ Gestão de públicos customizados e lookalike |
| `tiktok-ads-assets` | ✅ Upload de imagens/vídeos para biblioteca |
| `marketing-send-tiktok` | ✅ Pixel/CAPI server-side |

### Frontend Completo

| Componente | Descrição |
|------------|-----------|
| Sub-tab "Campanhas" | Lista e CRUD de campanhas |
| Sub-tab "Insights" | Métricas por campanha |
| Sub-tab "Ad Groups" | Lista e CRUD de ad groups |
| Sub-tab "Anúncios" | Lista e CRUD de ads |
| Sub-tab "Públicos" | Gestão de audiences |
| Sub-tab "Assets" | Biblioteca de criativos (imagens/vídeos) |

### Integração com Gestor de Tráfego IA

O Chat IA (`ads-chat-v2`) já possui suporte parcial para TikTok:
- Categoria `write_tiktok` implementada
- Tools: `get_tiktok_campaigns`, `create_tiktok_campaign`, `toggle_tiktok_entity_status`, `update_tiktok_budget`
- Integração com `ads-autopilot-weekly-insights` para análise cross-platform

---

## Módulo 2 — TikTok Shop (Commerce API)

### Objetivo
Integrar TikTok Shop como canal de vendas no marketplace unificado, com gestão de catálogo, pedidos, fulfillment, devoluções, webhooks e estoque.

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

### Backend Completo

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
| `tiktok-shop-webhook` | ✅ Push notifications de pedidos/produtos/devoluções |
| `tiktok-shop-stock-sync` | ✅ Sincronização bidirecional de estoque |

### Frontend Completo

| Componente | Descrição |
|------------|-----------|
| Sub-tab "Catálogo" | Gestão de produtos sincronizados |
| Sub-tab "Pedidos" | Lista e sincronização de pedidos |
| Sub-tab "Envios" | Fulfillment e rastreio |
| Sub-tab "Devoluções" | Gestão de devoluções |
| Sub-tab "Webhooks" | Feed de eventos + controle de estoque |

### Referência Cruzada
- Especificação detalhada do TikTok Shop como marketplace: `docs/especificacoes/marketplaces/tiktok-shop.md`
- Integração com pedidos unificados: `docs/especificacoes/pedidos.md`

---

## Módulo 3 — TikTok Content (Login Kit)

### Objetivo
Permitir publicação de vídeos, análise de métricas, gestão do perfil e agendamento de posts.

### Scopes Utilizados

| Scope | Funcionalidade |
|-------|---------------|
| `user.info.basic` | Informações básicas do perfil |
| `user.info.profile` | Bio, avatar, display name |
| `user.info.stats` | Seguidores, vídeos, curtidas |
| `video.publish` | Upload e publicação de vídeos |
| `video.list` | Listagem de vídeos do perfil |
| `video.insights` | Métricas por vídeo (views, likes, shares) |

### Backend Completo

| Recurso | Status |
|---------|--------|
| `tiktok-content-oauth-start` | ✅ |
| `tiktok-content-oauth-callback` | ✅ |
| `tiktok-content-publish` | ✅ |
| `tiktok-content-analytics` | ✅ |
| `tiktok-content-profile` | ✅ Estatísticas e dados do perfil |

### Frontend Completo

| Componente | Descrição |
|------------|-----------|
| Sub-tab "Vídeos" | Lista e gestão de vídeos |
| Sub-tab "Analytics" | Métricas de engajamento |
| Sub-tab "Perfil" | Seguidores, vídeos, curtidas |
| Sub-tab "Agendamento" | Criação e gestão de posts agendados |

---

## Infraestrutura — Token Refresh

### Implementação Concluída

| Recurso | Status | Detalhes |
|---------|--------|----------|
| `tiktok-token-refresh` | ✅ | Refresh unitário de access_token |
| `tiktok-token-refresh-cron` | ✅ | Percorre as 3 tabelas de conexão |
| Cron job `pg_cron` | ✅ | Execução a cada 6 horas |
| Suporte multi-tabela | ✅ | `tiktok_ads_connections`, `tiktok_shop_connections`, `tiktok_content_connections` |

- Tokens TikTok expiram em ~24h (access_token) e ~365 dias (refresh_token)
- Renovação automática de tokens com menos de 24h de validade

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

### Segurança
- RLS ativa em todas as 18 tabelas `tiktok_*`
- Isolamento por `tenant_id` garantido
- Tokens armazenados apenas no banco, nunca expostos ao frontend
- Webhook endpoint valida `shop_id` → `tenant_id` antes de processar
