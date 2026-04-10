# TikTok Shop — Regras e Especificações

> **Status:** 🟩 Atualizado  
> **Última atualização:** 2026-02-26

> **Camada:** Layer 3 — Especificações / Marketplaces  
> **Migrado de:** `docs/regras/tiktok-shop.md`  
> **Última atualização:** 2026-04-03


---

## Visão Geral

Integração OAuth com TikTok Shop para sincronização de catálogo, gestão de pedidos, fulfillment e devoluções.

## Arquivos Principais

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/marketplaces/TikTokShop.tsx` | Dashboard com abas (Conexão, Pedidos, Catálogo, Envios, Devoluções) — aba Conexão exibe botão "Ir para Integrações" quando desconectado |
| `src/hooks/useTikTokShopConnection.ts` | Status/OAuth com listener de postMessage |
| `src/hooks/useTikTokOrders.ts` | Pedidos do TikTok Shop |
| `src/hooks/useTikTokCatalog.ts` | Catálogo de produtos sincronizados |
| `src/hooks/useTikTokFulfillment.ts` | Envios e rastreamento |
| `src/hooks/useTikTokReturns.ts` | Devoluções |
| `src/components/integrations/tiktok/TikTokShopPanel.tsx` | Painel operacional com abas (usado no módulo Marketplaces, **não em Integrações**) |
| `src/components/integrations/tiktok/TikTokShopCatalogTab.tsx` | UI da aba Catálogo |
| `src/components/integrations/tiktok/TikTokShopOrdersTab.tsx` | UI da aba Pedidos |
| `src/components/integrations/tiktok/TikTokShopFulfillmentTab.tsx` | UI da aba Envios |
| `src/components/integrations/tiktok/TikTokShopReturnsTab.tsx` | UI da aba Devoluções |
| `supabase/functions/tiktok-shop-oauth-start/` | Início do fluxo OAuth |
| `supabase/functions/tiktok-shop-oauth-callback/` | Callback OAuth |
| `supabase/functions/tiktok-shop-catalog-sync/` | Sincronização de catálogo |
| `supabase/functions/tiktok-shop-catalog-status/` | Verificação de status do catálogo |
| `supabase/functions/tiktok-shop-orders-detail/` | Detalhes de pedidos |
| `supabase/functions/tiktok-shop-fulfillment/` | Submissão de fulfillment |

## Fluxo OAuth

```
1. Usuário acessa Integrações → aba TikTok → seção Shop
2. Clica "Conectar TikTok Shop" (inicia OAuth via popup)
3. tiktok-shop-oauth-start → URL de autorização
4. Popup abre para TikTok
5. TikTok redireciona para callback
6. tiktok-shop-oauth-callback → Troca code por tokens e salva no banco
7. Popup envia postMessage({ type: 'tiktok-shop:connected' })
8. Popup fecha automaticamente
9. Janela principal recebe postMessage e invalida queries de status
```

### Regra: Local de Conexão (OBRIGATÓRIO)

> A conexão OAuth com o TikTok Shop **DEVE acontecer em `/integrations` (aba TikTok)**.
> O módulo `/marketplaces/tiktokshop` é exclusivo para **gestão** (pedidos, catálogo, envios, devoluções).
> Se o usuário acessar `/marketplaces/tiktokshop` sem conexão ativa, a aba "Conexão" é exibida com um **botão que direciona para `/integrations?tab=tiktok`** (NÃO redirecionar automaticamente).

### Regra: Desconectar/Reconectar (OBRIGATÓRIO)

> Botões de **Reconectar** e **Desconectar** ficam no Hub TikTok em `/integrations` (aba TikTok).
> - **Reconectar**: Inicia novo fluxo OAuth para renovar tokens
> - **Desconectar**: Remove a conexão

## Rota Frontend

- **Path:** `/marketplaces/tiktokshop`
- **Componente:** `TikTokShop`
- **Registrada em:** `src/App.tsx` com `FeatureGatedRoute` (moduleKey: `marketplaces`, featureKey: `tiktokshop`)

## RBAC

- **Módulo:** `marketplaces`
- **Submodule:** `tiktokshop`
- **Sidebar:** Marketplaces → TikTok Shop
- **Registrado em:** `src/config/rbac-modules.ts`

## Tabelas do Banco

| Tabela | Descrição |
|--------|-----------|
| `tiktok_shop_connections` | Conexões OAuth por tenant (tokens, shop_id, status) |
| `tiktok_shop_orders` | Pedidos sincronizados |
| `tiktok_shop_products` | Produtos sincronizados com TikTok Shop |
| `tiktok_shop_fulfillments` | Envios e rastreamento submetidos |
| `tiktok_shop_returns` | Devoluções |

## Abas do Módulo de Gestão

| Aba | Valor | Componente | Descrição |
|-----|-------|------------|-----------|
| Conexão | `conexao` | (inline) | Botão para /integrations?tab=tiktok (só quando desconectado) |
| Pedidos | `pedidos` | `TikTokShopOrdersTab` | Lista de pedidos com sync |
| Catálogo | `catalogo` | `TikTokShopCatalogTab` | Produtos sincronizados com ações |
| Envios | `envios` | `TikTokShopFulfillmentTab` | Fulfillment e rastreamento |
| Devoluções | `devolucoes` | `TikTokShopReturnsTab` | Gestão de devoluções |

## Scope Packs OAuth

| Pack | Escopos | Descrição |
|------|---------|-----------|
| `catalog` | product.read, product.write | Leitura e escrita de produtos |
| `orders` | order.read, order.write | Leitura e escrita de pedidos |

## Status da Conexão

| Status | Descrição |
|--------|-----------|
| `connected` | Conectado e ativo |
| `error` | Erro na conexão |
| `disconnected` | Desconectado |

> Token expirado (`isExpired`) é detectado automaticamente comparando `token_expires_at` com a data atual.

## Card no Hub de Integrações (OBRIGATÓRIO)

O TikTok Shop **DEVE** ter um card visível na aba **Marketplaces** do Hub de Integrações (`/integrations`).

| Elemento | Descrição |
|----------|-----------|
| **Arquivo** | `src/components/integrations/MarketplacesIntegrationTab.tsx` |
| **Logo** | `TikTokShopLogo` (SVG inline no componente) |
| **Badges** | `Pedidos`, `Catálogo`, `Envios` |
| **Status** | Badge "Conectado" (verde) ou "Não conectado" via `useTikTokShopConnection` |
| **Ação (desconectado)** | Botão "Conectar" → `/integrations?tab=tiktok` |
| **Ação (conectado)** | Botão "Gerenciar" → `/marketplaces/tiktokshop` |

### Regra: Roteamento Dinâmico do Card

> O botão de ação do card **DEVE** mudar conforme o status da conexão:
> - **Desconectado**: redireciona para `/integrations?tab=tiktok` (configuração OAuth)
> - **Conectado**: redireciona para `/marketplaces/tiktokshop` (dashboard de gestão)

## Module Status

- **Rota registrada em:** `src/config/module-status.ts`
- **Valor:** `'/marketplaces/tiktokshop': 'pending'`

## Integração com Atendimento (Suporte)

O TikTok Shop é registrado como canal de atendimento no sistema de suporte.

| Arquivo | Mudança |
|---------|---------|
| `src/hooks/useConversations.ts` | `SupportChannelType` inclui `'tiktokshop'` |
| `src/components/support/ConversationList.tsx` | Ícone: `🎵` |
| `src/components/support/ChannelIntegrations.tsx` | Card com `integrationPath: '/integrations?tab=tiktok'` |
| `src/components/support/ChannelConfigDialog.tsx` | Docs do canal TikTok Shop |
| `src/components/support/AIChannelConfigDialog.tsx` | Restrições IA para TikTok Shop |

### Restrições IA do Canal (OBRIGATÓRIO)

> - Não enviar links externos
> - Não mencionar outras plataformas de venda
> - Não solicitar contato fora da plataforma

## Integração com Pedidos Principais

Pedidos sincronizados do TikTok Shop são **espelhados na tabela `orders`** para aparecerem no módulo de Pedidos e permitir emissão de NF.

| Campo | Valor |
|-------|-------|
| `source_platform` | `tiktokshop` |
| `marketplace_source` | `tiktokshop` |
| `source_hash` | `tiktokshop:{tenantId}:{tiktokOrderId}` |
| `marketplace_order_id` | ID do pedido no TikTok |
| `marketplace_data` | JSON com `tiktokOrderId`, `tiktokStatus`, `items` |

### Mapeamento de Status (TikTok → Orders)

| TikTok Status | `status` | `payment_status` | `shipping_status` |
|---------------|----------|-------------------|--------------------|
| UNPAID | awaiting_payment | pending | pending |
| AWAITING_SHIPMENT | processing | paid | pending |
| IN_TRANSIT | in_transit | paid | in_transit |
| DELIVERED | delivered | paid | delivered |
| CANCELLED | cancelled | refunded | cancelled |

### Regra: OrderSourceBadge

> O `OrderSourceBadge` reconhece `tiktokshop` (cor rosa/pink).
> O filtro de origem (`MARKETPLACE_OPTIONS`) inclui `{ value: 'tiktokshop', label: 'TikTok Shop' }`.

### Edge Function

- **Arquivo:** `supabase/functions/tiktok-shop-orders-sync/index.ts` (v2.0.0)
- **Comportamento:** Ao sincronizar, cria/atualiza tanto `tiktok_shop_orders` quanto `orders` + `order_items`
- **Deduplicação:** Via `source_hash` na tabela `orders`
