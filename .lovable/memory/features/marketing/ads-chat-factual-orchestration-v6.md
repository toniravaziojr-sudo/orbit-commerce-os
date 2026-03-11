# Memory: features/marketing/ads-chat-factual-orchestration-v6
Updated: 2026-03-11

O Ads Chat (v6.7.0) implementa uma arquitetura dual-mode com orquestração determinística para consultas factuais E modo estratégico/generativo com convergência para o pipeline de aprovação existente.

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

### Modo Híbrido (v6.7.0 — NOVO)
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
- **Filosofia**: Não existe mais "winner-takes-all" em mensagens mistas. O híbrido garante que ambas as intenções são atendidas.

### Modo Conversacional (execução com tools)
- **Quando**: write_meta, write_google, write_tiktok, creative, drive, general
- **Como**: IA recebe subconjunto de ferramentas relevantes, executa diretamente
- **Tools**: 5-15 tools por categoria (vs 35+ na v1)

### Escalação de Ações em Lote (v6.2.0 — REGRA DE SEGURANÇA)
- **Classificador**: Regex `bulkIndicators` detecta pedidos de múltiplas campanhas, múltiplos adsets, ações para vários produtos, reestruturação de funil/estrutura, ou escala geral
- **Resultado**: Força `mode: "strategic"` + `category: "strategic"` independente de vocabulário usado
- **Prompt conversacional**: Instrui a IA a NÃO executar direto quando detectar >2 campanhas, >3 adsets, ou múltiplos produtos — deve informar que ações em lote exigem proposta estruturada
- **Objetivo**: Impedir que ações estruturais grandes passem pelo modo conversacional sem aprovação

## Roteamento Frontend (useAdsChat v6.4.0)
- **Primary**: ads-chat-v2 (todos os modos) — ÚNICA edge function chamada
- **SEM fallback para v1**: Removido em v6.4.0 — erros retornam mensagem honesta ao usuário
- **Invalidação**: Após stream, invalida `ads-pending-actions` para refletir propostas estratégicas criadas via chat

## Classificação de Intenção (classifyIntent) — v6.7.0
- 12 categorias: performance, targeting, campaigns_list, store_context, autopilot, write_meta, write_google, write_tiktok, creative, drive, **strategic**, general
- 3 modos: `factual` | `strategic` | `conversational`
- Determinístico via regex, sem dependência de LLM
- **Prioridade**: strategic patterns (SEM negative lookahead para query verbs) > bulk indicators > write patterns > factual patterns > **composite signal** > general

### Mudança v6.7.0 — Remoção do Negative Lookahead
- **Antes (v6.5.0)**: Strategic patterns tinham `!/list[ae]r?|mostrar?|quais\s+são|quanto|qual/i` como condição negativa
- **Problema**: Frases como "liste as campanhas e monte uma estratégia" eram bloqueadas do strategic por causa de "liste"
- **Depois (v6.7.0)**: Negative lookahead removido. Se strategic patterns matcham, vai para strategic independente de verbos de consulta
- **Detecção de híbrido**: Quando ambos existem (strategic + query verbs), seta `isHybrid: true`

### Expansão de Strategic Patterns (v6.7.0)
- `aumentar\s+(vendas|roas|roi|resultado|conversões|faturamento)` — antes só cobria `vend|roas|resultado`
- `melhorar\s+(roas|roi|cpa|vendas|conversões|faturamento)` — antes só cobria `resultado|performance|desempenho`
- `otimizar\s+(roas|cpa|vendas)` — antes só cobria `campanha|resultado|funil`

### Composite Signal Detection (v6.6.0)
- **Problema resolvido**: Classificador dependia de frases literais, exigindo patches reativos a cada novo teste
- **Solução**: Antes do fallback `general`, combina 4 categorias de sinais independentes:
  - `sigEntities`: campanha/adset/conjunto de anúncio/conta de anúncio
  - `sigVerbs`: analisar/listar/mostrar/ver/comparar/relatório/consultar/buscar/checar/conferir/verificar/resumir/exibir/avaliar
  - `sigFilters`: top/mais/menos/melhor/pior/exceto/sem/maior/menor/ranking/ordenar/primeiro/último/acima/abaixo/N campanhas
  - `sigMetrics`: vendas/conversões/ROAS/ROI/CPA/CPC/CTR/gasto/spend/resultado/faturamento/receita/impressões/cliques/alcance/custo
