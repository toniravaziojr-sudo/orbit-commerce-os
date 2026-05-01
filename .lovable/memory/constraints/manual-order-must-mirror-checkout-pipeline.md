---
name: Pedido manual deve espelhar pipeline do checkout
description: Pedido criado via core-orders.create_order com payment_status_initial='paid' precisa disparar exatamente os mesmos triggers do webhook de pagamento aprovado (fila fiscal, fila de remessas, sync de cliente). Implementado via gravação canônica 'paid'→'approved' no DB e triggers em AFTER INSERT OR UPDATE.
type: constraint
---

# Pedido manual = espelho do pedido automático

## Contexto
Antes de 2026-05-01, a função `enqueue_fiscal_draft` (que cria rascunho fiscal + roteia remessa por gateway/local) e `after_order_approved_sync` (que sincroniza cliente, métricas, listas) só disparavam em `AFTER UPDATE` quando `payment_status` mudava para `'approved'`. Pedido manual nasce direto com pagamento aprovado (INSERT, sem UPDATE) e por isso ficava órfão: sem rascunho fiscal, sem rascunho de remessa, sem sync de cliente.

## Regra
1. `core-orders.create_order` deve gravar `payment_status='approved'` no DB quando o canônico for `'paid'` (mapa `PAYMENT_CANONICAL_TO_DB.paid = 'approved'`). É o vocabulário escutado pelos triggers.
2. Se admin marcar `payment_status_initial='paid'` sem forçar `order_status_initial`, o `status` do pedido nasce `'ready_to_invoice'` (mesmo destino do checkout aprovado).
3. Triggers `trg_enqueue_fiscal_draft` e `trg_after_order_approved_sync` são `AFTER INSERT OR UPDATE`. A função interna decide via `TG_OP` se deve disparar (INSERT com approved OU UPDATE de não-approved para approved).
4. O roteamento de remessa segue `resolve_order_shipping_provider`: marketplace → nada, gateway → `gateway_sync_queue`, local/manual → `shipping_draft_queue` com `provider = LOWER(TRIM(shipping_carrier))`.

## Anti-regressão
- NUNCA reverter `PAYMENT_CANONICAL_TO_DB.paid` para `'paid'` — quebra paridade com triggers.
- NUNCA voltar `trg_enqueue_fiscal_draft` ou `trg_after_order_approved_sync` para apenas `AFTER UPDATE` — pedido manual fica órfão de novo.
- NUNCA tornar `enqueue_fiscal_draft` específica de fluxo (manual vs automático) — manter um único motor.
- Se adicionar novo downstream de "pedido aprovado" (estoque, contabilidade, etc.), conectar via trigger `AFTER INSERT OR UPDATE` no mesmo padrão.

## Validação obrigatória pós-mudança
1. Criar pedido manual com pagamento=pago via `core-orders.create_order`.
2. Conferir: `SELECT * FROM fiscal_draft_queue WHERE order_id=<id>` retorna 1 linha pending/done.
3. Conferir: `SELECT * FROM shipping_draft_queue WHERE order_id=<id>` retorna 1 linha (ou `gateway_sync_queue` se provedor=gateway).
4. Conferir: `SELECT resolved_shipping_provider_kind FROM orders WHERE id=<id>` está preenchido.

## Arquivos
- `supabase/functions/core-orders/index.ts` (PAYMENT_CANONICAL_TO_DB, finalOrderStatus)
- Migration 2026-05-01 21:06 (triggers AFTER INSERT OR UPDATE)
- `src/components/orders/OrderShippingMethod.tsx` (lista todas integrações ativas, fallback manual quando sem cotação)
