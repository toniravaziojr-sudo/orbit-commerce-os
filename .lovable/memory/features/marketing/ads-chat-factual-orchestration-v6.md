# Memory: features/marketing/ads-chat-factual-orchestration-v6
Updated: 2026-03-11

O Ads Chat (v6.3.0) implementa uma arquitetura dual-mode com orquestração determinística para consultas factuais E modo estratégico/generativo com convergência para o pipeline de aprovação existente.

## Arquitetura Dual-Mode

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

## Classificação de Intenção (classifyIntent) — v6.3.0
- 12 categorias: performance, targeting, campaigns_list, store_context, autopilot, write_meta, write_google, write_tiktok, creative, drive, **strategic**, general
- 3 modos: `factual` | `strategic` | `conversational`
- Determinístico via regex, sem dependência de LLM
- **Prioridade**: strategic patterns > bulk indicators > write patterns > factual patterns

### Expansão de Patterns (v6.3.0)
- **performance**: Adicionado `como estão/vão/andam minhas campanhas` para cobrir frases naturais de consulta
- **campaigns_list**: Expandido significativamente com 7 novos padrões:
  - `consegue consultar/ver/acessar minhas campanhas`
  - `você vê/consegue/tem acesso minhas campanhas`
  - `ver/consultar/acessar/visualizar/checar/conferir minhas campanhas`
  - `me mostra minhas campanhas`
  - `quero ver minhas campanhas`
  - `minhas campanhas ativas/pausadas/do meta/no facebook`
- **Motivação**: Frases naturais como "Consegue consultar minhas campanhas?" caíam em `general` e causavam alucinação do modelo

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
- `supabase/functions/ads-chat-v2/index.ts` — Edge function dual-mode (v6.3.0)
- `supabase/functions/ads-chat/index.ts` — Edge function v1 (fallback, v5.36.0)
- `src/hooks/useAdsChat.ts` — Hook frontend com roteamento v2→v1
- `src/hooks/useAdsPendingActions.ts` — Hook de ações pendentes (exibe propostas do chat)

### Checklist Anti-Regressão
- [ ] Intenções factuais usam orquestração backend (sem tool calling para dados)
- [ ] Intenções estratégicas usam `submit_strategic_proposal` (nunca executam direto)
- [ ] Propostas estratégicas do chat criam `ads_autopilot_actions` com `pending_approval`
- [ ] Frontend faz fallback para v1 quando v2 falha (500+ ou network error)
- [ ] `ads-pending-actions` é invalidado após stream para refletir novas propostas
- [ ] Modo estratégico tem 8 rounds de tool calls (vs 5 no conversacional)
- [ ] Anti-filler e regexes existem apenas como camada defensiva na v1
- [ ] Ações em lote (múltiplas campanhas/adsets/produtos) são escaladas para modo estratégico
- [ ] Prompt conversacional bloqueia execução direta de >2 campanhas ou >3 adsets
- [ ] Classificador cobre frases naturais: "consegue consultar", "me mostra", "quero ver", "como estão" (v6.3.0)
- [ ] Anti-filler v2 retenta com tool_choice=required quando IA alega limitação falsa (v6.3.0)
- [ ] Anti-filler v2 NÃO ativa para category=general (proteção contra false positives)
