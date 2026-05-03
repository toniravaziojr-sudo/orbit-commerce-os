---
name: Visão da IA do Produto — Fonte Oficial
description: ai_product_commercial_payload + ai_product_relations são fonte oficial da inteligência comercial do produto. products nunca duplica papel/base/complementares. product_components mantém composição real de kit.
type: constraint
---

## Regra
A inteligência comercial do produto (papel, tipo, produto-base relacionado, complementares, quando recomendar/não recomendar) vive **exclusivamente** em:
- `ai_product_commercial_payload` — campos por produto, incluindo `commercial_role`, `product_kind`, `base_product_id`, `is_base_candidate`, `when_to_recommend`, `when_not_to_indicate`, `recommendation_notes`.
- `ai_product_relations` — relações N:N entre produtos (`complement`, `related_base`, `upsell`, `cross_sell`).

`product_components` continua sendo a **única** fonte da composição real de kits/combos. Não duplicar composição em `ai_product_relations`.

## Proibido
- Adicionar colunas comerciais em `products` (papel, base, complementares, "quando recomendar"). `products` é só dado operacional.
- Criar `product_ai_profile` ou tabelas paralelas de inteligência comercial.
- `is_base_candidate NOT NULL DEFAULT true` — produto não classificado **deve** ficar NULL.
- Cron de inferência sobrescrever payload com `has_manual_overrides=true` sem aprovação humana.

## Por quê
Mantém `products` puro/operacional, evita duplicidade e regressões cruzadas, permite override humano protegido contra inferência automática (Onda C / Approval Center).

## Fonte de verdade
- Migration: `supabase/migrations/20260503-211805*.sql`.
- Doc: `docs/especificacoes/ia/visao-ia-produto.md`.
- UI: `src/components/products/ai-vision/ProductAIVisionSection.tsx` + hook `src/hooks/useProductAIVision.ts`.

## Anti-regressão
Qualquer PR que adicione colunas em `products` para uso da IA, ou que leia inteligência comercial fora dessas tabelas, deve ser bloqueado. Runtime (search_products / sales pipeline / Orchestrator) só pode passar a ler `base_product_id` / `is_base_candidate` / `ai_product_relations` em onda futura dedicada (Context Compiler).
