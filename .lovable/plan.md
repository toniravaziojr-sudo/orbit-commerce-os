
# Diagnóstico e Plano: IA de Tráfego — Gaps Críticos

## Problema Central

A IA "alucinou" dizendo que as 30 campanhas estavam pausadas e o gasto era zero. Na realidade, existem **4 campanhas ACTIVE** e **290 PAUSED** (296 total), com insights reais de gasto. O problema tem múltiplas causas raiz.

---

## Diagnóstico Detalhado (7 Gaps Identificados)

### GAP 1: Dados Desatualizados / Sync Incompleta
- A tabela `meta_ad_insights` tem apenas **21 registros** para 296 campanhas
- Apenas **3 datas distintas** de insights (17/jan, 09/fev, 16/fev) — faltam dados diários
- A sync de insights usa `date_preset: last_30d` que agrega, não traz dia a dia
- **Resultado**: A IA vê dados esparsos e conclui que "gasto foi praticamente zero"

### GAP 2: Limite de 30 Campanhas no get_campaign_performance
- A função `getCampaignPerformance` faz `.limit(30)` nas campanhas
- O tenant tem **296 campanhas** — a IA vê apenas 30 (possivelmente as mais antigas/pausadas)
- As 4 campanhas ACTIVE podem não aparecer nos 30 resultados
- **Resultado**: IA diz "30 campanhas, todas pausadas"

### GAP 3: Criativos Meta Não Sincronizados
- `meta_ad_creatives` tem **0 registros** para este tenant
- A sync de criativos existe (`meta-ads-creatives`) mas nunca foi executada ou falha silenciosamente
- **Resultado**: IA não consegue analisar os criativos em uso

### GAP 4: Públicos/Audiences Não Sincronizados
- `meta_ad_audiences` tem **0 registros** para este tenant
- A sync de audiências existe (`meta-ads-audiences`) mas nunca executou
- **Resultado**: IA não consegue analisar segmentação ou sugerir públicos

### GAP 5: Falta de Contexto de Negócio no Prompt
A IA não recebe informações críticas que um gestor de tráfego real precisaria:
- **Nicho/mercado**: Não sabe que é uma loja de cosméticos masculinos
- **Público-alvo**: Não sabe que o target são homens 30-60+
- **URLs de destino**: Não sabe as landing pages dos produtos
- **Concorrentes**: Zero contexto competitivo
- **Margem/custo do produto**: Não sabe calcular CPA máximo viável
- **Histórico de performance**: Sem tendências de longo prazo (só 7 dias)
- **Ofertas ativas**: Não sabe se há cupons, frete grátis, kits

### GAP 6: Insights Sem Granularidade
- `getCampaignPerformance` busca apenas insights dos últimos 7 dias
- Não há insights por AdSet ou por Anúncio — apenas por campanha
- Não traz dados por dia (time series) para identificar tendências
- **Resultado**: IA não consegue comparar performance ao longo do tempo

### GAP 7: Ferramentas de Escrita Limitadas
A IA só consegue:
- Criar campanhas Meta (limitado)
- Gerar imagens
- Atualizar config do autopilot

Mas **não consegue**:
- Pausar/reativar campanhas, conjuntos ou anúncios
- Editar orçamento de campanhas existentes
- Criar/editar públicos
- Duplicar campanhas ou conjuntos
- Alterar segmentação de conjuntos existentes

---

## Plano de Implementacao (5 Frentes)

### Frente 1: Corrigir Dados — Sync Completa e Confiável

**1.1 — Aumentar limites de busca**
- `getCampaignPerformance`: mudar `.limit(30)` para `.limit(200)` e filtrar por campanhas ACTIVE primeiro
- `getMetaAdsets`: mudar `.limit(30)` para `.limit(100)` 
- `getMetaAds`: mudar `.limit(30)` para `.limit(100)`

**1.2 — Insights granulares por dia**
- Alterar a sync de insights para usar `time_increment=1` (dados diários, não agregados)
- Aumentar janela de busca para 30 dias reais
- Adicionar nível de insights por AdSet e por Ad (não só campanha)

