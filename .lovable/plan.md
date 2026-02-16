
# Plano Definitivo: Pipeline Completa do Gestor de Trafego IA v4.0

## Diagnostico do Estado Atual

### O que ja existe
- Edge function `ads-autopilot-analyze` v3.0 com: context collector (produtos, pedidos, insights 7d), allocator cross-channel, planner por canal, policy validation, execucao (pause/adjust_budget/report_insight)
- Tabelas: `ads_autopilot_configs`, `ads_autopilot_actions`, `ads_autopilot_sessions`
- Config por conta armazenada em JSONB dentro de `safety_rules.account_configs`
- UI: tabs por canal (Meta/Google/TikTok), campanhas, acoes IA, relatorios, chips de contas com config IA
- Edge function `ads-autopilot-creative` basica (bridge para geracao de imagem)
- Cron job a cada 6h para analise automatica

### O que NAO existe ainda
- 3 abas mae (Visao Geral / Gerenciador / Insights)
- Tabela normalizada para config por conta (esta em JSONB)
- Campos: strategy_mode, funnel_splits, kill_switch
- Tabelas: insights, experiments, creative_assets, tracking_health
- Edge functions: weekly-insights, experiments-run, pacing-monitor
- Unit economics no contexto da IA
- Tracking health com bloqueio de escala
- Experiment layer governado
- Modo aprovacao humana para acoes high-impact
- Dropdown multi-select de contas (hoje sao chips)

---

## Sprint 1: Banco de Dados (Fundacao)

Executar ANTES de tudo para que UI e logica tenham base.

### 1.1 Nova tabela normalizada: `ads_autopilot_account_configs`
Substituir o JSONB `safety_rules.account_configs` por tabela propria.

```text
CREATE TABLE ads_autopilot_account_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel text NOT NULL,
  ad_account_id text NOT NULL,
  is_ai_enabled boolean DEFAULT false,
  budget_mode text DEFAULT 'monthly',
  budget_cents integer DEFAULT 0,
  target_roi numeric(6,2),
  min_roi_cold numeric(6,2) DEFAULT 2.0,
  min_roi_warm numeric(6,2) DEFAULT 3.0,
  user_instructions text DEFAULT '',
  strategy_mode text DEFAULT 'balanced',        -- aggressive / balanced / long_term
  funnel_split_mode text DEFAULT 'manual',      -- manual / ai_decides
  funnel_splits jsonb DEFAULT '{"cold":60,"remarketing":25,"tests":15,"leads":0}',
  kill_switch boolean DEFAULT false,
  human_approval_mode text DEFAULT 'auto',      -- auto / approve_high_impact
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tenant_id, channel, ad_account_id)
);
```

### 1.2 Novas colunas em `ads_autopilot_configs` (nivel global)
```text
ALTER TABLE ads_autopilot_configs
  ADD COLUMN IF NOT EXISTS strategy_mode text DEFAULT 'balanced',
  ADD COLUMN IF NOT EXISTS funnel_split_mode text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS funnel_splits jsonb DEFAULT '{"cold":60,"remarketing":25,"tests":15,"leads":0}',
  ADD COLUMN IF NOT EXISTS kill_switch boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS human_approval_mode text DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS total_budget_cents integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_budget_mode text DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS channel_limits jsonb DEFAULT '{"meta":{"min_pct":0,"max_pct":100},"google":{"min_pct":0,"max_pct":100},"tiktok":{"min_pct":0,"max_pct":100}}';
```

### 1.3 Tabela `ads_autopilot_insights`
```text
CREATE TABLE ads_autopilot_insights (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel text NOT NULL,
  ad_account_id text,
  title text NOT NULL,
  body text NOT NULL,
  evidence jsonb DEFAULT '{}',
  recommended_action jsonb DEFAULT '{}',
  priority text DEFAULT 'medium',   -- low / medium / high / critical
  category text DEFAULT 'general',  -- budget / funnel / creative / audience / product / tracking / positive
  sentiment text DEFAULT 'neutral', -- positive / negative / neutral
  status text DEFAULT 'open',       -- open / done / ignored
  resolved_at timestamptz,
  created_at timestamptz DEFAULT now()
);
```

