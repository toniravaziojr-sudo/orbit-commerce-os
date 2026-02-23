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

## 1. Integrações Marketing (DEPRECADO)

> **⚠️ MÓDULO REMOVIDO — 2026-02-16**
>
> O módulo "Integrações Marketing" (`/marketing`) foi **completamente removido** da navegação e rota.
> Todas as funcionalidades foram migradas para os Hubs centralizados em `/integrations`:
>
> | Funcionalidade | Novo Local |
> |----------------|------------|
> | Meta Pixel & CAPI | Hub Meta (`/integrations?tab=social`) |
> | Meta Catálogo | Hub Meta (`/integrations?tab=social`) |
> | TikTok Pixel/CAPI | Hub TikTok (`/integrations?tab=tiktok`) |
> | Google Ads | Hub Google (`/integrations?tab=google`) — futuro |
>
> **A rota `/marketing` redireciona automaticamente para `/integrations?tab=social`.**
>
> A tabela `marketing_integrations` continua existindo para o storefront tracker (`MarketingTrackerProvider`),
> mas é atualizada automaticamente pelo Hub Meta ao salvar Pixel ID/CAPI.
>
> ### Automação Completa de Pixel & CAPI (v5.4.0)
>
> #### Pixel (Client-side)
> O fluxo OAuth (`meta-oauth-callback`) descobre automaticamente os Pixels associados a cada conta de anúncios via `GET /{ad_account_id}/adspixels`. Os Pixels são exibidos como ativos selecionáveis no checklist de assets. Ao salvar, o `meta-save-selected-assets` sincroniza o Pixel primário selecionado para `marketing_integrations.meta_pixel_id` e ativa `meta_enabled=true`, eliminando a necessidade de configuração manual.
>
> O campo na UI é **somente leitura** com badge "Automático". Para alterar o pixel principal, o usuário edita os ativos conectados.
>
> **Pixels adicionais:** Campo `meta_additional_pixel_ids` (TEXT[]) permite adicionar múltiplos Pixel IDs extras para disparar eventos em vários pixels simultaneamente.
>
> #### CAPI (Server-side)
> O `meta-save-selected-assets` também sincroniza automaticamente o `access_token` long-lived (~60 dias) do OAuth para `marketing_integrations.meta_access_token` e ativa `meta_capi_enabled=true`. Isso elimina a necessidade de configuração manual do token CAPI.
>
> A UI mostra badge "Automático" quando o token foi sincronizado via OAuth. Um fallback manual ("Usar token manual — avançado") permite inserir um System User Token permanente que não expira.
>
> #### Cobertura do Tracking
>
> O `MarketingTrackerProvider` envolve **todo o storefront** via `TenantStorefrontLayout` e `StorefrontLayout`:
>
> | Página | Coberta | Observação |
> |--------|---------|------------|
> | Home, Categorias, Produtos | ✅ | Dentro do layout storefront |
> | Carrinho, Checkout, Thank You | ✅ | Dentro do layout storefront |
> | Blog, Rastreio | ✅ | Dentro do layout storefront |
> | Landing Pages (Builder) `/lp/` | ✅ | Dentro do layout storefront |
> | Quizzes `/quiz/` | ✅ | Dentro do layout storefront |
> | Páginas Institucionais | ✅ | Dentro do layout storefront |
> | AI Landing Pages `/ai-lp/` | ✅ | Pixel injetado automaticamente no HTML do iframe via `buildPixelScripts()` em `StorefrontAILandingPage.tsx` |
>
> #### Renovação do Token OAuth
>
> ✅ **IMPLEMENTADO (v5.5.0):** A edge function `meta-token-refresh` renova automaticamente os tokens long-lived da Meta antes da expiração. Funciona via `fb_exchange_token` (a Meta não usa refresh tokens tradicionais).
>
> - **Cron diário:** `meta-token-refresh-daily` executa às 03:00 UTC com `{ refreshAll: true }`, renovando todos os tokens que expiram em <7 dias.
> - **Modo single:** `POST { tenantId }` renova token de um tenant específico.
> - **Sync CAPI:** Ao renovar, o novo token é automaticamente sincronizado com `marketing_integrations.meta_access_token`.
> - **Fallback:** Se o token já expirou/foi revogado, a conexão é marcada como inativa e o usuário precisa reconectar.

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

##### Edge Function: `ads-chat`

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

### Ajuste Escopado de Campanhas (v1.20.0 — 2026-02-20)

O botão **"Ajustar"** em cada card de campanha pendente aciona uma revisão restrita diretamente no Motor Estrategista, sem passar pelo chat.

#### Fluxo

1. Usuário clica "Ajustar" em uma campanha específica e digita o feedback (ex: "Transformar em campanha de catálogo com todos os kits")
2. O frontend invoca `ads-autopilot-strategist` com `trigger: "revision"` e `revision_context` contendo:
   - `campaign_name`: nome da campanha sendo ajustada
   - `feedback`: texto do usuário
   - `other_pending_campaigns`: lista de nomes das demais campanhas pendentes (protegidas)
3. O motor entra em **modo de revisão restrita**:
   - A IA recebe instrução explícita para criar APENAS UMA nova campanha substituindo a rejeitada
   - As demais campanhas pendentes são listadas como **protegidas** — a IA é PROIBIDA de recriá-las ou modificá-las
   - A ação original é marcada como `rejected` com o feedback como `rejection_reason`
4. O resultado aparece como nova ação `pending_approval` para o usuário avaliar

#### Regras

| Regra | Descrição |
|-------|-----------|
| **Escopo único** | Apenas a campanha solicitada é reprocessada |
| **Proteção de pendentes** | Outras campanhas pendentes são passadas como `protectedList` e não podem ser tocadas |
| **Catálogo** | Se o feedback mencionar "catálogo", a IA usa objetivo `OUTCOME_PRODUCT_CATALOG_SALES` |
| **Rejeição automática** | A ação original + child actions (adsets) são rejeitadas automaticamente antes de gerar a revisão |

#### Correção de Criativos por Funil (v1.20.0)

**Problema identificado:** A IA usava os mesmos criativos para campanhas de público frio (TOF) e remarketing (BOF), pois o matching era apenas por `product_id` sem considerar `funnel_stage`.

**Correção:**
1. **Fase de geração:** O `generate_creative` agora inclui `funnel_stage` no prompt e nos metadados do criativo
2. **Fase de montagem:** O matching de criativos para campanhas usa `product_id + funnel_stage` como filtro duplo
3. **Fallback:** Se não houver criativo específico para o funil, a IA gera um novo com ângulo adequado (urgência para remarketing, educação para público frio)

#### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ads/AdsPendingActionsTab.tsx` | Invoca `ads-autopilot-strategist` diretamente com `trigger: "revision"` |
| `src/components/ads/AdsPendingApprovalTab.tsx` | Passa `other_pending_campaigns` para proteção |
| `supabase/functions/ads-autopilot-strategist/index.ts` | Lógica de `protectedList` e instrução de escopo único |

---

### Agrupamento de AdSets por Sessão (v5.15.1 — 2026-02-20)

**Problema identificado:** A IA do Estrategista gerava nomes de campanha nos adsets que não batiam exatamente com os nomes das campanhas criadas na mesma sessão (ex: `[AI] Vendas | Testes (CBO) | Fast Upgrade | 2026-02-19` vs `[AI] TESTES | Vendas (CBO) | Fast Upgrade | 2026-02-20`). Isso fazia com que os adsets aparecessem como cards órfãos separados em vez de aninhados dentro do card da campanha pai.

