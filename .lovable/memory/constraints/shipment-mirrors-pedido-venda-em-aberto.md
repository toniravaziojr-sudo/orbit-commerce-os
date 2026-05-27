---
name: Remessa espelha Pedido de Venda em aberto
description: Fila de Remessas (rascunhos sem etiqueta) é espelho vivo dos Pedidos de Venda com pedido_status='em_aberto'. Trigger sync_shipment_with_pv_status garante criação/remoção automática.
type: constraint
---

# Espelho vivo Remessa ↔ Pedido de Venda em aberto

## Regra

1. A fila de Remessas (rascunhos: `shipments.tracking_code IS NULL OR ''`) deve refletir 1:1 os Pedidos de Venda raiz com `pedido_status='em_aberto'`, exceto pedidos com `orders.resolved_shipping_provider_kind='gateway'` (fluxo próprio).
2. Trigger `trg_sync_shipment_with_pv_status` em `public.fiscal_invoices` (AFTER INSERT OR UPDATE OF `pedido_status`):
   - `pedido_status → 'em_aberto'`: cria shipment rascunho (`source='auto_pv_sync'`, `carrier='correios'`, `delivery_status='draft'`) vinculado via `source_pedido_venda_id`. **CRÍTICO:** `delivery_status` DEVE ser `'draft'` — a aba "Prontos para emitir remessa" filtra por esse valor. Inserir como `label_created` torna a remessa invisível na UI (incidente 2026-05-27, PVs 348/349 Respeite o Homem). Não duplica se já existe rascunho para o `order_id`; nesse caso só anexa o vínculo. Quando `order_id IS NULL` (PV manual/duplicado), o worker da fila cria a remessa lendo dados do próprio PV.
   - `pedido_status` sai de `'em_aberto'`: `DELETE` em `shipments` onde `(order_id=NEW.order_id OR source_pedido_venda_id=NEW.id) AND tracking_code IS NULL/''` **E** `UPDATE shipping_draft_queue SET status='cancelled', cancel_reason='pv_left_em_aberto:<status>'` para itens `pending/processing` do mesmo PV (impede recriação por retry tardio).
3. Trava anti-corrida no `scheduler-tick` (PHASE 1.6): antes de inserir a remessa por `source_pedido_venda_id`, revalidar `pv.pedido_status='em_aberto' AND fiscal_stage='pedido_venda' AND source_order_invoice_id IS NULL`. Se não, cancelar item da fila com `cancel_reason='pv_not_em_aberto:<status>'`. Previne remessa órfã quando NF é emitida antes do worker processar.
4. Função: `public.sync_shipment_with_pv_status()` (SECURITY DEFINER, `search_path=public`).
5. Aplica-se apenas a PV raiz (`fiscal_stage='pedido_venda' AND source_order_invoice_id IS NULL`).

## Peso, dimensões e transportadora na criação (2026-05-27)

O gatilho `sync_shipment_with_pv_status` calcula no `INSERT`:
- `metadata.weight_grams` = `SUM(COALESCE(p.weight,300) * qty)` (mínimo 1g, fallback 300g/item).
- `metadata.height_cm` = `MAX(COALESCE(p.height,10))`.
- `metadata.width_cm` = `MAX(COALESCE(p.width,15))`.
- `metadata.depth_cm` = `SUM(COALESCE(p.depth,20))`.
- `metadata.declared_value` = `SUM(oi.total_price)` (ou `fii.valor_total` quando PV manual).
- `carrier`, `service_code`, `service_name` propagados de `orders.shipping_carrier / shipping_service_code / shipping_service_name` (fallback `transportadora_*` do PV quando `order_id IS NULL`).

Origem dos itens: `order_items` quando `order_id IS NOT NULL`; caso contrário `fiscal_invoice_items` do próprio PV.

## Override manual (2026-05-27)

Coluna `shipments.manually_adjusted boolean DEFAULT false`. Quando `true`:
- Gatilho NÃO deleta a remessa ao PV sair de `em_aberto` (cláusula `AND manually_adjusted = false` nos `DELETE`).
- Worker da fila e backfills NÃO recalculam peso/dimensões/transportadora.
- Edição manual (peso, dimensões, transportadora, serviço, destinatário, valor declarado) e criação manual de rascunho via UI marcam `manually_adjusted=true`.

UI: `src/components/shipping/ShipmentGenerator.tsx` (aba "Prontos para emitir remessa") expõe ações **Criar novo**, **Editar** e **Excluir** por linha. Diálogo: `src/components/shipping/DraftShipmentDialog.tsx`.

## O que NUNCA pode acontecer

- Tocar em remessa com `tracking_code` preenchido. Etiquetas postadas exigem tratamento manual.
- Recalcular automaticamente remessa com `manually_adjusted=true`.
- Criar remessa local para pedido com `resolved_shipping_provider_kind='gateway'` — gateway tem `gateway_sync_queue` próprio (ver `mem://features/logistics/gateway-vs-local-shipping-routing`).
- Bypassar o gatilho atualizando `pedido_status` direto sem trigger.
- Confundir "rascunho de remessa" com `shipping_draft_queue` (fila intermediária). A regra de espelho atua no `shipments` final.

## Acerto de carga aplicado em 2026-05-27

- Removidas 2 remessas órfãs (PVs em chargeback).
- 1 PV em aberto sem remessa local: era gateway (correto).
- Backfill de peso/dimensões + carrier/service para PVs 348, 349, 536, 537 (Respeite o Homem) que nasceram sem esses dados.
- Saldo final: PVs em aberto = remessas Correios em rascunho + remessas gateway.


## Arquivos

- Migração: `supabase/migrations/*sync_shipment_with_pv_status*.sql` (2026-05-27).
- Funções: `public.sync_shipment_with_pv_status`.
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Espelho vivo" e `docs/especificacoes/erp/erp-fiscal.md` §"Status do Pedido de Venda controla presença na fila de Remessas".
- Relacionado: `mem://constraints/shipping-draft-mirrors-pedido-venda`, `mem://constraints/pv-pedido-status-mirror-from-order`, `mem://features/logistics/gateway-vs-local-shipping-routing`.