### 1.4 Tabela `ads_autopilot_experiments`
```text
CREATE TABLE ads_autopilot_experiments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel text NOT NULL,
  ad_account_id text,
  hypothesis text NOT NULL,
  variable_type text NOT NULL,     -- creative / audience / structure / landing
  plan jsonb DEFAULT '{}',
  budget_cents integer DEFAULT 0,
  duration_days integer DEFAULT 7,
  min_spend_cents integer DEFAULT 0,
  min_conversions integer DEFAULT 0,
  start_at timestamptz,
  end_at timestamptz,
  success_criteria jsonb DEFAULT '{}',
  status text DEFAULT 'planned',   -- planned / running / completed / cancelled / promoted
  results jsonb DEFAULT '{}',
  winner_variant_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 1.5 Tabela `ads_creative_assets`
```text
CREATE TABLE ads_creative_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel text,
  ad_account_id text,
  product_id uuid REFERENCES products(id),
  experiment_id uuid REFERENCES ads_autopilot_experiments(id),
  asset_url text,
  storage_path text,
  format text,                     -- feed / story / reels / video / carousel
  aspect_ratio text,               -- 1:1 / 4:5 / 9:16 / 16:9
  angle text,                      -- benefit / proof / offer / ugc / testimonial
  copy_text text,
  headline text,
  cta_type text,
  variation_of uuid REFERENCES ads_creative_assets(id),
  platform_ad_id text,             -- ID do anuncio na plataforma apos upload
  status text DEFAULT 'draft',     -- draft / generating / ready / active / paused / archived
  performance jsonb DEFAULT '{}',  -- spend, impressions, clicks, conversions, roas, ctr
  compliance_status text DEFAULT 'pending', -- pending / approved / rejected
  compliance_notes text,
  meta jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### 1.6 Tabela `ads_tracking_health`
```text
CREATE TABLE ads_tracking_health (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  channel text NOT NULL,
  ad_account_id text,
  status text DEFAULT 'unknown',   -- healthy / degraded / critical / unknown
  indicators jsonb DEFAULT '{}',   -- event_counts, discrepancy_pct, api_errors, attribution_window
  alerts jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now()
);
```

### 1.7 RLS em todas as novas tabelas
Policies de SELECT/INSERT/UPDATE/DELETE via `user_has_tenant_access(tenant_id)`.

---

## Sprint 2: Reestruturacao da UI (3 Abas Mae + Dropdown)

### 2.1 Reestruturar `AdsManager.tsx`
Nivel superior com 3 abas:

- **Visao Geral** (`AdsOverviewTab.tsx` - NOVO)
  - Cards de metricas agregadas cross-channel: Spend total, ROAS blended, CPA medio, Conversoes, Receita
  - Grafico de tendencia 7d vs 7d anterior (usando Recharts)
  - Top 3 campanhas (melhor ROAS) + Bottom 3 (pior ROAS)
  - Barra de pacing mensal (gasto vs orcamento planejado)
  - Alertas ativos: tracking degradado, orcamento baixo, estoque, reprovacoes

- **Gerenciador de Anuncios** (conteudo atual reorganizado)
  - Tabs de canal (Meta/Google/TikTok) permanecem
  - Sub-tabs: Campanhas, Acoes IA, Relatorios

- **Insights** (`AdsInsightsTab.tsx` - NOVO)
  - Feed de insights semanais da IA
  - Cards com icone de sentimento (verde=positivo, vermelho=negativo, amarelo=neutro)
  - Botoes "Vou fazer" (status=done) e "Ignorar" (status=ignored)
  - Filtro por categoria e canal
  - Botao "Gerar Insights Agora" (manual)
  - Historico colapsavel de insights resolvidos