**1.3 — Auto-sync antes de responder**
- No `collectBaseContext`, disparar sync fire-and-forget de campanhas, adsets e insights se a última sync for > 1 hora
- Garantir que a IA sempre tenha dados frescos

### Frente 2: Contexto de Negócio Enriquecido

**2.1 — Injetar dados do tenant no prompt**
- Buscar `store_settings` para nicho, descrição, público-alvo
- Buscar URLs da loja (domínio, landing pages)
- Buscar ofertas/descontos ativos
- Buscar categorias de produtos para entender o mix

**2.2 — Margem e CPA máximo**
- Injetar preço de custo vs preço de venda (se disponível) para a IA calcular CPA máximo viável
- Ou usar o `target_roi` da config como proxy

**2.3 — Histórico de vendas por produto**
- Enriquecer o contexto com os top 5 produtos por receita (últimos 30 dias)
- Incluir ticket médio por produto, não só geral

### Frente 3: Novas Ferramentas (Leitura)

**3.1 — `get_campaign_details`**: Buscar uma campanha específica com todos os seus conjuntos e anúncios (drill-down)

**3.2 — `get_performance_trend`**: Buscar time-series de uma campanha (gasto/conversões por dia nos últimos 14-30 dias)

**3.3 — `get_adset_performance`**: Métricas por conjunto (não só por campanha) — essencial para otimizar segmentação

**3.4 — `get_ad_performance`**: Métricas por anúncio individual — essencial para saber qual criativo performa melhor

**3.5 — `get_store_context`**: Buscar contexto completo do negócio (nicho, público, URLs, ofertas)

### Frente 4: Novas Ferramentas (Escrita)

**4.1 — `toggle_entity_status`**: Pausar/reativar campanha, conjunto ou anúncio

**4.2 — `update_budget`**: Alterar orçamento de campanha ou conjunto existente

**4.3 — `duplicate_campaign`**: Duplicar campanha com novo público ou novo criativo

**4.4 — `update_adset_targeting`**: Atualizar segmentação de um conjunto existente

### Frente 5: Prompt e Comportamento da IA

**5.1 — Regra: Sempre buscar dados antes de diagnosticar**
- Adicionar instrução obrigatória: "ANTES de fazer qualquer diagnóstico, use get_campaign_performance E get_meta_adsets para ver o estado REAL da conta"
- Nunca confiar apenas no contexto base (que pode estar desatualizado)

**5.2 — Regra: Priorizar campanhas ACTIVE**
- Na resposta, sempre listar campanhas ativas primeiro
- Separar claramente "Campanhas Ativas (N)" vs "Campanhas Pausadas (N)"

**5.3 — Template de diagnóstico**
- Quando o usuário pedir uma "estratégia" ou "diagnóstico", a IA deve obrigatoriamente chamar: `get_campaign_performance` + `get_meta_adsets` + `get_tracking_health` + `get_products` antes de responder

---

## Detalhes Tecnicos

### Arquivos Afetados
- `supabase/functions/ads-chat/index.ts` — Prompt, ferramentas, limites, contexto
- `supabase/functions/meta-ads-insights/index.ts` — Granularidade diaria, nivel adset/ad
- `supabase/functions/meta-ads-adsets/index.ts` — Sync de insights por adset (se nao existir)

### Prioridade de Implementacao
1. **Urgente** (Frente 1 + 5): Corrigir limites e regras de prompt — resolve o problema da alucinacao
2. **Alta** (Frente 2 + 3): Enriquecer contexto e adicionar ferramentas de leitura
3. **Media** (Frente 4): Ferramentas de escrita para acao direta

### Estimativa
- Frente 1 (limites + sync): Mudancas pontuais no `ads-chat/index.ts`
- Frente 2 (contexto): Expandir `collectBaseContext`
- Frente 3 (novas tools leitura): ~5 novas funcoes + tool definitions
- Frente 4 (novas tools escrita): ~4 novas funcoes + tool definitions
- Frente 5 (prompt): Ajustes no `buildSystemPrompt`
