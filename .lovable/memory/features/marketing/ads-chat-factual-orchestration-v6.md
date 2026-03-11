# Memory: features/marketing/ads-chat-factual-orchestration-v6
Updated: 2026-03-11

O Ads Chat (v6.9.0) implementa uma arquitetura dual-mode com orquestração determinística para consultas factuais E modo estratégico/generativo com convergência para o pipeline de aprovação existente.

## Arquitetura Dual-Mode + Híbrido

### Modo Factual (orquestração determinística)
- **Quando**: performance, targeting, campaigns_list, store_context, autopilot
- **Como**: Backend classifica intenção, orquestra busca de dados (cache + live Meta API), entrega dados pré-resolvidos à IA para apenas interpretar e formatar
- **IA**: Recebe JSON de dados reais via system prompt, SEM ferramentas — apenas redige resposta

### Modo Estratégico (generativo com convergência para aprovação)
- **Quando**: montar estratégia, propor campanhas, planejar testes, desenhar funil, escalar vendas
- **Como**: IA recebe ferramentas de leitura + `submit_strategic_proposal`. Coleta contexto via tools, depois submete proposta estruturada
- **Convergência**: A ferramenta `submit_strategic_proposal` cria um registro `ads_autopilot_actions` com `action_type=strategic_plan` e `status=pending_approval`, convergindo para o MESMO pipeline de aprovação do Motor Estrategista
- **IA**: Tem até 8 rounds de tool calls (vs 5 no conversacional) para coletar dados e montar proposta
- **Regras**: Nunca executa direto — toda proposta vira artefato visual de aprovação

### Modo Híbrido (v6.7.0)
- **Quando**: Mensagem combina consulta factual + intenção estratégica/proposta/planejamento
- **Exemplo**: "liste as campanhas e monte uma estratégia", "analise o desempenho e proponha melhorias"
- **Detecção**: Classificador detecta `strategicPatterns` + `queryVerbs` na mesma mensagem
- **Roteamento**: Vai para modo **strategic** (não factual), com flag `isHybrid: true`
- **System Prompt**: Recebe instrução adicional "MODO HÍBRIDO ATIVO" que obriga a IA a:
  1. Primeiro coletar os dados factuais solicitados via tools
  2. Apresentar os dados de forma clara ao lojista
  3. Usar esses dados como base para a proposta estratégica
  4. Chamar `submit_strategic_proposal` com a proposta completa
- **Prioridade**: Verbo estratégico VENCE verbo de consulta — o estratégico não é mais bloqueado por "listar/mostrar"

### Modo Drill-Down (v6.8.0 — NOVO)
- **Quando**: Lojista pede detalhamento em nível inferior (conjuntos de anúncios, anúncios individuais, drill-down de campanha)
- **Detecção**: Regex para `conjunto[s]? de anúncio`, `adset[s]?`, `anúncio[s]? individual`, `detalhar campanha`, `aprofundar análise`, etc.
- **Roteamento**: `category: "performance"`, `mode: "conversational"` — NÃO usa factual pre-resolution (que só resolve nível campanha)
- **Razão**: O path factual pré-resolve apenas dados de campanha em JSON. Adsets/ads precisam de tool calling real.
- **Disciplina**: Mesmo sendo `conversational`, o prompt inclui regra explícita "DRILL-DOWN = ANÁLISE FACTUAL COM TOOLS" que força:
  - Chamar get_campaign_details, get_adset_performance, get_ad_performance, get_meta_adsets
  - Apresentar dados estruturados ANTES de opinar
  - Usar contexto do turno anterior (IDs/nomes de campanhas) sem pedir ao lojista repetir
  - NUNCA responder com texto genérico sem consultar dados via tools primeiro

### Guardrails de Memória (v6.8.0 → v6.9.0)
- **Problema v6.8.x**: `ai_memories` continha 14+ registros "pixel quebrado" com importance=10, auto-memorizados pela própria IA a partir de suas respostas. Os guardrails de prompt não eram suficientes porque o memory extractor re-criava os registros a cada conversa.
- **Solução v6.9.0 (3 camadas)**:
  1. **Purga**: Todos os registros sobre pixel/tracking deletados via migration
  2. **Prompt guardrails**: Mantidos em todos os prompts (factual, conversational, strategic)
  3. **Memory extractor guardrail**: `ai-memory-manager` agora proíbe memorizar diagnósticos técnicos, estados de sistema, ou recomendações feitas pela própria IA. Só memoriza fatos declarados pelo USUÁRIO.
- **Escopo**: Aplica-se a TODAS as ai_memories injetadas via getMemoryContext

### Tool Execution v6.9.0 — get_adset_performance e get_ad_performance
- **Problema v6.8.x**: Essas tools existiam na definição de ferramentas mas NÃO tinham handler em `executeToolDirect`. O v2 delegava para ads-chat v1 via HTTP, e quando isso falhava, o fallback retornava "ferramenta não disponível no modo direto".
- **Solução v6.9.0**: Handlers completos portados de ads-chat v1 para `executeToolDirect` em v2:
  - `get_adset_performance`: Query meta_ad_adsets com joins de campaign names, budget display, targeting summary
  - `get_ad_performance`: Query meta_ad_ads com joins de meta_ad_creatives (title, body, CTA, image)

### Modo Conversacional (execução com tools)
- **Quando**: write_meta, write_google, write_tiktok, creative, drive, general
- **Como**: IA recebe subconjunto de ferramentas relevantes, executa diretamente
- **Tools**: 5-15 tools por categoria (vs 35+ na v1)

