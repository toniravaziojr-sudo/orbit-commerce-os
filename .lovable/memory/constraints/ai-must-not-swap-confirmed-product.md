---
name: IA não pode trocar produto após confirmação do cliente
description: Em sales mode, add_to_cart bloqueia adição de product_id diferente do productFocus ativo quando o turno do cliente não contém sinal explícito de troca. Resolver desempata por focusProductId e quantificador (1x/2x/3x/6x).
type: constraint
---

## Regra

No `ai-support-chat`, em qualquer estado de sales mode, ao executar `add_to_cart`:

1. Se `ctx.productFocus.product_id` está setado E o `product_id` resolvido pela tool é DIFERENTE E o turno do cliente NÃO contém sinal de troca (`troca|trocar|outro|outra|prefiro|esquece|mudar|na verdade|mudei de ideia|não quero (mais|esse)`), o servidor retorna `success:false` com `error="PRODUCT_LOCK_MISMATCH"` e instrui a IA a usar o id em foco OU pedir reconfirmação ("Você quer fechar com X mesmo, ou trocou de ideia?").

2. O `resolveProductReference` aceita opções `{ focusProductId, quantityHint }` e desempata múltiplos hits da mesma família por:
   - (a) match com `focusProductId`
   - (b) quantificador no termo (`Calvície Zero 3x` → escolhe pack 3x)
   - (c) `quantityHint` da tool call vs quantificador no nome do candidato

## Por quê

Caso real (4db96ce3-1a60-4c27-90e1-3e7f9dc08a65): IA confirmou "Kit Shampoo Calvície Zero 3x", cliente disse "manda o link", e a IA adicionou Kit Preventive Power 3x. Resolver retornava ambíguo, IA adivinhava errado, foco era ignorado no add_to_cart. Anti-padrão: cliente recebe checkout com produto trocado.

## Como aplicar

- Local: `supabase/functions/ai-support-chat/index.ts` case `add_to_cart` + `supabase/functions/_shared/sales-pipeline/product-resolver.ts`.
- A trava só é desbloqueada por sinal explícito de troca do cliente NO TURNO ATUAL — não por mensagem antiga.
- Se a IA insistir e bater PRODUCT_LOCK_MISMATCH 2x no mesmo turno, ela já tem na resposta da tool a frase pronta de reconfirmação para mandar ao cliente.
