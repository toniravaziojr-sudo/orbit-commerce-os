---
name: checkout-must-auto-add-on-empty-cart-with-focus
description: Quando generate_checkout_link encontra cart vazio mas a sales state tem exatamente 1 produto apresentado e ele não tem variantes mandatórias, auto-popular o cart com qty=1 antes de gerar o link. Salva-vidas determinístico contra paralisia da LLM em variações.
type: constraint
---

Em `supabase/functions/ai-support-chat/index.ts`, no handler `generate_checkout_link`, é OBRIGATÓRIO tentar auto-popular o `whatsapp_carts` antes de retornar `"Carrinho vazio"` quando:

1. `whatsapp_carts.items` está vazio/inexistente para a conversa, **E**
2. `conversation_sales_state.presented_product_ids` tem exatamente **1 elemento**, **E**
3. O produto referenciado está `status='active'` e `has_variants=false`.

Nesse caso, inserir item com `quantity=1`, `unit_price=products.price`, sem variante, e prosseguir com a geração normal do link. Logar `[Reg #2.15] auto_add_on_empty_cart product_id=… name="…" reason=single_presented_product`. Se algum critério falhar, logar `auto_add_skipped reason=…` e cair no `"Carrinho vazio"` original.

**Por quê:** descoberto na Reg #2.15 (conversa `60ad78cd-…`). A LLM apresentou 4 variações de quantidade do Balm (Solo, 2x, 3x, 6x) e ficou paralisada sem escolher uma. Quando o cliente disse "Pode mandar o link" duas vezes seguidas, a state machine forçou `checkout_assist`, a tool `generate_checkout_link` foi chamada, mas o cart estava vazio → tool retornou erro → LLM caiu em loop "Confirma que eu já gero o link?". O gate `enforceCheckoutUrlInText` (Reg #2.11) corretamente não injetou nada porque não havia URL para injetar. Resultado: venda perdida silenciosamente.

**Como aplicar:**
- Auto-add SÓ acontece quando há **exatamente 1** produto apresentado. Com 2+ produtos é ambíguo — a IA precisa pedir esclarecimento.
- Auto-add NÃO contorna o gate de variantes mandatórias (`has_variants=true`). Esses produtos exigem `add_to_cart` explícito com `variant_id` para passar pelo `evaluateVariantGate`.
- O log `[Reg #2.15] auto_add_*` é mandatório para rastreabilidade.

**Sinal de regressão:**
- Logs do `generate_checkout_link` retornando `"Carrinho vazio"` em conversas onde `conversation_sales_state.presented_product_ids` tem 1 produto sem variantes.
- Mensagem persistida em `messages` pedindo "Confirma que eu já gero o link?" quando `state_transition_reason=checkout_link_generated`.

**Não fazer:**
- Auto-add com `quantity > 1` ou variante "padrão" inferida — sempre 1 unidade do produto base.
- Estender auto-add para `presented_product_ids.length > 1` ("primeiro da lista"). Quebra a previsibilidade da venda.

Reg #2.15 — 2026-05-01.
