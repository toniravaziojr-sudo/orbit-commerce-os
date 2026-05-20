---
name: PV Status Mirrors Child NF
description: Pedido de Venda Fiscal espelha o ciclo das NFs filhas via gatilho fiscal_invoices_sync_pv_status — vale também para PVs manuais/duplicados sem order_id. Status oficial "nf_criada".
type: constraint
---

# Pedido de Venda — espelho das NFs filhas

## Regra

`fiscal_invoices.pedido_status` reflete o ciclo de vida das NFs filhas (ligadas por `source_order_invoice_id`) **para qualquer origem de PV** — manual, duplicado ou vindo de `order_id`.

Estados oficiais (7): `em_aberto`, `pendente`, `nf_criada`, `concluido`, `cancelado`, `chargeback_em_andamento`, `chargeback_perdido`.

Transições derivadas (após precedências terminais do pedido original):

- Existe NF filha **autorizada** → `concluido`.
- Existe NF filha em `draft|ready|pending|rejected` (não cancelada) → `nf_criada`.
- Nenhuma NF filha ativa → `em_aberto` (ou `pendente` se houver pendência fiscal local).

## Como é mantido

- Cálculo central: `public.derive_pv_pedido_status(...)` com parâmetro `p_has_active_nf`.
- Gatilho `fiscal_invoices_sync_pv_status` (AFTER INSERT OR UPDATE OR DELETE) chama:
  - `sync_pedido_status_for_order(order_id)` quando o PV tem pedido original; ou
  - `recompute_pv_pedido_status(pv_id)` quando o PV é manual/duplicado sem `order_id`.
- DELETE de NF filha é tratado — quando todas as filhas somem, o PV volta para `em_aberto`/`pendente`.

## Anti-regressão

- NUNCA remover o branch DELETE do trigger — quebra retorno automático para "Em aberto" quando todas as NFs são excluídas.
- NUNCA recalcular `pedido_status` apenas pelo `order_id` — PVs manuais/duplicados não têm `order_id` e ficariam congelados.
- Duplicar um PV **não copia** o vínculo de NF (não copiar `source_order_invoice_id` apontando para ele; a duplicação nasce sem filhas).
- Ordenação da lista fiscal exige desempate firme (`created_at desc, id desc`) — proibido ordenar apenas por data.
- Exclusão de NF na UI nunca pode reportar "Nota excluída" sem checar `count` do delete — exclusão silenciosa por filtro escondido é proibida.

## Arquivos

- Migration: `supabase/migrations/*nf_criada*sync*pv*` (2026-05-20).
- Função SQL: `public.derive_pv_pedido_status(...)`, `public.recompute_pv_pedido_status(uuid)`, `public.sync_pedido_status_for_order(uuid)`, `public.trg_nf_sync_pv_status()`.
- UI fonte única: `src/lib/fiscal/pedidoStatus.ts` (`PEDIDO_STATUS_CONFIG`, `PEDIDO_STATUS_OPTIONS`).
- Doc formal: `docs/especificacoes/erp/erp-fiscal.md` §"Status visual do Pedido de Venda".