### 2.2 Dropdown Multi-Select de Contas (`AdsAccountDropdown.tsx` - NOVO)
Substituir chips por dropdown com:
- Checkboxes multi-select
- Opcao "Todas as contas"
- Indicador de status IA (azul=ativo, amarelo=inativo)
- Botao de engrenagem para config IA
- Persistencia localStorage (manter padrao existente)

### Arquivos afetados
- `src/pages/AdsManager.tsx` - Reestruturacao com 3 abas
- `src/components/ads/AdsOverviewTab.tsx` - NOVO
- `src/components/ads/AdsInsightsTab.tsx` - NOVO
- `src/components/ads/AdsAccountDropdown.tsx` - NOVO
- `src/components/ads/AdsChannelIntegrationAlert.tsx` - Refatorar para usar dropdown

---

## Sprint 3: Config Obrigatoria + Estrategia + Splits + Kill Switch

### 3.1 Refatorar `AdsAccountConfig.tsx`
Migrar de JSONB para a nova tabela `ads_autopilot_account_configs`.

Adicionar novos campos:
- **Estrategia Geral** (Select obrigatorio):
  - Agressiva: "Foco em vendas a curto prazo"
  - Balanceada (Recomendada): "Equilibrio entre vendas e crescimento"
  - Medio/Longo Prazo: "Branding e crescimento sustentavel"

- **Splits de Funil** (4 inputs de %):
  - % Publico Frio (obrigatorio)
  - % Remarketing (obrigatorio)
  - % Testes (obrigatorio)
  - % Leads (opcional, default 0)
  - Validacao: total = 100%
  - Toggle "Deixe a IA decidir": desabilita campos, IA distribui por metricas

- **Modo de Aprovacao** (Select):
  - Auto-executar tudo
  - Aprovar acoes de alto impacto (criar campanha, budget > 20%, trocar objetivo)

- **Kill Switch**: Botao vermelho com confirmacao. Quando ativado, autopilot para imediatamente.

### 3.2 Validacao para ativar Switch de IA
O Switch so fica habilitado quando TODOS os campos estao preenchidos:
- Orcamento > 0
- ROI Ideal preenchido
- ROI min Frio e Quente preenchidos
- Prompt Estrategico preenchido (min 10 caracteres)
- Estrategia selecionada
- Splits preenchidos OU "IA decide" ativado

### 3.3 Atualizar `useAdsAutopilot.ts`
- Novo hook `useAdsAccountConfigs` para CRUD na tabela normalizada
- Manter retrocompatibilidade durante migracao

### Arquivos afetados
- `src/components/ads/AdsAccountConfig.tsx` - Redesign completo
- `src/hooks/useAdsAutopilot.ts` - Extender com account configs
- `src/hooks/useAdsAccountConfigs.ts` - NOVO

---

## Sprint 4: Weekly Insights Engine

### 4.1 Edge Function `ads-autopilot-weekly-insights` (NOVA)
Executada 1x por semana (segunda 8h) via cron:

1. Coleta contexto completo (reutiliza `collectContext` do analyze)
2. Adiciona metricas extras: unit economics por produto (cost_price, margem), funil de checkout (pedidos por etapa), tracking health
3. Envia para IA com prompt especializado em diagnostico semanal
4. IA gera insights categorizados:
   - **Budget**: realocar entre canais/contas, aumentar/diminuir investimento
   - **Funil**: LP com bounce alto, checkout com abandono, preco vs margem
   - **Criativos**: fadiga detectada (frequencia alta + CTR caindo), novos angulos sugeridos
   - **Publicos**: saturacao, novos lookalikes recomendados
   - **Produtos**: vencedores para escalar, margem baixa = ROAS ilusorio, estoque
   - **Tracking**: queda de eventos, discrepancia atribuicao vs pedidos reais
   - **Positivos**: produto vendendo bem, campanha escalando, ROAS subindo
5. Persiste em `ads_autopilot_insights`
6. Insights "open" da semana anterior sao arquivados automaticamente

### 4.2 Cron Job
```text
-- Semanal, segunda-feira 8h BRT (11h UTC)
cron.schedule('ads-weekly-insights', '0 11 * * 1', ...)
```

