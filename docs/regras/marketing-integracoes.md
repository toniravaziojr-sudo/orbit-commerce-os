# Marketing — Regras e Especificações

> **STATUS:** 🟧 Pending (parcialmente implementado)  
> **Última atualização:** 2026-01-28

---

## Visão Geral

Módulo de marketing dividido em **dois grupos** na navegação:

### Marketing Básico
Integrações com plataformas e configurações de atribuição/conversão.

| Submódulo | Rota | Status |
|-----------|------|--------|
| Integrações Marketing | `/marketing` | 🟧 Pending |
| Atribuição de venda | `/marketing/atribuicao` | 🟧 Pending |
| Descontos | `/discounts` | ✅ Ready (ver descontos.md) |
| Aumentar Ticket | `/offers` | ✅ Ready (ver ofertas.md) |

### Marketing Avançado
Ferramentas de engajamento, automação e geração de criativos com IA.

| Submódulo | Rota | Status |
|-----------|------|--------|
| Email Marketing | `/email-marketing` | 🟧 Pending (ver email-marketing.md) |
| Quizzes | `/quizzes` | 🟧 Pending (ver quizzes.md) |
| Gestor de Mídias IA | `/media` | ✅ Ready |
| Gestor de Tráfego IA | `/campaigns` | 🟧 Pending |
| Gestão de Criativos | `/creatives` | ✅ Ready (ver seção 6) |

---

## RBAC

A divisão reflete nas permissões:

| Módulo RBAC | Key | Descrição |
|-------------|-----|-----------|
| Marketing Básico | `marketing-basic` | Integrações, atribuição, descontos e ofertas |
| Marketing Avançado | `marketing-advanced` | Email marketing, quizzes, gestor de mídias, tráfego e criativos |

---

## 1. Integrações Marketing

### Plataformas
| Plataforma | Status | Funcionalidades |
|------------|--------|-----------------|
| Meta (FB/IG) | ✅ Ready | Pixel, Catálogo, CAPI, OAuth integrador |
| Google Ads | 🟧 Pending | Conversions, Merchant |
| TikTok | ✅ Ready | Pixel, Events API, OAuth integrador → **Migrado para Hub TikTok em `/integrations`** |
| Pinterest | 🟧 Pending | Tag, Catálogo |

### TikTok OAuth (MIGRADO E LIMPO — Fase 2 Concluída)

> **STATUS:** ✅ MIGRAÇÃO COMPLETA — Sem dual-write, sem fallback  
> **Fase 1 concluída em:** 2026-02-15  
> **Fase 2 concluída em:** 2026-02-15  
> **Documentação completa:** `docs/regras/integracoes.md` → seção "TikTok — Hub Multi-Conexão"

A integração TikTok foi completamente migrada de `marketing_integrations` para o Hub TikTok.

#### O que mudou na Fase 2

| Item | Antes (Fase 1) | Depois (Fase 2) |
|------|-----------------|------------------|
| `tiktok-oauth-callback` | v2 dual-write | v3 só `tiktok_ads_connections` |
| `tiktok-token-refresh` | v1 dual-write | v2 só `tiktok_ads_connections` |
| `marketing-send-tiktok` | v2 fallback legado | v3 só `tiktok_ads_connections` |
| `useTikTokConnection.ts` | Deprecated | **Deletado** |
| `TikTokIntegrationCard.tsx` | Deprecated | **Deletado** |

#### Colunas legadas em `marketing_integrations`

As colunas `tiktok_*` em `marketing_integrations` **não são mais escritas** por nenhuma edge function.  
Podem ser removidas em uma futura migração de limpeza.

### Meta Pixel & CAPI
```typescript
// Eventos rastreados
{
  PageView: 'Visualização de página',
  ViewContent: 'Visualização de produto',
  AddToCart: 'Adição ao carrinho',
  InitiateCheckout: 'Início do checkout',
  Purchase: 'Compra concluída',
}

// Configuração por tenant
{
  tenant_id: uuid,
  pixel_id: string,
  access_token: string,       // Para CAPI
  test_event_code: string,    // Ambiente de teste
  is_enabled: boolean,
}
```

---

## 2. Atribuição de Vendas

### Fontes de Tráfego
| Parâmetro | Descrição |
|-----------|-----------|
| `utm_source` | Origem (google, facebook, etc) |
| `utm_medium` | Meio (cpc, email, social) |
| `utm_campaign` | Campanha |
| `utm_term` | Termo de busca |
| `utm_content` | Conteúdo/criativo |
| `aff` | Código de afiliado |
| `ref` | Referência genérica |

### Modelo de Atribuição
| Modelo | Descrição |
|--------|-----------|
| Last Click | Última fonte antes da compra |
| First Click | Primeira fonte conhecida |
| Linear | Divide entre todas as fontes |

### Campos no Pedido
```typescript
{
  attribution_data: {
    first_touch: {
      source: string,
      medium: string,
      campaign: string,
      timestamp: string,
    },
    last_touch: {
      source: string,
      medium: string,
      campaign: string,
      timestamp: string,
    },
    touchpoints: Array<TouchPoint>,
  }
}
```

---

## 3. Email Marketing

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Listas | 🟧 Pending | Segmentação |
| Templates | 🟧 Pending | Editor visual |
| Campanhas | 🟧 Pending | Envio em massa |
| Automações | 🟧 Pending | Fluxos automáticos |
| Métricas | 🟧 Pending | Open rate, CTR |

