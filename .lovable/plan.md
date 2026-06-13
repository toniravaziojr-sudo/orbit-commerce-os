# Onda G — Qualidade Estratégica do Plano Inicial (entregue 2026-06-12)

## Status
✅ Implementado e validado por testes. Aguardando validação operacional do usuário no tenant Respeite o Homem.

## O que foi entregue

### G.1 — Modelo de Orçamento por Funil (determinístico)
- Cálculo sem IA, antes do prompt, com **planejado / ocupado / livre** por funil (cold, remarketing, tests, leads).
- Campanhas ativas viram orçamento ocupado (classificação por palavra-chave no nome).
- Projeção sequencial: ação que cria/escala só pode usar `livre` corrente; para usar mais, precisa referenciar uma ação anterior de pausar/reduzir.
- Bloco "ESTADO DO ORÇAMENTO POR FUNIL" injetado no prompt como **fonte de verdade**; IA é instruída a não recalcular.
- Plano estratégico ganhou campo `funnel_budget_state`.

### G.2 — Identificação de Produto em campanhas existentes
- Pré-processamento determinístico em 6 fontes: creative_product_id → URL slug → nome da campanha → nome do conjunto → nome do anúncio → copy.
- Campos no plano: `product_identification_confidence` (high/medium/low/unknown), `diagnosis_limitation`.
- Regra: confiança low/unknown **proíbe pausa automática como ação principal** — permitidos manter, reduzir com aviso ou pedir revisão.

### G.3 — Tipo de Campanha + Catálogo Dinâmico
- Enum `campaign_type` ampliado: `prospecting | retargeting | catalog_prospecting | catalog_retargeting | testing` (compat com legado mantida).
- Bloco `catalog_setup` obrigatório quando `campaign_type` começa com `catalog_`: catálogo, product set, janela, exclusão de compradores recentes, `creative_mode='dynamic'`.
- Disponibilidade de catálogo Meta pré-calculada e injetada; sem catálogo → IA marca `pending_dependency='catalog_not_connected'` em vez de inventar IDs.

### G.4 — Exclusão de Clientes explícita no Plano
- Bloco `audience_exclusions` por ação (customers, reason, customer_audience_detected, pending_dependency).
- Disponibilidade do público de Clientes pré-resolvida por conta de anúncios.
- Sem público detectado → `pending_dependency='customer_audience_missing'`.
- Quality Gate de proposta filha continua bloqueando frio sem exclusão (`cold_audience_requires_customer_exclusion`).

### G.5 — campaign_intent + override para teste criativo
- Enum `campaign_intent`: acquisition, retention, creative_test, offer_test, scale, reactivation.
- Quality Gate v1.4.0: quando `campaign_intent='creative_test'` E `exclusion_override_reason` ≥ 12 chars, libera a inclusão de clientes em público frio. Auditoria fica em `details.exclusion_overridden_creative_test`.
- Prospecção pura (acquisition/scale) continua sem direito a override.

### G.6 — Audience Budget Fit (Lite)
- Sem chamada à Meta. Usa apenas histórico 30d (impressões, alcance, frequência, CPM, CTR, conversões, CPA, ROAS, gasto).
- 5 categorias: `under_funded`, `adequate`, `over_funded_small_audience`, `saturation_risk`, `insufficient_data`.
- Heurísticas de saturação (frequência) e sub-financiamento (ROAS alto com gasto baixo).
- Sugere faixa de orçamento quando aplicável. Nunca bloqueia o plano; é sinal estratégico.

## UI (enriquecimento, sem tela nova)
- Card de ação ganhou badges: "Exclui clientes/compradores", "Pendência: público de clientes não detectado", "Catálogo dinâmico", "Pendência: catálogo Meta não detectado", "Teste criativo", "Produto identificado com baixa confiança", "Fit: …".
- Justificativa de override de teste criativo renderizada inline.
- Detalhamento de catálogo (nome, product set, janela, exclusão de compradores) inline.
- Nova seção "Orçamento por Funil" com planejado/ocupado/livre por funil + lista de campanhas ativas que ocupam cada bucket.

