

# TikTok — Ecossistema de Integrações (Documentação + Implementação)

## Objetivo

Criar a especificação Layer 3 completa (`docs/especificacoes/marketing/tiktok-integracoes.md`) seguindo o mesmo modelo do Google (`google-integracoes.md`), e depois implementar os gaps identificados — tudo fase a fase.

---

## Estado Atual (Inventário)

### Já Implementado

| Área | O que existe | Edge Functions | Tabelas |
|------|-------------|----------------|---------|
| **Ads** | Conexão OAuth, campanhas, insights, Pixel/CAPI | `tiktok-oauth-start`, `tiktok-oauth-callback`, `tiktok-ads-campaigns`, `tiktok-ads-insights`, `tiktok-token-refresh` | `tiktok_ads_connections`, `tiktok_ad_campaigns`, `tiktok_ad_insights`, `tiktok_oauth_states` |
| **Shop** | Conexão OAuth, catálogo, pedidos, fulfillment, devoluções | `tiktok-shop-oauth-start`, `tiktok-shop-oauth-callback`, `tiktok-shop-catalog-sync/status`, `tiktok-shop-orders-sync/detail`, `tiktok-shop-fulfillment`, `tiktok-shop-returns` | `tiktok_shop_connections`, `tiktok_shop_products`, `tiktok_shop_orders`, `tiktok_shop_fulfillments`, `tiktok_shop_returns` |
| **Content** | Conexão OAuth, upload de vídeos, analytics básico | `tiktok-content-oauth-start/callback`, `tiktok-content-publish`, `tiktok-content-analytics` | `tiktok_content_connections`, `tiktok_content_videos`, `tiktok_content_analytics` |
| **Hub UI** | `TikTokUnifiedSettings.tsx` com 3 cards (Ads, Shop, Content) + painéis operacionais | — | — |

### Gaps Identificados

| Área | Gap | Prioridade |
|------|-----|-----------|
| **Ads** | CRUD de Ad Groups e Ads individuais | Alta |
| **Ads** | Gestão de Públicos (Audiences) | Alta |
| **Ads** | Upload de Creative Assets | Média |
| **Content** | Estatísticas do perfil (`user.info.stats`) | Média |
| **Content** | Agendamento de posts | Média |
| **Shop** | Webhooks de pedidos em tempo real | Baixa |
| **Shop** | Sincronização bidirecional de estoque | Baixa |
| **Infra** | Cron de refresh automático de tokens (3 conexões) | Alta |

---

## Plano de Execução (8 Fases)

### Fase 1 — Documentação Layer 3

Criar `docs/especificacoes/marketing/tiktok-integracoes.md` com:
- Visão geral e arquitetura (3 APIs separadas, OAuth independente por produto)
- Inventário completo (tabelas, edge functions, hooks, componentes)
- Scope packs por produto (Ads, Shop, Content)
- Fluxos OAuth documentados
- Mapa de gaps e roadmap
- Referência cruzada com `tiktok-shop.md` (marketplaces) e `gestor-trafego.md`

Atualizar `marketing-integracoes.md` com referência ao novo doc dedicado.

### Fase 2 — Token Refresh Automático (Infra)

Criar edge function `tiktok-token-refresh-cron` que:
- Percorre as 3 tabelas de conexão (`tiktok_ads_connections`, `tiktok_shop_connections`, `tiktok_content_connections`)
- Renova tokens próximos da expiração (< 24h)
- Usa a edge function `tiktok-token-refresh` existente como base
- Registrar cron job via `pg_cron` (a cada 6 horas)

### Fase 3 — Ads: Ad Groups & Ads

- Nova edge function `tiktok-ads-adgroups` (listar, criar, editar ad groups)
- Nova edge function `tiktok-ads-ads` (listar, criar, editar anúncios individuais)
- Novas tabelas: `tiktok_ad_groups`, `tiktok_ad_ads`
- Hook `useTikTokAdGroups.ts` e `useTikTokAds.ts` (ou expandir `useTikTokAds.ts`)
- UI: novas sub-tabs no `TikTokAdsPanel`

### Fase 4 — Ads: Audiences

- Nova edge function `tiktok-ads-audiences` (listar, criar, editar públicos customizados)
- Nova tabela: `tiktok_ad_audiences`
- Hook `useTikTokAudiences.ts`
- UI: sub-tab "Públicos" no `TikTokAdsPanel`

### Fase 5 — Ads: Creative Assets

- Nova edge function `tiktok-ads-assets` (upload de imagens/vídeos para biblioteca de criativos)
- Nova tabela: `tiktok_ad_assets`
- Hook e UI para gestão de assets no painel de Ads

### Fase 6 — Content: Perfil + Agendamento

- Expandir `tiktok-content-analytics` para incluir `user.info.stats` e `user.info.profile`
- Nova lógica de agendamento (salvar rascunho com `scheduled_at` e publicar via cron)
- UI: card de perfil no `TikTokContentPanel` e campo de agendamento no fluxo de publicação

### Fase 7 — Shop: Webhooks + Estoque

- Nova edge function `tiktok-shop-webhook` para receber notificações push de pedidos
- Lógica de sincronização bidirecional de estoque (nosso catálogo ↔ TikTok Shop)
- Registrar webhook URL no TikTok Shop Partner Center

### Fase 8 — Validação Final e Documentação

- Atualizar `tiktok-integracoes.md` com status final de cada fase
- Rodar build TypeScript e validar ausência de erros
- Verificar RLS policies em todas as novas tabelas
- Atualizar memória do roadmap TikTok

---

## Detalhes Técnicos

```text
┌──────────────────────────────────────────────────┐
│                Hub TikTok (UI)                   │
│  ┌──────────┐  ┌──────────┐  ┌─────────────┐    │
│  │ Ads Card │  │Shop Card │  │Content Card │    │
│  │ Campaigns│  │ Catálogo │  │  Vídeos     │    │
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

- **Padrão de Edge Functions**: Mesmo do Google — CORS, validação Zod, service_role para cron, JWT para chamadas manuais
- **Tabelas novas**: `tiktok_ad_groups`, `tiktok_ad_ads`, `tiktok_ad_audiences`, `tiktok_ad_assets` (todas com `tenant_id` + RLS)
- **Doc**: ~400-500 linhas, espelhando a estrutura de `google-integracoes.md`