**Correção:** A lógica de agrupamento em `AdsPendingActionsTab` e `AdsPendingApprovalTab` agora usa **dois passes de matching**:

| Passo | Lógica | Descrição |
|-------|--------|-----------|
| **1 — Exact Name** | `adset.campaign_name === campaign.campaign_name` | Match exato por nome (comportamento original) |
| **2 — Session Fallback** | `adset.session_id === campaign.session_id` + similaridade de nome | Para adsets não pareados, busca campanhas da mesma sessão e usa score de similaridade para encontrar o melhor match |

**Regras:**
- Adsets pareados no Passo 1 **nunca** são reavaliados no Passo 2
- Adsets que permanecem sem match após ambos os passes são exibidos como `OrphanAdsetGroupCard` (agrupados pelo nome da campanha referenciada)
- O score de similaridade usa normalização alfanumérica (lowercase, remove caracteres especiais) com matching de substrings de 3 caracteres

#### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ads/AdsPendingActionsTab.tsx` | Lógica de dois passes (exact + session fallback) |
| `src/components/ads/AdsPendingApprovalTab.tsx` | Mesma lógica de dois passes |

---

### Tag de Tipo de Campanha nos Cards de Aprovação (v5.15.2 — 2026-02-20)

**Funcionalidade:** Os cards de aprovação (`ActionApprovalCard`) agora exibem uma badge colorida com o **tipo de campanha** (ex: Venda Direta, Remarketing, Teste, Catálogo, Tráfego) na área de chips, junto com orçamento, criativos e conjuntos.

**Inferência do tipo** — função `inferCampaignType(data)` usa 3 fontes em ordem de prioridade:

| Prioridade | Fonte | Exemplo |
|------------|-------|---------|
| 1 | Campo explícito `campaign_type` ou `objective` em `action_data` / `preview` | `sales`, `catalog_sales`, `traffic` |
| 2 | Padrão no nome da campanha (`campaign_name`) | `[AI] TESTES | ...` → Teste |
| 3 | Fallback por `funnel_stage` | `tof` → Venda Direta, `bof` → Remarketing |

**Tipos suportados:**

| Chave(s) | Label | Cor |
|----------|-------|-----|
| `sales`, `conversions` | Venda Direta | Emerald |
| `remarketing`, `retargeting` | Remarketing | Orange |
| `test`, `testing` | Teste | Purple |
| `traffic`, `link_clicks` | Tráfego | Sky |
| `catalog`, `catalog_sales`, `product_catalog_sales` | Catálogo | Amber |
| `awareness`, `brand_awareness` | Reconhecimento | Indigo |
| `reach` | Alcance | Teal |
| `engagement` | Engajamento | Pink |
| `leads`, `lead_generation` | Geração de Leads | Green |
| `video_views` | Visualização de Vídeo | Rose |

#### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ads/ActionApprovalCard.tsx` | Novo mapa `CAMPAIGN_TYPE_LABELS`, função `inferCampaignType`, badge na área de chips |

---

### Visão Completa da Campanha — Modal com Abas (v5.15.4 — 2026-02-20)

**Funcionalidade:** O modal "Ver conteúdo completo" (`FullContentDialog`) utiliza uma interface com **3 abas** para apresentar uma visão **100% completa** da campanha proposta pela IA, com todos os campos traduzidos para PT-BR.

| Aba | Conteúdo |
|-----|----------|
| **Criativos & Copys** | Galeria de criativos, headlines (variações numeradas), textos principais (versões), descrições, CTA |
| **Detalhes da Campanha** | Visão exaustiva organizada em seções temáticas (ver tabela abaixo) |
| **Conjuntos & Público** | Ad sets com nome, orçamento individual, público-alvo, faixa etária, públicos personalizados |

#### Componente `CampaignDetailsTab` (v2.1)

Renderiza todos os detalhes da campanha organizados em **11 seções temáticas** com ícones:

| Seção | Ícone | Campos incluídos |
|-------|-------|------------------|
| **Campanha** | Target | Nome da Campanha, Objetivo (traduzido), Tipo de Campanha (inferido), Etapa do Funil |
| **Produto** | Package | Produto, ID do Catálogo, ID do Conjunto de Produtos |
| **Orçamento** | DollarSign | Orçamento Diário, Orçamento Vitalício, Tipo de Orçamento (CBO/ABO) |
| **Otimização** | BarChart3 | Otimização (traduzida), Meta de Desempenho (`performance_goal`), Local da Conversão (`conversion_location`), Modelo de Atribuição (`attribution_model`), Cobrança por, Meta de Custo por Resultado |
| **Posicionamentos** | Globe | Posicionamentos (traduzidos individualmente), Plataformas, Dispositivos, Tipo de Posicionamento. **Fallback:** se nenhum campo de posicionamento estiver presente, exibe "Automático (Advantage+)" |
| **Link & CTA** | Link2 | Link de Destino (`destination_url`, `website_url`, `link`, `object_url`), Link Exibido, Botão CTA (traduzido), Parâmetros UTM |
| **Agendamento** | Calendar | Data de Início, Data de Término |
| **Público** | Users | Público-alvo, Faixa Etária, Gênero, Públicos Personalizados, Lookalikes, Interesses, Localização |
| **Conjuntos** | Layers | Nome de cada Conjunto de Anúncios (de `childActions`), Orçamento individual por conjunto |
| **Criativos** | ImageIcon | Nome do Anúncio (`ad_name`, `creative_name`), Formato do Anúncio (`ad_format`, `creative_format`, `format`) |
| **Outros** | Settings2 | Pixel, Evento de Conversão + **qualquer campo não mapeado** (catch-all automático) |

#### Fallback de Dados via `childActions`

O helper `f(key)` busca campos na seguinte ordem de prioridade:
1. `preview` (dados de preview da ação principal)
2. `data` (action_data da ação principal)
3. `childActions` (primeiro ad set filho que contenha o campo)

Isso garante que campos como `destination_url`, `placements`, `ad_name` etc. que só existem no nível de ad set sejam exibidos corretamente na visão da campanha.

#### Tradução Exaustiva de Termos Técnicos

O componente implementa dicionários de tradução para **todos** os valores técnicos da Meta Ads API:

