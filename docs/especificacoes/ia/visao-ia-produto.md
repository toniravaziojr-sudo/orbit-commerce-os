# Visão da IA do Produto — Onda 1B

**Status:** Entregue (estrutura de dados + UI editável). Runtime da IA ainda não consome.

## Fonte oficial

| Camada | Tabela | Responsabilidade |
|---|---|---|
| Operacional | `products` | Dados de loja: preço, estoque, dimensões, status. **Não duplica** inteligência comercial. |
| Inteligência da IA | `ai_product_commercial_payload` | Papel comercial, tipo, base relacionado, "quando recomendar/não recomendar". |
| Composição real | `product_components` | Composição de kit/combo. **Única fonte** para isso. |
| Relações entre produtos | `ai_product_relations` | Complementares, related_base, upsell, cross-sell. N:N com integridade referencial. |

`products` **nunca** recebe colunas de inteligência comercial.

## Schema

### Colunas adicionadas em `ai_product_commercial_payload`
- `base_product_id uuid` — FK para `products`. Usado em packs e variações derivadas.
- `is_base_candidate boolean NULL` — Se pode aparecer como base na recomendação inicial. **NULL = não classificado**, `true` = base puro, `false` = pack/kit/complemento.
- `when_to_recommend text` (≤600 chars).
- `recommendation_notes text` (≤1000 chars).

CHECKs: `base_product_id <> product_id`. Trigger cross-tenant valida que `base_product_id` pertence ao mesmo tenant.

### Tabela `ai_product_relations`
Campos: `tenant_id`, `source_product_id`, `target_product_id`, `relation_type` (`complement|related_base|upsell|cross_sell`), `position`, `source`, `confidence_score`, `manual_override`.

UNIQUE: `(tenant_id, source, target, relation_type)`. CHECK self-reference. Trigger cross-tenant nos dois produtos. RLS por `belongs_to_tenant`.

## Quando usar o quê

| Caso | Onde registrar |
|---|---|
| Balm 2x → Balm 1x | `base_product_id` no payload do Balm 2x |
| Shampoo combina com Balm | `ai_product_relations` (`complement`) |
| Kit Banho = Shampoo + Balm + Loção | `product_components` (composição real) |
| Acessório combina com produto-base | `ai_product_relations` (`complement`) |

## UI

Nova aba "Visão IA" em `ProductForm.tsx` (somente em modo edição). Componente: `src/components/products/ai-vision/ProductAIVisionSection.tsx`.

Hook unificado: `src/hooks/useProductAIVision.ts` — leitura/escrita atômica de payload + relations. Salvar marca `source='manual'` e `has_manual_overrides=true` para proteger override humano contra cron de inferência futura.

## Obrigatoriedade
- Produto novo/antigo: **não bloqueia salvamento**. Mostra alerta se faltar visão.
- Pack: exige `base_product_id` para considerar visão completa (alerta na UI, não no DB).
- Kit/combo: exige composição em `product_components` (alerta na UI).
- Importação: nunca bloqueia.

## Runtime
**Onda 1B:** sem leitura runtime.

**Onda 1C (entregue, dry_run):** três módulos `_shared` foram adicionados — `product-ai-vision-reader.ts`, `product-recommendation-context-builder.ts` e `product-ai-vision-explicit-request.ts`. São acionados em `ai-support-chat` dentro do handler de `search_products`, **somente quando** `ai_support_config.metadata.arch1c_recommendation_context_builder_enabled=true` e `arch1c_recommendation_context_builder_mode='dry_run'`. Em dry_run o builder roda, grava 1 linha em `ai_turn_traces` (`stage='arch1c_dry_run'`), mas **não altera shape, ranking, payload, family_shipping_summary nem a resposta enviada ao cliente**. Modo `active` continua **bloqueado** até validação suficiente.

### Hardening da Onda 1C (dry_run)

- **explicit_request (obrigatório antes de active):** detector determinístico em `product-ai-vision-explicit-request.ts`. Marca produto como `explicit_request` quando: SKU literal aparece como token isolado no texto; nome "core" (sem parênteses/sufixos) está contido no texto; nome core + padrão `Nx` (`2x`, `3x`, `6x`, `12x`) batem com a variação específica; ou `kit/combo/completo` + nome do kit. Item marcado é preservado mesmo sendo pack/kit (não cai em `pack_capped`).
- **pack_orphan_in_pool (gap conhecido):** ocorria quando `search_products` cortava o produto-base pelo `POOL_LIMIT` mas trazia os packs. Era resolvido como `no_classifiable_products`.
- **base_hydrated_from_pack (defesa em dry_run):** `hydrateMissingPackBases` lê os `base_product_id` referenciados pelos packs do pool, busca esses produtos-base **tenant-scoped** (≤3 hidratações por turno, batched, sem N+1) e os adiciona ao bundle. O builder então monta a base e agrupa o pack sob ela. Warning `base_hydrated_from_pack` é registrado por base hidratada; bases que não puderam ser resolvidas (não existem, soft-deleted, archived ou cross-tenant) recebem `pack_orphan_unresolved`.

### Catálogo de kits do tenant Respeite o Homem (referência)

- Kits **Dia** = Shampoo + Balm.
- Kits **Noite** = Shampoo + Loção.
- Kits **FLEX** ou sem sufixo = Shampoo + Balm + Loção.

Composição é fonte de verdade em `product_components`. `ai_product_relations` nunca é usado para composição física.

Regras determinísticas, limites de payload, NULL legacy, pedido explícito e contrato anti-regressão estão consolidados em `mem://features/ai/recommendation-context-builder-v1`.

## Checklist da IA
Item "Packs sem produto-base" passa a ser real e navegável (`/produtos`).
