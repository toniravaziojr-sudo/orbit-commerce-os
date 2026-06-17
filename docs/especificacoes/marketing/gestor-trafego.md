# Gestor de Tráfego IA — Especificação Completa

> **Status:** ✅ Ativo  
> **Versão:** 7.0.0 (Onda 3 — Insights aposentado, Avisos ativo)
> **Camada:** Layer 3 — Especificações / Marketing  
> **Rota:** `/ads`  
> **Extraído de:** `docs/especificacoes/marketing/marketing-integracoes.md` (Seção 5)  
> **Última atualização:** 2026-06-17

---

## Onda 3 (2026-06-17) — Resumo executivo da mudança

**Saiu do produto**

- Aba "Insights" do Gestor de Tráfego.
- Aba "Configurações Gerais" (orçamento, ROI, instruções, prompt estratégico, modo, funil, autonomia, UTM padrão — tudo agora vive por conta de anúncios).
- Sub-aba "Chat IA" dentro de cada conta (consolidado no Chat IA principal).
- Rotina semanal de geração de insights diagnósticos (`ads-weekly-insights`, jobid 74) — desativada em produção.
- Botão manual "Gerar Insights Agora".

**Entrou no produto**

- Aba "Avisos" (última posição) — lista de sinais diagnósticos detectados pelo ciclo da IA por conta, com severidade (informativo / atenção / urgente), tendência (alta / baixa / estável) e estados (aberto / visto / dispensado / virou proposta). Tabela: `ads_ai_warnings`.
- Aba "Chat IA" (antiga "Chat IA Global") — fonte única de chat, enxerga todas as contas.
- Aba "Desempenho" (antiga "Visão Geral").

**Nova regra de saída do ciclo da IA por conta**

1. Sinal com **ação concreta dentro das regras da conta** → proposta em "Aguardando Ação".
2. Sinal **diagnóstico relevante sem ação concreta** → aviso na aba "Avisos".
3. Sinal **irrelevante ou contexto puro** → fica só na memória interna da IA.

**Ordem final das abas principais**

1. Gerenciador
2. Chat IA
3. Aprendizado da IA
4. Desempenho
5. Avisos

**Anti-regressão**

- Aviso ≠ Proposta. Aviso nunca executa nada; proposta sempre exige aprovação humana antes de publicar.
- Nada de "IA global" — toda configuração que afeta execução vive por conta de anúncios.
- A tabela antiga `ads_autopilot_insights` foi preservada em banco como histórico, mas não é mais alimentada pelo ciclo da IA e não aparece na UI.

Memória de governança: `mem://constraints/ads-no-global-and-avisos-not-proposals`.



## Visão Geral

Pipeline autônomo de gestão de tráfego pago cross-channel (Meta, Google, TikTok) com IA. Utiliza arquitetura de **Motor Duplo** (Guardião + Estrategista) e 4 agentes especializados para análise, otimização e criação de campanhas.

### Escopo (importante)

Este módulo considera **exclusivamente mídia paga** (Meta, Google, TikTok). Receita geral da loja virtual, marketplaces e canais orgânicos (direto, e-mail, WhatsApp, SEO) **não** entram aqui — esses dados vivem no Dashboard da Central de Comando (`mem://features/command-center/dashboard-by-channel-standard`).

### Cards de métricas (v6.12.0)

| Card | Fonte | Significado |
|------|-------|-------------|
| **Investimento Total** | `meta_ad_insights + google_ad_insights + tiktok_ad_insights` | Gasto reportado pelas plataformas no período |
| **Receita Atribuída (Ads)** | `conversion_value_cents` dos pixels (Meta + Google + TikTok) | Receita reportada pelos pixels — padrão de mercado |
| **Receita Real de Ads (pagos)** | `orders` (status efetivado) × `order_attribution` (last-click: fbclid/gclid/ttclid ou utm_medium paid) | Caixa real de pedidos pagos cuja origem rastreada foi mídia paga |
| **ROAS Atribuído** | Receita Atribuída ÷ Investimento | Comparável entre canais e com o que cada plataforma reporta |
| **ROAS Real (Ads)** | Receita Real de Ads ÷ Investimento | Verdade de caixa: quanto cada R$1 investido virou venda paga atribuível a Ads |
| **CPA Médio** | Investimento ÷ Conversões | Custo por aquisição reportado pelas plataformas |
| **Conversões** | Soma de conversões dos pixels | Volume reportado pelos pixels |

**Critério "venda realizada"** (igual ao Dashboard e Relatórios): status do pedido em `paid | processing | ready_to_invoice | shipped | delivered`. Pedidos pendentes, abandonados ou cancelados **nunca** entram.

**Critério "veio de Ads" (last-click)**: pedido com `fbclid` (Meta), `gclid` (Google), `ttclid` (TikTok) ou `utm_medium` em `cpc|paid|paid_social|ads`. Tráfego orgânico, direto, e-mail, WhatsApp e marketplaces ficam fora.

### Por que ROAS Atribuído ≠ ROAS Real (e como interpretar)

São duas verdades distintas e ambas devem coexistir no Overview:

- **ROAS Atribuído** = o que **a plataforma diz** que gerou. Usa janelas estendidas da Meta/Google/TikTok (até 7d clique + 1d view-through) e inclui view-through. Tende a **superestimar**.
- **ROAS Real (Ads)** = o que **o caixa confirma** como vinda de mídia paga rastreada. Só conta pedido pago cujo `fbclid`/`gclid`/`ttclid` ou `utm_medium` paid sobreviveu até o checkout. Tende a **subestimar** quando a cobertura de rastreio é baixa.

A diferença entre os dois **não é bug** — é a janela de atribuição da plataforma vs caixa real auditável. O número certo do gestor para decisão de investimento é o **ROAS Real**, desde que a cobertura de rastreio esteja alta (≥50%).

### Alerta de cobertura baixa (v6.12.1)

Quando, no período selecionado, houve investimento em Ads e **menos de 50% dos pedidos pagos** trazem identificador rastreável (`fbclid`/`gclid`/`ttclid` ou `utm_medium` paid), o Overview exibe um card de alerta amarelo explicando:

1. Por que o ROAS Real está artificialmente baixo (clique perdido quando o cliente volta por outro canal/dispositivo).
2. Que a solução é forçar UTM em **todas** as campanhas Meta/Google/TikTok (`utm_source`, `utm_medium=cpc`, `utm_campaign`).
3. Que ao subir a cobertura, o ROAS Real passa a ser fonte confiável de decisão.

Cobertura = `pedidos_pagos_com_atribuicao_ads / total_pedidos_pagos_no_periodo`. Calculada no mesmo hook do card de Receita Real de Ads, sem custo extra de query relevante.

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

#### Hierarquia de Autoridade (Supremacia do Prompt Estratégico — v6.20)

A partir desta versão a ordem de prioridade é fixa e o **prompt estratégico do lojista é a fonte de verdade máxima**. Toda regra automática abaixo dele é tratada como recomendação e **nunca bloqueia** uma ação por conflito editorial.

| Prioridade | Fonte | Descrição |
|------------|-------|-----------|
| **1 (máxima)** | Prompt estratégico do lojista (global e por conta) | Vence qualquer regra ou diretriz abaixo. Conflitos viram avisos, não bloqueios. |
| **2** | Configurações manuais do lojista | ROI, ROAS, orçamento, splits, estratégia, funil. |
| **3** | Funções/categorias declaradas dos produtos | Contexto para inferência de categoria e diretrizes. |
| **4** | Diretrizes comerciais das plataformas (Meta/Google/TikTok) | Consultivas — geram aviso quando contrariadas no prompt. |
| **5 (fallback)** | Templates e defaults do sistema | Aplicados apenas quando nada acima existe. |

> **Regra do Prompt (v6.20 — Supremacia):** O prompt estratégico vence qualquer regra automática. Se houver conflito com configuração manual, função do produto ou diretriz de plataforma, o sistema **avisa o lojista** no bloco "Avisos do prompt estratégico" (logo acima do campo de prompt em Configurações da IA) mas **executa o que o prompt manda**. A decisão sobre seguir com o risco é do lojista. Memória de governança: `mem://constraints/strategic-prompt-supremacy`.
>
> **Fase 2 (v6.20.1 — Analisador ativo):** O bloco "Avisos do prompt estratégico" agora é alimentado pelo motor `ai-prompt-conflict-analyze`, que cruza o prompt salvo com (a) diretrizes comerciais ativas das plataformas e (b) funções/categorias declaradas dos produtos do tenant. Resultados ficam em `ai_prompt_conflict_cache` com chave `(tenant, scope, channel, ad_account_id, prompt_hash)` — análise é executada uma vez por hash de prompt para evitar custo recorrente. Avisos têm severidade `informativo`/`atencao`/`critico`, origem `platform_guideline`/`product_function`/`product_category`/`compliance` e podem ser ignorados individualmente pelo lojista (persistido em `ignored_keys`). Nenhum aviso bloqueia salvamento, geração ou execução.
>
> **Fase 3 (v6.20.2 — Propagação aos fluxos secundários):** A hierarquia da supremacia do prompt foi propagada para o chat legado (`ads-chat`) — agora o system prompt das duas versões (`ads-chat` e `ads-chat-v2`) declara explicitamente a mesma ordem fixa: prompt estratégico > configurações manuais > funções/categorias do produto > diretrizes de plataforma (consultivas) > defaults do sistema. O resolvedor de diretrizes (`guidelineResolver`) permanece consultivo e não é consumido por nenhum gate bloqueante.

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
| 3 | Upload de Imagem | `POST /{ad_account_id}/adimages` em **multipart/form-data com bytes da imagem** (download da URL pública → upload binário). Fallback por URL apenas em falha transitória de download. Retorna `image_hash` usado no criativo. |
| 4 | Criar Anúncio | `POST /{ad_account_id}/ads` com `ad_creative_id`, `destination_url` + UTM params e `status` scheduling |

**Regras:**
- Toda a cadeia (Campanha → AdSet → Ad) usa scheduling nativo: dentro da janela 00:01-04:00 BRT → `ACTIVE` imediato; fora → `ACTIVE` + `start_time` futuro (aparece como "Programada" no Meta Ads Manager)
- Revalidação de orçamento é feita **no momento da execução** (não no momento da aprovação)
- Se qualquer etapa falhar, o erro é registrado e o status da ação é marcado como `error`
- IDs da Meta (`meta_campaign_id`, `meta_adset_id`, `meta_ad_id`) são registrados em `rollback_data` para reversão futura
- **Fallbacks**: Campos não especificados pela IA usam defaults sensatos (`geo_locations` → `{countries: ["BR"]}`, `billing_event` → `"IMPRESSIONS"`, `conversion_event` → inferido do objetivo)

#### Upload binário de imagens para a Meta (v6.21 — 2026-06-16)

A partir de 2026-06-16, toda imagem enviada ao endpoint `/adimages` é transmitida em **multipart/form-data com os bytes brutos** da imagem, nunca por URL pública. Motivo: o upload por URL exige a capacidade *image scraper* na conta de anúncios — capacidade que a Meta concede de forma inconsistente e que vinha bloqueando publicações com erro genérico "capability". O upload binário não depende dessa capacidade e é o modo recomendado pela documentação oficial da Meta (Marketing API — Ad Images).

**Fluxo:**
1. Edge `ads-autopilot-publish-proposal` baixa a imagem do criativo (URL pública do Drive/Storage do tenant) via `fetch`.
2. Monta `FormData` com o blob da imagem e envia para `POST /{ad_account_id}/adimages` com o access token da conta.
3. Captura o `image_hash` retornado e usa em `object_story_spec.link_data.image_hash` ao criar o `adcreative`.
4. **Fallback controlado**: em falha de download (rede/CDN), tenta uma única vez o upload por URL e registra o evento em `lifecycle.events` para observabilidade.

**Proibido:**
- Reintroduzir upload exclusivo por URL como caminho principal.
- Publicar criativo sem `image_hash` validado.
- Esconder a falha de download — sempre registrar no lifecycle da proposta.

Regra anti-regressão registrada em `mem://constraints/meta-adimages-binary-upload`.

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

### Hierarquia Prompt vs Configurações Manuais (v6.20 — Supremacia do Prompt)

O prompt estratégico (`user_instructions`) é **soberano**:
- Vence qualquer configuração manual, função declarada de produto ou diretriz de plataforma.
- Conflitos viram **avisos** no bloco "Avisos do prompt estratégico" da tela de Configurações da IA (acima do campo de prompt). Nada é bloqueado.
- A trava de prontidão criativa (`creativeReadinessGate`) só bloqueia por falhas técnicas reais (sem conexão, sem produto/imagem/preço, sem UTM/orçamento/público). Itens editoriais (descrição, tipo/função do produto) viram avisos.
- **Descontinuado em 2026-06-16:** o bloco "Regras da Marca para Criativos" (tom de voz, promessa principal aprovada, claims permitidas, claims proibidas, restrições, do_not_do) **não existe mais** no Gestor de Anúncios — nem na configuração global, nem por conta de anúncios. A IA usa exclusivamente o prompt estratégico + diretrizes das plataformas + feedback de propostas. Esses campos seguem em `tenant_brand_context` apenas para uso do **modo Vendas (WhatsApp)** como guardrail de promessas e termos proibidos.
- Memória de governança: `mem://constraints/strategic-prompt-supremacy`.

### Preview de Ações (StructuredProposalModal + inline)

A partir de v6.13.0, todas as propostas de planejamento e criação passam a usar **um único dialog estruturado** (`StructuredProposalModal`), e as ações operacionais simples permanecem **inline no card**, sem abrir dialog.

**Regras de roteamento por tipo de ação:**

| Tipo de Ação | Onde aparece | Conteúdo |
|---|---|---|
| `strategic_plan` | Modal unificado, **apenas aba "Visão Geral"** (sem sidebar Campanha/Conjuntos/Anúncios) | Diagnóstico, Estratégia recomendada, Próximas ações sugeridas, Limitações observadas, Impacto esperado |
| `create_campaign` (e duplicações de campanha) | Modal unificado completo | Visão Geral · Campanha · Conjuntos · Anúncios |
| `create_adset` (e duplicações de conjunto) | Modal unificado | Visão Geral + Conjunto |
| `generate_creative` (criativo novo / duplicação de anúncio) | Modal unificado | Visão Geral + Anúncio (criativo, copy, título, CTA, conjunto vinculado) |
| `adjust_budget` / `allocate_budget` | **Inline no card** (sem dialog) | Antes → depois, variação %, raciocínio resumido. Botões Aprovar/Ajustar/Rejeitar no próprio card |
| `pause_campaign` | **Inline no card** (sem dialog) | Campanha alvo, gasto atual, economia/dia estimada. Botões Aprovar/Rejeitar no próprio card |
| `activate_campaign` | Oculto da aprovação humana (interno) | — |

**Footer fixo do modal:** `Recusar proposta` · `Ajustar proposta` · `Aprovar` (rótulo do Aprovar muda por contexto: "Aprovar plano" para `strategic_plan`, "Aprovar estratégia e gerar criativos" para Etapa 1 do fluxo two-step, "Aprovar" nos demais).

**Botão único no card** para propostas que abrem modal: **"Visualizar proposta"** (com `Eye` icon). Não há mais botões Aprovar/Ajustar/Rejeitar inline para essas — toda decisão acontece dentro do modal.

**Anti-processamento (custo IA):** Abrir / navegar entre abas / recusar / iniciar ajuste **não disparam nenhuma chamada de IA**. Só `Aprovar e gerar criativos` (Etapa 1 two-step) consome créditos, e ainda assim **não publica a campanha**.

**Gates de bloqueio de aprovação** continuam ativos no modal: completude estrutural, compatibilidade da plataforma e adequação produto × público (apenas em Etapa 1 do fluxo two-step). Plano Estratégico **não passa por esses gates**, mas passa obrigatoriamente pelo **guard canônico do contrato estratégico**. Se o plano estiver com `status='incomplete'`, `action_data.contract.ok=false`, `action_data.metadata.validation_status!='valid'` ou `action_data.metadata.is_approvable!=true`, o modal mostra banner de pendências, o card mostra badge **Plano incompleto** e o botão **Aprovar plano** fica desabilitado no cliente e no servidor.

### Guard canônico obrigatório do Plano Estratégico (rev 2026-06-12)

#### Pontos de entrada mapeados

| Entrada | Arquivo | Situação após correção |
|---|---|---|
| Modo Piloto Inicial / análise manual por conta | `supabase/functions/ads-ai-initial-analysis/index.ts` → `ads-autopilot-strategist` | **Canônico** — passa por preflight + guard antes de persistir `strategic_plan` |
| Análise global | `supabase/functions/ads-ai-initial-analysis/index.ts` → `ads-autopilot-strategist` | **Canônico** — cada conta passa pelo mesmo guard |
| Aprovação do plano | `supabase/functions/ads-autopilot-execute-approved/index.ts` | **Fail-closed** — plano `incomplete`/contrato inválido não aprova e não gera filhas |
| Geração de filhas do plano aprovado | `supabase/functions/ads-autopilot-strategist/index.ts` (`implement_approved_plan`) | **Fechado** — só roda depois da aprovação do plano canônico |
| Chat IA v2 criando plano direto | `supabase/functions/ads-chat-v2/index.ts` | **Legado bloqueado** — salva como `incomplete`, visível para revisão, nunca aprovável |
| Chat IA legado observacional | `supabase/functions/ads-chat/index.ts` | **Somente observabilidade** — registra artefato executado, não entra como plano aprovável |

#### Ordem obrigatória

Todo plano que possa virar aprovável deve passar por:

`Preflight determinístico → normalizeAndValidateStrategicPlanForApproval(plan, preflight) → persistência`

#### O que o guard faz