### Tipos de Automação
| Tipo | Trigger | Descrição |
|------|---------|-----------|
| Boas-vindas | Cadastro | Série de onboarding |
| Carrinho abandonado | Inatividade | Recuperação |
| Pós-compra | Compra | Upsell/review |
| Aniversário | Data | Cupom especial |
| Reativação | Inatividade | Win-back |

---

## 4. Gestor de Mídias IA

> **Antigo nome:** Mídias Sociais

### Arquivos
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Media.tsx` | Dashboard de mídias |
| `src/pages/MediaCampaignDetail.tsx` | Detalhe de campanha |

### Funcionalidades
| Feature | Status | Descrição |
|---------|--------|-----------|
| Catálogo de criativos | 🟧 Pending | Imagens/vídeos |
| Campanhas de mídia | 🟧 Pending | Gestão |
| Performance | 🟧 Pending | Métricas |
| ROI | 🟧 Pending | Análise |

---

## 5. Gestor de Tráfego IA (Autopilot)

> **STATUS:** ✅ Ready (Fase 1-8 + v4.0 Sprints 1-2 implementados)  
> **Rota:** `/ads`

### Arquitetura

Pipeline autônomo de 5 etapas que gerencia tráfego pago cross-channel:

```text
Lojista (Orçamento Total + Instruções)
  → Etapa 0: Pre-check de Integrações (canal conectado? pixel ativo? dev token?)
  → Etapa 1: Lock (evitar sessões concorrentes)
  → Etapa 2: Context Collector (produtos top 20, pedidos 30d, campanhas, insights 7d)
  → Etapa 3: Allocator (GPT-5.2 decide split Meta/Google/TikTok por ROAS marginal)
  → Etapa 4: Planner (GPT-5.2 propõe ações por canal) + Policy Layer (validação determinística)
  → Etapa 5: Executor (executa ações validadas via edge functions de cada canal)
```

### UI: Estrutura de 3 Abas Mãe (v4.0)

A página `/ads` utiliza 3 abas de nível superior:

| Aba | Componente | Descrição |
|-----|-----------|-----------|
| **Visão Geral** | `AdsOverviewTab.tsx` | Dashboard cross-channel com métricas agregadas (Investimento Total, ROAS Blended, CPA Médio, Conversões, Receita), barra de pacing mensal e breakdown por canal |
| **Gerenciador** | Tabs Meta/Google/TikTok (existentes) | Conteúdo anterior reorganizado com sub-tabs: Campanhas, Ações IA, Relatórios |
| **Insights** | `AdsInsightsTab.tsx` | Feed de insights semanais da IA com filtros por categoria/canal, botões "Vou fazer"/"Ignorar", histórico colapsável e botão "Gerar Insights Agora" |

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `ads_autopilot_configs` | Config global (`channel='global'`) + configs por canal. Novas colunas v4.0: `total_budget_cents`, `total_budget_mode`, `channel_limits`, `strategy_mode`, `funnel_split_mode`, `funnel_splits`, `kill_switch`, `human_approval_mode` |
| `ads_autopilot_sessions` | Histórico de sessões de análise |
| `ads_autopilot_actions` | Ações da IA com reasoning, rollback_data e action_hash |
| `ads_autopilot_account_configs` | **NOVA v4.0** — Config normalizada por conta de anúncios (substitui JSONB `safety_rules.account_configs`). Campos: `is_ai_enabled`, `budget_mode`, `budget_cents`, `target_roi`, `min_roi_cold`, `min_roi_warm`, `user_instructions`, `strategy_mode`, `funnel_split_mode`, `funnel_splits`, `kill_switch`, `human_approval_mode` |
| `ads_autopilot_insights` | **NOVA v4.0** — Insights semanais da IA com `title`, `body`, `evidence`, `recommended_action`, `priority`, `category`, `sentiment`, `status` (open/done/ignored) |
| `ads_autopilot_experiments` | **NOVA v4.0** — Experimentos A/B com `hypothesis`, `variable_type`, `plan`, `budget_cents`, `duration_days`, `min_spend_cents`, `min_conversions`, `success_criteria`, `status`, `results`, `winner_variant_id` |
| `ads_creative_assets` | **NOVA v4.0** — Criativos gerados com `format`, `aspect_ratio`, `angle`, `copy_text`, `headline`, `cta_type`, `platform_ad_id`, `performance`, `compliance_status` |
| `ads_tracking_health` | **NOVA v4.0** — Saúde do tracking com `status` (healthy/degraded/critical/unknown), `indicators`, `alerts` |
| `meta_ad_adsets` | Cache local de conjuntos de anúncios (ad sets) sincronizados da Meta |
| `meta_ad_ads` | Cache local de anúncios individuais sincronizados da Meta |

### Config Global (`channel='global'`)

> **Parcialmente DEPRECADA na Fase 10.6.** Orçamento, ROI e prompt migraram para per-account. O registro `channel='global'` mantém `ai_model`, `lock_session_id` e os novos campos globais v4.0.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ai_model` | text | Default `openai/gpt-5.2` |
| `lock_session_id` | uuid | Sessão que detém o lock (nullable) |
| `total_budget_cents` | integer | **v4.0** — Orçamento total cross-channel |
| `total_budget_mode` | text | **v4.0** — `daily` ou `monthly` |
| `channel_limits` | jsonb | **v4.0** — Limites min/max % por canal (meta, google, tiktok) |
| `strategy_mode` | text | **v4.0** — `aggressive` / `balanced` / `long_term` |
| `kill_switch` | boolean | **v4.0** — Para imediato de todas as ações |
| `human_approval_mode` | text | **v4.0** — `auto` / `approve_high_impact` |

