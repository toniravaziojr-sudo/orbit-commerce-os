---
name: Onda 18 Fase A — Catalog Probe v2 (família-base) + ai_turn_traces
description: Plug atrás de flag arch18_catalog_base_forced em ai_support_config.metadata. Bases da família detectada vêm antes de kits; kits de quantidade ficam fora da vitrine inicial; trace estruturado em ai_turn_traces (service_role only).
type: feature
---

## Regra (vinculante)

Quando `ai_support_config.metadata->'arch18_catalog_base_forced' = true` para o tenant, o `search_products` da edge `ai-support-chat` DEVE rodar `enforceFamilyBaseFirst()` após o enrichment e antes do `partitionAndLimit`, com o seguinte contrato:

1. **Detecção de família:** regex determinístico em `detectFamilyInText(lastUserMessage)` (lista FAMILY_NAME_PATTERNS reusada de `catalog-probe.ts`). "kit"/"combo" não contam como família-base.
2. **Particionamento** do pool enriquecido:
   - `bases_pain` — não-kit, mesma família detectada, `match_reason="pain_match"`.
   - `bases_outras` — não-kit, mesma família detectada, demais.
   - `kits_complementary` — `is_kit=true` E `product_components` com ≥2 component_product_ids distintos.
   - `kits_quantity` — `is_kit=true` E 1 só component_product_id (Nx do mesmo) → **EXCLUÍDO da vitrine inicial**.
3. **Ordem final:** todas as bases pain → todas as bases outras → kits complementares (até `requestedLimit`).
4. **Fail-safe:** se nenhuma base elegível for encontrada para a família detectada, devolve o pool original (não força nada).

## Trace obrigatório (6 estágios em `ai_turn_traces`)

`turn_input` → `search_products_input` → `candidate_set_raw` → `enriched_partition` → `probe_v2_decision` → `final_ranking`.

Sampling Fase A: 100% no tenant Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`). Demais tenants: flag desligada (sem trace).

`base_has_free_shipping` vai SOMENTE no trace `probe_v2_decision`. NÃO altera resposta da tool nem `family_shipping_summary` nesta fase.

## Decisões de implementação Fase A

- **Local da flag:** `ai_support_config.metadata.arch18_catalog_base_forced` (jsonb). Tabela `tenant_feature_flags` ainda não existe; quando existir, migrar.
- **NÃO escopo da Fase A:** Turn Aggregator, Policy Compiler, TPR v2, Planner, Critic Layer, Tool Executor decoupling, redução de gates antigos. Esses ficam para Fases B-J.
- **Função pura:** `enforceFamilyBaseFirst` NÃO consulta DB. Quem chama (`search_products`) resolve `kitComponentMap` via `product_components` antes.

## Reposicionamento da flag (pós-saneamento, contexto piloto único)

A IA de atendimento/vendas roda HOJE somente no tenant *Respeite o Homem* (piloto único de produção). Por isso, a flag `arch18_catalog_base_forced` deixa de ser tratada como "rollout conservador por tenant" e passa a ser **kill switch técnico**: liga por padrão em quem usa a IA, e só desliga em caso de regressão grave em produção. Próximas fases (B em diante) NÃO precisam criar novas flags de rollout por tenant — implementam diretamente no módulo, mantendo apenas kill switch técnico quando o risco estrutural justificar.

## Rollback

```sql
UPDATE ai_support_config
SET metadata = metadata - 'arch18_catalog_base_forced'
WHERE tenant_id = 'd1a4d0ed-8842-495e-b741-540a9a345b25';
```

Volta ao comportamento comercial anterior. Traces históricos permanecem em `ai_turn_traces` para auditoria.

## Anti-regressão

- Kit de quantidade (Nx do mesmo SKU) **NUNCA** pode aparecer como primeira opção em consulta genérica de família. Só após cliente demonstrar interesse de compra ou pedir economia (PRODUCT_DETAIL/CHECKOUT_ASSIST) ou `include_kits=true` explícito.
- Função pura tem 9 testes determinísticos em `_shared/sales-pipeline/__tests__/catalog-probe-v2.test.ts`. Qualquer alteração na lógica de partição/ordenação DEVE manter ou estender esses testes.
- `ai_turn_traces` é service_role-only. Não criar policy para anon/authenticated sem revisar PII.
