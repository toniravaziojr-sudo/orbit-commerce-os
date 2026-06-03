---
name: Objeto logístico órfão é auto-reconciliado a partir do PV ativo
description: Função reconcile_orphan_pv_shipments + cron 15min recriam o rascunho do objeto sempre que um PV ativo de pedido pago não tem shipment vinculado. Garante que o gap "PVs > objetos" nunca persista.
type: constraint
---

# Reconciliação de objeto logístico órfão

## Problema histórico

A criação do objeto de postagem só acontecia uma vez, na trigger
`trg_enqueue_shipping_draft_from_pv` (AFTER INSERT em `fiscal_invoices`).
Se o objeto fosse apagado depois (limpeza manual, teste, falha pontual), o
PV ficava órfão para sempre — nenhum mecanismo recriava. Foi a causa do
gap de 2 objetos no tenant Respeite o Homem (PVs #563 e #565 detectados
em 2026-06-03).

## Regra inegociável (2026-06-03)

1. **Função `reconcile_orphan_pv_shipments(p_tenant_id uuid DEFAULT NULL)`**
   (SECURITY DEFINER):
   - Para cada PV raiz (`fiscal_stage='pedido_venda'`,
     `source_order_invoice_id IS NULL`, `order_id IS NOT NULL`) cujo
     pedido é "pago-like" (via `is_payment_approved` ou
     `order_status_implies_paid`) **e** não está em estado terminal/
     chargeback/retorno **e** não é marketplace, **e** não tem `shipments`
     vinculado, **e** não tem entrada `pending`/`processing` em
     `shipping_draft_queue`:
       - Consulta `resolve_order_shipping_provider(order_id)`. Pula se
         `reason='marketplace'` ou `provider_kind='gateway'`.
       - Insere em `shipping_draft_queue` com `provider` = transportadora
         do pedido (fallback `correios`).
   - Retorna `int` = quantidade de PVs reparados.

2. **Cron `reconcile-orphan-pv-shipments-15m`** roda a função a cada
   15 minutos para todos os tenants (`p_tenant_id=NULL`). O scheduler-tick
   existente (PHASE 1.6) consome a fila e cria os shipments efetivamente.

3. **Filtros obrigatórios na função**:
   - Pula `marketplace_source` fora de
     (`storefront`,`checkout`,`manual`,`link`,`admin`) — marketplace usa
     seu próprio fluxo.
   - Pula `provider_kind='gateway'` — Frenet e similares usam
     `gateway-sync-order` (ver
     `mem://features/logistics/gateway-vs-local-shipping-routing`).
   - Pula pedidos `cancelled`/`refunded`/`expired`/`chargeback_lost`/
     `chargeback_detected`/`returning`/`returned`.

## O que NUNCA pode acontecer

- Criar `shipment` direto pela função (a função SÓ enfileira em
  `shipping_draft_queue`; quem cria o objeto é o consumidor da fila).
- Reconciliar PV de marketplace ou gateway.
- Reconciliar PV cujo pedido está cancelado/chargeback/devolvido.
- Reconciliar PV manual (sem `order_id`) — manual permanece sob controle
  exclusivo do usuário.
- Reduzir o intervalo do cron abaixo de 5min sem revisar impacto no
  scheduler-tick.

## Arquivos

- Migração: `supabase/migrations/*reconcile-orphan-pv-shipments*.sql`
  (2026-06-03).
- Função: `public.reconcile_orphan_pv_shipments(uuid)`.
- Cron: `reconcile-orphan-pv-shipments-15m`.
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Reconciliação de
  objeto logístico órfão".
- Memórias relacionadas:
  - `mem://constraints/shipping-pv-delete-cascade-by-shipment-state`
  - `mem://constraints/pv-from-paid-order-deletion-protected`
  - `mem://features/logistics/gateway-vs-local-shipping-routing`
