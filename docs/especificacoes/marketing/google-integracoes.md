# Google — Ecossistema de Integrações v1.0

> **Status:** 🟧 Em Implementação  
> **Versão:** 1.0.0  
> **Camada:** Layer 3 — Especificações / Marketing  
> **Última atualização:** 2026-04-07  
> **Referência:** `docs/especificacoes/marketing/marketing-integracoes.md`

---

## Visão Geral

Este documento especifica a integração completa do ecossistema Google no sistema. Todos os módulos compartilham o **OAuth unificado** via `GoogleUnifiedSettings` com **scope packs** por serviço.

### Autenticação Centralizada

| Componente | Arquivo |
|------------|---------|
| Hub OAuth | `src/components/integrations/GoogleUnifiedSettings.tsx` |
| Edge Function OAuth Start | `supabase/functions/google-oauth-start/index.ts` |
| Edge Function OAuth Callback | `supabase/functions/google-oauth-callback/index.ts` |
| Token Refresh | `supabase/functions/google-token-refresh/index.ts` |
| Hook de Conexão | `src/hooks/useGoogleConnection.ts` |
| Tabela de Conexões | `google_connections` |
| Tabela de Estados OAuth | `google_oauth_states` |

### Scope Packs por Serviço

| Serviço | Scope Pack | Scopes Principais |
|---------|------------|-------------------|
| Analytics GA4 | `analytics` | `analytics.readonly` |
| Google Ads | `ads` | `adwords` |
| Merchant Center | `merchant` | `content` (Merchant API) |
| Business Profile | `business` | `business.manage` |
| Search Console | `search_console` | `webmasters.readonly` |
| Tag Manager | `tag_manager` | `tagmanager.readonly`, `tagmanager.edit.containers` |
| Gmail | `gmail` | `gmail.readonly`, `gmail.send`, `gmail.modify` |
| Calendar | `calendar` | `calendar.events`, `calendar.readonly` |

---

## Inventário Atual (Pré-existente)

### Tabelas no Banco

| Tabela | Módulo | Status |
|--------|--------|--------|
| `google_connections` | OAuth Central | ✅ Existente |
| `google_oauth_states` | OAuth Central | ✅ Existente |
| `google_analytics_reports` | GA4 | ✅ Existente |
| `google_ad_campaigns` | Ads | ✅ Existente |
| `google_ad_groups` | Ads | ✅ Existente |
| `google_ad_ads` | Ads | ✅ Existente |
| `google_ad_keywords` | Ads | ✅ Existente |
| `google_ad_audiences` | Ads | ✅ Existente |
| `google_ad_insights` | Ads | ✅ Existente |
| `google_ad_assets` | Ads | ✅ Existente |
| `google_merchant_products` | Merchant | ✅ Existente |
| `google_business_reviews` | GMB | ✅ Existente |
| `google_business_posts` | GMB | ✅ Existente |
| `google_search_console_data` | Search Console | ✅ Existente |
| `google_tag_manager_containers` | GTM | ✅ Existente |

### Edge Functions

| Função | Módulo | Status |
|--------|--------|--------|
| `google-oauth-start` | OAuth | ✅ Existente |
| `google-oauth-callback` | OAuth | ✅ Existente |
| `google-token-refresh` | OAuth | ✅ Existente |
| `google-analytics-report` | GA4 | ✅ Existente |
| `google-ads-campaigns` | Ads | ✅ Existente |
| `google-ads-adgroups` | Ads | ✅ Existente |
| `google-ads-ads` | Ads | ✅ Existente |
| `google-ads-keywords` | Ads | ✅ Existente |
| `google-ads-audiences` | Ads | ✅ Existente |
| `google-ads-insights` | Ads | ✅ Existente |
| `google-ads-assets` | Ads | ✅ Existente |
| `google-merchant-sync` | Merchant | ✅ Existente |
| `google-merchant-status` | Merchant | ✅ Existente |
| `google-business-reviews` | GMB | ✅ Existente |
| `google-business-posts` | GMB | ✅ Existente |
| `google-search-console` | Search Console | ✅ Existente |
| `google-tag-manager` | GTM | ✅ Existente |
| `marketing-send-google` | Conversões | ✅ Existente |