### Config por Conta de Anúncios

#### Tabela normalizada `ads_autopilot_account_configs` (v4.0 — PREFERIDA)

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `channel` | text | — | meta / google / tiktok |
| `ad_account_id` | text | — | ID da conta na plataforma |
| `is_ai_enabled` | boolean | false | Se a IA está ativa nesta conta |
| `budget_mode` | text | `monthly` | Período do orçamento |
| `budget_cents` | integer | 0 | Limite máximo da IA nesta conta |
| `target_roi` | numeric | null | ROI ideal — meta de retorno |
| `min_roi_cold` | numeric | 2.0 | ROI mínimo para pausar público frio |
| `min_roi_warm` | numeric | 3.0 | ROI mínimo para pausar público quente |
| `user_instructions` | text | "" | Prompt estratégico da conta |
| `strategy_mode` | text | `balanced` | `aggressive` / `balanced` / `long_term` |
| `funnel_split_mode` | text | `manual` | `manual` / `ai_decides` |
| `funnel_splits` | jsonb | `{"cold":60,"remarketing":25,"tests":15,"leads":0}` | Distribuição por funil |
| `kill_switch` | boolean | false | Para imediato nesta conta |
| `human_approval_mode` | text | `auto` | `auto` / `approve_high_impact` |

> **Constraint:** UNIQUE(tenant_id, channel, ad_account_id)

#### Hook `useAdsAccountConfigs.ts` (v4.0 Sprint 3)

| Método | Descrição |
|--------|-----------|
| `configs` | Lista completa de configs por conta |
| `getAccountConfig(channel, accountId)` | Retorna config de uma conta específica |
| `getAIEnabledAccounts(channel)` | Lista IDs de contas com IA ativa |
| `saveAccountConfig.mutate(config)` | Upsert config na tabela normalizada |
| `toggleAI.mutate({ channel, ad_account_id, enabled })` | Liga/desliga IA para uma conta |
| `toggleKillSwitch.mutate({ channel, ad_account_id, enabled })` | Ativa/desativa kill switch com AlertDialog de confirmação |

#### Validação obrigatória para ativar IA (`isAccountConfigComplete`)

O Switch de IA só fica habilitado quando **TODOS** os campos estão preenchidos:
- Orçamento > 0
- ROI Ideal preenchido
- ROI mín. Frio e Quente preenchidos
- Prompt Estratégico com mínimo 10 caracteres
- Estratégia selecionada
- Splits preenchidos (total = 100%) **OU** "IA decide" ativado

Se incompleto, o Switch fica desabilitado e um Tooltip mostra os campos faltantes.

#### Campos adicionais no card de configuração (Sprint 3)

| Campo | Tipo | Opções | Descrição |
|-------|------|--------|-----------|
| Estratégia Geral | Select | 🔥 Agressiva / ⚖️ Balanceada (Recomendada) / 🌱 Médio/Longo Prazo | Define tom de atuação da IA |
| Splits de Funil | 4 inputs % | Frio / Remarketing / Testes / Leads | Total deve ser 100%. Toggle "IA decide" desabilita campos |
| Modo de Aprovação | Select | Auto-executar tudo / Aprovar alto impacto | Controla se ações high-impact requerem aprovação humana |
| Kill Switch | Botão destrutivo | AlertDialog de confirmação | Para imediato de todas as ações da IA nesta conta |

#### Legado: JSONB em `safety_rules` (mantido para retrocompatibilidade)

```jsonc
// ads_autopilot_configs WHERE channel = 'meta'
{
  "safety_rules": {
    "ai_enabled_accounts": ["act_123", "act_456"],
    "account_configs": {
      "act_123": {
        "budget_mode": "monthly",
        "budget_cents": 100000,
        "target_roi": 5,
        "min_roi_cold": 2,
        "min_roi_warm": 3,
        "user_instructions": "..."
      }
    },
    "max_budget_change_pct_day": 10,
    "max_actions_per_session": 10,
    "allowed_actions": ["pause_campaign", "adjust_budget", "report_insight", "allocate_budget"]
  }
}
```

> **NOTA:** A partir do Sprint 3, o `AdsManager.tsx` utiliza `useAdsAccountConfigs` para CRUD na tabela normalizada. O JSONB legado é mantido apenas para retrocompatibilidade com a edge function `ads-autopilot-analyze` até o Sprint 5.

> **UI:** Cada conta com IA ativa exibe um card colapsável com esses campos (`AdsAccountConfig.tsx`). O botão 🤖 nos chips de conta abre configurações (não alterna estado). Azul = IA ativa, Amarelo = IA inativa.

### Tipos de Ação

| Ação | Fase | Descrição |
|------|------|-----------|
| `allocate_budget` | 1 | Distribuição cross-channel |
| `pause_campaign` | 1 | Pausar campanha de baixo desempenho |
| `adjust_budget` | 1 | Ajustar orçamento de campanha |
| `report_insight` | 1 | Insight sem execução |
| `create_campaign` | 2 | Criar campanha com templates fixos |
| `create_adset` | 2 | Criar conjunto com targeting definido |
| `generate_creative` | 3 | Gerar criativos via `ads-autopilot-creative` |
| `run_experiment` | 3 | Executar teste A/B estruturado |
| `expand_audience` | 4 | Expandir públicos |
| `advanced_ab_test` | 4 | Testes A/B avançados |

### Phased Rollout (allowed_actions)

