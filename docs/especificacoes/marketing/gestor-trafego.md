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
| `ads-autopilot-guardian` | Motor diário de proteção | Cron 4 jobs (00:01, 12:00, 13:00, 16:00 BRT) — gate `ai_traffic_manager` |
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
| `ads-autopilot-analyze` | Análise profunda de conta (coleta + diagnóstico) | Sob demanda |
| `ads-autopilot-creative-generate` | Geração de criativos via IA (copy + imagem) | Sob demanda |
| `creative-video-generate` | Geração de vídeos de produto via IA | Sob demanda |

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

**Agendamento real (cron):** quatro jobs independentes, um por ciclo BRT, todos com gate por feature `ai_traffic_manager` via `cron_call_edge_if_active`:

| Job (`cron.job.jobname`) | Schedule (UTC) | Janela BRT | Payload |
|---|---|---|---|
| `ads-autopilot-guardian-0001-brt` | `1 3 * * *` | 00:01 | `{"cycle":"00h"}` |
| `ads-autopilot-guardian-1200-brt` | `0 15 * * *` | 12:00 | `{"cycle":"12h"}` |
| `ads-autopilot-guardian-1300-brt` | `0 16 * * *` | 13:00 | `{"cycle":"13h"}` |
| `ads-autopilot-guardian-1600-brt` | `0 19 * * *` | 16:00 | `{"cycle":"16h"}` |

O parâmetro `cycle` é passado explicitamente para evitar dependência da função `detectCycle()` interna em casos de drift de horário do worker.

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


---

## 🛡️ Execution Policy Engine — Fase B (fundação estrutural)

### Propósito
A Fase B instala a **fundação técnica de segurança** entre a aprovação humana de uma ação do Ads Autopilot e a chamada real à API da plataforma (Meta/Google/TikTok). **Não ativa autonomia automática**. Não altera prompts, critérios do Guardian/Strategist/Analyze, nem a UI da fila. Toda decisão executável passa a ser auditável, reversível e idempotente.

A autonomia plena por categoria de ação fica para a **Fase C** (não implementada).

### Componentes
- **Helper compartilhado:** `supabase/functions/_shared/ads-policy.ts` — determinístico, sem LLM, sem chamada externa. Exporta `decide`, `canChangeBudget`, `canPause`, `canReactivate`, `isApprovalStillValid`, `getNextSafeWindow`, `classifyAction`, `classifyCampaign`, `buildIdempotencyKey`, `validateProposal`, `suggestStructuralExpansion`, `POLICY_ENGINE_VERSION='v1'` e `PLATFORM_LIMITS`.
- **Executor refatorado:** `ads-autopilot-execute-approved` (v4.0.0) — aplica o policy gate antes de qualquer chamada externa.
- **Runner agendado:** `ads-autopilot-scheduled-runner` — cron 5 min, processa apenas ações `policy_engine_version='v1'`.

### Limites centralizados por plataforma
| Canal  | Variação máx. por ajuste | Intervalo mínimo |
|--------|--------------------------|------------------|
| Meta   | ±20%                     | 72h              |
| Google | ±20%                     | 168h (7 dias)    |
| TikTok | ±15%                     | 48h              |

### Janela segura de execução (BRT)
Ações estruturais (criação de campanha/adset/ad/lookalike/criativo) só executam dentro de **00:01 → 04:00 BRT** (UTC-3). Fora dessa janela viram `status='scheduled'` com `scheduled_for` apontando para o próximo 00:01 BRT.

### TTLs conservadores de aprovação
| Tipo | TTL |
|------|-----|
| Visível ao cliente (criativos, novas campanhas) | 48h |
| Estratégica (orçamento, pausa, reativação)      | 24h |
| Fallback                                        | 24h |

Na Fase B o hook de aprovação aplica **default conservador de 24h** para todos os casos; refinamento por categoria entra na Fase C.

### Execução pós-aprovação
1. Hook `useAdsPendingActions.approveAction` grava `status='approved'`, `approved_at`, `approved_by_user_id`, `approval_expires_at`. **Nunca grava `executed_at` na aprovação.**
2. Hook invoca `ads-autopilot-execute-approved`.
3. Executor carrega a ação, faz stamp retroativo de aprovação se necessário, carrega snapshot mínimo da campanha alvo, monta `ActionInput` e chama `decide(...)`:
   - `execute_now` → grava `policy_check_result` + `policy_engine_version='v1'` + `idempotency_key` e segue para o caminho de execução existente, que ao final marca `status='executed'`, `executed_at=now()`.
   - `schedule(scheduled_for)` → marca `status='scheduled'`, `scheduled_for`. **Sem chamada externa.**
   - `reject_policy_limit_exceeded` → `status='rejected_policy_limit_exceeded'`. **Sem chamada externa.**
   - `reject_policy_missing_context` → `status='rejected_policy_missing_context'`. **Sem chamada externa.**
   - `expired_approval` → `status='expired_approval'`. **Sem chamada externa.**
   - `reject_duplicate` → `status='rejected_duplicate'` (detectado por violação do unique parcial).

### Regra de ouro do helper
Se faltar contexto obrigatório para decidir com segurança uma ação executável, o helper **nunca retorna `execute_now`**. Sempre retorna decisão conservadora (`reject_policy_missing_context`, `schedule`, etc.).

Checks mínimos obrigatórios para execução:
- canal/plataforma identificada (Meta/Google/TikTok);
- `action_type` identificado;
- entidade alvo quando a ação exige (`pause_*`, `reactivate_*`, `activate_*`, `adjust_budget`, etc.);
- limite da plataforma conhecido;
- janela segura calculável;
- aprovação válida quando aplicável.

Ações sem `entity_id` **não pulam** o gate automaticamente:
- `strategic_plan` é tratado como planejamento (path `non_executable_or_no_external_effect`).
- `generate_creative`, `create_campaign`, `create_ad`, `create_adset`, `create_lookalike_audience`, `adjust_budget`, `pause_*`, `reactivate_*` continuam sendo classificadas pelo `action_type` e podem ser rejeitadas por falta de contexto.

### Ações agendadas (scheduled runner)
- Cron: `ads-autopilot-scheduled-runner-5m`, a cada 5 minutos.
- Gate de módulo: `cron_call_edge_if_active(ARRAY['ai_traffic_manager'], ...)`.
- Critério: `status='scheduled' AND scheduled_for <= now() AND policy_engine_version='v1'`.
- Lock otimista: marca `status='processing_runner'` antes de tocar; instâncias concorrentes não pegam a mesma ação.
- Reaplica `decide(...)` antes de executar. Resultado:
  - `execute_now` → invoca `ads-autopilot-execute-approved` com `from_runner: true`.
  - `schedule` → adia novamente.
  - rejeições → marca status correspondente.
  - `expired_approval` → marca expirada.

### Idempotência
Estratégia escolhida (dupla proteção, **apenas para engine v1**):
1. **Coluna gerada** `action_day date GENERATED ALWAYS AS ((created_at AT TIME ZONE 'America/Sao_Paulo')::date) STORED` — imutável e indexável, evita o problema de `date_trunc` sobre `timestamptz`.
2. **Unique parcial diário:** `(tenant_id, channel, action_type, action_day, action_data->>'entity_id')` filtrado por `policy_engine_version='v1' AND status IN ('approved','scheduled','executed','auto_executed')`.
3. **Unique parcial por `idempotency_key`** (formato: `tenant:channel:action_type:entity:dia_brt`) também filtrado por `policy_engine_version='v1'`.

Motivo: violação dispara captura no executor/runner que marca `rejected_duplicate` sem chamada externa.

### Campos de auditoria (novos em `ads_autopilot_actions`)
| Campo | Propósito |
|-------|-----------|
| `scheduled_for` | Quando o runner deve executar a ação agendada. |
| `approved_at` | Quando o humano aprovou. |
| `approved_by_user_id` | Quem aprovou. |
| `approval_expires_at` | Validade da aprovação (TTL). |
| `action_class` | Classificação (Fase B = `needs_approval` por default). |
| `campaign_class_at_proposal` | Classe da campanha no momento da proposta (Fase C). |
| `policy_check_result` | Resultado completo de `decide(...)` em JSON. |
| `policy_engine_version` | `'v1'` quando processada pela nova engine. |
| `parent_action_id` | Para expansões estruturais futuras. |
| `executed_simulated` | Marca execução em modo simulado (Modo Piloto — Fase futura). |
| `auto_executed` | Reservado para Fase C (autonomia). |
| `idempotency_key` | Chave estável construída pelo helper. |
| `action_day` | Dia operacional BRT (coluna gerada). |

### Status suportados (texto livre, sem CHECK)
Continuam valendo todos os anteriores. Adicionados na Fase B:
`scheduled`, `auto_executed`, `rejected_policy_limit_exceeded`, `rejected_policy_learning`, `rejected_policy_new_campaign`, `rejected_policy_outside_sales_window`, `rejected_policy_missing_context`, `rejected_duplicate`, `expired_approval`, `processing_runner` (lock interno do runner).

Adicionado na Fase B.1: `rejected_policy_module_disabled` — usado pelo runner quando a ação não pode mais ser executada operacionalmente (ver "Gate operacional" abaixo).

### Proteção de ações legadas
- O runner agendado e os índices únicos de idempotência **filtram por `policy_engine_version='v1'`**.
- As 3 ações `status='scheduled'` legadas (criadas em fev/2026, sem `policy_engine_version`) **continuam intactas** e jamais são tocadas pela Fase B ou Fase B.1.
- Nenhuma ação histórica é reprocessada, reclassificada ou alterada por esta entrega.

---

## 🛡️ Execution Policy Engine — Fase B.1 (hardening)

Endurece a Fase B sem ativar autonomia automática e sem alterar UI/UX, prompts ou critérios do Guardian/Strategist/Analyze.

### 1. Gate operacional do runner agendado
Antes de reaplicar a `policy` ou disparar o executor, o runner valida na ordem:

1. `policy_engine_version='v1'` (já filtrado na query).
2. Aprovação ainda válida (`approval_expires_at > now`). Se expirou → `status='expired_approval'`, sem chamada externa.
3. Quando há `ad_account_id` identificável na ação, busca `ads_autopilot_account_configs` por `(tenant_id, channel, ad_account_id)`:
   - Sem registro → `policy_check_result.runner_gate.reason='account_config_missing'`.
   - `is_ai_enabled=false` → `reason='ai_disabled'`.
   - `kill_switch=true` → `reason='kill_switch_active'`.
   - Em qualquer caso de bloqueio: `status='rejected_policy_module_disabled'`, **nenhuma** chamada externa.

Quando a ação não traz `ad_account_id`, o gate por conta é pulado (default seguro: prossegue para a policy normal). Tenants sem o módulo "ai_traffic_manager" em uso não chegam a ter ações `scheduled` (não há fluxo que as crie), por isso o gate por conta cobre o caso operacional real.

### 2. Expiração de aprovações legadas no executor
O `ads-autopilot-execute-approved` ainda aceita ações `approved` antigas sem `approved_at` (compat. com fluxo pré-Fase B), mas com guarda:

- Se `created_at` ≤ 24h → stamp retroativo de `approved_at` + `approval_expires_at`.
- Se `created_at` > 24h → marca `status='expired_approval'` com `policy_check_result.reason='legacy_approval_too_old'` e **não chama API externa**.

Isso evita que aprovação parada há dias seja tratada como recém-aprovada.

### 3. Idempotência — decisão mantida
A observação da validação da Fase B (índice diário por `entity_id` literal não cobre payloads que usam só `meta_campaign_id`/`campaign_id`) foi avaliada:

- A proteção real contra duplicidade é o índice único parcial sobre `idempotency_key` (formato `tenant:channel:action_type:entity_fallback:dia_brt`), que **já normaliza** o fallback de entidade.
- O índice diário por `entity_id` literal continua útil como dedup secundária para payloads que populam `entity_id` explicitamente.
- **Decisão:** manter como está. Remover o índice diário seria perda de proteção; refinar exigiria reescrever a expressão indexada, sem ganho operacional.

