

# Plano de Implementação Total — Ecossistema Google v1.0

## Visão Geral da Navegação

```text
┌─────────────────────────────────────────────────────────────┐
│ INTEGRAÇÃO ATUAL (onde ficam)                                │
│                                                             │
│ /integrations?tab=google  ← Hub de conexão OAuth unificado │
│   (GoogleUnifiedSettings — já existe com scope packs)       │
│                                                             │
│ ONDE CADA MÓDULO APARECE NO SISTEMA:                        │
│                                                             │
│ 1. Google Analytics GA4                                     │
│    ├─ /reports (aba "Google Analytics")                     │
│    └─ /marketing/atribuicao (dados GA4 no painel)           │
│                                                             │
│ 2. Google Ads                                               │
│    └─ /ads (Gestor de Tráfego IA — aba "Google Ads")       │
│                                                             │
│ 3. Google Merchant Center                                   │
│    └─ /integrations?tab=google (seção catálogo, similar Meta)│
│                                                             │
│ 4. Google Meu Negócio                                       │
│    ├─ /reviews (aba "Google Meu Negócio")                   │
│    └─ /support (canal "Google Meu Negócio" no inbox)        │
│                                                             │
│ 5. Google Search Console                                    │
│    ├─ /settings (card "SEO" com dados do Search Console)    │
│    └─ /command-center (aba "SEO")                           │
│                                                             │
│ 6. Google Tag Manager                                       │
│    └─ /apps-externos (novo módulo "Aplicativos Externos")   │
│                                                             │
│ 7. Gmail                                                    │
│    └─ /emails (canal "Gmail" no inbox de emails)            │
│                                                             │
│ 8. Google Calendar                                          │
│    └─ /apps-externos (app externo, sincroniza com agenda)   │
└─────────────────────────────────────────────────────────────┘
```

---

## Fases de Implementação

### Fase 1 — Documentação Completa (Doc First)

Criar especificação dedicada `docs/especificacoes/marketing/google-integracoes.md` cobrindo todos os 8 módulos com:

- Escopo funcional de cada módulo
- Tabelas necessárias (existentes e novas)
- Edge Functions envolvidas (existentes e novas)
- Hooks e componentes de UI
- Mapeamento de navegação
- Fluxos de dados e dependências cruzadas

Atualizar `docs/especificacoes/marketing/marketing-integracoes.md` com referência ao novo doc.
Atualizar memória `integrations-roadmap-status`.

### Fase 2 — Google Analytics GA4 (Relatórios + Atribuição)

**Objetivo:** Alimentar os relatórios do sistema e o módulo de atribuição com dados reais do GA4.

**Backend (já existe parcialmente):**
- Edge Function `google-analytics-report` já suporta summary, realtime, list, sync
- Hook `useGoogleAnalytics` já existe
- Validar e completar: funis de conversão, receita por canal, dados de e-commerce

**Frontend:**
- Adicionar aba "Google Analytics" na página `/reports`
- Cards: sessões, usuários, pageviews, conversões, receita
- Gráfico de tendência diária
- Integrar dados GA4 no painel de atribuição (`/marketing/atribuicao`)

### Fase 3 — Google Ads (Gestor de Tráfego IA)

**Objetivo:** Integrar Google Ads como segunda plataforma no Gestor de Tráfego IA.

**Backend (parcialmente existente):**
- Edge Functions já existem: `google-ads-campaigns`, `google-ads-adgroups`, `google-ads-ads`, `google-ads-keywords`, `google-ads-audiences`, `google-ads-insights`, `google-ads-assets`
- Falta: conversões server-side (`google-ads-conversions`), cron de refresh de token (expiração 1h)

**Frontend:**
- Adicionar aba "Google Ads" no `/ads` (AdsManager)
- Paridade de funcionalidades com Meta: listar campanhas, métricas, criar/pausar
- Integrar no Chat IA do Gestor de Tráfego (tools para Google Ads)
- Integrar com Strategist e Guardian (análise dual-platform)

### Fase 4 — Google Merchant Center (Catálogo de Produtos)

**Objetivo:** Sincronizar catálogo de produtos para Google Shopping, similar ao Meta Catalog.

**Backend (parcialmente existente):**
- Edge Functions `google-merchant-sync` e `google-merchant-status` existem
- Completar: sync incremental, feed de produtos, status de aprovação por produto

**Frontend:**
- Seção "Catálogo Google Shopping" dentro do Hub Google (`/integrations?tab=google`)
- Cards: produtos sincronizados, aprovados, reprovados, pendentes
- Botão de sync manual + indicador de última sincronização
- Tabela com status de cada produto no Merchant Center