| Dicionário | Exemplos de tradução |
|------------|---------------------|
| `OBJECTIVE_LABELS` | `OUTCOME_SALES` → "Vendas", `OUTCOME_LEADS` → "Geração de Leads", `OUTCOME_TRAFFIC` → "Tráfego", `OUTCOME_AWARENESS` → "Reconhecimento", `OUTCOME_ENGAGEMENT` → "Engajamento", `OUTCOME_APP_PROMOTION` → "Promoção de App" |
| `OPTIMIZATION_LABELS` | `OFFSITE_CONVERSIONS` → "Conversões no site", `LINK_CLICKS` → "Cliques no link", `IMPRESSIONS` → "Impressões", `REACH` → "Alcance", `LANDING_PAGE_VIEWS` → "Visualizações da página", `VALUE` → "Valor da conversão" |
| `PERFORMANCE_GOAL_LABELS` | `Maximizar Conversões` → "Maximizar Conversões", `Maximizar Valor das Conversões` → "Maximizar Valor das Conversões" |
| `CONVERSION_LOCATION_LABELS` | `Site` → "Site", `Site e App` → "Site e App", `App` → "App" |
| `ATTRIBUTION_MODEL_LABELS` | `Padrão` → "Padrão", `Incremental` → "Incremental" |
| `BILLING_EVENT_LABELS` | `IMPRESSIONS` → "Impressões (CPM)", `LINK_CLICKS` → "Cliques no link (CPC)", `THRUPLAY` → "ThruPlay (CPV)" |
| `CTA_LABELS` | `SHOP_NOW` → "Comprar agora", `LEARN_MORE` → "Saiba mais", `SIGN_UP` → "Cadastre-se", `SEND_WHATSAPP_MESSAGE` → "Enviar mensagem no WhatsApp", `GET_OFFER` → "Obter oferta" |
| `POSITION_LABELS` | `feed` → "Feed", `story` → "Stories", `reels` → "Reels", `right_hand_column` → "Coluna da direita", `search` → "Resultados de pesquisa", `marketplace` → "Marketplace", `video_feeds` → "Feeds de vídeo", `instream_video` → "Vídeos in-stream", `reels_overlay` → "Sobreposição de Reels" |
| `CONVERSION_EVENT_LABELS` | `PURCHASE` → "Compra", `ADD_TO_CART` → "Adição ao carrinho", `INITIATED_CHECKOUT` → "Início de checkout", `LEAD` → "Lead", `COMPLETE_REGISTRATION` → "Cadastro completo", `VIEW_CONTENT` → "Visualização de conteúdo" |

#### Catch-All Automático

Qualquer campo presente em `action_data` que **não** esteja mapeado nas seções conhecidas (`KNOWN_KEYS`) é automaticamente:
1. Formatado com `formatFieldValue` (arrays → lista, objetos → JSON legível, valores primitivos → tradução genérica)
2. Exibido na seção "Outros" com label gerado via `formatKey` (snake_case → Title Case PT-BR)

Isso garante que **nenhum dado é omitido**, mesmo quando a IA envia campos novos não previstos.

#### Regras

- Planos Estratégicos (`strategic_plan`) **não** usam abas — mantêm o layout original com `StrategicPlanContent`
- Se nenhum campo de detalhe estiver preenchido, a aba "Detalhes" exibe um empty state informativo
- A aba "Conjuntos & Público" só aparece se houver ad sets vinculados ou se a ação for do tipo `create_adset`
- `childActions` (ad sets agrupados sob a campanha) são passados ao `CampaignDetailsTab` para extrair dados de público e targeting

#### Arquivos Afetados

| Arquivo | Mudança |
|---------|---------|
| `src/components/ads/ActionApprovalCard.tsx` | `CampaignDetailsTab` v2.1 com 11 seções, 7 dicionários de tradução, catch-all automático, `childActions` prop com fallback de dados, seções Conjuntos e Criativos |

---

### Correções v5.12.9 (2026-02-19)

| Item | Correção | Aceite |
|------|----------|--------|
| **Meu Drive (ordenação)** | `useFiles.ts` ordena por `created_at DESC` (não mais por `filename ASC`). Criativos mais recentes aparecem no topo. | Últimos criativos gerados no topo; nenhum nome se repete |
| **Insights (escopo + linguagem)** | `AdsInsightsTab.tsx` sanitiza 15+ termos técnicos em inglês para PT-BR simples (ex: "underinvest" → "investindo abaixo do orçamento", "pacing" → "ritmo de gasto"). Texto com `whitespace-pre-wrap` sem truncamento. | Sem jargão; texto completo acessível |
| **Audience Discovery (Meta)** | `ads-autopilot-analyze` v5.13.0 busca **dois endpoints**: `/customaudiences` (Custom Audiences com campos `id,name,subtype,approximate_count_lower_bound,approximate_count_upper_bound,delivery_status`) e `/saved_audiences` (Saved Audiences com campos `id,name,targeting`). Paginação completa (até 1000) via cursor `after`. Campo `approximate_count` **NÃO existe** na API v21.0 — usar `approximate_count_lower_bound`/`upper_bound`. Erros HTTP logados com status + body. | Públicos Custom e Saved encontrados; erro real exibido se falhar |
| **Limite de campanhas** | Análise ampliada de 50 para **200 campanhas** com paginação (Meta, Google, TikTok). | Diagnóstico reporta ≥200 quando existir |
| **Budget Filling** | Prompt obriga IA a calcular gap = limit - active - reserved. Se gap > R$50, deve propor ações para preencher ou explicar por quê não. Budget tratado como **meta de investimento** (não apenas teto). | IA tenta cobrir o orçamento ou explica claramente |
| **Estratégia (remarketing/testes)** | Regras de prompt: remarketing prioriza catálogo se disponível; sem "single-ad pobre"; testes com ≥2 variações. | Propostas com variações coerentes |
| **Context Digest** | Cada execução registra resumo auditável: configs lidas, campanhas/audiências/produtos carregados, itens ignorados. Disponível em "Detalhes técnicos". | Auditável; pontos cegos identificáveis |
| **UI overflow (chat/pending)** | `AdsPendingActionsTab.tsx` e `ActionApprovalCard.tsx` com `min-w-0`, `overflow-hidden`, `break-all`. | Nenhum conteúdo cortado à direita |

## Google Ads — Integração CRUD Completa (v2.0 — 2026-02-23)

### Visão Geral

Integração completa com Google Ads REST API v18 para criação e gestão de campanhas Search, Performance Max (PMax), Shopping e Display. Opera com o mesmo pipeline de IA (Motor Estrategista + Guardião + Chat) que a Meta, com particularidades da plataforma.

### Tabelas de Cache Local

| Tabela | Descrição | Chave UNIQUE |
|--------|-----------|--------------|
| `google_ad_campaigns` | Campanhas (já existia — sync read-only, agora com CRUD) | `(tenant_id, google_campaign_id)` |
| `google_ad_groups` | Grupos de anúncios com bids e targeting | `(tenant_id, google_adgroup_id)` |
| `google_ad_ads` | Anúncios (RSA, RDA, Shopping, PMax) com headlines/descriptions | `(tenant_id, google_ad_id)` |
| `google_ad_keywords` | Keywords para Search com match type e quality score | `(tenant_id, google_keyword_id)` |
| `google_ad_assets` | Assets (imagens, textos, vídeos) para PMax e Display | `(tenant_id, google_asset_id)` |
| `google_ad_insights` | Métricas de performance por campanha/dia (já existia) | `(tenant_id, google_campaign_id, date)` |

### Edge Functions Google Ads

| Function | Versão | Ações | Descrição |
|----------|--------|-------|-----------|
| `google-ads-campaigns` | v2.0 | list, sync, create, update, pause, activate, remove | CRUD completo de campanhas (Search, PMax, Shopping, Display) |
| `google-ads-adgroups` | v1.0 | list, sync, create, update, pause, activate, remove | CRUD de grupos de anúncios |
| `google-ads-ads` | v1.0 | list, sync, create, update, pause, activate | CRUD de anúncios (RSA, RDA) |
| `google-ads-keywords` | v1.0 | list, sync, create, update, pause, activate, remove | CRUD de keywords com match types |
| `google-ads-assets` | v1.0 | list, sync, upload_image, create_text, link, remove | Upload de imagens e textos para PMax/Display |
| `google-ads-insights` | v1.0 | summary, sync | Métricas de performance (já existia) |
| `google-ads-audiences` | v1.0 | list, sync | Audiências (já existia) |

### Padrão de API Google Ads REST v18