### Hooks

| Hook | Módulo | Status |
|------|--------|--------|
| `useGoogleConnection` | OAuth | ✅ Existente |
| `useGoogleAnalytics` | GA4 | ✅ Existente |
| `useGoogleAds` | Ads | ✅ Existente |
| `useGoogleBusiness` | GMB | ✅ Existente |
| `useGoogleSearchConsole` | Search Console | ✅ Existente |
| `useGoogleTagManager` | GTM | ✅ Existente |

---

## Módulo 1 — Google Analytics GA4

### Objetivo
Alimentar os relatórios do sistema e o módulo de atribuição com dados reais do GA4.

### Navegação

| Localização | Rota | Tipo |
|-------------|------|------|
| Relatórios → aba "Google Analytics" | `/reports` | Aba nova |
| Atribuição de Vendas | `/marketing/atribuicao` | Dados GA4 integrados |

### Backend

| Recurso | Status | Detalhes |
|---------|--------|----------|
| Edge Function `google-analytics-report` | ✅ Existente | Suporta `summary`, `realtime`, `list`, `sync` |
| Hook `useGoogleAnalytics` | ✅ Existente | Summary, realtime, reports, sync |
| Tabela `google_analytics_reports` | ✅ Existente | Relatórios diários por property |

**Pendências Backend:**
- Validar e completar: funis de conversão, receita por canal, dados de e-commerce enhanced
- Adicionar action `funnel` na Edge Function para dados de funil de conversão
- Adicionar action `attribution` para dados de atribuição por canal/source/medium

### Frontend — Componentes

| Componente | Arquivo | Status |
|------------|---------|--------|
| `GA4ReportsTab` | `src/components/reports/GA4ReportsTab.tsx` | 🔴 Criar |
| `GA4SummaryCards` | `src/components/reports/GA4SummaryCards.tsx` | 🔴 Criar |
| `GA4TrendChart` | `src/components/reports/GA4TrendChart.tsx` | 🔴 Criar |
| `GA4AttributionPanel` | `src/components/marketing/GA4AttributionPanel.tsx` | 🔴 Criar |

### Métricas Exibidas

| Card | Métrica GA4 | Ícone |
|------|-------------|-------|
| Sessões | `sessions` | Activity |
| Usuários | `totalUsers` | Users |
| Novos Usuários | `newUsers` | UserPlus |
| Pageviews | `screenPageViews` | Eye |
| Conversões | `conversions` | Target |
| Receita | `purchaseRevenue` | DollarSign |
| Taxa de Rejeição | `bounceRate` | TrendingDown |

### Fluxo de Dados

```
GA4 Property → google-analytics-report (Edge Fn)
  → summary: métricas agregadas 30 dias
  → realtime: usuários ativos agora
  → list: relatórios diários salvos
  → sync: busca dados e salva em google_analytics_reports
  → attribution (NOVO): dados por source/medium/campaign
```

---

## Módulo 2 — Google Ads

### Objetivo
Integrar Google Ads como segunda plataforma no Gestor de Tráfego IA, com paridade de funcionalidades com Meta Ads.

### Navegação

| Localização | Rota | Tipo |
|-------------|------|------|
| Gestor de Tráfego IA → aba "Google Ads" | `/ads` | Aba nova no AdsManager |

### Backend

| Recurso | Status | Detalhes |
|---------|--------|----------|
| `google-ads-campaigns` | ✅ Existente | CRUD de campanhas |
| `google-ads-adgroups` | ✅ Existente | CRUD de grupos |
| `google-ads-ads` | ✅ Existente | CRUD de anúncios |
| `google-ads-keywords` | ✅ Existente | Gestão de keywords |
| `google-ads-audiences` | ✅ Existente | Gestão de públicos |
| `google-ads-insights` | ✅ Existente | Métricas e insights |
| `google-ads-assets` | ✅ Existente | Assets de criativos |
| `google-ads-conversions` | 🔴 Criar | Conversões server-side |
| Hook `useGoogleAds` | ✅ Existente | Campanhas, métricas, CRUD |