## Restrições respeitadas
- Sem chamada à Meta `delivery_estimate` / `reachestimate`.
- Sem publicação, mutação Meta/Google/TikTok, criativo final automático, crédito sem aprovação.
- Sem Google/TikTok operacional, sem cron mensal, sem nova integração.
- Sem aprovar plano atual automaticamente, sem gerar propostas filhas automaticamente.

## Como validar no painel
1. Abrir o Plano Estratégico atual no tenant Respeite o Homem.
2. Conferir a nova seção "Orçamento por Funil" com planejado/ocupado/livre.
3. Conferir badges nas ações: exclusão de clientes, intent, catálogo dinâmico, baixa confiança de produto, fit.
4. Rodar nova análise inicial e conferir que o diagnóstico cita orçamento ocupado vs livre e identifica produto com confiança declarada.
5. Em teste criativo com clientes incluídos, conferir a justificativa renderizada.

## Testes automatizados
- `src/test/ads-funnel-budget-model.test.ts` — 5 testes (split, ocupado, inferência, projeção sequencial, bloqueio).
- `src/test/ads-product-identification.test.ts` — 5 testes (slug, nome, copy, unknown, gate destrutivo).
- `src/test/ads-audience-budget-fit-lite.test.ts` — 5 testes (insufficient, saturation, over_funded_small, under_funded, adequate).
- `src/test/ads-quality-gate-creative-test-override.test.ts` — 3 testes (bloqueia sem override, libera com override, exige justificativa).

---

# Onda G.1 (rev2) — Strategy Preflight Builder + Contrato fail-closed (entregue 2026-06-12)

## Por que
O Plano Estratégico gerado pelo Estrategista vinha "incompleto" mesmo após a Onda G:
- não criava ações para campanhas ativas em queda;
- não declarava `funnel_budget_state` no payload final;
- não declarava `audience_exclusions`, `campaign_intent`, `audience_budget_fit`;
- usava `campaign_type` em formato textual antigo (TOF/Remarketing/Teste).

Causa raiz: os blocos da Onda G eram apenas **instrução de prompt**. A IA podia ignorar. Agora viraram **contrato obrigatório validado fora do LLM**.

## O que mudou (somente camada técnica — sem mudar UI/negócio)

### Strategy Preflight Builder (determinístico, sem IA)
- Reúne em um único objeto: `funnel_budget_state`, `active_campaigns_summary` (com `must_be_addressed_in_plan`), `product_identifications`, `customer_audience`, `catalog_availability`, `audience_budget_fits`.
- Cálculo de tendência ROAS 7d vs 30d para classificar atenção (`ok | watch | act_now`).
- Persistido no `context` do Estrategista por conta de anúncios.

### Contrato do Plano Estratégico (fail-closed)
- Roda **depois** do LLM, **antes** de salvar como `pending_approval`.
- Valida campos obrigatórios e regras:
  - `funnel_budget_state` presente;
  - `active_campaigns_summary` presente;
  - cada ação com `campaign_type` em valor canônico (`prospecting | retargeting | catalog_prospecting | catalog_retargeting | testing`);
  - cada ação com `campaign_intent` válido (`acquisition | retention | creative_test | offer_test | scale | reactivation`);
  - prospecção/aquisição com `audience_exclusions.customers=true` quando público de Clientes detectado, ou `pending_dependency='customer_audience_missing'`;
  - catálogo com `creative_mode='dynamic'` + `product_catalog_id` + `product_set` (ou `pending_dependency='catalog_not_connected'`);
  - ações de orçamento com `audience_budget_fit` (incluindo `insufficient_data` quando aplicável);
  - orçamento sequencial: criar/escalar não pode exceder o livre, salvo `budget_source='released_by_previous_action'`;
  - pausa proibida em campanhas com produto identificado em confiança `low`/`unknown`;
  - campanhas ativas com `must_be_addressed_in_plan=true` precisam aparecer no plano ou ter `explicit_non_action_reasons[campaign_id]` com justificativa.
- Resultado anexado ao `action.action_data.contract` com `ok`, `errors[]`, `blockers_count`.

