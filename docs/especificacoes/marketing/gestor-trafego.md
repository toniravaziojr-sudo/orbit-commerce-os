# Gestor de Tráfego IA — Especificação Completa

> **Status:** ✅ Ativo  
> **Versão:** 6.11.0  
> **Camada:** Layer 3 — Especificações / Marketing  
> **Rota:** `/ads`  
> **Extraído de:** `docs/especificacoes/marketing/marketing-integracoes.md` (Seção 5)  
> **Última atualização:** 2026-04-06

---

## Visão Geral

Pipeline autônomo de gestão de tráfego pago cross-channel (Meta, Google, TikTok) com IA. Utiliza arquitetura de **Motor Duplo** (Guardião + Estrategista) e 4 agentes especializados para análise, otimização e criação de campanhas.

### Módulos Relacionados

| Módulo | Doc | Relação |
|--------|-----|---------|
| Integrações de Marketing | `marketing/marketing-integracoes.md` | Pixel, CAPI, tracking |
| Criativos | `marketing/criativos.md` | Geração de vídeos/imagens |
| AI Criativos | `marketing/ai-criativos.md` | Pipeline criativo do builder |
| Campanhas (Mídias) | `marketing/campanhas.md` | Calendário editorial (separado) |

### Componentes Principais

| Tipo | Arquivo | Descrição |
|------|---------|-----------|
| **Página** | `src/pages/Ads.tsx` | Página principal (`/ads`) |
| **Overview** | `src/components/ads/AdsOverviewTab.tsx` | Dashboard cross-channel |
| **Campanhas** | `src/components/ads/AdsCampaignsTab.tsx` | Gerenciador por canal |
| **Config** | `src/components/ads/AdsAccountConfig.tsx` | Config por conta de anúncios |
| **Config Global** | `src/components/ads/AdsGlobalSettingsTab.tsx` | Configurações gerais fallback |
| **Insights** | `src/components/ads/AdsInsightsTab.tsx` | Feed de insights semanais |
| **Ações** | `src/components/ads/AdsActionsTab.tsx` | Histórico de ações da IA |
| **Aprovação** | `src/components/ads/AdsPendingApprovalTab.tsx` | Ações pendentes de aprovação |
| **Chat IA** | `src/components/ads/AdsChatTab.tsx` | Chat com IA de tráfego |
| **Relatórios** | `src/components/ads/AdsReportsTab.tsx` | Relatórios de performance |
| **ROI** | `src/components/ads/AdsRoiReportsTab.tsx` | Relatórios de ROI real |
| **Widget** | `src/components/dashboard/AdsAlertsWidget.tsx` | Alertas no dashboard |

### Hooks

| Hook | Descrição |
|------|-----------|
| `useAdsAutopilot.ts` | Motor do autopilot (trigger, status) |
| `useAdsAccountConfigs.ts` | CRUD de configs por conta |
| `useAdsInsights.ts` | Insights semanais |
| `useAdsPendingActions.ts` | Ações pendentes |
| `useAdsBalanceMonitor.ts` | Monitoramento de saldo |
| `useAdsExperiments.ts` | Experimentos A/B |
| `useAdsChat.ts` | Chat IA de tráfego |
| `useMetaAds.ts` | Dados Meta Ads |
| `useGoogleAds.ts` | Dados Google Ads |
| `useTikTokAds.ts` | Dados TikTok Ads |
| `useChannelAccounts.ts` | Contas de anúncio por canal |

### Edge Functions

| Função | Papel | Trigger |
|--------|-------|---------|
| `ads-autopilot-guardian` | Motor diário de proteção | Cron 4x/dia |
| `ads-autopilot-strategist` | Motor semanal/mensal de planejamento | Cron sáb/dom + start |
| `ads-autopilot-execute-approved` | Execução de ações aprovadas | Manual/Auto |
| `ads-autopilot-creative` | Geração de criativos para campanhas | Sob demanda |
| `ads-autopilot-weekly-insights` | Insights semanais | Cron seg |
| `ads-autopilot-experiments-run` | Avaliação de experimentos | Cron ter |
| `ads-autopilot-generate-prompt` | Geração de prompt estratégico | Sob demanda |
| `ads-chat-v2` | Chat IA com orquestração factual | Sob demanda |
| `ads-chat` | Chat IA (versão legada) | Sob demanda |
| `sync-ads-dashboard` | Sincronização de dados | Sob demanda |
| `meta-ads-campaigns` | CRUD campanhas Meta | Sob demanda |
| `meta-ads-adsets` | CRUD conjuntos Meta | Sob demanda |
| `meta-ads-ads` | CRUD anúncios Meta | Sob demanda |
| `meta-ads-insights` | Métricas Meta | Sob demanda |
| `meta-ads-creatives` | Criativos Meta | Sob demanda |
| `meta-ads-audiences` | Públicos Meta | Sob demanda |
| `google-ads-campaigns` | CRUD campanhas Google | Sob demanda |
| `google-ads-adgroups` | CRUD grupos Google | Sob demanda |
| `google-ads-ads` | CRUD anúncios Google | Sob demanda |
| `google-ads-keywords` | CRUD keywords Google | Sob demanda |
| `google-ads-assets` | Assets Google | Sob demanda |
| `google-ads-insights` | Métricas Google | Sob demanda |
| `google-ads-audiences` | Públicos Google | Sob demanda |
| `tiktok-ads-campaigns` | Campanhas TikTok | Sob demanda |
| `tiktok-ads-insights` | Métricas TikTok | Sob demanda |
| `creative-image-generate` | Geração de imagens IA | Sob demanda |
| `creative-generate` | Pipeline de criativos | Sob demanda |
| `creative-process` | Processamento de criativos | Sob demanda |

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `ads_autopilot_configs` | Config global + por canal |
| `ads_autopilot_account_configs` | Config normalizada por conta |
| `ads_autopilot_sessions` | Histórico de sessões |
| `ads_autopilot_actions` | Ações (plano estratégico) |
| `ads_autopilot_insights` | Insights semanais |
| `ads_autopilot_experiments` | Experimentos A/B |
| `ads_autopilot_artifacts` | Artefatos do pipeline |
| `ads_creative_assets` | Criativos gerados |
| `ads_tracking_health` | Saúde do tracking |
| `ads_chat_conversations` | Conversas do chat IA |
| `ads_chat_messages` | Mensagens do chat IA |
| `meta_ad_campaigns` | Cache campanhas Meta |
| `meta_ad_adsets` | Cache conjuntos Meta |
| `meta_ad_ads` | Cache anúncios Meta |
| `meta_ad_insights` | Cache insights Meta |
| `google_ad_campaigns` | Cache campanhas Google |
| `google_ad_groups` | Cache grupos Google |
| `google_ad_ads` | Cache anúncios Google |
| `google_ad_keywords` | Cache keywords Google |
| `google_ad_assets` | Cache assets Google |
| `google_ad_insights` | Cache insights Google |
| `tiktok_ad_campaigns` | Cache campanhas TikTok |
| `tiktok_ad_insights` | Cache insights TikTok |

---

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
| **Gerenciador** | Tabs Meta/Google/TikTok (existentes) | Conteúdo anterior reorganizado com sub-tabs: Campanhas, Plano Estratégico, Relatórios |
| **Insights** | `AdsInsightsTab.tsx` | Feed de insights semanais da IA com filtros por categoria/canal, botões "Vou fazer"/"Ignorar", histórico colapsável e botão "Gerar Insights Agora" |

### UI: Nomenclatura e Sanitização (v5.13)

| Regra | Descrição |
|-------|-----------|
| **Nomenclatura** | A sub-tab de ações chama-se **"Plano Estratégico"** (não "Ações da IA") |
| **Idioma** | Toda comunicação da IA (insights, cards, chat) é estritamente PT-BR |
| **Dados ocultos na listagem** | `session_id`, `confidence`, `metric_trigger`, badge de `channel` são removidos da visão do usuário |
| **Entity names** | Nomes de entidade com prefixo "ID:" (ex: IDs técnicos) são filtrados e não exibidos |
| **Diálogo de detalhes** | `ActionDetailDialog` não exibe `session_id` na descrição |
| **Empty state** | Texto: "Nenhuma ação registrada" / "Quando a IA executar o plano estratégico, as ações aparecerão aqui" |