Todas as operações de mutação usam o padrão `mutate`:

```typescript
// Criação
POST /v18/customers/{customerId}/{resource}:mutate
Body: { operations: [{ create: { ...fields } }] }

// Atualização
POST /v18/customers/{customerId}/{resource}:mutate
Body: { operations: [{ update: { resourceName, ...fields }, updateMask: "field1,field2" }] }

// Remoção
POST /v18/customers/{customerId}/{resource}:mutate
Body: { operations: [{ remove: "customers/{id}/{resource}/{id}" }] }

// Consulta (GAQL)
POST /v18/customers/{customerId}/googleAds:searchStream
Body: { query: "SELECT ... FROM ... WHERE ..." }
```

### Tipos de Campanha Suportados

| Tipo | `campaign_type` | Requer | Particularidades |
|------|----------------|--------|------------------|
| **Search** | `SEARCH` | Keywords + RSA | Ad groups obrigatórios, bidding CPC/CPA/ROAS |
| **Performance Max** | `PERFORMANCE_MAX` | Assets (imagens, textos, vídeos) | Sem ad groups tradicionais, asset groups, automação total |
| **Shopping** | `SHOPPING` | Merchant Center linkado | Feed de produtos, bidding por produto |
| **Display** | `DISPLAY` | Imagens em vários tamanhos | Responsive Display Ads, targeting por audiência/tópico |

### Tipos de Match (Keywords — Search)

| Match Type | Símbolo | Descrição |
|------------|---------|-----------|
| `BROAD` | (nenhum) | Variações amplas |
| `PHRASE` | `"keyword"` | Contém a frase |
| `EXACT` | `[keyword]` | Correspondência exata |

### Executor Google Ads (`ads-autopilot-execute-approved` v4.0)

Pipeline de execução sequencial para ações Google Ads aprovadas:

| Etapa | Ação | API |
|-------|------|-----|
| 1 | Criar Campanha | `POST /campaigns:mutate` com `advertisingChannelType`, `biddingStrategy`, `campaignBudget` |
| 2 | Criar Ad Group | `POST /adGroups:mutate` com `campaign` resource name, `cpcBidMicros` |
| 3 | Criar Keywords (Search) | `POST /adGroupCriteria:mutate` com `keyword.text`, `keyword.matchType` |
| 4 | Criar Anúncio (RSA/RDA) | `POST /adGroupAds:mutate` com headlines[], descriptions[], finalUrls[] |

**Regras:**
- Todas as entidades criadas como `PAUSED` (mesma regra da Meta)
- `budgetAmountMicros` = valor em micros (R$ × 1.000.000)
- `cpcBidMicros` = CPC em micros
- Resource names seguem formato: `customers/{id}/campaigns/{id}`

### Mapeamento Tabela → Edge Function (Google Ads)

| Tabela | Edge Functions |
|--------|----------------|
| `google_ad_campaigns` | `google-ads-campaigns`, `ads-autopilot-analyze`, `ads-autopilot-strategist`, `ads-autopilot-guardian` |
| `google_ad_groups` | `google-ads-adgroups`, `ads-autopilot-execute-approved` |
| `google_ad_ads` | `google-ads-ads`, `ads-autopilot-execute-approved` |
| `google_ad_keywords` | `google-ads-keywords`, `ads-autopilot-execute-approved` |
| `google_ad_assets` | `google-ads-assets`, `ads-autopilot-execute-approved` |
| `google_ad_insights` | `google-ads-insights`, `ads-autopilot-analyze`, `ads-autopilot-strategist` |

### Hook `useGoogleAds.ts`

| Método | Descrição |
|--------|-----------|
| `campaigns` | Lista de campanhas do cache local |
| `syncCampaigns` | Sincroniza campanhas da API Google |
| `syncInsights` | Sincroniza insights da API Google |
| `audiences` | Lista de audiências |
| `syncAudiences` | Sincroniza audiências |
| `syncAll` | Sincroniza tudo em paralelo |

### Diferenças Google vs Meta no Autopilot

| Aspecto | Meta Ads | Google Ads |
|---------|----------|------------|
| **Estrutura** | Campanha → Ad Set → Ad | Campanha → Ad Group → Ad (+Keywords/Assets) |
| **Orçamento** | Ad Set level (ABO) ou Campaign level (CBO) | Campaign Budget (compartilhado) |
| **Bidding** | `bid_strategy` no campaign | `biddingStrategyType` + `cpcBidMicros` no ad group |
| **Valores monetários** | Centavos (÷ 100) | Micros (÷ 1.000.000) |
| **Limite de ajuste** | ±20% a cada 48h | ±20% a cada 7 dias |
| **Learning Phase** | ~50 conversões em 7 dias | ~30 conversões em 14 dias |
| **Criação de anúncio** | AdCreative separado | Inline no AdGroupAd |
| **API pattern** | Graph API REST | Google Ads REST v18 (mutate pattern) |

---

## Pendências