- normaliza formatos legados (`TOF`, `Topo de Funil`, `Remarketing`, `Teste`) para o payload canônico;
- converte frio/prospecção para `campaign_type='prospecting'`, `campaign_intent='acquisition'`, `funnel_stage='tof'`, `affected_funnel='cold'`;
- identifica frio/prospecção também por sinais legados: `funnel_stage=tof/cold`, `campaign_intent=acquisition`, audiência broad/lookalike/aquisição, descrições como `Homens 30-65, Brasil`;
- **força** `audience_exclusions` canônico quando o público de clientes existe;
- **força** a exclusão também por **adset** (`audience_exclusions`, `excluded_audience_ids`, `targeting.excluded_custom_audiences`) em todo conjunto frio/prospecção;
- **cria pendência** `pending_dependency='customer_audience_not_detected'` quando o público não existe;
- retorna `approval_status='incomplete'` quando o contrato ficar incompleto;
- anexa `action_data.contract`, `action_data.approval_status` e `action_data.metadata` para UI + servidor lerem a mesma fonte;
- anexa `campaign_account_snapshot` com status real/effective_status/allowed_actions por campanha existente.

#### Metadata obrigatória do plano salvo

Todo novo Plano Estratégico salvo pelo fluxo canônico carrega em `action_data.metadata`:

```json
{
  "source_flow": "strategist_start | strategist_monthly | strategist_weekly | approval_endpoint",
  "schema_version": "strategic_plan_v2",
  "preflight_version": "g.1-rev2",
  "validator_version": "1.2.0",
  "guard_version": "1.2.0",
  "normalized_at": "<iso>",
  "validated_at": "<iso>",
  "validation_status": "valid | invalid",
  "validation_errors": [],
  "is_approvable": true,
  "analysis_run_id": "<uuid|null>"
}
```

Se qualquer um desses campos estiver ausente, o plano é tratado como **legado/incompleto** e não pode ser aprovado.

#### Campaign Account Snapshot (fonte de verdade para status real)

O plano salvo carrega um snapshot por campanha existente da conta para impedir ação incompatível com o estado real. Cada item contém:

- `campaign_id`
- `campaign_name`
- `status`
- `effective_status`
- `configured_status`
- `is_active_for_planning`
- `is_paused`
- `current_daily_budget_brl`
- `metrics_7d`
- `metrics_30d`
- `funnel_stage`
- `allowed_actions[]`

Regras do snapshot:

- campanha já pausada **não pode** receber `pause_campaign`;
- campanha pausada só aceita `keep_paused`, `use_as_reference`, `reactivate`, `monitor_historical` ou `request_review`;
- campanha ativa aceita `maintain`, `reduce_budget`, `pause_campaign`, `monitor` ou `request_review`;
- status desconhecido só aceita `request_review`.

#### Regra obrigatória de exclusão de clientes em frio/prospecção

Quando o público de clientes/compradores existe no preflight, toda ação de aquisição/prospecção passa a carregar no nível da ação **e de cada adset frio/prospecção**:

```json
"audience_exclusions": {
  "customers": true,
  "customer_audience_detected": true,
  "customer_audience_id": "<id>",
  "customer_audience_name": "<nome>",
  "reason": "Campanha de aquisição/prospecção deve excluir clientes/compradores atuais."
}
```

Quando o público não existe, a ação e cada adset frio/prospecção ficam com pendência explícita:

```json
"audience_exclusions": {
  "customers": false,
  "customer_audience_detected": false,
  "pending_dependency": "customer_audience_not_detected",
  "reason": "Campanha de aquisição/prospecção exige público de clientes/compradores para exclusão antes da aprovação."
}
```

#### Fail-closed

- plano `incomplete` ou `contract.ok=false` **não aprova**;
- plano sem metadata obrigatória de versionamento/validação **não aprova**;
- plano com ação operacional contendo `N/A` em produto/público **não aprova**;
- plano que tenta pausar campanha já pausada **não aprova**;
- o registro salvo do plano estratégico passa por uma blindagem final no momento da gravação: se o retorno intermediário vier legado/achatado, o sistema revalida e reimpõe o payload canônico antes de entrar na fila;
- **não gera propostas filhas**;
- **não habilita** o botão `Aprovar plano`;
- planos antigos/legados continuam visíveis para recusa/arquivo, mas não ficam válidos por migração automática.

#### Approval endpoint (revalidação obrigatória)

Antes de aprovar um plano, `ads-autopilot-execute-approved`:

1. recarrega o plano salvo do banco;
2. recompõe o preflight mínimo da conta;
3. reexecuta `normalizeAndValidateStrategicPlanForApproval` sobre o payload persistido;
4. atualiza o plano salvo com o resultado revalidado;
5. só então permite marcar como aprovado e disparar `implement_approved_plan`.

Se o contrato continuar inválido, o endpoint responde com erro em PT-BR e não gera propostas filhas.

#### Preservação da exclusão nas filhas

- A aprovação do plano só avança quando a exclusão canônica por adset estiver preservada no payload validado.
- Na execução de `create_adset`, o executor Meta revalida público frio e injeta/bloqueia a exclusão de clientes antes da chamada externa.
- Se o público de clientes não existir naquele momento, o conjunto falha em modo seguro e a ação não é executada.

#### Renderização obrigatória no card e no modal

Card compacto, modal estruturado e conteúdo do plano leem a mesma fonte canônica e mostram, para ações frias/prospecção:

- **Exclui clientes/compradores**; ou
- **Pendência: público de clientes não detectado**.

Essa indicação não depende mais de texto livre em `target_audience`.

**Componentes:**
- `StructuredProposalModal.tsx` — modal único, aceita `overviewOnly`, `titleOverride`, `approveLabelOverride`.
- `ActionApprovalCard.tsx` — roteia para modal (`useStructuredModal`) ou mantém footer inline (`adjust_budget`/`pause_campaign`).
- `ProposalStructuredEditor.tsx` — drawer de ajuste estruturado para Etapa 1 (two-step). Texto livre permanece como fallback nos demais casos.

**Interação:** Card resumido + "Visualizar proposta" (modal) ou botões inline (operacionais). `stopPropagation` mantido para não abrir o card ao clicar em ações.

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
- **Comentário obrigatório com mínimo de 100 caracteres** (atualização v2026-06-14). O texto explicativo é a **única justificativa obrigatória** e é tratado como **instrução direta para a IA** calibrar as próximas propostas. Contador ao vivo no diálogo, com borda de alerta quando insuficiente. Botão de confirmação bloqueado até atingir o mínimo.
- A decisão original (aprovar/recusar) só prossegue **depois** que o feedback for gravado com sucesso. Se a gravação falhar, a decisão não acontece e o erro é exibido ao usuário, com opção de tentar novamente.

### Campos capturados pelo diálogo

Aprovação:
- comentário obrigatório (mínimo 100 caracteres) — usado como instrução de contexto pela IA nas próximas análises;
- "Eu faria isso manualmente" (opcional) — sinaliza que, mesmo sem a IA, o usuário tomaria a mesma decisão; reforça confiança no padrão para casos parecidos;
- "Usar como preferência futura desta conta" (opcional) — promove o motivo a **regra permanente** da conta; a IA passa a aplicar esse critério automaticamente em propostas futuras.

Recusa:
- comentário obrigatório (mínimo 100 caracteres) — usado como instrução de contexto pela IA nas próximas análises;
- "A IA ignorou algum contexto importante" + descrição (opcional);
- "Usar como preferência futura desta conta" (opcional) — mesma semântica acima.

**Microcopy de orientação ao usuário (v2026-06-14):** o diálogo abre com texto explicando que o comentário vira instrução direta para a IA, e cada uma das marcações ("Eu faria isso manualmente", "Ignorou contexto", "Preferência futura") traz descrição inline do efeito que produz na memória da IA. O placeholder do comentário traz exemplo de aprovação e exemplo de recusa, no nível de detalhe esperado (produto, momento do negócio, restrição de caixa, estratégia paralela). O rótulo do "Tipo de ação" é exibido em português executivo (ex.: "Plano estratégico", "Criar campanha", "Pausar campanha"), nunca em código técnico.

Além disso, o feedback grava automaticamente snapshot imutável de: tenant, canal, conta de anúncios, campanha, objetivo, tipo de ação, classe da ação, estado funcional, veredito proposto, resultado da política, observação/reasoning da IA e métricas disponíveis no momento da decisão.

### Catálogo de motivos (uso interno)

A v2026-06-14 simplificou a UI: as listas de checkboxes de motivos pré-definidos foram **removidas** do diálogo. O catálogo continua existindo no backend para retrocompatibilidade e analytics, mas a UI passa a registrar todo feedback com um motivo genérico único — `user_explained` (aprovação) ou `user_explained_rejection` (recusa) — sendo a justificativa real o texto livre obrigatório de 100+ caracteres. Os motivos pré-definidos legados (`good_budget_logic`, `weak_copy`, `wrong_audience` etc.) seguem aceitos pelo registro, mas não são mais oferecidos como opção visual ao usuário.


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

## Auto-resolução determinística de criativo (Etapa 7.qg.c)

### Evidência

Mesmo após 7.qg.b, o ciclo `implement_campaigns` do tenant Respeite o Homem gerou 15 propostas `create_campaign` e **15/15** foram bloqueadas em `invalid_missing_creative`, embora o tenant tivesse **20 criativos `ready`** vinculados aos produtos certos (Shampoo: 8 / Kit: 6 / Fast Upgrade: 3 / Kit 2x: 2 / Balm: 2). O Quality Gate funcionou — mas a auto-resolução de criativo foi pulada.

### Causa raiz

O resolvedor de produto usava match **estrito por nome** (`name.trim() === product_name.trim()`). Quando o modelo enviava `product_id` correto mas `product_name` com variação de acento/espaço/caixa, `matchedProduct` ficava nulo. O bloco de auto-resolução só rodava `if (matchedProduct)`, então a consulta a `ads_creative_assets` nunca acontecia e `creative_asset_id` permanecia nulo — caindo direto em `invalid_missing_creative`.

### Correção (resolver determinístico)

1. Novo módulo puro `supabase/functions/_shared/ads-autopilot/creativeResolver.ts`:
   - `resolveProduct`: prioridade **product_id → nome exato → nome normalizado** (lower, sem acento, sem pontuação). Sem `includes`/`startsWith`.
   - `selectReadyCreative`: filtra por `product_id` + `status=ready` + `asset_url` não-nulo. Kit vs isolado é protegido pelo filtro estrito por `product_id`.
2. Handler `create_campaign` do Strategist agora usa o resolver e roda a consulta a `ads_creative_assets` também quando apenas `args.product_id` está presente — elimina o falso-positivo.
3. Log estruturado `[creative-resolver]`: `declared_product_id`, `declared_product_name`, `resolved_product_id`, `ready_creative_count`, `selected_creative_id`, `skipped_reason`.

### Fast Upgrade

`Fast Upgrade` é **produto real ativo** do catálogo do tenant (id `87911d83-dfe0-4437-a54f-1a1f8d406fde`, 3 criativos `ready`). O Quality Gate só bloqueia se copy/criativo divergirem desse `product_id`; produto isolado resolve normalmente e recebe seu próprio criativo.

### Regras preservadas

- Quality Gate v1.1 **não foi relaxado**.
- Sem `creative_asset_id` e sem inventário ready para o produto → `invalid_missing_creative`.
- Kit nunca recebe criativo de isolado (filtro por `product_id`).
- Nenhuma chamada Meta, geração de criativo ou consumo de crédito neste preflight.

### Validação desta entrega

- 28 testes `vitest` passando: 13 do Quality Gate + 15 do `creativeResolver` (`src/test/ads-autopilot-creative-resolver.test.ts`).
- **Nenhum ciclo real de IA**, nenhum criativo gerado, nenhuma chamada Meta, nenhuma autoexecução.

### Próxima validação recomendada

Rodar um ciclo controlado `implement_campaigns` separado para confirmar em produção que propostas coerentes saem `pending_approval`, o log `[creative-resolver]` registra `selected_creative_id`, e sugestões sem material continuam bloqueadas.

## Auto-resolução de criativo — contrato de injeção no `implement_campaigns` (Etapa 7.qg.d)

### Problema observado