- **Regra**: Quando **2+ categorias** de sinal estão presentes E **sem verbos de escrita** → rota `performance/factual` (confidence 0.82)
- **Logging**: Loga quais sinais ativaram para debug (`Composite signal hit: entities=true verbs=true...`)
- **Objetivo**: Capturar frases naturais sem precisar adicionar regex literal para cada variação

### Expansão de Patterns (v6.5.0)
- **performance**: Adicionados padrões para análise natural:
  - `campanhas com mais vendas/conversões/resultado/faturamento`
  - `campanhas com menor/melhor/pior`
  - `N campanhas com mais` (ex: "10 campanhas com mais vendas")
  - `liste as N campanhas` (ex: "liste aqui as 10 campanhas")
  - `analise todas as campanhas` / `analisar campanhas`
  - `relatório` / `relatório de campanha`
  - `como estão/vão/andam minhas campanhas`
- **campaigns_list** (v6.3.0): Expandido com 7 padrões para frases naturais
- **Motivação**: Frases naturais caíam em `general`, onde o modelo alucinava

## Anti-Filler Defensivo (v6.3.0 — Camada Secundária)
- **Onde**: No path de resposta direta (sem tool calls) do modo conversacional/estratégico
- **Quando ativa**: Apenas quando `category !== "general"` E o texto contém:
  - Alegação falsa de limitação: "não consigo/posso acessar", "ferramenta não disponível", "infelizmente sem acesso"
  - Filler promises: "aguarde enquanto", "vou começar/criar/buscar", "estou preparando/buscando"
- **Como funciona**:
  1. Detecta padrão no texto direto via regex
  2. Faz retry com `tool_choice: "required"` + mensagem forçando execução
  3. Se retry produz tool calls → executa normalmente → stream resultado
  4. Se retry falha → envia texto original como fallback
- **Filosofia**: Proteção secundária, NÃO mecanismo principal. A prioridade é o classificador correto.

## Ferramenta submit_strategic_proposal
- Schema estruturado: diagnosis (min 300 palavras), planned_actions (array com action_type, campaign_name, objective, funnel_stage, daily_budget_brl, reasoning, adsets[]), total_daily_budget_brl, strategy_summary, risks
- Cria registro em `ads_autopilot_actions` com `action_data.source = "ads_chat_v2_strategic"`
- Converge para o mesmo fluxo de aprovação visual (StrategicPlanContent) do Motor Estrategista

## Separação de Responsabilidades
- O Ads Chat é **interface complementar** de controle estratégico manual
- NÃO substitui os motores automáticos (Guardião e Estrategista)
- Propostas do chat convergem para o pipeline único: proposta → aprovação → execução

### Arquivos Relacionados
- `supabase/functions/ads-chat-v2/index.ts` — Edge function dual-mode (v6.7.0)
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
- [ ] Classificador cobre frases naturais: "consegue consultar", "me mostra", "quero ver", "como estão" (v6.3.0)
- [ ] Anti-filler v2 retenta com tool_choice=required quando IA alega limitação falsa (v6.3.0)
- [ ] Anti-filler v2 NÃO ativa para category=general (proteção contra false positives)
- [ ] Composite Signal Detection captura frases com 2+ sinais (entidade+verbo+filtro+métrica) como factual/performance (v6.6.0)
- [ ] Composite Signal NÃO ativa quando há verbos de escrita (criar/pausar/ativar/alterar/duplicar)
- [ ] **Mensagens híbridas (factual + strategic) são roteadas para strategic com isHybrid=true (v6.7.0)**
- [ ] **Strategic patterns NÃO são bloqueados por verbos de consulta (listar/mostrar/quais são) (v6.7.0)**
- [ ] **System prompt estratégico recebe instrução adicional "MODO HÍBRIDO" quando isHybrid=true (v6.7.0)**
- [ ] **Strategic patterns expandidos cobrem melhorar/aumentar/otimizar + métricas específicas (v6.7.0)**