### Tabelas

| Tabela | Descrição |
|--------|-----------|
| `ads_autopilot_configs` | Config global (`channel='global'`) + configs por canal. Novas colunas v4.0: `total_budget_cents`, `total_budget_mode`, `channel_limits`, `strategy_mode`, `funnel_split_mode`, `funnel_splits`, `kill_switch`, `human_approval_mode` |
| `ads_autopilot_sessions` | Histórico de sessões de análise |
| `ads_autopilot_actions` | Ações do Plano Estratégico com reasoning, rollback_data e action_hash. **UI v5.13:** Metadados técnicos (session_id, confidence, metric_trigger, channel badge) são ocultados da visão do usuário. Entity names com prefixo "ID:" são filtrados. |
| `ads_autopilot_account_configs` | **NOVA v4.0** — Config normalizada por conta de anúncios (substitui JSONB `safety_rules.account_configs`). Campos: `is_ai_enabled`, `budget_mode`, `budget_cents`, `target_roi`, `min_roi_cold`, `min_roi_warm`, `user_instructions`, `strategy_mode`, `funnel_split_mode`, `funnel_splits`, `kill_switch`, `human_approval_mode` |
| `ads_autopilot_insights` | **NOVA v4.0** — Insights semanais da IA com `title`, `body`, `evidence`, `recommended_action`, `priority`, `category`, `sentiment`, `status` (open/done/ignored) |
| `ads_autopilot_experiments` | **NOVA v4.0** — Experimentos A/B com `hypothesis`, `variable_type`, `plan`, `budget_cents`, `duration_days`, `min_spend_cents`, `min_conversions`, `success_criteria`, `status`, `results`, `winner_variant_id` |
| `ads_autopilot_artifacts` | **NOVA v5.11.2** — Artefatos do pipeline orientado a processo. Persiste `strategy`, `copy`, `creative_prompt`, `campaign_plan`, `user_command` por `campaign_key` determinístico. UPSERT por `(tenant_id, campaign_key, artifact_type)`. Status: `draft`→`ready`/`failed`/`awaiting_confirmation`/`confirmed`. RLS service_role. |
| `ads_creative_assets` | **NOVA v4.0** — Criativos gerados com `format`, `aspect_ratio`, `angle`, `copy_text`, `headline`, `cta_type`, `platform_ad_id`, `performance`, `compliance_status` |
| `ads_tracking_health` | **NOVA v4.0** — Saúde do tracking com `status` (healthy/degraded/critical/unknown), `indicators`, `alerts` |
| `meta_ad_adsets` | Cache local de conjuntos de anúncios (ad sets) sincronizados da Meta |
| `meta_ad_ads` | Cache local de anúncios individuais sincronizados da Meta |

### Config Global (`channel='global'`) — Aba "Configurações Gerais"

> **v5.6:** A aba "Configurações Gerais" no Gestor de Tráfego permite definir regras de fallback que se aplicam a **todas as contas** que não possuem configurações exclusivas. O registro `channel='global'` na tabela `ads_autopilot_configs` armazena essas configurações.

#### Hierarquia de Prioridade (INVIOLÁVEL)

| Prioridade | Fonte | Descrição |
|------------|-------|-----------|
| **1 (máxima)** | Configurações manuais da conta | ROI, ROAS thresholds, estratégia, funil, orçamento por conta |
| **2** | Prompt de instruções (IA) | Direcionamento estratégico sugestivo — NÃO sobrepõe configs manuais |
| **3 (fallback)** | Configurações Gerais (global) | Aplicadas a contas SEM regras exclusivas |

> **Regra do Prompt:** O prompt estratégico (user_instructions) é **sugestivo**. Se houver conflito entre o prompt e uma configuração manual (ex: ROI, estratégia, splits), a configuração manual SEMPRE prevalece. O prompt serve para fornecer contexto, expertise e direcionamento detalhado à IA.

#### Campos Globais

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `ai_model` | text | Default `openai/gpt-5.2` |
| `lock_session_id` | uuid | Sessão que detém o lock (nullable) |
| `total_budget_cents` | integer | **v4.0** — Orçamento total cross-channel |
| `total_budget_mode` | text | **v4.0** — `daily` ou `monthly` |
| `channel_limits` | jsonb | **v4.0** — Limites min/max % por canal (meta, google, tiktok) |
| `strategy_mode` | text | **v4.0** — `aggressive` / `balanced` / `long_term` |
| `kill_switch` | boolean | **v4.0** — Para imediato de todas as ações |
| `human_approval_mode` | text | **v5.14** — Hardcoded `approve_high_impact`. Removido da UI (redundante com fluxo de plano estratégico). Coluna mantida no banco para compatibilidade backend. |

#### Templates de Prompt Estratégico (v5.6)

O sistema disponibiliza templates de prompt nível "Sênior de Tráfego" para os canais Global, Meta, Google e TikTok. Estes templates incluem: missão, contexto de negócio, compliance/claims, fontes de verdade, destinos/funil, motor de decisão, regras de validade de público, anti-regressão, alocação operacional, playbooks por canal, sistema de criativos, matriz de testes, controles de risco e formato de saída obrigatório.

Arquivo: `src/components/ads/adsPromptTemplates.ts`

Os templates servem como **exemplo** para o cliente montar seu próprio prompt. O botão "Usar template" na UI popula o campo com o template correspondente ao canal.

#### Geração de Prompt com IA (v5.8)

O botão **"✨ Gerar com IA"** no campo de Prompt Estratégico da configuração por conta invoca a edge function `ads-autopilot-generate-prompt` para gerar automaticamente um prompt personalizado baseado nos dados reais do tenant.

| Dado Coletado | Fonte | Uso |
|---------------|-------|-----|
| Nome da loja | `store_settings.store_name` / `tenants.name` | Contexto do negócio |
| Descrição | `store_settings.store_description` | Tom e nicho |
| Categorias | `categories` (top 20) | Público-alvo e compliance |
| Produtos top 10 | `products` (ativos, por preço desc) | Claims, hooks, ticket médio |
| Margem estimada | `price - cost_price` | Meta de desempenho e ROAS |

A IA gera um prompt completo seguindo a estrutura: Missão → Contexto → Compliance → Fonte de Verdade → Destinos → Criativos → Formato de Saída. O resultado é inserido no campo `user_instructions` para revisão do cliente antes de salvar.

Edge function: `supabase/functions/ads-autopilot-generate-prompt/index.ts`
Hook: Invocado via `supabase.functions.invoke("ads-autopilot-generate-prompt")` no componente `AdsAccountConfig.tsx`.

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
| `roas_scaling_threshold` | numeric | null | **v5.7** — ROAS único de referência: ≥ escala, < reduz (IA decide % seguindo limites da plataforma) |
| `user_instructions` | text | "" | Prompt estratégico da conta (sugestivo, não sobrepõe configs manuais) |
| `strategy_mode` | text | `balanced` | `aggressive` / `balanced` / `long_term` |
| `funnel_split_mode` | text | `manual` | `manual` / `ai_decides` |
| `funnel_splits` | jsonb | `{"cold":60,"remarketing":25,"tests":15,"leads":0}` | Distribuição por funil |
| `kill_switch` | boolean | false | Para imediato nesta conta |
| `human_approval_mode` | text | `approve_high_impact` | **v5.14** — Hardcoded no save handler. Removido da UI (redundante com fluxo de aprovação de plano estratégico). Coluna mantida no banco para compatibilidade. |

#### Escalonamento de Orçamento por ROAS (v5.7)

Além das regras de **pausa** (min_roi_cold/warm), o sistema suporta ajuste dinâmico de orçamento baseado em um **único threshold ROAS**:

| Condição | Ação | Exemplo |
|----------|------|---------|
| ROAS ≥ `roas_scaling_threshold` | IA **aumenta** orçamento respeitando limites da plataforma | ROAS 4.5 ≥ 3.0 → IA escala (Meta ±10%, Google ±15%, TikTok ±7%) |
| ROAS < `roas_scaling_threshold` (mas acima de min_roi) | IA **reduz** orçamento respeitando limites da plataforma | ROAS 2.5 < 3.0 → IA reduz |
| ROAS < `min_roi_cold/warm` | **Pausar** campanha (regra existente) | ROAS 0.8 < min 1.0 → pause |

> **Hierarquia de decisão:** Pausa (min_roi) > Redução (< threshold) > Aumento (≥ threshold)
>
> A IA decide o percentual exato de ajuste seguindo os limites padrão de cada plataforma para não resetar a fase de aprendizado.
>
> Todas as alterações de orçamento são **agendadas para 00:01** do dia seguinte (ver regra de budget scheduling).

> **Constraint:** UNIQUE(tenant_id, channel, ad_account_id)

#### Hook `useAdsAccountConfigs.ts` (v4.0 Sprint 3)

| Método | Descrição |
|--------|-----------|
| `configs` | Lista completa de configs por conta |
| `getAccountConfig(channel, accountId)` | Retorna config de uma conta específica |
| `getAIEnabledAccounts(channel)` | Lista IDs de contas com IA ativa |
| `saveAccountConfig.mutate(config)` | Upsert config na tabela normalizada |
| `toggleAI.mutate({ channel, ad_account_id, enabled })` | Liga/desliga IA para uma conta. **Dispara o Motor Estrategista APENAS na primeira ativação** (`isFirstEver`). Reativações (desligar → ligar) NÃO re-disparam o estrategista — os ciclos regulares assumem. Fix v5.14: guard `isFirstEver` corrigido no `onSuccess` para evitar sessões duplicadas. |
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

#### Comportamento de Ativação/Desativação da IA (v2026-02-19)

- **Ativação:** Toda ativação do toggle de IA dispara o **Motor Estrategista** (`ads-autopilot-strategist` com trigger `start` e `target_account_id`/`target_channel`), executando análise profunda completa: produtos, campanhas existentes, públicos, métricas, links da loja, instruções do usuário → monta plano estratégico → cria campanhas/criativos se necessário → envia para aprovação. Não há distinção entre primeira vez e reativação — ambas executam ciclo estratégico completo.
- **Motor chamado:** `ads-autopilot-strategist` v1.5.0+ (aceita `target_account_id` para focar em conta específica)
- **Resolução de URL (v1.5.0):** A URL da loja é resolvida exclusivamente via `tenant_domains` (type=`custom`, is_primary=`true`). A coluna `tenants.custom_domain` **NÃO existe** e não deve ser usada. Fallback: `{slug}.comandocentral.com.br`.
- **Catálogo (v1.5.0):** Produtos são carregados de `products` (sem coluna `images`). Imagens são carregadas separadamente de `product_images` com `sort_order`. Cada produto no contexto inclui `images[]` (até 3) e `product_url`.
- **Desativação:** Ao tentar desativar, um `AlertDialog` exibe aviso: "Ao ativar novamente, a IA fará uma varredura completa, re-analisando 7 dias de dados e podendo reestruturar campanhas." O usuário deve confirmar para prosseguir.
- **Motivo:** Garante que o usuário esteja ciente de que reativações não são "continuações suaves", e sim re-análises completas do estado da conta.
- **Insight body:** Texto completo salvo sem truncamento (`.slice(0, 500)` removido em v5.13.0).

#### Smart Creative Reuse — Reutilização Inteligente de Criativos (v1.28.0)

O Motor Estrategista implementa reutilização de criativos em **2 camadas** para evitar geração redundante de imagens:

##### Camada 1 — Inventário no Prompt (Fase 1)

Antes de executar a Fase 1 (`implement_approved_plan`), o sistema:

1. Carrega **TODOS** os criativos existentes do tenant (`status=ready`, com `asset_url`, limite 200)
2. Cross-referencia com `meta_ad_ads` (status `ACTIVE`/`PENDING_REVIEW`/`PREAPPROVED`) para identificar quais estão em uso
3. Resolve nomes de produtos via JOIN com tabela `products` (identifica produto pelo `product_id`)
4. Injeta inventário completo no prompt via `{{EXISTING_CREATIVES_INVENTORY}}`
5. Cada criativo listado com: status (🟢 EM USO / ⚪ DISPONÍVEL), produto, funil, formato, ângulo, idade e URL

A IA recebe instrução explícita: **"NÃO gere duplicados. Reutilize criativos DISPONÍVEIS."**

Também ativado nos triggers `weekly`, `monthly` e `start`.

##### Camada 2 — Dedup no Handler `generate_creative`

Quando a IA chama `generate_creative`, o handler verifica se já existem criativos prontos para mesmo `product_id` + `funnel_stage` + `format`:

| Cenário | Comportamento |
|---------|---------------|
| Criativos existentes ≥ variações solicitadas | Retorna `reused: true` SEM gerar novas imagens |
| Criativos existentes < variações solicitadas | Gera APENAS as variações faltantes |
| Nenhum criativo existente | Gera normalmente todas as variações |

##### Identificação de Produto

A IA identifica de qual produto é cada criativo através do campo `product_id` na tabela `ads_creative_assets`. Criativos sem `product_id` são exibidos como "Multi-produto" no inventário.

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
| `create_campaign` | 2 | Criar campanha completa com 35+ parâmetros (v1.22.0): objetivo, optimization_goal, billing_event, conversion_event, performance_goal, conversion_location, attribution_model, geo_locations, placements, destination_url, ad_format, UTM params, scheduling |
| `create_adset` | 2 | Criar conjunto com 25+ parâmetros (v1.22.0): targeting completo, optimization, billing, placements, conversion_event, excluded audiences |
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

> **EXCEÇÃO — Primeira Ativação (`trigger_type: "first_activation"`):**
> Quando a IA é ativada **pela primeira vez** em uma conta (via `useAdsAccountConfigs.toggleAI`), TODAS as restrições de fase, dias mínimos de dados e contagem mínima de conversões são ignoradas. O sistema dispara syncs em paralelo e prossegue com a análise imediatamente:
> 1. **Sync de campanhas** — `meta-ads-campaigns` (action: sync, ad_account_id: target) — **fire-and-forget**
> 2. **Sync de insights 7d** — `meta-ads-insights` (action: sync, date_preset: last_7d, ad_account_id: target) — **fire-and-forget**
> 3. **Sync de ad sets** — `meta-ads-adsets` (action: sync, ad_account_id: target) — **fire-and-forget**
>
> **⚠️ FIRE-AND-FORGET (v5.7.0):** Os syncs são disparados sem `await` para evitar timeout da edge function principal. A análise prossegue imediatamente com os dados já existentes no banco. Os syncs executam em background e os dados estarão atualizados para o próximo ciclo de 6h.
>
> **⚠️ ESCOPO POR CONTA (v5.6.0):** Todos os syncs são escopados ao `target_account_id` específico — nunca sincroniza todas as contas do tenant simultaneamente. Isso é crítico para tenants com muitas contas/campanhas (ex: 277+ campanhas).
>
> Isso garante que contas com dados históricos no Meta (mas sem dados locais) possam receber reestruturação completa na ativação.
>
> **⚠️ EVENTO ÚNICO (v5.3.1):** O `first_activation` só dispara na **primeira vez** que a IA é habilitada para uma conta. Se o usuário desativar e reativar a IA, o toggle simplesmente liga/desliga sem re-executar o sync pesado nem o bypass de fases — os ciclos regulares de 6h assumem o controle. A lógica detecta "primeira vez" verificando se `is_ai_enabled` nunca foi `true` antes (registro inexistente = primeira vez, `is_ai_enabled: false` em registro existente que já foi `true` = reativação normal).
>
> **Race Condition Fix (v5.3.0):** O `AdsManager.tsx` NÃO dispara `triggerAnalysis.mutate()` separado ao ativar IA — apenas `useAdsAccountConfigs.toggleAI` dispara `first_activation`. Isso evita que um trigger `manual` adquira o lock antes do `first_activation`.