Mesmo com o resolver da Etapa 7.qg.c já no código, o ciclo controlado de `implement_campaigns` do tenant Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`, conta Meta `act_251893833881780`) ainda gravou 15/15 propostas `create_campaign` como `skipped` com `invalid_missing_creative`, embora o `product_id` proposto fosse válido e houvesse criativo `ready` correspondente no inventário do tenant. O sintoma indicava que a rota real do `implement_campaigns` não estava chegando à etapa de injeção de `creative_asset_id`/`creative_url` antes do Quality Gate.

### Diagnóstico

A rota correta (`handleToolCall` → `create_campaign` em `ads-autopilot-strategist/index.ts`) já chama, na ordem:

1. `resolveProduct` (id → nome exato → nome normalizado) sobre `context.products`.
2. Consulta tenant-scoped a `ads_creative_assets` por `tenant_id` + `product_id` + `status='ready'` + `asset_url IS NOT NULL`, com `lookupProductId = matchedProduct?.id || args.product_id` (fallback seguro quando o nome diverge).
3. `selectReadyCreative` para escolher o criativo mais recente.
4. Injeção de `creative_asset_id`/`creative_url` em `args` **antes** de montar o input do gate.
5. `runCreateCampaignQualityGate` recebendo `tenantCreatives` já filtrado por `lookupProductId` para validar `invalid_creative_not_in_tenant`/`invalid_creative_product_link_mismatch`.

A causa do sintoma na execução anterior foi a versão da função em produção ainda não conter esse pipeline (a rotina nova havia sido salva em disco mas não havia sido redeployada). O contrato em si estava correto.

### Correção desta entrega

- Reafirmação do contrato de injeção em `handleToolCall` (sem alterar lógica do resolver ou do gate).
- Redeploy da edge function `ads-autopilot-strategist` para que o pipeline `resolver → inventário → injeção → gate` realmente rode em produção.
- Novo teste de contrato `src/test/ads-autopilot-implement-campaigns-injection.test.ts` (9 cenários) que reproduz a rota completa em memória — sem banco, sem Meta, sem LLM — e valida:
  - Shampoo isolado recebe `c-shampoo-1`; Kit recebe `c-kit-1`; Fast Upgrade recebe `c-fast-1`.
  - `Fast Upgrade` é tratado como produto real do catálogo (não cai em `invalid_unknown_product_name`).
  - Resolução por `product_id` funciona mesmo com `product_name` divergente (acento/caixa/espaço).
  - Sem inventário ready do produto → `invalid_missing_creative` (gate continua rígido).
  - Kit nunca recebe criativo de isolado (filtro estrito por `product_id`).
  - `creative_asset_id` de outro produto cai em `invalid_creative_not_in_tenant`, porque o inventário fornecido ao gate é tenant-scoped pelo `product_id` da proposta.
  - Oferta divergente continua bloqueada por `invalid_offer_mismatch` mesmo com criativo correto.

### Restrições preservadas

- Quality Gate v1.1 **não foi relaxado**.
- Nenhum criativo novo gerado, nenhum crédito consumido.
- Nenhuma chamada Meta de modificação, nenhuma autoexecução.
- Nenhum ciclo real de IA rodado nesta entrega.
- `Fast Upgrade` deixou de ser tratado como produto fantasma — é produto real do catálogo.

### Próxima validação recomendada

Rodar um único ciclo controlado `implement_campaigns` no tenant Respeite o Homem para confirmar, em produção, que ao menos uma proposta sai `pending_approval` com `creative_asset_id` preenchido e que o log estruturado `[creative-resolver]` registra `selected_creative_id` para cada produto com inventário ready.

---

## 7.qg.e — Controle de volume do Strategist `implement_campaigns` (v1.46.0)

### Problema observado
Após estabilizar o Quality Gate v1.1.1 e a auto-resolução de criativo, o ciclo controlado de `implement_campaigns` no tenant Respeite o Homem produziu **57 propostas `create_campaign`** em uma única execução (48 `pending_approval` + 9 `skipped`). Volume excessivo para revisão humana e risco de saturar a fila operacional.

### Limite por ciclo (proposal-limiter v1.0.0)
Módulo determinístico em `supabase/functions/_shared/ads-autopilot/proposalLimiter.ts`. Sem LLM, sem Meta, sem geração de criativo. Aplicado **antes do INSERT** de cada `create_campaign` que sairia como `pending_approval`.

Limites padrão:

| Parâmetro | Valor | Constante |
|---|---|---|
| Máximo de propostas pending por ciclo | 3 | `DEFAULT_MAX_PROPOSALS_PER_CYCLE` |
| Máximo por produto por ciclo | 1 | `DEFAULT_MAX_PROPOSALS_PER_PRODUCT_PER_CYCLE` |
| Janela de cooldown por template | 24h | `DEFAULT_COOLDOWN_MS` |

### Ranking determinístico (sem LLM)
Função `scoreProposal(args, ctx)` pontua cada proposta antes da decisão:

- +50 se Quality Gate aprovou
- +25 se `creative_asset_id` está vinculado ao mesmo `product_id`
- +6/+2 por completude de headlines (≥2/≥3)
- +6/+2 por completude de primary texts (≥2/≥3)
- +5 por `destination_url` presente
- +2 por `objective` preenchido
- +10 de bônus de **diversidade** (produto ainda não coberto por outra pending da rodada)
- +4 se budget conservador (até R$ 50/dia)
- −8 se TOF/cold com budget ≥ R$ 200/dia

Score serve como tie-breaker quando o limite é atingido: nova proposta substitui pending existente apenas se `newScore > existing.score + 5`.

### Deduplicação e cooldown
Chave de template: `{product_id}|{funnel_stage}|{ad_format}` (`templateKey`). Regras aplicadas em ordem:

1. **Cooldown 24h por template:** se já existe pending recente com mesmo template, nova proposta vira `superseded` (motivo `duplicate_template`), salvo se for claramente melhor (substitui as fracas).
2. **Cap por produto:** se o produto já tem `pending_approval` na fila, nova vira `superseded` (motivo `product_cap_reached`) ou substitui a mais fraca.
3. **Cap global:** se já há 3 pending na fila, nova vira `superseded` (motivo `cycle_cap_reached`) ou substitui a mais fraca.

Toda decisão é registrada em `action_data.proposal_limiter` (versão, decisão, motivo, limites usados, timestamp) e o score em `action_data.proposal_score`.

### Limpeza operacional da rodada anterior
A rodada com 48 pending foi normalizada **sem exclusão física**: 45 sugestões foram marcadas `superseded` com `rejection_reason = excessive_campaign_suggestions_after_pipeline_validation` e auditoria preservada em `action_data.operational_cleanup` (timestamp, motivo, IDs mantidos). 3 sugestões foram mantidas com diversidade de produto e funil, e budgets conservadores:

- Fast Upgrade — Cold, R$ 15/dia
- Shampoo Calvície Zero — Cold, R$ 25/dia
- Kit Banho Calvície Zero (2x) — Warm/RMKT, R$ 22,50/dia

### Correção do falso positivo em `invalid_offer_mismatch` (Quality Gate v1.1.1)
O Quality Gate bloqueava copies do Shampoo Calvície Zero mencionando a palavra "banho" como `invalid_offer_mismatch`, porque o produto rival "Kit Banho Calvície Zero" tinha apenas 1 token exclusivo após desconto dos compartilhados ("banho"), e a regra antiga `Math.min(2, uniq.length)` permitia bloqueio com 1 único hit. Correção:

- Threshold mínimo passou a ser **sempre 2 hits** para tokens isolados.
- Produtos com menos de 2 tokens exclusivos (vs. o vinculado) **não disparam** mistura por tokens.
- Fallback preservado: se o **nome completo normalizado** (≥8 chars) do outro produto aparece literalmente na copy, o bloqueio é mantido. Exemplo: copy do Shampoo escrevendo "Experimente o Kit Banho Calvície Zero" continua bloqueada.

### Garantias operacionais
- Quality Gate continua rígido (nenhum reason_code foi removido; apenas a regra de mistura por token foi calibrada para eliminar falso positivo comprovado).
- Nenhuma chamada Meta de modificação é feita pelo limiter.
- Nenhuma autoexecução é ativada.
- Nenhum criativo é gerado pelo limiter (zero crédito consumido).
- O limiter falha em modo `fail-open`: em qualquer exceção, o INSERT segue como `pending_approval` original — limiter nunca derruba o fluxo.

### Telemetria
Logs estruturados emitidos no edge:
- `proposal-limiter ACCEPT product=<id> score=<n>`
- `proposal-limiter SUPERSEDE_SELF product=<id> reason=<code> score=<n>`
- `proposal-limiter REPLACE superseded=<n> product=<id> score=<n>`

## 7.qg.f — CTA obrigatório para SALES + limpeza de adsets fora de escopo (Quality Gate v1.1.2)

### Contexto
Após o controle de volume (7.qg.e), a validação do tenant Respeite o Homem deixou 3 sugestões `create_campaign` em `pending_approval`. Auditoria revelou:
- 2 das 3 sugestões estavam com CTA vazio mas com `objective=OUTCOME_SALES` — não deveriam ser aprováveis, pois campanha de vendas sem CTA não pode ir ao ar.
- 5 sugestões `create_adset` ficaram pendentes para uma campanha existente, fora do escopo da rodada de validação de campanhas novas.

### Regra de CTA obrigatório (v1.1.2)
O Quality Gate de `create_campaign` agora valida CTA para qualquer `objective` que case com os padrões: `sale`, `sales`, `conversion`, `conversions`, `outcome_sales`, `purchase`, `catalog`, `outcome_traffic`, `traffic`, `lead`, `leads`, `outcome_leads`.

- CTA é lido de `args.cta`, `args.cta_type` ou `args.creative.cta` (nessa ordem).
- Se ausente/vazio/whitespace, o gate emite `invalid_missing_cta` e a sugestão vai para `skipped`.
- Default seguro para SALES: `SHOP_NOW`. Se o Strategist montar uma proposta SALES sem CTA, a opção institucional é **normalizar** o CTA para `SHOP_NOW` antes do gate, registrando em `action_data.quality_gate.cta_normalized_by_default=true` para auditoria. Se a normalização não for possível (objetivo não-padrão sem default mapeado), a proposta é marcada `skipped` com `invalid_missing_cta`.
- Quality Gate **não foi relaxado**: a regra é aditiva, mantendo todos os bloqueios anteriores (produto/copy/oferta/criativo/destino/budget agressivo).

### Limpeza operacional de adsets fora do escopo
Sugestões `create_adset` que apareçam fora do escopo de uma validação de campanha (ex.: remarketing de campanha legada quando a rodada validou apenas criação de campanha) devem ser auditadas e movidas para `status=superseded` com `rejection_reason=adset_suggestions_out_of_scope_for_campaign_validation`. Nenhum delete físico — auditoria preservada em `action_data.audit`.

### Validação
- Testes: `src/test/ads-autopilot-quality-gate.test.ts` cobre SALES sem CTA (bloqueio) e SALES com `SHOP_NOW` (aceito). 151/151 testes verdes.
- Nenhum ciclo real foi rodado. Nenhuma chamada Meta foi feita.

## 8 — Política Operacional v1 (Cadência)

> Módulo: `supabase/functions/_shared/ads-autopilot/cadencePolicy.ts` v1.0.0  
> Testes: `src/test/ads-autopilot-cadence-policy.test.ts` (33 testes)  
> Aprovada pelo usuário em 2026-06-08. Pesquisa de tempos por plataforma baseada em documentação oficial Meta / Google Ads / TikTok.

### 8.1 Princípios
- **Operação diária = manter o que existe**. Orçamento, pausas emergenciais, religar campanhas, leitura, alertas, saúde de site/estoque/tracking.
- **Estratégia = semanal/mensal ou manual com cooldown**. Criar campanha, criativo, público, copy, oferta, duplicação, mudanças estruturais.
- **Nenhuma nova autoexecução foi ativada nesta entrega.** Modo permanece `technical_only` + `approve_high_impact`.

### 8.2 Perfis por plataforma
Cada perfil separa explicitamente o que é **oficialmente documentado** do que é **padrão conservador operacional**.

| Item | Meta | Google | TikTok |
|---|---|---|---|
| Janela de aprendizado (dias) | 7 (oficial) | 7 (oficial) | 7 (oficial) |
| Mín. conversões | 50/sem (oficial) | ~50 ou 3 ciclos (oficial) | 50/ad group (oficial) |
| Mín. dias antes de otimizar | 3 (conservador) | 7 (conservador) | 3 (conservador) |
| Intervalo entre ajustes de orçamento | 72h (conservador) | 72h (conservador) | 72h (conservador) |
| % máx. variação de orçamento/ciclo | **20% (conservador, NÃO oficial)** | 20% (conservador) | 20% (conservador) |
| Janela observacional | 4 dias (3–7) | 7 dias | 4 dias |
| Dayparting | Não recomendado (oficial) | Permitido (oficial) | Não recomendado (conservador) |

**Fontes oficiais consultadas:** Meta Business Help Centre (about learning phase + significant edits + pacing/scheduling), Google Ads Help (learning phase, smart bidding), TikTok Web Auction Best Practices Guide. **O número 20% para variação de orçamento NÃO é publicado oficialmente por nenhuma plataforma — é prática consolidada e fica marcada como `conservative_operational_default` no código.**

### 8.3 Idade da campanha
- `<3 dias`: **no_touch** (apenas observar).
- `3–7 dias`: **observe_only** (sem ajuste real, salvo emergência).
- `≥7 dias + fora de learning + dados suficientes`: **optimize_allowed**.
- Em learning phase: **no_touch** independente da idade.

### 8.4 Janela operacional de orçamento (00:01–03:00 BRT)
- `adjust_budget` só executa real entre 00:01 e 03:00 BRT.
- Fora da janela, o Scheduled Runner **reagenda** automaticamente para o próximo 00:01 BRT e registra `runner_gate.reason=outside_budget_operational_window`.
- Preparar / agendar / propor permanece permitido o tempo todo.

### 8.5 Ações proibidas no ciclo diário
Bloqueadas por padrão no Analyze diário: `create_campaign`, `create_adset`, `generate_creative`, `create_audience`, `create_lookalike_audience`, `duplicate_campaign`, `update_campaign_copy`, `update_offer`.

Permitidas: `adjust_budget`, `pause_campaign` (somente emergencial), `activate_campaign`, `report_insight`, `alert`.

### 8.6 Pausas
- **Emergencial** (permitida no diário, técnica): `site_down`, `out_of_stock`, `abnormal_spend`, `tracking_broken_with_performance_drop`, `operational_risk`, `fraud_detected`, `meta_account_alert`.
- **Estratégica** (apenas semanal/mensal, sempre aprovação humana): `low_performance`, `dayparting`, `manual_strategic`, `reorganize_account`, `test_pause`.
- Motivo desconhecido = bloqueado por padrão.

### 8.7 Cadência dos motores
| Motor | Cron | Horário BRT | Observações |
|---|---|---|---|
| Analyze | 2×/dia | 06:00 / 18:00 | `ads-autopilot-analyze-0600-brt`, `-1800-brt` |
| Guardian | 4×/dia (mantido) | 00:01, 12:00, 13:00, 16:00 | dedupe 2h por campanha+ação |
| Scheduled Runner | a cada 5 min (mantido) | — | `adjust_budget` só executa 00:01–03:00 BRT |
| Strategist `implement_campaigns` | **sem cron diário automático** | manual | cooldown 6h |
| Strategist weekly | 1×/sem | sábado 01:00 | `ads-autopilot-strategist-weekly-sat-0100-brt` — cooldown 6d — suprimido se for 1º sábado do mês |
| Strategist monthly | 1×/mês (1º sábado) | sábado 02:00 | `ads-autopilot-strategist-monthly-1st-sat-0200-brt` — cooldown 28d — supersede weekly no mesmo dia |
| Creative weekly | mantido | quarta 08:00 | — |
| Experiments | mantido | terça 08:00 | — |
| Weekly Insights | mantido | segunda 08:00 | — |

### 8.8 Cooldowns e limite de fila
- Strategist manual `implement_campaigns`: **6h**.
- Strategist weekly: **6 dias**.
- Strategist monthly: **28 dias**.
- Fila global `pending_approval ≥ 5` → Strategist **pula** geração estrutural e registra `skipped: pending_queue_limit_reached`.
- Cap por ciclo (já existente): 3 propostas aprováveis / 1 por produto.

### 8.9 Públicos
- **Frio**: sempre exclui clientes (corrigido automaticamente pela política se ausente).
- **Morno**: retenção padrão 30 dias quando ausente (ajustável por volume).
- **Quente**: retenção padrão 14 dias quando ausente.
- Tenants com pouco tráfego podem estender janelas via instruções estratégicas.

### 8.10 Autonomia (estado atual = inalterado)
- Modo: `technical_only` + `approve_high_impact`.
- Pode ser autônomo no futuro (não ativado): ajuste pequeno de orçamento na janela, redução por regra clara, pausa emergencial, religar por regra, alertas/insights, geração interna de criativo sem publicação.
- Sempre humano: criar campanha, criar adset, publicar criativo, alterar copy, alterar oferta, duplicar, mudar público estratégico, pausa estratégica, orçamento >20%, qualquer mudança visível.

### 8.11 Conflito weekly × monthly
Quando ambos caem no mesmo sábado (1º do mês), o **weekly cede** (`reason=weekly_yielded_to_monthly_same_saturday`). O monthly incorpora a análise semanal e gera um único pacote.

### 8.12 Pesquisa por plataforma — fontes
**Meta (oficial):**
- facebook.com/business/help/112167992830700 (About the learning phase)
- facebook.com/business/help/316478108955072 (Significant edits and learning phase)
- developers.facebook.com/docs/marketing-api/bidding/overview/pacing-and-scheduling

**Google Ads (oficial):**
- support.google.com/google-ads/answer/13020501 (Learning phase and duration)
- support.google.com/google-ads/answer/10970825 (How bidding algorithms learn)
- support.google.com/google-ads/answer/7065882 (About Smart Bidding)

**TikTok (oficial):**
- ads.tiktok.com/business/library/Web_Auction_Best_Practices_Guide.pdf

### 8.13 Validação executada
- Suíte `src/test/ads-autopilot-cadence-policy.test.ts`: **33/33 testes verdes**.
- Suíte completa do projeto: ver relatório de entrega.
- **Nenhum ciclo real foi rodado.** **Nenhuma chamada Meta foi feita.** **Nenhuma autoexecução foi ativada.**

### 8.14 Limites desta entrega
- Hooks adicionados nos pontos críticos: Strategist (cooldown + fila), Scheduled Runner (janela 00:01–03:00 BRT para `adjust_budget`), Quality Gate (CTA já enforçado em v1.1.2 — agora marcado como v1.2.0).
- Analyze: o bloqueio diário de ações estruturais é enforçado pela política compartilhada (`isDailyActionAllowed`); a aplicação no prompt do Analyze já restringe na origem via `phase2_actions` (linha 461 do `ads-autopilot-analyze/index.ts`). A função `isDailyActionAllowed` fica disponível como gate adicional.
- Google/TikTok: perfis prontos no módulo (`PLATFORM_PROFILES.google` / `.tiktok`), mas sem execução real no piloto.

---

## 9. Pausa — assuntos em andamento (2026-06-08)

> Esta seção registra o estado dos trabalhos do Gestor de Tráfego IA no momento em que o usuário pediu pausa, para retomada futura sem perda de contexto. Não é especificação — é um marcador de continuidade.

### 9.1 O que ficou entregue e estável
- Política Operacional v1 do Ads Autopilot publicada (seção 8 deste doc): cadência diária x semanal x mensal, janela BRT 00:01–03:00 para ajuste de orçamento, cooldown do Strategist (6h manual, 6d semanal, 28d mensal), gate de fila (≥5 pendentes pausa nova geração estrutural), perfis por plataforma (Meta/Google/TikTok), exclusão automática de clientes em públicos frios.
- Quality Gate v1.2.0: CTA obrigatório em campanhas de venda; campanhas sem CTA não permanecem aprováveis.
- Crons reorganizados: Analyze 2x/dia (06:00 e 18:00 BRT), Strategist Weekly (sábado 01:00), Strategist Monthly (1º sábado 02:00).
- Bateria de 33 testes da política de cadência verde. Suíte completa do projeto verde.
- Nenhum ciclo real rodou, nenhuma chamada Meta foi feita, nenhuma autoexecução foi ativada.

### 9.2 O que ficou em aberto para a próxima rodada
1. **Validação operacional ponta-a-ponta**: rodar um `implement_campaigns` manual no tenant Respeite o Homem com a política v1 ativa e observar logs para confirmar cooldown e gate de fila no comportamento real (e não só nos testes).
2. **Autorizar (ou não) execução autônoma de pequenos ajustes de orçamento** (≤20%) dentro da janela 00:01–03:00 BRT. Infraestrutura pronta; decisão de negócio pendente.
3. **Aplicação do gate `isDailyActionAllowed` como verificação adicional no Analyze**, mesmo com o prompt já restringindo na origem (defesa em profundidade).
4. **Ativação real dos perfis Google e TikTok no piloto** — hoje os perfis existem no módulo mas não estão em execução real, só Meta.
5. **Decisão sobre as 3 sugestões `pending_approval` e os 5 adsets pendentes** que motivaram a auditoria — ficaram aguardando o usuário decidir Aprovar/Recusar item a item.

### 9.3 Como retomar
- Reler esta seção 9 + seção 8 (Política Operacional v1).
- Conferir fila atual de `pending_approval` no tenant antes de qualquer ação.
- Não recriar política, não rodar Strategist em lote sem cooldown, não ativar autoexecução sem decisão registrada do usuário.

---

## 10. Fase C.4 — Autoexecução técnica governada por toggle (2026-06-08)

A Fase C.4 vira o trinco da autonomia técnica: a IA passa a poder executar automaticamente — sem aprovação humana — **apenas ações técnicas diárias elegíveis**, e apenas quando o usuário liga explicitamente o toggle. Toda decisão estratégica, criativa, comercial e estrutural continua exigindo aprovação humana, como antes.

### 10.1 O toggle

Existe em dois níveis. Default sempre desligado.

| Nível | Local na UI | Label | Persistência |
|---|---|---|---|
| **Individual (conta de anúncio)** | Card de configuração da conta, abaixo de "IA Ativa" | Execução automática diária | `ads_autopilot_account_configs.autonomy_mode` (`off` \| `technical_only`) |
| **Global (tenant)** | Card "Configuração Global", bloco "IA Global" | Execução automática diária | `ads_autopilot_configs.autonomy_mode` no registro `channel='global'` |

Texto auxiliar (PT-BR, idêntico ao da UI):
- Individual: "Permite que a IA execute automaticamente apenas ações técnicas seguras do dia a dia, como pequenos ajustes de orçamento dentro da janela permitida, pausas emergenciais e reativações operacionais. Campanhas, públicos, criativos, copys, ofertas e decisões estratégicas continuam exigindo aprovação."
- Global: "Aplica a execução automática de ações técnicas diárias para contas que não possuem configuração individual. Contas com configuração própria seguem sua regra individual." + "Prioridade: Individual > Global > Desligado por padrão."

### 10.2 Hierarquia oficial

`resolveEffectiveAutonomy(accountCfg, globalCfg)` → `{ mode, source }`:

1. Se a conta tem `autonomy_mode` definido (`off` ou `technical_only`) → vence (`source='account'`).
2. Senão, se o global tem `autonomy_mode` definido → herda (`source='global'`).
3. Caso contrário → `off` com `source='default_off'`.

Função pura, sem I/O. O `source` é propagado para `policy_check_result.c4_autoexec_gate.effective_source` em toda decisão automática, para auditoria.

### 10.3 IA Ativa vs Execução automática diária

| | IA Ativa | Execução automática diária |
|---|---|---|
| Permite que a IA analise, monitore e gere sugestões | ✅ | ✅ |
| Permite que a IA execute sozinha ações técnicas diárias elegíveis | ❌ | ✅ |
| Substitui kill switch, Policy Engine, Quality Gate, janela 00:01–03:00, learning phase, maturidade ou limite de orçamento | — | ❌ Nunca. |

### 10.4 Gates obrigatórios da autoexecução (`canAutoExecuteC4`)

Toda autoexecução só acontece quando **todos** os gates abaixo passam, na ordem:

1. **Kill switch global** desligado (prioridade absoluta).
2. **Kill switch da conta** desligado.
3. **IA Ativa** ON na conta.
4. **Toggle efetivo** = `technical_only` (vindo de conta ou global).
5. Ação **não é** `strategic_pause` (essas SEMPRE são humanas — ver 10.6).
6. **Classe da ação** ∈ {`automatic_candidate`, `emergency`}.
7. Maturidade — campanha com ≥ 3 dias e **fora** de learning phase (não aplicado a emergência).
8. **Janela segura BRT 00:01–04:00** respeitada (não aplicado a emergência).
9. **Orçamento dentro do limite seguro** configurado (quando o caller informar).
10. **Policy Engine** retornou `execute_now`.

Falhou qualquer um → a ação **permanece em `pending_approval`** e o motivo do bloqueio é gravado em `policy_check_result.c4_autoexec_gate.reason`. Nunca há chamada à API externa nesse caminho de bloqueio.

> "Bloqueio por política" não é ação executável — é gate de segurança e funciona sempre, independentemente do toggle.

### 10.5 Ações elegíveis à autoexecução (toggle ON + gates ok)

Somente o conjunto fechado abaixo:
- `adjust_budget` / `increase_budget` / `decrease_budget` (dentro do limite da plataforma e da conta, dentro da janela 00:01–03:00 BRT).
- `update_tiktok_budget`, `toggle_tiktok_status`.
- `schedule_action` (re-agendamento interno para a próxima janela segura, com revalidação no momento da execução).
- `block_action` (decisão de gate interno).
- Pausas emergenciais operacionais: `emergency_operational_pause`, `pause_emergency_campaign`, `pause_emergency_adset`, `pause_tracking_broken`, `pause_budget_breach`, `pause_broken_link`, `pause_out_of_stock`, `pause_site_down`.
- Reativações operacionais seguras: `reactivate_*`, `activate_*`.

### 10.6 Ações sempre humanas (mesmo com toggle ON)

- Criar/duplicar campanha, conjunto, anúncio, público, lookalike.
- Criar/editar criativo, copy.
- Mudar oferta, promessa, página de destino, segmentação estratégica, objetivo de otimização.
- Plano estratégico, expansão estrutural.
- Qualquer ação destrutiva (`delete_*`).
- Orçamento acima do limite seguro, ação fora da janela, campanha em learning ou com < 3 dias, ação sem dados suficientes.
- **Pausa estratégica** (ver 10.7).

### 10.7 Pausa estratégica — sempre humana, com expiração diária

São consideradas pausas estratégicas (e portanto SEMPRE vão para aprovação humana, com validade até o próximo 00:01 BRT): `strategic_pause`, `pause_low_roas`, `pause_low_cpa`, `pause_mature_performance`, `pause_dayparting`, `pause_schedule`, `pause_fatigue`, `pause_budget_redistribution`.

| Campo | Valor |
|---|---|
| `status` inicial | `pending_approval` |
| `approval_expires_at` | `getStrategicPauseExpiry(now)` = próximo 00:01 BRT estritamente após a criação |
| `policy_check_result.ttl_policy` | `strategic_pause_daily_until_next_0001_brt` |

**Fluxo de saída**:
- Usuário aprovou antes de expirar → revalida gates aplicáveis e executa via fluxo de aprovação normal.
- Usuário rejeitou antes de expirar → marca `rejected` com `reason_code` normal.
- Não houve resposta até 00:01 BRT → a edge `ads-autopilot-strategic-pause-expire` (cron `1 3 * * *` UTC) marca como `expired` com `policy_check_result.expiration.reason='strategic_pause_daily_window_expired'`. **Não chama nenhuma API externa.** Mantém histórico/auditoria. Pode ser regerada em outro dia se a IA detectar novamente o mesmo padrão.

**Idempotência da rotina de expiração**: cada `UPDATE` filtra por `status='pending_approval'` no `WHERE`, então uma segunda execução no mesmo minuto não duplica logs nem altera ações já `approved/rejected/executed/auto_executed`.

**Deduplicação diária**: o índice único parcial `idx_aaa_daily_idem_v1` (`tenant_id, channel, action_type, action_day, entity_id` em status `approved/scheduled/executed/auto_executed`) impede duas pausas estratégicas iguais no mesmo dia BRT. Para um motivo distinto no mesmo dia, deve-se variar o `entity_id` ou criar uma `idempotency_key` específica.

### 10.8 Onde o autoexec real acontece

O `ads-autopilot-scheduled-runner` (cron 5 min) ganhou um **segundo passe** após o já existente:
1. Busca ações `pending_approval` em `policy_engine_version='v1'` (limit 50).
2. Para cada uma: classifica, resolve autonomy efetivo (conta + global), carrega snapshot de campanha (se Meta), roda `decide()`, calcula janela e maturidade, monta `canAutoExecuteC4`.
3. Gate `ok` → stamp `status='approved'` + `auto_executed=true` + `approved_at`/`approval_expires_at` + invoca `ads-autopilot-execute-approved` com `from_runner=true`.
4. Gate falhou → atualiza apenas `policy_check_result.c4_autoexec_gate` com o motivo; a ação continua disponível para o usuário aprovar manualmente.

Strategic pause é vetada já no início do passe.

### 10.9 Auditoria e reversão

- Cada autoexecução grava: `effective_mode`, `effective_source`, `policy_decision_kind`, decisão final do gate, hora.
- Cada bloqueio grava o gate que barrou.
- Desligar o toggle (individual ou global) tem efeito **imediato** no próximo ciclo do runner.
- Kill switch (global ou da conta) continua sendo o botão de pânico universal — barra na ordem 1 do gate.

### 10.10 Defaults na entrega

- Toggle global: **OFF**.
- Toggle individual em todas as contas (inclusive piloto observacional Respeite o Homem): **OFF** — o usuário decide quando ligar.
- Telemetria observacional da Fase C.3.x permanece intacta como camada de comparação ("o que a IA executaria" vs "o que ela executou").

### 10.11 Testes (28 novos, 0 regressão)

Arquivo: `supabase/functions/_shared/ads-policy.c4.test.ts`.

Cobre: hierarquia individual > global > default off; toggle OFF default; ON sobrescreve OFF e vice-versa; valor inválido cai em default off; `isAutonomyExecutionEnabled` libera apenas `technical_only`; todos os 14 motivos do gate (autonomy_off, kill_switch_global, kill_switch_account, ai_disabled, strategic_pause_always_human, action_class_not_eligible, in_learning_phase, campaign_too_new, outside_safe_window, budget_above_safe_limit, policy_engine_rejected, missing_context); emergência ignora janela/maturidade/learning; strategic_pause sempre bloqueia mesmo com tudo verde; classificação dos novos tipos (strategic_pause → needs_approval, emergency_operational_pause → emergency); `getStrategicPauseExpiry` retorna o próximo 00:01 BRT (4 cenários) e é determinística.

Resultado: **28/28 verdes** + os 89 testes anteriores da policy também verdes (sem regressão).

### 10.12 O que não muda nesta entrega

- Não toca F.1 / F.2 / Tenant Memory / Quality Gate / cadência semanal/mensal.
- Não muda `human_approval_mode`, `kill_switch`, `is_ai_enabled` de nenhum tenant.
- Não chama Meta/Google/TikTok nos testes nem na entrega.
- Não altera sidebar, navegação ou layout fora dos dois cards de toggle.
- Não cria campanha, criativo, copy ou oferta real.

### 10.13 Hardening de auditoria — origem inequívoca da decisão (2026-06-08)

A Fase C.4 mantém, por compatibilidade com o executor existente, o status `approved` tanto para aprovação manual quanto para autoexecução pela política. A distinção entre as duas origens passa a ficar registrada de forma **persistente e auditável** em `policy_check_result.autoexec_audit`, com os campos:

| Campo | Valores |
|---|---|
| `approval_source` | `human_approval` \| `policy_auto_execution` \| `rejected_by_user` \| `blocked_by_policy` |
| `human_approved` | `true` apenas para `human_approval` |
| `approved_by_user` | espelha `human_approved` |
| `auto_executed` | `true` apenas para `policy_auto_execution` |
| `auto_execution_phase` | `c4_enabled` (apenas em caminhos C.4) |
| `effective_autonomy_mode` | `technical_only` \| `off` (apenas em caminhos C.4) |
| `effective_autonomy_source` | `account` \| `global` \| `default_off` (apenas em caminhos C.4) |
| `executed_by` | `user` \| `policy` \| `null` |
| `policy_gate_result` | `{ ok, reason, inputs }` quando aplicável |
| `approved_by` / `rejected_by` | UUID do usuário, quando aplicável |
| `at` | timestamp da decisão |

**Nenhum schema novo foi criado** — o campo `policy_check_result` (jsonb) já existia. As colunas `approved_by_user_id` e `auto_executed` continuam sendo usadas como antes; o `autoexec_audit` apenas torna a origem inequívoca para telas, logs e consultas.

**Revalidação no executor**: ao receber uma ação com `auto_executed=true`, `ads-autopilot-execute-approved` **revalida** os gates da Fase C.4 (`canAutoExecuteC4`) **antes de qualquer chamada externa**. Se o gate falhar (ou se for `strategic_pause`), a ação volta para `pending_approval`, grava `autoexec_audit.approval_source='blocked_by_policy'` com `policy_gate_result.revalidated_at_executor=true` e **não** chama Meta/Google/TikTok. Falha na chamada externa continua sendo registrada como `status='failed'` — nunca como `executed`.

**Strategic pause**: defesa em profundidade aplicada em três pontos — no segundo passe do runner, no início da revalidação do executor e dentro do próprio `canAutoExecuteC4`. Nenhum caminho de autoexecução pode atingir uma pausa estratégica.

**Testes**: `supabase/functions/_shared/ads-policy.c4-audit.test.ts` (12 testes) cobrindo: autoexec C.4 nunca registra aprovação humana; aprovação manual registra `human_approval`; `status='approved'` é desambiguado pelo `autoexec_audit`; rejeição manual registra `rejected_by_user`; bloqueio por gate registra `blocked_by_policy`; executor revalida gates antes de chamada externa; gate falhando impede execução externa; falha externa não vira sucesso; `strategic_pause` nunca autoexecuta; hierarquia conta > global > default off é respeitada.


### 10.14 Microvalidação — 5º estado distinguível: strategic_pause expirada (2026-06-08)

Além dos quatro estados de origem (`human_approval`, `policy_auto_execution`, `rejected_by_user`, `blocked_by_policy`), a sugestão `strategic_pause` que não foi tratada até 00:01 BRT precisa ser claramente distinguível em auditoria e consultas. Como a expiração não é uma origem de aprovação, mantemos `approval_source` intocado e adicionamos `decision_outcome='expired'` no mesmo bloco `policy_check_result.autoexec_audit`.

**Onde fica registrado**:
- `ads_autopilot_actions.status = 'expired'` (status terminal, fora da fila ativa que filtra `pending_approval`).
- `policy_check_result.expiration` — bloco existente, mantido: `reason='strategic_pause_daily_window_expired'`, `ttl_policy`, `expired_at`, `pilot_version`.
- `policy_check_result.autoexec_audit` — novos campos: `decision_outcome='expired'`, `expiration_reason='strategic_pause_daily_window_expired'`, `expired_at`, `human_approved=false`, `auto_executed=false`, `expired_by='policy_ttl'`, `expired_by_function='ads-autopilot-strategic-pause-expire'`.

**Não houve migração** — `policy_check_result` é jsonb e ambos os blocos coexistem.

**Critério de aceite — checado**:
- Aprovação manual → `autoexec_audit.approval_source='human_approval'` ✅
- Autoexecução C.4 → `autoexec_audit.approval_source='policy_auto_execution'` ✅
- Rejeição manual → `autoexec_audit.approval_source='rejected_by_user'` ✅
- Bloqueio por gate → `autoexec_audit.approval_source='blocked_by_policy'` ✅
- `strategic_pause` expirada → `status='expired'` + `autoexec_audit.decision_outcome='expired'` + `expiration.reason='strategic_pause_daily_window_expired'` ✅
- Fila ativa (`status='pending_approval'`) não inclui expiradas ✅
- Histórico/auditoria preservados (ambos os blocos persistidos) ✅

**Testes**: 2 testes novos em `ads-policy.c4-audit.test.ts`, ambos passando. Nenhuma chamada externa, nenhuma ação real executada.

### 10.15 Patch de UI — toggle global conectado na aba "Configurações Gerais" (2026-06-08)

**Sintoma reportado pelo usuário:** "Porque a IA global não tem o toggle de ativação?"

**Causa:** o componente do toggle global de execução automática diária havia sido construído na Fase C.4 inicial, mas não foi inserido na aba "Configurações Gerais" do Gestor de Tráfego IA — só o toggle individual (por conta de anúncio) estava visível. O backend, a hierarquia (Individual > Global > Default OFF), a auditoria e os gates já operavam normalmente; faltava apenas o controle de superfície na UI global.

**Correção aplicada:**
- Adicionado card próprio "Execução automática diária (fallback global)" em `AdsGlobalSettingsTab`, logo abaixo do card "IA Global".
- Estado `autonomyMode` sincronizado com `globalConfig.autonomy_mode` via `useEffect`.
- Handler `handleAutonomyToggle` persiste imediatamente via `onSave({ channel: 'global', autonomy_mode: next, ... })`, sem esperar o botão "Salvar Configuração Global" (controle de segurança).
- `handleSave` também passa a incluir `autonomy_mode`, para que edições combinadas não percam o estado do toggle.
- Card fica desabilitado quando "IA Global" está desligada (`disabled={isSaving || !isGlobalEnabled}`).
- Default permanece `off`. Nenhuma migração necessária — a coluna `autonomy_mode` já existe em `ads_autopilot_configs` desde a C.4 inicial.
- Nenhum gate, função, cron, prompt ou contrato de auditoria foi alterado.

**Documentação:** `docs/especificacoes/transversais/mapa-ui.md` atualizado para refletir a localização real do toggle global.

---

## 11. Evolução estratégica — Fase 1 (2026-06-08)

Esta fase entrega apenas as duas primeiras frentes da evolução estratégica aprovadas pelo usuário. **Fases adiantes** (botão "Nova Estratégia", fluxo de campanhas em duas etapas, geração de criativos pós-aprovação, mudanças no Motor Universal de Créditos) **não estão incluídas** nesta entrega.

### 11.1 Frente 1 — Público Frio sempre exclui Clientes

**Regra de negócio:** toda campanha/conjunto classificada como **Público Frio** (`funnel_stage ∈ {cold, tof, frio, prospecting, prospect, prospeccao}`) deve **excluir automaticamente** o público de Clientes/Compradores já sincronizado pelo sistema. Esta entrega vale **apenas para Meta Ads**; Google/TikTok seguem sem essa obrigatoriedade.

**Detecção determinística do público de Clientes:**
- Lista de sistema `is_system=true` com `name='Clientes'` no tenant
- → Mapeamento ativo em `audience_sync_mappings` com `platform='meta'`, `status='active'` e `ad_account_id` da campanha
- → `platform_audience_id` é o ID do público a ser excluído

**Estados possíveis:**

| Estado | Comportamento |
|---|---|
| Público existe + exclusão aplicada | ✅ Proposta passa, metadata `customer_audience_exclusion_enabled=true` salva no `action_data` e no `preview` |
| Público existe + exclusão ausente | ❌ Strategist injeta exclusão automaticamente antes do gate; se ainda assim faltar, gate bloqueia |
| Público não sincronizado nesta conta | ❌ Gate bloqueia com `reason_code = cold_audience_requires_customer_exclusion` e mensagem "Crie ou sincronize o público de Clientes antes de propor campanhas frias." |
| **Exceção: teste de produto novo/lançamento** | ✅ Em `campaign_intent ∈ {creative_test, offer_test}` (ou `campaign_type='testing'`) com produto **novo/em lançamento** (não carro-chefe), a exclusão **NÃO é forçada**. O sistema marca `audience_exclusions.exclusion_skipped_reason = 'test_for_new_or_launch_product'` na ação e nos adsets de prospecção, libera o plano para aprovação, e a UI exibe a tarja azul "Mantém clientes (produto novo/lançamento em teste)". Carro-chefe em teste continua excluindo clientes via o normalizador de adset. |

**Quality Gate v1.3.0:** novo reason_code `cold_audience_requires_customer_exclusion`. Acionado quando `isCold(args)` e a `customerAudience` informada não está disponível **ou** seu `meta_audience_id` não aparece em `excluded_audience_ids`. Quando o chamador não informa `customerAudience` (callers legados), o gate registra `details.customer_audience_check = "skipped_no_resolver_input"` sem bloquear (back-compat).

**Detecção da exceção (helper `isTestForNewOrLaunchProduct`):**
- Ação é teste (`campaign_intent ∈ {creative_test, offer_test}` OU `campaign_type='testing'` OU `funnel_stage='test'`)
- **E** produto NÃO é carro-chefe (sem tokens `carro-chefe|bestseller|principal|mais vendido` no nome/tags, e `product_lifecycle` ∉ `{established, bestseller, consolidado, mature}`)
- **E** há sinal de novo/lançamento: `product_lifecycle ∈ {new, launch, novo, lançamento, pre_launch, prelaunch}` **OU** nome/tags com `lançamento|novidade|nova fórmula|pré-venda|launch|new product|beta|piloto|recém-lançado`

O estrategista (LLM) recebe instrução explícita no prompt para emitir `product_lifecycle='launch'` (ou `'new'`) em testes desses produtos. Mesmo sem o campo, a detecção por nome/tags atua como rede determinística.

**Auto-cura de default seguro (v2026-06-14):** quando a ação é `campaign_intent='creative_test'` mas **nenhum sinal de produto novo/lançamento** é detectado **e** o LLM **não emitiu** `exclusion_override_reason` (≥ 12 chars), o normalizer aplica automaticamente a exclusão de clientes (mesmo caminho do tráfego frio). Isso elimina bloqueio por omissão do LLM e respeita a regra de negócio: exclusão é o default; manter clientes só com sinal claro de lançamento ou justificativa formal. Sem mudança de UI/UX.

**Defesa em profundidade (executor `v4.1.0`):** antes de publicar uma campanha fria na Meta, `ads-autopilot-execute-approved` re-resolve o público de Clientes e:
- Se não encontrar → retorna `success:false` com `reason_code: cold_audience_requires_customer_exclusion` e bloqueia a publicação
- Se encontrar mas exclusão estiver ausente do payload → injeta a exclusão automaticamente antes da chamada à Meta
- Se a resolução falhar → retorna `success:false` com `reason_code: cold_audience_revalidation_failed`

**Metadata persistida em `action_data.customer_audience_exclusion`:**
```json
{
  "customer_audience_exclusion_enabled": true,
  "customer_audience_id": "120244679266150057",
  "customer_audience_name": "Clientes - Atualizado 07/06/2026",
  "customer_audience_list_id": "46154bee-…",
  "customer_audience_missing": false,
  "exclusion_reason": "cold_audience_must_exclude_existing_customers",
  "resolved_at": "2026-06-08T…Z",
  "source": "audience_sync_mapping"
}
```

**Importante (escopo desta fase):** o sistema **não chama Meta** para criar/sincronizar o público de Clientes nesta entrega. Usa apenas dados já existentes. Se ausente, bloqueia e orienta.

### 11.2 Frente 2 — Labels amigáveis de funil/público

**Regra:** termos técnicos crus (`cold`, `warm`, `hot`, `tof`, `mof`, `bof`, `customers`, ...) **nunca aparecem na UI final**. O valor técnico continua salvo no banco/payload; a tradução acontece **na camada de apresentação** via helper único `src/lib/ads/audienceLabels.ts` (`getFunnelLabel(raw)`).

**Mapeamento canônico aprovado:**

| Valor técnico | Label exibida | Bucket |
|---|---|---|
| `cold` / `tof` / `frio` / `prospecting` / `prospect` / `prospeccao` | **Público Frio** | cold |
| `warm` / `mof` / `morno` / `remarketing` / `retargeting` | **Remarketing** | warm |
| `hot` / `bof` / `quente` | **Público Quente** | hot |
| `customers` / `clientes` / `compradores` | **Clientes** | customers |
| `retention` / `recompra` / `repurchase` | **Retenção / Recompra** | retention |
| `test` / `teste` | **Teste** | test |
| `leads` / `lead` | **Captação de Leads** | leads |
| qualquer outro / vazio | **Público não classificado** | unknown |

**Componentes atualizados:**
- `ActionApprovalCard` — badge superior usa `getFunnelLabel(funnel)`; nova linha de exclusões (Frente 1) com badge verde "Excluindo: Clientes" quando aplicada, ou badge âmbar "Sem público de Clientes nesta conta" quando faltando.
- `ActionDetailDialog` — campo "Funil" exibe a label amigável; novo campo "Exclusões" exibe a linha de Clientes ou o pré-requisito ausente.
- Mapa local antigo `FUNNEL_LABELS` removido (substituído pelo helper único).

### 11.3 Fora de escopo desta fase (não implementado)

- Botão "Nova Estratégia"
- Análise estratégica manual completa por orçamento
- Fluxo de campanha em duas etapas (proposta estratégica → aprovação de criativos)
- Geração de criativos atrelada à aprovação da Etapa 1
- Mudanças no Motor Universal de Créditos
- Novos estados de aprovação (`strategy_proposed`, `creative_prompt_approved`, etc.)
- Mudanças na cadência semanal/mensal
- Mudanças em Fase C.4 (autoexecução técnica diária, expiração de strategic_pause, auditoria)

### 11.4 Testes

`supabase/functions/_shared/ads-autopilot/qualityGate.cold-exclusion.test.ts` — 8 testes:
- versão do gate `1.3.0`
- back-compat sem `customerAudience`
- bloqueia quando público faltando
- bloqueia quando exclusão não aplicada
- passa quando público existe + exclusão aplicada
- warm/remarketing não exige exclusão
- helper `isColdFunnelStage` reconhece sinônimos PT/EN
- helper `buildCustomerExclusionMetadata` sinaliza aplicado vs ausente

Regressão na suíte C.4 e ads-policy completa: **72/72 passando**.



---

## 12 — Frente 4 — Fluxo de duas etapas para campanhas com criativos (v1.0.0)

### 12.1 Objetivo
Separar a aprovação estratégica da geração dos criativos para evitar consumo
de créditos e processamento antes da validação humana.

### 12.2 Comportamento
1. **Etapa 1 — Aprovação da estratégia e do prompt.** O Estrategista monta a
   proposta completa da campanha (objetivo, nome, produto, orçamento, público,
   exclusões, copy, headline, CTA, link, justificativa, Quality Gate, prompt do
   criativo e formato sugerido), mas **NÃO gera imagem nem vídeo, NÃO consome
   crédito, NÃO chama Meta/Google/TikTok, NÃO publica campanha**. A proposta é
   salva com `flow_version='two_step_v1'` e o brief em
   `action_data.creative_brief`.
2. **Etapa 2 — Geração e aprovação final.** Ao clicar "Aprovar e gerar
   criativos", o sistema:
   - Revalida o Quality Gate (incl. exclusão de Clientes em campanhas frias).
   - Move o status para `creative_pending`.
   - Invoca a geração real do criativo (DEBITA crédito agora).
   - Quando o asset fica pronto, status vira `final_pending_approval`.
   - O usuário revisa criativo + resumo final e pode Aprovar, Ajustar ou
     Reprovar. A publicação real só ocorre na aprovação final.

### 12.3 Estados visíveis
| Estado | Significado |
| --- | --- |
| `pending_approval` | Etapa 1 — aguardando aprovação da estratégia |
| `creative_pending` | Etapa 2 — gerando criativos |
| `final_pending_approval` | Etapa 2 — aguardando aprovação final |
| `approved` / `rejected` | Estados terminais existentes |

> Nenhum enum novo no banco. O campo `status` em `ads_autopilot_actions` é TEXT.

### 12.4 Quando créditos são consumidos
- Etapa 1: **nunca**.
- Etapa 2: **somente** após o clique humano em "Aprovar e gerar criativos",
  via Motor Universal de Créditos (padrão atual de `ads-autopilot-creative`).

### 12.5 Compatibilidade com propostas antigas
- Propostas sem `flow_version` (legacy) **permanecem no fluxo anterior** sem
  migração e sem retrofit de prompt. O card mostra o botão "Aprovar" clássico.
- Propostas novas (geradas após esta entrega) sempre usam o fluxo de duas etapas.

### 12.6 Restrições de segurança
- Executor (`ads-autopilot-execute-approved`) bloqueia publicação de
  propostas two-step em `pending_approval` (precisa passar pela Etapa 1).
- Hook do front bloqueia o botão "Aprovar campanha final" em Etapa 1.
- Quality Gate da Etapa 2 rejeita: campanha fria sem exclusão de Clientes,
  brief ausente, formato ausente, link ausente, proposta rejeitada/superseded.

### 12.7 Componentes
- **Backend**:
  - `supabase/functions/_shared/ads-autopilot/twoStep.ts` — helpers puros
    (constantes, `isTwoStepAction`, `buildCreativeBrief`, `runTwoStepCreativeGate`).
  - `supabase/functions/ads-autopilot-strategist/index.ts` — intercepta
    `generate_creative` em modo two-step e salva o brief sem gerar.
  - `supabase/functions/ads-autopilot-approve-strategy/index.ts` — Etapa 1 → 2.
  - `supabase/functions/ads-autopilot-finalize-creative/index.ts` — marca
    `final_pending_approval` quando o creative_job termina.
  - `supabase/functions/ads-autopilot-execute-approved/index.ts` — guard
    two-step.
- **Front**:
  - `src/hooks/useAdsPendingActions.ts` — query agora inclui os 3 estados
    ativos + mutações `approveStrategy` e `finalizeCreative`.
  - `src/components/ads/ActionApprovalCard.tsx` — bloco "Prompt do criativo",
    botão "Aprovar e gerar criativos" e abertura do dialog Etapa 2.
  - `src/components/ads/CreativeGenerationStepDialog.tsx` — dialog modal da
    Etapa 2 (polla creative_job, exibe galeria + resumo final).

### 12.8 Testes
`src/test/ads-autopilot-two-step.test.ts` — 17 testes cobrindo marcador de
fluxo, brief diferido, Quality Gate da Etapa 2 (todos os bloqueios), estados
oficiais e compatibilidade com propostas legacy. **17/17 passando**.

### 12.9 Fora de escopo desta entrega
- "Nova Estratégia" (Frente 3) — não implementado.
- Mudanças em C.4, autoexecução, Tenant Memory, F.1/F.2, cadência semanal/mensal.
- Estimativa monetária pré-débito (exibido aviso textual genérico).

---

## 13 — Frente 4.1 — Inteligência produto×funil e UI/UX do modal de propostas (v1.0.0)

### 13.1 Objetivo
Eliminar dois problemas estruturais observados na Etapa 1 do `two_step_v1`:

1. A IA propunha ofertas avançadas (ex.: kit com 3 unidades de cada produto base) para Público Frio, onde o usuário ainda não conhece a marca.
2. O modal de proposta tinha aparência técnica, dificultando a decisão de negócio.

A solução é **híbrida**: o Estrategista passa a entender a composição comercial do produto antes de propor, e um novo gate funciona como defesa final caso uma proposta inadequada chegue até o usuário.

### 13.2 Classificação comercial por composição
Módulo puro: `supabase/functions/_shared/ads-autopilot/productCommercialClassifier.ts`.

Classes oficiais:

| Classe | Definição |
|---|---|
| `produto_base` | Produto único, vendido sozinho |
| `produto_principal_simples` | Base com sinal de "principal" (tag/flag ou preço ≤ 1,15× do menor preço base ativo) |
| `kit_unitario_apresentacao` | Composição com 2+ bases distintas, 1 unidade de cada |
| `kit_quantidade` | Composição com `quantity > 1` em qualquer linha, ou multipack do mesmo SKU detectado no nome ("(2x)", "Kit 3", "3 unidades") |
| `recompra_retencao` | Tag/categoria explícita de recompra/recorrência/manutenção/assinatura |
| `upsell_manutencao` | Tag de upsell + preço > 2,5× do menor preço base |
| `desconhecido` | Sem dados suficientes (confiança baixa) |

Ordem de leitura (fonte de verdade):
1. Tabela de composição real do produto (única fonte para composição).
2. Tabela de payload comercial da IA (`is_base_candidate`, `base_product_id`).
3. Tags/categorias/tipo.
4. Nome + preço como fallback conservador (marca confiança baixa).

**Regra-chave:** se qualquer componente tem quantidade maior que 1, a oferta é `kit_quantidade`.

### 13.3 Product/Funnel Fit Gate
Módulo puro: `supabase/functions/_shared/ads-autopilot/productFunnelFitGate.ts`.

Roda **depois** do Quality Gate (não substitui). Matriz de adequação:

| Funil | Aceita (alta) | Aceita c/ ressalva | Bloqueado |
|---|---|---|---|
| Frio (cold / tof) | `produto_base`, `produto_principal_simples`, `kit_unitario_apresentacao` | — | `kit_quantidade`, `upsell_manutencao`, `recompra_retencao` |
| Remarketing/Morno | tudo | `recompra_retencao` (sugere mover para Clientes) | — |
| Quente (hot / bof) | tudo | — | — |
| Retenção/Clientes | `recompra_retencao`, `upsell_manutencao`, `kit_quantidade` | `produto_base`, `produto_principal_simples` (média) | — |

Quando a composição é desconhecida e a confiança baixa, o gate marca **"composição incerta"** e bloqueia somente em Frio.

**Reason codes** (registrados no payload em "Detalhes técnicos"): `cold_audience_bundle_not_recommended`, `cold_audience_high_friction_offer`, `cold_audience_retention_offer_mismatch`, `product_funnel_mismatch`, `offer_stage_mismatch`, `product_composition_unknown_low_confidence`, `fit_ok`.

### 13.4 Decisão híbrida (soft-block)
Quando o gate bloqueia, a UI:
- Mostra **badge de adequação** ("Bloqueada" / "Composição incerta") no cabeçalho do card e no modal.
- Exibe um **alerta em vermelho** com a mensagem amigável e ações sugeridas (trocar produto, mover para Remarketing/Clientes, revisar cadastro).
- **Desabilita** o botão "Aprovar e gerar criativos" e troca o rótulo para "Ajuste necessário antes de aprovar".
- Os botões "Ajustar" e "Rejeitar" continuam disponíveis.

### 13.5 Reorganização do modal (Etapa 1 do two_step_v1)
A visão de abas foi substituída por **blocos verticais** apenas para o estágio "strategy". Legacy (Etapa 2 e fluxo antigo) mantém as abas.

Blocos:
1. **Adequação produto×público** (badge tonal no topo).
2. **Resumo da recomendação** — frase única em linguagem de negócio.
3. **Produto e oferta** — nome, tipo comercial, composição, preço, orçamento, CTA.
4. **Público e exclusões** — descrição + exclusão de Clientes.
5. **Prompt & Copy** — aviso amarelo "nenhum criativo final foi gerado ainda" + prompt limpo + "Formato sugerido: 1:1" + headlines + textos principais + miniatura "Referência visual do produto".
6. **Riscos e validações** — Quality Gate, Fit Gate e ajustes sugeridos.
7. **Detalhes técnicos** — `<details>` recolhido por padrão, contém `flow_version`, `product_id`, `creative_brief` cru, `reason_codes`, `classification_signals`.

Payload técnico bruto não aparece na visualização principal.

### 13.6 Cenário de validação
Proposta sintética ativa: **`c6fef3ed-42e8-4637-98ac-9dfdeadf62f4`** — Kit Banho Calvície Zero Dia (Shampoo 1× + Balm 1× → `kit_unitario_apresentacao`) em Público Frio → **adequação alta**, botão liberado.

Proposta antiga "Kit 3x em Frio" foi arquivada como `rejected` com `cleanup_audit = archived_for_fit_gate_validation_2026_06_09`. O cenário ruim (`kit_quantidade` em Frio → blocked) é coberto por testes automatizados, sem poluir a fila visual.

### 13.7 Testes
`src/test/ads-autopilot-product-funnel-fit.test.ts` — 16 testes (7 do classificador + 9 do gate). **Suite completa do autopilot: 217/217 passando**.

### 13.8 Restrições preservadas
Nada de Nova Estratégia. C.4, toggles de autoexecução, Tenant Memory, F.1/F.2 e cadência semanal/mensal seguem intactos. Nenhuma chamada Meta/Google/TikTok. Nenhum criativo real, nenhum crédito consumido, nenhuma campanha publicada.

### 13.9 Anti-regressão (mantida apenas em docs do repositório)
- O usuário decidiu **não** criar memória `mem://constraints/...` para esta regra. Toda a anti-regressão vive aqui (`gestor-trafego.md`) e em `mapa-ui.md`.
- Regra: para qualquer alteração no Estrategista, no Gate ou na UI de propostas, validar:
  1. Composição com `quantity > 1` continua classificada como `kit_quantidade`.
  2. Frio + `kit_quantidade` continua bloqueando o botão de aprovar.
  3. Modal da Etapa 1 continua em blocos verticais, sem payload técnico bruto fora de "Detalhes técnicos".
  4. Imagem de produto continua aparecendo apenas como "Referência visual" pequena, jamais contada como criativo final.


