---
name: WMS Pratika ancorado na NF, não no Pedido
description: Envio para a Pratika dispara para TODA NF de venda autorizada e TODO objeto logístico, independente de existir Pedido vinculado (PV manual, balcão, link de checkout sem pedido na loja).
type: constraint
---

# WMS Pratika — Ancoragem na NF (não no Pedido)

## Regra inegociável (2026-06-08)

A integração com a Pratika (WMS) faz parte do **eixo Fiscal + Logístico**,
não do módulo de Pedidos. Toda NF de venda autorizada + seu objeto
logístico deve ser enviada à Pratika, **independentemente de existir
`orders.order_id` vinculado**.

Casos cobertos obrigatoriamente:
- Pedido pago no site → NF → Remessa (fluxo clássico).
- **PV manual** (venda fora do site, balcão, transferência avulsa) → NF → Remessa.
- Link de checkout sem ordem na loja.
- Qualquer combinação onde a NF nasce fora de `orders`.

## O que NUNCA pode acontecer

- Disparo para a Pratika condicionado a `invoice.order_id` (ou similar)
  — esse foi o bug original: NFs emitidas a partir de PV manual ficavam
  fora do envio.
- Idempotência baseada em `order_id` como chave primária (NFs sem
  pedido não teriam chave). **Chave de idempotência oficial é `invoice.id`.**
- Disparar NF de tipo não-venda (`devolucao`, `entrada`, `transferencia`,
  `remessa`, `complementar`, `ajuste`) para a Pratika.
- Disparar um Pedido de Venda (fiscal_stage='pedido_venda') — apenas NF
  emitida (`fiscal_stage in ('nf','emitida')`).

## Implementação obrigatória

### 1. Edge function `wms-pratika-send` — `action: send_combined`

- Aceita **`invoice_id` (preferido)** ou `order_id` (legado).
- Resolve a NF por `id` ou por `order_id`; exige `status='authorized'`.
- Bloqueia tipos não-venda: `tipo_nota NOT IN ('','venda','saida')` → skip.
- Bloqueia documentos que não são NF: `fiscal_stage NOT IN ('nf','emitida')` → skip.
- Resolve o Objeto Logístico (shipment) por cascata:
  1. `shipments.invoice_id = NF.id`
  2. `shipments.nfe_key = NF.chave_acesso` (44 dígitos)
  3. `shipments.source_pedido_venda_id = NF.source_order_invoice_id` (PV)
  4. `shipments.order_id = NF.order_id` (legado)
- **Idempotência**: `wms_pratika_logs.reference_id = invoice.id`. Para
  retrocompatibilidade, a consulta também aceita registros antigos com
  `reference_id = order_id`.

### 2. Callers obrigatórios (sempre passam `invoice_id`)

- `fiscal-webhook` (autorização vinda do Focus NFe) → dispara assim que
  a NF fica `autorizado`. Não exige `order_id`.
- `fiscal-check-status` (polling pós-emissão) → idem.
- `fiscal-emit` (resposta imediata da Focus) → usa `send_combined` com
  `invoice_id`.
- `shipping-create-shipment` (quando objeto recebe tracking) → resolve
  `invoice_id` via `shipments.invoice_id / nfe_key / source_pedido_venda_id`
  e dispara.
- `shipping-register-manual` (registro manual de rastreio) → pode
  continuar passando `order_id` (sempre tem) que a função resolve.

### 3. Telemetria

`wms_pratika_logs.reference_type='invoice'` em todas as operações
combined/nfe/tracking emitidas pelo novo fluxo. Operações antigas com
`reference_type='order'` continuam válidas para histórico.

## Como validar

1. Emitir NF a partir de PV manual (sem `order_id`).
2. Conferir em `wms_pratika_logs` (últimos 5 min) que apareceu o
   registro `combined · success` com `reference_id = invoice.id` e
   `reference_type='invoice'`.
3. Se faltar rastreio, deve aparecer `waiting` e o disparo do objeto
   logístico (no momento em que ganhar `tracking_code`) completa o envio.

## Arquivos

- `supabase/functions/wms-pratika-send/index.ts`
- `supabase/functions/fiscal-webhook/index.ts`
- `supabase/functions/fiscal-check-status/index.ts`
- `supabase/functions/fiscal-emit/index.ts`
- `supabase/functions/shipping-create-shipment/index.ts`
- `supabase/functions/shipping-register-manual/index.ts`
- Doc: `docs/especificacoes/external-apps/wms-pratika.md`
- Memórias relacionadas:
  - `mem://features/external-apps/wms-pratika-integration`
  - `mem://constraints/fiscal-pedido-venda-vs-nf-two-records`
