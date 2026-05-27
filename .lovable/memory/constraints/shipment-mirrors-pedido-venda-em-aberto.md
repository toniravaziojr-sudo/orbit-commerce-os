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

## O que NUNCA pode acontecer

- Tocar em remessa com `tracking_code` preenchido. Etiquetas postadas exigem tratamento manual (devolução, cancelamento de envio).
- Criar remessa local para pedido com `resolved_shipping_provider_kind='gateway'` — gateway tem `gateway_sync_queue` próprio (ver `mem://features/logistics/gateway-vs-local-shipping-routing`).
- Bypassar o gatilho atualizando `pedido_status` direto sem trigger. `pedido_status` é mantido pelos gatilhos `trg_orders_sync_pv_status` / `mirror_order_status_to_pv` (ver `mem://constraints/pv-pedido-status-mirror-from-order`).
- Confundir "rascunho de remessa" com `shipping_draft_queue` (fila intermediária). A regra de espelho atua no `shipments` final, não na queue.

## Acerto de carga aplicado em 2026-05-27

- Removidas 2 remessas órfãs (PVs em chargeback_em_andamento / chargeback_perdido).
- 1 PV em aberto sem remessa local: era gateway (correto, fora da fila local).
- Saldo final: 253 PVs em aberto = 252 remessas Correios + 1 gateway.

## Arquivos

- Migração: `supabase/migrations/*sync_shipment_with_pv_status*.sql` (2026-05-27).
- Funções: `public.sync_shipment_with_pv_status`.
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Espelho vivo" e `docs/especificacoes/erp/erp-fiscal.md` §"Status do Pedido de Venda controla presença na fila de Remessas".
- Relacionado: `mem://constraints/shipping-draft-mirrors-pedido-venda`, `mem://constraints/pv-pedido-status-mirror-from-order`, `mem://features/logistics/gateway-vs-local-shipping-routing`.
