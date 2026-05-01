---
name: Order Status Vocabulary Canonical
description: Vocabulário canônico de payment_status e shipping_status deve estar alinhado entre UI, edge core-orders e enums DB. Toda inserção/atualização em orders.payment_status ou orders.shipping_status que não passe pelo edge core-orders precisa usar valores aceitos pelo enum.
type: constraint
---

# Vocabulário Canônico de Status de Pedidos

## Contexto

Antes da migração 2026-05-01, a UI e o `core-orders` usavam vocabulário canônico novo (`paid`, `awaiting_shipment`, `arriving`, `label_generated`, `awaiting_pickup`, `problem`, `returning`, `chargeback_lost`), enquanto o enum DB ainda só aceitava o vocabulário legado (`approved`, `pending`, `out_for_delivery`, `failed`). Resultado: erros `invalid input value for enum` em qualquer caminho que escrevesse direto sem passar pelos tradutores `toDbPaymentStatus` / `toDbShippingStatus`.

A migração `20260501-202836_*.sql` expandiu os enums com `ALTER TYPE … ADD VALUE IF NOT EXISTS` para incluir todos os valores canônicos. Os legados continuam válidos por compat com webhooks de gateways antigos.

## Regra

**Vocabulário oficial (canônico):**
- `payment_status`: `awaiting_payment, paid, declined, cancelled, refunded, under_review, chargeback_requested, chargeback_lost`
- `shipping_status`: `awaiting_shipment, label_generated, shipped, in_transit, arriving, awaiting_pickup, delivered, problem, returning, returned`

**Toda escrita** em `orders.payment_status` e `orders.shipping_status` deve usar valores canônicos, preferencialmente via `core-orders`. Inserções/updates diretos em qualquer outro caminho (edge function, trigger, RPC, script ad-hoc) devem usar canônico — nunca inventar nomes.

**Leitura** continua tolerante a valores legados via `fromDbPaymentStatus` / `fromDbShippingStatus` enquanto houver pedidos antigos no banco.

## Anti-regressão — proibições

- **NUNCA** remover `ADD VALUE` de enum payment_status/shipping_status sem antes garantir que nenhum pedido use o valor.
- **NUNCA** inserir em `orders` com `shipping_status: 'awaiting_shipment'` antes de garantir que o enum aceita esse valor (o `core-orders.create_order` foi corrigido em 2026-05-01 — o bug original era exatamente esse).
- **NUNCA** introduzir um novo valor de status na UI sem adicionar ao enum DB e ao array `PAYMENT_STATUSES`/`SHIPPING_STATUSES` em `core-orders`.
- **NUNCA** comparar `orders.status` (enum) contra `text[]` em `ANY()` sem `::text` cast — vide memória `order-cross-module-sync-on-regression`.

## Validação obrigatória após mudar enum ou tradutor

1. `SELECT '<novo_valor>'::payment_status` deve passar.
2. Criar pedido manual via `core-orders.create_order` sem overrides — deve persistir `awaiting_payment`/`awaiting_shipment`.
3. `UPDATE orders SET payment_status='paid' WHERE id=<test>` direto no DB deve funcionar.
4. Verificar que webhooks de gateways legados (Pagar.me, MercadoPago) continuam gravando seus valores (`approved`, etc.) sem rejeição.

## Arquivos

- Migration: `supabase/migrations/20260501202836_*.sql`
- Edge: `supabase/functions/core-orders/index.ts` (PAYMENT_STATUSES, SHIPPING_STATUSES, tradutores)
- Doc formal: `docs/especificacoes/ecommerce/pedidos.md` §4 (máquina de estados)