- [ ] Dashboard de atribuição
- [x] Integração Google Ads (CRUD completo — Search, PMax, Shopping, Display)
- [ ] Motor Estrategista com tool calls Google Ads
- [ ] Ads Chat com comandos Google Ads
- [ ] Guardian sync completo Google (ad groups + ads + keywords)
- [ ] UI Google — exibir ad groups, keywords e anúncios
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
- [x] Gestor de Tráfego IA — Sprint 6a (Experiments + Creation Tools): Edge function `ads-autopilot-experiments-run` v1.0.0 — avalia experimentos ativos (métricas por campanha), promove vencedores, cancela perdedores, estende insuficientes, sugere novos testes. Tools: promote_winner, cancel_experiment, extend_experiment, suggest_new_experiment. Limite de 3 experimentos/conta. Cron job `ads-experiments-run` (terça 11:00 UTC). Hook `useAdsExperiments.ts` com CRUD + `runExperiments` mutation + `getActiveExperiments` helper. Analyze v4.1.0: novas tools `create_campaign` (templates: cold_conversion/remarketing/creative_test/leads, naming [AI], respeita splits de funil) e `create_adset` (targeting cold/warm/hot). Phase 2 gate: criação requer 7+ dias de dados E 10+ conversões. Ações de criação sempre ficam com status `pending_approval`.
- [x] Gestor de Tráfego IA — Sprint 6b (Creative Generate + Human Approval): Edge function `ads-autopilot-creative-generate` v1.0.0 — analisa top 5 produtos por receita (30d), usa GPT-5-mini para planejar briefs criativos (format, angle, headline, copy, CTA), evita duplicatas recentes (7d), insere como draft em `ads_creative_assets`. Cron job `ads-creative-generate` (quarta 11:00 UTC). Human Approval UI em `AdsActionsTab.tsx`: ações `pending_approval` aparecem primeiro com destaque âmbar, banner de contagem, botões Aprovar (→executed) e Rejeitar (→rejected com motivo). Novos status no STATUS_CONFIG: `pending_approval`, `approved`, `expired`. Mutations inline com invalidação de cache.
- [x] Gestor de Tráfego IA — Sprint 7 (Tracking Health + Pacing + ROI): Analyze v4.2.0 com `checkTrackingHealth` (discrepância atribuição vs pedidos reais, queda de conversões >30%, anomalia CPC >3x, colapso CTR <50%), persiste em `ads_tracking_health`. `checkPacing` (underspend/overspend detection por conta, projeção mensal). Tracking degraded/critical bloqueia escala de budget via `validateAction`. Contexto de pacing e health injetado no system prompt por conta. Nova aba "ROI Real" em `AdsRoiReportsTab.tsx`: ROI real = (Receita - COGS - Taxas 4%) / Spend, com breakdown visual (COGS via `order_items.cost_price`), margem de lucro, Progress bar de distribuição de receita.
- [x] Gestor de Tráfego IA — Sprint 8 (Saldo & Monitoramento): Popover de saldo por conta em `AdsCampaignsTab.tsx` com resumo financeiro (total investido + saldo restante por conta prepaid, badge "Cartão" para CC). Indicador visual de saldo baixo (<R$50) com ícone pulsante vermelho. Hook `useAdsBalanceMonitor.ts` reutiliza `useMetaAds` para agregar: totalAccounts, prepaidCount, lowBalanceCount, zeroBalanceCount, activeCampaigns. Card de monitoramento em `Central de Execuções` (/executions) com alertas por conta (nome + saldo restante), badge de contagem, 3 métricas (contas monitoradas, saldo baixo, campanhas ativas). Threshold: R$50,00 (5000 cents). Contas CC excluídas do monitoramento de saldo.
- [x] Gestor de Tráfego IA — Sprint 9 (Rollback + Drive + Criativos v1.1): **Rollback expandido** em `AdsActionsTab.tsx` — agora suporta desfazer `adjust_budget`, `allocate_budget` e `activate_campaign` (além de `pause_campaign`), restaurando orçamento/status anterior via API e atualizando status para `rolled_back`. **Pasta Drive "Gestor de Tráfego IA"** — edge function `ads-autopilot-creative` v1.1.0 cria automaticamente pasta dedicada na tabela `files` para organizar criativos gerados pela IA de tráfego. **Dados enriquecidos** — `action_data` de ações `generate_creative` agora inclui `product_name`, `channel`, `format`, `variations`, `generation_style`, `folder_name`, `campaign_objective`, `target_audience`. **Schema migration** — `roas_scaling_threshold` adicionado a `ads_autopilot_account_configs`, colunas obsoletas `roas_scale_up_threshold`, `roas_scale_down_threshold`, `budget_increase_pct`, `budget_decrease_pct` removidas.
- [x] Gestor de Tráfego IA — Sprint 9 (UI Polish): Visão Geral refatorada com seletor de plataforma (Meta/Google/TikTok) em vez de contas individuais. Campanhas com rodapé de totais agregados (TableFooter com gasto total, ROAS médio, resultados, alcance, etc.). DateRangeFilter padrão aplicado em todas as abas de Ads. Widget `AdsAlertsWidget` na Central de Execuções mostrando insights não lidos, contas sem saldo e saldo baixo. Balance via `funding_source_details.current_balance` para saldo real-time preciso.
- [x] Gestor de Tráfego IA — Sprint 10 (Regras Internas v4.3-v4.6): Analyze v4.3.0: `approve_high_impact` agora exige aprovação manual para ajustes de budget >20% (além de criações). Analyze v4.4.0: (1) Primeira ativação de IA em conta dispara análise imediata com `trigger_type: "first_activation"` e lookback de 7 dias, gerando insights e ações baseado nas configurações da conta. (2) Ajustes de orçamento (adjust_budget) são agendados para o próximo 00:01 (meia-noite + 1min) em vez de executados imediatamente — ação fica com `status: "scheduled"` e `scheduled_for` timestamp; o cron de 6h verifica e executa ações scheduled quando `scheduled_for <= now()`. Analyze v4.5.0: (3) **Primeira Ativação com Acesso Total** — quando `trigger_type === "first_activation"`, a IA recebe acesso irrestrito a TODAS as ferramentas (pause, adjust_budget, create_campaign, create_adset, report_insight) sem restrições de fase (min_data_days, min_conversions). O objetivo é "colocar a casa em ordem": analisar todas campanhas dos últimos 7d, pausar as ruins, programar ajustes de orçamento, criar campanhas se houver oportunidade, e gerar insights completos. Após esta primeira execução, o fluxo normal com restrições de fase progressiva é aplicado. Analyze v4.6.0: (4) **Remoção da dependência do config global** — `ads_autopilot_configs` (channel=global) não é mais gate de ativação. O controle de ativação é 100% por conta via `ads_autopilot_account_configs.is_ai_enabled`. O registro global é usado apenas como mutex de sessão (lock/unlock). Se não existir registro global, o lock é gerado em memória. AI model default: `openai/gpt-5.2` (fallback quando globalConfig ausente).
- [x] Gestor de Tráfego IA — Sprint 11 (v4.7-v4.11 Prioridade de Métricas + Redistribuição + Learning Phase + Auto-Exec): Analyze v4.7.0-v4.8.0: Métricas da plataforma de anúncios (ROAS, CPA, Conversões da Meta/Google/TikTok) são a **fonte primária de verdade**. Pedidos internos do tenant (`orders`) são usados apenas como fallback informativo e para cálculo de ROI Real (COGS + taxas). Discrepâncias entre plataforma e pedidos geram alertas `Info` mas **nunca bloqueiam** ações da IA. Analyze v4.9.0: **Redistribuição Obrigatória de Orçamento** — se a IA pausou campanhas economizando R$ X/dia, a soma de `adjust_budget` + `create_campaign` DEVE cobrir esses R$ X/dia. Orçamento definido pelo usuário não pode ficar ocioso nem um dia. Na primeira ativação, todas as fases são liberadas e limites por ciclo (±10-20%) são removidos para permitir reestruturação agressiva. Analyze v4.10.0: **Proteção de Learning Phase** — mesmo na primeira ativação, cada campanha ativa só pode receber no máximo **+20%** de aumento de budget (`first_activation_max_increase_pct: 20`). Reduções/pausas permanecem livres. Se o orçamento economizado não cabe dentro do limite de +20% nas campanhas existentes, a IA é **obrigada** a criar novas campanhas (`create_campaign`) para absorver o excedente. Analyze v4.11.0: **Respeito total ao modo de aprovação** — quando `human_approval_mode = "auto"`, NENHUMA ação exige aprovação manual, incluindo `create_campaign` e `create_adset`. Criações só exigem aprovação nos modos `"all"` ou `"approve_high_impact"`. Removida a regra anterior que forçava `pending_approval` em criações independentemente do modo.
- [x] Gestor de Tráfego IA — Sprint 12 (v5.1.0-v5.1.2 Deployment Fixes): **Bid Strategy padrão** — `meta-ads-campaigns` v1.5.0 agora define `bid_strategy: "LOWEST_COST_WITHOUT_CAP"` como padrão para campanhas criadas pela IA, evitando erro "Invalid parameter" ao criar Ad Sets sem `bid_amount`. **Balance simplificado** — `meta-ads-adsets` v1.4.0 remove dependência de `funding_source_details.current_balance` (campo depreciado pela Meta) e usa apenas `Math.abs(balance)` do nível superior da API para contas prepaid. **Geração de Prompt Estratégico com IA** — nova edge function `ads-autopilot-generate-prompt` v1.0.0 agrega dados do tenant (nome da loja, descrição, top 10 produtos com margens, categorias) e gera prompt estratégico personalizado via GPT-5-mini no formato de Gestor de Tráfego Sênior (Missão, Contexto, Compliance, Fontes de Verdade, Funil, Criativos). Botão "✨ Gerar com IA" adicionado ao painel de Prompt Estratégico em `AdsAccountConfig.tsx`. **CBO vs ABO na criação de Ad Sets** — `ads-autopilot-analyze` v5.1.1 corrige conflito de orçamento: quando a campanha pai usa CBO (tem `daily_budget_cents` definido na campanha), o Ad Set é criado **sem** o campo `daily_budget_cents`, evitando erro "Invalid parameter" da Meta que proíbe orçamento simultâneo em campanha e conjunto. Regra: todas as campanhas criadas pela IA usam CBO por padrão, portanto Ad Sets nunca recebem budget próprio. **Sync escopado por conta na primeira ativação** — v5.1.2 corrige timeout: o sync de dados da Meta durante `first_activation` agora é limitado à conta-alvo (`target_account_id`) passando `ad_account_id` para `meta-ads-campaigns`, `meta-ads-insights` e `meta-ads-adsets`, em vez de sincronizar todas as contas do tenant. Regra fundamental: a IA é exclusiva por conta de anúncios — cada conta tem suas próprias configurações via `ads_autopilot_account_configs`, e a ativação/sync/análise opera sempre no escopo de uma única conta.
- [x] Gestor de Tráfego IA — Sprint 13 (v6.0 Dual-Motor + Chat IA): **Arquitetura Dual-Motor** — separação em Motor Guardião (diário: 12h/13h/16h/00h01 BRT, proteção de orçamento) e Motor Estrategista (Start/Semanal/Mensal, pipeline em 5 fases). **Chat de Tráfego IA** — tabelas `ads_chat_conversations` + `ads_chat_messages` com RLS, edge function `ads-chat` v1.0.0 com streaming SSE via `google/gemini-3-flash-preview`, context collector profundo (configs, campanhas, insights, produtos, vendas). Hook `useAdsChat.ts` + componente `AdsChatTab.tsx` com Markdown, sidebar de conversas, realtime. Disponível em 2 níveis: global (tab mãe) e por conta (sub-tab). Limites de budget documentados: Meta ±20%/48h, Google ±20%/7d, TikTok ±15%/48h. Coluna `last_budget_adjusted_at` em `ads_autopilot_account_configs` + `motor_type` em `ads_autopilot_sessions`.
- [x] Gestor de Tráfego IA — Sprint 14 (Motor Guardião edge function): Edge function `ads-autopilot-guardian` v1.0.0 com ciclos diários automatizados (12h/13h/16h/00h01 BRT), tools restritos (pause_campaign, adjust_budget, report_insight), limites de plataforma (Meta ±20%/48h, Google ±20%/7d, TikTok ±15%/48h), cron `1 3,15,16,19 * * *` UTC.
- [x] Gestor de Tráfego IA — Sprint 15 (Motor Estrategista edge function): Edge function `ads-autopilot-strategist` v1.0.0 com pipeline em 5 fases (Planning → Creatives → Audiences → Assembly → Publication). Triggers: `start` (primeira ativação/reestruturação), `weekly` (sábados, implementação domingo 00:01), `monthly` (dia 1). Tools: `create_campaign`, `create_adset`, `generate_creative`, `create_lookalike_audience`, `adjust_budget`, `strategic_plan`. Modelo: `openai/gpt-5.2`. Context collector profundo (30d insights, audiences, experiments, creative cadence). Cron: `0 3 * * 0,1` (domingo/segunda 00:00 UTC = sábado/domingo 21:00 BRT). Hook `useAdsAutopilot` atualizado com `triggerStrategist` mutation.
- [x] Gestor de Tráfego IA — Sprint 16 (Cron Jobs Finais): Configuração de cron schedules para os 3 motores semanais pendentes: `ads-autopilot-weekly-insights` (segunda 11:00 UTC = `0 11 * * 1`), `ads-autopilot-experiments-run` (terça 11:00 UTC = `0 11 * * 2`), `ads-autopilot-creative-generate` (quarta 11:00 UTC = `0 11 * * 3`). Todas as edge functions já existiam (Sprints 4, 6a, 6b) mas não tinham schedule configurado em `config.toml`. Pipeline completo do Gestor de Tráfego IA agora tem 7 cron jobs ativos: Guardian (4x/dia), Strategist (sáb/dom), Weekly Insights (seg), Experiments (ter), Creative Generate (qua).
- [x] Gestor de Tráfego IA — Sprint 17 (Pipeline Criativo Completo): **3 correções críticas**: 1) `ads-autopilot-strategist` v1.1.0 — AdSet agora envia `promoted_object` com `pixel_id` + `custom_event_type` (PURCHASE/LEAD) buscado de `marketing_integrations`, contexto inclui `images` dos produtos e `metaPixelId`; 2) `creative-image-generate` v3.1.0 — bypass de auth M2M (service role) para chamadas entre edge functions, mantendo auth de usuário para chamadas diretas; 3) `ads-autopilot-creative` v1.2.0 — auto-fetch de `product_image_url` via `product_images` ou `products.images` quando não fornecida. Pipeline completo: Strategist → generate_creative (com imagem) → ads-autopilot-creative → creative-image-generate (Gemini+OpenAI) → Storage → Imagem pronta.
- [x] Gestor de Tráfego IA — Sprint 18 (v5.10.0 Agendamento Nativo Meta): **Agendamento nativo** — campanhas criadas pela IA com `human_approval_mode = "auto"` usam `status: ACTIVE` + `start_time` futuro (00:01-04:00 BRT), fazendo com que apareçam como **"Programada"** no Meta Ads Manager nativamente. Removido o agendamento interno (`activate_campaign`). **Nova aba "Agendadas"** no filtro de campanhas (`AdsCampaignsTab.tsx`) com bolinha azul e contagem dedicada. `StatusDot` atualizado para exibir "Agendada" quando `start_time` está no futuro. `meta-ads-campaigns` v1.6.0 suporta `start_time` e `stop_time` no payload de criação e persistência local.
- [ ] Relatórios de ROI (avançado — comparativo de períodos)
- [x] Gestão de Criativos (UI básica)
- [x] Gestão de Criativos (Tabela creative_jobs)
- [x] Gestão de Criativos (Edge Functions generate/process)
- [x] Gestão de Criativos (Galeria visual)
- [ ] Gestão de Criativos (Webhook fal.ai)
- [x] Gestor de Tráfego IA — v5.12.8 (UI/UX Polish): **Zoom de criativos** — `ActionApprovalCard` exibe overlay com ícone de lupa (ZoomIn) no hover de imagens de preview, abrindo Dialog ampliado para inspeção antes da aprovação. Placeholder com ícone `ImageIcon` quando preview ausente. **Sanitização de texto** — função `sanitizeDisplayText` aplicada em todos os textos visíveis ao usuário (insights, cards de aprovação, chat) para remover UUIDs, IDs técnicos (`act_...`), tags internas (`[NOVO]`) e parênteses vazios. **Orçamento como meta de investimento** — prompt do `ads-autopilot-analyze` atualizado para tratar `budget_cents` como meta obrigatória de investimento (não apenas limite máximo). A IA deve planejar ações que busquem utilizar 100% do valor configurado, redistribuindo verbas ou criando campanhas. Se identificar que não deve gastar o total, deve sugerir via Insights. **Overflow do chat corrigido** — containers de chat e sidebar com `overflow-hidden` e `min-w-0` para evitar corte horizontal de conteúdo. **Labels localizados** — prioridades de insights exibidas em português (Crítico/Alto/Médio/Baixo).
- [x] Gestor de Tráfego IA — v5.13.0 (Strategist Context Expansion + Insights UI): **Motor Estrategista v1.3.0** — context collector expandido de 11 para 18 fontes de dados. Novas fontes: `meta_ad_ads` (performance individual de anúncios), `store_settings` (URLs da loja, SEO), `tenants` (domínios customizados), `store_pages` (páginas institucionais), `ai_landing_pages` (landing pages IA), `ads_autopilot_configs` (instruções globais), `categories` (categorias de produtos). System prompt enriquecido com: URLs da loja e checkout, margens de produto, landing pages específicas como destino de campanhas. **Insights UI** — preview de 150 caracteres com botão expandir para texto completo (`whitespace-pre-wrap`). Filtro "Estratégia" adicionado às categorias. Sanitização de termos técnicos em PT-BR.
- [x] Gestor de Tráfego IA — v1.10.0 (Revision Trigger + Auto Re-trigger): **Motor Estrategista v1.10.0** — novo trigger `revision` que permite re-executar o estrategista com feedback do usuário após rejeição de um plano. Parâmetro `revision_feedback` injetado no prompt via placeholder `{{APPROVED_PLAN_CONTENT}}`, incluindo o diagnóstico do plano anterior e as instruções de ajuste. **Frontend `AdsPendingApprovalTab`** — `adjustAction` agora dispara automaticamente `ads-autopilot-strategist` com trigger `revision` + `revision_feedback` após rejeitar a ação, eliminando a necessidade de re-trigger manual. Toast atualizado: "Feedback enviado! A IA está gerando um novo plano com seus ajustes...". Invalidação de queries inclui `ads-autopilot-sessions`. **Bugfix implement_approved_plan** — filtro de busca do plano aprovado corrigido de `.eq("status", "approved")` para `.in("status", ["approved", "executed"])`, pois a `execute-approved` marca o plano como `executed` antes de disparar o estrategista.
- [x] Gestor de Tráfego IA — v5.13.1 (Approval UX Cleanup): **Filtro de ações internas** — `create_adset` e `activate_campaign` removidos da visão de aprovação do usuário em `AdsPendingApprovalTab`, `useAdsPendingActions` e `AdsPendingActionsTab`. Apenas `create_campaign`, `strategic_plan` e ações de alto nível são exibidas. **Bugfix product_price** — campo `product_price` no `ActionApprovalCard` corrigido: valor já está em BRL (ex: 319.33), não em centavos. Removido `formatCents()` e substituído por formatação direta `R$ ${Number(val).toFixed(2)}`. **Limpeza de dados** — lotes duplicados de propostas rejeitados automaticamente; `create_adset` pendentes marcados como `executed` internamente.
- [x] Gestor de Tráfego IA — v5.13.2 (Creative URL Race Condition Fix): **Causa raiz** — `generate_creative` é assíncrono; quando `create_campaign` executa logo em seguida, `asset_url` ainda é `null` no banco, causando cards sem preview visual. **Correção em 2 camadas:** 1. **Backend (Motor Estrategista v1.11.0)** — passo de pós-processamento após TODOS os tool calls que busca ações `pending_approval` do tipo `create_campaign` sem `creative_url` e resolve via: creative asset do produto → imagem do catálogo (`product_images` com `sort_order`). Atualiza `action_data.creative_url` e `action_data.preview.creative_url`. 2. **Frontend (`useResolvedCreativeUrl` hook)** — fallback inteligente no `ActionApprovalCard` (v5.13.2): se `creative_url` é null mas `product_id` existe, busca automaticamente em `ads_creative_assets` e depois em `product_images`. Cache de 60s via `staleTime`. **Garantia anti-regressão** — mesmo que o backend falhe no pós-processamento, o frontend sempre resolve uma imagem.
- [x] Gestor de Tráfego IA — v1.12.0 (Product Price & Selection Fix): **Bug crítico global** — campo `price` em `products` armazena valores em BRL (ex: 89.70), mas 4 edge functions dividiam por 100, fazendo o LLM ver preços absurdos (R$0.90 em vez de R$89.70). Isso causava confusão na seleção de produtos e preços errados nos cards de aprovação. **Funções corrigidas:** `ads-autopilot-strategist` (prompt + preview), `ads-autopilot-analyze` (prompt + `product_price_display`), `ads-autopilot-generate-prompt` (prompt), `generate-seo` (contexto de preço). **Enriquecimento do `create_campaign`** — no Motor Estrategista, `create_campaign` agora resolve o produto completo: match inteligente por nome (exato → starts with → includes), resolve imagem via `imagesByProduct`, formata preço em BRL, preenche preview com headline, copy, targeting, budget display e `product_price_display`. **Regra reforçada:** `products.price` e `products.cost_price` são SEMPRE em BRL — PROIBIDO dividir por 100 em qualquer edge function.
- [x] Gestor de Tráfego IA — v1.13.0 (Product Priority Bias Fix): **Causa raiz** — query de produtos ordenava por `price DESC`, fazendo variantes bulk (ex: "Shampoo Preventive Power (12x)" R$499.90) aparecerem como "Top Produto #1" no prompt, induzindo a IA a priorizá-las sobre o produto carro-chefe definido no prompt estratégico do lojista. **Correções:** 1. **Ordenação neutra** — produtos agora ordenados por `name ASC` (sem viés de preço), limite aumentado de 20→30 para catálogo completo. 2. **Rótulo "Catálogo Completo"** — substituído "Top Produtos" (5 itens) por lista completa com preço, margem e estoque. 3. **Instrução explícita no prompt** — aviso mandatório: "A prioridade de produtos é definida EXCLUSIVAMENTE pelo Prompt Estratégico do lojista. NÃO use a ordem do catálogo como indicador de importância." 4. **Filtro de variantes na cadência criativa** — regex `\(\d+x\)|\(FLEX\)|\(Dia\)|\(Noite\)` aplicado para excluir variantes da seleção de "mainProducts" para cadência criativa, focando nos produtos-base. **Regra reforçada:** A IA NUNCA deve inferir importância de produtos pela posição no catálogo ou preço — somente o `user_instructions` (prompt estratégico) define prioridades.
- [x] Gestor de Tráfego IA — v1.22.0 + v3.0.0 (Full Meta Ads Params): **Strategist v1.22.0** — `create_campaign` expandido de ~10 para 35+ parâmetros, incluindo: `bid_strategy` (LOWEST_COST/BID_CAP/COST_CAP/MINIMUM_ROAS), `optimization_goal` (9 opções), `billing_event` (IMPRESSIONS/LINK_CLICKS/THRUPLAY), `conversion_event` (12 eventos Pixel), `geo_locations` (countries/regions/cities), `interests`, `behaviors`, `excluded_audience_ids`, `publisher_platforms` (4 plataformas), `position_types` (16 posições), `device_platforms`, `destination_url` (OBRIGATÓRIO), `ad_format` (SINGLE_IMAGE/VIDEO/CAROUSEL/COLLECTION), `cta` (13 CTAs), `utm_params`, `special_ad_categories`. `create_adset` expandido com 25+ parâmetros espelhados. Required fields incluem: `optimization_goal`, `conversion_event`, `destination_url`. **Executor v3.0.0** — `ads-autopilot-execute-approved` refatorado para propagar TODOS os parâmetros da `action_data` dinamicamente. Removidos hardcodes: `billing_event: "IMPRESSIONS"`, `geo_locations: {countries: ["BR"]}`, `promoted_object` fixo. Posicionamentos mapeados para keys da Meta API (`facebook_positions`, `instagram_positions`). `destination_url` + UTM params propagados para o anúncio. Scheduling nativo: dentro da janela 00:01-04:00 BRT → ACTIVE imediato; fora → ACTIVE + start_time futuro.
- [x] Gestor de Tráfego IA — v1.38.0 (Timeout Fix para Contas Grandes): **Causa raiz** — contas com >1500 entidades (273 campanhas, 800 adsets, 500 ads) causavam timeout na edge function porque `fetchDeepHistoricalInsights` fazia ~30+ chamadas paginadas à Graph API com delays de 2-5s entre páginas/níveis (total estimado: 120-180s apenas na coleta, ultrapassando o limite de 150s do runtime). **Correção** — substituído `fetchDeepHistoricalInsights` (Graph API re-fetch) por `buildDeepHistoricalFromLocalData` que usa exclusivamente dados já sincronizados nas tabelas locais (`meta_ad_campaigns`, `meta_ad_adsets`, `meta_ad_ads`, `meta_ad_insights`). Zero chamadas de API externas. Performance: <2s para qualquer tamanho de conta. **Tradeoff** — insights por adset/ad individuais não estão disponíveis no DB local (apenas por campanha), mas os metadados (nomes, targeting, creative_id) são preservados para referência da IA.
- [x] Gestor de Tráfego IA — UI Startup Progress (AdsStartupProgress): Novo componente `AdsStartupProgress.tsx` que exibe barra de progresso e log em tempo real durante a primeira ativação (`strategist_start`). Polled via `ads_autopilot_sessions` a cada 3s. 11 estágios visuais (boot → coleta → IA → salvamento). Desaparece automaticamente ao finalizar, invalidando caches de ações/sessões. Integrado em `AdsActionsTab.tsx` (acima da lista de ações e no empty state). Apenas para trigger `strategist_start`.
- [x] Gestor de Tráfego IA — v1.39.0 (Lifetime Sync obrigatório no Start): **Causa raiz** — v1.38.0 trocou o deep historical para dados locais (`buildDeepHistoricalFromLocalData`), mas o sync de background (`meta-ads-insights`) apenas sincronizava os últimos 30 dias. Resultado: o trigger `start` mostrava "30 dias" mesmo pedindo análise lifetime. **Correção** — antes de chamar `buildDeepHistoricalFromLocalData`, o trigger `start` agora invoca `meta-ads-insights` com `date_preset: "maximum"` para cada `ad_account_id`, garantindo que os insights lifetime estejam no DB local antes da leitura. Limite de rows aumentado de 2000→5000. **Regra:** O trigger `start` DEVE sincronizar insights lifetime da Meta API ANTES de montar o deep historical local. Triggers `weekly`/`monthly` NÃO fazem sync adicional (usam dados já no DB).
- [x] Gestor de Tráfego IA — v5.14.0 (Guard isFirstEver no toggleAI): **Causa raiz** — `toggleAI.onSuccess` disparava o Strategist toda vez que `enabled === true`, incluindo re-ativações (toggle off→on), gerando sessões "fantasma" duplicadas. **Correção** — `mutationFn` retorna `{ isFirstEver }` e `onSuccess` só dispara o Strategist quando `enabled && result?.isFirstEver`. Re-ativações são tratadas pelos ciclos automáticos de background (weekly/monthly).
- [x] Meta Ads Insights — v1.5.0 (Chunked Fallback para Contas Grandes): **Causa raiz** — `date_preset: "maximum"` falhava silenciosamente para contas com muitas campanhas (273+) porque a Meta API retornava erro `code: 1` ("Please reduce the amount of data"). O sync fazia `continue` e pulava a conta inteira, resultando em apenas ~30 dias de insights no DB local. **Correção** — quando `maximum` falha com `error.code === 1`, o sistema agora faz fallback para chunks trimestrais (3 meses por requisição). Determina a data de início pela campanha mais antiga da conta (filtro `start_time > 2010`), aplica clamp de 36 meses (limite da Meta API), e itera os chunks com delay de 1s entre eles para evitar rate limiting. **Resultado:** conta com 273 campanhas passou de 267→813 rows de insights, cobrindo set/2023→fev/2026 (3 anos completos). **Regra:** registros agregados (date_start != date_stop) devem ser evitados — usar sempre `time_increment=1` para granularidade diária.
- [x] Gestor de Tráfego IA — v1.40.0 (Skip LIFETIME Sync quando DB Local tem dados): **Causa raiz** — v1.39.0 fazia sync LIFETIME obrigatória no trigger `start`, consumindo ~154s dos 150s de timeout da Edge Function, sem sobrar tempo para a chamada de IA (Gemini). **Correção** — antes de iniciar a sync, o strategist verifica `meta_ad_insights` do tenant. Se existem >100 rows, a sync LIFETIME é pulada (fast path) e o sistema usa diretamente os dados locais. **Regra:** A sync LIFETIME só é executada quando o DB local está vazio ou com poucos dados (<100 rows). Após um reset de dados + re-sync manual, a re-ativação do toggle aproveitará os dados já sincronizados sem desperdício de tempo.
- [x] Gestor de Tráfego IA — v5.16.0 (Rejeição com Duas Opções): **Substituição do campo de texto livre** — o fluxo de rejeição em `ActionApprovalCard` e `OrphanAdsetGroupCard` agora oferece duas opções em vez de textarea: **Opção 1 ("Não quero esta proposta")** — rejeita o plano/ação com `reason: "Usuário não quer esta proposta"`, a IA continua apenas com controles automáticos (diários/semanais/mensais). **Opção 2 ("Quero outra proposta")** — rejeita com `reason: "Usuário solicitou nova proposta"` e dispara automaticamente `ads-autopilot-strategist` com trigger `revision` para gerar um novo plano estratégico substituto. **Componentes afetados:** `ActionApprovalCard.tsx` (type `RejectMode = "discard" | "regenerate"`, dialog com RadioGroup), `AdsPendingActionsTab.tsx` e `AdsPendingApprovalTab.tsx` (handler `onReject` verifica modo e dispara strategist se `regenerate`). **Regra:** O feedback de texto livre foi removido — a decisão é binária (descartar vs. regenerar).
- [x] Gestor de Tráfego IA — v1.41.0 (Fix 0 Ads no Deep Historical + Recalibração UI): **Bug 1 — 0 ads no contexto:** `buildDeepHistoricalFromLocalData` consultava coluna inexistente `creative_data` na tabela `meta_ad_ads`. A coluna correta é `creative_id`. Resultado: query silenciosamente retornava 0 ads, mesmo com 850 ads no DB. **Correção:** `.select()` e mapeamento de `DeepInsight` corrigidos de `creative_data` para `creative_id`. **Bug 2 — Progress bar travada em 88%:** `AdsStartupProgress` usava timers calibrados para execução de ~360s (v1.38.0). Com v1.40.0 executando em ~70s, os estágios `ai_thinking` (140s), `saving` (280s) e `done` (360s) nunca eram alcançados. **Correção:** `STAGE_TIMES_MS` recalibrado para ~90s total (boot:0, campaigns:2s, insights:5s, adsets:8s, ..., ai_thinking:30s, saving:60s, done:90s). **Regra:** Sempre que o tempo de execução do strategist mudar significativamente, recalibrar `STAGE_TIMES_MS` no `AdsStartupProgress.tsx`.
