---
name: PV e NF coexistem por pedido — índices únicos parciais separados
description: O modelo Bling exige que Pedido de Venda e Nota Fiscal coexistam como dois registros sobre o mesmo pedido. A anti-duplicação é feita por DOIS índices parciais separados (um por estágio), nunca por um único índice agregado em (tenant_id, order_id).
type: constraint
---

# Anti-duplicação fiscal: índices parciais por estágio

Descoberto no teste E2E de 2026-06-05: o índice único parcial agregado
`idx_fiscal_invoices_order_unique` em `(tenant_id, order_id)` bloqueava
a criação da NF quando já existia o PV do mesmo pedido, quebrando o
modelo Bling (PV e NF são dois registros distintos ligados por
`source_order_invoice_id`).

## Regra inviolável

A unicidade "um ativo por pedido" é aplicada **separadamente** em duas
camadas:

- `idx_fiscal_invoices_order_unique_pv` —
  `(tenant_id, order_id) WHERE fiscal_stage = 'pedido_venda' AND status NOT IN ('cancelled','rejected') AND order_id IS NOT NULL`
- `idx_fiscal_invoices_order_unique_nf` —
  `(tenant_id, order_id) WHERE fiscal_stage <> 'pedido_venda' AND status NOT IN ('cancelled','rejected') AND order_id IS NOT NULL`

Notas `cancelled` e `rejected` continuam não contando como ativas
(permite reemissão). Conflitos nos novos índices continuam sendo
tratados como "registro já existente" (fetch silencioso, não erro).

## O que NUNCA pode acontecer

- Recriar um índice único agregado em `(tenant_id, order_id)` sem
  filtro por `fiscal_stage` — bloqueia a criação da NF do PV.
- Tratar conflito desses índices como erro fatal (sempre fetch
  silencioso do registro existente).
- Permitir dois PVs ativos para o mesmo pedido, ou duas NFs ativas
  para o mesmo pedido.

## Doc oficial

- `docs/especificacoes/erp/erp-fiscal.md` §"Regras" item 4.
- Relacionado: `mem://constraints/fiscal-pedido-venda-vs-nf-two-records`.
