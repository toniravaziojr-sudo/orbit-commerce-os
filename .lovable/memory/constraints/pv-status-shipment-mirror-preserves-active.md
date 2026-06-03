---
name: pv-status-shipment-mirror-preserves-active
description: Sync of shipment object with Pedido de Venda status only deletes on terminal cancel statuses, never on em_aberto→concluido/nf_criada/pendente
type: constraint
---
O gatilho que mantém o objeto de postagem em paridade com o Pedido de Venda só pode REMOVER o objeto quando o PV entra num status terminal de cancelamento:

- cancelado / cancelled / cancelled_by_user
- expirado / expired / payment_expired
- estornado / refunded
- devolvido / returned / returning
- chargeback_em_andamento / chargeback_detected
- chargeback_perdido / chargeback_lost

Conclusão da venda (em_aberto → nf_criada, em_aberto → concluido, em_aberto → pendente) NUNCA pode remover o objeto. Esses são estados ativos do ciclo de despacho.

**Why:** o sistema já apagou objetos válidos quando o PV foi marcado como concluído após emissão da NF (caso real: PV 383 do tenant Respeite o Homem em 2026-06-03 19:30, NF 384 autorizada e enviada à Pratika, objeto deletado pelo gatilho).

**How to apply:**
- Função `public.sync_shipment_with_pv_status` precisa listar explicitamente os status terminais e só deletar quando OLD não estava terminal e NEW está terminal.
- Função `public.reconcile_orphan_pv_shipments` precisa recuperar PVs ativos sem objeto, inclusive PVs manuais/duplicados sem `order_id` (cria objeto direto, sem depender de `shipping_draft_queue`).
- Status oficiais ativos do PV: `em_aberto`, `pendente`, `nf_criada`, `concluido`.
- PV com pedido real cujo roteamento seja `gateway` ou `marketplace` continua fora — esse fluxo não usa objeto local.
