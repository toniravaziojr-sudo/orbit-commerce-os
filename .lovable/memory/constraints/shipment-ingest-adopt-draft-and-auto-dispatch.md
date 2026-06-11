---
name: Shipment Ingest — Adopt Draft + Auto Dispatch
description: shipment-ingest deve adotar rascunho existente do mesmo pedido (sem rastreio) em vez de criar remessa duplicada, e promover orders.status para 'dispatched' com shipped_at=now() quando o evento for label_created/posted e o pedido estiver em estado pré-despacho.
type: constraint
---
**Regra (rev 2026-06-11):**
1. Antes de inserir nova remessa, `shipment-ingest` procura `shipments` do mesmo `order_id` com `tracking_code IS NULL` (rascunho). Se existir, **atualiza** esse registro com `tracking_code`, `label_url`, `delivery_status`, etc. Proibido criar segunda linha — gera "remessa fantasma".
2. Quando o evento de entrada é `label_created` ou `posted`, promover `orders.status='dispatched'` + `shipped_at=now()` + `shipping_status='shipped'`, **somente** se `orders.status IN ('paid','processing','ready_to_invoice','invoice_authorized','invoice_issued','fulfilled')`. Nunca rebaixar pedido já em `shipped/delivered/cancelled/...`.
3. Registrar evento em `order_history` com `action='status_change'`.

**Why:** auditoria 2026-06-11 do tenant Respeite o Homem (pedido #612) — sistema criou remessa duplicada em `failed` enquanto a remessa válida (AD558980543BR) ficava manual, e o pedido travado em `processing` mesmo após emissão da etiqueta. Quebrava paridade Pedido ↔ PV ↔ Remessa.

**How to apply:** qualquer mudança em `shipment-ingest` ou no fluxo de criação de remessas deve preservar essas 3 regras. Testar com pedido em `processing` + rascunho existente: após etiqueta, deve haver **1 só** remessa e pedido em `dispatched`.