| Fase | Critério de Liberação | Ações |
|------|----------------------|-------|
| 1 (atual) | Sempre | pause, adjust_budget, report_insight, allocate_budget |
| 2 | 7+ dias de dados + 10+ conversões | + create_campaign, create_adset |
| 3 | 14+ dias + 30+ conversões | + create_creative, run_experiment |
| 4 | 30+ dias + 50+ conversões | + expand_audience, advanced_ab_test |

### Guardrails

- **Lock por tenant:** `lock_session_id` impede sessões concorrentes (expira em 10 min)
- **Idempotência:** `action_hash` UNIQUE (`session_id + action_type + target_id`)
- **Policy Layer:** Validação determinística antes de qualquer execução
- **Nunca deletar:** Só pausar campanhas
- **CPA baseado em margem:** Não em ticket médio
- **Kill Switch:** Verificado no início de cada ciclo (global e por conta)
- **Human Approval:** Ações high-impact ficam como `pending_approval` quando configurado

### Edge Functions

| Function | Descrição |
|----------|-----------|
| `ads-autopilot-analyze` | Orquestrador principal (pipeline 5 etapas) |
| `ads-autopilot-creative` | Geração de criativos para campanhas via autopilot |
| `ads-autopilot-weekly-insights` | **NOVA v4.0** — Diagnóstico semanal com insights categorizados |
| `ads-autopilot-experiments-run` | **NOVA v4.0 (planejada)** — Avaliação/criação/promoção de experimentos |
| `meta-ads-adsets` | Sync, update e balance de ad sets e contas Meta (v1.0.0) |
| `meta-ads-ads` | Sync e update de anúncios individuais Meta (v1.0.0) |

### Cron Jobs

| Job | Frequência | Edge Function | Descrição |
|-----|-----------|---------------|-----------|
| Otimização | 6h (existente) | ads-autopilot-analyze v4.0 | Ajustes, pausas, pacing, tracking health, kill switch |
| Insights | Semanal (seg 11h UTC) | ads-autopilot-weekly-insights | Diagnóstico + insights persistidos |
| Experimentos | Semanal (ter 11h UTC) | ads-autopilot-experiments-run | Avaliar/criar/promover testes |
| Criativos | Semanal (qua 11h UTC) | ads-autopilot-creative-generate | Gerar assets para produtos vencedores |

### Tabela `meta_ad_adsets`

```sql
-- Campos principais
meta_adset_id TEXT UNIQUE (por tenant)
meta_campaign_id TEXT (FK lógica)
campaign_id UUID (FK para meta_ad_campaigns)
ad_account_id TEXT
name, status, effective_status, optimization_goal, billing_event
bid_amount_cents, daily_budget_cents, lifetime_budget_cents
targeting JSONB
start_time, end_time, synced_at
```

### Edge Function `meta-ads-adsets` (v1.1.0)

| Ação | Método | Descrição |
|------|--------|-----------|
| `sync` | POST | Puxa ad sets da Meta Graph API para todas as contas (ou filtrado por `meta_campaign_id`). Inclui `effective_status`. |
| `update` | POST | Atualiza nome, status ou budget no Meta + local |
| `balance` | POST/GET | Retorna saldo, gasto e moeda de cada conta de anúncios |

### Tabela `meta_ad_ads`

```sql
-- Campos principais
meta_ad_id TEXT UNIQUE (por tenant)
meta_adset_id TEXT (FK lógica)
meta_campaign_id TEXT (FK lógica)
adset_id UUID (FK para meta_ad_adsets)
ad_account_id TEXT
name, status, effective_status
creative_id TEXT
synced_at
```

### Edge Function `meta-ads-ads` (v1.1.0)

| Ação | Método | Descrição |
|------|--------|-----------|
| `sync` | POST | Puxa anúncios da Meta Graph API (filtro por `meta_adset_id` ou `meta_campaign_id`). Inclui `effective_status`. |
| `update` | POST | Atualiza nome ou status no Meta + local |

### Padrão `effective_status`

O sistema prioriza `effective_status` sobre `status` para representar o estado real de entrega:
- `status` = toggle do usuário (ACTIVE/PAUSED)
- `effective_status` = estado real considerando hierarquia (ex: CAMPAIGN_PAUSED, ADSET_PAUSED, WITH_ISSUES, DISAPPROVED)
- Controles de pause/play alteram o `status` via API

### Regra de Campanha Ativa (contagem e filtro)

Uma campanha só é considerada **ativa** na UI se:
1. A campanha tem `effective_status` = ACTIVE
2. **E** possui pelo menos 1 conjunto de anúncios (adset) com `effective_status` = ACTIVE, **OU** os ad sets ainda não foram sincronizados (sem registros locais)
3. **E** o campo `stop_time` é nulo **OU** está no futuro (campanha ainda em veiculação)

Campanhas com `stop_time` no passado são marcadas como **"Concluída"** mesmo que `effective_status` permaneça `ACTIVE`. Isso evita que campanhas já encerradas sejam contadas como ativas.

A condição 2 evita que campanhas genuinamente ativas apareçam como pausadas antes da primeira sincronização de ad sets. Após o sync, a regra hierárquica se aplica normalmente.

