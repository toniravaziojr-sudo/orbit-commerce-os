

# Gestor de Trafego IA — Plano Refinado com Correcoes Estruturais

## Resumo das Correcoes Incorporadas

O feedback do ChatGPT identificou 3 lacunas criticas no plano anterior. Este plano refinado incorpora todas:

| Correcao | Status | Implementacao |
|----------|--------|---------------|
| Config global cross-channel (orcamento total unico) | Incorporado | Tabela `ads_autopilot_configs` com `channel = 'global'` + configs por canal |
| Allocator cross-channel (IA decide split Meta/Google/TikTok) | Incorporado | Etapa explicita no pipeline `ads-autopilot-analyze` |
| CPA baseado em margem (nao ticket medio) | Incorporado | Campo `gross_margin_pct` e `max_cpa_cents` em `safety_rules` |
| Lock por tenant+channel (evitar sessoes concorrentes) | Incorporado | Campo `lock_session_id` + `lock_expires_at` na config |
| Idempotencia de acoes | Incorporado | `action_hash` UNIQUE em `ads_autopilot_actions` |
| Max change rate (limite de alteracao diaria) | Incorporado | Em `safety_rules`: `max_budget_change_pct_day` |
| Pre-check de integracao (canal conectado, pixel ativo, dev token) | Incorporado | Etapa 0 no pipeline antes de qualquer analise |

---

## Arquitetura Final

```text
LOJISTA
  |  Orcamento Total + Instrucoes
  v
+--------------------------------------------------+
| ads_autopilot_configs (channel='global')         |
| total_budget_cents, allocation_mode, objective   |
+--------------------------------------------------+
  |
  v
+--------------------------------------------------+
| ETAPA 0: PRE-CHECK INTEGRACOES                  |
| - Canal conectado? Scopes suficientes?           |
| - Google: Developer Token presente?              |
| - Evento de conversao configurado (Pixel/GA4)?   |
| Se falhar -> report_insight("BLOCKED", motivo)   |
+--------------------------------------------------+
  |
  v
+--------------------------------------------------+
| ETAPA 1: CONTEXT COLLECTOR                       |
| Produtos top 20, pedidos 30d, clientes,          |
| campanhas ativas, insights 7d, criativos         |
+--------------------------------------------------+
  |
  v
+--------------------------------------------------+
| ETAPA 2: ALLOCATOR (GPT-5.2 Tool Calling)       |
| Decide split: Meta X% / Google Y% / TikTok Z%   |
| Baseado em ROAS marginal, CPA, escala, volume    |
+--------------------------------------------------+
  |
  v (por canal com budget alocado)
+--------------------------------------------------+
| ETAPA 3: PLANNER (GPT-5.2 Tool Calling)         |
| Analisa campanhas do canal, propoe acoes:        |
| pause, adjust_budget, create, generate_creative  |
+--------------------------------------------------+
  |
  v
+--------------------------------------------------+
| ETAPA 4: POLICY & CONSTRAINTS (Deterministico)   |
| - Budget total nao excede config global          |
| - Max change rate: +-10%/dia por campanha        |
| - Max share: canal nao passa de X% do total      |
| - CPA maximo baseado em margem bruta             |
| - Min ROAS threshold                             |
| - Nunca deletar, so pausar                       |
| - Max 10 acoes por sessao                        |
+--------------------------------------------------+
  |
  v
+--------------------------------------------------+
| ETAPA 5: EXECUTOR                                |
| meta-ads-campaigns, google-ads-campaigns, etc.   |
| Cada acao logada com reasoning + rollback_data   |
+--------------------------------------------------+
```

---

## Fase 1: Banco de Dados (3 tabelas + RLS)

