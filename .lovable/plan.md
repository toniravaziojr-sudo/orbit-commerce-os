
# Hub TikTok Centralizado — Plano Revisado

## Problema Identificado (feedback do ChatGPT)

O plano anterior misturava 3 produtos TikTok distintos em uma unica conexao/tabela:
- **TikTok Ads** (Marketing API) — ja existe parcialmente
- **TikTok Shop** (Partner Center / Seller API) — app/credenciais separadas
- **TikTok Content** (Login Kit) — app/credenciais separadas

Cada produto tem OAuth proprio, tokens proprios, escopos proprios e processos de aprovacao independentes. Centralizar tudo em um unico `tiktok_connections` com um unico token geraria confusao de permissoes e estados inconsistentes.

## Arquitetura Revisada

### Modelo: Hub Unico na UI, Multi-Connection no Backend

A UI continua com 1 aba "TikTok" em `/integrations`, mas internamente ha **3 conexoes independentes** por tenant, cada uma com sua tabela dedicada.

```text
/integrations > TikTok
  +----------------------------+
  | TikTok Ads (Marketing API) |  <-- tiktok_ads_connections
  | [Conectado] Pixel/CAPI     |
  +----------------------------+
  | TikTok Shop (Seller API)   |  <-- tiktok_shop_connections
  | [Em breve]                 |
  +----------------------------+
  | TikTok Content (Login Kit) |  <-- tiktok_content_connections
  | [Em breve]                 |
  +----------------------------+
```

### Padrao de Referencia

- **Google**: `google_connections` (1 tabela, 1 conexao) — funciona porque tudo e uma unica conta Google
- **Meta**: `marketplace_connections` com `marketplace = 'meta'` (1 row) — funciona porque tudo e um unico Meta App
- **TikTok**: 3 tabelas separadas — necessario porque sao 3 apps/portais/tokens distintos

---

## Inventario Atual (o que ja existe)

| Componente | Tipo | Onde Salva |
|---|---|---|
| `tiktok-oauth-start` | Edge Function | Gera URL OAuth Marketing API |
| `tiktok-oauth-callback` | Edge Function | Troca token, salva em `marketing_integrations` |
| `marketing-send-tiktok` | Edge Function | Events API (CAPI) server-side, le de `marketing_integrations` |
| `tiktok_oauth_states` | Tabela | Anti-CSRF (ja tem `scope_packs` TEXT[]) |
| `marketing_integrations` | Tabela | 13 colunas `tiktok_*` (token, pixel, advertiser, etc.) |
| `useTikTokConnection` | Hook | Le de `marketing_integrations` |
| `TikTokIntegrationCard` | Componente | Card dentro de Marketing > TikTok tab |
| `TikTokOAuthCallback` | Pagina | Proxy de callback OAuth |

---

## Plano de Implementacao — 12 Fases

### Fase 1 — Hub Base: TikTok Ads Connection

**Objetivo:** Migrar a integracao TikTok Ads existente de `marketing_integrations` para tabela propria, criar UI de Hub em `/integrations`.

**Banco de dados:**

Tabela `tiktok_ads_connections` (UNIQUE por `tenant_id`):
- `id` UUID PK
- `tenant_id` UUID NOT NULL UNIQUE REFERENCES tenants(id)
- `connected_by` UUID REFERENCES auth.users(id)
- `tiktok_user_id` TEXT
- `access_token` TEXT
- `refresh_token` TEXT
- `token_expires_at` TIMESTAMPTZ
- `scope_packs` TEXT[] — packs concedidos (ex: `['pixel', 'ads']`)
- `granted_scopes` TEXT[] — escopos reais retornados pela API
- `is_active` BOOLEAN DEFAULT true
- `connection_status` TEXT DEFAULT 'disconnected' — connected, error, disconnected
- `last_error` TEXT
- `last_sync_at` TIMESTAMPTZ
- `assets` JSONB — `{ advertiser_ids: [...], pixels: [...] }`
- `created_at`, `updated_at` TIMESTAMPTZ
- RLS via `user_has_tenant_access(tenant_id)`

Migration SQL de dados existentes:
- Copiar `marketing_integrations.tiktok_*` para `tiktok_ads_connections` para tenants que ja tem conexao

**Scope Packs (Ads):**

| Pack | Escopos TikTok Marketing API |
|---|---|
| `pixel` | `event.track.create`, `event.track.view` |
| `ads_read` | `advertiser.data.readonly` |
| `ads_manage` | `advertiser.data.manage`, `campaign.manage`, `creative.manage` |
| `reporting` | `report.read` |
| `audience` | `audience.manage` |

