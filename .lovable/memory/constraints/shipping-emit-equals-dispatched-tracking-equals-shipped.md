---
name: Emissão de remessa = despachado; primeiro evento Correios = enviado
description: Emitir remessa pelos Correios já marca pedido como dispatched, baixa PDF da etiqueta, emite shipment.dispatched e chama Pratika. Polling detecta posted e vira pedido para shipped. Botão "Despachar" é proibido.
type: constraint
---

# Emissão = despachado · Primeiro evento Correios = enviado

## Regra inegociável

1. **A própria emissão da remessa já é o despacho.** É proibido botão intermediário
   "Despachar". Quando `shipping-create-shipment` recebe `success: true + tracking_code`:
   - `shipments.delivery_status = 'posted'` (não mais `label_created`)
   - `orders.status = 'dispatched'`, `orders.shipped_at = now()`,
     `orders.tracking_code = ...`, `orders.shipping_carrier = ...`
   - `order_history` recebe ação `dispatched`
   - Evento canônico `shipment.dispatched` é inserido em `events_inbox`
   - Pratika é chamado fire-and-forget (`update_tracking`) quando há `invoice_id`
   - PDF da etiqueta é baixado nos Correios (`/etiqueta`), salvo no bucket privado
     `shipping-labels` em `<tenantId>/<shipmentId>.pdf`, e o **path** vai em
     `shipments.label_url` (não URL externa).

2. **Transição para "enviado" é responsabilidade do polling.** Quando
   `tracking-poll` detecta o primeiro evento real dos Correios (`PO/POI/Postado`,
   mapeado para `delivery_status='posted'`), o `orders.status` vira `shipped`.
   `in_transit/out_for_delivery` mantém em `shipped`. `delivered` vira `delivered`.
   Estados terminais (`completed/cancelled/cancelled_by_user/returning/returned/chargeback_lost`)
   nunca são rebaixados.

3. **Etiqueta é sempre reimprimível.** `shipping-get-label` aceita `force_refresh=true`
   para refazer a chamada nos Correios mesmo se já houver PDF no bucket. A UI
   expõe botão de imprimir e botão de reimprimir sem `disabled` — a edge resolve
   o caminho (bucket existente → signed URL fresca de 1h; ausente → baixa, salva,
   devolve signed URL).

4. **Declaração de Conteúdo é sempre reimprimível.** A função
   `reprintExistingDeclaration` renderiza o PDF a partir do snapshot persistido em
   `shipping_content_declarations` (sem reemitir). UI usa essa rota quando o
   pedido não tem NF-e.

5. **Gatilhos de notificação reconhecem 2 momentos distintos**:
   - `dispatched` (regra `rule_type=shipping`, `trigger_condition=dispatched`) →
     consome `events_inbox.event_type='shipment.dispatched'`
   - `posted` (regra `rule_type=shipping`, `trigger_condition=posted`) →
     consome `events_inbox.event_type='shipment.status_changed'` com `new_status='posted'`
   Sem template aprovado e ativo, o gatilho dispara em silêncio (comportamento atual).

## O que NUNCA pode acontecer

- Botão "Despachar" voltar à UI de Remessas — emissão é o despacho.
- `shipments.label_url` armazenar URL externa dos Correios — sempre path interno do bucket.
- Pedido em estado terminal ser rebaixado pelo polling.
- Notificação de "despachado" duplicar com a de "enviado" quando o polling roda — a
  trava está no `process-events`: condição `dispatched` só casa com `shipment.dispatched`,
  não com `shipment.status_changed`.
- DC ser reemitida ao "Reimprimir" — sempre usar `reprintExistingDeclaration`.
- Pratika ser chamado quando `wms_pratika_configs.auto_send_label=false` — a trava
  está dentro da `wms-pratika-send`.

## Arquivos

- Edge: `supabase/functions/shipping-create-shipment/index.ts`,
  `supabase/functions/shipping-get-label/index.ts`,
  `supabase/functions/tracking-poll/index.ts`,
  `supabase/functions/process-events/index.ts`.
- Shared: `supabase/functions/_shared/correios-label.ts`.
- UI: `src/components/shipping/ShipmentGenerator.tsx` (botão Despachar removido).
- Tipos: `src/hooks/useNotificationRulesV2.ts` (`ShippingCondition` inclui `dispatched`).
- Storage: bucket privado `shipping-labels`.
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Emissão = despachado" e
  `docs/especificacoes/fiscal/declaracao-de-conteudo-correios.md` §"Reimpressão".
- Memórias relacionadas: `mem://constraints/shipping-canonical-link-is-pv-not-order`,
  `mem://constraints/correios-cws-prepostagem-payload-and-error-parser`,
  `mem://features/external-apps/wms-pratika-integration`.
