---
name: marketplace-shipment-promotes-order-mirrors-shipment-ingest
description: Ponte marketplace_shipments → orders vive em meli-fetch-shipment, espelhando shipment-ingest (vocabulário canônico, preDispatchOrderStatuses, sem regressão). meli-sync-orders não pode rebaixar pedidos avançados.
type: constraint
---
**Regra:** o ciclo de vida do pedido marketplace (`orders.status`, `shipping_status`, `tracking_code`, `shipped_at`, `delivered_at`) deve ser promovido a partir de `marketplace_shipments` pela Edge Function `meli-fetch-shipment`, com **paridade lógica obrigatória** com `supabase/functions/shipment-ingest/index.ts` (fluxo interno).

**Padrões herdados (não reinventar):**
- Vocabulário canônico de `orders.shipping_status`: `awaiting_shipment | label_generated | shipped | in_transit | arriving | delivered | problem | returned`. Nunca usar `pending` (vocab ML).
- `preDispatchOrderStatuses` (gate de promoção para `dispatched`): `paid, processing, ready_to_invoice, pending, awaiting_shipment, invoice_pending_sefaz, invoice_authorized, invoice_issued, fulfilled`.
- Estados terminais que **nunca** podem ser regredidos: `shipped, in_transit, delivered, completed, cancelled, returning, returned`.
- Auditoria obrigatória em `order_history` com `action='shipment_updated'` e `new_value.source='marketplace_shipment'`.
- Padrão arquitetural: ação em edge function (NÃO em trigger SQL — ver `mem://architecture/automation-trigger-cron-standard`).

**Guarda em `meli-sync-orders`:** ao re-sincronizar pedidos do ML, **NÃO** sobrescrever `orders.status` se o pedido já está em `{invoice_pending_sefaz, invoice_authorized, invoice_issued, dispatched, shipped, in_transit, delivered, completed, cancelled, returning, returned}`. O statusMap do ML só conhece pending/processing/shipped/delivered/cancelled e rebaixaria pedidos avançados. Exceção: cancelamentos do ML têm precedência.

**Why:** sem a ponte, pedidos #665 (`invoice_authorized`) e #670 (`processing`) ficaram travados mesmo com tracking ativo no ML. Sem a guarda do sync, qualquer re-sync devolvia o pedido para `processing` e perdia o avanço fiscal/logístico (mesma classe da regressão `paid` vs `approved`).

**How to apply:** qualquer mudança em `meli-fetch-shipment` no bloco "Ponte marketplace_shipments → orders" ou em `meli-sync-orders` no bloco "Guarda anti-rebaixamento" deve manter paridade com `shipment-ingest` (linhas 360-419). Toda nova promoção de status do fluxo interno deve ser refletida aqui.