**Edge Functions (reescrever):**
- `tiktok-oauth-start` — Aceitar `product: 'ads'` + `scopePacks[]`, mapear para escopos, salvar em `tiktok_oauth_states`
- `tiktok-oauth-callback` — Salvar em `tiktok_ads_connections` + dual-write para `marketing_integrations`
- `tiktok-token-refresh` — Novo, renovar token usando refresh_token

**Frontend:**
- Reescrever `useTikTokConnection` → `useTikTokAdsConnection` (le de `tiktok_ads_connections`)
- Criar `TikTokUnifiedSettings.tsx` com 3 cards: Ads (ativo), Shop (em breve), Content (em breve)
- Adicionar aba "TikTok" em `/integrations` (Integrations.tsx), remover de Marketing
- Card Ads mostra: status, advertiser conectado, packs habilitados, botao conectar/desconectar

**Retrocompatibilidade (dual-write):**
- `tiktok-oauth-callback` escreve em `tiktok_ads_connections` (fonte de verdade) E em `marketing_integrations.tiktok_*`
- `marketing-send-tiktok` passa a ler de `tiktok_ads_connections` com fallback para `marketing_integrations`
- Deadline: remover leitura de `marketing_integrations.tiktok_*` apos 30 dias

---

### Fase 2 — Pixel e CAPI (migracao completa)

- `marketing-send-tiktok` passa a ler 100% de `tiktok_ads_connections`
- Pixel ID armazenado em `tiktok_ads_connections.assets.pixels[]`
- UI: card "Pixel / CAPI" dentro do grid do card Ads no Hub
- Remover colunas tiktok_* de `marketing_integrations` (ou marcar como deprecated)

---

### Fase 3 — TikTok Shop: Tabela Base + OAuth

**Banco de dados:**

Tabela `tiktok_shop_connections` (UNIQUE por `tenant_id`):
- Mesma estrutura base de `tiktok_ads_connections` mas com:
- `shop_id` TEXT — ID da loja no TikTok Shop
- `seller_name` TEXT
- `shop_region` TEXT — regiao da loja
- `assets` JSONB — `{ shop_ids: [...], warehouse_ids: [...] }`

**Edge Functions:**
- `tiktok-shop-oauth-start` — OAuth via TikTok Shop Partner Center (credenciais separadas: `TIKTOK_SHOP_APP_KEY` / `TIKTOK_SHOP_APP_SECRET`)
- `tiktok-shop-oauth-callback` — Salvar em `tiktok_shop_connections`
- `tiktok-shop-token-refresh` — Renovar token Shop

**Scope Packs (Shop):**

| Pack | Escopos TikTok Shop |
|---|---|
| `catalog` | `product.read`, `product.edit` |
| `orders` | `order.read`, `order.edit` |
| `fulfillment` | `fulfillment.read`, `fulfillment.edit` |
| `customer_service` | `customer_service.read`, `customer_service.write` (sensivel) |
| `finance` | `finance.read` (sensivel) |
| `returns` | `return.read`, `return.edit` |

**Secrets necessarios:**
- `TIKTOK_SHOP_APP_KEY`
- `TIKTOK_SHOP_APP_SECRET`

**Frontend:**
- Card "Shop" no Hub muda de "Em breve" para ativo
- `useTikTokShopConnection` hook

---

### Fase 4 — TikTok Shop: Catalogo de Produtos

**Banco:**
- Criar `tiktok_shop_products` (tenant_id, product_id, tiktok_product_id, status, last_synced_at)

**Edge Functions:**
- `tiktok-shop-catalog-sync` — Enviar produtos para TikTok Shop
- `tiktok-shop-catalog-status` — Verificar status de aprovacao

**Frontend:**
- `useTikTokCatalog` hook

---

### Fase 5 — TikTok Shop: Pedidos

**Banco:**
- Criar `tiktok_shop_orders` (tenant_id, tiktok_order_id, status, order_data JSONB, synced_at)

**Edge Functions:**
- `tiktok-shop-orders-sync` — Listar/sincronizar pedidos
- `tiktok-shop-orders-detail` — Detalhe de pedido

**Frontend:**
- `useTikTokOrders` hook

---

### Fase 6 — TikTok Shop: Fulfillment e Logistica

**Edge Functions:**
- `tiktok-shop-fulfillment` — Marcar como enviado, tracking, etiquetas

---

### Fase 7 — TikTok Shop: Devolucoes e Pos-venda

**Banco:**
- Criar `tiktok_shop_returns`