### 4. Testes automatizados
Suíte Deno criada (sem chamadas externas):

- `supabase/functions/_shared/ads-policy.test.ts` (30 testes): `PLATFORM_LIMITS`, `getNextSafeWindow`/`isInsideSafeWindow` (bordas 00:01/04:00 BRT), `canChangeBudget` por canal e intervalo, `isApprovalStillValid`, `buildIdempotencyKey` (todos os fallbacks), `decide` em todos os branches.
- `supabase/functions/ads-autopilot-execute-approved/policy-gate.test.ts` (6 testes de contrato): prova que **só** `decide.kind === 'execute_now'` permite chamada externa; qualquer outra decisão retorna 0 chamadas.

Rodar: `deno test supabase/functions/_shared/ads-policy.test.ts supabase/functions/ads-autopilot-execute-approved/policy-gate.test.ts`.

### 5. O que NÃO mudou na Fase B.1
- Nenhuma autonomia automática foi ativada.
- Nenhum `autonomy_mode` foi criado; `human_approval_mode` permanece intacto.
- Nenhuma UI alterada; nenhum prompt alterado; nenhum critério de Guardian/Strategist/Analyze alterado.
- Nenhum tenant ativado; `is_ai_enabled` não foi tocado.
- Histograma horário, regra mensal, Modo Piloto/Sandbox e `pause_3d_critical`/`pause_7d_normal` continuam fora do escopo (Fase C).

### Diferença entre Fase B/B.1 (estrutural) e Fase C (autonomia)
| | Fase B + B.1 (entregues) | Fase C (não entregue) |
|---|---|---|
| Autonomia | Desligada. Toda execução continua exigindo aprovação humana. | Ações `automatic` executam sem aprovação. |
| `classifyAction` | Retorna `needs_approval` por default. | Distingue `automatic`, `needs_approval`, `emergency`, `blocked`. |
| `classifyCampaign` | `new` ou `mature` por idade simples; sem histograma. | Inclui `learning`, `low_spend`, `mature_with_hourly_history`. |
| Pause/Reactivate | Checks mínimos: canal + entidade + plataforma conhecida. | Considera Primary Sales Window e regra mensal. |
| Modo Piloto/Sandbox | Não implementado. | Implementação futura. |
| Histograma horário | Não implementado. | Implementação futura. |
| Gate operacional runner | Conta + IA + kill switch (Fase B.1). | Feature flag por tenant. |



---

## Fase C.1 — Mapa Fixo de Autonomia (entregue, autonomia ainda DESLIGADA)

A Fase C.1 implementa um **classificador determinístico** de ações do Autopilot. Toda nova ação passa a receber, no momento do registro, uma classe que orienta como ela poderá ser tratada por autonomia automática em fases futuras.

**Importante — esta fase NÃO liga autonomia.** Mesmo ações classificadas como candidatas técnicas continuam exigindo aprovação humana. A execução automática real só será habilitada em fase posterior, quando um modo de autonomia for criado e ativado explicitamente por tenant.

### As 5 classes de ação

- **`automatic_candidate`** — Ação técnica/operacional segura, candidata a autonomia futura: ajustes de orçamento dentro do limite, pausas por performance madura, reativações seguras, agendamento para janela segura, bloqueio por política. Hoje continuam em aprovação humana.
- **`needs_approval`** — Sempre exige aprovação humana: criação/duplicação de campanhas, conjuntos, anúncios; criação ou edição de criativos e copys; mudança de oferta, promessa, página de destino, segmentação estratégica ou objetivo de otimização; planos estratégicos e expansão estrutural.
- **`emergency`** — Ações de risco real (kill switch, gasto acima do teto, tracking quebrado, link quebrado, evento essencial ausente). Poderão executar imediatamente em fase futura, mas só após os critérios técnicos baterem.
- **`observational`** — Sinais informativos (insight, watch, recomendação, monitor, alerta). **Nunca chamam API externa.**
- **`blocked`** — Ações destrutivas (excluir campanha/conjunto/anúncio/criativo), orçamentos acima do limite da plataforma e qualquer alteração visível sem aprovação. **Nunca executam.**

Tipos de ação desconhecidos caem em `needs_approval` por default conservador.

### Limites por plataforma (mantidos)

- Meta: ±20% por ajuste de orçamento, intervalo mínimo 72h.
- Google: ±20% por ajuste de orçamento, intervalo mínimo 7 dias.
- TikTok: ±15% por ajuste de orçamento, intervalo mínimo 48h.

Para escalar acima desses limites, a IA deve propor **expansão estrutural** (duplicar campanha, criar variação controlada, escalar em etapas) — e isso sempre cai em `needs_approval`.

### Bypass legado neutralizado

A configuração antiga de aprovação por conta (`human_approval_mode='auto'`) **não é mais bypass de segurança**. Enquanto o novo modo de autonomia não existir, qualquer tenant que estivesse no modo "automático" antigo passa a se comportar como se estivesse no modo "tudo exige aprovação". Esta neutralização foi feita em três pontos do motor:

- No Estrategista: a variável `isAutoMode` foi forçada para `false`, impedindo execução direta de ajustes de orçamento e mudanças de status pela tool TikTok.
- No Analisador: a porta de aprovação foi ampliada para tratar `'auto'` como `'all'`, e duas leituras locais de `isAutoMode` em criação de campanha/conjunto foram zeradas como cinto-e-suspensório.
- O campo legado `human_approval_mode` **não foi removido** nem alterado em UI; apenas perdeu o efeito de liberar execução automática.

### Carimbo automático no registro de ações

Toda nova ação inserida em `ads_autopilot_actions` recebe via gatilho de banco:

- `action_class` preenchida com uma das 5 classes acima.
- `policy_check_result` enriquecido com `action_class`, `classification_reason`, `autonomy_enabled=false` e `classified_by='ads-policy.v1'`.

O carimbo só preenche quando os campos vierem vazios — qualquer classificação ou auditoria já feita pelo motor de política e pelo executor é preservada. O gatilho **não toca** em `policy_engine_version`, para não interferir nos índices únicos parciais que dependem dele.

### Compatibilidade com Fase B / B.1

Tudo da Fase B continua valendo sem alteração:

- Motor `decide()` (janela segura, limites, TTL de aprovação, idempotência).
- Executor aprovado e runner agendado.
- Validações de canal, entidade, orçamento e intervalo.
- Ações legadas sem `policy_engine_version='v1'` seguem o caminho antigo.

### O que NÃO mudou na Fase C.1

- Nenhuma autonomia automática foi ativada.
- Nenhum tenant teve `is_ai_enabled` alterado.
- Nenhum modo de autonomia novo foi criado (Fase C.2).
- Nenhuma UI, prompt da IA, fila de aprovação ou tela do gestor de tráfego foi alterada.
- Nenhuma chamada externa nova foi adicionada.
- Histograma horário de vendas, CPA de referência por tenant, regra de pausa por mês/14d/7d e Modo Piloto/Sandbox continuam fora do escopo (Fases C.4 e seguintes).

### Próxima fase recomendada (a partir de C.1)

**Fase C.2 — Criar `autonomy_mode`** — entregue logo abaixo.

---

## Fase C.2 — `autonomy_mode` (entregue, autonomia ainda DESLIGADA)

A Fase C.2 cria o campo oficial que vai governar, em fase futura, a autonomia técnica da IA de tráfego pago por conta de anúncios.

### Decisão de design

Apenas **dois modos** nesta fase:

| Modo | Significado |
|---|---|
| `off` | A IA pode analisar, sugerir, gerar plano e mandar ações para aprovação. **Não executa nada automaticamente.** |
| `technical_only` | Em fase futura, a IA poderá executar **apenas ações técnicas seguras**, sempre após passar pelo Execution Policy Engine. Ações visíveis, estruturais ou comerciais continuam exigindo aprovação humana. |

> O modo `technical_only` **existe na configuração**, mas **ainda não libera execução automática real nesta fase**. A ativação real virá apenas em fase posterior, com aprovação explícita do usuário.

### O que `technical_only` poderá fazer (em fase futura)

- Aumentar/reduzir orçamento dentro do limite da plataforma.
- Pausar campanha madura conforme critérios técnicos.
- Pausar emergência (kill switch, tracking quebrado, link quebrado, budget breach).
- Reativar campanha com segurança.
- Agendar ação para janela segura BRT.
- Bloquear ação fora da política.
- Gerar insight/watch sem chamada externa.

### O que `technical_only` **NUNCA** fará automaticamente

Continuam exigindo aprovação humana, em qualquer modo:

- Criar/duplicar campanha, adset ou anúncio.
- Criar/alterar criativo ou copy.
- Mudar oferta, promessa ou landing page.
- Mudar público/segmentação estratégica.
- Mudar objetivo/otimização da campanha.
- Expansão estrutural.
- Criação de variação visível ao cliente final.

### Onde fica o campo

Coluna `autonomy_mode` em `ads_autopilot_account_configs`:

- Tipo: `text NOT NULL`.
- Default: `'off'`.
- Constraint: `CHECK (autonomy_mode IN ('off','technical_only'))`.
- Todos os registros existentes ficaram em `off`.

### Como o sistema lê

- Helper `supabase/functions/_shared/ads-policy.ts`:
  - `normalizeAutonomyMode(valor)` — qualquer valor ausente, nulo, vazio ou desconhecido vira `off`.
  - `isAutonomyExecutionEnabled(modo)` — **retorna `false` para qualquer entrada** enquanto o sistema estiver em C.2. É o contrato em código de que C.2 não autoexecuta.
  - `buildClassificationMeta(actionType, { autonomyMode })` — devolve, além da classificação, os campos de auditoria `autonomy_mode`, `autonomy_source` e `autonomy_execution_phase='not_enabled_c2'`, sempre com `autonomy_enabled: false`.
- Gatilho `ads_autopilot_classify_action` (`BEFORE INSERT` em `ads_autopilot_actions`):
  - Lê `autonomy_mode` da conta correspondente (tenant + canal + `ad_account_id` em `action_data`).
  - Se a conta não for encontrada ou o valor estiver inválido, registra `autonomy_mode='off'` e `autonomy_source='default_off'`.
  - Adiciona ao `policy_check_result`:
    - `autonomy_mode`
    - `autonomy_enabled = false`
    - `autonomy_source` (`ads_autopilot_account_configs.autonomy_mode` ou `default_off`)
    - `autonomy_execution_phase = 'not_enabled_c2'`

### `human_approval_mode` — legado

- O campo `human_approval_mode` **continua existindo** na tabela; nada foi removido.
- `human_approval_mode='auto'` **continua neutralizado como bypass** (introduzido em C.1) e não libera execução automática.
- A fonte futura da autonomia será exclusivamente `autonomy_mode`. `human_approval_mode` permanece apenas como compatibilidade histórica até que C.3+ migre a UI.

### O que NÃO mudou na Fase C.2

- Nenhum tenant foi ativado.
- Nenhuma autonomia automática foi ligada — `technical_only` não executa nada nesta fase.
- Nenhuma alteração em `is_ai_enabled`, `kill_switch` ou `human_approval_mode`.
- Nenhuma UI, prompt da IA, fila de aprovação ou tela do gestor de tráfego foi alterada.
- Nenhuma chamada externa nova foi adicionada.
- Histograma horário, CPA de referência, regra mensal de pausa, cache de CPA e Modo Piloto/Sandbox continuam fora do escopo (Fases C.4+).

### Próxima fase recomendada

**Fase C.3 — Piloto de `technical_only` em 1 tenant** com observabilidade plena (dashboard de classificação + auditoria de `policy_check_result`), ainda sem autoexecução real. A ativação efetiva da autoexecução depende de aprovação explícita do usuário e virá em fase posterior.

## Fase C.3.1 — Bloco Observacional do `technical_only` (entregue, allowlist VAZIA)

A Fase C.3.1 prepara o terreno para o futuro piloto observacional do modo `technical_only`. Ela **não ativa nenhum tenant**, **não executa nada**, **não chama API externa** e **não altera o comportamento prático do sistema**.