### Guardrails

- **Lock por tenant:** `lock_session_id` impede sessões concorrentes (expira em 10 min)
- **Idempotência:** `action_hash` UNIQUE (`session_id + action_type + target_id`)
- **Policy Layer:** Validação determinística antes de qualquer execução
- **Nunca deletar:** Só pausar campanhas
- **CPA baseado em margem:** Não em ticket médio
- **Kill Switch:** Verificado no início de cada ciclo (global e por conta)
- **Human Approval:** Ações high-impact ficam como `pending_approval` quando configurado

### Budget Guard com Reserva (v5.12.8)

O Budget Guard impede que o somatório de campanhas ativas + propostas pendentes exceda o `budget_cents` da conta.

#### Lógica (`checkBudgetGuard` em `ads-autopilot-analyze`)

| Componente | Fonte | Descrição |
|---|---|---|
| `active_allocated_cents` | `meta_ad_campaigns` WHERE `[AI]%` AND `ACTIVE` | Soma dos orçamentos diários de campanhas IA ativas |
| `pending_reserved_cents` | `ads_autopilot_actions` WHERE `pending_approval` AND `create_campaign` AND `channel=meta` AND `created_at > now()-24h` | Soma dos orçamentos de propostas pendentes (TTL 24h) |
| `limit_cents` | `ads_autopilot_account_configs.budget_cents` | Limite configurado pelo usuário |
| `remaining_cents` | `limit - active - pending_reserved` | Saldo disponível para novas propostas |

**Regra**: Se `proposed_budget > remaining_cents`, a proposta é rejeitada com mensagem contendo breakdown completo (ativo/reservado/restante/limite).

#### TTL de Reservas

Propostas `pending_approval` com `created_at < now() - 24h` são consideradas expiradas e não contam no `pending_reserved_cents`.

#### Deduplicação por Funil

Máximo **1 proposta pendente** por `(tenant_id, ad_account_id, funnel_stage)`. Se já existir `pending_approval` para o mesmo funil, a nova proposta é rejeitada com: "Já existe proposta pendente para este funil."

#### Budget Snapshot no Preview

Toda proposta `create_campaign` inclui em `action_data.preview.budget_snapshot`:

```jsonc
{
  "active_cents": 0,
  "pending_reserved_cents": 37500,
  "remaining_cents": 12500,
  "limit_cents": 50000
}
```

#### Revalidação na Aprovação (`ads-autopilot-execute-approved`)

Antes de executar uma ação aprovada:
1. Recalcula `getBudgetSnapshot` **excluindo a própria ação** do `pending_reserved`
2. Se `active + pending_excl_self + proposed > limit`: bloqueia e marca como `rejected`
3. Mensagem: "Aprovar esta campanha excederia o limite diário. Ajuste orçamento ou rejeite outra proposta."

#### Execução Direta na Meta (v3.0.0)

A edge function `ads-autopilot-execute-approved` realiza chamadas **diretas** às APIs nativas da Meta, **sem passar pelo loop de análise da IA**. A partir da v3.0.0, todos os parâmetros técnicos (targeting, posicionamentos, otimização, lance, conversão, destino) são **propagados dinamicamente** da `action_data` gerada pelo Motor Estrategista, sem valores hardcoded.

| Etapa | Ação | Detalhes |
|---|---|---|
| 1 | Criar Campanha | `POST /{ad_account_id}/campaigns` com nome, objetivo, `special_ad_categories` e scheduling nativo |
| 2 | Criar AdSet | `POST /{ad_account_id}/adsets` com targeting completo (`geo_locations`, `interests`, `behaviors`, `excluded_audiences`, `publisher_platforms`, `position_types`, `device_platforms`), `optimization_goal`, `billing_event`, `conversion_event` (promoted_object) e `bid_amount_cents` |
| 3 | Upload de Imagem | `POST /{ad_account_id}/adimages` com URL do criativo |
| 4 | Criar Anúncio | `POST /{ad_account_id}/ads` com `ad_creative_id`, `destination_url` + UTM params e `status` scheduling |

**Regras:**
- Toda a cadeia (Campanha → AdSet → Ad) usa scheduling nativo: dentro da janela 00:01-04:00 BRT → `ACTIVE` imediato; fora → `ACTIVE` + `start_time` futuro (aparece como "Programada" no Meta Ads Manager)
- Revalidação de orçamento é feita **no momento da execução** (não no momento da aprovação)
- Se qualquer etapa falhar, o erro é registrado e o status da ação é marcado como `error`
- IDs da Meta (`meta_campaign_id`, `meta_adset_id`, `meta_ad_id`) são registrados em `rollback_data` para reversão futura
- **Fallbacks**: Campos não especificados pela IA usam defaults sensatos (`geo_locations` → `{countries: ["BR"]}`, `billing_event` → `"IMPRESSIONS"`, `conversion_event` → inferido do objetivo)

#### Filtragem de Insights (v2.0.0)

Insights gerados pela IA (`report_insight`) são filtrados para remover "context dumps" técnicos. A IA é instruída a:
- **NÃO** incluir diagnósticos técnicos (IDs, logs, snapshots de contexto) nos insights
- Focar em recomendações **acionáveis** para o lojista
- Usar linguagem de negócios (ROI, vendas, público) em vez de jargão técnico

### Fluxo de Aprovação — UI Redesenhada (v5.15.0)

O card de aprovação (`ActionApprovalCard.tsx`) prioriza informações visuais para o usuário aprovar com segurança.

#### Dois Cenários de Aprovação

| Cenário | Componente | Descrição |
|---|---|---|
| **Campanha Nova** | `ActionApprovalCard` com `childActions` | Card mostra campanha + todos os adsets aninhados + galeria de criativos |
| **Campanha Existente** | `OrphanAdsetGroupCard` | Adsets sem `create_campaign` correspondente são agrupados por `campaign_name`/`parent_campaign_name` e exibidos com badge "Campanha existente", criativos do produto e detalhes de targeting |

**Lógica de agrupamento:**
1. Ações `create_adset` com `campaign_name` que corresponda a um `create_campaign` pendente → aninhadas dentro do card da campanha
2. Ações `create_adset` com `campaign_name` que NÃO corresponda a nenhum `create_campaign` pendente → agrupadas por `campaign_name` em `OrphanAdsetGroupCard`
3. Aprovação/rejeição/ajuste em `OrphanAdsetGroupCard` aplica-se a todos os adsets do grupo simultaneamente

#### Visível por padrão

| Elemento | Fonte (`action_data.preview.*`) |
|---|---|
| Galeria de criativos (horizontal scroll) | `useAllCreativeUrls` → `ads_creative_assets` por `product_id` + fallback `product_images` |
| Headline + variações de copy | `headlines[]`, `primary_texts[]`, `descriptions[]` |
| CTA badge | `cta_type` |
| Produto (nome + preço) | `product_name`, `product_price_display` |
| Funil (chip colorido) | `funnel_stage` → "Público Frio" / "Remarketing" / "Teste" |
| Público resumido | `targeting_summary` |
| Orçamento/dia | `daily_budget_cents` formatado |
| Barra de orçamento visual | `budget_snapshot` (verde=ativo, amarelo=reservado, cinza=restante) |
| Conjuntos aninhados (expansível) | `AdSetsSection` com targeting e audiences |
| Botões | Aprovar (com loading per-card) / Ajustar / Rejeitar |

#### Loading per-card (v5.15.1)

