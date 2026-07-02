---
name: Reemissão de etiqueta após cancelamento pelos Correios
description: Fluxo obrigatório quando os Correios cancelam a pré-postagem (evento "Etiqueta cancelada pelo sistema de captação" ou similares). Cria novo Objeto de Postagem com numero próprio, marca o antigo como canceled com referência cruzada, e ressincroniza Pratika + marketplace com o novo rastreio.
type: constraint
---

# Reemissão de etiqueta após cancelamento pelos Correios

## Filtro obrigatório da aba "Problemas de envio/entrega"

A aba lista objetos com `delivery_status IN ('failed','returned','unknown')`
sem restrição, MAS para `delivery_status='canceled'` só entram os que têm
`action_reason='correios_prepost_canceled'`. Cancelamentos com motivos
`invoice_cancelled`, `pv_deleted`, `cancelled`, `expired`, `refunded`,
`chargeback_*` etc. **não são pendência logística** — o fluxo já foi
resolvido no módulo Fiscal ou de Pedidos. Não exibir esses objetos na
aba evita alarme falso e uso indevido do botão "Reemitir etiqueta".

Implementação: split em `ShipmentGenerator.tsx` no `useMemo` de
`pendingIssuance`/`deliveryProblems`.

## Regra inegociável (2026-07-02)



Quando os Correios cancelam a pré-postagem CWS (evento de rastreio
"Etiqueta cancelada pelo sistema de captação", "objeto cancelado",
"postagem cancelada", "prepostagem cancelada" e variantes), o sistema
DEVE:

1. **Detectar** o cancelamento no `tracking-poll`, mapeando a descrição
   para `delivery_status='canceled'`, `requires_action=true` e
   `action_reason='correios_prepost_canceled'`.
2. **Exibir** o objeto na aba **"Problemas de envio/entrega"** do módulo
   de Logística, com badge/mensagem PT-BR clara.
3. **Reemitir** via botão "Reemitir etiqueta" na linha do objeto, que
   chama a edge `shipping-reissue-label`.

## Como a reemissão funciona

A reemissão **nunca atualiza** o objeto original com um novo
`tracking_code`. Ela cria um **novo registro** em `public.shipments`:

- `numero` é alocado pelo trigger `trg_shipments_set_numero` — reforça a
  constraint `shipment-own-numero-and-no-manual-create` (numeração
  monotônica por tenant, sem reaproveitamento).
- Vínculo canônico é o **PV** (`source_pedido_venda_id`) — ver constraint
  `shipping-canonical-link-is-pv-not-order`. Pedido, NF, Cliente e
  Remessa vêm derivados do PV.
- `source='reissue'`.
- `metadata.reissued_from_shipment_id` e `reissued_from_tracking` no
  novo objeto.
- `metadata.reissued_to_shipment_id`, `reissued_to_numero` e
  `reissued_to_tracking` no objeto antigo.

O objeto antigo permanece com `delivery_status='canceled'` para
auditoria — não é excluído.

## Gates obrigatórios

A edge `shipping-reissue-label` BLOQUEIA a reemissão quando:

- `delivery_status <> 'canceled'` — retorna `not_canceled`.
- Existe evento com `status IN (posted, in_transit, out_for_delivery,
  delivered, returned)` — retorna `shipment_dispatched` (nesse caso o
  operador precisa abrir chamado nos Correios).
- Transportadora não é `correios` — retorna `unsupported_carrier`.

Idempotência: se `metadata.reissued_to_shipment_id` já aponta para um
novo objeto com `tracking_code` preenchido, a edge devolve o novo objeto
com `already_reissued=true` (evita duplicidade em duplo clique).

## Ressync obrigatório após emissão

1. **Pratika**: `wms-pratika-send` com `action='update_tracking'`,
   `force=true`, `invoice_id` e o novo `tracking_code`. Log gravado em
   `wms_pratika_logs` com `operation='tracking'`.
2. **Marketplace**: quando `orders.marketplace_source ∈ {mercado_livre,
   meli}`, enfileira novo envio em `meli_invoice_send_queue` com
   `status='pending'` e `attempts=0`. Outros marketplaces (TikTok Shop)
   serão adicionados quando houver fluxo espelhado.
3. **Auditoria**: registra em `core_audit_log` (`action='shipment.reissue_label'`)
   com IDs e códigos antigos e novos.

## O que NUNCA pode acontecer

- Atualizar `shipments.tracking_code` do objeto original com o novo
  código — quebra a auditoria e viola a numeração própria.
- Reemitir quando o objeto tem evento pós-despacho real
  (posted/in_transit/delivered/etc.). A etiqueta física já existe no
  fluxo Correios.
- Reemitir objetos gateway (Frenet, ML full/flex) por esta edge —
  ver constraint `gateway-vs-local-shipping-routing`. Objetos gateway
  seguem regra da transportadora dona.
- Deixar o WMS Pratika desatualizado após reemissão — se a
  ressincronização Pratika falhar, o `wms_pratika_logs` deve conter o
  erro para reconciliação manual.
- Exibir mensagens técnicas ao usuário. Toda mensagem no botão/diálogo
  é em PT-BR de negócio.

## Arquivos

- Edge: `supabase/functions/shipping-reissue-label/index.ts`.
- Parser: `supabase/functions/tracking-poll/index.ts` (bloco CANCELED de
  `mapCorreiosStatus`).
- UI: `src/components/shipping/ShipmentGenerator.tsx` (aba
  "Problemas de envio/entrega").
- Hook: `useReissueShipment` em `src/hooks/useShipments.ts`.
- Doc: `docs/especificacoes/erp/logistica.md` §"Reemissão após
  cancelamento pelos Correios".

## Memórias relacionadas

- `mem://constraints/shipment-own-numero-and-no-manual-create`
- `mem://constraints/shipping-canonical-link-is-pv-not-order`
- `mem://features/external-apps/wms-pratika-integration`
- `mem://constraints/nf-cancel-blocked-by-shipment-state`
- `mem://features/logistics/gateway-vs-local-shipping-routing`