### O que foi entregue

- Função pura `buildObservationResult(...)` em `supabase/functions/_shared/ads-policy.ts`, que converte uma decisão do Execution Policy Engine no objeto `observation` a ser gravado em `policy_check_result.observation`.
- Gate de elegibilidade `shouldAttachObservation(...)` — síncrono, determinístico, sem banco e sem rede.
- Helper de integração `maybeAttachTechnicalOnlyObservation(...)` que anexa o bloco `observation` ao registro de ação **antes** do INSERT, somente se todos os gates passarem.
- Allowlist in-code `TECHNICAL_ONLY_OBSERVATION_ALLOWLIST` — **inicia VAZIA**. Adicionar tenant exige entrega futura com aprovação explícita.
- Lista canônica `OBSERVABLE_TECHNICAL_ACTION_TYPES` com os 8 tipos técnicos de baixo risco elegíveis nesta primeira fase.
- Wiring nos motores `analyze` e `strategist`: chamada do helper imediatamente antes de cada INSERT principal em `ads_autopilot_actions`. Como a allowlist está vazia, todas essas chamadas são no-op em produção.
- Suíte de testes `supabase/functions/_shared/ads-policy.observation.test.ts` com 24 testes verdes cobrindo allowlist, todos os gates e todos os mapeamentos de decisão.

### Formato canônico do bloco `observation`

```json
{
  "mode": "technical_only_observational",
  "pilot_version": "c3_v1",
  "would_decision": "execute_now | schedule | reject | insight | skipped_insufficient_context",
  "would_scheduled_for": "ISO 8601 (apenas em would_decision='schedule')",
  "would_reason": "string curta",
  "window_check": { },
  "limit_check": { },
  "context_check": { "sufficient": true, "missing": [] },
  "evaluated_at": "ISO 8601 UTC"
}
```

### Gates que precisam passar para gravar `observation`

1. `tenant_id` presente.
2. `TECHNICAL_ONLY_OBSERVATION_ALLOWLIST` contém o `tenant_id`. **Hoje a lista está vazia — nenhum tenant grava `observation`.**
3. `autonomy_mode = 'technical_only'` na configuração da conta.
4. `is_ai_enabled = true`.
5. `kill_switch = false`.
6. `action_class = 'automatic_candidate'`.
7. `action_type` ∈ `OBSERVABLE_TECHNICAL_ACTION_TYPES`.

Qualquer falha em qualquer gate ⇒ **nenhum** `observation` é anexado e o comportamento atual segue intocado.

### Escopo de ações observáveis em C.3.1

| Inclusos (8) | Não inclusos nesta fase |
|---|---|
| `adjust_budget`, `adjust_budget_up`, `adjust_budget_down` | `pause_campaign`, `pause_adset`, `pause_adgroup`, `pause_ad` |
| `increase_budget`, `decrease_budget` | `activate_*`, `reactivate_*` |
| `update_tiktok_budget` | `create_*`, `duplicate_*`, criativos, copys, expansão |
| `schedule_action`, `toggle_tiktok_status` | qualquer ação `emergency` |

Pausas/reativações ficam fora porque dependem de sinais ainda não implementados (histograma horário, CPA de referência, regra mensal de pausa, maturação consolidada, regra 3× CPA). Esses sinais serão tratados em fases futuras.

### Garantias duras (anti-regressão)

- `isAutonomyExecutionEnabled()` continua **hardcoded `false`**.
- `auto_executed` permanece `false` em qualquer ação que receba `observation`.
- `executed_simulated` permanece `false`.
- `executed_at` não é preenchido pela observação.
- `executor` (`ads-autopilot-execute-approved`) e `scheduled-runner` (`ads-autopilot-scheduled-runner`) **ignoram completamente** `policy_check_result.observation` — observação é dado de auditoria, nunca de execução.
- O helper de integração **não chama API externa, não faz UPDATE no banco e não altera status**.
- Qualquer erro interno no helper é engolido silenciosamente: observação NUNCA bloqueia o fluxo principal.

### Validação por SQL

Para confirmar que nenhuma ação observacional foi promovida a execução real:

```sql
SELECT COUNT(*) AS leak_count
FROM ads_autopilot_actions
WHERE policy_check_result ? 'observation'
  AND auto_executed = true;
-- Esperado: 0. Em C.3.1, com allowlist vazia, a contagem TOTAL com observation também é 0.

SELECT COUNT(*) AS total_observations
FROM ads_autopilot_actions
WHERE policy_check_result ? 'observation';
-- Esperado em C.3.1: 0 (allowlist vazia).
```

### O que NÃO mudou na Fase C.3.1

- Nenhum tenant foi ativado nem adicionado à allowlist.
- Nenhum `autonomy_mode` foi alterado em qualquer conta.
- Nenhum `is_ai_enabled` foi alterado.
- Nenhuma UI, prompt da IA, fila de aprovação ou tela do gestor de tráfego foi alterada.
- Nenhuma migration foi criada — toda a observação cabe em `policy_check_result` (jsonb existente).
- Nenhuma chamada externa nova foi adicionada.
- Histograma horário, CPA de referência, regra mensal de pausa, cache de CPA e Modo Piloto/Sandbox continuam fora do escopo.

### Próxima fase recomendada (após C.3.1)

**Fase C.3.2 — Ativação observacional em 1 tenant piloto** (`Respeite o Homem`, apenas canal Meta). Executada em duas etapas com aprovação explícita: (a) preparação silenciosa, (b) ligar `is_ai_enabled=true` na conta para gerar observações reais. Ver seção C.3.2 a seguir.

---

## Fase C.3.2 — Piloto Observacional `technical_only` (Etapas 1 e 2 entregues)

A Fase C.3.2 é executada em **duas etapas independentes**, cada uma com aprovação explícita do usuário.

### Etapa 1 — Preparação silenciosa (ENTREGUE)

**Objetivo:** preparar o tenant piloto sem ligar a IA da conta, sem gerar observações e sem qualquer impacto operacional.

**Aplicado:**

- Tenant **Respeite o Homem** (`d1a4d0ed-8842-495e-b741-540a9a345b25`) adicionado à `TECHNICAL_ONLY_OBSERVATION_ALLOWLIST` em `supabase/functions/_shared/ads-policy.ts`. É o único tenant na allowlist.
- Conta de anúncios Meta **`act_251893833881780`** com `autonomy_mode='technical_only'`.
- `is_ai_enabled` permanece **`false`**, `kill_switch` **`false`**, `human_approval_mode` **`approve_high_impact`** (todos inalterados).
- Google e TikTok: **fora do piloto**. Nenhum outro tenant alterado.

**Resultado confirmado:** zero observações, zero autoexecuções, zero ações novas, nenhuma chamada externa.

### Etapa 2 — Ativação observacional real (ENTREGUE)

**Objetivo:** ligar a IA da conta Meta piloto para que o motor passe a propor ações e gravar `observation` em `policy_check_result`, **sem nenhuma autoexecução real**.

**Aplicado somente na conta Meta `act_251893833881780` do tenant Respeite o Homem:**

- `is_ai_enabled` = **`true`**
- `human_approval_mode` = **`all`** (mudança **temporária** durante o piloto observacional; garante que toda proposta executável fica pendente de aprovação humana consciente)
- `autonomy_mode` = **`technical_only`** (mantido)
- `kill_switch` = **`false`** (inalterado)

**Gates de segurança confirmados pós-ativação:**

- `isAutonomyExecutionEnabled()` continua **hardcoded `false`** em `supabase/functions/_shared/ads-policy.ts`.
- Executor e scheduled-runner continuam **ignorando** `policy_check_result.observation` (campo somente de auditoria).
- `auto_executed` e `executed_simulated` permanecem `false` para todas as ações do tenant.
- Google e TikTok não foram tocados. Nenhum outro tenant foi alterado.
- Nenhuma API externa de modificação foi chamada por causa da ativação.

**Escopo das observações nesta fase (apenas Meta):** `adjust_budget`, `adjust_budget_up`, `adjust_budget_down`, `increase_budget`, `decrease_budget` e equivalentes internos de orçamento Meta já mapeados como `automatic_candidate` em `OBSERVABLE_TECHNICAL_ACTION_TYPES`.

**Fora do escopo observacional desta fase:** pausa de campanha, reativação, criação, duplicação, criativos, copys, expansão estrutural, alteração de público/objetivo, Google Ads, TikTok Ads. Motivo: ainda faltam histograma horário, CPA de referência, regra mensal de pausa, maturação consolidada e regra 3x CPA.

**Janela de observação obrigatória antes de qualquer promoção:** **mínimo de 7 dias corridos OU 30 ações candidatas observadas**, o que demorar mais. Durante esse período: não ativar autoexecução, não incluir Google/TikTok, não incluir pausas/reativações, não aprovar ações sem revisão humana consciente, auditar diariamente via SQL.

**Auditoria diária (SQL):**

```sql
-- A) Estado da conta
SELECT tenant_id, channel, ad_account_id, autonomy_mode, is_ai_enabled, kill_switch, human_approval_mode
FROM ads_autopilot_account_configs
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND ad_account_id = 'act_251893833881780';

-- B) Total de observações registradas
SELECT COUNT(*) AS total_observations
FROM ads_autopilot_actions
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND policy_check_result ? 'observation';

-- C) Decisões simuladas por tipo
SELECT policy_check_result->'observation'->>'would_decision' AS would_decision, COUNT(*) AS total
FROM ads_autopilot_actions
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND policy_check_result ? 'observation'
GROUP BY 1 ORDER BY 2 DESC;

-- D) Garantia de NENHUMA autoexecução (deve ser sempre 0)
SELECT COUNT(*) AS leak_count
FROM ads_autopilot_actions
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND (auto_executed = true OR executed_simulated = true);

-- E) Garantia de que só Meta entrou no piloto
SELECT channel, COUNT(*) FROM ads_autopilot_actions
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND policy_check_result ? 'observation'
GROUP BY channel;

-- F) Propostas pendentes geradas nas últimas 24h
SELECT status, action_type, action_class, COUNT(*) AS total
FROM ads_autopilot_actions
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND created_at > now() - interval '24 hours'
GROUP BY status, action_type, action_class
ORDER BY total DESC;
```

**Mesmo após a Etapa 2, nenhuma autoexecução é ligada.** A execução automática real só será considerada na futura **Fase C.4**, com critérios de promoção formais e aprovação explícita do usuário.

### O que NÃO mudou na Etapa 2 da C.3.2

- Nenhuma autoexecução foi ativada (`isAutonomyExecutionEnabled()` continua `false`).
- Nenhuma campanha real foi alterada por iniciativa do sistema.
- Nenhuma API externa nova de modificação foi chamada.
- Nenhuma UI, prompt da IA ou fila de aprovação foi alterada.
- Nenhuma migration de schema foi criada.
- Kill switch da conta permanece `false` (inalterado).
- Histograma horário, CPA de referência, regra mensal de pausa, cache de CPA e Modo Piloto/Sandbox continuam fora do escopo.
- Pausa/reativação continuam fora do escopo observacional.

---

## C.3.2 — Etapa 3: Correção do gate de módulo ativo (2026-06-07)

### Falha encontrada
Durante 7 dias após a ativação do piloto observacional no tenant Respeite o Homem (conta Meta `act_251893833881780`), **nenhuma sessão, proposta ou observação foi gerada** pelos ciclos automáticos do Ads Autopilot.

### Causa raiz
O gate de "recurso em uso" do módulo `ai_traffic_manager` (função `count_active_tenants_for_module`) considerava apenas a ativação por canal (`ads_autopilot_configs.is_enabled=true`). O piloto C.3.2 foi ligado pelo caminho granular (`ads_autopilot_account_configs`, por conta de anúncio), que **não era reconhecido pelo gate**. Resultado: todos os crons do Ads Autopilot pulavam a execução com `reason='no_active_tenants'`.

### Correção aplicada
1. **`count_active_tenants_for_module('ai_traffic_manager')`** agora considera tenant ativo por união dos dois caminhos:
   - ativação por canal (caminho legado preservado), OU
   - ativação granular por conta com `is_ai_enabled=true` AND `kill_switch=false` AND `autonomy_mode <> 'off'`.
