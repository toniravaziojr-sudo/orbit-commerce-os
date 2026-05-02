---
name: IA Vendas — proibido pedir CEP/CPF/email/forma de pagamento via WhatsApp
description: Esses dados são preenchidos na página de checkout. Gate enforceNoCheckoutDataAsk força regeneração com tool_choice.
type: constraint
---

Em `supabase/functions/_shared/sales-pipeline/output-gates.ts`, o gate `enforceNoCheckoutDataAsk` detecta na resposta da IA pedidos de dados que pertencem à página de checkout (CEP, CPF, e-mail, endereço, forma de pagamento, "pix ou cartão", "como prefere pagar"). Roda nos estados `recommendation|decision|checkout_assist|product_detail` quando `generate_checkout_link` está disponível na lista de tools.

Quando dispara, o handler marca `closeLoopDetected=true`, que herda em `semanticDuplicateDetected=true` e força regeneração com `tool_choice = generate_checkout_link`. NÃO reescreve texto.

**Por quê:** Reg #9 (02/mai/2026). O prompt já instruía a NÃO pedir esses dados (linha 4196 do handler), mas a IA ignorava em latência alta. Defesa determinística é a única solução estável. CEP/CPF/email/endereço são preenchidos pelo cliente NA PÁGINA de checkout via Lovable Cloud; forma de pagamento é escolhida no próprio checkout multi-gateway.

**Sinal de regressão:** mensagem outbound contendo `qual o seu CEP`, `me passa o CPF`, `pix ou cartão?`, etc., em conversas em modo vendas.
