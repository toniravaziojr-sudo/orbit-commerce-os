---
name: AI Must Not Mention Price Unsolicited
description: Modo Vendas WhatsApp — preço/valor/frete só aparecem com pergunta direta do cliente, em product_detail (foco) ou em checkout_assist (fechamento).
type: constraint
---

Em `discovery`, `recommendation` e `greeting`, a IA NÃO PODE mencionar preço, "R$", valor monetário, desconto, frete grátis ou frete EXCETO se o cliente perguntou explicitamente. Preço entra naturalmente em `product_detail` (cliente focou num item) e em `checkout_assist` (fechamento).

**Why:** Citar preço sem ser perguntado em momento de descoberta/recomendação soa "vendedor empurrando" e queima a venda. Conversa real começa pela necessidade, preço aparece quando faz sentido.

**How to apply:** A regra está no `base.ts` (PRICE-ON-DEMAND) e reforçada nos prompts de `discovery` e `recommendation`. Qualquer novo prompt de estado pré-detalhe deve herdar a regra; se reaparecer no canal real, considerar scrubber server-side.