2. **Novo gatilho** `trg_account_config_mark_ai_traffic_manager_active_from_account` em `ads_autopilot_account_configs` chama `mark_module_active_by_event('ai_traffic_manager')` imediatamente ao ligar uma conta, sem esperar a varredura diária.
3. **Refresh imediato** de `system_resource_usage` aplicado na migration. Estado pós-correção: `ai_traffic_manager → active_tenant_count=1, status=active`.

### Primeiro ciclo manual controlado (após a correção)
- Função disparada: `ads-autopilot-analyze` (não chama API de modificação da Meta; gera proposta interna).
- Tenant: `d1a4d0ed-8842-495e-b741-540a9a345b25`, conta `act_251893833881780`, canal Meta.
- Resultado: 4 ações criadas — 2 `create_campaign` em `pending_approval` (aguardam aprovação humana) e 2 `generate_creative` em `executed` (geração interna de criativo, sem chamada de modificação à Meta).
- `leak_count = 0` (nenhuma ação com `auto_executed=true` ou `executed_simulated=true`).
- Google e TikTok permaneceram fora do piloto.

### Janela de observação reiniciada
A janela observacional do piloto C.3.2 **recomeça a contar a partir de 2026-06-07**, primeira data em que ciclos automáticos efetivamente passaram pelo gate. Resultados anteriores a essa data não devem ser usados como referência.

### Regra anti-regressão
**Qualquer novo caminho de ativação do Ads Autopilot** (por canal, por conta, por campanha, por feature, ou qualquer granularidade futura) **deve obrigatoriamente atualizar o branch `ai_traffic_manager` em `count_active_tenants_for_module` e instalar trigger de evento equivalente ao `trg_account_config_mark_ai_traffic_manager_active_from_account`**. PR que adicione caminho de ativação sem atualizar o gate deve ser bloqueado em revisão.

---

## C.3.2 — Etapa 4: Acoplamento de `decide()` ao bloco observacional (2026-06-07)

### Causa da lacuna

Após a correção da Etapa 3, o gate dos crons voltou a funcionar e o motor passou a gerar propostas para o piloto. No entanto, o campo `policy_check_result.observation` continuava **vazio** nas propostas elegíveis. O motivo: o helper local de cada edge function (`ads-autopilot-analyze` e `ads-autopilot-strategist`) ainda chamava `maybeAttachTechnicalOnlyObservation` com `decision: null` e `context_check.sufficient: false` (`missing: ["c3_1_decide_context_not_wired_yet"]`), legado da entrega C.3.1 onde a allowlist estava vazia e a integração era apenas estrutural.

### Solução aplicada

1. **Helper central no policy engine** — `attachObservationFromActionRecord(actionRecord, acctConfig)` em `supabase/functions/_shared/ads-policy.ts`. Responsável por:
   - Classificar a ação (`classifyAction`);
   - Aplicar o gate completo (`shouldAttachObservation`) — barra qualquer ação que não seja do tenant piloto, canal Meta, conta com IA ligada, `autonomy_mode='technical_only'`, `kill_switch=false`, `action_class='automatic_candidate'` e `action_type` no escopo `OBSERVABLE_TECHNICAL_ACTION_TYPES`;
   - Verificar contexto disponível (orçamento atual/proposto, canal) e marcar `context_check.sufficient=false` quando faltar dado;
   - Quando o contexto for suficiente, chamar `decide()` real com `lastBudgetChangeAt = acctConfig.last_budget_adjusted_at`;
   - Mesclar `policy_check_result.observation` no `actionRecord` via `maybeAttachTechnicalOnlyObservation`.

2. **Edge functions delegam ao helper central** — `ads-autopilot-analyze` e `ads-autopilot-strategist` agora têm um wrapper local `attachObservationIfEligible` que apenas chama o helper central dentro de `try/catch` silencioso. Nenhum outro ponto de inserção em `ads_autopilot_actions` foi alterado.

3. **Mapeamento determinístico de decisão**:
   - `execute_now` → `would_decision='execute_now'`
   - `schedule` → `would_decision='schedule'` + `would_scheduled_for`
   - `reject_policy_limit_exceeded` / `reject_policy_missing_context` / `expired_approval` / `reject_duplicate` → `would_decision='reject'`
   - decisão ausente → `would_decision='insight'`
   - contexto insuficiente → `would_decision='skipped_insufficient_context'`

### Garantias de segurança preservadas

- `isAutonomyExecutionEnabled()` continua hardcoded `false`.
- Nenhuma API externa é chamada pelo helper (síncrono, sem `fetch`).
- Nenhum `UPDATE` em banco. Nenhum side-effect além de mesclar `observation` no objeto em memória.
- `auto_executed`, `executed_simulated`, `executed_at`, `status` real **nunca** são alterados pelo helper.
- Defesa em camadas: se o `actionRecord` chegar com `auto_executed=true` ou `executed_simulated=true`, o helper força para `false`.
- Executor (`ads-autopilot-execute-approved`) e scheduled-runner continuam **ignorando** `policy_check_result.observation`.

### Escopo desta entrega

- **Tenant:** apenas Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`).
- **Canal:** apenas Meta. Google e TikTok ficam fora.
- **Tipos de ação:** apenas os já listados em `OBSERVABLE_TECHNICAL_ACTION_TYPES` (variações de `adjust_budget`, `increase_budget`, `decrease_budget`, `schedule_action`, `toggle_tiktok_status`, `update_tiktok_budget`). Pausas, reativações, criações de campanha, criativos e copys **continuam fora** do escopo observacional desta fase.

### Propostas existentes (últimas 24h)

As 4 propostas geradas em 2026-06-07 03:59 BRT são todas de tipo `create_campaign` e `generate_creative`, **fora** do escopo observável da C.3.1/C.3.2 por design. Nenhuma delas foi alterada retroativamente — o correto é não anexar `observation` em ações que não são tecnicamente elegíveis.

### Cobertura de testes

`supabase/functions/_shared/ads-policy.observation.test.ts` — **38 testes verdes** (12 novos para o helper central da C.3.2, cobrindo: ação Meta elegível gera observation; outro tenant não gera; Google/TikTok não geram; `kill_switch=true` não gera; `is_ai_enabled=false` não gera; `autonomy_mode='off'` não gera; `create_campaign` não gera; `adjust_budget` sem orçamentos gera `skipped_insufficient_context`; `adjust_budget +50%` gera `would_decision='reject'`; intervalo curto gera `would_decision='schedule'`; helper nunca marca `auto_executed`/`executed_simulated`/`executed_at`; helper é síncrono e não chama `fetch`).

### Auditoria diária

```sql
-- Total de observações
SELECT COUNT(*) AS total_observations
FROM ads_autopilot_actions
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND policy_check_result ? 'observation';

-- Decisões simuladas por tipo
SELECT policy_check_result->'observation'->>'would_decision' AS would_decision, COUNT(*) AS total
FROM ads_autopilot_actions
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND policy_check_result ? 'observation'
GROUP BY 1 ORDER BY 2 DESC;

-- Garantia de zero autoexecução
SELECT COUNT(*) AS leak_count
FROM ads_autopilot_actions
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND (auto_executed = true OR executed_simulated = true);

-- Garantia de que só Meta entrou
SELECT channel, COUNT(*)
FROM ads_autopilot_actions
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25'
  AND policy_check_result ? 'observation'