### Bloqueio de aprovação
- **UI:** modal do Plano Estratégico mostra banner "Plano incompleto — precisa ser regenerado ou ajustado" com lista de pendências, e desabilita o botão "Aprovar plano".
- **Servidor:** o executor de aprovação devolve `success:false` com `error_pt` em PT-BR antes de marcar o plano como aprovado ou disparar geração de filhas.

### Plano antigo
- Permanece visível para recusar ou usar como referência. Não é aprovável. Não gera filhas. Não é regenerado automaticamente.

## Testes
- `src/test/ads-strategic-plan-preflight.test.ts` — 5 testes (orçamento por funil, atenção em queda, identificação por slug, pending_dependency, fit lite).
- `src/test/ads-strategic-plan-contract.test.ts` — 10 testes (aprovação válida + 9 cenários de invalidação cobrindo todas as regras críticas).
- Suítes Onda G originais (18 testes) seguem 100% verdes.

## Como validar (usuário)
1. No tenant Respeite o Homem, recusar o plano atual.
2. Rodar nova análise inicial.
3. Conferir que o novo plano:
   - se vier completo, aparece "Aprovar plano" habilitado e seção "Orçamento por Funil" preenchida;
   - se vier incompleto, aparece banner vermelho "Plano incompleto" listando pendências e botão "Aprovar plano" desabilitado.

## O que NÃO foi feito (proposital)
- Não publica campanha, não chama Meta para mutação, não consome crédito de criativo, não cria cron novo, não chama IA para "consertar" o plano atual, não migra plano antigo para válido.

---

# Onda G.2 — Exclusão obrigatória de clientes em público frio/prospecção (entregue 2026-06-12)

## Status
✅ Implementado em modo fail-closed. Aguardando validação operacional com nova análise no tenant Respeite o Homem.

## Diagnóstico fechado
- Havia mais de um caminho capaz de gravar `strategic_plan` fora do contrato canônico.
- O Strategist já validava contrato, mas ainda faltava uma blindagem única com **status técnico não-aprovável** e fechamento explícito dos caminhos legados.
- O plano real problemático ainda aparecia em formato legado (`campaign_type='TOF'`, `funnel_stage='tof'`, sem `audience_exclusions` estruturado).

## O que foi entregue

### G.2.1 — Guard canônico obrigatório
- Nova função única de entrada: `normalizeAndValidateStrategicPlanForApproval(plan, preflight)`.
- Ordem obrigatória: `Preflight → normalização canônica → validação de contrato → persistência`.
- Resultado define `approval_status: pending_approval | incomplete`.

### G.2.2 — Normalização de legado para payload canônico
- Identifica frio/prospecção por `campaign_type`, `campaign_intent`, `funnel_stage`, labels legadas e sinais de audiência (`broad`, `lookalike`, `Homens 30-65, Brasil`, aquisição, novos clientes).
- Converte `TOF`/legado para:
  - `campaign_type='prospecting'`
  - `campaign_intent='acquisition'`
  - `funnel_stage='tof'`
  - `affected_funnel='cold'`

### G.2.3 — Exclusão obrigatória de clientes
- Se o público de clientes existe no preflight, injeta `audience_exclusions.customers=true` + metadata do público.
- Se não existe, injeta `pending_dependency='customer_audience_not_detected'` e marca o plano como `incomplete`.
- Prospecção pura nunca segue aprovável sem exclusão ou pendência explícita.

### G.2.4 — Fail-closed de aprovação
- `ads-autopilot-execute-approved` recusa plano `incomplete` ou com `contract.ok=false`.
- Não aprova, não gera filhas, não publica, não chama Meta.

### G.2.5 — Fechamento dos caminhos legados
- `ads-autopilot-strategist`: agora persiste plano como `pending_approval` ou `incomplete` conforme o guard.
- `ads-chat-v2`: caminho legado de criação direta de plano agora salva sempre como `incomplete`.
- `ads-chat` legado: mantido apenas como artefato observacional (`executed`), fora da fila aprovável.