**Pendências Backend:**
- Criar Edge Function `google-ads-conversions` para conversões server-side (equivalente do Meta CAPI)
- Implementar cron de refresh de token (tokens Google expiram em 1h)
- Integrar tools do Google Ads no Chat IA do Gestor de Tráfego
- Integrar com Strategist e Guardian para análise dual-platform

### Frontend — Componentes

| Componente | Arquivo | Status |
|------------|---------|--------|
| `GoogleAdsCampaignsTab` | `src/components/ads/google/GoogleAdsCampaignsTab.tsx` | 🔴 Criar |
| `GoogleAdsMetricsCards` | `src/components/ads/google/GoogleAdsMetricsCards.tsx` | 🔴 Criar |
| `GoogleAdsCampaignTable` | `src/components/ads/google/GoogleAdsCampaignTable.tsx` | 🔴 Criar |
| `GoogleAdsCreateCampaign` | `src/components/ads/google/GoogleAdsCreateCampaign.tsx` | 🔴 Criar |

### Conversões Server-Side (Google Ads API)

Equivalente do Meta CAPI. Fluxo:

```
Evento no Storefront (Purchase, AddToCart, etc.)
  → marketing-send-google (Edge Fn existente)
  → Google Ads Conversion API (Enhanced Conversions)
  → Parâmetros: gclid, email, phone, conversion_action, value, currency
```

### Integração com Chat IA

Tools a registrar no Chat do Gestor de Tráfego:

| Tool | Ação |
|------|------|
| `google_list_campaigns` | Listar campanhas ativas |
| `google_campaign_metrics` | Métricas de uma campanha |
| `google_pause_campaign` | Pausar campanha |
| `google_enable_campaign` | Ativar campanha |
| `google_update_budget` | Alterar orçamento |
| `google_list_keywords` | Listar keywords de um grupo |
| `google_add_keywords` | Adicionar keywords |

---

## Módulo 3 — Google Merchant Center

### Objetivo
Sincronizar catálogo de produtos para Google Shopping, similar ao Meta Catalog.

### Navegação

| Localização | Rota | Tipo |
|-------------|------|------|
| Integrações → Google → Catálogo Google Shopping | `/integrations?tab=google` | Seção no Hub Google |

### Backend

| Recurso | Status | Detalhes |
|---------|--------|----------|
| `google-merchant-sync` | ✅ Existente | Sync de produtos |
| `google-merchant-status` | ✅ Existente | Status de aprovação |
| Tabela `google_merchant_products` | ✅ Existente | Produtos sincronizados |

**Pendências Backend:**
- Completar sync incremental (apenas produtos alterados desde último sync)
- Adicionar feed de produtos estruturado (Google Shopping feed format)
- Detalhar status de aprovação por produto (approved, disapproved, pending, expiring)
- Adicionar action `diagnostics` para problemas de qualidade do feed

### Frontend — Componentes

| Componente | Arquivo | Status |
|------------|---------|--------|
| `GoogleMerchantSection` | `src/components/integrations/google/GoogleMerchantSection.tsx` | 🔴 Criar |
| `GoogleMerchantStatusCards` | `src/components/integrations/google/GoogleMerchantStatusCards.tsx` | 🔴 Criar |
| `GoogleMerchantProductTable` | `src/components/integrations/google/GoogleMerchantProductTable.tsx` | 🔴 Criar |

### Cards de Status

| Card | Dados |
|------|-------|
| Total Sincronizados | Contagem de produtos enviados |
| Aprovados | Produtos aceitos no Merchant Center |
| Reprovados | Produtos recusados (com motivo) |
| Pendentes | Aguardando análise |
| Última Sincronização | Timestamp do último sync |

### Fluxo de Dados

```
Catálogo interno (products) 
  → google-merchant-sync (Edge Fn)
  → Merchant API (Content API for Shopping)
  → google_merchant_products (status por produto)
  → google-merchant-status (polling de aprovação)
```

---

## Módulo 4 — Google Meu Negócio (Business Profile)

### Objetivo
Integrar avaliações do Google e canal de mensagens do GMB.

### Navegação

| Localização | Rota | Tipo |
|-------------|------|------|
| Avaliações → aba "Google Meu Negócio" | `/reviews` | Aba nova |
| Atendimento → canal "Google Meu Negócio" | `/support` | Canal no inbox |