### 4.3 Hook `useAdsInsights.ts` (NOVO)
- Listar insights por tenant/canal/status
- Marcar como done/ignored
- Trigger manual "Gerar agora"

---

## Sprint 5: Evolucao do Autopilot Analyze v4.0

### 5.1 Unit Economics no Context Collector
Adicionar ao contexto enviado para a IA:
- `cost_price` por produto (ja existe na tabela products)
- Margem calculada: `(price - cost_price) / price * 100`
- CPA maximo real baseado em margem (nao ticket medio)
- Taxas estimadas (gateway ~3-5%)
- ROI real = `(receita - COGS - taxas) / spend` (diferente de ROAS)

### 5.2 Estrategia e Funnel Splits no System Prompt
Ler `strategy_mode` e `funnel_splits` da config por conta e incorporar:
- **Agressiva**: Priorizar campanhas de conversao, escalar vencedores rapido, testes mais frequentes, CPA tolerance mais alta
- **Balanceada**: Equilibrio conversao/branding, escala gradual, testes regulares
- **Medio/Longo Prazo**: Mais budget para awareness/topo de funil, escala conservadora, foco em branding

### 5.3 Tracking Health Check (integrado no ciclo de 6h)
Nova funcao `checkTrackingHealth`:
- Comparar conversoes atribuidas (insights) vs pedidos reais (orders) dos ultimos 7 dias
- Detectar queda brusca de eventos (>30% vs semana anterior)
- Verificar erros de API/token expirado
- Verificar status "Learning Limited" quando disponivel
- Se health = "degraded"/"critical": bloquear escala, permitir apenas pausas e insights
- Persistir em `ads_tracking_health`

### 5.4 Pacing Monitor (integrado no ciclo de 6h)
- Calcular gasto acumulado no mes vs orcamento mensal
- Se underspend > 20%: flag para IA priorizar escala e novos testes
- Se overspend > 10%: flag para reduzir agressividade
- Anomaly detection: pico CPC > 3x media, queda CVR > 50%

### 5.5 Kill Switch Check
No inicio do ciclo, verificar `kill_switch` global e por conta. Se ativo, retornar imediatamente sem executar acoes.

### Arquivos afetados
- `supabase/functions/ads-autopilot-analyze/index.ts` - v4.0

---

## Sprint 6: Criacao de Campanhas e Experimentos (Fases 2-3)

### 6.1 Novas Tools no Planner (Fase 2)
- `create_campaign`: Criar campanha baseada em template
  - Templates: Conversao Fria, Remarketing, Teste de Criativo, Leads
  - Naming: `[AI] {objetivo} - {produto/publico} - {data}`
  - Budget inicial respeitando splits de funil
  - Requer: dados de 7+ dias, 10+ conversoes na conta
- `create_adset`: Criar conjunto com targeting definido
  - Requer: campanha existente, publico valido, budget calculado

### 6.2 Regras de Data Sufficiency para Experimentos
- Gasto minimo por variante: 3x CPA alvo
- Duracao minima: 5 dias (apos learning phase)
- Minimo 20 cliques OU 5 conversoes por variante
- Maximo 3 experimentos simultaneos por conta
- Regra de promocao: variante com CPA < 80% do controle OU ROAS > 120% do controle por 3+ dias

### 6.3 Edge Function `ads-autopilot-experiments-run` (NOVA)
Semanal (terca 8h):
1. Avaliar experimentos ativos: coletar metricas, comparar com criterios
2. Promover vencedores: escalar budget, mover para campanha principal
3. Encerrar perdedores: pausar variantes com performance inferior
4. Planejar novos: identificar produtos vencedores sem testes recentes, criativos com fadiga, publicos nao testados
5. Criar experimentos: inserir em `ads_autopilot_experiments` com plano detalhado