---

## §14 — Editor estruturado, versionamento e feedback (Frentes 4.2/4.3/4.4)

Entregue em 2026-06-09. Substitui o "Sugerir Ajuste" textual livre para propostas no fluxo `two_step_v1` Etapa 1 (estratégia ainda não aprovada).

### 14.1 Modal de decisão completo (Frente 4.2)
O modal "Ver conteúdo completo" do estágio `strategy` agora exibe, antes do bloco Produto, um bloco **Campanha** com: nome, objetivo, canal/plataforma, orçamento diário, link de destino e botão (CTA). O link é renderizado como hyperlink seguro. Demais blocos verticais e a regra de Detalhes técnicos recolhidos (§13.5) seguem inalterados.

### 14.2 Editor estruturado de ajuste (Frente 4.3)
Botão "Ajustar" em propostas `two_step_v1 strategy` abre um **drawer lateral à direita** (largura `sm:max-w-xl`, fullscreen em mobile) com a proposta pré-preenchida e os seguintes blocos editáveis:

- **Campanha**: nome, objetivo, orçamento diário, link de destino, CTA. Canal/plataforma **somente leitura**.
- **Produto e oferta**: produto, nome de referência, observação da oferta.
- **Público**: funil, descrição do público, exclusões, região, faixa etária, gênero.
- **Criativo e copy**: prompt criativo, formato sugerido, tom, headline, texto principal, descrição. Referência visual do produto continua somente leitura.
- **Feedback para a IA**: motivo do ajuste (1 frase), chips de categoria (Produto/Público/Orçamento/Copy/Criativo/Oferta/Estratégia/Outro), observação opcional. Quando o chip "Outro" é marcado, a observação vira obrigatória.