### Backend

| Recurso | Status | Detalhes |
|---------|--------|----------|
| `google-business-reviews` | ✅ Existente | Listar, responder avaliações |
| `google-business-posts` | ✅ Existente | Criar, listar posts |
| Hook `useGoogleBusiness` | ✅ Existente | Locations, reviews, posts, reply |
| Tabela `google_business_reviews` | ✅ Existente | Avaliações sincronizadas |
| Tabela `google_business_posts` | ✅ Existente | Posts sincronizados |

**Pendências Backend:**
- Adicionar suporte a mensagens do GMB (Google Business Messages API)
- Criar Edge Function `google-business-messages` para ler/responder mensagens
- Integrar mensagens GMB no inbox unificado do módulo de atendimento

### Frontend — Avaliações

| Componente | Arquivo | Status |
|------------|---------|--------|
| `GoogleReviewsTab` | `src/components/reviews/GoogleReviewsTab.tsx` | 🔴 Criar |
| `GoogleReviewCard` | `src/components/reviews/GoogleReviewCard.tsx` | 🔴 Criar |
| `GoogleReviewReplyDialog` | `src/components/reviews/GoogleReviewReplyDialog.tsx` | 🔴 Criar |

### Frontend — Atendimento

| Componente | Arquivo | Status |
|------------|---------|--------|
| `GmbChannelInbox` | `src/components/support/channels/GmbChannelInbox.tsx` | 🔴 Criar |
| `GmbMessageThread` | `src/components/support/channels/GmbMessageThread.tsx` | 🔴 Criar |

### Dados de Avaliação

| Campo | Origem |
|-------|--------|
| Nome do avaliador | `reviewer.displayName` |
| Nota (estrelas) | `starRating` (ONE a FIVE) |
| Texto da avaliação | `comment` |
| Data | `createTime` |
| Resposta do dono | `reviewReply.comment` |
| Status da resposta | Respondido / Não respondido |

---

## Módulo 5 — Google Search Console

### Objetivo
Dados de SEO acessíveis em Configurações e na Central de Comando.

### Navegação

| Localização | Rota | Tipo |
|-------------|------|------|
| Configurações → card "SEO" | `/settings` | Card com link |
| Central de Comando → aba "SEO" | `/command-center` | Aba nova |

### Backend

| Recurso | Status | Detalhes |
|---------|--------|----------|
| `google-search-console` | ✅ Existente | `summary`, `list`, `sites`, `sync` |
| Hook `useGoogleSearchConsole` | ✅ Existente | Summary, data, sites, sync |
| Tabela `google_search_console_data` | ✅ Existente | Dados de performance |

### Frontend — Componentes

| Componente | Arquivo | Status |
|------------|---------|--------|
| `SearchConsoleSeoCard` | `src/components/settings/SearchConsoleSeoCard.tsx` | 🔴 Criar |
| `SearchConsoleSeoTab` | `src/components/command-center/SearchConsoleSeoTab.tsx` | 🔴 Criar |
| `SearchConsoleQueryTable` | `src/components/command-center/SearchConsoleQueryTable.tsx` | 🔴 Criar |

### Métricas

| Métrica | Descrição |
|---------|-----------|
| Cliques | Total de cliques da busca orgânica |
| Impressões | Vezes que o site apareceu na busca |
| CTR Médio | Taxa de clique média |
| Posição Média | Posição média nos resultados |
| Top Queries | Termos de busca mais frequentes |
| Páginas com Erro | URLs com problemas de indexação |

---

## Módulo 6 — Google Tag Manager

### Objetivo
Permitir injeção de tags via GTM com visibilidade dos scripts ativos.

### Navegação

| Localização | Rota | Tipo |
|-------------|------|------|
| Aplicativos Externos → Google Tag Manager | `/apps-externos` | Card no novo módulo |

### Backend

| Recurso | Status | Detalhes |
|---------|--------|----------|
| `google-tag-manager` | ✅ Existente | Containers, sync, scripts |
| Hook `useGoogleTagManager` | ✅ Existente | Containers, sync, scripts |
| Tabela `google_tag_manager_containers` | ✅ Existente | Containers GTM |

### Frontend — Componentes

