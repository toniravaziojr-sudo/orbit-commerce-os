---
name: Order cancellation requires metadata (DB guard)
description: Toda transição de orders.status para 'cancelled'/'cancelled_by_user' exige cancelled_at + cancellation_reason preenchidos na mesma operação. Trigger trg_guard_order_cancellation_metadata em public.orders bloqueia UPDATEs incompletos (inclui scripts, console e manutenção manual).
type: constraint
---

# Cancelamento de pedido exige metadata

## Regra inegociável (2026-06-11)

Gatilho `trg_guard_order_cancellation_metadata` (BEFORE UPDATE OF status em
`public.orders`) chama `public.guard_order_cancellation_requires_metadata()`
e rejeita a operação quando:

- `NEW.status::text IN ('cancelled','cancelled_by_user')`
- `OLD.status::text NOT IN ('cancelled','cancelled_by_user')`
- E qualquer um dos campos abaixo está faltando:
  - `NEW.cancelled_at IS NULL`
  - `NEW.cancellation_reason IS NULL` ou string vazia

Erro disparado: `ORDER_CANCEL_REQUIRES_METADATA: ...` com `ERRCODE = 42501`.
Mensagem em PT-BR voltada ao operador.

## Por que existe

Incidente 2026-06-10 22:07 BRT: um `UPDATE` direto no banco durante limpeza de
dados de teste pegou o pedido real #607 (Patrick, pago/aprovado) e marcou como
`cancelled` sem `cancelled_at`, sem `cancellation_reason` e sem entrada em
`order_history`. A cascata oficial então apagou o PV 413 e o objeto de
postagem. Sem rastro, sem auditoria, sem reversão fácil.

A trava garante que qualquer caminho que tente mudar o status para cancelado
— aplicação, edge function, cron, script manual, manutenção via console —
**precisa** carregar o motivo e a data. Fluxos legítimos já fazem isso; só
operações descuidadas são bloqueadas.

## O que NUNCA pode acontecer

- Remover o gatilho ou a função sem substituir por mecanismo equivalente.
- Tornar a validação opcional via flag/parâmetro.
- Permitir `cancellation_reason` vazio/whitespace.
- Adicionar novo estado terminal de cancelamento sem incluí-lo na lista da
  função.
- Bypass por SECURITY DEFINER em outra função sem replicar a validação.

## Como aplicar em código novo

Toda rota nova que cancele pedido (webhook de gateway, cron de expiração,
ação manual na UI, edge function de estorno) DEVE setar, na mesma UPDATE:

```sql
UPDATE public.orders
SET status = 'cancelled',
    cancelled_at = now(),
    cancellation_reason = '<motivo legível em PT-BR>'
WHERE id = ...;
```

E registrar a transição em `order_history` no mesmo fluxo (regra já coberta
por `mem://constraints/order-cross-module-sync-on-regression`).

## Arquivos

- Migração: `supabase/migrations/*guard_order_cancellation_metadata*.sql`
  (2026-06-11).
- Função: `public.guard_order_cancellation_requires_metadata()`.
- Gatilho: `trg_guard_order_cancellation_metadata` em `public.orders`.
- Doc formal: `docs/especificacoes/ecommerce/pedidos.md` §"Trava de
  cancelamento" (a atualizar).
- Memórias relacionadas:
  - `mem://constraints/order-cross-module-sync-on-regression`
  - `mem://constraints/order-deletion-cancel-only-and-cascade-cleanup`
  - `mem://constraints/pv-from-paid-order-deletion-protected`