Regras invioláveis:
- Abrir o drawer, editar campos, marcar chips e salvar rascunho **não chamam IA**.
- O rascunho persiste em `ads_autopilot_actions.action_data.draft_patch` (banco) — recarrega ao reabrir o drawer.
- "Gerar proposta revisada" exige confirmação e dispara **uma única chamada** à edge function `ads-autopilot-revise-proposal`, que por sua vez chama o Strategist 1x. Nenhum criativo é gerado, nenhum crédito é consumido, nenhuma campanha é publicada.
- Validações locais bloqueiam "Gerar proposta revisada" se: nome vazio, produto vazio, funil vazio, orçamento ≤ 0, link mal formado, ou Fit Gate retornar `soft_block`.

Para propostas legacy (sem `flow_version='two_step_v1'`), o "Sugerir Ajuste" textual antigo continua disponível como fallback.

### 14.3 Versionamento da proposta
Cada revisão cria uma nova proposta filha encadeada à anterior:
- A proposta original é marcada com `status = 'superseded'` e `superseded_by_action_id` apontando para a nova.
- A nova proposta recebe `parent_action_id` apontando para a antiga, `action_data.version = N+1` e `action_data.revision_source` com snapshot de `changed_fields`, `previous_values`, `new_values` e `user_feedback`.
- O histórico cumulativo fica em `action_data.adjustment_history` da proposta antiga (preservando todas as revisões anteriores).
- Propostas `superseded` somem da fila "Aguardando Ação" automaticamente (não estão em `ACTIVE_PENDING_STATUSES`).