Os botões de Aprovar/Rejeitar utilizam estado **per-card** (`approvingId`/`rejectingId`) em vez de boolean global. Ao clicar em "Aprovar" em um card:
- Apenas aquele card exibe spinner `Loader2` + texto "Aprovando..."
- Os demais cards ficam com botões desabilitados mas sem spinner
- O estado é limpo via `onSettled` da mutation (sucesso ou erro)

#### Oculto (Collapsible "Detalhes técnicos")

- `confidence`, `reasoning`, `expected_impact`
- `session_id`, `trigger_type`, tags internas
- IDs, payloads, dados brutos

#### Barra de Orçamento Global (`AdsPendingActionsTab.tsx`)

No topo da lista de ações pendentes, um `BudgetSummaryHeader` exibe:
- Ativo (verde) | Reservado (amarelo) | Restante (cinza)
- Limite/dia
- Fonte: `budget_snapshot` da primeira ação pendente

#### Arquivos

| Arquivo | Descrição |
|---|---|
| `src/components/ads/ActionApprovalCard.tsx` | Card de aprovação com galeria de criativos, adsets aninhados e `OrphanAdsetGroupCard` para campanhas existentes |
| `src/components/ads/AdsPendingActionsTab.tsx` | Lista de ações pendentes com agrupamento de adsets órfãos por campanha-pai |
| `src/components/ads/AdsPendingApprovalTab.tsx` | Aba "Aguardando Ação" com mesmo agrupamento |
| `src/hooks/useAdsPendingActions.ts` | Hook para CRUD de ações pendentes (approve/reject) |

### Arquitetura Dual-Motor (v6.0)

O sistema opera através de **dois motores independentes** para garantir separação entre proteção de orçamento e implementação estratégica:

#### Motor 1 — Guardião (Diário)

Edge function: `ads-autopilot-guardian`

| Horário (BRT) | Ação | Detalhes |
|---|---|---|
| **12:00** | 1ª análise do dia | Avalia todas as campanhas ativas. Se ok → mantém. Se ruim → pausa imediata |
| **13:00** | Reativação | Reativa campanhas pausadas às 12h para reteste |
| **16:00** | Reavaliação | Se campanha reativada ainda está ruim → pausa até 00:01 |
| **00:01** | Execução noturna | Reativa pausas do dia anterior + aplica ajustes de budget agendados |

**Escopo**: Apenas campanhas **já existentes**. O Guardião **NUNCA** cria campanhas, criativos ou públicos.

**Ações permitidas**: `pause_campaign`, `activate_campaign` (reativação), `adjust_budget` (agendado), `report_insight`

#### Motor 2 — Estrategista (Start / Semanal / Mensal)

Edge function: `ads-autopilot-strategist`

| Trigger | Quando | Pipeline |
|---|---|---|
| **Start (1ª ativação)** | Imediato ao ativar IA | Pipeline completo: Planejamento → Criativos → Públicos → Montagem → Agenda Dom 00:01 |
| **Semanal** | Todo **sábado** | Mesmo pipeline. Ajustes entram em vigor **Domingo 00:01** |
| **Mensal** | **Dia 1** do mês | Análise macro do mês anterior. Avalia se estratégia está funcionando ou precisa ajustar |

**Pipeline obrigatório (em fases com dependências)**:
1. **Fase 0 — Planejamento**: IA analisa orçamento + configs + produtos + dados históricos → define plano (quais campanhas, públicos, criativos)
2. **Fase 1 — Criativos**: Gera imagens + copys para cada campanha planejada
3. **Fase 2 — Públicos**: Cria/seleciona audiences (Lookalike, Custom, Interesses)
4. **Fase 3 — Montagem**: Cria Campanha → Ad Set → Ad (tudo PAUSED). Só executa se Fase 1 e 2 completas
5. **Fase 4 — Publicação**: Agenda ativação para 00:01 BRT. Só agenda se cadeia completa (Campaign + AdSet + Ad)

**Escopo**: Criação de novas campanhas, criativos, públicos e reestruturação.

**Ações permitidas**: Todas (pause, adjust_budget, create_campaign, create_adset, generate_creative, create_lookalike_audience, report_insight)

#### Métricas Expandidas (v1.35.0+ — Aplicadas a TODOS os triggers)

O Motor Estrategista coleta e injeta no prompt as seguintes métricas para cada campanha, em janelas de 30d e 7d:

| Métrica | Campo Meta | Interpretação |
|---------|-----------|---------------|
| **Frequência** | `frequency` | Média de impressões/pessoa. >3 = fadiga, >5 = crítico (pausar/renovar criativo) |
| **CPM** | `cpm` | Custo por mil impressões (R$). Indica competitividade do leilão |
| **CTR** | `ctr` | Taxa de clique. <1% = criativo fraco, >2% = excelente |
| **Visualizações de Página (PV)** | `actions[landing_page_view]` | Tráfego qualificado para a página do produto |
| **Adição ao Carrinho (ATC)** | `actions[add_to_cart]` | Intenção de compra. PV alto + ATC baixo = página ruim |
| **Checkout Iniciado (IC)** | `actions[initiate_checkout]` | ATC alto + IC baixo = problema no checkout |
| **Video Views 25%** | `video_p25_watched_actions` | Retenção 25% — avalia gancho do vídeo |
| **Video Views 50%** | `video_p50_watched_actions` | Retenção 50% — avalia conteúdo intermediário |
| **Video Views 95%** | `video_p95_watched_actions` | Retenção 95% — VV25 alto + VV95 baixo = gancho bom, conteúdo fraco |

Essas métricas são aplicadas no Deep Historical (lifetime), análises mensais (30d) e semanais (7d).

#### Escopo por Trigger (v1.36.0 — REGRA INVIOLÁVEL)

| Funcionalidade | Start (1ª ativação) | Monthly (Mensal) | Weekly (Semanal) |
|---------------|---------------------|------------------|------------------|
| Métricas expandidas | ✅ Todas | ✅ Todas | ✅ Todas |
| Deep Historical (lifetime) | ✅ Obrigatório | ❌ Não consulta | ❌ Não consulta |
| Estratégia de Replicação Inteligente | ✅ Obrigatória (4 níveis) | ❌ Não aplicável | ❌ Não aplicável |
| Liberdade para testar novos públicos | ❌ Prioriza histórico | ✅ Total | ✅ Total |
| Janela de dados | Lifetime | Últimos 30 dias | Últimos 7 dias |

#### Estratégia de Replicação Inteligente (v1.35.0 — SOMENTE trigger `start`)

Em contas com histórico de campanhas, a IA segue hierarquia obrigatória de 4 níveis na primeira ativação:

| Nível | Nome | Descrição |
|-------|------|-----------|
| 1 (Máxima) | **Duplicação Exata** | Reviver assets pausados com ROAS ≥ meta (mesma config, ajustar budget/datas) |
| 2 | **Replicação com Variação** | Usar criativos/copys com CTR >2% como referência para novas variações |
| 3 | **Expansão de Público** | Testar anúncios vencedores em públicos similares/novos |
| 4 (Último recurso) | **Teste Genuíno** | Criar do zero APENAS se não houver histórico suficiente |

**Regra de Ouro**: Antes de propor QUALQUER campanha nova, verificar se já existe algo similar no histórico que pode ser duplicado ou adaptado. Testar do zero em uma conta com centenas de campanhas é desperdício.

> **IMPORTANTE**: Nas análises mensais e semanais, a IA tem liberdade total para testar novos públicos, copys e criativos, usando as métricas disponíveis para decisões baseadas em dados recentes — sem obrigatoriedade de replicar histórico.

#### Chat de IA de Tráfego (v6.0)

Interface de chat dedicada para interação direta com a IA de tráfego, **separada do Auxiliar de Comando**.

| Nível | Localização | Contexto |
|---|---|---|
| **Por conta** | Sub-tab "Chat IA" dentro de cada canal (Meta/Google/TikTok) | Dados daquela conta específica (campanhas, insights, configurações) |
| **Global** | Tab mãe "Chat IA" ao lado de Insights | Dados cross-account (todas as contas, métricas globais) |