### 6.4 Creative Asset Layer
Edge function `ads-autopilot-creative-generate` evolucao (semanal, quarta 8h):
1. Identificar produtos vencedores (ROAS alto + vendas recorrentes)
2. Analisar criativos existentes na conta (performance por criativo)
3. Gerar 3+ novos criativos por produto vencedor:
   - Formatos: feed (1:1, 4:5), stories/reels (9:16)
   - Angulos: beneficio, prova social, oferta, antes/depois
   - Copy variada: headline + body + CTA
4. Fontes de inspiracao: criativos vencedores internos + referencias do usuario (upload manual)
5. Compliance: bloquear claims proibidos, verificar safe zones de texto
6. Registrar em `ads_creative_assets` com link ao produto e experimento
7. Pipeline: draft -> generating -> ready -> (upload para plataforma) -> active

### 6.5 Orcamento Sobrando = Acao Imediata
Quando o ciclo de 6h detectar underspend (por pausas ou ROAS baixo):
1. Prioridade 1: Escalar campanhas vencedoras dentro dos limites
2. Prioridade 2: Criar novos testes baseados em vencedores existentes
3. Prioridade 3: Criar variacoes de criativos/publicos

### 6.6 Human Approval Mode
Quando `human_approval_mode = 'approve_high_impact'`:
- Acoes de criacao (create_campaign, create_adset) ficam com status "pending_approval"
- Ajustes de budget > 15% ficam com status "pending_approval"
- UI mostra notificacao com botoes Aprovar/Rejeitar
- Acoes nao aprovadas em 24h sao canceladas automaticamente

---

## Resumo de Cron Jobs

| Job | Frequencia | Edge Function | Descricao |
|-----|-----------|---------------|-----------|
| Otimizacao | 6h (existente) | ads-autopilot-analyze v4.0 | Ajustes, pausas, pacing, tracking health, kill switch |
| Insights | Semanal (seg 11h UTC) | ads-autopilot-weekly-insights | Diagnostico + insights persistidos |
| Experimentos | Semanal (ter 11h UTC) | ads-autopilot-experiments-run | Avaliar/criar/promover testes |
| Criativos | Semanal (qua 11h UTC) | ads-autopilot-creative-generate | Gerar assets para produtos vencedores |

## Phased Rollout (allowed_actions)

| Fase | Criterio de Liberacao | Acoes |
|------|----------------------|-------|
| 1 (atual) | Sempre | pause, adjust_budget, report_insight, allocate_budget |
| 2 | 7+ dias de dados + 10+ conversoes | + create_campaign, create_adset |
| 3 | 14+ dias + 30+ conversoes | + create_creative, run_experiment |
| 4 | 30+ dias + 50+ conversoes | + expand_audience, advanced_ab_test |

## Novos Arquivos (resumo)

| Arquivo | Tipo |
|---------|------|
| `src/components/ads/AdsOverviewTab.tsx` | Componente - Dashboard |
| `src/components/ads/AdsInsightsTab.tsx` | Componente - Feed insights |
| `src/components/ads/AdsAccountDropdown.tsx` | Componente - Multi-select |
| `src/hooks/useAdsAccountConfigs.ts` | Hook - Config por conta |
| `src/hooks/useAdsInsights.ts` | Hook - Insights CRUD |
| `src/hooks/useAdsExperiments.ts` | Hook - Experimentos |
| `supabase/functions/ads-autopilot-weekly-insights/index.ts` | Edge Function |
| `supabase/functions/ads-autopilot-experiments-run/index.ts` | Edge Function |

## Ordem de Implementacao

1. Sprint 1 (DB) - Base para tudo
2. Sprint 2 (UI 3 abas + dropdown) - Impacto visual, sem logica nova
3. Sprint 3 (Config obrigatoria + estrategia) - UX de configuracao
4. Sprint 4 (Insights engine) - Valor imediato para o usuario
5. Sprint 5 (Analyze v4.0) - Core intelligence upgrade
6. Sprint 6 (Criacao + experimentos + criativos) - Capacidade expansiva

Cada sprint sera implementado em uma mensagem separada para controle e validacao incremental.

## Documentacao Afetada
- `docs/regras/marketing-integracoes.md` - Todas as novas fases, tabelas, edge functions e regras