### 14.4 Patch estruturado enviado à IA
A edge function `ads-autopilot-revise-proposal` constrói o seguinte contrato e o envia ao Strategist no formato esperado por `trigger=revision`:

```
{
  proposal_id, tenant_id,
  changed_fields, previous_values, new_values,
  user_feedback: { adjustment_reason, note, chips }
}
```

Internamente o edge function constrói um `revision_feedback` em linguagem natural (com a lista de mudanças e o feedback) e passa também `revision_structured_patch` para o Strategist usar como referência. Tudo isto está sujeito ao Quality Gate, Fit Gate e exclusão de Clientes em Frio.

### 14.5 Feedback em Aprovar / Rejeitar / Ajustar (Frente 4.4 parcial)
O gate de feedback existente (`useAdsAutopilotFeedbackGate`) já cobre Aprovar e Rejeitar com chips de motivo e textarea opcional, gravando em `ads_autopilot_feedback` via edge function `ads-autopilot-feedback-record`. No editor estruturado (Frente 4.3), o feedback de ajuste vai junto no payload da revisão.

**Importante (Etapa 4 — não entregue ainda):** O Strategist ainda **não consome** o feedback acumulado para alterar decisões. O contrato e o histórico estão prontos, mas a injeção no prompt fica para uma frente futura, para evitar mudança estratégica prematura com volume baixo de feedback.

### 14.6 Anti-regressão (mantida apenas neste doc + `mapa-ui.md`)
- Abrir/editar/salvar rascunho **nunca** chama IA. Apenas "Gerar proposta revisada" chama.
- Salvar rascunho **sempre** persiste em banco (`action_data.draft_patch`), nunca apenas em estado local.
- Propostas revisadas **devem** ter `parent_action_id` setado e a proposta antiga **deve** ter `superseded_by_action_id` setado.
- Canal/plataforma e Referência visual continuam **somente leitura** no editor.
- Detalhes técnicos brutos não aparecem na visualização principal do modal.

### 14.7 Testes
`src/test/ads-autopilot-structured-editor.test.ts` — 7 testes (diff, validações, contrato do payload). Combinados com a suíte de Fit Gate (§13.7) somam a cobertura mínima do editor.

---

## Visualização Estruturada de Propostas (v6.13.0 — 2026-06-10)

> Onda paralela à coleta de ROAS Real. Tema: como o lojista enxerga e decide cada proposta da IA na fila **Aguardando Ação**.

### Por que mudou

Antes, o card da fila tinha 3 ações (Aprovar e gerar criativos / Ajustar / Rejeitar) e um modal de detalhe que não respeitava a hierarquia real de mídia paga (Campanha → Conjunto(s) de anúncios → Anúncio(s)). Isso permitia decisão sem visualizar a estrutura completa, especialmente em propostas Etapa 1 do fluxo two_step_v1.

### Novo padrão

1. **Card resumo (fila Aguardando Ação)** — propostas de campanha estruturadas (Nova Campanha / two_step_v1 Etapa 1 / payload legacy que o adapter reconhece como campanha) passam a ter **um único CTA: "Visualizar proposta"**. Os botões Aprovar / Ajustar / Recusar não aparecem mais no card.
2. **Modal de Visualização Estruturada** — abre ao clicar em "Visualizar proposta". Modal grande com **árvore lateral** no desktop e lista empilhada no mobile, com os nós:
   - Visão Geral (resumo, racional da IA, etapa do fluxo, adequação, alertas)
   - Campanha (nome, objetivo, canal, orçamento, destino, CTA, status planejado)
   - Conjuntos de anúncios (1..N) — público, segmentação, inclusões, exclusões, idade, gênero, região, posicionamentos, otimização, evento de conversão, agendamento, orçamento
   - Anúncios (1..N) — produto/oferta, copy, headline, descrição, CTA, link, prompt criativo, formato, referência visual, status do criativo
   - Validações — Quality Gate, Product/Funnel Fit Gate, ações sugeridas
   - Histórico — versão atual/anterior, rascunho, feedbacks
   - Detalhes técnicos (recolhido por padrão) — ids, flow_version, reason_codes
3. **Rodapé fixo do modal** — único lugar onde Aprovar / Ajustar / Recusar aparecem:
   - **Aprovar estratégia e gerar criativos** (Etapa 1) ou **Aprovar** (legacy). Bloqueado se Quality Gate ou Product/Funnel Fit Gate negarem.
   - **Ajustar proposta** — abre o Editor Estruturado (Frente 4.3) reorganizado em Campanha / Conjunto / Anúncio / Feedback.
   - **Recusar proposta** — reaproveita o fluxo "Não quero" / "Quero outra proposta" existente.

### Compatibilidade legacy

Ações operacionais (pause_campaign, adjust_budget, generate_creative, strategic_plan, grupos órfãos de conjuntos) **mantêm** o card antigo com 3 botões. Critério: o **adapter** classifica a proposta. Só ganha o novo modal quando `is_structured_campaign === true`.

### Contrato de dados canônico (aditivo)

Novo formato em `action_data.campaign_structure`:

```text
campaign_structure
├── campaign { name, objective, platform, buying_type, budget_type,
│              daily_budget_cents, destination_url, cta, planned_status, rationale }
├── ad_sets[] { name, funnel_stage, audience_type, targeting_summary,
│               inclusions[], exclusions[], customer_exclusion,
│               location, age_range, gender, placements[],
│               optimization_goal, conversion_event, schedule,
│               daily_budget_cents, rationale }
└── ads[] { name, ad_set_ref, product_name, offer_note,
            primary_text, headline, description, cta, destination_url,
            creative_prompt, creative_format, alternative_formats[],
            reference_image_url, creative_final_url, creative_status, rationale }
```

Regras:
- **Aditivo:** não substitui campos atuais; pode coexistir com `adsets[]`, `ads[]`, `preview.*`.
- **Sem migração:** propostas antigas continuam funcionando sem nenhum UPDATE em massa.
- **Adapter de leitura tolerante:** `normalizeCampaignStructure(action_data, { actionType, flowVersion })` aceita ambos os formatos, nunca muta o payload original, devolve `null` em campos ausentes (UI exibe "—" / "Não informado").
- **Gerador (edge function strategist):** **pendência declarada** — não é alterado nesta entrega. A UI funciona via adapter para 100% dos cenários atuais. Em entrega futura o gerador pode passar a gravar `campaign_structure` em paralelo, sem quebrar nada.

### Regras anti-processamento (mantidas)

- Abrir modal: 0 chamadas IA. Navegar entre nós: 0. Abrir editor: 0. Editar campo: 0. Salvar rascunho: 0. Recusar: 0. Feedback: 0.
- Apenas **"Gerar proposta revisada"** dispara IA (1 vez) e **"Aprovar estratégia e gerar criativos"** pode iniciar a geração de criativos da Etapa 2.
- Nenhuma chamada Meta/Google/TikTok ao visualizar. Nenhuma publicação automática. Nenhum consumo de crédito ao visualizar/editar/salvar rascunho.

### Editor Estruturado (Frente 4.3) — reorganização visual

Seções renomeadas para refletir a hierarquia:
- **Campanha** — nome, objetivo, orçamento, canal (somente leitura), link/destino, CTA.
- **Conjunto de anúncios** — funil, público, segmentação, exclusões, região, idade, gênero. (antes: "Público" + "Produto e oferta" misturados)
- **Anúncio** — produto, oferta, prompt criativo, formato, tom, headline, texto principal, descrição. (antes: "Criativo e copy")
- **Feedback para a IA** — motivo, categorias, observação.

Sem alteração de mutations, rascunho, versionamento ou feedback persistidos.

### Anti-regressão

- Card de propostas estruturadas **não pode** voltar a exibir Aprovar/Ajustar/Rejeitar diretamente.
- Modal **não pode** voltar a exibir payload bruto no corpo principal (somente em "Detalhes técnicos" recolhido).
- Adapter **não pode** mutar `action_data`.
- Compatibilidade com payload legacy (`adsets[]`, `ads[]`, `preview.*`) é obrigatória.

---

## Motor de Propostas — Onda 0 + A + B mínima (v2026-06-10)

Esta seção formaliza a entrega que corrige a origem estrutural das propostas. A UI estruturada (modal hierárquico Campanha → Conjunto → Anúncio) já estava entregue; o que estava faltando era o **motor gerar a estrutura completa** e o sistema **bloquear aprovação** quando viesse incompleta ou incompatível.

### Onda 0 — Baseline oficial de capacidades

Doc dedicado: `docs/especificacoes/marketing/plataformas-baseline.md`.

- Fonte de verdade do que cada plataforma aceita hoje, com URLs oficiais e datas de consulta.
- Meta Ads entra como **verificado**. Google Ads e TikTok Ads entram como **não verificado** (placeholder) e ficam bloqueados para aprovação/geração de criativo até verificação humana.
- Cron mensal automático fica para entrega futura. Esta onda só semeia manualmente.

### Onda A — CanonicalCampaignPlan v2 e Strategist

- `action_data.campaign_structure` ganha `schema_version` (1 = legacy, 2 = canônico v2). Nome do campo mantido — sem migração, sem `UPDATE` em massa, sem remoção de campos legacy. Adapter (`normalizeCampaignStructure`) continua tolerante a propostas antigas.
- O Strategist passa a exigir, para **cada conjunto de anúncios** dentro do plano: nome, tipo de público, descrição do público, região/país, faixa etária (min/max), gênero, posicionamentos, meta de otimização, evento de conversão e local de conversão. Orçamento por conjunto continua obrigatório em campanhas ABO de teste.
- Quando o motor não sabe um campo obrigatório (ex.: evento de conversão sem Pixel confirmado), ele preenche com o valor literal `requires_user_input`. O Gate trata isso como bloqueio amigável — nunca aparece como `—` silencioso na UI.
- Defaults seguros vêm do registro de capacidades (não do prompt): país `BR`, modo de compra `AUCTION`, posicionamentos `advantage_plus`, local de conversão `Site`, idade 18-65, gênero `Todos`, status inicial `PAUSED`.

### Onda B mínima — Registro de capacidades

Três tabelas: `platform_capabilities`, `platform_compatibility_checks`, `platform_compatibility_alerts`. Acesso de leitura para qualquer usuário logado; escrita só para admin de plataforma; service_role completo para edge functions.

Snapshot inicial:
- Meta: `status='verificado'`, `last_verified_at=NOW()`, `next_check_at=+30d`, capabilities completas, fontes oficiais registradas.
- Google: `status='nao_verificado'`, placeholder.
- TikTok: `status='nao_verificado'`, placeholder.

### Gates novos

- **Structure Completeness Gate** (`src/lib/ads/gates/structureCompleteness.ts`) — roda no cliente sobre `CampaignStructure`, devolve `blockers[]` + `warnings[]` + `summary`. Bloqueia "Aprovar estratégia e gerar criativos" se houver qualquer campo obrigatório ausente ou `requires_user_input`.
- **Platform Compatibility Gate inicial** (`src/lib/ads/gates/platformCompatibility.ts`) — recebe a linha do registro de capacidades e bloqueia quando: plataforma não verificada, `revisao_necessaria`, `vencido`, `verificacao_falhou`, ou última verificação > 60 dias. Também bloqueia objetivo/evento fora do suportado; posicionamento/CTA/formato fora vira warning.

Os dois gates são **pure functions**, sem chamadas de IA ou rede. O modal lê o registro via `usePlatformCapability` (query simples, cache 5 min).

### Comportamento no modal

- Aba **Visão Geral** ganha bloco "Validações" com bloqueios em vermelho (`Badge destructive` + nó afetado) e alertas em cinza.
- Rodapé do modal mostra uma linha amarela explicando por que o botão de aprovar está bloqueado, quando aplicável.
- Botão "Aprovar estratégia e gerar criativos" fica desabilitado quando há qualquer blocker; tooltip explica o motivo.
- Botões "Ajustar proposta" e "Recusar" continuam ativos. Salvar rascunho e editar continuam sem consumir IA.

### Restrições mantidas

- Zero chamada de IA ao abrir, navegar, editar ou salvar rascunho.
- Zero criativo gerado nesta etapa.
- Zero publicação em Meta/Google/TikTok.
- Zero consumo de crédito.
- Sem cron mensal nesta entrega.
- Sem admin completo de compatibilidade nesta entrega.
- Google Ads e TikTok Ads ficam preparados (placeholder no registro), mas não operacionais.

### O que entra em ondas futuras

- Verificador mensal (sem IA) que cruza fontes oficiais, atualiza hash e gera alertas.
- Tela de admin "Compatibilidade das Plataformas".
- Snapshot real de Google Ads e TikTok Ads após verificação humana.
- Adapters compiladores (Meta/Google/TikTok) — esta entrega só valida; ainda não compila payload de publicação.

---

## Motor de Propostas — Onda C (ownership de campos por nível, rev 2026-06-10)

Esta onda corrige a semântica do contrato de propostas para que cada campo
pertença ao nível correto da estrutura de mídia paga: **Campanha → Conjunto
de anúncios → Anúncio → Criativo**. Sem isso, os blockers apontavam para o
nó errado e a UI exibia link/CTA como se fossem propriedade da Campanha.

### Platform Field Ownership Matrix (Meta Ads)

| Nível | Campos que pertencem a este nível |
|---|---|
| **Campanha** | name · objective (canônico) · buying_type · budget_type · daily_budget (se CBO) · planned_status · rationale · special_ad_categories |
| **Conjunto de anúncios** | name · campaign_ref · funnel_stage · audience_type · targeting/inclusions/exclusions · customer_exclusion · location · age_range · gender · placements · optimization_goal · billing_event · conversion_location · conversion_event · promoted_object/pixel · attribution_window · schedule · budget (se ABO) · status · rationale |
| **Anúncio** | name · ad_set_ref · status · relacionamento com o criativo |
| **Criativo do anúncio** | product/offer · primary_text · headline · description · **CTA** · **destination_url** · **tracking_params** · display_url · creative_format · reference_image · alternative_formats · final_creative_assets · rationale |

> Link de destino, CTA e parâmetros de rastreamento NUNCA são propriedade
> principal da Campanha. Se aparecerem no topo do payload (legado), o
> adapter os trata como **herança** e a UI só os mostra como leitura no
> bloco "Resumo herdado dos anúncios".

### Objective Mapper (canônico ↔ plataforma)

| Label PT-BR (UI) | Enum canônico interno | Meta Ads |
|---|---|---|
| Vendas | `sales` | `OUTCOME_SALES` |
| Geração de leads | `leads` | `OUTCOME_LEADS` |
| Tráfego | `traffic` | `OUTCOME_TRAFFIC` |
| Reconhecimento de marca | `awareness` | `OUTCOME_AWARENESS` |
| Engajamento | `engagement` | `OUTCOME_ENGAGEMENT` |
| Promoção de aplicativo | `app_promotion` | `OUTCOME_APP_PROMOTION` |

Regras:

- A IA grava o **enum canônico** em `campaign.objective`.
- O Platform Compatibility Gate **só compara** depois de traduzir o canônico
  para o enum oficial via `translateObjectiveToMeta()`.
- Strings legadas (`SALES`, `OUTCOME_SALES`, `Vendas`, `Conversions`) são
  reconhecidas por `inferCanonicalObjective()`. Strings desconhecidas
  produzem blocker amigável em PT-BR, **nunca** o erro técnico
  "SALES não suportado".
- A mesma camada existe para CTA, evento de conversão, posicionamento e
  formato criativo, garantindo que Google Ads e TikTok ganhem seus próprios
  mappers no futuro sem mexer na UI.

### GateIssue v2

Todo bloqueio/aviso passa a carregar:

- `node_type`: `campaign` | `ad_set` | `ad` | `creative` | `platform`
- `node_id`: identificador estável do nó (index do conjunto/anúncio)
- `field`: caminho canônico do campo (`adset.0.conversion_event`)
- `severity`: `blocker` | `warning` | `info`
- `message`: PT-BR amigável (exibido ao usuário)
- `technical_reason`: detalhe interno (não exibido)
- `suggested_action`: orientação curta (opcional)
- `kind`: `required` | `recommended` | `optional` | `requires_user_input`

Ownership dos blockers (regra fixa):

- CTA / link / copy / headline / formato ausentes → `creative`
- evento / otimização / posicionamentos / região / idade / gênero ausentes → `ad_set`
- modo de compra / tipo de orçamento / orçamento / objetivo / nome ausentes → `campaign`
- objetivo sem mapeamento ou plataforma não verificada → `platform`

### Comportamento da UI

- **Aba Campanha** mostra apenas campos do nível Campanha. Se houver link/CTA
  legados, aparecem em bloco secundário "Resumo herdado dos anúncios" com
  rótulo explícito ("do anúncio") e nota explicativa.