### Arquivos Frontend

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/AdsManager.tsx` | Página principal com 3 abas mãe (Visão Geral / Gerenciador / Insights) e hooks de conexão por canal |
| `src/hooks/useAdsAutopilot.ts` | Hook para configs, actions, sessions. Interface `AutopilotConfig` inclui campos v4.0 (`total_budget_cents`, `total_budget_mode`, `channel_limits`, `strategy_mode`, `funnel_split_mode`, `funnel_splits`, `kill_switch`, `human_approval_mode`) |
| `src/hooks/useAdsAccountConfigs.ts` | **NOVO v4.0 Sprint 3** — Hook CRUD para tabela normalizada `ads_autopilot_account_configs`. Inclui `toggleAI`, `toggleKillSwitch`, `saveAccountConfig` e validação `isAccountConfigComplete` |
| `src/hooks/useAdsInsights.ts` | **NOVO v4.0** — Hook para CRUD de insights (listar, marcar done/ignored, gerar manual) |
| `src/hooks/useMetaAds.ts` | Hook para campanhas, ad sets, insights, saldo e sync (Meta) |
| `src/components/ads/AdsOverviewTab.tsx` | **NOVO v4.0** — Dashboard cross-channel com métricas agregadas, pacing mensal e breakdown por canal |
| `src/components/ads/AdsInsightsTab.tsx` | **NOVO v4.0** — Feed de insights com filtros, ações "Vou fazer"/"Ignorar" e histórico colapsável |
| `src/components/ads/AdsAccountConfig.tsx` | **Refatorado v4.0 Sprint 3** — Config por conta com Estratégia, Splits de Funil, Modo de Aprovação, Kill Switch e validação obrigatória |
| `src/components/ads/AdsChannelIntegrationAlert.tsx` | Alerta de integração por canal com chips de seleção de contas |
| `src/components/ads/AdsCampaignsTab.tsx` | Campanhas por canal com 28 métricas disponíveis |
| `src/components/ads/AdsActionsTab.tsx` | Timeline de ações da IA |
| `src/components/ads/AdsReportsTab.tsx` | Relatórios por conta de anúncios |

### Pre-check de Integrações

Antes de executar, o autopilot verifica automaticamente:

| Canal | Verificação |
|-------|-------------|
| Meta | Conexão ativa em `marketplace_connections` |
| Google | Conexão ativa em `google_connections` + Developer Token em `platform_credentials` |
| TikTok | Conexão ativa em `tiktok_ads_connections` |

Se falhar → status `BLOCKED`, gera `report_insight` com o que falta.

### Sincronização de Campanhas

| Comportamento | Descrição |
|---------------|-----------|
| **Auto-sync** | Na primeira visualização de um canal conectado, se a lista de campanhas estiver vazia, dispara `syncCampaigns.mutate()` automaticamente (controlado por `syncedChannelsRef` para evitar re-trigger). Só dispara quando a aba ativa é "Gerenciador". |
| **Sync sequencial** | Botão "Atualizar" executa sync **sequencial**: primeiro `syncCampaigns` (await), depois `syncInsights` + `syncAdsets` em paralelo — garante que campanhas existam antes de processar insights |
| **Sync de ad sets** | Ao expandir uma campanha, sincroniza os ad sets automaticamente via `meta-ads-adsets` edge function (ação `sync` com filtro por `meta_campaign_id`) |
| **Filtro por status** | ToggleGroup com 3 opções: Todas (total), Ativas (ACTIVE/ENABLE), Pausadas (PAUSED/DISABLE/ARCHIVED) — cada uma com badge de contagem |
| **Filtro por datas** | DateRange picker com presets (7d, 14d, 30d, 90d) para filtrar métricas de performance |
| **Conjuntos expandíveis** | Campanhas Meta expandem para mostrar ad sets com status, orçamento e métricas individuais |
| **Anúncios expandíveis** | Ad sets expandem para mostrar anúncios individuais com status e botão de pausar/ativar (3 níveis: Campanha > Conjunto > Anúncio) |
| **Métricas por objetivo** | Campanhas de vendas mostram ROI/ROAS; outras mostram métrica mais relevante (Leads, Cliques, Impressões, etc.) baseado no `objective` |
| **Gestão manual** | Botões de Pausar (⏸) e Ativar (▶) por campanha, ad set e anúncio individual, chamam APIs respectivas em tempo real |
| **Saldo da plataforma** | Botão mostra saldo atual via API (Meta `balance` action) + link direto para gerenciador externo |
| **Persistência de seleção** | Contas de anúncio selecionadas são salvas em `localStorage` e restauradas ao recarregar |

### Edge Function `meta-ads-campaigns` (v1.3.0)

| Item | Descrição |
|------|-----------|
| **Query de conexão** | Usa `marketplace_connections` com filtro `marketplace='meta'` e `is_active=true` |
| **Multi-account** | Itera por **todas** as contas de anúncio do tenant (não apenas a primeira) |
| **Paginação** | `graphApi` suporta URLs absolutas no campo `paging.next` para paginação completa (100+ campanhas) |
| **Ações** | `sync` (todas as contas), `create` / `update` / `delete` (requerem `ad_account_id` no body) |
| **Upsert** | Campanhas sincronizadas via `meta_campaign_id` como chave de conflito |

### Edge Function `meta-ads-insights` (v1.2.0)

| Item | Descrição |
|------|-----------|
| **Query de conexão** | Usa `marketplace_connections` com filtro `marketplace='meta'` e `is_active=true` |
| **Multi-account** | Itera por **todas** as contas de anúncio (não apenas a primeira) |
| **Campos da API** | `campaign_id, campaign_name, impressions, clicks, spend, reach, cpc, cpm, ctr, actions, action_values, cost_per_action_type, frequency` |
| **Conversões** | Extrai `actions[purchase/omni_purchase/offsite_conversion.fb_pixel_purchase]` para contagem e `action_values[purchase/omni_purchase]` para valor monetário (`conversion_value_cents`) |
| **ROAS** | Calculado como `conversion_value_cents / spend_cents` |
| **Auto-create campaigns** | Se um insight referencia uma `meta_campaign_id` que não existe localmente, cria automaticamente um registro placeholder com `status: UNKNOWN` (corrigido na próxima sincronização de campanhas) — evita dados órfãos |
| **Ações** | `sync` (pull insights da Meta), `list` (cache local), `summary` (métricas agregadas) |

### Edge Function `meta-ads-adsets` (v1.2.0)

| Item | Descrição |
|------|-----------|
| **Ações** | `sync` (com filtro opcional por `meta_campaign_id`), `update` (status/orçamento), `balance` (saldo da conta via `funding_source_details`) |
| **Balance** | Retorna `balance`, `currency`, `amount_spent`, `spend_cap`, `funding_source` e `funding_source_details` para cálculo preciso do saldo |
| **Mapeamento funding_source_details.type** | `1` → `CREDIT_CARD`, `2` → `DEBIT_CARD`, `20` → `PREPAID_BALANCE`, outros → `UNKNOWN` |
| **Cartão de crédito** | Quando `funding_source_type` = `CREDIT_CARD` (ou sem saldo numérico), a UI exibe **"Cartão de crédito"** em vez de valor monetário. Contas com cartão são excluídas do cálculo de "Saldo Total" |

---

## 6. Gestão de Criativos

> **STATUS:** ✅ Ready  
> **Rota:** `/creatives`

Módulo para geração de criativos com IA (vídeos e imagens) via fal.ai e OpenAI.

### Arquivos Principais
| Arquivo | Descrição |
|---------|-----------|
| `src/pages/Creatives.tsx` | Página principal com 7 abas |
| `src/types/creatives.ts` | Tipos e configurações de modelos |
| `src/hooks/useCreatives.ts` | Hooks para jobs e pasta |
| `src/components/creatives/*` | Componentes de cada aba |
| `src/components/creatives/CreativeGallery.tsx` | Galeria visual dos criativos gerados |
| `src/components/creatives/AvatarMascotTab.tsx` | Aba de Avatar Mascote |

### As 7 Abas

#### Aba 1: UGC Cliente (Transformar vídeo)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Vídeo base + imagens referência |
| **Opções** | Trocar pessoa, fundo, voz |
| **Modelos** | PixVerse Swap, ChatterboxHD, Sync LipSync |

#### Aba 2: UGC 100% IA (Avatar IA)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Script + referência avatar |
| **Modos** | Avatar falando / Full video |
| **Modelos** | Kling AI Avatar v2 Pro, Veo 3.1, Sora 2 |

#### Aba 3: Vídeos Curtos (Talking Head)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Tópico + bullets + tom |
| **Opções** | Variações A/B/C |
| **Modelos** | Kling AI Avatar, Sync LipSync |

#### Aba 4: Vídeos Tech (Produto)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Produto + imagens + estilo |
| **Estilos** | Tech premium, Clean studio, Futurista |
| **Modelos** | Veo 3.1 First/Last Frame, Sora 2 Image-to-Video |

#### Aba 5: Imagens Produto (Pessoas segurando)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Produto + cenário + perfil |
| **Cenas** | Banheiro, quarto, academia, outdoor |
| **Modelo** | GPT Image 1.5 Edit (preserva rótulo) |

#### Aba 6: Avatar Mascote (Personagem Animado)
| Campo | Descrição |
|-------|-----------|
| **Entrada** | Imagem do mascote + script + voz |
| **Estilos** | Cartoon, 3D, Realista |
| **Fontes de Voz** | TTS (f5-tts), Upload de áudio, Clonagem (ChatterboxHD) |
| **Pós-processo** | Sync LipSync v2 Pro (opcional) |
| **Modelos** | Kling Avatar v2 Pro (primário), Kling Avatar v2 Standard (fallback) |
| **Componente** | `AvatarMascotTab.tsx` |

#### Aba 7: Galeria
| Campo | Descrição |
|-------|-----------|
| **Funcionalidade** | Visualização de todos os criativos gerados |
| **Views** | Grid (cards) e Lista (tabela) |
| **Filtros** | Tipo de criativo, status, busca por prompt/produto |
| **Ações** | Download, link externo, preview com detalhes |
| **Componente** | `CreativeGallery.tsx` |

#### fal.ai
```typescript
{
  // Swap pessoa/fundo
  'fal-ai/pixverse/swap': { modes: ['person', 'background'] },
  
  // Voice conversion
  'resemble-ai/chatterboxhd/speech-to-speech': {},
  
  // Lipsync
  'fal-ai/sync-lipsync/v2/pro': {},
  
  // Avatar IA
  'fal-ai/kling-video/ai-avatar/v2/pro': {},
  
  // Text/Image to Video
  'fal-ai/veo3.1': {},
  'fal-ai/veo3.1/first-last-frame-to-video': {},
  'fal-ai/veo3.1/image-to-video': {},
  'fal-ai/sora-2/text-to-video/pro': {},
  'fal-ai/sora-2/image-to-video/pro': {},
}
```

#### OpenAI (via Lovable AI Gateway)
```typescript
{
  'gpt-image-1.5/edit': { 
    description: 'Imagens realistas com produto preservado' 
  },
}
```

### Armazenamento
- **Pasta automática:** `Criativos com IA` dentro da Media Library do tenant
- **Criação automática:** Se não existir, criar na primeira geração

### Jobs Assíncronos
```typescript
interface CreativeJob {
  id: string;
  tenant_id: string;
  type: CreativeType; // 'ugc_client_video' | 'ugc_ai_video' | 'short_video' | 'tech_product_video' | 'product_image'
  status: 'queued' | 'running' | 'succeeded' | 'failed';
  
  // Inputs
  prompt: string;
  product_id?: string;
  reference_images?: string[];
  reference_video_url?: string;
  settings: Record<string, unknown>;
  
  // Pipeline
  pipeline_steps?: PipelineStep[];
  current_step?: number;
  
  // Output
  output_urls?: string[];
  output_folder_id?: string;
  
  // Compliance
  has_authorization?: boolean;
  
  // Metadata
  error_message?: string;
  cost_cents?: number;
  created_at: string;
  completed_at?: string;
}
```

### Compliance (Obrigatório)
- Checkbox de autorização em abas que alteram rosto/voz
- Impedir geração sem aceite
- Guardar aceite no job (auditável)

### Edge Functions
| Function | Descrição | Status |
|----------|-----------|--------|
| `creative-generate` | Valida inputs, cria pasta, enfileira job | ✅ Ready |
| `creative-process` | Processa pipeline de modelos (fal.ai + Lovable AI) | ✅ Ready |
| `creative-webhook` | Recebe callbacks do fal.ai (futuro) | 🟧 Pending |

### Tabela `creative_jobs`
```sql
CREATE TABLE public.creative_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  type creative_type NOT NULL,
  status creative_job_status DEFAULT 'queued',
  
  -- Inputs
  prompt TEXT NOT NULL,
  product_id UUID REFERENCES products(id),
  product_name TEXT,
  product_image_url TEXT,
  reference_images TEXT[],
  reference_video_url TEXT,
  reference_audio_url TEXT,
  settings JSONB DEFAULT '{}',
  
  -- Compliance
  has_authorization BOOLEAN DEFAULT false,
  authorization_accepted_at TIMESTAMPTZ,
  
  -- Pipeline
  pipeline_steps JSONB DEFAULT '[]',
  current_step INTEGER DEFAULT 0,
  
  -- Output
  output_urls TEXT[],
  output_folder_id UUID,
  
  -- Metadata
  error_message TEXT,
  cost_cents INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL
);
```

### Enums
```sql
CREATE TYPE creative_type AS ENUM (
  'ugc_client_video',    -- Aba 1
  'ugc_ai_video',        -- Aba 2
  'short_video',         -- Aba 3
  'tech_product_video',  -- Aba 4
  'product_image'        -- Aba 5
);

CREATE TYPE creative_job_status AS ENUM (
  'queued', 'running', 'succeeded', 'failed'
);
```

### RLS Policies
- SELECT/INSERT/UPDATE/DELETE restritos por `tenant_id` via `user_roles`

### Função de Custo
```sql
-- increment_creative_usage(tenant_id, cost_cents)
-- Incrementa ai_usage_cents em tenant_monthly_usage
```

---

## Pendências

- [ ] Dashboard de atribuição
- [ ] Integração Google Ads (campanhas manuais)
- [ ] Módulo de email marketing completo
- [ ] Automações de marketing
- [x] Gestor de Tráfego IA — Fase 1: DB (3 tabelas + RLS)
- [x] Gestor de Tráfego IA — Fase 2: Edge Function `ads-autopilot-analyze`
- [x] Gestor de Tráfego IA — Fase 3: Edge Function `ads-autopilot-creative`
- [x] Gestor de Tráfego IA — Fase 4: Hook `useAdsAutopilot`
- [x] Gestor de Tráfego IA — Fase 5-8: UI completa
- [x] Gestor de Tráfego IA — Fase 9: Ad Sets (tabela `meta_ad_adsets` + edge function `meta-ads-adsets` + UI expandível)
- [x] Gestor de Tráfego IA — Fase 10: Métricas por objetivo + filtro de datas + saldo + link externo
- [x] Gestor de Tráfego IA — Fase 10.1: Correção de sync (marketplace/is_active), extração de action_values, colunas Alcance/Frequência/Custo por resultado, balance com funding_source_details
- [x] Gestor de Tráfego IA — Fase 10.2: Colunas personalizáveis (até 7 métricas selecionáveis pelo usuário via Column Selector), botão "Atualizar" (sync unificado de campanhas+insights+adsets), métricas disponíveis: Resultados, Alcance, Impressões, Frequência, Cliques, CTR, Custo por Resultado, CPC, CPM, Gasto, Orçamento, ROAS, Conversões, Valor de Conversão
- [x] Gestor de Tráfego IA — Fase 10.3: Correção de paginação na edge function `meta-ads-campaigns` v1.3.0 — `graphApi` agora suporta URLs absolutas no campo `paging.next` da Meta Graph API, garantindo sync completo de contas com 100+ campanhas. Biblioteca de métricas expandida para 28 métricas em 4 categorias (Desempenho, Custo, Conversão, Engajamento) com extração de actions JSONB. Deep-link "Abrir Meta Ads" aponta para a campanha de maior investimento.
- [x] Gestor de Tráfego IA — Fase 10.4: Persistência de seleção de contas via localStorage, sync de métricas do dia atual (dual preset), refresh de saldo via API, trigger automático do Autopilot ao ativar canal, anúncios individuais (tabela `meta_ad_ads` + edge function `meta-ads-ads` v1.0.0 + UI expandível 3 níveis: Campanha > Conjunto > Anúncio com pause/play)
- [x] Gestor de Tráfego IA — Fase 10.5: Suporte a `effective_status` em campanhas, conjuntos e anúncios. Coluna adicionada nas tabelas `meta_ad_campaigns`, `meta_ad_adsets` e `meta_ad_ads`. Edge functions (`meta-ads-campaigns` v1.4.0, `meta-ads-adsets` v1.1.0, `meta-ads-ads` v1.1.0) agora extraem `effective_status` da Meta Graph API. UI filtra e conta por `effective_status` (estado real de entrega) em vez de `status` (toggle). Permite identificar campanhas ACTIVE mas não entregando (ex: `CAMPAIGN_PAUSED`, `ADSET_PAUSED`, `WITH_ISSUES`).
- [x] Gestor de Tráfego IA — Fase 10.6: Ativação da IA por conta de anúncios (não mais por canal). Cada conta tem toggle de Bot independente nos chips de seleção. Configurações (orçamento, ROI ideal, ROI mín frio/quente, prompt estratégico) são individuais por conta, armazenadas em `safety_rules.account_configs[account_id]`. Lista de contas com IA ativa em `safety_rules.ai_enabled_accounts[]`. Removido `AdsGlobalConfig` e `AdsChannelRoasConfig`, substituídos por `AdsAccountConfig`.
- [x] Gestor de Tráfego IA — Fase 10.6b: Regra de campanha ativa = campaign ACTIVE + pelo menos 1 adset ACTIVE (ou ad sets não sincronizados).
- [x] Gestor de Tráfego IA — Fase 10.7: Relatórios por conta de anúncios. `AdsReportsTab` agrupa insights por `account_id` (mapeamento campaign→account via `campaignAccountMap`) e exibe cards de métricas individuais por conta selecionada. Dados (campanhas, configurações, métricas, saldos, relatórios) são todos segregados por conta de anúncios.
- [x] Gestor de Tráfego IA — Fase 10.8: UX do ícone Bot (🤖 abre configurações, não toggle direto; ativação via Switch interno no card). Detecção de `funding_source_type` para exibir "Cartão de crédito" quando aplicável. Edge function `meta-ads-adsets` v1.2.0 com `funding_source` + `funding_source_details`.
- [x] Gestor de Tráfego IA — Fase 10.9: Regra de campanha ativa refinada com `stop_time` (campanhas expiradas = "Concluída"). Mapeamento numérico de `funding_source_details.type` (1→CREDIT_CARD, 20→PREPAID). Edge function `meta-ads-adsets` v1.3.0.
- [x] Gestor de Tráfego IA — Sprint 3 (v4 Mandatory Config): Tabela normalizada `ads_autopilot_account_configs` com configurações individuais por conta de anúncios (budget_cents, target_roi, min_roi_cold, min_roi_warm, user_instructions, strategy_mode, funnel_split_mode, funnel_splits, kill_switch, human_approval_mode). Hook `useAdsAccountConfigs.ts` com CRUD + `toggleAI` + `toggleKillSwitch` + `isAccountConfigComplete` (validação obrigatória). UI `AdsAccountConfig.tsx` com estratégia (aggressive/balanced/long_term), splits de funil (manual com validação 100% ou AI decides), Kill Switch com AlertDialog de confirmação. Toggle de IA desabilitado até todas as configs obrigatórias preenchidas.
- [x] Gestor de Tráfego IA — Sprint 4 (Weekly Insights Engine): Edge function `ads-autopilot-weekly-insights` v1.0.0 com context collector (unit economics, 30d orders, cross-channel performance), prompt diagnóstico GPT-5.2 com 7 categorias (budget, funnel, creative, audience, channel_mix, conversion, competitive), auto-archive de insights >7d. Cron job `ads-weekly-insights` (Monday 11:00 UTC). Hook `useAdsInsights.ts` com `generateNow` mutation. Tabela `ads_autopilot_insights` (channel, ad_account_id, title, body, evidence, recommended_action, priority, category, sentiment, status).
- [x] Gestor de Tráfego IA — Sprint 5 (Analyze v4.0.0 Per-Account): Edge function `ads-autopilot-analyze` refatorada de v3.0.0→v4.0.0. Arquitetura per-account: lê `ads_autopilot_account_configs` em vez de `safety_rules` JSONB. Cada conta de anúncios com IA ativa recebe sua própria chamada ao LLM com system prompt individualizado contendo: `target_roi`, `min_roi_cold`, `min_roi_warm`, `strategy_mode` (aggressive/balanced/long_term com descrições detalhadas), `funnel_splits` (manual ou AI decides), `user_instructions`, `budget_cents`. Validação respeita `kill_switch` por conta (bloqueia todas as ações). Suporte a `human_approval_mode: "all"` (status `pending_approval`). Campanhas filtradas por `ad_account_id` (mapping campaign→account no Meta). Removida dependência de global `SafetyRules` JSONB — safety defaults agora em constante `DEFAULT_SAFETY`. Removido Allocator cross-channel (decisão agora é por conta, não por canal). Contexto de negócio mantido (products, orders, lowStock).
- [ ] Relatórios de ROI
- [x] Gestão de Criativos (UI básica)
- [x] Gestão de Criativos (Tabela creative_jobs)
- [x] Gestão de Criativos (Edge Functions generate/process)
- [x] Gestão de Criativos (Galeria visual)
- [ ] Gestão de Criativos (Webhook fal.ai)