GROUP BY channel;
```

### Janela observacional oficial

A janela observacional **recomeça a contar a partir da primeira `observation` válida gravada** (não da data de deploy desta etapa). Hoje (2026-06-07), `total_observations=0` porque as propostas geradas até agora foram todas de tipos fora do escopo. A contagem oficial inicia quando a IA propuser a primeira ação técnica de orçamento Meta.

### Próxima etapa recomendada

Habilitar a coleta de contextos faltantes (histograma horário, CPA de referência, snapshot de orçamento atual a partir do meta-ads-campaigns) para que mais ações entrem em `context_check.sufficient=true` em vez de `skipped_insufficient_context`. Essa coleta é pré-requisito da futura **Fase C.4** (promoção a autoexecução real), que continua **bloqueada** até decisão explícita do usuário.

---

## C.3.2 — Etapa 5 (07/06/2026): coleta mínima de contexto de orçamento Meta

**Escopo:** restrito ao tenant Respeite o Homem (`d1a4d0ed-…`) e à conta Meta `act_251893833881780`. Sem Google/TikTok. Sem alteração de prompts. Sem autoexecução. Sem chamada de modificação à Meta. Sem alterar `human_approval_mode`, `autonomy_mode`, `is_ai_enabled` ou `kill_switch`. Strategist FASE 1 continua bloqueando `adjust_budget`.

### O que foi entregue

1. **Sync manual e somente leitura de adsets Meta** para a conta piloto. Resultado: 233 adsets sincronizados, 96 com `daily_budget_cents > 0` (ABO).
2. **Helper observacional assíncrono com fallback de contexto via banco.** Quando o payload da IA não traz `current_daily_budget_cents` nem `last_budget_change_at`, o helper consulta `meta_ad_campaigns` (para CBO) e soma `daily_budget_cents` dos adsets ATIVOS (para ABO) e busca a última ação `adjust_budget` aprovada/executada/agendada para inferir `last_budget_change_at`. Estritamente leitura. Não chama Meta. Não persiste alterações.
3. **VIEW leve `meta_ad_campaign_cpa_reference`** com CPA 7d e 14d por campanha, calculado on-demand sobre `meta_ad_insights`. Sem tabela materializada e sem cron novo. Inclui sinal `low_confidence=true` quando há menos de 3 dias de dado ou menos de 10 conversões na janela 14d.

### Validações executadas

- Sync: 233 adsets gravados, 0 removidos.
- View CPA: 2 campanhas ACTIVE com `low_confidence=false` (CPA 7d ≈ R$58,25 e R$72,33).
- Testes Deno (`ads-policy.observation.test.ts`): 38/38 ok.
- Linter de segurança após `ALTER VIEW … security_invoker = on`: 0 erro vinculado à entrega.

### Bloco anti-regressão

O sync de adsets é uma **chamada manual e pontual** para destravar o contexto histórico. Sem alteração de cron. A view de CPA é uso interno do piloto observacional — não é fonte oficial de CPA para relatórios. O helper assíncrono mantém o helper síncrono `attachObservationFromActionRecord` exportado para compatibilidade.

### Ciclo manual de validação (07/06/2026)

Forçado um ciclo do diagnosticador (`ads-autopilot-analyze`) no tenant piloto, somente Meta, modo `technical_only`, sem autoexecução.

- **leak_count = 0** — nenhuma ação `auto_executed` ou `executed_simulated`.
- **0 chamadas de modificação** à Meta Ads API.
- **Contexto de orçamento/status/CPA disponível** via sync de adsets + view de CPA + fallback assíncrono do helper.
- **0 observations** geradas — nenhuma `policy_check_result.observation` foi anexada porque nenhuma ação `adjust_budget*` foi proposta pelo analyze no ciclo.
- Ações geradas no ciclo: `pause_campaign`, `create_campaign`, `generate_creative` — todas fora do escopo de orçamento.

### Fechamento da Etapa 5

**Etapa 5 fechada em 07/06/2026.** Critérios atendidos:

- ✅ Contexto de orçamento, status e CPA disponível no piloto.
- ✅ `leak_count = 0`.
- ✅ Nenhuma API de modificação chamada.
- ✅ Gargalo de contexto resolvido.

A janela observacional de 7 dias **não foi iniciada** — só começa quando ocorrer a primeira `observation` válida ou quando for decidido formalmente medir outro tipo de sinal.

### Próxima etapa (Etapa 6) — implementada em 07/06/2026

O gargalo migrou de **contexto** para **geração de proposta de orçamento**. A Etapa 6 foi entregue na sequência (ver seção a seguir).

---

## C.3.2 — Etapa 6 (07/06/2026): gatilho determinístico de proposta de orçamento no Analyze

### Motivo

Após a Etapa 5, o contexto técnico (orçamento, status, CPA) já estava disponível para o piloto, mas nenhuma `observation` era populada porque o `ads-autopilot-analyze` (LLM) não estava propondo `adjust_budget` para campanhas existentes — só `pause_campaign`, `create_campaign` e `generate_creative`. A Etapa 6 cria um **gatilho determinístico, pequeno e auditável** que avalia campanhas Meta do piloto e gera propostas conservadoras de orçamento quando há sinal técnico claro, **sem alterar o prompt do Strategist** e **sem liberar autoexecução**.

### Escopo estrito (gating em código)

A função `generateDeterministicBudgetProposals` no `ads-autopilot-analyze` aplica filtros duros antes de qualquer leitura:

- Somente tenant `d1a4d0ed-8842-495e-b741-540a9a345b25` (Respeite o Homem).
- Somente conta `act_251893833881780`.
- Somente canal `meta`.
- `is_ai_enabled = true` e `kill_switch = false`.

Qualquer outro tenant, conta ou canal sai pela porta de saída sem fazer leitura, escrita ou observação.

### Critérios determinísticos para gerar proposta

Para cada campanha do piloto a função lê a view `meta_ad_campaign_cpa_reference` (Etapa 5) e cruza com `meta_ad_campaigns`:

1. Campanha precisa estar `effective_status = ACTIVE`.
2. View não pode estar marcada `low_confidence` (< 3 dias de dado ou < 10 conversões em 14d).
3. Precisa ter CPA 7d **e** CPA 14d definidos.
4. Precisa ter **≥ 5 conversões nos últimos 7 dias**.
5. Não pode haver outra proposta `adjust_budget` em `pending_approval/scheduled/approved` para a mesma campanha nas últimas 24h (dedup).

Decisão de direção/percentual:

- `delta_pct = (cpa_7d − cpa_14d) / cpa_14d × 100`
- Banda neutra: |delta_pct| < 5% → **não gera proposta** (registra `cpa_within_neutral_band`).
- `delta_pct ≤ −5%` (CPA 7d melhor que 14d) → propõe **+10% no orçamento diário**.
- `delta_pct ≥ +5%` (CPA 7d pior que 14d) → propõe **−10% no orçamento diário**.
- Teto absoluto: **20%** (limite Meta já configurado no policy engine). Nunca propõe acima disso.

Para campanhas CBO o orçamento atual vem direto de `meta_ad_campaigns.daily_budget_cents`. Para campanhas ABO o orçamento é resolvido pelo helper assíncrono de observação, que soma `daily_budget_cents` dos adsets ATIVOS via `meta_ad_adsets`.

### Integração com `decide()` e `policy_check_result.observation`

Toda proposta gerada passa pelo `attachObservationFromActionRecordAsync`, que chama `decide()` real e grava em `policy_check_result.observation`:

- `mode = "technical_only_observational"`, `pilot_version`, `would_decision`, `would_reason`.
- `window_check.inside_safe_window_brt`, `limit_check` (delta_pct/limite), `context_check`.
- Possíveis valores de `would_decision`: `execute_now`, `schedule`, `reject`, `skipped_insufficient_context`.

### Estado real continua seguro

Mesmo quando `would_decision = execute_now`, o estado real da proposta é sempre:

- `status = pending_approval`.
- `auto_executed = false`, `executed_simulated = false`, `executed_at = NULL`.
- Nenhuma chamada à Meta Marketing API é feita.
- Aprovação humana segue obrigatória via UI da fila (`human_approval_mode = all`).
- Strategist FASE 1 **não foi alterado** — continua proibido de propor `adjust_budget`. O gatilho da Etapa 6 vive exclusivamente dentro do `ads-autopilot-analyze`, isolado do prompt do Strategist.

### Resultado do ciclo manual de validação (07/06/2026)

Ciclo manual disparado contra `act_251893833881780` (somente Meta, somente Analyze):

- Total avaliado: 2 campanhas elegíveis (1 CBO, 1 ABO).
- Total gerado: 2 propostas `adjust_budget` (ambas `direction=up, change_pct=+10`).
- Campanha CBO (R$ 200/dia): observação `would_decision=execute_now`, `reason=policy_passed`, novo orçamento proposto R$ 220/dia, contexto suficiente.
- Campanha ABO: observação `would_decision=skipped_insufficient_context` porque o agregador de adsets retornou 0 ativos para somar — comportamento esperado e auditado. Mesmo assim a proposta foi gravada como `pending_approval` para o usuário decidir.
- `leak_count = 0` no tenant inteiro (nenhuma ação com `auto_executed=true` ou `executed_simulated=true`).
- Nenhuma API Meta de modificação foi chamada.
- Janela observacional oficial: **inicia a partir desta primeira `observation` válida em 07/06/2026 (ciclo manual)**.

### Restrições mantidas

- UI/UX da fila não foi alterada.
- Prompt do Strategist não foi alterado.
- `human_approval_mode`, `autonomy_mode`, `is_ai_enabled` e `kill_switch` não foram alterados.
- Google e TikTok continuam fora.
- Nenhum outro tenant é tocado pelo gatilho.
- Histograma horário, regra mensal de pausa, regra 3× CPA de campanha nova, Modo Piloto/Sandbox e qualquer alteração de criação/pausa/reativação ficam fora desta etapa.

### Próxima etapa recomendada

Acompanhar 7 dias de janela observacional a partir de 07/06/2026, comparando `would_decision` das propostas determinísticas com a decisão humana final na fila. Se a taxa de concordância for alta e nenhuma proposta forçar `would_decision=reject` por limite/janela, abrir Etapa 7 para discutir liberação controlada de autoexecução apenas do tipo `adjust_budget` (ainda restrita ao piloto).


---

## Etapa 7.mem — Subfase A.1 — Captura de Feedback Humano: Contrato e Armazenamento

**Status:** entregue (backend apenas). Sem alteração de UI, sem alteração do fluxo atual de aprovação/recusa, sem influência sobre a IA.

### Objetivo

Criar a base para registrar de forma estruturada cada decisão humana sobre sugestões do Ads Autopilot, para que essa decisão alimente, em subfases posteriores, a Memória Exclusiva do Tenant e — bem mais à frente — a Memória Universal. Esta subfase apenas constrói o contrato e o armazenamento. **Nenhuma decisão da IA muda nesta entrega.**

### O que foi entregue

1. **Catálogo extensível de motivos** com 22 códigos iniciais, divididos em motivos de aprovação (6) e motivos de recusa/revisão (16). Motivos podem ser ativados/desativados no futuro sem refatoração.
2. **Histórico imutável de feedback** com snapshot completo do contexto da sugestão no momento da decisão (campanha, objetivo, métricas, política, observação) e da decisão em si (decisão, motivos, comentário, sinais auxiliares e, quando aplicável, diferença entre proposta e versão aprovada).
3. **Ponto único de gravação** acessível apenas por usuários autenticados do próprio tenant, com validação obrigatória do motivo contra o catálogo e do conjunto mínimo de campos do contrato.
4. **Isolamento estrito por tenant** via políticas de acesso na própria base, mais validação cruzada no ponto de gravação.
5. **Bateria de testes do contrato** cobrindo aprovação, recusa, pedido de revisão, edição+aprovação, motivo inválido, ausência de motivo, snapshot ausente, decisão inválida, diferença em decisão errada e identificadores mal formados.

### Decisões permitidas

- **Aprovado** — humano concorda com a sugestão.
- **Recusado** — humano descarta a sugestão.
- **Pediu revisão** — humano quer que a IA reavalie no próximo ciclo (sem executar e sem rejeitar definitivamente).
- **Editou e aprovou** — humano alterou campos da proposta antes de aprovar; a diferença entre proposta e versão aprovada é registrada.

Os quatro estados já são aceitos pelo contrato mesmo que a UI ainda não os exponha — para garantir compatibilidade quando a Subfase A.2 (UI mínima) e A.3 (revisão + edição) forem entregues.

### Lista inicial de motivos

**Aprovação:** boa lógica de orçamento; boa recomendação de criativo; alinhado com a meta do negócio; eu faria isso manualmente; conservadora e segura; forte sustentação nos dados.

**Recusa / revisão:** dados insuficientes; produto errado; copy fraca; orçamento alto demais; orçamento baixo demais; campanha ainda em aprendizado; momento errado; conflita com a estratégia; contexto faltando; não escalar este produto; recomendação incoerente; ação duplicada ou conflitante; público errado; problema de rastreamento; criativo incompatível; campanha fria muito agressiva.

Os rótulos em português registrados no catálogo são placeholders técnicos — a versão final dos textos para a UI será aprovada na Subfase A.2.

### Isolamento e segurança

- Cada tenant lê e grava apenas o próprio feedback.
- Tentativa de gravação com motivo fora do catálogo ou sem motivo é rejeitada tanto no ponto de gravação quanto na própria base.
- Feedback é imutável: não há edição nem exclusão pelo usuário.
- O ponto de gravação exige sessão autenticada do tenant.

### O que **não** muda nesta subfase

- Botões de aprovar e recusar continuam exatamente como hoje.
- Nenhuma tela nova.
- O motivo **ainda não é obrigatório no fluxo real** — só é obrigatório quando o ponto de gravação de feedback é chamado diretamente. A UI que torna o motivo obrigatório no clique do usuário entra apenas em A.2.
- Veredito da IA, geração de sugestões, prompts, camada de política, governança da conta, matriz por objetivo e camada de derivação de ação permanecem inalterados.
- Modo de aprovação humana, kill switch, modo de autonomia e habilitação da IA não foram tocados.
- Nenhuma chamada à Meta foi feita.
- Nenhuma autoexecução foi ativada.

### Roadmap das próximas subfases

- **A.2 — Captura via UI mínima:** diálogos de aprovar e recusar com motivo obrigatório e sinais auxiliares; mantém o mesmo contrato.
- **A.3 — Revisão e edição:** introduz “Pedir revisão” e “Editar e aprovar” no fluxo, com captura da diferença entre proposta e versão aprovada.
- **B — Memória do Tenant (armazenamento):** estrutura onde as preferências aprendidas daquele tenant + plataforma de vendas + plataforma de anúncios serão guardadas.
- **C — Escritor da Memória do Tenant:** transforma feedback recorrente em preferência provisional/ativa, com confiança, evidências e versionamento.
- **D — Leitura observacional no ciclo:** anexa as preferências aplicáveis a cada sugestão (apenas log e anotação).
- **E — UI de transparência:** tela mostrando por que a sugestão foi gerada e o que foi bloqueado; gestão das preferências do tenant.
- **F — Influência real:** Verdict Layer e Action Derivation passam a respeitar a hierarquia.
- **G/H — Memória Universal:** só inicia quando houver volume de feedback estruturado suficiente e/ou um segundo tenant ativo.

## Etapa 7.mem — Subfase A.2 — Captura de Feedback Humano: UI mínima de Aprovar/Recusar

**Status:** entregue. A.2 conecta o contrato/armazenamento da A.1 ao fluxo real de Aprovar e Recusar das sugestões do Ads Autopilot, sem alterar a lógica do executor, sem alterar prompts, sem alterar Policy Engine, Verdict Layer, Governance Layer ou Action Derivation, e sem ativar nenhuma forma de autoexecução.

### O que A.2 adiciona

- Diálogo obrigatório de feedback aparece **antes** de qualquer aprovação ou recusa ser efetivada.
- O diálogo exige seleção de pelo menos um motivo do catálogo da A.1. Sem motivo, o botão de confirmação fica desabilitado.
- O comentário em texto livre é opcional.
- A decisão original (aprovar/recusar) só prossegue **depois** que o feedback for gravado com sucesso. Se a gravação falhar, a decisão não acontece e o erro é exibido ao usuário, com opção de tentar novamente.

### Campos capturados pelo diálogo

Aprovação:
- motivo(s) selecionado(s) do catálogo de aprovação;
- comentário livre (opcional);
- “Eu faria isso manualmente” (opcional);
- “Usar como preferência futura deste tenant” (opcional).

Recusa:
- motivo(s) selecionado(s) do catálogo de recusa/revisão;
- comentário livre (opcional);
- “A IA ignorou algum contexto importante” + descrição (opcional);
- “Usar como preferência futura deste tenant” (opcional).

Além disso, o feedback grava automaticamente snapshot imutável de: tenant, canal, conta de anúncios, campanha, objetivo, tipo de ação, classe da ação, estado funcional, veredito proposto, resultado da política, observação/reasoning da IA e métricas disponíveis no momento da decisão.

### Motivos exibidos na UI

Aprovação: `good_budget_logic`, `good_creative_recommendation`, `matches_business_goal`, `would_do_manually`, `safe_and_conservative`, `strong_data_support`.

Recusa/Revisão: `insufficient_data`, `wrong_product`, `weak_copy`, `budget_too_high`, `budget_too_low`, `campaign_still_learning`, `bad_timing`, `conflicts_with_strategy`, `missing_context`, `do_not_scale_this_product`, `incoherent_recommendation`, `duplicated_or_conflicting_action`, `wrong_audience`, `tracking_issue`, `creative_mismatch`, `cold_campaign_too_aggressive`.

### Ordem da operação

Aprovação: clique em Aprovar → diálogo abre → usuário escolhe motivo(s) → sistema grava feedback → se sucesso, segue o fluxo atual de aprovação (executor humano já existente) → se falha, mostra erro e mantém o diálogo aberto.

Recusa: clique em Recusar → diálogo abre → usuário escolhe motivo(s) → sistema grava feedback → se sucesso, segue o fluxo atual de recusa (incluindo o modo `regenerate` quando aplicável) → se falha, mostra erro e mantém o diálogo aberto.

### O que fica fora de A.2 (vai para A.3)

- “Pedir revisão” (`needs_revision`);
- “Editar e aprovar” (`edited_then_approved`) com diff;
- Tela dedicada de gestão de preferências do tenant.

### O que A.2 NÃO faz

- Não altera prompts da IA, Policy Engine, Verdict Layer, Governance Layer, Action Derivation nem Tenant Memory Writer (ainda não existe).
- Não ativa autoexecução, não muda `kill_switch`, `human_approval_mode`, `autonomy_mode` ou `is_ai_enabled`.
- Não chama API da Meta por causa do feedback.
- Não influencia geração de sugestões, veredito, classificação ou escolha de ação.
- A IA continua em **100% aprovação humana**.

### Tenant piloto

Captura ativa para todos os tenants que usem o painel; piloto observacional segue restrito a “Respeite o Homem” (tenant `d1a4d0ed-8842-495e-b741-540a9a345b25`, conta Meta `act_251893833881780`). A arquitetura é global e reutilizável.

---

## Etapa 7.mem — Subfase B — Tenant Memory Store

> **Status:** ✅ Entregue — estrutura criada, sem influência sobre a IA
> **Data:** 2026-06-07
> **Escopo:** Backend de armazenamento. Sem UI, sem Writer, sem leitura no ciclo.

### Objetivo

Criar a base onde, no futuro, ficarão as **preferências aprendidas** de cada loja sobre como ela quer que a IA de tráfego trabalhe — produtos prioritários, campanhas protegidas, tolerância de CPA, estilo de copy preferido, motivos recorrentes de recusa, padrões de decisão.

Nesta subfase a memória **só nasce**. Não é populada automaticamente, não é lida por nenhum ciclo de IA, e não influencia veredito, sugestão, prompt nem execução.

### Estrutura criada

Uma única base de memória, escopada por: tenant + plataforma de vendas + plataforma de anúncios. Cada item guarda: tipo de memória, escopo, chave, valor, confiança (0 a 1), contagem de evidências, status, origem, primeira observação, última confirmação, última contradição, criação, atualização, arquivamento.

### Status permitidos

- `provisional` (padrão)
- `active`
- `archived`

Nada vira `active` automaticamente nesta subfase.

### Validações aplicadas

- Confiança entre 0 e 1.
- Contagem de evidências inteira e não-negativa.
- Status restrito à lista controlada.
- Tipo de memória, escopo e chave obrigatórios.
- Combinação tenant + plataforma de vendas + plataforma Ads + tipo + escopo + chave é única.
- Arquivamento é lógico (preenche `archived_at`).

### Isolamento por tenant

- Leitura/escrita restritas a membros da própria loja, via função padrão de acesso por tenant.
- Outras lojas não leem nem gravam memória do Respeite o Homem.
- Operações administrativas internas exigem filtro explícito de tenant.
- Sem rotas públicas/anônimas.

### O que a Subfase B NÃO faz

- Não transforma feedback humano (A.1/A.2) em preferência — isso é Subfase C (Writer).
- Não carrega memória no ciclo do Ads Autopilot — Subfase D.
- Não altera veredito, sugestões, prompts, Policy Engine, Governance Layer, Campaign Verdict Layer, Action Derivation nem executor — Subfase F.
- Não cria Universal Memory Registry.
- Não ativa autoexecução, não muda `kill_switch`, `human_approval_mode`, `autonomy_mode` nem `is_ai_enabled`.
- Não chama API da Meta.
- Não insere/altera dados de outros tenants.

### Validação técnica executada

- Migração aplicada; tabela criada vazia (0 registros).
- 5 políticas de acesso ativas (SELECT/INSERT/UPDATE/DELETE para membros do tenant + service role com filtro obrigatório).
- 9 testes específicos passando: campos obrigatórios, status válido/inválido, faixa de confiança, evidence_count, plataformas obrigatórias e invariante de “sem side-effects”.
- Nenhum ciclo de IA foi rodado.
- Nenhuma chamada à API da Meta.

### Próxima subfase recomendada

**Subfase C — Tenant Memory Writer.** Consome o histórico de feedback humano (A.1/A.2) e começa a propor itens `provisional` na memória, ainda sem influenciar a IA.

---

## Etapa 7.mem — Subfase C: Tenant Memory Writer

> **Status:** ✅ Entregue — Writer existe, sem influência sobre a IA
> **Data:** 2026-06-07
> **Escopo:** Backend determinístico. Sem UI, sem cron novo, sem ciclo de IA.

### Objetivo

Transformar feedbacks humanos (Subfases A.1/A.2) em **preferências aprendidas** na memória da loja (Subfase B). O Writer é o único caminho oficial pelo qual aprovações e recusas viram padrões reconhecíveis pela loja — e continua **observacional**: ainda não é lido pela IA.

### Fontes lidas

- Histórico imutável de feedback humano do Ads Autopilot (criado em A.1).
- Tenant Memory Store (criado em B) — para preservar status `archived` e detectar rebaixamento.

### O que o Writer grava

- Em um **ledger de evidências** novo (idempotente): registro de qual feedback já contribuiu para qual padrão, com peso e se sustenta ou contradiz o padrão.
- Em **preferências da loja**: cria/atualiza itens, atualiza confiança, contagem de evidências, última confirmação, última contradição e status.
- **Nunca** altera o feedback original.

### Tipos de memória suportados nesta subfase

- `approved_action_pattern` / `rejected_action_pattern` (derivados de cada decisão de aprovar/recusar, escopo "ação").
- `budget_preference` (motivos sobre orçamento).
- `context_gap_pattern` (motivos sobre falta de contexto).
- `strategy_conflict_pattern` (motivos sobre conflito com estratégia).
- `campaign_protection_candidate` (motivos pedindo para não mexer em campanha ganhadora).
- `product_priority_candidate` / `product_deprioritization_candidate` (motivos sobre priorização de produto).
- `creative_style_preference` / `copy_style_preference` (motivos sobre criativo/copy).
- `timing_preference` (motivos sobre momento da ação).

Motivos fora desse mapa **não** geram preferência por motivo nesta subfase (mas continuam contando como histórico e, se houver tipo de ação, geram o padrão de ação correspondente).

### Regras de feedback pontual / provisional / active

- **1 feedback isolado** → registro de evidência apenas, padrão fica `provisional` com confiança baixíssima. Nunca vira `active`.
- **2+ feedbacks consistentes** no mesmo padrão → padrão `provisional` com confiança crescente.
- **5+ evidências reais com pelo menos 80% de consistência e menos de 3 contradições recentes** → padrão pode subir para `active`.
- **Mesmo após `active`**, a memória ainda **não é usada pela IA** nesta subfase. O status apenas prepara as Subfases D e F.

### Peso de "usar como preferência futura"

- Feedback marcado como **"usar como preferência futura" (sim)** entra com peso 2.0 e adiciona bônus de confiança ao padrão.
- Feedback sem essa marcação entra com peso 1.0 e não recebe o bônus.
- Feedback com "usar como preferência futura" **falso** segue sendo registrado, mas sozinho não eleva o padrão a `active`.

### Regra de contradição

- Aprovar uma ação registra **contradição** automática contra o padrão espelho de "recusar a mesma ação", e vice-versa.
- Contradição atualiza `last_contradicted_at` e reduz a confiança.
- **3 contradições recentes (últimos 30 dias)** rebaixam um padrão `active` para `provisional`. A memória nunca é apagada — só rebaixada ou arquivada explicitamente.

### Cálculo de confiança (determinístico, sem LLM)

`confiança = consistência × volume + bônus_preferência − penalidade_contradições`, sempre entre 0 e 1, arredondada em 4 casas. Volume cresce até atingir 5 evidências. Bônus de preferência é limitado a +0,15. Penalidade por contradições recentes é limitada a −0,40.

### Idempotência

- Cada feedback só pode ser aplicado uma vez por padrão (chave única `tenant + feedback + plataforma de vendas + plataforma Ads + tipo + escopo + chave`).
- Reexecutar o Writer **não duplica** contagem de evidências.
- O ledger preserva auditoria de quais feedbacks sustentam cada preferência.

### Isolamento por tenant

- Writer só roda com privilégios elevados (chamada server-to-server controlada) e sempre escopado a um `tenant_id` informado.
- Ledger e memória só são visíveis para membros do próprio tenant.
- Não toca em dados de outras lojas.

### O que a Subfase C NÃO faz

- Não usa LLM para interpretar texto livre.
- Não carrega a memória no ciclo do Ads Autopilot.
- Não altera veredito, sugestão, prompt, Policy Engine, Governance Layer, Campaign Verdict Layer, Action Derivation nem executor.
- Não altera status de sugestões.
- Não chama a Meta. Não ativa autoexecução.
- Não muda `kill_switch`, `human_approval_mode`, `autonomy_mode` nem `is_ai_enabled`.
- Não cria cron recorrente nesta etapa (execução é manual e controlada).
- Não cria UI de gestão de preferências (fica para Subfase futura).
- Não toca na Base Universal (fora desta etapa).

### Validação técnica executada

- Migração do ledger aplicada; tabela criada vazia (0 registros).
- 20 testes específicos do Writer passando: derivação de evidências, peso da preferência, espelho de contradição, promoção a `active` somente com 5+ evidências e 80%+ consistência, rebaixamento por 3 contradições recentes, preservação de `archived`, confiança sempre em [0,1] e invariante de "sem side-effects" no módulo puro.
- Nenhum ciclo de IA foi rodado para validar esta entrega.
- Nenhuma chamada à API da Meta.
- Nenhuma autoexecução ativada.

### Próxima subfase recomendada

**Subfase D — Leitura observacional da memória.** A IA passa a **ler** a memória do tenant durante o ciclo apenas para registrar telemetria (o que faria diferente se considerasse a memória), ainda **sem influenciar** o veredito. Só na Subfase F a memória começa a influenciar decisões.

## Etapa 7.mem — Subfase D: Leitura Observacional da Tenant Memory

**Status:** Entregue. Modo estritamente observacional. **Nenhum ciclo de IA foi rodado para validar.**

### Objetivo

Permitir que o Ads Autopilot **carregue** a memória do tenant durante o ciclo, **sem usar essa memória para alterar nada**. É a ponte técnica para a futura Subfase F (influência real), construída de forma que possa coexistir com memória vazia, parcial ou completa.

### Como a memória é carregada

- Helper puro `readTenantMemoryObservational` + `filterApplicableMemories` + `buildMemoryObservation` (testáveis sem banco).
- A leitura real acontece **uma única vez por ciclo** no coletor de contexto do Strategist (`collectStrategistContext`), filtrando por `tenant_id` + `ads_platform` dos canais configurados + status em `['provisional','active']`.
- Sem `tenant_id` ou sem nenhum canal configurado, a leitura é pulada (sem consulta pesada).
- Se a consulta falhar, a falha é absorvida: a observação registra `tenant_memory_fetch_failed_observational_only` e o ciclo segue normalmente.

### Onde a observação é registrada

- Campo `tenant_memory_observation` anexado ao retorno do contexto do Strategist (consumível por logs/telemetria, **não** consumido pelo prompt nesta subfase).
- Log estruturado `[ads-autopilot-strategist][...][tenant-memory-observation]` por execução, com:

```json
{
  "tenant_memory_observation": {
    "mode": "observational_only",
    "memory_candidates_count": 0,
    "memory_ids_considered": [],
    "statuses_considered": [],
    "applied_to_decision": false,
    "reason": "tenant_memory_empty_or_not_applicable"
  }
}
```

### Compatibilidade com memória vazia

- Tenant piloto (Respeite o Homem, `d1a4d0ed-8842-495e-b741-540a9a345b25`, Meta `act_251893833881780`) pode ter zero memórias hoje. A entrega foi desenhada para esse cenário: o helper devolve lista vazia, a observação registra `memory_candidates_count: 0` com motivo explícito, e nenhuma decisão muda.

### O que a Subfase D NÃO faz

- Não altera veredito, sugestão, prompt, Policy Engine, Governance Layer, Campaign Verdict Layer, Action Derivation, status de sugestão nem execução.
- Não altera `policy_check_result` nem observações já existentes (anexa um campo novo dedicado).
- Não chama a Meta. Não chama LLM. Não cria cron. Não cria UI.
- Não muda `kill_switch`, `human_approval_mode`, `autonomy_mode` nem `is_ai_enabled`.
- Não vaza memória entre tenants (filtro server-side por `tenant_id` + revalidação client-side em `filterApplicableMemories`).

### Validação técnica executada

- 21 testes específicos do reader passando (`src/test/ads-autopilot-memory-reader.test.ts`): memória vazia, provisional, active, isolamento por tenant, filtros por `ads_platform`/`sales_platform`/`objective`/`scope`/`memory_type`/`key`/`min_confidence`, falha do fetcher absorvida, ausência de fetch/supabase/Meta no módulo puro, e invariante `applied_to_decision = false` em todos os cenários.
- Nenhum ciclo de IA (Analyze/Strategist/Guardian) foi rodado para validar esta entrega.
- Nenhuma chamada à API da Meta.
- Nenhuma autoexecução ativada.

### Próxima subfase recomendada

**Subfase F — Influência real da memória.** A IA passa a usar as preferências aprendidas para ajustar sugestões e prompts, mantendo 100% de aprovação humana. Antes de F, recomenda-se validar manualmente no painel do Respeite o Homem que o log `tenant-memory-observation` aparece nos próximos ciclos do Strategist.

## Etapa 7.mem — Subfase F.1: Tenant Preference Guard compartilhado

### Objetivo

Criar uma camada **única, pura e determinística** que avalia se uma sugestão rascunhada do Ads Autopilot deve ser mantida, bloqueada, rebaixada, suavizada, enriquecida com rationale ou priorizada com base na Tenant Memory.

O Guard existe e é totalmente testável, mas **ainda não é plugado em nenhum gerador** (Analyze, Strategist, Guardian, gatilho determinístico de orçamento, criativos ou experiments). O plug ocorre apenas a partir da Subfase F.2 em diante, e sempre em modo silencioso primeiro.

### Princípios

- **Puro/determinístico:** sem LLM, sem rede, sem aleatoriedade.
- **Sem banco:** as memórias chegam **como entrada**, carregadas previamente pelo Reader da Subfase D. O Guard nunca consulta o banco diretamente — isso evita duplicar leitura, custo e divergência.
- **Sem Meta, sem cron, sem execução, sem aprovação automática.**
- **Falha aberta:** qualquer erro interno devolve a recomendação original com `fail_open: true` no trace.

### Contrato

Entrada:

- `tenant_id`, `ads_platform`, `sales_platform`, `action_type`, `objective`;
- `campaign_id`/`product_id` quando existirem;
- `draft` (a sugestão rascunhada pelo gerador);
- `memories` (linhas já carregadas pelo Reader D);
- `governance` (flags já calculadas pelas camadas superiores: plataforma, Governance Layer, Policy Engine, kill switch, requisitos explícitos do tenant);
- `context` opcional.

Saída:

- `recommendation` — a sugestão original ou ajustada;
- `trace` — bloco de rastreabilidade (`influence_trace`).

### Influence types implementados

- `none` — nada mudou.
- `block` — sugestão rebaixada para `needs_human_review` por preferência active contrária.
- `downgrade` — variação do block (reservada para evoluções futuras; nesta versão é coberta pelo block que muda status).
- `soften` — parâmetro de orçamento reduzido para o limite conservador aprendido.
- `enrich_rationale` — apenas anexa observação ao rationale (único efeito possível para memórias `provisional`).
- `prioritize` — marca prioridade `high` quando a sugestão está alinhada a preferência active aprovada.

### Regras por status da memória

- **active** — pode bloquear, suavizar, priorizar ou enriquecer rationale.
- **provisional** — só pode enriquecer rationale. **Nunca bloqueia sozinha.**
- **archived** — ignorada.

### Hierarquia de decisão (não negociável)

1. Segurança / plataforma.
2. Governance Layer.
3. Policy Engine.
4. Matriz por objetivo / regras técnicas do canal.
5. Configurações explícitas do tenant.
6. Tenant Memory `active`.
7. Tenant Memory `provisional`.
8. Dados atuais da campanha.

Se qualquer camada superior já travou a ação (`platform_locked`, `governance_blocked`, `policy_blocked`, `kill_switch`), o Guard **não aplica influência alguma**. Se a ação é exigida por configuração explícita do tenant (`tenant_explicit_required`), a memória **não pode bloquear**.

### Bloco de rastreabilidade (`influence_trace`)

Toda execução do Guard produz:

- `tenant_memory_used` (bool);
- `memory_ids_used`;
- `memory_statuses_used`;
- `influence_type`;
- `before_recommendation`;
- `after_recommendation`;
- `why_memory_applied`;
- `why_memory_did_not_apply`;
- `applied_to_decision` (`true` apenas quando o rascunho retornado de fato mudou);
- `fail_open` (quando algo falhou e devolvemos o original).

### O que a Subfase F.1 NÃO faz

- Não consulta banco.
- Não é plugada em Analyze, Strategist, Guardian, gatilho determinístico de orçamento, criativos ou experiments.
- Não altera nenhuma sugestão real.
- Não altera UI/UX, prompts, fluxo de aprovação/recusa, Writer (Subfase C), Reader (Subfase D), Policy Engine, Governance Layer, Campaign Verdict Layer, Action Derivation, executor.
- Não chama Meta. Não usa LLM. Não cria cron. Não ativa autoexecução.

### Validação técnica executada

- 14 testes específicos do Guard passando (`src/test/ads-autopilot-tenant-preference-guard.test.ts`): memória vazia, sem aplicabilidade, provisional somente enriquece, active bloqueia, active suaviza orçamento, active prioriza, archived ignorada, governance bloqueia (memória perde), configuração explícita do tenant sobrepõe bloqueio, fail-open em input inválido, isolamento por `tenant_id`, isolamento por `ads_platform`, `influence_trace` sempre presente, ausência textual de imports a Supabase/Meta/LLM/`fetch` no módulo.
- Nenhum ciclo de IA (Analyze/Strategist/Guardian) foi rodado.
- Nenhuma chamada à API da Meta.
- Nenhuma autoexecução ativada.

### Próxima subfase recomendada

**Subfase F.2 — Plug do Guard no gatilho determinístico de orçamento, em modo silencioso primeiro** (registra o trace e o que aconteceria, sem alterar o output real). Só após validação de F.2 com feedback real do tenant piloto, evoluir para F.3 (Analyze), F.4 (Strategist), F.5 (rationale exposto ao lojista) e F.6 (validação com feedback real).

---

## Etapa 7.mem — Subfase F.2: Plug silencioso no gatilho determinístico de orçamento

### Objetivo

Conectar o Tenant Preference Guard (F.1) ao gatilho determinístico de propostas de orçamento do Ads Autopilot, **exclusivamente em modo silencioso**. Nesta subfase o Guard simula o que faria com base na Tenant Memory, registra rastreabilidade junto à proposta gerada, e a sugestão real continua exatamente igual à versão pré-Guard.

### Escopo

- O Guard é plugado **apenas** no gatilho determinístico de orçamento (gerador de propostas `adjust_budget` baseadas em CPA 7d vs 14d, restrito ao tenant Respeite o Homem e à conta `act_251893833881780`).
- Analyze amplo (LLM), Strategist, Guardian, criação de campanha, geração de criativo, experiments e pausas continuam **sem** Guard plugado.
- Tenant piloto: Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`). Outros tenants não são afetados.

