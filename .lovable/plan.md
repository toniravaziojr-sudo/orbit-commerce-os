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