### Tabela `ads_autopilot_configs`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| tenant_id | uuid FK | |
| channel | text | `global`, `meta`, `google`, `tiktok` |
| is_enabled | boolean | Ativo/Inativo |
| budget_mode | text | `daily` / `monthly` (global usa, canais herdam) |
| budget_cents | integer | Global = orcamento total; Canal = alocacao pela IA |
| allocation_mode | text | `auto` (IA decide) / `manual` |
| max_share_pct | integer | Maximo % do total para este canal (default 80) |
| min_share_pct | integer | Minimo % do total para este canal (default 0) |
| objective | text | `sales`, `traffic`, `leads` |
| user_instructions | text | Prompt livre do lojista |
| ai_model | text | Default `openai/gpt-5.2` |
| safety_rules | jsonb | `{ gross_margin_pct, max_cpa_cents, min_roas, max_budget_change_pct_day, max_actions_per_session }` |
| lock_session_id | uuid | Sessao que detem o lock (nullable) |
| lock_expires_at | timestamptz | Expiracao do lock |
| last_analysis_at | timestamptz | |
| total_actions_executed | integer | Default 0 |
| total_credits_consumed | integer | Default 0 |
| created_at / updated_at | timestamptz | |

UNIQUE: `(tenant_id, channel)`

### Tabela `ads_autopilot_actions`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| tenant_id | uuid FK | |
| session_id | uuid FK | |
| channel | text | |
| action_type | text | `pause_campaign`, `adjust_budget`, `create_campaign`, `generate_creative`, `allocate_budget` |
| action_data | jsonb | Payload (campanha, valores antes/depois) |
| reasoning | text | Explicacao da IA |
| expected_impact | text | Impacto esperado da IA |
| confidence | text | `high`, `medium`, `low` |
| metric_trigger | text | Metrica que motivou a acao |
| status | text | `pending`, `validated`, `executed`, `failed`, `rejected` |
| rejection_reason | text | Motivo do policy layer |
| rollback_data | jsonb | Para desfazer |
| action_hash | text UNIQUE | `session_id + action_type + target_id` para idempotencia |
| executed_at | timestamptz | |
| error_message | text | |
| created_at | timestamptz | |

### Tabela `ads_autopilot_sessions`

| Coluna | Tipo | Descricao |
|--------|------|-----------|
| id | uuid PK | |
| tenant_id | uuid FK | |
| channel | text | `global` para allocator, canal especifico para planner |
| trigger_type | text | `manual`, `scheduled`, `reactive` |
| context_snapshot | jsonb | Tudo que a IA recebeu |
| ai_response_raw | text | Resposta completa |
| actions_planned | integer | |
| actions_executed | integer | |
| actions_rejected | integer | |
| insights_generated | jsonb | report_insight separado das acoes |
| integration_status | jsonb | Resultado do pre-check por canal |
| cost_credits | integer | |
| duration_ms | integer | |
| created_at | timestamptz | |

---

## Fase 2: Edge Function `ads-autopilot-analyze`

Pipeline completo com 5 etapas:

**Etapa 0 — Pre-check de Integracoes**
Para cada canal habilitado, verificar:
- Meta: conexao ativa em `meta_page_connections`, pixel/CAPI configurado
- Google: conexao ativa em `google_connections`, developer token em `platform_credentials`
- TikTok: conexao ativa em `tiktok_ads_connections`
- Se canal falhar pre-check: status `BLOCKED`, gera `report_insight` com o que falta

**Etapa 1 — Lock**
Tentar adquirir lock em `ads_autopilot_configs` (UPDATE WHERE lock_session_id IS NULL OR lock_expires_at < now()). Se falhar, retornar "sessao ja em andamento".

**Etapa 2 — Context Collector**
Queries diretas ao banco (nao via edge functions):
- Produtos top 20 por vendas
- Pedidos ultimos 30 dias (volume, ticket medio, margem se disponivel)
- Campanhas ativas de todos os canais habilitados
- Insights ultimos 7 dias por campanha
- Config global + configs por canal

**Etapa 3 — Allocator (GPT-5.2)**
Uma primeira chamada ao modelo com tool calling:
- Tool: `allocate_budget({ meta_pct, google_pct, tiktok_pct, reasoning })`
- Baseado em ROAS marginal, CPA, volume, escala de cada canal
- Policy valida: share dentro de min/max configurado

