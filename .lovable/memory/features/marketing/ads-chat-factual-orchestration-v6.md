# Memory: features/marketing/ads-chat-factual-orchestration-v6
Updated: 2026-03-11

O Ads Chat (v6.1.0) implementa uma arquitetura dual-mode com orquestração determinística para consultas factuais E modo estratégico/generativo com convergência para o pipeline de aprovação existente.

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

## Roteamento Frontend (useAdsChat v6.1.0)
- **Primary**: ads-chat-v2 (todos os modos)
- **Fallback**: ads-chat (v1) quando v2 retornar erro 500+ ou falha de rede
- **Invalidação**: Após stream, invalida `ads-pending-actions` para refletir propostas estratégicas criadas via chat

## Classificação de Intenção (classifyIntent)
- 12 categorias: performance, targeting, campaigns_list, store_context, autopilot, write_meta, write_google, write_tiktok, creative, drive, **strategic**, general
- 3 modos: `factual` | `strategic` | `conversational`
- Determinístico via regex, sem dependência de LLM

## Ferramenta submit_strategic_proposal
- Schema estruturado: diagnosis (min 300 palavras), planned_actions (array com action_type, campaign_name, objective, funnel_stage, daily_budget_brl, reasoning, adsets[]), total_daily_budget_brl, strategy_summary, risks
- Cria registro em `ads_autopilot_actions` com `action_data.source = "ads_chat_v2_strategic"`
- Converge para o mesmo fluxo de aprovação visual (StrategicPlanContent) do Motor Estrategista

## Separação de Responsabilidades
- O Ads Chat é **interface complementar** de controle estratégico manual
- NÃO substitui os motores automáticos (Guardião e Estrategista)
- Propostas do chat convergem para o pipeline único: proposta → aprovação → execução

### Arquivos Relacionados
- `supabase/functions/ads-chat-v2/index.ts` — Edge function dual-mode (v6.1.0)
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