| Componente | Arquivo | Status |
|------------|---------|--------|
| `ExternalAppsPage` | `src/pages/ExternalApps.tsx` | 🔴 Criar |
| `GtmAppCard` | `src/components/external-apps/GtmAppCard.tsx` | 🔴 Criar |
| `GtmScriptsList` | `src/components/external-apps/GtmScriptsList.tsx` | 🔴 Criar |

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| Container ID | Exibir Public ID do container ativo |
| Lista de Tags | Tags/scripts injetados (obtidos via API GTM) |
| Toggle Ativação | Ativar/desativar injeção do GTM no storefront |
| Snippet de Instalação | Código head + body para verificação |

### Tabela Nova — `external_apps`

```sql
CREATE TABLE public.external_apps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  app_key TEXT NOT NULL,           -- 'google_tag_manager', 'google_calendar', etc.
  is_enabled BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',       -- Configurações específicas do app
  connected_at TIMESTAMPTZ,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, app_key)
);
```

---

## Módulo 7 — Gmail

### Objetivo
Conectar Gmail do usuário ao inbox de emails do sistema.

### Navegação

| Localização | Rota | Tipo |
|-------------|------|------|
| Emails → canal "Gmail" | `/emails` | Canal novo no inbox |

### Backend

| Recurso | Status | Detalhes |
|---------|--------|----------|
| Edge Function `google-gmail-sync` | 🔴 Criar | Ler/enviar emails via Gmail API |
| Hook `useGmail` | 🔴 Criar | Emails, send, sync |
| Scope pack `gmail` | 🔴 Adicionar | `gmail.readonly`, `gmail.send`, `gmail.modify` |

### Tabela Nova — `google_gmail_accounts`

```sql
CREATE TABLE public.google_gmail_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  connection_id UUID REFERENCES google_connections(id),
  email_address TEXT NOT NULL,
  display_name TEXT,
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMPTZ,
  sync_token TEXT,                 -- Gmail API sync token para sync incremental
  history_id TEXT,                 -- Gmail API history ID
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, email_address)
);
```

### Frontend — Componentes

| Componente | Arquivo | Status |
|------------|---------|--------|
| `GmailChannelInbox` | `src/components/emails/channels/GmailChannelInbox.tsx` | 🔴 Criar |
| `GmailComposeDialog` | `src/components/emails/channels/GmailComposeDialog.tsx` | 🔴 Criar |
| `GmailSettingsCard` | `src/components/emails/GmailSettingsCard.tsx` | 🔴 Criar |

### Fluxo de Dados

```
Gmail do usuário
  → google-gmail-sync (Edge Fn)
  → Ler emails (messages.list, messages.get)
  → Exibir no inbox do sistema
  → Responder → gmail.send → Gmail API
```

---

## Módulo 8 — Google Calendar

### Objetivo
Sincronizar agenda do sistema com Google Calendar.

### Navegação

| Localização | Rota | Tipo |
|-------------|------|------|
| Aplicativos Externos → Google Calendar | `/apps-externos` | Card no módulo |

### Backend

| Recurso | Status | Detalhes |
|---------|--------|----------|
| Edge Function `google-calendar-sync` | 🔴 Criar | Criar/ler eventos no Google Calendar |
| Hook `useGoogleCalendar` | 🔴 Criar | Events, sync, toggle |
| Scope pack `calendar` | 🔴 Adicionar | `calendar.events`, `calendar.readonly` |

### Tabela Nova — `google_calendar_syncs`

```sql
CREATE TABLE public.google_calendar_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  connection_id UUID REFERENCES google_connections(id),
  calendar_id TEXT NOT NULL DEFAULT 'primary',
  is_enabled BOOLEAN DEFAULT false,
  sync_direction TEXT DEFAULT 'push', -- 'push' (sistema→Google), 'pull' (Google→sistema), 'bidirectional'
  last_sync_at TIMESTAMPTZ,
  sync_token TEXT,                    -- Calendar API sync token
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, calendar_id)
);
```

### Frontend — Componentes

| Componente | Arquivo | Status |
|------------|---------|--------|
| `CalendarAppCard` | `src/components/external-apps/CalendarAppCard.tsx` | 🔴 Criar |
| `CalendarSyncSettings` | `src/components/external-apps/CalendarSyncSettings.tsx` | 🔴 Criar |