- **Aba Conjunto** exibe selo **"Pendente · Obrigatório"** (vermelho) no
  lugar de `—` para qualquer campo obrigatório que tenha gerado blocker.
- **Aba Anúncio** é dividida em dois blocos visuais: **Anúncio** (nome,
  conjunto vinculado, status) e **Criativo do anúncio** (CTA, link,
  tracking, copy, formato, etc.). A árvore lateral continua mostrando
  apenas "Anúncio N".
- **Ajustar proposta** lê o `node_type` do primeiro blocker e rola o
  editor estruturado até a seção correspondente (campanha / conjunto /
  anúncio). Nunca abre em formulário genérico.

### Strategist

Atualizado para gravar `objective` no enum canônico interno (`sales`, `leads`,
`traffic`, `awareness`, `engagement`, `app_promotion`). Quando não conseguir
confirmar um dado obrigatório, escreve a string literal
`requires_user_input` em vez de inventar — o gate transforma isso em
blocker amigável.

### Compatibilidade com proposta atual

Propostas geradas antes desta onda continuam funcionando: o adapter aceita
o enum oficial da Meta como entrada legada, link/CTA do topo são exibidos
apenas como "Resumo herdado", e o Conjunto vazio gera blockers amigáveis
em vez de `—` silencioso. Nenhuma proposta é regerada por IA nesta etapa.

### Restrições mantidas

- Zero chamada de IA ao abrir, navegar, editar ou salvar rascunho.
- Zero criativo gerado.
- Zero publicação em Meta / Google / TikTok.
- Zero consumo de crédito.
- Sem cron mensal, sem admin completo, sem Google/TikTok operacionais.

---

## Motor de Propostas — Onda D (Base de produção Meta enxuta, v2026-06-10)

### Resumo executivo
Foco em deixar o fluxo real de criação de campanhas Meta Ads em condição de produção inicial. Sem cron, sem admin avançado, sem Google/TikTok operacionais, sem publicação.

### D.1 — Aba Campanha enxuta
Removido em definitivo o bloco "Resumo herdado dos anúncios" da aba Campanha. A aba mostra **apenas**: nome, objetivo, canal, modo de compra, tipo de orçamento, orçamento diário, status inicial e racional. Link, CTA e tracking só aparecem em Anúncio/Criativo.

### D.2 — Configuração de Criação Meta (persistida)
Tabela `ads_meta_production_config` (1 registro por tenant × conta de anúncios) — fonte de verdade real dos defaults usados pelo Strategist. Campos: identidade (Página, Instagram), mensuração (Pixel, evento, janela), defaults de Campanha, defaults de Conjunto (país, idioma, idade, gênero, posicionamento, exclusão de clientes, públicos, lookalikes) e defaults de Anúncio/Criativo (CTA, formato, UTM, estratégia de imagem).

Defaults seguros: BR · pt_BR · 18-65 · todos · Advantage+ · Leilão · objetivo `sales` · status `PAUSED` · CTA `SHOP_NOW` · formato `1x1`. **Pixel, Página, Instagram Actor e Evento de conversão nunca são inventados.**

### D.3 — UI: separação estratégia × ativos técnicos (rev 2026-06-10, correção pós-Onda E)
A aba **Configurações Gerais** do Gestor de Tráfego IA é exclusivamente para diretrizes **estratégicas e comerciais** do usuário: ativação da IA, execução automática diária, Modo Piloto / Modo Piloto Inicial, orçamento, ROI ideal, ROI mínimo por funil, estratégia geral, splits de funil e prompt estratégico (com botão de geração assistida por IA).

O formulário manual "Configuração de Criação Meta" (Página do Facebook, Conta do Instagram, Pixel/Dataset, evento de conversão, IDs técnicos, públicos personalizados, posicionamentos, CTA/formato default, UTM etc.) **foi removido da UI principal**. Esses ativos são tratados como **dados técnicos da integração Meta**: coletados via sincronização read-only, armazenados em cache/tabelas internas e usados pelo Strategist e pelos gates sem exigir digitação manual do usuário na tela estratégica.

No card de cada conta Meta o usuário vê apenas um **status inline somente leitura**: "Meta conectada · ativos sincronizados pela integração" quando OK, ou um alerta curto listando o que a integração não detectou (ex.: Pixel ausente) com link para Integrações. Eventual fallback manual fica restrito à área técnica de integração — não é o fluxo principal. A tabela `ads_meta_production_config` e o hook `useAdsMetaProductionConfig` continuam existindo como **estrutura operacional interna**, consumidos pelo Strategist (`collectStrategistContext`) e pelos gates; ausência de dado técnico vira `limitations` em `ads_ai_analysis_runs`, não campo obrigatório na UI estratégica.


### D.4 — Gates por etapa
`runStructureCompletenessGate(structure, { stage })` aceita 3 etapas:
- **strategy (default):** Campanha + Conjunto + Criativo minimamente prontos. Evento de conversão = warning.
- **creative:** apenas Criativo (produto, link, CTA, copy/prompt, formato, referência).
- **publish:** evento de conversão obrigatório; Página e Pixel cobertos pela Configuração de Criação Meta.

O modal de proposta usa `strategy` — assim, "evento de conversão pendente" deixou de bloquear a aprovação.

### D.5 — Strategist usa a Configuração de Criação Meta
`gatherContext` carrega as configs Meta do tenant e indexa por `ad_account_id`. Um bloco `## CONFIGURAÇÃO DE CRIAÇÃO META (PRODUÇÃO)` é injetado no prompt do Strategist Meta com todos os defaults reais — ou instruções de fallback conservador. Pixel/Página/Instagram/Evento não configurados aparecem como `requires_user_input`.

### D.6 — Restrições mantidas
- Zero IA chamada ao abrir, navegar, editar ou salvar.
- Zero criativo gerado, zero crédito consumido.
- Zero publicação Meta/Google/TikTok.
- Zero chamada Meta para criar campanha.
- Sem cron, sem admin avançado, sem Google/TikTok operacional, sem regeneração automática de propostas.

### Regra canônica — exclusão obrigatória no nível do adset (rev 2026-06-13)

- Em campanha fria/prospecção, **action-level não é suficiente**. A exclusão de clientes/compradores precisa existir também no nível operacional de cada conjunto (`adset`).
- O payload canônico exigido por conjunto é:
  - `audience_exclusions.customers=true`
  - `excluded_audience_ids[]` contendo o público de clientes
  - `targeting.excluded_custom_audiences[]` contendo o mesmo público
- Se o público de clientes não estiver disponível para a conta Meta conectada, o plano deve ficar **fail-closed** com `audience_exclusions.pending_dependency='customer_audience_not_detected'` em cada adset frio/prospecção.
- A única exceção continua sendo `campaign_intent='creative_test'` com `exclusion_override_reason` explícita e auditável.
- O endpoint de aprovação da estratégia revalida a regra usando a fonte canônica e não depende apenas do campo legado `customer_audience_exclusion`.
- Plano inválido não aprova, não gera propostas filhas e não altera campanha real.


## Onda E — Modo Piloto vs Modo Piloto Inicial (10/06/2026)

### E.1 — Ativação com duas opções
Ao ligar o switch da IA pela primeira vez, abre um diálogo perguntando:
- **Modo Piloto:** ativa a IA e segue o fluxo normal a partir de agora. Não chama IA, não cria execução de análise.
- **Modo Piloto Inicial (Recomendado):** ativa a IA e roda uma análise estratégica inicial da conta, como se um gestor de tráfego estivesse começando agora. Cria propostas na fila Aguardando Ação. Não publica, não gera criativo final automaticamente.

O disparo automático de Strategist no toggle foi removido — IA só roda quando o usuário escolhe explicitamente.

### E.2 — Botão manual "Rodar análise inicial agora"
Exibido no card da conta Meta quando a IA está ativa. Confirmação obrigatória. Bloqueia execução duplicada e pede nova confirmação se a última análise tiver menos de 24h.

### E.3 — Persistência (`ads_ai_analysis_runs`)
Tabela real de produção registra cada análise: plataforma, conta, escopo (`account` ou `global`), gatilho (`activation_initial` ou `manual`), status, horários, snapshot do contexto usado, diagnóstico, estratégia, riscos, limitações detectadas, IDs das propostas criadas, mensagem de erro. Unique index parcial garante que só exista uma execução em andamento por escopo.

### E.4 — Motor (AdsStrategyContextBuilder)
A camada canônica de contexto é `collectStrategistContext` em `ads-autopilot-strategist`. A análise inicial chama o Strategist com `trigger=start` em vez de duplicar lógica. A edge `ads-ai-initial-analysis` captura snapshot resumido para auditoria humana, mas nunca inventa dados ausentes — registra como limitação.

### E.5 — Escopo
Default: por conta (`scope=account`, Meta).

**Escopo global (correção 2026-06-10, edge v1.1.0):**
- Novo botão "Análise inicial global" no topo do Gerenciador de Anúncios.
- Itera todas as contas Meta com IA ativada do tenant (`ads_autopilot_account_configs.is_ai_enabled=true, channel=meta`).
- Para cada conta válida, reutiliza a função interna `runForAccount` (que reusa `collectStrategistContext` via `ads-autopilot-strategist`).
- Cria 1 run parent (`scope=global`, `ad_account_id=NULL`) + N runs filhas (`scope=account`, `parent_run_id` no `input_config_snapshot`).
- Se uma conta já tem análise em andamento, é pulada sem quebrar o lote (status `skipped`, motivo `already_running`).
- Se a conta teve análise concluída <24h e `force=false`, é pulada (motivo `recent_completed_requires_force`).
- Google/TikTok: detectados em `ads_autopilot_account_configs.channel IN ('google','tiktok')` e listados como limitação amigável; **não bloqueiam** a análise da Meta.
- Se o tenant tem apenas 1 conta Meta ativa, o global roda para essa conta e registra como `scope=global` no nível do tenant.
- Run parent agrega: contagem total, completas, falhas, puladas; lista `per_account` com `context_summary`, `status`, `run_id` filho; `strategy_summary` em texto humano consolidado.

### E.6 — Resumo do contexto usado
A função `buildHumanContextSummary` gera, por conta, uma linha amigável:
> "Esta análise considerou: conta Meta act_..., orçamento R$ 50,00, ROI/ROAS alvo 3.0, país BR, idade 18-65, posicionamentos Advantage+, CTA SHOP_NOW, formato single_image, diretrizes configuradas."

Vai para `strategy_summary` (parent) e `account_snapshot_summary.per_account[].context_summary`. O payload técnico bruto permanece em `input_config_snapshot` para auditoria — nunca exposto na UI.

### E.7 — Restrições
- Modo Piloto não chama IA.
- Modo Piloto Inicial chama IA uma única vez por escopo escolhido.
- Global: chama IA uma vez por conta Meta elegível, sequencialmente (evita estourar custo).
- Não roda ao abrir tela, navegar ou salvar configurações.
- Não repete análise recente sem confirmação.
- Não publica campanha, não muta Meta/Google/TikTok, não gera criativo final, não consome crédito sem aprovação.
- Google/TikTok continuam não operacionais nesta etapa.


---

## F — Onda F: Pipeline de Produção (Plano → Filhas, UTM obrigatória, Aprendizados)

### F.1 — Plano Estratégico → Propostas filhas
- Aprovar Plano marca o plano como `approved` e dispara o Strategist com `trigger=implement_approved_plan`, passando `source_plan_id` e `analysis_run_id`.
- Cada proposta filha gerada recebe:
  - `parent_action_id` = id do plano-pai
  - `analysis_run_id` = rodada de análise que originou o plano
  - `planned_action_index` = posição da ação planejada na lista do plano
- Dedup: índice único parcial em `(parent_action_id, planned_action_index)` impede gerar duas filhas para a mesma ação planejada (segundo clique em Aprovar Plano não duplica).
- Aprovar Plano **não publica nada**, **não cria criativo final**, **não chama Meta**.
- Recusar Plano: marca como rejeitado, não cria filhas; comentário do usuário pode virar aprendizado sugerido.
- Ajustar Plano: passa pelo fluxo existente de revisão (preserva histórico via `superseded_by_action_id`).

### F.2 — UTM obrigatória (modelo interno fixo)
- Modelo padrão de produção (não exposto na UI):
  ```
  utm_source=meta
  utm_medium=paid_social
  utm_campaign={campaign_slug}
  utm_content={ad_slug}
  utm_term={audience_or_funnel_slug}
  ```
- Aplicação automática no Strategist ao montar a proposta de `create_campaign`:
  - Preserva query params existentes.
  - Não sobrescreve `utm_*` já preenchidas — registra warning técnico `utm_conflict:{key}:kept_existing`.
  - Completa apenas o que faltar.
- Gate de UTM (`runUtmGate`): bloqueia a aprovação da proposta detalhada de anúncio quando faltar `utm_source`, `utm_medium` ou `utm_campaign` no link final. Aponta para o nó `creative`/`ad`. **Não bloqueia** a aprovação do Plano Estratégico em si.

### F.3 — Aprendizados da IA (área editável)
- Localização: **Gestor de Tráfego IA → Configurações Gerais → Aprendizados da IA**.
- Tabela `ads_ai_learnings` por tenant, com status `suggested | active | paused | archived`.
- Categorias: produto, público, orçamento, funil, criativo, copy, oferta, performance, restrição, tracking, outro.
- Origem: `approval | rejection | adjustment | manual | system`.
- Regras de ativação:
  - Aprendizado criado a partir de feedback nasce como `suggested` — usuário ativa.
  - Aprendizado criado manualmente nasce como `active`.
  - Apenas aprendizados com status `active` entram no contexto do Strategist e na expansão Plano → propostas.
- Dedup: índice único parcial por `(tenant_id, category, normalized_title)` ignorando `archived`. Aprendizado duplicado **reforça** evidência e confiança em vez de criar novo.
- Feedback → aprendizado sugerido: `ads-autopilot-feedback-record` invoca `ads-ai-learnings-write` quando o feedback tem conteúdo útil (motivo/observação ≥ 12 caracteres ou `should_become_preference=true`). Feedback vazio não cria aprendizado.

### F.4 — Restrições
- Sem campo de UTM na UI de Configurações Gerais nesta entrega.
- Aprendizado sugerido nunca ativa sozinho.
- Aprendizado `suggested`, `paused` ou `archived` não entra no prompt da IA.
- Nenhuma publicação, mutação Meta/Google/TikTok ou criativo final é gerado em qualquer ponto desta Onda.
- Sem cron mensal, sem admin avançado, sem Google/TikTok operacional.

## Onda G — Qualidade Estratégica do Plano Inicial (2026-06-12)

Esta onda corrige falhas de qualidade do Plano Inicial gerado pelo Modo Piloto, sem alterar UI estrutural nem chamar Meta. Toda a lógica nova é determinística e roda antes do prompt da IA, servindo como fonte de verdade numérica.

### G.1 Modelo de Orçamento por Funil
Cálculo automático de **planejado / ocupado / livre** por funil (cold / remarketing / tests / leads):
- planejado = split% × orçamento total diário;
- ocupado = soma do orçamento diário das campanhas ACTIVE classificadas naquele funil (por palavra-chave no nome);
- livre = planejado − ocupado.

Projeção sequencial: uma ação só pode criar/escalar usando o `livre` atual; para usar mais, deve referenciar uma ação anterior de pausar/reduzir no mesmo funil via `references_release_from_action_index`.

Regra de negócio: **campanha nova nunca consome orçamento futuro antes da liberação real**.

### G.2 Identificação de Produto em campanhas existentes
Pré-processamento por 6 fontes (em ordem de confiança):
1. creative_product_id → high
2. URL slug → high
3. Nome da campanha → high/medium
4. Nome do conjunto → medium
5. Nome do anúncio → medium
6. Copy/headline → low

Saídas: `inferred_product_id`, `inferred_product_name`, `inferred_product_source`, `product_identification_confidence`, `diagnosis_limitation`.

Confiança low/unknown bloqueia pausa automática como ação principal.

### G.3 Tipo de Campanha + Catálogo Dinâmico
`campaign_type` aceita: `prospecting`, `retargeting`, `catalog_prospecting`, `catalog_retargeting`, `testing` (mais os rótulos legados).

Para `catalog_*` o plano deve preencher `catalog_setup`: product_catalog, product_set, audience_window, exclude_recent_buyers_days, creative_mode='dynamic'. Sem catálogo detectado → `pending_dependency='catalog_not_connected'`.

### G.4 Exclusão de Clientes explícita
Bloco `audience_exclusions` por ação. Disponibilidade do público de Clientes é pré-resolvida por conta de anúncios; sem público → `pending_dependency='customer_audience_missing'`. O Quality Gate continua bloqueando proposta filha de frio sem exclusão aplicada.

Fail-safe adicional no Plano Estratégico: antes de persistir o plano gerado, o sistema normaliza qualquer ação classificada como Público Frio por `campaign_type`, `funnel` ou `funnel_stage` e força `audience_exclusions.customers=true` quando o público de Clientes existe na conta. Se o público não existir, força `pending_dependency='customer_audience_missing'`. A única exceção aceita continua sendo `campaign_intent='creative_test'` com justificativa explícita (`exclusion_override_reason`) suficiente.

### G.5 campaign_intent + override de teste criativo
Enum `campaign_intent`: acquisition, retention, creative_test, offer_test, scale, reactivation. Em `creative_test`, com `exclusion_override_reason` (≥ 12 chars) o gate libera a inclusão de clientes em público frio e audita em `details.exclusion_overridden_creative_test`. Em qualquer outra intenção, a regra fria continua valendo.

### G.6 Audience Budget Fit (Lite)
Sem chamada à Meta `delivery_estimate` / `reachestimate`. Usa só histórico 30d. Categorias: `under_funded`, `adequate`, `over_funded_small_audience`, `saturation_risk`, `insufficient_data`. Sugere faixa de orçamento quando aplicável. **Não bloqueia o plano**.