### Como o modo silencioso funciona

1. Antes de iterar as campanhas elegíveis, o gatilho carrega uma única vez as memórias observacionais do tenant para a plataforma `meta` (Subfase D / Reader). Memória vazia é esperada e tratada com `memory_candidates_count = 0`.
2. Para cada proposta `adjust_budget` gerada, o gatilho:
   - constrói um rascunho equivalente (mapeado para `increase_budget`/`decrease_budget` apenas para fins de simulação, já que o Guard reconhece esses tipos para regras de soften);
   - chama `applyTenantPreferenceGuard(...)`;
   - **descarta** `guardOutput.recommendation`;
   - persiste a proposta original intacta (mesmo `action_type`, `status`, `change_pct`, `current_daily_budget_cents`, `new_budget_cents`, `proposed_daily_budget_cents`, `reasoning`).
3. O trace é anexado em `action_data.tenant_memory_silent_trace`. Esse campo é puramente observacional e **não** sobrescreve `policy_check_result`, `observation` (preenchidos pelo helper de observação do Policy Engine), nem nenhum campo de orçamento.
4. Um log estruturado `[ads-autopilot-analyze][...][tenant-memory-guard-silent]` é emitido com `mode`, `candidates`, `influence_type`, `applied_to_decision=false` e `real_changed=false` para inspeção rápida.