### Funcionalidades

| Feature | Descrição |
|---------|-----------|
| Toggle Sync | Ativar/desativar sincronização |
| Direção | Push (sistema→Google), Pull, ou bidirecional |
| Eventos Sincronizados | Agendamentos, lembretes da agenda do sistema |
| Status | Conectado/desconectado, último sync |

---

## Novo Módulo — Aplicativos Externos (`/apps-externos`)

### Objetivo
Hub unificado para apps externos que se conectam ao sistema.

### Navegação

| Item | Detalhes |
|------|----------|
| Menu Sidebar | Novo item "Aplicativos Externos" com ícone `Puzzle` |
| Rota | `/apps-externos` |
| Permissão RBAC | `external-apps` (novo módulo de permissão) |

### Apps Incluídos (Fase 1)

| App | Chave | Status |
|-----|-------|--------|
| Google Tag Manager | `google_tag_manager` | ✅ Backend existente |
| Google Calendar | `google_calendar` | 🔴 Criar backend |

### Layout da Página

```
/apps-externos
├── Header: "Aplicativos Externos"
├── Descrição: "Conecte ferramentas externas ao seu sistema"
├── Grid de Cards:
│   ├── Google Tag Manager (ícone GTM, status, toggle)
│   ├── Google Calendar (ícone Calendar, status, toggle)
│   └── [Futuros apps: Zapier, Make, etc.]
└── Cada card expande para configurações detalhadas
```

---

## Dependências Cruzadas

| Módulo | Depende de |
|--------|------------|
| GA4 (Relatórios) | OAuth unificado, `google_connections` |
| GA4 (Atribuição) | Módulo de Atribuição existente |
| Google Ads | OAuth unificado, Gestor de Tráfego IA, Chat IA |
| Merchant Center | OAuth unificado, Catálogo de produtos interno |
| GMB (Avaliações) | OAuth unificado, Módulo Avaliações |
| GMB (Atendimento) | OAuth unificado, Módulo Atendimento (inbox) |
| Search Console | OAuth unificado, Módulo Configurações, Central de Comando |
| GTM | OAuth unificado, Módulo Aplicativos Externos (novo) |
| Gmail | OAuth unificado, Módulo Emails (inbox) |
| Calendar | OAuth unificado, Módulo Agenda, Módulo Aplicativos Externos |

---

## Ordem de Implementação

| Fase | Módulo | Prioridade | Justificativa |
|------|--------|-----------|---------------|
| 2 | Google Analytics GA4 | 🔴 Alta | Alimenta relatórios e atribuição — impacto direto em decisões |
| 3 | Google Ads | 🔴 Alta | Segunda plataforma do Gestor de Tráfego IA |
| 4 | Merchant Center | 🟡 Média | Expansão de canais de venda |
| 5 | Google Meu Negócio | 🟡 Média | Reputação e atendimento local |
| 6 | Search Console | 🟢 Normal | SEO é complementar |
| 7 | GTM + Apps Externos | 🟢 Normal | Flexibilidade para scripts |
| 8 | Gmail | 🟢 Normal | Canal adicional de email |
| 9 | Calendar | 🟢 Normal | Sincronização de agenda |

---

## Secrets Necessários

| Secret | Módulo | Status |
|--------|--------|--------|
| `GOOGLE_CLIENT_ID` | Todos (OAuth) | ✅ Configurado |
| `GOOGLE_CLIENT_SECRET` | Todos (OAuth) | ✅ Configurado |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | Google Ads | ⚠️ Verificar |
| `GOOGLE_ADS_MANAGER_CUSTOMER_ID` | Google Ads (MCC) | ⚠️ Verificar |

---

## Checklist de Validação por Fase

### Para cada módulo implementado:
- [ ] Edge Function responde corretamente (curl test)
- [ ] Dados salvos no banco (query de verificação)
- [ ] Componente de UI renderiza sem erros
- [ ] Console sem erros
- [ ] Fluxo completo funciona (conectar → sync → exibir dados)
- [ ] RLS policies corretas (tenant isolation)
- [ ] Token refresh funciona (sessão longa)
