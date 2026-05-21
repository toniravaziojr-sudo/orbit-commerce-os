---
name: customers.person_type é minúsculo
description: Cadastro de clientes só aceita 'pf' ou 'pj' em minúsculo. Qualquer fluxo que insira cliente deve respeitar esse formato, senão o banco recusa o registro.
type: constraint
---

## Regra
A coluna `public.customers.person_type` tem CHECK constraint `person_type IN ('pf','pj')` (minúsculo). Qualquer insert/update vindo de UI, edge function ou importador deve normalizar para minúsculo antes de gravar.

## Por quê
Em 2026-05-21 o botão "Salvar cliente na base" do Pedido de Venda manual (`ManualInvoiceDialog.buildCustomerPayloadFromForm`) enviava `'PF'`/`'PJ'` em maiúsculo. Resultado: 100% das tentativas falhavam silenciosamente com erro de constraint, sem nunca criar o cliente. Bug descoberto em teste end-to-end no tenant Respeite o Homem.

A tabela `suppliers` usa enum `supplier_person_type` ('PF'/'PJ' maiúsculo) — formatos divergem entre as duas bases. Não confundir.

## Como aplicar
- Toda nova UI ou edge function que insira em `customers` deve mandar `'pf'` ou `'pj'`.
- Toda nova UI ou edge function que insira em `suppliers` deve mandar `'PF'` ou `'PJ'`.
- Em fluxos que espelham/copiam dados de cliente para fornecedor (ou vice-versa), converter explicitamente o case.
- Reforço da memória `db-check-vs-ui-enum-alignment`: validar com INSERT real antes de declarar correção entregue.