**Edge Functions:**
- `tiktok-shop-returns` — Listar, aprovar/recusar

---

### Fase 8 — TikTok Shop: Atendimento (Inbox Unificado)

**Integracao com modulo de Suporte** (`/support`):
- Registrar conversations com `channel = 'tiktok_shop'`
- Usar tabelas existentes `conversations` + `conversation_messages`

**Edge Functions:**
- `tiktok-shop-chat` — Listar conversas, enviar mensagens
- Webhook TikTok Shop para mensagens inbound

---

### Fase 9 — TikTok Shop: Financeiro

**Banco:**
- Criar `tiktok_shop_settlements`

**Edge Functions:**
- `tiktok-shop-finance` — Listar settlements, saldo, relatorios

---

### Fase 10 — TikTok Ads: Campanhas e Insights

**Banco:**
- Criar `tiktok_ad_campaigns`, `tiktok_ad_insights`, `tiktok_ad_audiences`

**Edge Functions:**
- `tiktok-ads-campaigns` — CRUD campanhas
- `tiktok-ads-insights` — Metricas e relatorios
- `tiktok-ads-audiences` — Publicos custom/lookalike

**Frontend:**
- `useTikTokAds` hook
- Integrar no Gestor de Trafego IA (`/campaigns`)

---

### Fase 11 — TikTok Content: Publicacao Organica

**Banco de dados:**

Tabela `tiktok_content_connections` (UNIQUE por `tenant_id`):
- Mesma estrutura base mas com `tiktok_username`, `profile_image_url`
- `assets` JSONB — `{ creator_id, profile_url }`

**Secrets necessarios:**
- `TIKTOK_CONTENT_CLIENT_KEY`
- `TIKTOK_CONTENT_CLIENT_SECRET`

**Edge Functions:**
- `tiktok-content-oauth-start` / `tiktok-content-oauth-callback` — OAuth via Login Kit
- `tiktok-content-publish` — Upload de video organico
- `tiktok-content-analytics` — Metricas de videos

**Frontend:**
- Card "Content" no Hub muda de "Em breve" para ativo
- Integrar no Gestor de Midias (`/media`)

---

### Fase 12 — Webhooks e Analytics Agregados

**Edge Functions:**
- `tiktok-shop-webhook` — Endpoint unico para eventos TikTok Shop
- `tiktok-analytics` — Agregar metricas de Shop + Ads + Content

---

## Scope Pack Registry

Constante centralizada no backend para rastreio canonico:

```typescript
const TIKTOK_SCOPE_REGISTRY = {
  // Ads (Marketing API)
  ads_pixel:    { product: 'ads', scopes: ['event.track.create', 'event.track.view'], sensitive: false },
  ads_read:     { product: 'ads', scopes: ['advertiser.data.readonly'], sensitive: false },
  ads_manage:   { product: 'ads', scopes: ['advertiser.data.manage', 'campaign.manage'], sensitive: false },
  ads_report:   { product: 'ads', scopes: ['report.read'], sensitive: false },
  ads_audience: { product: 'ads', scopes: ['audience.manage'], sensitive: false },
  
  // Shop (Partner Center)
  shop_catalog:  { product: 'shop', scopes: ['product.read', 'product.edit'], sensitive: false },
  shop_orders:   { product: 'shop', scopes: ['order.read', 'order.edit'], sensitive: false },
  shop_fulfill:  { product: 'shop', scopes: ['fulfillment.read', 'fulfillment.edit'], sensitive: false },
  shop_chat:     { product: 'shop', scopes: ['customer_service.read', 'customer_service.write'], sensitive: true },
  shop_finance:  { product: 'shop', scopes: ['finance.read'], sensitive: true },
  shop_returns:  { product: 'shop', scopes: ['return.read', 'return.edit'], sensitive: false },
  
  // Content (Login Kit)
  content_publish: { product: 'content', scopes: ['video.publish', 'video.list'], sensitive: false },
  content_analytics: { product: 'content', scopes: ['video.insights'], sensitive: false },
};
```

---

## Estrutura de Arquivos (resultado final)