### Escalação de Ações em Lote (v6.2.0 — REGRA DE SEGURANÇA)
- **Classificador**: Regex `bulkIndicators` detecta pedidos de múltiplas campanhas, múltiplos adsets, ações para vários produtos, reestruturação de funil/estrutura, ou escala geral
- **Resultado**: Força `mode: "strategic"` + `category: "strategic"` independente de vocabulário usado
- **Prompt conversacional**: Instrui a IA a NÃO executar direto quando detectar >2 campanhas, >3 adsets, ou múltiplos produtos — deve informar que ações em lote exigem proposta estruturada

## Roteamento Frontend (useAdsChat v6.4.0)
- **Primary**: ads-chat-v2 (todos os modos) — ÚNICA edge function chamada
- **SEM fallback para v1**: Removido em v6.4.0 — erros retornam mensagem honesta ao usuário
- **Invalidação**: Após stream, invalida `ads-pending-actions` para refletir propostas estratégicas criadas via chat

## Classificação de Intenção (classifyIntent) — v6.8.0
- 12 categorias: performance, targeting, campaigns_list, store_context, autopilot, write_meta, write_google, write_tiktok, creative, drive, **strategic**, general
- 3 modos: `factual` | `strategic` | `conversational`
- Determinístico via regex, sem dependência de LLM
- **Prioridade**: **drill-down** > strategic patterns > bulk indicators > write patterns > factual patterns > **composite signal** > general

### Composite Signal Detection (v6.6.0)
- **Problema resolvido**: Classificador dependia de frases literais, exigindo patches reativos a cada novo teste
- **Solução**: Antes do fallback `general`, combina 4 categorias de sinais independentes:
  - `sigEntities`: campanha/adset/conjunto de anúncio/conta de anúncio
  - `sigVerbs`: analisar/listar/mostrar/ver/comparar/relatório/consultar/buscar/checar/conferir/verificar/resumir/exibir/avaliar
  - `sigFilters`: top/mais/menos/melhor/pior/exceto/sem/maior/menor/ranking/ordenar/primeiro/último/acima/abaixo/N campanhas
  - `sigMetrics`: vendas/conversões/ROAS/ROI/CPA/CPC/CTR/gasto/spend/resultado/faturamento/receita/impressões/cliques/alcance/custo
- **Regra**: Quando **2+ categorias** de sinal estão presentes E **sem verbos de escrita** → rota `performance/factual` (confidence 0.82)

## Anti-Filler Defensivo (v6.3.0 — Camada Secundária)
- **Onde**: No path de resposta direta (sem tool calls) do modo conversacional/estratégico
- **Quando ativa**: Apenas quando `category !== "general"` E o texto contém alegação falsa de limitação ou filler promises
- **Como**: Detecta padrão → retry com `tool_choice: "required"` → se funciona, executa; se falha, envia texto original

## Ferramenta submit_strategic_proposal
- Schema estruturado: diagnosis (min 300 palavras), planned_actions (array), total_daily_budget_brl, strategy_summary, risks
- Cria registro em `ads_autopilot_actions` com `action_data.source = "ads_chat_v2_strategic"`
- Converge para o mesmo fluxo de aprovação visual (StrategicPlanContent) do Motor Estrategista

### Arquivos Relacionados
- `supabase/functions/ads-chat-v2/index.ts` — Edge function dual-mode (v6.9.0)
- `supabase/functions/ai-memory-manager/index.ts` — Extrator de memórias com guardrail anti-auto-memorização
- `supabase/functions/ads-chat/index.ts` — Edge function v1 [DEPRECADA — não mais usada como fallback]
- `src/hooks/useAdsChat.ts` — Hook frontend chamando exclusivamente v2 (sem fallback v1)
- `src/hooks/useAdsPendingActions.ts` — Hook de ações pendentes (exibe propostas do chat)

### Checklist Anti-Regressão
- [ ] Intenções factuais usam orquestração backend (sem tool calling para dados)
- [ ] Intenções estratégicas usam `submit_strategic_proposal` (nunca executam direto)
- [ ] Propostas estratégicas do chat criam `ads_autopilot_actions` com `pending_approval`
- [ ] Frontend NÃO faz fallback para v1 — erros são exibidos de forma honesta (v6.4.0)
- [ ] `ads-pending-actions` é invalidado após stream para refletir novas propostas
- [ ] Modo estratégico tem 8 rounds de tool calls (vs 5 no conversacional)
- [ ] Anti-filler existe apenas como camada defensiva DENTRO do v2 (sem dependência de v1)
- [ ] Ações em lote (múltiplas campanhas/adsets/produtos) são escaladas para modo estratégico
- [ ] Prompt conversacional bloqueia execução direta de >2 campanhas ou >3 adsets
- [ ] Composite Signal Detection captura frases com 2+ sinais como factual/performance (v6.6.0)
- [ ] **Mensagens híbridas (factual + strategic) roteadas para strategic com isHybrid=true (v6.7.0)**
- [ ] **Strategic patterns NÃO bloqueados por verbos de consulta (v6.7.0)**
- [ ] **Drill-down (adset/ad) roteado para conversational com tools, NÃO factual pre-resolution (v6.8.0)**
- [ ] **Prompt drill-down mantém disciplina factual: tools obrigatórias, dados antes de opinião (v6.8.1)**
- [ ] **Guardrails de memória: ai_memories são contexto auxiliar, não fatos verificados (v6.8.0)**
- [ ] **Proibição de afirmar "pixel quebrado" sem confirmação de tool (v6.8.0)**
- [ ] **get_adset_performance e get_ad_performance têm handlers em executeToolDirect v2 (v6.9.0)**
- [ ] **Memory extractor proíbe auto-memorização de diagnósticos técnicos e recomendações da IA (v6.9.0)**
- [ ] **Registros de memória sobre pixel/tracking purgados (v6.9.0)**
