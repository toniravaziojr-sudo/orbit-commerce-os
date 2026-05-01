---
name: Checkout Trigger Must Not Deadlock on State
description: FIX-B (tool_choice=generate_checkout_link) precisa ser elegível em decision/recommendation/product_detail quando intenção explícita + carrinho pronto; exigir checkout_assist cria deadlock.
type: constraint
---

## Regra

No `ai-support-chat`, o gate FIX-B que força `tool_choice = generate_checkout_link` NÃO PODE exigir `pipelineState === "checkout_assist"` como pré-condição única. Deve aceitar também `decision`, `recommendation` e `product_detail` quando:

- `explicitBuyNow === true` (cliente pediu link/finalização explicitamente), E
- `checkoutChecklist.ready === true` (há item no carrinho), E
- `generate_checkout_link` está disponível na lista de tools.

## Por quê

A transição pra `checkout_assist` em `transitions.ts` só acontece DEPOIS que o link existe (`hasCheckoutLink || toolsCalled.includes("generate_checkout_link")`). Se o gate exige estar em `checkout_assist` pra forçar o link, e o link só existe pra entrar em `checkout_assist`, forma-se deadlock: a IA cai em pergunta confirmatória ("posso finalizar?"), o Eixo 1.7 detecta loop e força handoff comercial sem nunca gerar o link. Caso real: Reg #2.10 do `ia-atendimento-changelog.md` (cliente "Manda o link" → handoff sem link).

## Como aplicar

- Local: `supabase/functions/ai-support-chat/index.ts` — bloco `[Reg #2.10] FIX-B estendido`.
- Pareado com a regex `CHECKOUT_REQUEST_PATTERNS` em `transitions.ts` que reconhece "manda/envia/gera (o) link" com ou sem "me".
- Sempre que adicionar novo estado pré-checkout, conferir se ele também é elegível.