```text
supabase/functions/
  tiktok-oauth-start/           (reescrever - fase 1, product='ads')
  tiktok-oauth-callback/        (reescrever - fase 1, product='ads')
  tiktok-token-refresh/         (novo - fase 1)
  tiktok-shop-oauth-start/      (novo - fase 3)
  tiktok-shop-oauth-callback/   (novo - fase 3)
  tiktok-shop-token-refresh/    (novo - fase 3)
  tiktok-shop-catalog-sync/     (novo - fase 4)
  tiktok-shop-catalog-status/   (novo - fase 4)
  tiktok-shop-orders-sync/      (novo - fase 5)
  tiktok-shop-orders-detail/    (novo - fase 5)
  tiktok-shop-fulfillment/      (novo - fase 6)
  tiktok-shop-returns/          (novo - fase 7)
  tiktok-shop-chat/             (novo - fase 8)
  tiktok-shop-finance/          (novo - fase 9)
  tiktok-ads-campaigns/         (novo - fase 10)
  tiktok-ads-insights/          (novo - fase 10)
  tiktok-ads-audiences/         (novo - fase 10)
  tiktok-content-oauth-start/   (novo - fase 11)
  tiktok-content-oauth-callback/(novo - fase 11)
  tiktok-content-publish/       (novo - fase 11)
  tiktok-content-analytics/     (novo - fase 11)
  tiktok-shop-webhook/          (novo - fase 12)
  tiktok-analytics/             (novo - fase 12)
  marketing-send-tiktok/        (manter, migrar fonte de token)

src/hooks/
  useTikTokAdsConnection.ts     (reescrever - fase 1)
  useTikTokShopConnection.ts    (novo - fase 3)
  useTikTokCatalog.ts           (novo - fase 4)
  useTikTokOrders.ts            (novo - fase 5)
  useTikTokAds.ts               (novo - fase 10)
  useTikTokContentConnection.ts (novo - fase 11)

src/components/integrations/
  TikTokUnifiedSettings.tsx     (novo - fase 1)
  TikTokIntegrationCard.tsx     (deprecar apos fase 2)
```

---

## Tabelas (resultado final)

| Tabela | Fase | Descricao |
|---|---|---|
| `tiktok_ads_connections` | 1 | Conexao Ads (1 por tenant) |
| `tiktok_shop_connections` | 3 | Conexao Shop (1 por tenant) |
| `tiktok_content_connections` | 11 | Conexao Content (1 por tenant) |
| `tiktok_oauth_states` | 1 | Ja existe, adicionar coluna `product` |
| `tiktok_shop_products` | 4 | Catalogo sincronizado |
| `tiktok_shop_orders` | 5 | Pedidos do TikTok Shop |
| `tiktok_shop_returns` | 7 | Devolucoes |
| `tiktok_shop_settlements` | 9 | Financeiro |
| `tiktok_ad_campaigns` | 10 | Campanhas de Ads |
| `tiktok_ad_insights` | 10 | Metricas de Ads |
| `tiktok_ad_audiences` | 10 | Publicos |

---

## Pre-requisitos do Integrador

| Trilha | Portal | Credenciais | Redirect URI |
|---|---|---|---|
| TikTok Ads | TikTok for Business Developer Portal | `TIKTOK_APP_ID` + `TIKTOK_APP_SECRET` (ja existem) | `https://app.comandocentral.com.br/integrations/tiktok/callback` |
| TikTok Shop | TikTok Shop Partner Center | `TIKTOK_SHOP_APP_KEY` + `TIKTOK_SHOP_APP_SECRET` | `https://app.comandocentral.com.br/integrations/tiktok/callback` |
| TikTok Content | TikTok for Developers (Login Kit) | `TIKTOK_CONTENT_CLIENT_KEY` + `TIKTOK_CONTENT_CLIENT_SECRET` | `https://app.comandocentral.com.br/integrations/tiktok/callback` |

---

## Estrategia de Migracao (Fase 1)

1. Criar `tiktok_ads_connections` com migration SQL
2. Migration que copia dados de `marketing_integrations.tiktok_*` para `tiktok_ads_connections`
3. Reescrever `tiktok-oauth-callback` para salvar em `tiktok_ads_connections` + dual-write em `marketing_integrations`
4. `marketing-send-tiktok` le de `tiktok_ads_connections` com fallback para `marketing_integrations`
5. Apos 30 dias: remover fallback e colunas legadas

---

## Diferenca vs Plano Anterior

| Aspecto | Plano Anterior | Plano Revisado |
|---|---|---|
| Tabela de conexao | 1 unica `tiktok_connections` | 3 separadas por produto |
| Token | 1 token para tudo | 1 token por produto |
| OAuth | 1 fluxo | 3 fluxos independentes |
| Scope packs | Misturados | Separados por produto |
| Asset discovery | Tudo no callback | Separado por produto |
| UI | 1 card | 3 cards dentro do Hub |
| Credenciais | 1 par app_id/secret | 3 pares (1 por produto) |
