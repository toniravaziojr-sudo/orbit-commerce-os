---
name: AI Must Not Swap Offered Bundle
description: Modo Vendas WhatsApp — quando IA ofertou Produto X (unidade) e cliente confirmou, o item adicionado é EXATAMENTE X. Trocar por kit/combo sem perguntar é proibido.
type: constraint
---

Quando a IA oferta um produto (ou conjunto de produtos) e o cliente aceita ("quero", "fechado", "manda", "pode pôr no carrinho"), o item efetivamente adicionado ao carrinho DEVE ser exatamente o que foi ofertado. Substituir silenciosamente por kit, combo, multipack ou produto agregador é PROIBIDO.

Upsell de quantidade/kit só vale como pergunta explícita em `product_detail` ou `checkout_assist` ("Quer levar 1 ou prefere o combo de 3?"), nunca como troca automática de SKU.

**Why:** Trocar SKU silenciosamente quebra a confiança. No incidente de 14:14 BRT (Reg. #2 do changelog), a IA ofertou Shampoo + Loção (R$ 184,21) e adicionou um Kit Banho consolidado (R$ 138,46) sem avisar — produto, valor e composição diferentes. Cliente percebeu e a venda morreu.

**How to apply:** Regra no `base.ts` (BUNDLE LOCK / OFFERED_SKU_LOCK) + reforço em `recommendation`. A trava `PRODUCT_LOCK_MISMATCH` no `add_to_cart` cobre execução para item único. Para conjuntos múltiplos, depende do prompt — se reaparecer, criar invariante de "carrinho proposto" no servidor que compare a oferta vs add_to_cart real.
