---
name: PV Cancellation Must Mirror Order
description: Pedido de Venda Fiscal (raiz) só pode ficar marcado como cancelado quando o pedido original (orders.status) também estiver em estado terminal/regressivo. Trava em DB via trigger trg_guard_pv_cancellation.
type: constraint
---

# Pedido de Venda — cancelamento espelhado obrigatório

## Regra

Um Pedido de Venda (`fiscal_invoices.source_order_invoice_id IS NULL`) **só pode** receber `pedido_status='cancelado'` ou `cancelled_at` populado quando o pedido original (`orders.status`) estiver em um destes estados:

`cancelled`, `cancelled_by_user`, `payment_expired`, `invoice_cancelled`, `chargeback_lost`, `returned`, `returning`.

Qualquer tentativa de cancelar um PV cuja origem ainda esteja ativa (`approved`, `ready_to_invoice`, `invoice_authorized`, `dispatched`, etc.) é bloqueada pelo trigger `trg_guard_pv_cancellation` com erro `check_violation`.

## Por que

PV é espelho vivo do pedido original (ver `mem://constraints/pv-pedido-status-mirror-from-order`). Se a UI ou um script ad-hoc marcar o PV como cancelado sem cancelar o pedido, o módulo Fiscal mostra "Cancelado" e o módulo Pedidos mostra "Aprovado" — divergência permanente e perda de NFs a emitir. Foi exatamente o que aconteceu em 19/05/2026 no tenant Respeite o Homem (PVs nº 52 e 180).

## Como cancelar corretamente

1. Cancelar o **pedido** via `core-orders.update_status` ou `set_payment_status='cancelled'` (cascateia para `cancelled_by_user`).
2. O trigger `trg_orders_sync_pv_status` propaga automaticamente o cancelamento para o PV.
3. NFs filhas (`source_order_invoice_id IS NOT NULL`) continuam podendo ser canceladas individualmente via `fiscal-cancel` — não são afetadas por esta trava.

## Anti-regressão

- NUNCA remover o trigger `trg_guard_pv_cancellation` sem antes garantir outra trava equivalente.
- NUNCA permitir UI que atue diretamente em `fiscal_invoices.cancelled_at` de PV — toda ação de cancelamento deve passar pelo módulo Pedidos.
- Auditoria recomendada após qualquer migração que toque `fiscal_invoices`: `SELECT count(*) FROM fiscal_invoices fi JOIN orders o ON o.id=fi.order_id WHERE fi.source_order_invoice_id IS NULL AND fi.pedido_status='cancelado' AND o.status NOT IN (<estados terminais>)` — deve retornar 0.

## Arquivos

- Migration: `supabase/migrations/*guard_pv_cancellation*.sql`
- Função: `public.guard_pv_cancellation_mirrors_order()`
- Doc formal: `docs/especificacoes/ecommerce/pedidos.md` §8.2