### Fase 5 — Google Meu Negócio (Avaliações + Atendimento)

**Objetivo:** Integrar avaliações do Google e canal de mensagens do GMB.

**Backend (existente):**
- Edge Functions `google-business-reviews` e `google-business-posts` existem
- Hook `useGoogleBusiness` existe com locations, reviews, posts, reply

**Frontend — Avaliações:**
- Adicionar aba "Google Meu Negócio" na página `/reviews`
- Listar avaliações do Google com nota, texto, data
- Botão de responder direto do painel
- Sync automático periódico

**Frontend — Atendimento:**
- Adicionar canal "Google Meu Negócio" no módulo `/support`
- Mensagens do GMB aparecem no inbox unificado
- Respostas enviadas via API do Google Business

### Fase 6 — Google Search Console (SEO)

**Objetivo:** Dados de SEO acessíveis em Configurações e na Central de Comando.

**Backend (existente):**
- Edge Function `google-search-console` já suporta summary, list, sites, sync
- Hook `useGoogleSearchConsole` existe

**Frontend:**
- Adicionar card "SEO" na página `/settings` com link para dados do Search Console
- Adicionar aba "SEO" na Central de Comando (`/command-center`)
- Métricas: queries top, CTR médio, posição média, impressões
- Alertas: páginas com erro de indexação, cobertura

### Fase 7 — Google Tag Manager (Aplicativos Externos)

**Objetivo:** Permitir injeção de tags via GTM com visibilidade dos scripts ativos.

**Backend (existente):**
- Edge Function `google-tag-manager` existe
- Hook `useGoogleTagManager` existe com containers, sync, scripts

**Frontend — Novo módulo "Aplicativos Externos":**
- Nova rota `/apps-externos`
- Nova entrada no menu de navegação (sidebar)
- Card do Google Tag Manager com:
  - Container ativo e Public ID
  - Lista de tags/scripts injetados (obtidos via API GTM)
  - Toggle para ativar/desativar injeção do GTM no storefront
  - Snippet de instalação (head + body)

### Fase 8 — Gmail (Inbox de Emails)

**Objetivo:** Conectar Gmail do usuário ao inbox de emails do sistema.

**Backend (novo):**
- Adicionar scope pack `gmail` no OAuth do Google
- Nova Edge Function `google-gmail-sync` para ler/enviar emails via Gmail API
- Novo hook `useGmail`

**Frontend:**
- Adicionar canal "Gmail" no módulo `/emails`
- Emails recebidos aparecem no inbox
- Possibilidade de responder via Gmail conectado

### Fase 9 — Google Calendar (Aplicativo Externo)

**Objetivo:** Sincronizar agenda do sistema com Google Calendar.

**Backend (novo):**
- Adicionar scope pack `calendar` no OAuth do Google
- Nova Edge Function `google-calendar-sync` para criar/ler eventos
- Novo hook `useGoogleCalendar`

**Frontend:**
- Card "Google Calendar" no módulo `/apps-externos`
- Toggle de sincronização: ao ativar, eventos da agenda do sistema (agendamentos, lembretes) são espelhados no Google Calendar do usuário
- Status: conectado/desconectado, último sync

---

## Ordem de Execução

| Fase | O que | Estimativa |
|------|-------|------------|
| 1 | Documentação completa | 1 sessão |
| 2 | Google Analytics GA4 | 1-2 sessões |
| 3 | Google Ads no Gestor de Tráfego | 2-3 sessões |
| 4 | Google Merchant Center | 1-2 sessões |
| 5 | Google Meu Negócio | 1-2 sessões |
| 6 | Search Console (SEO) | 1 sessão |
| 7 | Tag Manager + módulo Apps Externos | 1 sessão |
| 8 | Gmail | 1-2 sessões |
| 9 | Google Calendar | 1 sessão |

---

## Detalhes Técnicos

**Autenticação:** Todos os módulos compartilham o OAuth unificado do Google (`GoogleUnifiedSettings` com scope packs). Cada módulo ativa seu scope pack. O token refresh é gerenciado por `google-token-refresh`.

**Tabelas existentes** que já suportam: `google_ads_accounts`, `google_analytics_properties`, `google_merchant_products`, `google_business_locations`, `google_business_reviews`, `google_business_posts`, `google_search_console_data`, `google_tag_manager_containers`, `google_connections`.

**Tabelas novas necessárias:** `google_gmail_accounts`, `google_calendar_syncs`, `external_apps` (tabela genérica para o módulo Aplicativos Externos).

**Validação técnica:** Cada fase será validada com: chamada real à Edge Function, verificação de dados no banco, teste do componente de UI, e verificação de logs.