##### Tabelas

| Tabela | Campos Chave | RLS |
|---|---|---|
| `ads_chat_conversations` | `id`, `tenant_id`, `scope` (global/account), `ad_account_id`, `channel`, `title`, `created_by` | SELECT/INSERT/UPDATE/DELETE via `user_roles.tenant_id` |
| `ads_chat_messages` | `id`, `conversation_id`, `tenant_id`, `role` (user/assistant/system), `content`, `tool_calls`, `tool_results` | SELECT/INSERT via `user_roles.tenant_id` |

> **Realtime habilitado** em ambas as tabelas para atualização em tempo real.

##### Edge Function: `ads-chat` (v5.35.0)

| Campo | Valor |
|---|---|
| **Rota** | `POST /ads-chat` |
| **Modelo** | `google/gemini-3-flash-preview` (via Lovable AI Gateway) |
| **Streaming** | SSE (`text/event-stream`) com header `X-Conversation-Id` |
| **Autenticação** | Bearer token (validação via `userClient.auth.getUser()`) |
| **Context Collector** | Store info, account configs, recent actions (20), open insights (10), Meta campaigns (30), Meta insights 7d (200), top products (10), order stats 30d |

##### System Prompt

A IA atua como "consultor sênior de tráfego pago" com acesso a:
- Configurações de cada conta (ROI, orçamento, estratégia)
- Campanhas ativas/pausadas com métricas
- Vendas dos últimos 30 dias (receita, ticket médio)
- Ações recentes do Motor Guardião/Estrategista
- Insights abertos

**Regras do prompt**: Markdown obrigatório, respeitar limites de budget por plataforma, nunca sugerir deletar (apenas pausar), diferenciar público frio/quente, responder em PT-BR.

##### Regras de Dados em Tempo Real (v5.24.0–v5.35.0)

| Regra | Descrição |
|---|---|
| **Fonte de Dados Live-First** | `fetchMetaCampaignsLive()` consulta diretamente a Meta Graph API (`/act_{id}/campaigns`) com paginação total. O banco local (`meta_ad_campaigns`) é usado apenas como fallback. |
| **Default LIFETIME** | `getCampaignPerformance` usa `date_preset=maximum` por padrão quando nenhum parâmetro de tempo é informado. Busca dados desde a criação da conta. |
| **MAX Value Deduplication (v5.28.0)** | O parser de conversions itera todos os 8 action_types de purchase (`omni_purchase`, `purchase`, `offsite_conversion.fb_pixel_purchase`, etc.) e usa o que tiver o **MAIOR valor** (`if (val > conversions) conversions = val`). **NUNCA soma** tipos diferentes (causa inflação 2x-6x). **NUNCA usa prioridade fixa** (causa subestimação quando `omni_purchase` é menor que `purchase`). |
| **Paginação de Insights** | `fetchMetaInsightsLive` pagina até 15 páginas com delay de 2s entre páginas e retry automático para HTTP 429. |
| **Nomes Exatos** | A IA é proibida de inventar, abreviar ou modificar nomes de campanhas. Deve usar strings exatas retornadas pela API. |
| **Análise de Imagens** | O chat suporta Ctrl+V para colar screenshots do Gerenciador de Anúncios. Imagens são enviadas como attachments multimodais para validação cruzada dos dados. |
| **Fluxo de Targeting Sync & Cache (v5.31.0–v5.32.0)** | Para consultar targeting/segmentação: **Passo 1** — `get_meta_adsets` (DB, sem live=true) para obter IDs dos adsets. **Passo 2** — `get_adset_targeting` com IDs específicos (até 20 por vez) para buscar targeting completo da Meta API. Resultados são automaticamente cacheados no `meta_ad_adsets` via upsert JSONB. **NUNCA usar `get_meta_adsets(live=true)`** em contas grandes. |
| **tool_choice Inteligente (v5.35.0)** | A chamada inicial agora usa `tool_choice` baseado na mensagem do usuário: `"required"` para mensagens que pedem dados (targeting, performance, campanhas, "tente novamente") e `"auto"` para perguntas gerais. Isso força o modelo a chamar ferramentas em vez de gerar texto descritivo. |
| **Sanitização de Histórico (v5.35.0)** | Mensagens de filler salvas no histórico da conversa são **removidas automaticamente** antes de enviar ao modelo. Isso previne o "efeito espelho" onde o modelo replica padrões de filler de mensagens anteriores. 12 padrões de detecção são usados para filtrar. |
| **Anti-Filler DUAL v5.35.0** | **24+ padrões** de detecção de filler com **fallback multi-provedor**: (1) Detecta filler na resposta inicial e dentro do tool loop. (2) Ao detectar, faz retry com mensagens limpas (apenas system prompt + última mensagem do usuário + instrução direta). (3) Se o provedor primário (Gemini) falhar no retry, tenta automaticamente com OpenAI (`gpt-5-mini`) como fallback. (4) Se ambos falharem, retorna mensagem de erro honesta pedindo nova conversa — **NUNCA envia o texto filler ao usuário**. (5) O retry agora usa TransformStream para enviar progress events (SSE) ao frontend, mantendo o indicador de carregamento ativo. |

##### Ferramentas de Targeting (v5.32.0)

| Ferramenta | Descrição | Parâmetros |
|---|---|---|
| `get_meta_adsets` | Lista adsets do banco local (rápido, para obter IDs). NÃO usar live=true para targeting. | `ad_account_id?`, `status?`, `campaign_id?`, `live?` |
| `get_adset_targeting` | Busca targeting detalhado de adsets específicos direto da Meta API. Cache automático no DB. Retry automático em 429. | `adset_ids` (array, max 20), `ad_account_id?` |

**Dados retornados pelo targeting:**
- `custom_audiences` — públicos personalizados (nome + ID)
- `excluded_audiences` — públicos excluídos
- `geo` — países, regiões, cidades com raio
- `age` — faixa etária (ex: "25-55+")
- `gender` — Masculino/Feminino/Todos
- `interests` — interesses (ex: "Cabelo", "Beleza")
- `behaviors` — comportamentos
- `demographics` — dados demográficos detalhados
- `exclusions` — interesses/comportamentos excluídos
- `placements` — plataformas (facebook, instagram, audience_network)
- `advantage_plus` — indicação de targeting aberto/Advantage+

##### Regras de Matching de Produto (v1.14.0 / v5.13.0 — ATUALIZADO)

O matching de produto em TODAS as funções do Autopilot é **ESTRITAMENTE EXATO** (`===` com `.trim()`):

- **NÃO há fuzzy matching** — sem `startsWith`, sem `includes`, sem case-insensitive
- **NÃO há fallback** — se o nome não bater exatamente, o produto NÃO é vinculado
- **Responsabilidade do usuário** — o lojista DEVE informar o nome exato do produto no Prompt Estratégico ou ao conversar com a IA
- **`extractPriorityProducts` (analyze)** — busca case-sensitive do nome completo do produto dentro das `user_instructions`
- **`create_campaign` (strategist)** — `p.name.trim() === args.product_name.trim()`, sem fallback

> **REGRA ABSOLUTA**: A IA deve usar o nome **EXATO** do produto conforme retornado por `get_catalog_products`. NÃO abreviar, NÃO generalizar, NÃO usar "contém". Produtos com nomes similares (ex: "Shampoo Calvície Zero" e "Shampoo Calvície Zero (2x)") são tratados como produtos DIFERENTES. Se o match falhar, um warning é logado e o produto fica sem vínculo.

##### Regra de Autonomia Multi-Rodada (v5.9.8)

A IA usa rounds internos (1-5) **automaticamente** para completar todo o plano sem pedir ao lojista para dizer "continuar":

- **Round 1**: Geração de imagens (`generate_creative_image`)
- **Round 2+**: Criação de campanhas (`create_meta_campaign`) — máximo 2 por round
- **Transição entre rounds**: Automática. A IA informa o progresso ("✅ Criei 2 de 5, continuando...") e prossegue