### G.2.6 — UI alinhada à fonte canônica
- Card de aprovação mostra badge **Plano incompleto**.
- Modal do plano continua bloqueando aprovação e agora também respeita `status='incomplete'`.
- Resumo compacto, detalhe e conteúdo do plano passam a mostrar a mesma indicação canônica:
  - **Exclui clientes/compradores**; ou
  - **Pendência: público de clientes não detectado**.

## Testes e validação técnica
- Fixture de regressão adicionada para plano real legado `TOF + tof + Homens 30-65, Brasil + sem audience_exclusions`.
- Coberto cenário com público de clientes detectado e cenário sem público de clientes.
- Guard adicional no nível do adset: ação fria/prospecção só é aprovável quando cada conjunto carrega a exclusão canônica (`audience_exclusions` + `excluded_audience_ids` + `targeting.excluded_custom_audiences`) ou pendência explícita `customer_audience_not_detected`.
- Aprovação two-step agora lê a fonte canônica (`audience_exclusions` / `excluded_audience_ids`) além do metadata legado, impedindo falso negativo ou falso positivo por campo legado isolado.
- Implementação de plano aprovado preserva `planned_actions` estruturadas e não reduz mais objetos a `[object Object]`, mantendo contexto suficiente para herdar exclusões nas filhas.
- `create_adset` também injeta metadata/exclusão de clientes quando o conjunto é frio, alinhando ação pai e filha com a mesma regra operacional.
- Nenhuma publicação executada.
- Nenhuma campanha real alterada.

## Onda G.3 — Auditoria real do Plano Estratégico + fail-closed canônico (2026-06-13)

### Diagnóstico fechado
- O último plano real salvo no tenant estava em payload legado, sem metadata de validação, sem versionamento e sem exclusão de clientes por adset, apesar do contrato canônico já existir.
- A análise inicial do painel passa por um orquestrador próprio e depois dispara o estrategista no gatilho `start`; o problema não era só teste insuficiente, mas falta de blindagem no plano persistido e na aprovação real.
- Havia também risco de ação inválida sobre campanha já pausada, porque o plano não carregava snapshot canônico de status/ações permitidas no payload final aprovado.

### Ajustes aplicados
- O contrato do plano agora anexa metadata obrigatória de auditoria e versionamento: origem do fluxo, versão do schema, versão do preflight, versão do validator, versão do guard, timestamps de normalização/validação, erros e flag canônica de aprovabilidade.
- O plano estratégico passa a carregar também o snapshot canônico da conta para as campanhas existentes, incluindo status real, status efetivo e ações permitidas por campanha.
- A validação fail-closed agora reprova plano legado sem metadata, plano com ação operacional incompleta (`N/A`), plano que tenta pausar campanha já pausada e plano com ação incompatível com o status real da campanha.
- O endpoint de aprovação do plano agora recarrega o plano salvo, recompõe o contexto determinístico, revalida o contrato e só então permite aprovar e gerar filhas. Se o plano estiver incompleto, ele é travado no servidor mesmo que a UI falhe.
- A execução de conjuntos filhos Meta ganhou reforço para excluir automaticamente clientes em público frio e bloquear aprovação se o público de clientes não existir.

### Evidência da auditoria real
- Último plano auditado: `83cddf94-6422-4cd5-828a-1388f4c89f3c`.
- O payload salvo vinha sem `contract`, sem `approval_status`, sem `strategic_plan_preflight`, sem `schema_version` e sem metadata canônica — por isso o painel ainda mostrava um plano operacional em formato legado.
- Os adsets frios do plano real (`Broad` e `LAL`) estavam sem `audience_exclusions`, sem `excluded_audience_ids` e sem `targeting.excluded_custom_audiences`.

### Critério de aceite técnico desta onda
- Plano novo salvo com metadata canônica obrigatória.
- Plano legado ou incompleto não fica aprovável.
- Pausa em campanha já pausada é invalidada pelo snapshot real.
- Público frio/prospecção sem exclusão por adset fica bloqueado ou com pendência técnica explícita.
- Aprovação server-side revalida sempre; não confia só no front.
