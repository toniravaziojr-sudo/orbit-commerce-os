---
name: Recommendation Context Builder v1 — dry_run não muta runtime
description: Onda 1C — ProductAIVisionReader + ProductRecommendationContextBuilder. Em dry_run apenas grava trace em ai_turn_traces (stage='arch1c_dry_run'). Pack nunca substitui base, kit só via product_components, pedido explícito vence agrupamento, NULL em is_base_candidate é legado/não classificado.
type: constraint
---

## Regra
A leitura runtime da Visão da IA do Produto (Onda 1B) é feita por dois módulos compartilhados em `supabase/functions/_shared/`:

- `product-ai-vision-reader.ts` — leitura tenant-scoped batched (3 SELECTs, sem N+1) de `ai_product_commercial_payload`, `ai_product_relations` e `product_components`. Nunca confia em IDs vindos do cliente.
- `product-recommendation-context-builder.ts` — função pura, sem LLM/RAG, que aplica regras determinísticas e devolve `{ bases, packs_by_base, kits, complements, hidden, warnings, proposed_payload_count }`.

Acionado em `ai-support-chat/index.ts` dentro do handler de `search_products`, **somente** quando:
- `ai_support_config.metadata.arch1c_recommendation_context_builder_enabled === true` **E**
- `ai_support_config.metadata.arch1c_recommendation_context_builder_mode === 'dry_run'`.

## Modo dry_run
- NÃO altera `filtered`, `finalList` nem o shape devolvido pela tool.
- NÃO altera ranking real, payload efetivo ao modelo, family_shipping_summary nem resposta enviada ao cliente.
- Apenas grava 1 linha em `ai_turn_traces` com `stage='arch1c_dry_run'` contendo `original_product_ids` e `proposed`.
- Falha do trace é silenciosa (warn + segue): runtime nunca quebra por causa do dry_run.

## Modo active
**Não está implementado nesta entrega.** Quando for, exige nova memória e atualização do compiler.

## Regras determinísticas (proposed)
- Bases: apenas `is_base_candidate === true` (ou pedido explícito ou legado quando NULL).
- Pack (`product_kind in ('pack','bundle')` ou `is_base_candidate=false` com `base_product_id`): agrupado sob `base_product_id`. NUNCA substitui a base em recomendação genérica.
- Kit (`product_kind in ('kit','combo')` OU ≥2 components distintos em `product_components`): composição vem **exclusivamente** de `product_components`. `ai_product_relations` nunca é usado para composição física.
- Kit só vira "primário" (reason `kit_intent`) quando o texto do turno contém `kit|combo|completo|tratamento completo|economia`.
- Complementares: `ai_product_relations` (`complement|cross_sell|upsell`). `related_base` é informativo e NÃO entra no contexto.
- Pedido explícito (`explicitRequestProductIds`): produto pedido nominalmente vai pro topo (`reason='explicit_request'`) e NUNCA é ocultado por ser pack/kit.
- `is_base_candidate === null` ou produto sem linha em payload: registra warning `unclassified_product` e entra como `unclassified_legacy` (NÃO rebaixa agressivamente).

## Limites de payload proposto
- ≤ 3 bases · ≤ 2 packs por base · ≤ 1 kit · ≤ 3 complementares.
- Cap global `MAX_TOTAL=8`; complementares são cortados primeiro se exceder.
- Builder síncrono, alvo < 50 ms (validado em teste).

## Multi-tenant
- Reader sempre filtra `.eq('tenant_id', tenantId)`. Defesa em profundidade descarta linhas com `tenant_id` divergente.
- `ai_product_relations` já tem trigger cross-tenant (Onda 1B). `product_components` herda tenant via parent.

## Onde está
- Reader + hidratação pack_orphan: `supabase/functions/_shared/product-ai-vision-reader.ts` (`loadProductAIVision` + `hydrateMissingPackBases`).
- Builder: `supabase/functions/_shared/product-recommendation-context-builder.ts`.
- Detector explicit_request: `supabase/functions/_shared/product-ai-vision-explicit-request.ts`.
- Testes A–J: `supabase/functions/_shared/__tests__/product-recommendation-context-builder.test.ts`.
- Integração dry_run: `supabase/functions/ai-support-chat/index.ts` (search_products, após `partitionAndLimit`).
- Flag inicial: tenant Respeite o Homem (`d1a4d0ed-8842-495e-b741-540a9a345b25`).

## Hardening dry_run (obrigatório antes de active)
- **explicit_request**: detector determinístico SKU/nome-core/Nx/kit. Item explícito nunca cai em `pack_capped`/`kit_capped`/`pack_orphan_in_pool`. Os matches vão no trace (`explicit_matches`).
- **base_hydrated_from_pack**: quando o pool tem pack mas a base ficou fora do `POOL_LIMIT`, o reader hidrata a base via `products` (tenant-scoped, ≤3 hidratações, batched). Warning `base_hydrated_from_pack` por base hidratada e `pack_orphan_unresolved` quando a base não existe/é cross-tenant/soft-deleted.

## Anti-regressão
- PR que faça `dry_run` mutar `filtered`/`finalList`/shape devolvido → bloqueado.
- PR que use `ai_product_relations` para compor kit (em vez de `product_components`) → bloqueado.
- PR que rebaixe `is_base_candidate IS NULL` como `false` → bloqueado.
- Builder consultando banco diretamente → bloqueado (caller carrega via Reader/hidratação).
- Hidratação cross-tenant ou >3 bases por turno → bloqueado.
- Promover para `active` sem snapshot test G+H validando paridade com dry_run → bloqueado.