### Campos do trace silencioso

`tenant_memory_silent_trace` contém:

- `tenant_memory_guard_mode = "silent"`
- `tenant_memory_used`
- `memory_candidates_count`
- `memory_ids_used`, `memory_statuses_used`
- `influence_type` (none | block | soften | enrich_rationale | prioritize)
- `before_recommendation` (estado real persistido)
- `simulated_after_recommendation` (o que o Guard faria, somente para registro)
- `real_recommendation_changed = false` (invariante)
- `applied_to_decision = false` (invariante)
- `why_memory_applied`, `why_memory_did_not_apply`
- `fail_open` (true se o Guard ou a leitura de memória falhar)
- `simulated_at`

### Chave de segurança

Constante interna `TENANT_MEMORY_GUARD_MODE` com default `"silent"`. Não há, nesta subfase, qualquer caminho que ative `"active"` (alteração real). `human_approval_mode`, `autonomy_mode`, `is_ai_enabled` e `kill_switch` permanecem como única fonte de verdade da governança e não são tocados pela F.2.

### Custo / leitura única

A leitura de memória acontece **uma única vez** por execução do gatilho determinístico (não por campanha), reaproveitando o array em todas as iterações. Sem novas chamadas a Meta, sem LLM, sem cron novo.

### O que a Subfase F.2 NÃO faz

