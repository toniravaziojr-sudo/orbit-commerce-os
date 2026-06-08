---
name: Objeto logístico órfão é auto-reconciliado a partir do PV ativo
description: Reconciliação automática a cada 15min + índice único parcial na fila + dedup que ignora objeto cancelado garantem que PV ativo nunca fique sem objeto de postagem, mesmo após cancelamento/descarte de tentativa anterior.
type: constraint
---

# Reconciliação de objeto logístico órfão

## Problema histórico

A criação do objeto de postagem só acontecia uma vez, na trigger
`trg_enqueue_shipping_draft_from_pv` (AFTER INSERT em `fiscal_invoices`).
Se o objeto fosse apagado depois (limpeza manual, cancelamento de NF, falha
pontual), o PV ficava órfão para sempre.

A primeira versão da reconciliação (2026-06-03) cobria parte do problema
mas era bloqueada por dois pontos:

1. O dedup do processador de fila marcava o item como `done` ao encontrar
   QUALQUER `shipment` vinculado, mesmo que esse objeto fosse depois
   cancelado/descartado.
2. O índice único `shipping_draft_queue_pv_unique` era global por PV
   (qualquer status). Uma entrada antiga em `done` impedia a reconciliação
   de enfileirar uma nova tentativa.

Caso real que destravou esta regra: **PV 395 (Maria da Glória)** no tenant
Respeite o Homem em 2026-06-08. Pedido pago, PV ativo em `em_aberto`,
sem objeto de postagem, com entrada antiga `done` na fila bloqueando a
auto-cura.

## Regra inegociável (2026-06-08)

1. **Índice único parcial na fila** (substitui os globais antigos):
   - `shipping_draft_queue_pv_open_unique`
     `ON (source_pedido_venda_id) WHERE source_pedido_venda_id IS NOT NULL AND status IN ('pending','processing')`
   - `shipping_draft_queue_order_open_unique`
     `ON (order_id) WHERE order_id IS NOT NULL AND status IN ('pending','processing')`

   Entradas `done`, `cancelled`, `failed` ficam preservadas para auditoria
   e NÃO bloqueiam mais a reconciliação de abrir uma nova tentativa.

2. **Dedup do processador (`scheduler-tick` PHASE 1.6)** considera apenas
   shipment ATIVO: filtro `delivery_status <> 'canceled'`. Se o único
   vínculo for cancelado, o processador cria objeto novo em vez de marcar
   `done` por engano.

3. **Função `reconcile_orphan_pv_shipments(p_tenant_id uuid DEFAULT NULL)`**
   (SECURITY DEFINER, search_path=public):
   - Para cada PV raiz (`fiscal_stage='pedido_venda'`,
     `source_order_invoice_id IS NULL`) ativo
     (`pedido_status IN ('em_aberto','pendente','nf_criada','concluido')`)
     sem `shipments` vinculado e sem entrada `pending`/`processing` na fila:
       - Se `order_id IS NOT NULL`: respeita `resolve_order_shipping_provider`
         (pula `marketplace` e `provider_kind='gateway'`) e enfileira em
         `shipping_draft_queue`.
       - Se `order_id IS NULL` (PV manual/duplicado): cria `shipments`
         direto com `source='reconcile_orphan'`, lendo peso/dimensões dos
         itens via `fiscal_invoice_items` + `products`.
   - Retorna `int` = quantidade de PVs reparados.

4. **Cron `reconcile-orphan-pv-shipments-15m`** roda a função a cada
   15 minutos para todos os tenants. O `scheduler-tick` PHASE 1.6
   consome a fila e cria os shipments efetivamente.

## O que NUNCA pode acontecer

- Voltar o índice único global por PV/order — quebra a auto-cura.
- Dedup do processador considerar shipment `canceled` como existente.
- Função reconcile criar `shipment` direto quando há `order_id` (precisa
  passar pela fila + scheduler-tick para respeitar roteamento e dedup).
- Reconciliar PV de marketplace, gateway, cancelado, chargeback ou
  devolvido.
- Reconciliar PV manual (sem `order_id`) que esteja em status terminal.
- Reduzir o intervalo do cron abaixo de 5min sem revisar impacto no
  scheduler-tick.

## Arquivos

- Migração unicidade parcial: `supabase/migrations/*shipping_draft_queue_partial_unique*.sql` (2026-06-08).
- Migração original da função: `supabase/migrations/*reconcile-orphan-pv-shipments*.sql` (2026-06-03).
- Função: `public.reconcile_orphan_pv_shipments(uuid)`.
- Cron: `reconcile-orphan-pv-shipments-15m`.
- Processador: `supabase/functions/scheduler-tick/index.ts` PHASE 1.6
  (dedup `delivery_status <> 'canceled'`).
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Reconciliação de
  objeto logístico órfão".
- Memórias relacionadas:
  - `mem://constraints/shipping-pv-delete-cascade-by-shipment-state`
  - `mem://constraints/pv-from-paid-order-deletion-protected`
  - `mem://constraints/shipping-canonical-link-is-pv-not-order`
  - `mem://features/logistics/gateway-vs-local-shipping-routing`
