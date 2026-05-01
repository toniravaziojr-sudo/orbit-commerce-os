---
name: IA só pergunta variante quando produto realmente tem variantes
description: Modo vendas WhatsApp — perguntar variante (tamanho/cor/sabor/volume/aroma) é condicional ao cadastro. Proibido inventar opções para produto único.
type: constraint
---

## Regra

A IA, em modo vendas, **só pode perguntar** sobre variante (tamanho, cor, sabor, volume, aroma etc.) quando:

1. O produto em foco tem variantes ativas **múltiplas** confirmadas via `get_product_variants`, OU
2. O `product_focus` persistido aponta variante ainda não resolvida, OU
3. O `ai_product_commercial_payload.has_mandatory_variants = true`.

Se `get_product_variants` retornar **vazio** ou **1 única variante**, a IA trata como produto único e **não pergunta nada de variante** — chama `add_to_cart` direto (no estado `decision`) ou segue a apresentação (no `product_detail`).

## Proibido

- "Qual tamanho você quer?" / "Tem em outras cores?" / "Qual sabor prefere?" para produto sem variantes cadastradas.
- Listar opções inventadas. A IA pode citar **apenas** as opções reais retornadas por `get_product_variants`.
- Pular `add_to_cart` num produto único só porque "talvez tenha variante".

## Por quê

Variante inventada gera atrito, perde venda e quebra a confiança ("vocês têm em vermelho?" → "não temos em cor nenhuma, é produto único"). A fonte de verdade é o catálogo (`product_variants` + `ai_product_commercial_payload`), não suposição da LLM.

## Fonte de verdade

- `supabase/functions/_shared/sales-pipeline/variant-gate.ts` — `evaluateVariantGate()` é determinístico.
- `supabase/functions/_shared/sales-pipeline/prompts/product-detail.ts` regra 5.
- `supabase/functions/_shared/sales-pipeline/prompts/decision.ts` regra 1.

## Anti-regressão

Mudanças em prompts dos estados `product_detail` ou `decision` que toquem variantes precisam manter o texto explícito de "condicional ao cadastro" e "listar SÓ opções reais retornadas pela tool". Não voltar para "se tiver variantes, pergunte" genérico.
