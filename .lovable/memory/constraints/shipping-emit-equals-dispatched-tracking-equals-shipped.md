---
name: Emissão = Etiqueta gerada · Postado = 1º evento real dos Correios · Despacho fica no Pedido
description: Emitir etiqueta grava shipments.delivery_status='label_created' e orders.status='dispatched'. delivery_status='posted' SÓ é setado pelo tracking-poll ao detectar 1º evento real dos Correios. Notificação 'posted' aceita apenas new_status='posted'. Etiqueta via fluxo assíncrono oficial. Botão "Despachar" proibido.
type: constraint
---

# Significado dos status do objeto · Emissão × Postado

## Regra inegociável

1. **Emissão da etiqueta NÃO é "Postado".** Quando `shipping-create-shipment`
   retorna `success: true + tracking_code`:
   - `shipments.delivery_status = 'label_created'` (rótulo na UI:
     **"Etiqueta gerada"**).
   - `orders.status = 'dispatched'`, `orders.shipped_at = now()`,
     `orders.tracking_code = ...`, `orders.shipping_carrier = ...`.
   - `order_history` recebe ação `dispatched`.
   - Evento canônico `shipment.dispatched` é inserido em `events_inbox`.
   - Pratika é chamado fire-and-forget (`update_tracking`) quando há
     `invoice_id` e `auto_send_label=true`.
   - PDF da etiqueta é baixado nos Correios via **fluxo assíncrono oficial em
     2 passos**: (a) `POST /prepostagem/v1/prepostagens/rotulo/assincrono/pdf`
     com `codigosObjeto:[trackingCode]` → devolve `{ idRecibo }`;
     (b) `GET /prepostagem/v1/prepostagens/rotulo/download/assincrono/{idRecibo}`
     com `Accept: application/json` → JSON com PDF em base64
     (`dados`/`arquivo`/`rotulo`). Endpoint `/prepostagens/{id}/etiqueta` **NÃO
     EXISTE** (404 "No static resource"). PDF é salvo no bucket privado
     `shipping-labels` em `<tenantId>/<shipmentId>.pdf`; `shipments.label_url`
     guarda o **path** (nunca URL externa).

2. **"Postado" SÓ vem do polling.** O `tracking-poll` é o único responsável
   por promover o objeto de `'label_created'` para `'posted'`, quando lê o 1º
   evento real dos Correios (`PO/POI/Postado`). Ao promover:
   - emite `shipment.status_changed` com `new_status='posted'`;
   - move `orders.status` para `shipped`. `in_transit`/`out_for_delivery`
     mantém em `shipped`. `delivered` vira `delivered`. Estados terminais
     (`completed`, `cancelled`, `cancelled_by_user`, `returning`, `returned`,
     `chargeback_lost`) nunca são rebaixados.

3. **`process-events` — regras de notificação shipping:**
   - `trigger_condition='dispatched'` casa **somente** com
     `event_type='shipment.dispatched'` (emissão). Nunca com
     `shipment.status_changed`, para não duplicar com "Postado".
   - `trigger_condition='posted'` casa **somente** com
     `event_type='shipment.status_changed'` e `new_status='posted'`. NÃO casa
     mais com `label_created` ou `shipped` (correção 2026-06-03).
   - Sem template aprovado e ativo, o gatilho dispara em silêncio.

4. **Etiqueta sempre reimprimível.** `shipping-get-label` aceita
   `force_refresh=true` para refazer a chamada nos Correios mesmo se já houver
   PDF no bucket. UI expõe botões de imprimir/reimprimir sem `disabled`.

5. **Declaração de Conteúdo sempre reimprimível.** `reprintExistingDeclaration`
   renderiza o PDF a partir do snapshot persistido em
   `shipping_content_declarations` (sem reemitir). UI usa essa rota quando o
   pedido não tem NF-e.

## O que NUNCA pode acontecer

- Botão "Despachar" voltar à UI de Remessas — emissão é o despacho.
- `shipping-create-shipment` gravar `delivery_status='posted'` (regrediria
  para a convenção antiga que confundia "etiqueta gerada" com "postado").
- `process-events` aceitar `label_created` ou `shipped` como satisfação da
  condição `posted` (regrediria a notificação para disparar na emissão).
- `shipments.label_url` armazenar URL externa dos Correios — sempre path
  interno do bucket.
- Pedido em estado terminal ser rebaixado pelo polling.
- Notificação de "Postado" disparar antes do 1º evento real dos Correios.
- DC ser reemitida ao "Reimprimir" — sempre usar
  `reprintExistingDeclaration`.
- Pratika ser chamado quando `wms_pratika_configs.auto_send_label=false`.

## Rótulos na UI (PT-BR)

- `draft` → "Rascunho"
- `label_created` → "Etiqueta gerada"
- `posted` → "Postado"
- `in_transit` → "Em trânsito"
- `out_for_delivery` → "Saiu p/ entrega"
- `delivered` → "Entregue"
- `failed` → "Falha"
- `returned` → "Devolvido"

## Arquivos

- Edge: `supabase/functions/shipping-create-shipment/index.ts`,
  `supabase/functions/shipping-get-label/index.ts`,
  `supabase/functions/tracking-poll/index.ts`,
  `supabase/functions/process-events/index.ts`.
- Shared: `supabase/functions/_shared/correios-label.ts`.
- UI: `src/components/shipping/ShipmentGenerator.tsx` (botão Despachar removido),
  `src/components/shipping/TrackingTab.tsx`,
  `src/components/shipping/RemessasManager.tsx`,
  `src/components/shipping/ShipmentDetailsCard.tsx`.
- Tipos: `src/hooks/useNotificationRulesV2.ts` (`ShippingCondition` inclui
  `dispatched`).
- Storage: bucket privado `shipping-labels`.
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Emissão = despachado · Postado = 1º evento real"
  e `docs/especificacoes/fiscal/declaracao-de-conteudo-correios.md` §"Reimpressão".
- Memórias relacionadas:
  - `mem://constraints/shipping-canonical-link-is-pv-not-order`
  - `mem://constraints/shipping-pv-delete-cascade-by-shipment-state`
  - `mem://constraints/correios-cws-prepostagem-payload-and-error-parser`
  - `mem://features/external-apps/wms-pratika-integration`