**Etapa 4 — Planner por Canal (GPT-5.2)**
Para cada canal com budget alocado, segunda chamada com:
- Tools: `pause_campaign`, `adjust_budget`, `create_campaign`, `generate_creative`, `report_insight`
- Campos obrigatorios nas tools: `expected_impact`, `confidence`, `metric_trigger`
- Policy layer valida cada acao antes de executar

**Etapa 5 — Executor + Liberar Lock**

---

## Fase 3: Edge Function `ads-autopilot-creative`

Sem mudancas em relacao ao plano anterior. Usa `creative-image-generate` internamente.

---

## Fase 4: Hook `useAdsAutopilot`

```text
getGlobalConfig()              // Config global (orcamento total)
getChannelConfigs()            // Configs por canal
saveGlobalConfig(data)         // Salvar orcamento, instrucoes, safety_rules
toggleChannel(channel, bool)   // Habilitar/desabilitar canal
triggerAnalysis()              // Disparar analise manual
getActions(channel?, filters)  // Listar acoes (filtro por canal opcional)
getSessions()                  // Historico de sessoes
getInsights()                  // report_insight separados
```

---

## Fase 5-8: UI — Redesign da Pagina `/ads`

### Estrutura

```text
+-----------------------------------------------+
| Gestor de Trafego IA                          |
| [Config Global: Orcamento R$X.XXX/mes]  [ON]  |
+-----------------------------------------------+
|                                               |
| [Meta Ads] [Google Ads] [TikTok Ads]          |
|                                               |
| [Campanhas] [Acoes da IA] [Relatorios]        |
|                                               |
+-----------------------------------------------+
```

**Topo da pagina**: Card fixo com config global (orcamento total, objetivo, toggle master). Ao clicar, expande painel de configuracao com instrucoes e safety rules.

**Nivel 1**: Abas por canal (Meta/Google/TikTok) com badge de status (Conectado/Bloqueado/IA Ativa).

**Nivel 2 por canal**:
- Campanhas: tabela + toggle IA por canal + status do pre-check
- Acoes da IA: timeline com badges, reasoning, status
- Relatorios: cards de resumo + grafico Recharts

### Componentes

| Componente | Descricao |
|------------|-----------|
| `AdsManagerPage.tsx` | Redesign completo (substitui atual) |
| `AdsGlobalConfig.tsx` | Card topo com orcamento global + toggle master |
| `AdsAutopilotSetup.tsx` | Painel expandivel: instrucoes, safety rules, margem |
| `AdsChannelTabs.tsx` | Seletor Meta/Google/TikTok |
| `AdsCampaignsTab.tsx` | Tabela campanhas do canal + toggle IA |
| `AdsActionsTab.tsx` | Timeline acoes da IA |
| `AdsReportsTab.tsx` | Cards resumo + graficos |

---

## Faseamento do Autopilot (Semanas)

Conforme recomendado, as acoes da IA serao liberadas progressivamente:

| Semana | Acoes Habilitadas |
|--------|-------------------|
| 1 | `pause_campaign`, `adjust_budget`, `report_insight`, `allocate_budget` |
| 2 | `create_campaign` (com templates fixos) |
| 3 | `generate_creative` + testes A/B estruturados |

Isso sera controlado por um campo `allowed_actions` em `safety_rules` da config global.

---

## Ordem de Implementacao

| # | Fase | Descricao |
|---|------|-----------|
| 1 | DB | 3 tabelas + RLS + indices |
| 2 | Edge | `ads-autopilot-analyze` (pipeline completo com allocator) |
| 3 | Edge | `ads-autopilot-creative` |
| 4 | Hook | `useAdsAutopilot` |
| 5 | UI | `AdsManagerPage` + `AdsGlobalConfig` |
| 6 | UI | `AdsAutopilotSetup` (instrucoes + safety rules) |
| 7 | UI | `AdsCampaignsTab` por canal |
| 8 | UI | `AdsActionsTab` (timeline) |
| 9 | UI | `AdsReportsTab` (graficos) |
| 10 | Docs | Atualizar `marketing-integracoes.md` |

