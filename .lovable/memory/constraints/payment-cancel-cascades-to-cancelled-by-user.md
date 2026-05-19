---
name: Payment cancel cascades to cancelled_by_user
description: Quando o lojista cancela o pagamento manualmente (set_payment_status='cancelled'), o status geral do pedido cascateia para 'cancelled_by_user', habilitando a exclusão e disparando a limpeza de rascunhos.
type: constraint
---

# Cascata de cancelamento manual de pagamento

## Regra

Ao executar `set_payment_status` com `new_status='cancelled'` na edge `core-orders`:

- Se `orders.status` estiver em qualquer fase ativa (NÃO em `cancelled`, `cancelled_by_user`, `payment_expired`, `invoice_cancelled`, `chargeback_detected`, `chargeback_lost`, `returned`, `returning`, `completed`), o status do pedido cascateia automaticamente para **`cancelled_by_user`**, com:
  - `cancelled_at = now()`
  - `cancellation_reason = 'Cancelado por cancelamento de pagamento pelo lojista'`
  - Entrada no `order_history` registrando a cascata.

- O trigger DB `cancel_pending_drafts_on_regression` reconhece `cancelled_by_user` como regressão e cancela rascunhos pendentes em `fiscal_draft_queue`, `shipping_draft_queue` e `gateway_sync_queue`.

- O status `cancelled_by_user` é **terminal** (nenhuma transição de saída) e libera a exclusão do pedido (allow-list inclui `cancelled` ou `cancelled_by_user`).

## Por que separar de `cancelled`

`cancelled` representa cancelamento originado fora do controle do lojista (cliente desistiu, gateway recusou, expiração). `cancelled_by_user` representa intervenção manual explícita do lojista via mudança de status de pagamento. Separar permite distinção em relatórios e atribuição sem inflar vocabulário de filtros legados.

## Anti-regressão

- NUNCA remover `cancelled_by_user` da lista REGRESSIVE em `core-orders` nem do array `v_regression_states` na trigger DB.
- NUNCA remover `cancelled_by_user` do allow-list de `delete_order`.
- NUNCA cascatear quando o pedido já estiver em estado terminal/regressivo (evita sobrescrever `chargeback_lost`, `payment_expired`, etc.).
- Label PT-BR canônico: **"Cancelado pelo usuário"** (variant destructive).

## Arquivos

- `supabase/functions/core-orders/index.ts` — handler `set_payment_status` (cascata) + `delete_order` (allow-list)
- `supabase/migrations/*cancel_pending_drafts_on_regression*` — trigger DB com `cancelled_by_user` no array
- `src/types/orderStatus.ts` — `OrderStatus`, `ORDER_STATUS_CONFIG`, `LEGACY_ORDER_STATUS_MAP`
- `src/lib/orderTransitions.ts` — espelho client-side
- Doc: `docs/especificacoes/ecommerce/pedidos.md` §4 e §8.2