### Renderização
A UI do Plano Estratégico ganhou:
- Seção "Orçamento por Funil" (planejado/ocupado/livre + campanhas ativas por bucket).
- Badges por ação: exclusão de clientes, pendência de público/catálogo, catálogo dinâmico, teste criativo, baixa confiança de produto, fit.
- Detalhamento inline de catálogo e justificativa de override.

Nenhuma tela nova foi criada.

---

## Onda G.1 (rev2) — Strategy Preflight Builder + Contrato fail-closed (2026-06-12)

### Strategy Preflight Builder
Camada determinística, sem IA e sem rede, executada antes de chamar o Estrategista. Reúne em um único objeto por conta de anúncios:

- **Orçamento por funil** (`funnel_budget_state`): planejado, ocupado, livre por `cold | remarketing | tests | leads | unknown`.
- **Campanhas ativas relevantes** (`active_campaigns_summary`): tendência ROAS 7d vs 30d, gasto, nível de atenção e flag `must_be_addressed_in_plan` quando o plano não pode ignorar a campanha.
- **Identificação de produto** por campanha (6 fontes determinísticas + confiança `high | medium | low | unknown`).
- **Disponibilidade de público de Clientes** (com `pending_dependency='customer_audience_missing'` quando ausente).
- **Disponibilidade de catálogo Meta** (com `pending_dependency='catalog_not_connected'` quando ausente).
- **Audience Budget Fit Lite** por campanha (sem chamada à Meta).

### Contrato obrigatório do Plano Estratégico
Toda saída do tool `strategic_plan` passa por `validateStrategicPlanContract(plan, preflight)`. Se o contrato falhar:

- o plano é salvo, mas com `action_data.contract.ok = false` e a lista de pendências;
- o modal mostra "Plano incompleto — precisa ser regenerado ou ajustado" com a lista, e desabilita "Aprovar plano";
- o executor de aprovação devolve erro amigável em PT-BR e **não** dispara geração de propostas filhas.

Além disso, imediatamente antes do `INSERT` na fila operacional, o payload final do plano é revalidado e reformatado em shape canônico. Essa segunda barreira existe para impedir regressão em que o guard roda corretamente em memória, mas algum retorno intermediário ou versão antiga do handler ainda tenta salvar um plano achatado sem metadata, sem preflight e sem exclusão por adset.

### Valores canônicos
- `campaign_type`: `prospecting | retargeting | catalog_prospecting | catalog_retargeting | testing` (formato textual antigo como TOF/Remarketing/Teste deixa o plano inválido).
- `campaign_intent`: `acquisition | retention | creative_test | offer_test | scale | reactivation`.
- `budget_source`: `free_now | released_by_previous_action | test_allocation | retained_existing_budget | reallocated_budget | insufficient_budget_pending_action`.

### Regras de invalidação (fail-closed)
- Plano sem `funnel_budget_state` ou `active_campaigns_summary` → inválido.
- Ação sem `campaign_type`/`campaign_intent` canônicos → inválida.
- Prospecção/aquisição sem exclusão de clientes (com público de Clientes detectado) → inválida.
- Campanha de catálogo sem `creative_mode='dynamic'` + `product_catalog_id` + `product_set` → inválida.
- Ação de orçamento sem `audience_budget_fit` → inválida.
- Criar/escalar acima do orçamento livre sem `budget_source='released_by_previous_action'` → inválida.
- Pause em campanha com produto identificado em confiança `low`/`unknown` → inválida.
- Campanha ativa marcada `must_be_addressed_in_plan=true` sem ação correspondente nem justificativa explícita → inválida.

### O que NÃO faz
- Não chama Meta `delivery_estimate` / `reachestimate`.
- Não publica campanha. Não cria cron novo. Não tenta corrigir plano antigo automaticamente.
- Não aceita payload textual legado como plano válido.

## Onda H — Frescor do espelho Meta antes da análise (2026-06-13)

### Problema observado
A IA propunha pausar campanhas que já estavam pausadas e ajustar verba de campanhas paradas. Causa raiz: o Strategist lê o espelho local (`meta_ad_campaigns`) atualizado por cron de 6h em 6h. Mudanças manuais na Meta entre crons (ex.: usuário pausou campanha 5 min antes de rodar a análise) ficavam invisíveis.

### Correção aplicada
1. **Sync condicional pré-análise:** antes do Strategist, o fluxo de análise inicial verifica o `synced_at` mais recente das campanhas da conta. Se for mais antigo que 10 min (ou inexistente), dispara um sync leve só de campanhas dessa conta. Custo: ~1 chamada Graph por conta, no máximo a cada 10 min. Falha silenciosa: se a Meta não responder, a análise segue com o último estado conhecido e registra uma limitação amigável.
2. **Regra dura no prompt:** o Strategist agora trata a coluna `status` da lista de CAMPANHAS como fonte de verdade do estado atual. É proibido propor `pause_campaign` para campanhas já `PAUSED` ou `adjust_budget` para campanhas paradas. Reativação só com justificativa explícita.

### Resultado
- Mudanças manuais no Meta feitas até 10 min antes da análise são refletidas.
- Propostas redundantes (pausar pausada / ajustar verba de campanha parada) deixam de ser geradas.
- Sem custo de IA adicional. Custo Meta API adicional: até 1 chamada por conta por análise, com throttle de 10 min.

## Bloqueio do cron semanal quando há plano estratégico pendente
**Implementado em 2026-06-13.**

### Regra
Enquanto houver um Plano Estratégico aguardando aprovação do usuário, o cron semanal/mensal do estrategista NÃO gera novas propostas (campanhas, criativos, ajustes de verba, públicos). O cron registra `skipped: true` com motivo `pending_strategic_plan_blocks_cron` e encerra sem produzir ações.

### Motivo
Evitar duas estratégias paralelas competindo pela fila "Aguardando Ação" e confundindo o lojista. O plano pendente é a fonte de verdade enquanto não for aprovado ou descartado.

### Aviso ao usuário
Na Central de Execuções (card de Ads), aparece o contador "Plano estratégico aguardando aprovação" com link direto para a aba de aprovação. Atualiza a cada 60s.

### Saneamento histórico
Em 2026-06-13 foram canceladas todas as propostas pendentes do tenant Respeite o Homem (2 campanhas geradas pelo cron + 1 plano estratégico anterior) para zerar a fila antes da nova regra entrar em vigor.

## Onda J — Inferência determinística de `budget_source` + tarja de exclusão por público (2026-06-13)

### Problema observado
Mesmo com a persistência canônica funcionando (Onda I), planos novos nasciam marcados como "Plano incompleto" porque a LLM omitia o campo `budget_source` em todas as ações de criar/escalar. O validador exigia o campo como blocker e o botão "Aprovar plano" ficava permanentemente desabilitado. Em paralelo, a UI mostrava a tarja genérica "Exclui clientes/compradores" no card externo da fila (fora de contexto) e no modal sem identificar o nome do público.

### Correção aplicada
1. **Inferência determinística no normalizador** (`inferBudgetSourcesForPlan`): quando `budget_source` vem vazio/inválido, o normalizador percorre as ações na ordem do plano usando o mesmo modelo do validador (verba livre por funil a partir do preflight, débito por criar/escalar, crédito por pausar/reduzir ativa). Regra: se há verba livre suficiente → `free_now`; se há pause/reduce anterior para o mesmo funil → `released_by_previous_action`; senão → `insufficient_budget_pending_action`. Marca `budget_source_inferred=true` para rastreio. O validador continua bloqueando quando a verba real não comporta.
2. **Inferência determinística de compatibilidade de orçamento**: quando a IA omite `audience_budget_fit` em ação que mexe em orçamento, o normalizador reaproveita o sinal já calculado no preflight para a campanha correspondente; se não houver correspondência determinística, grava `insufficient_data`. Marca `audience_budget_fit_inferred=true` para rastreio. O objetivo é impedir falso "Plano incompleto" por omissão da IA, mantendo o bloqueio apenas quando faltar dado estrutural real.
3. **UI — nome do público na tarja de exclusão**: badge no topo da ação e resumo de cada conjunto agora exibem `Exclui: <nome>` (ex.: `Exclui: Compradores 180d`). Fallback ao texto genérico só quando o nome não estiver no contrato.
4. **UI — remoção da tarja redundante no card externo**: o card da fila "Aguardando Ação" não exibe mais a tarja "Exclui clientes/compradores" para tipo `strategic_plan`. A informação correta — por conjunto, com nome — fica dentro do modal.

### Saneamento adicional
13/06/2026 (após o fix de inferência) foram descartadas as 2 propostas pendentes do Respeite o Homem geradas durante o ciclo de teste, para que o usuário rode "Nova análise" e valide o plano nascendo aprovável.

---

## 13 — Onda H.1 + H.2 — Aprovar plano não executa (2026-06-14)

### Regra de negócio definitiva
- Aprovar o Plano Estratégico **revalida** o plano e **gera propostas filhas detalhadas** pendentes de revisão individual. Nada mais.
- Aprovar o plano **não** gera criativo, **não** cria público, **não** cria lookalike, **não** cria catálogo, **não** chama Meta para mutação, **não** publica nada, **não** marca o plano como "executed".
- O status "executed" do plano fica reservado para a etapa de implementação final (Onda H.4), que ainda não está liberada.

### Fluxo Plano → Propostas filhas

1. Usuário clica em **Aprovar plano**.
2. Servidor recarrega o plano, revalida metadata canônica, contrato fail-closed e exclusão de clientes por adset.
3. Se inválido/legado, retorna erro PT-BR e bloqueia a aprovação.
4. Se válido:
   - status legado vira `approved` (nunca `executed`);
   - `action_data.lifecycle.status='plan_approved'` é gravado;
   - 1 proposta filha é criada por ação planejada do plano, do tipo `campaign_proposal`, em `pending_approval`, com `action_data.lifecycle.status='campaign_proposal_pending_review'` e snapshot detalhado completo (campanha, conjuntos, criativos planejados, validações).
5. Dedup por `(parent_action_id, planned_action_index)` impede que segundo clique gere propostas duplicadas.

### Campos canônicos da proposta filha

| Bloco | Conteúdo |
|---|---|
| `lifecycle` | `status`, `version`, `created_at` |
| `kind` | `campaign_creation_proposal` / `campaign_adjustment_proposal` / `campaign_pause_proposal` / `campaign_budget_adjustment_proposal` / `campaign_reactivation_proposal` |
| `campaign` | nome, objetivo, orçamento, tipo, intenção, produto, funil, racional, UTM base, fit, fonte de orçamento, campanha existente alvo |
| `adsets[]` | público, segmentação, exclusões (com público de clientes), orçamento, posicionamentos, evento de otimização, dependências de público/catálogo |
| `planned_creatives[]` | quantidade, formato, ângulo, copy, headline, CTA, link final com UTM, prompt visual, referência — todos com `generation_status='planned_only'` |
| `validations` | UTM presente, exclusão fria presente, blockers, warnings, pending_dependencies |
| `inherited_contract` | versão do schema, do contrato e flags `is_approvable` / `validation_status` do plano-pai |

### Estados canônicos suportados no lifecycle

**Plano:** `plan_pending_review`, `plan_approved`, `plan_rejected`, `plan_needs_adjustment`, `plan_superseded`, `plan_incomplete`.

**Proposta filha de campanha:** `campaign_proposal_pending_review`, `campaign_proposal_approved`, `campaign_proposal_rejected`, `campaign_proposal_needs_adjustment`, `campaign_assets_pending`, `campaign_creatives_generation_pending`, `campaign_creatives_pending_review`, `campaign_final_review_pending`, `campaign_ready_for_implementation`, `campaign_implemented`, `campaign_implementation_failed`.

Os estados de criativo e revisão final entram nas Ondas H.4 e H.5.

### Guards server-side

- O trigger `implement_approved_plan` do estrategista foi descontinuado: bloqueia em servidor, devolve `blocked:true` e razão `implement_approved_plan_deprecated_by_onda_h1`. Mesmo se algum caminho legado chamar, nada executa.
- A função de execução rejeita explicitamente aprovação individual de `campaign_proposal` (será habilitada na Onda H.3).

### UI

- Card de proposta filha mostra rótulo **Proposta de Campanha**.
- Botão **Aprovar** desabilitado com tooltip claro até H.3.
- Botão **Rejeitar** disponível normalmente.


---

## 14 — Onda H.4.1 — Fluxo de Prontidão e Geração de Criativos (2026-06-16)

### Regra de negócio
- Propostas filhas em `campaign_proposal_approved` / `structure_approved_awaiting_creatives` exibem um **card de prontidão** abaixo do card da proposta na aba **Propostas aprovadas**.
- O card resume, em PT-BR de negócio, o que ainda falta para gerar criativos. **Bloqueadores reais (apenas técnicos):** conexão Meta ativa (página, pixel, conta de anúncios), imagem principal do produto, logo da marca, paleta de cores da marca, URL de destino + UTM válidos, orçamento definido, tabela de preços de IA ativa. **Tudo o mais é aviso, nunca bloqueio:** tipo/função do produto, descrição, diferenciais, tom de voz, promessa, claims, restrições. O refino editorial passa pelo prompt estratégico + feedback nas propostas — não há mais campos manuais de marca para criativos.
- **Conexão Meta, Conta de anúncios, Página, Instagram, Pixel e API de Conversões** são lidos diretamente da integração Meta ativa. Não há formulário manual.
- **Evento de conversão** e **Janela de atribuição** são derivados automaticamente do objetivo da campanha (venda → Compra com janela 7 dias clique + 1 dia visualização; lead → Lead com 7 dias clique; tráfego/engajamento/reconhecimento → Visualização de conteúdo com 1 dia clique). Não há campo manual.
- **UTM** cai em padrão da plataforma quando a proposta/conta não definir. Não bloqueia.
- Quando há **bloqueadores**, o card é amarelo, lista cada pendência com **link para a tela de origem do dado**, e o botão de gerar criativos fica **oculto**.
- Quando tudo está pronto, o card é azul e o botão **"Gerar criativos"** fica visível, com o **custo estimado em créditos** exibido ao lado.
- O clique no botão **abre obrigatoriamente um diálogo de confirmação** com as frases: "Isso iniciará processamento de IA" e "Nada será enviado ao Meta agora". Fechar/cancelar o diálogo **não consome créditos**.
- Só após o clique humano em "Confirmar" os criativos são enfileirados. O servidor **re-valida a prontidão** antes de enfileirar (fail-closed) — o navegador não pode burlar.

### Anti-processamento e idempotência
- Abrir a aba, navegar entre propostas, abrir/fechar o diálogo e atualizar a tela **não disparam nenhuma chamada de IA**.
- O enfileiramento é **idempotente por `proposal_action_id`**: duplo clique não dobra custo nem cria criativos duplicados.
- Após confirmação, a proposta avança para `campaign_creatives_generating` e o card passa a refletir o progresso.

### Custo
- O custo é calculado a partir de `service_pricing` usando a chave correta do formato planejado (ex.: `single_image` → `image_single`). Se o preço não estiver mapeado, o card cai em modo pendência ("Configuração de preço ausente") e bloqueia a geração até resolução.

### Anti-regressão
- Nenhum botão na fila pode disparar geração sem passar pelo diálogo de confirmação humana.
- O motor de prontidão é a fonte única de verdade para liberar o botão; cliente e servidor consultam o mesmo motor.
- Pendências devem ser sempre apresentadas em linguagem de negócio. Nomes técnicos de campo, tabela, hook ou função ficam proibidos no corpo do card.

## 15 — Onda H.4.1 Fase 2 — Categoria por IA + Diretrizes Comerciais Globais (2026-06-16)

### Mudança no cadastro de produto
- O antigo campo fechado de "categoria regulatória" foi **removido da interface**. O lojista preenche apenas dois campos livres no cadastro: **Tipo de produto** (ex: "Shampoo", "Suplemento", "Tênis") e **Função principal** (ex: "para queda capilar", "para ganho de massa").
- A IA infere a categoria automaticamente a partir desses dois campos. Categorias antigas no banco ficam preservadas só para compatibilidade — não são usadas em decisão nova.

### Base global de Diretrizes Comerciais
- Existe uma base **global da plataforma** (não por tenant) com as regras comerciais de Meta, Google e TikTok por categoria inferida (cosmético, suplemento, moda, eletrônico, pet, alimento, infantil, etc.).
- Cada diretriz tem: o que é permitido, o que é proibido, disclaimers obrigatórios, notas de sensibilidade e a URL oficial da política.
- A base é **fonte única de verdade** para qualquer geração de copy/criativo. Restrições manuais do produto/marca viraram apenas **avisos**, nunca bloqueadores.

### Atualização mensal automática
- Um agendamento mensal (dia 1, 03:00 UTC) varre as URLs oficiais com Firecrawl, compara com a versão atual usando IA e detecta mudanças.
- Quando detecta mudança: marca a diretriz como **"revisão pendente"** e registra a proposta de novo texto. **A geração de campanhas continua funcionando com a versão anterior** — nada é aplicado sem aprovação humana.
- Quando não detecta mudança: renova a data de verificação automaticamente.
- O cron **nunca** altera capacidade comercial sozinho. Sempre passa por revisão.

### Painel super-admin
- Tela dedicada em **Plataforma → Diretrizes Comerciais** lista todas as diretrizes por plataforma e categoria, mostra status (Ativa / Revisão pendente), versão e data da última verificação.
- Botões: **Carregar baseline** (popula seed inicial) e **Verificar agora** (dispara refresh manual).
- Cada diretriz tem botão **Editar** que abre diálogo para ajustar texto e aprovar — ao salvar, a versão incrementa e o status volta para Ativa.

### Anti-regressão
- Categoria regulatória **não pode** voltar como campo fechado obrigatório. Se voltar, a IA perde a base livre que alimenta as diretrizes globais.
- Cron mensal **não pode** bloquear geração. Sempre serve a versão anterior até admin aprovar.
- Lojista **não vê** o painel de diretrizes — é restrito à plataforma.

