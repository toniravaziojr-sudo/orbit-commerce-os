---
name: Remessa amarra no Pedido de Venda, nunca no pedido real
description: Vínculo canônico de toda lógica de remessa é source_pedido_venda_id. order_id é apenas histórico/fallback. Restrição de unicidade por PV. Apagar pedido real nunca apaga remessa.
type: constraint
---

# Vínculo canônico da remessa = Pedido de Venda

## Regra inegociável

1. **Lookups (NF, DC, rascunho de remessa)** em `shipping-create-shipment` priorizam `source_pedido_venda_id`. `order_id` só é usado como fallback histórico quando não houver PV resolvido.
2. **Atualização da remessa após emitir etiqueta**: sempre por `shipments.id` do rascunho resolvido. Se o rascunho ainda não tem PV, costurar `source_pedido_venda_id` antes de prosseguir.
3. **Restrição de unicidade**: índices parciais únicos
   - `idx_shipments_pv_tracking (source_pedido_venda_id, tracking_code)` WHERE PV não-nulo e tracking não-vazio — fonte de verdade.
   - `idx_shipments_order_tracking_legacy (order_id, tracking_code)` WHERE PV nulo — só para registros legados antigos.
4. **FKs**:
   - `shipments_order_id_fkey ON DELETE SET NULL` — apagar pedido real **nunca** apaga remessa.
   - `shipping_draft_queue_order_id_fkey ON DELETE SET NULL` — idem para a fila de rascunhos.
   - Cascata canônica é via `source_pedido_venda_id` (CASCADE para fila; SET NULL para shipments já postados, já documentado em `shipment-mirrors-pedido-venda-em-aberto`).
5. **UI (TrackingTab, ShipmentDetailsCard, ShipmentGenerator)**: join com `orders` é sempre opcional. Quando não há pedido real, exibir dados do PV (`PV {numero}`, `dest_nome`).

## O que NUNCA pode acontecer

- Edge function buscar DC/NF/rascunho por `order_id` quando há `source_pedido_venda_id` disponível.
- `orders!inner` em qualquer query de remessa — esconde PV manual/duplicado da UI.
- Upsert de remessa com `onConflict` baseado em `order_id` — quebra para PV-only.
- FK `shipments.order_id` ou `shipping_draft_queue.order_id` ser CASCADE — apagar pedido real apagaria a remessa.
- Marcar pedido como despachado sem `order_id` (PV manual não tem pedido real para atualizar — só a remessa é marcada como postada).

## Arquivos

- Migração: `supabase/migrations/*shipping_canonical_link_pv*.sql` (2026-06-02).
- Edge: `supabase/functions/shipping-create-shipment/index.ts`.
- UI: `src/components/shipping/TrackingTab.tsx`, `src/components/shipping/ShipmentDetailsCard.tsx`, `src/components/shipping/ShipmentGenerator.tsx`.
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Vínculo canônico da remessa".
- Relacionado: `mem://constraints/shipping-draft-mirrors-pedido-venda`, `mem://constraints/shipment-mirrors-pedido-venda-em-aberto`.