- Não altera sugestão real, `action_type`, `action_class`, `status`, orçamento sugerido nem orçamento persistido.
- Não bloqueia, rebaixa, suaviza nem prioriza sugestões reais.
- Não altera fluxo de aprovação/recusa, approval queue, Policy Engine, Governance Layer, Action Derivation ou executor.
- Não ativa autoexecução. Não chama Meta API. Não roda Analyze/Strategist/Guardian.
- Não cria UI nova, painel de memória, aviso ao lojista ou indicação visual.
- Não modifica o Writer (Subfase C) nem o Guard (Subfase F.1).
- Não toca em outro tenant.

### Validação técnica executada

- 6 testes específicos passando (`src/test/ads-autopilot-budget-trigger-guard-silent.test.ts`): memória vazia, provisional, active bloqueante simulada, active de soften simulada, fail-open em input inválido, e invariante de que o trace nunca sobrescreve `policy_check_result`.
- Nenhum ciclo de IA (Analyze/Strategist/Guardian) foi rodado.
- Nenhuma chamada à API da Meta.
- Nenhuma autoexecução ativada.
- Apenas a edge function `ads-autopilot-analyze` (gatilho determinístico) recebeu o plug; nenhum outro gerador foi tocado.

### Próxima subfase recomendada

**Subfase F.2 ativa** — após o tenant piloto acumular alguns ciclos com `tenant_memory_silent_trace` e o usuário validar (a) que o trace está coerente, (b) que `applied_to_decision` e `real_recommendation_changed` permanecem `false` em todos os registros e (c) que nenhum gerador além do gatilho determinístico aparece com trace, promover a constante para `"active"` apenas no gatilho determinístico de orçamento. Só então avançar para F.3 (Analyze), F.4 (Strategist), F.5 (rationale exposto ao lojista) e F.6 (validação com feedback real).


---

## Quality Gate de criação de campanha (Etapa 7.qg)

### Problema

A IA estava entregando sugestões `create_campaign` no painel de aprovação humana com:

1. Produto/codinome inexistente no catálogo (ex.: "Fast Upgrade").
2. Divergência entre produto vinculado e copy/headline (ex.: Kit Banho vinculado, copy fala de Shampoo isolado).
3. Sem criativo anexado.
4. Sem landing/destino definido.
5. Orçamento agressivo (R$ 300/dia) em TOF frio sem nenhuma das bases acima.

O lojista não tinha como saber, dentro do painel, que essas sugestões estavam incoerentes. Ele só percebia ao abrir uma a uma. Risco: aprovação acidental de campanha que promove produto inexistente, queima de verba e desaprovação editorial pela Meta.

### Decisão

Criar um **Quality Gate** determinístico, puro e local, executado pelo gerador antes de persistir a sugestão. Quando o gate bloqueia, a sugestão é gravada com status `skipped`, jamais aparece como aprovável e fica registrada com `quality_gate.reason_codes` para auditoria e futuro aprendizado da memória do tenant.

O gate **não** chama LLM, **não** chama Meta, **não** consulta banco. Trabalha apenas com:

- argumentos da tool `create_campaign`
- produto vinculado já resolvido pelo Strategist
- catálogo de produtos do tenant já carregado no contexto da execução

### Regras

| Reason code | Quando dispara |
|---|---|
| `invalid_unknown_product_name` | `product_name` declarado mas não encontrado no catálogo |
| `invalid_product_catalog_mismatch` | Nenhum produto declarado nem vinculado |
| `invalid_product_copy_mismatch` | Produto vinculado não é mencionado na copy/headline |
| `invalid_offer_mismatch` | Outro produto do catálogo é mencionado na copy usando tokens exclusivos (Kit vs isolado, etc.) |
| `invalid_creative_product_mismatch` | Há criativo anexado mas copy diverge do produto vinculado |
| `invalid_missing_creative` | `creative_asset_id` e `creative_url` ambos nulos (criativo é obrigatório em `create_campaign`) |
| `invalid_missing_destination` | Objetivo de conversão/tráfego/vendas/leads sem `destination_url` |
| `invalid_cold_campaign_budget_too_aggressive` | TOF frio com `daily_budget_cents >= 20.000` somado a qualquer falha estrutural acima |

### Comportamento quando bloqueia

- `status = 'skipped'` na tabela `ads_autopilot_actions`
- `rejection_reason = 'Quality Gate v1.0.0: <lista de reason codes>'`
- `action_data.quality_gate = { ok:false, version, reason_codes, details, blocked_at }`
- Sugestão **não** entra na lista de pendentes (hook `useAdsPendingActions` filtra por `status='pending_approval'`)
- **Nada é executado**, nada vai para Meta, nenhuma autoexecução é ativada

### Fail-open

Se o próprio gate lançar exceção, o Strategist segue o fluxo normal (registra warning no log e devolve `pending_approval`). O gate nunca pode derrubar a geração de sugestões.

### O que NÃO mudou

- Campanhas de criação **continuam exigindo aprovação humana** quando o gate passa.
- Policy Engine, Governance Layer, Tenant Memory Writer e Tenant Preference Guard (F.1/F.2) não foram tocados.
- Autoexecução continua desligada.
- Nenhuma chamada de modificação à Meta foi feita.
- UI do painel não mudou. O modal de feedback não mudou (apenas o backend dele foi corrigido — ver abaixo).

### Correção do modal de feedback (Subfase A.2)

Erro reportado: `Failed to send a request to the Edge Function` ao confirmar recusa/aprovação.

Causa: a Edge Function `ads-autopilot-feedback-record` importava o validador de payload de um caminho do app (`../../../src/lib/...`) que **não existe no bundle deployado da Edge Function**. Isso fazia a função falhar no boot, sem nem chegar a executar — daí o erro genérico do cliente.

Correção: o contrato de validação foi movido para `supabase/functions/_shared/ads-autopilot/feedbackContract.ts` (cópia self-contained, mantida em paridade com a versão canônica do app). A Edge Function agora importa de um caminho válido em runtime.

Validação: chamada real à função com payload mínimo válido retornou `200 success: true` com `feedback_id` gerado e `side_effects` zerados (`autoexec_triggered=false`, `meta_api_called=false`, `suggestion_status_changed=false`). Nenhum efeito colateral.

### Tratamento das sugestões incoerentes existentes

As duas sugestões pendentes do tenant Respeite o Homem (`act_251893833881780`) foram quarentenadas com `status='skipped'` e `quality_gate.backfill=true`. Saíram da fila de aprovação. **Nenhum dado foi apagado** — campanhas Meta, insights, configurações, feedback, memória e catálogo de produtos seguem intactos.

### Próxima recomendação

Após observar 2–3 ciclos com o gate ativo no Strategist, avaliar:

1. Promover os reason codes do gate para o catálogo de `ads_autopilot_feedback_reason_codes` (hoje os códigos vivem só no payload do gate). Permite que o Tenant Memory Writer aprenda padrões do tipo "tenant rejeita campanhas sem destino".
2. Estender o gate para `create_adset` quando o Strategist passar a quebrar campanhas em conjuntos por gerador.
3. Considerar gate equivalente para `generate_creative` (bloquear geração de criativo para produto inexistente, evitando desperdício de crédito).

### Validação técnica executada

- 7 testes `vitest` específicos passando (`src/test/ads-autopilot-quality-gate.test.ts`) cobrindo: produto inexistente, divergência produto×copy ("Fast Upgrade" vinculado a Shampoo real), Kit×isolado, sem criativo, sem destino, TOF frio agressivo, e caso totalmente coerente que deve passar.
- Edge Function `ads-autopilot-feedback-record` re-deployada e testada com payload real → 200 success.
- Nenhum ciclo de Analyze/Strategist/Guardian rodado.
- Nenhuma chamada de modificação à Meta.
- Nenhuma autoexecução ativada.
- Subfase F.2 (Tenant Preference Guard silencioso no gatilho de orçamento) segue intacta — este gate é independente e atua em outro gerador.

## Quality Gate v1.1 + Preflight de produto/oferta/criativo (Etapa 7.qg.b)

### Evidência prática — 08/06/2026

Ciclo controlado `implement_campaigns` no tenant Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`, conta `act_251893833881780`):

- **21 propostas `create_campaign` geradas** em 3 sub-rodadas internas.
- **21/21 bloqueadas pelo Quality Gate v1.0** (0 aprováveis).
- Motivos principais:
  - `invalid_missing_creative`: 100% das propostas — Strategist não anexava `creative_asset_id` real do tenant.
  - Produto fantasma "Fast Upgrade" (não existe no catálogo): 6 propostas → `invalid_unknown_product_name`.
  - Divergência Kit Banho × copy de Shampoo isolado: 3 propostas → `invalid_offer_mismatch`.
- Nenhuma chamada de modificação à Meta. Nenhuma autoexecução. Nenhum dado alterado.

### Lacuna identificada

O Quality Gate v1.0 funcionou como rede de proteção, mas o problema real estava antes dele:

1. O Strategist em `implement_campaigns` **não referenciava o inventário de criativos do tenant** — propunha campanhas sem `creative_asset_id`/`creative_url`, o que sempre cai em `invalid_missing_creative`.
2. O prompt do Strategist permitia inventar codinomes comerciais ("Fast Upgrade") que não existem no catálogo.
3. O handler `generate_creative` rejeitava produto inexistente mas não tinha gate estruturado — gastava ciclos de LLM e podia consumir crédito de geração de imagem.

### Mudanças v1.1

1. **Preflight de criativo dentro do `create_campaign`**: antes do gate, o Strategist consulta `ads_creative_assets` (status=ready, mesmo `product_id`, mesmo `tenant_id`) e, se houver criativo válido, injeta `creative_asset_id`/`creative_url` automaticamente nos args. Sem criativo → o gate bloqueia em `invalid_missing_creative` (como deveria).
2. **Quality Gate v1.1**: novos reason codes:
   - `invalid_creative_not_in_tenant` — `creative_asset_id` referenciado não existe no inventário do tenant.
   - `invalid_creative_product_link_mismatch` — criativo do tenant é de outro produto.
3. **Preflight `generate_creative`** (`runGenerateCreativeQualityGate`): bloqueia geração antes de chamar `ads-autopilot-creative` quando:
   - Produto não existe no catálogo (`invalid_generate_creative_unknown_product`).
   - Copy/headline cita produto/Kit diferente do declarado (`invalid_generate_creative_offer_mismatch`).

   Status retornado: `skipped` com `quality_gate.reason_codes` — **não consome crédito de imagem**.
4. **Prompt do `implement_campaigns` reforçado**: regras invioláveis adicionadas para "PRODUTO REAL OBRIGATÓRIO", "COERÊNCIA PRODUTO × COPY × CRIATIVO" e "CRIATIVO EXISTENTE OBRIGATÓRIO" — e a regra "NÃO proponha create_campaign sem creative_asset_id do tenant vinculado ao mesmo produto" entra explicitamente na lista de proibições.

### O que NÃO mudou

- O Quality Gate continua **rígido** — nenhuma regra foi relaxada.
- Policy Engine, Tenant Memory, Tenant Preference Guard (F.1/F.2), autonomia e autoexecução: intocados.
- UI/UX: nenhuma alteração. Modal de aprovação/recusa e listas de pendentes preservados.

### Validação técnica executada

- **13 testes verdes** em `src/test/ads-autopilot-quality-gate.test.ts` (7 da v1.0 + 6 novos): produto fantasma, divergência Kit×isolado, criativo inexistente no tenant, criativo de outro produto, generate_creative com produto fantasma, generate_creative com copy divergente, e casos válidos que continuam passando.
- Nenhum ciclo real de IA executado nesta entrega (Analyze/Strategist/Guardian/Experiments todos parados).
- Nenhuma chamada de modificação à Meta.
- Nenhuma campanha real criada.
- Nenhum crédito de criativo consumido.

### Próxima recomendação

Após esta entrega, rodar **um ciclo controlado `implement_campaigns`** para validar em produção que:

1. Sugestões com criativo existente vinculado ao produto certo passam normalmente.
2. "Fast Upgrade" e Kit×Shampoo continuam bloqueados antes de chegarem à fila aprovável.
3. `generate_creative` para produto fantasma retorna `skipped` sem custo.
