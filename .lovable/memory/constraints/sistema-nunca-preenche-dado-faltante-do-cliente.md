---
name: Sistema nunca preenche dado faltante do cliente automaticamente
description: Falta de dado obrigatório do cliente em qualquer ponto de entrada de pedido (storefront, link, admin, marketplace) vira pendência visível, nunca preenchimento silencioso ou auto-cura posterior.
type: constraint
---

## Regra

O sistema **NUNCA** preenche, deduz ou auto-cura dado obrigatório do cliente
(nome, e-mail, telefone, CPF/CNPJ, CEP, endereço completo). Se faltar em
qualquer ponto de entrada do pedido, o pedido entra (ou é bloqueado) com a
**pendência visível** ao operador. Nenhum gatilho de banco, edge function
ou rotina de cura pode buscar o dado em outra origem para preencher silenciosamente.

## Por quê

Auto-cura silenciosa esconde problema real de checkout, marketplace ou fluxo
pós-pagamento. Em 2026-06-03, um Pedido de Venda nasceu sem telefone, foi
"curado" 3 vezes (origem, emissão da DC, gatilho de banco) e a falha estrutural
no fluxo do pedido só apareceu meses depois, em produção. A política nova é:
falha visível, sempre.

## Como aplicar

1. **Checkout do storefront e link de checkout**: `checkout-create-order` valida
   no backend as 10 regras (nome completo, e-mail, telefone 10–13 dígitos com DDD,
   CPF 11 dígitos com DV, CEP 8 dígitos, logradouro, número, bairro, município,
   UF brasileira). Rejeita com `INVALID_CUSTOMER_OR_SHIPSPING` e mensagem PT-BR.
2. **Pedido manual no admin**: mesmas validações da UI, espelhadas no backend
   (Manual Order = Checkout Pipeline). Se algum campo opcional da UI virar
   obrigatório, é decisão de UX e exige aprovação explícita.
3. **Adaptadores de marketplace (Meli, Shopee, TikTok)**: quando a origem não
   traz CPF/endereço completo, o pedido entra com **status de pendência visível**,
   nunca como `approved` com campo vazio que estoura depois no fiscal/logístico.
4. **Pedido → Pedido de Venda fiscal**: propagação ocorre **apenas na criação**.
   Sem auto-cura na emissão da DC, sem gatilho de banco. Pré-flight bloqueia
   com mensagem clara em PT-BR.
5. **Banco passivo**: nenhum trigger pode buscar dado em outra tabela para
   preencher coluna nula de pedido/PV.

## Anti-regressão

- Qualquer PR que adicione "fallback de dado do cliente buscando em outra origem"
  deve ser rejeitado. O caminho correto é **bloquear com pendência visível**.
- Pré-flight fiscal/logístico (`mem://constraints/preflight-fiscal-logistico-portao-unico`)
  é o portão final; o backend defensivo do `checkout-create-order` é o portão de entrada.
- Auditoria periódica: simular POST direto ao `checkout-create-order` sem telefone/
  CPF/endereço → tem que voltar 200 com `success:false` e código
  `INVALID_CUSTOMER_OR_SHIPPING`.
