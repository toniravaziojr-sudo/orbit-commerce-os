---
name: Payment Status DB Canonical Is Approved
description: Em orders.payment_status o valor de banco para "pago" é 'approved', NÃO 'paid'. 'paid' é canônico de borda (UI/edge). Reconciliações/backfills devem passar por core-orders.set_payment_status (que aplica toDbPaymentStatus); UPDATE direto com 'paid' trava propagação de gatilhos e cron fiscal.
type: constraint
---

# Pagamento Aprovado — Canônico de Banco é `approved`

## Contexto

Em 2026-06-30, o pedido #668 (tenant Respeite o Homem) foi reconciliado manualmente via `UPDATE orders SET payment_status='paid'`. O enum aceita `paid` (memória `order-status-vocabulary-canonical` documenta a expansão de 2026-05-01), então a escrita não falhou. Porém, NADA propagou:

- Gatilho `after_order_approved_sync` não disparou → `customers.total_spent` ficou em 0, tag "Cliente" não aplicada, lista e-mail marketing não recebeu o contato.
- Trigger `enqueue_fiscal_draft` enfileirou (usa helper tolerante `is_payment_approved`), mas o cron `fiscal-auto-create-drafts` filtra estritamente `payment_status = 'approved'` → varredura retornou 0 e a fila foi marcada `done` sem gerar Pedido de Venda → sem PV, sem NF, sem etiqueta ML, sem Pratika.

## Causa

DB armazena `'approved'` como valor canônico de "pago" (322 dos 322 pedidos pagos do projeto). `'paid'` é vocabulário **canônico de borda** (UI, edge `core-orders`), traduzido para DB por `PAYMENT_CANONICAL_TO_DB` em `supabase/functions/core-orders/index.ts`. Todos os consumidores a jusante (gatilhos, crons, hooks de dashboard, finance, ads ROI, monitor de chargeback) filtram literalmente `'approved'` — e estão **corretos**, porque é o que o DB efetivamente contém.

## Regra

- **Escrita administrativa, reconciliação, backfill, script ad-hoc** em `orders.payment_status` para marcar pagamento aprovado: usar **`'approved'`** (canônico de banco) ou, melhor ainda, chamar `core-orders.set_payment_status` com canônico de borda (`'paid'`) — o edge faz a tradução.
- **Proibido** `UPDATE orders SET payment_status='paid'` direto no banco. Aceita silenciosamente e quebra propagação.
- **Webhooks de gateway** (Pagar.me, PagBank, Mercado Pago, ML sync): já gravam `'approved'` — não tocar.

## Anti-regressão — detecção

Query universal de auditoria:

```sql
SELECT COUNT(*) FROM orders WHERE payment_status = 'paid';
-- esperado: 0 em qualquer ambiente saudável
```

Qualquer pedido com `payment_status='paid'` é um backfill incorreto; realinhar para `'approved'` destrava propagação naturalmente.

## Referências cruzadas

- `mem://constraints/order-status-vocabulary-canonical` — vocabulário canônico geral e tradutores.
- `mem://constraints/manual-order-must-mirror-checkout-pipeline` — proíbe reverter `PAYMENT_CANONICAL_TO_DB.paid → 'paid'` no `core-orders`.
- `docs/especificacoes/ecommerce/pedidos.md` §4 — máquina de estados e regra de reconciliação manual.
- `docs/especificacoes/erp/erp-fiscal.md` §97-100 — gatilho `enqueue_fiscal_draft` filtra `'approved'`.
- `docs/tecnico/base-de-conhecimento-tecnico.md` — anti-regressão de backfill de pagamento.

## Arquivos-chave

- `supabase/functions/core-orders/index.ts` — `PAYMENT_CANONICAL_TO_DB`, `toDbPaymentStatus`, `set_payment_status`.
- `supabase/functions/fiscal-auto-create-drafts/index.ts` — filtros `payment_status = 'approved'`.
- Gatilho DB `after_order_approved_sync` — dispara em `NEW.payment_status = 'approved'`.