> **EXCEÇÃO**: A IA só pausa e pede confirmação quando o **próprio lojista** solicitar acompanhamento passo-a-passo (ex: "me avise quando terminar cada etapa", "faça isso e quando terminar me avise"). Fora isso, execução autônoma e contínua.

##### Arquivos

| Arquivo | Propósito |
|---|---|
| `supabase/functions/ads-chat/index.ts` | Edge function com streaming SSE |
| `src/hooks/useAdsChat.ts` | Hook com gerenciamento de conversas, streaming e realtime |
| `src/components/ads/AdsChatTab.tsx` | UI com sidebar de conversas + área de chat com Markdown |

##### Diferenças do Auxiliar de Comando

| Aspecto | Auxiliar de Comando | Chat de Tráfego |
|---|---|---|
| **Escopo** | Todo o sistema (produtos, pedidos, categorias, cupons, etc.) | Apenas tráfego pago (campanhas, orçamento, ROI) |
| **Ações executáveis** | CRUD em todo o e-commerce | Nenhuma ação direta (consultivo) |
| **Tabelas** | `command_conversations`, `command_messages` | `ads_chat_conversations`, `ads_chat_messages` |
| **Edge Function** | `command-assistant-chat` + `command-assistant-execute` | `ads-chat` (somente chat) |
| **Modelo IA** | Configurável | `google/gemini-3-flash-preview` |
| **Contexto** | Genérico do tenant | Profundo de tráfego (campanhas, insights, métricas) |

### Limites de Budget por Plataforma (v6.0)

| Plataforma | Limite Seguro por Ajuste | Intervalo Mínimo entre Ajustes | Fonte |
|---|---|---|---|
| **Meta** | ±20% | 48h | Meta Marketing API docs + best practices |
| **Google** | ±20% | 7 dias | Google Ads Support |
| **TikTok** | ±15% | 48h | TikTok Ads best practices |

> **Regra**: Mudanças >20% são "significant edits" e resetam a learning phase.
> **Agendamento**: Todos os ajustes de budget são agendados para **00:01 BRT** do próximo dia válido (respeitando o intervalo mínimo).
> **Registro**: O campo `last_budget_adjusted_at` na tabela `ads_autopilot_account_configs` rastreia o último ajuste para garantir o intervalo.

### Regras de Pausa — Motor Guardião (v6.0)

O Guardião implementa um ciclo diário de proteção:

| Horário BRT | Condição | Ação | metric_trigger |
|---|---|---|---|
| 12:00 | Campanha com ROI ruim | Pausa imediata | `guardian_12h_pause` |
| 13:00 | Campanha pausada às 12h | Reativa para reteste | `guardian_13h_retest` |
| 16:00 | Reteste falhou (ainda ruim) | Pausa até 00:01 | `guardian_16h_pause_eod` |
| 00:01 | Campanha pausada no dia anterior | Reativa + aplica budgets | `guardian_00h_reactivation` |

#### Critérios de "Ruim"
- ROI < mínimo configurado (cold ou warm conforme público)
- CPA > 2x do alvo
- CTR < 0.3% por 3+ dias

#### Pausa Indefinida (legacy mantido)
Campanhas que falham repetidamente após 2 ciclos de reteste → pausa indefinida (`pause_indefinite`), requer intervenção manual.

> **Nota anterior (v5.6):** As regras de pausa por timing de 3d/7d são agora implementadas pelo Motor Estrategista na análise semanal. O Guardião foca no controle diário intraday.

### Hierarquia Prompt vs Configurações Manuais (v5.6)

O prompt estratégico (`user_instructions`) é **sugestivo**:
- Se houver conflito entre o prompt e configurações manuais (ROI, orçamento, estratégia, splits), as **configurações manuais SEMPRE prevalecem**
- A IA exibe aviso no sistema de que as instruções são sugestivas e não sobrepõem configs numéricas

### Preview de Ações (ActionDetailDialog)

Cada ação da IA na aba "Ações" é **clicável** e abre um `Dialog` com preview estruturado completo. O componente `ActionDetailDialog.tsx` renderiza previews específicos por tipo:

| Tipo de Ação | Preview Estruturado |
|---|---|
| `create_campaign` | Nome, objetivo, status, orçamento diário, conjuntos de anúncios (com segmentação) e anúncios (headline, copy, CTA) |
| `create_adset` | Nome, campanha, orçamento, otimização, segmentação detalhada (idade, gênero, geo, interesses, Custom/Lookalike Audiences), agendamento |
| `generate_creative` | Produto, canal, formato, variações, estilo de geração, pasta de destino, objetivo e público-alvo. **Preview de imagens geradas** (v5.9.8): busca `creative_jobs.output_urls` quando `job_id` presente, com auto-refresh a cada 5s durante processamento e fallback visual para estados de erro |
| `adjust_budget` / `allocate_budget` | Entidade, orçamento anterior vs novo, variação % |
| `pause_campaign` | Nome, gasto atual, economia/dia estimada |
| `report_insight` | Corpo do insight, categoria, prioridade |
| Outros | JSON formatado (fallback) |

**Componentes internos:**
- `CampaignPreview` — Preview hierárquico (campanha → adsets → ads)
- `AdsetPreview` — Conjunto com `TargetingPreview` integrado
- `CreativePreview` — Com detalhes enriquecidos (produto, canal, formato, variações, estilo, pasta). **v5.9.8**: Query ao `creative_jobs` para exibir imagens prontas quando `job_id` presente (auto-refresh enquanto `running`/`pending`)
- `BudgetPreview` — Comparação antes/depois com destaque
- `PausePreview` — Economia estimada
- `TargetingPreview` — Breakdown de segmentação (interesses como badges, Custom Audiences, Lookalikes com ratio %)
- `RawDataPreview` — Fallback JSON para dados de reversão e tipos desconhecidos

**Elementos adicionais no dialog:**
- Raciocínio da IA (`reasoning`)
- Badges de confiança e métrica trigger
- Dados de reversão (`rollback_data`) em JSON
- Mensagem de erro quando aplicável

**Interação:** Card clicável + botão "Detalhes" (com `Eye` icon). Botões de ação (Aprovar/Rejeitar/Desfazer) usam `stopPropagation` para não abrir o dialog.

### Rollback / Desfazer Ações (v1.1)

O sistema permite reverter ações executadas pela IA diretamente na aba "Ações". O botão "Desfazer" aparece para ações com status `executed` dos seguintes tipos:

| Tipo de Ação | Rollback | Descrição |
|---|---|---|
| `pause_campaign` | ✅ | Reativa campanha via `meta-ads-campaigns` (update → ACTIVE) |
| `adjust_budget` | ✅ | Restaura orçamento anterior via `meta-ads-campaigns` (update → `rollback_data.previous_budget_cents`) |
| `allocate_budget` | ✅ | Restaura orçamento anterior via `meta-ads-campaigns` |
| `activate_campaign` | ✅ | Pausa campanha via `meta-ads-campaigns` (update → PAUSED) |

Após reverter, o status da ação é atualizado para `rolled_back`.

### Pasta Drive para Criativos de Tráfego (v1.1)

Todos os ativos gerados pela IA de tráfego (imagens e vídeos para campanhas) são organizados em uma pasta dedicada no Drive do tenant:

| Campo | Valor |
|---|---|
| **Nome da pasta** | `Gestor de Tráfego IA` |
| **Criação** | Automática na primeira geração de criativo |
| **Tabela** | `files` (com `is_folder=true`, `metadata.source='ads_autopilot'`) |
| **Edge Function** | `ads-autopilot-creative` v1.1.0 |

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
4. **E** o campo `start_time` é nulo **OU** está no passado (campanha já iniciou)

Campanhas com `stop_time` no passado são marcadas como **"Concluída"** mesmo que `effective_status` permaneça `ACTIVE`. Isso evita que campanhas já encerradas sejam contadas como ativas.

