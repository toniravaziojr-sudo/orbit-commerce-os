---
name: Order deletion cancel-only and cascade cleanup
description: Exclusão de pedido exige status='cancelled' estrito + travas fiscal/logística + cascata determinística que limpa rastros operacionais e preserva cliente/lead.
type: constraint
---

# Exclusão de Pedido — Regra Canônica

## Regra
1. **Allow-list estrito:** exclusão só permitida quando `orders.status IN ('cancelled', 'cancelled_by_user')`. Status legado `'pending'` foi removido. Qualquer outro status retorna `code: 'CANNOT_DELETE'` com mensagem PT-BR "Somente pedidos cancelados podem ser excluídos. Cancele o pedido antes de excluí-lo."
2. **Trava fiscal:** mesmo cancelado, se houver `fiscal_invoices` vinculada com status em `('authorized','invoice_authorized','invoice_issued','issued')`, retorna `CANNOT_DELETE_FISCAL` com mensagem PT-BR.
3. **Trava logística:** mesmo cancelado, se houver `shipments` vinculada com status NÃO em `('cancelled','voided','void','canceled')`, retorna `CANNOT_DELETE_SHIPPING` com mensagem PT-BR.
4. **Cascata obrigatória (apaga rastros operacionais):** `order_items`, `order_history`, `order_price_audit`, `order_attribution`, `payment_transactions`, `gateway_sync_queue`, `fiscal_draft_queue`, `shipping_draft_queue`, `shipments`, `shipping_content_declarations`, `review_tokens`, `affiliate_conversions`, `email_conversions`, `discount_redemptions`, `marketing_events_log`, `notification_logs`, `mp_pending_checkouts`, `whatsapp_carts`, `checkout_sessions`.
5. **Desvincula (sem apagar):** `conversations.order_id`, `tiktok_shop_orders.order_id`, `tiktok_shop_returns.order_id` → `NULL`.
6. **Preserva integralmente:** `customers`, leads, tags, métricas agregadas do cliente, `audit_log`, evento `order.deleted` no event bus (com `cleanup_counts` + `unlink_counts`).
7. **Dialog de confirmação:** texto explícito sobre impacto em relatórios/métricas e preservação de cliente/lead. Botão *"Excluir permanentemente"*.

## Por que essa cascata é segura
Ao cancelar, o gatilho `cancel_pending_drafts_on_regression` (§4.6 de `pedidos.md`) já cancelou rascunhos pendentes em filas e marcou NF/etiqueta ativa como `requires_action=true`. As travas fiscal/logística garantem que a exclusão só procede quando não há documento legal ou operação física pendente.

## Anti-regressão
- NUNCA permitir exclusão fora de `status = 'cancelled'`.
- NUNCA remover as travas fiscal/logística.
- NUNCA apagar `customers`, leads, tags ou métricas agregadas em cascata.
- NUNCA apagar `audit_log`.
- Ao adicionar nova tabela operacional que referencie `order_id`, decidir explicitamente: entra na cascata de DELETE ou na lista de UNLINK? Documentar em `pedidos.md` §8.2.
- Mensagens de bloqueio sempre em PT-BR, voltadas ao lojista (sem códigos técnicos no corpo da UI).

## Arquivos
- `supabase/functions/core-orders/index.ts` — handler `delete_order`
- `src/hooks/useOrders.ts` — mutation `deleteOrder` (usa mensagem do servidor)
- `src/components/orders/OrderList.tsx` — diálogo de confirmação
- Doc: `docs/especificacoes/ecommerce/pedidos.md` §8.2
- Mapa de UI: `docs/especificacoes/transversais/mapa-ui.md` (linha `/orders`)
