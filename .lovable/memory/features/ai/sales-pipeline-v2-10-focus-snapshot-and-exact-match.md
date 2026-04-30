---
name: Sales Pipeline v2.10 — Focus Snapshot + Exact Match (Reg #2.10)
description: Onda 4 — trava produtos canônicos por conversa e prioriza match literal de nome no search_products para eliminar drift de identidade e re-busca no closing
type: feature
---

# Reg #2.10 — Onda 4: Focus Snapshot + Exact Match

## Problema observado (conversa 09:35, ID ab3d720d)
- IA inventou "kit banho calvície zero noite" (não existe).
- Quando o cliente pediu oferta "desse kit", a IA disparou `search_products` genérico em vez de focar nos 3 itens em discussão.
- `generate_checkout_link` nunca foi chamado — caiu em handoff.
- `search_products('Loção')` devolveu **Shampoo Preventive Power** porque o ranking priorizava `pain_match` sobre similaridade textual.

## Ajustes desta onda

### 1) Exact-Match Boost no `search_products`
Em `partitionAndLimit`, o sort agora usa um score lexical antes de `pain_match`:
- 0 = nome começa com a query
- 1 = nome contém a query inteira
- 2 = todos os tokens da query aparecem
- 3 = sem match literal (cai pra pain_match como desempate)

**Resultado:** `query="Loção"` traz Loção antes de Shampoo, mesmo que o Shampoo seja `pain_match`.

### 2) Focus Snapshot persistido em `extras.focus_snapshot`
Estrutura: `{ product_ids[], names[], kit_id?, locked_at, locked_reason }`

Travamento no fim do turno (em `ai-support-chat/index.ts`, junto ao `patchSalesState`):
- **`add_to_cart`** rodou → trava nos itens efetivamente adicionados (sobrescreve qualquer focus anterior).
- **`get_product_details`** rodou e ainda não há focus → trava no produto detalhado.
- Estado avançado (decision/cart/checkout/checkout_assist) + `search_products` retornou ≤3 itens e ainda não há focus → trava nesses.

Sem migração de schema (usa coluna jsonb existente `extras`).

### 3) Working Memory Prompt — bloco "PRODUTOS EM FOCO"
`buildWorkingMemoryPromptBlock` injeta no system prompt:
- Nomes + IDs travados.
- Instrução explícita: **NÃO chame `search_products` para reabrir vitrine**.
- Para fechar: `add_to_cart` dos IDs travados + `generate_checkout_link`.

## Arquivos alterados
- `supabase/functions/_shared/sales-pipeline/working-memory.ts` — interface `FocusSnapshot`, helper `getFocusSnapshot`.
- `supabase/functions/_shared/sales-pipeline/working-memory-prompt.ts` — bloco "🔒 PRODUTOS EM FOCO".
- `supabase/functions/ai-support-chat/index.ts` — exact-match boost em `partitionAndLimit`, lock do focus snapshot pós-turno.

## Como validar nos logs
- `[Reg #2.10] focus_snapshot LOCKED reason=...` → confirma travamento.
- `[F2-V2]` ou `[Reg #2.8] catalog probe` continuam aparecendo, mas agora com sort lexical antes do pain.
- Tabela `conversation_sales_state.extras->'focus_snapshot'` deve aparecer preenchida assim que cliente avança para detalhe/carrinho.