### Regra de Campanha Agendada (v5.10.0)

Uma campanha é considerada **agendada** na UI se:
1. `effective_status` = ACTIVE (ou ENABLE)
2. **E** `start_time` existe e está **no futuro**

Campanhas agendadas exibem bolinha **azul** e label **"Agendada"** no `StatusDot`. Elas **não** são contadas como "Ativas" nem "Pausadas", possuindo sua própria aba de filtro dedicada.

> **Agendamento Nativo Meta:** A IA cria campanhas com `status: ACTIVE` + `start_time` futuro, fazendo com que apareçam como **"Programada"** no Meta Ads Manager nativamente, sem necessidade de agendamento interno.

A condição 2 (da regra de ativa) evita que campanhas genuinamente ativas apareçam como pausadas antes da primeira sincronização de ad sets. Após o sync, a regra hierárquica se aplica normalmente.

### Arquivos Frontend

| Arquivo | Descrição |
|---------|-----------|
| `src/pages/AdsManager.tsx` | Página principal com 3 abas mãe (Visão Geral / Gerenciador / Insights) e hooks de conexão por canal |
| `src/hooks/useAdsAutopilot.ts` | Hook para configs, actions, sessions. Interface `AutopilotConfig` inclui campos v4.0 (`total_budget_cents`, `total_budget_mode`, `channel_limits`, `strategy_mode`, `funnel_split_mode`, `funnel_splits`, `kill_switch`, `human_approval_mode`) |
| `src/hooks/useAdsAccountConfigs.ts` | **NOVO v4.0 Sprint 3** — Hook CRUD para tabela normalizada `ads_autopilot_account_configs`. Inclui `toggleAI`, `toggleKillSwitch`, `saveAccountConfig` e validação `isAccountConfigComplete` |
| `src/hooks/useAdsInsights.ts` | **NOVO v4.0** — Hook para CRUD de insights (listar, marcar done/ignored, gerar manual) |
| `src/hooks/useMetaAds.ts` | Hook para campanhas, ad sets, insights, saldo e sync (Meta) |
| `src/components/ads/AdsOverviewTab.tsx` | **NOVO v4.0** — Dashboard cross-channel com seletor de plataforma (Meta/Google/TikTok), métricas agregadas, pacing mensal e breakdown por canal. Usa `DateRangeFilter` padrão |
| `src/components/ads/AdsInsightsTab.tsx` | **NOVO v4.0** — Feed de insights com filtros, ações "Vou fazer"/"Ignorar" e histórico colapsável |
| `src/components/ads/AdsAccountConfig.tsx` | **Refatorado v4.0 Sprint 3** — Config por conta com Estratégia, Splits de Funil, Modo de Aprovação, Kill Switch e validação obrigatória |
| `src/components/ads/AdsChannelIntegrationAlert.tsx` | Alerta de integração por canal com chips de seleção de contas |
| `src/components/ads/AdsCampaignsTab.tsx` | Campanhas por canal com 28 métricas disponíveis, rodapé com totais agregados (TableFooter), `DateRangeFilter` padrão e **ROAS com cores dinâmicas** baseadas em metas por conta (🔴 abaixo min_roi_cold, 🟡 abaixo target_roi, 🟢 na meta, 🔵 acima de 150% da meta) |
| `src/components/dashboard/AdsAlertsWidget.tsx` | **NOVO Sprint 8** — Widget "Gestor de Tráfego" na Central de Execuções com alertas de insights não lidos e saldo baixo/zerado |
| `src/hooks/useAdsBalanceMonitor.ts` | Hook de monitoramento de saldo. Threshold R$50. Exclui contas CC. Diferencia prepaid vs cartão via `funding_source_type` |
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
| **Filtro por status** | ToggleGroup com 4 opções: Todas (total), Ativas (ACTIVE + adset ativo + não agendada), Agendadas (ACTIVE + `start_time` futuro — bolinha azul), Pausadas (PAUSED/DISABLE/ARCHIVED — exclui agendadas) — cada uma com badge de contagem |
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

### Edge Function `meta-ads-insights` (v1.7.0)

| Item | Descrição |
|------|-----------|
| **Query de conexão** | Usa `marketplace_connections` com filtro `marketplace='meta'` e `is_active=true` |
| **Multi-account** | Itera por **todas** as contas de anúncio (não apenas a primeira) |
| **Campos da API** | `campaign_id, campaign_name, impressions, clicks, spend, reach, cpc, cpm, ctr, actions, action_values, cost_per_action_type, frequency` |
| **Conversões** | Extrai `actions[purchase/omni_purchase/offsite_conversion.fb_pixel_purchase]` para contagem e `action_values[purchase/omni_purchase]` para valor monetário (`conversion_value_cents`) |
| **ROAS** | Calculado como `conversion_value_cents / spend_cents` |
| **Auto-create campaigns** | Se um insight referencia uma `meta_campaign_id` que não existe localmente, cria automaticamente um registro placeholder com `status: UNKNOWN` (corrigido na próxima sincronização de campanhas) — evita dados órfãos |
| **Ações** | `sync` (pull insights da Meta), `list` (cache local), `summary` (métricas agregadas) |

#### Paginação Completa (v1.7.0)

A função agora suporta **paginação completa** da Meta Graph API, iterando `paging.next` até 50 páginas (25.000 rows) por chamada. Anteriormente limitava-se à primeira página (500 rows), causando perda massiva de dados em contas com alto volume.

| Parâmetro | Valor |
|-----------|-------|
| **MAX_PAGES** | 50 (por chunk) |
| **Rows por página** | ~500 (padrão Meta) |
| **Máximo teórico** | 25.000 rows por chunk |

#### Chunked Fallback para Dados Históricos (v1.5.0+)

Quando o `date_preset: "maximum"` falha (Meta rejeita com "Please reduce the amount of data"), a função ativa fallback automático:

1. Busca a campanha mais antiga do tenant (filtro `start_time > 2010-01-01` para excluir epoch 0)
2. Divide o período em **chunks trimestrais** (90 dias cada)
3. Busca cada chunk individualmente com paginação completa
4. **Upsert por chunk** — salva no banco após cada chunk para evitar perda por timeout

| Parâmetro | Valor |
|-----------|-------|
| **Limite histórico Meta** | 37 meses |
| **Tamanho do chunk** | 90 dias |
| **Upsert** | Imediato após cada chunk (não acumula tudo) |

#### Cache de Campanhas (v1.7.0)

Cache em memória (`campaignCache`) mapeia `meta_campaign_id → id` para eliminar lookups N+1 durante upserts em lote. Populado uma vez por conta antes do processamento.

#### Batch Upsert (v1.7.0)

Upserts são feitos em lotes de **100 rows** para otimizar performance no banco. Chave de conflito: `(tenant_id, meta_campaign_id, date_start, date_stop)`.

#### Granularidade de Dados

Apenas registros com `date_start === date_stop` (dados diários) são mantidos. Registros agregados multi-dia são excluídos para evitar double-counting.

### Edge Function `meta-ads-adsets` (v1.2.0)

| Item | Descrição |
|------|-----------|
| **Ações** | `sync` (com filtro opcional por `meta_campaign_id`), `update` (status/orçamento), `balance` (saldo da conta via `funding_source_details`) |
| **Balance** | Retorna `balance`, `currency`, `amount_spent`, `spend_cap`, `funding_source` e `funding_source_details` (incluindo `current_balance` para saldo real-time de contas prepaid) para cálculo preciso do saldo |
| **Mapeamento funding_source_details.type** | `1` → `CREDIT_CARD`, `2` → `DEBIT_CARD`, `20` → `PREPAID_BALANCE`, outros → `UNKNOWN` |
| **Cartão de crédito** | Quando `funding_source_type` = `CREDIT_CARD` (ou sem saldo numérico), a UI exibe **"Cartão de crédito"** em vez de valor monetário. Contas com cartão são excluídas do cálculo de "Saldo Total" |

