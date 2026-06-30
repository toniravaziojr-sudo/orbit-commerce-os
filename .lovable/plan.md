## Causa raiz (confirmada no banco agora)

A função do gatilho `cancel_meli_invoice_queue_on_order_cancel` (cancela a fila de envio de NF do Mercado Livre quando o pedido vira "cancelled") compara o status antigo assim:

```
COALESCE(OLD.status, '') <> 'cancelled'
```

`OLD.status` é do enum `order_status`. O literal `''` não é valor válido desse enum e o Postgres não consegue resolver o tipo da comparação. Resultado: `ERROR 22P02 invalid input value for enum order_status: ""`. Como o gatilho dispara em **toda** UPDATE em `public.orders`, qualquer mudança no pedido falha — webhook de pagamento, cron de expiração, ações manuais. Por isso:

- #668 (Fabricio): o webhook Pagar.me recebeu o pagamento (entrada existe em `payment_transactions`), mas o UPDATE em `orders` foi revertido. Continua "Aguardando pagamento".
- #667 e #669: cron de expiração também não consegue marcar como expirado pelo mesmo motivo.

As outras duas funções da mesma família (`guard_order_cancellation_requires_metadata`, `enqueue_fiscal_draft`) já usam `OLD.status::text` corretamente — só esta ficou com o padrão antigo. É um único ponto de falha.

## Análise de regressão

Trocar `COALESCE(OLD.status, '') <> 'cancelled'` por `OLD.status IS DISTINCT FROM 'cancelled'`:

- `OLD.status = 'cancelled'` → não dispara (idempotente, igual antes).
- `OLD.status` = qualquer outro valor → dispara (igual antes).
- `OLD.status` NULL (não acontece — coluna é NOT NULL) → dispara.

Comportamento semântico **idêntico**. Não toca enums, RLS, permissões, gatilhos vizinhos, fila ML, cascata de cancelamento do comprador, fluxo Pratika, NF marketplace nem UI. Conforme a memória `order-cross-module-sync-on-regression`, é o padrão técnico oficial pra comparar enum com literal sem cast implícito.

## Execução (3 passos)

### 1. Migração — corrigir o gatilho
Recriar apenas `cancel_meli_invoice_queue_on_order_cancel` trocando a condição do IF para:
```
IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
```
Resto da função inalterado. Sem `DROP TRIGGER`/`CREATE TRIGGER` — `CREATE OR REPLACE FUNCTION` basta.

### 2. Destravar o #668 (já está pago na Pagar.me)
Após o gatilho corrigido, ler `payment_transactions` do #668 e aplicar no pedido, em UPDATE único:
- `payment_status = 'paid'` (vocabulário canônico — memória `order-status-vocabulary-canonical`)
- `status = 'ready_to_invoice'`
- `paid_at` = `paid_at` da transação aprovada
- `payment_gateway = 'pagarme'`, `payment_gateway_id` = id da transação
Registrar linha em `order_history` com nota `backfill_pagarme_webhook_stuck_22P02`. Isso aciona naturalmente `enqueue_fiscal_draft` → fila fiscal → NF → etiqueta ML.

#667 e #669 não precisam de intervenção manual: ficaram em `awaiting_payment` porque o cron não conseguiu rodar — na próxima execução do `expire-stale-orders` eles vão para `payment_expired` corretamente.

### 3. Validação técnica
- `UPDATE orders SET updated_at = now() WHERE id = '<um pedido recente>'` → deve passar sem `22P02`.
- Conferir #668: `status='ready_to_invoice'`, `payment_status='paid'`, `paid_at` preenchido, e que existe linha em `fiscal_draft_queue` para o pedido.
- Acompanhar próximo tick do cron de expiração e confirmar #667/#669 em `payment_expired`.
- Rodar log de `edge_logs` do Postgres por 5 min para confirmar que `22P02` sumiu globalmente.

## O que pode dar conflito (peço sua decisão se aparecer)

- Se o #668 já tiver gerado **outra** transação aprovada além da que o webhook tentou registrar (cliente pagou duas vezes), eu paro o backfill e te aviso antes de mexer — não vou consolidar pagamento duplicado por conta própria.
- Não vou tocar em UI/UX nem mudar contratos. Mudança é só na função do banco e no dado do #668.

## Documentação

- Atualizar `docs/especificacoes/ecommerce/pedidos.md` §4.6 com o padrão obrigatório `OLD.status IS DISTINCT FROM ...` ou `OLD.status::text` para qualquer trigger novo em `public.orders`.
- Adicionar entrada em `docs/tecnico/base-de-conhecimento-tecnico.md`: "Enum vs literal vazio em trigger de orders → 22P02; padrão oficial."
- Sem nova memória — já coberto pelas memórias `order-cross-module-sync-on-regression` e `order-status-vocabulary-canonical`. Vou só reforçar a existente `order-cross-module-sync-on-regression` se for necessário (sem duplicar).

## Detalhes técnicos

- Arquivos: 1 migração SQL (recriação da função) + 1 INSERT/UPDATE pontual para o #668.
- Zero mudança em edge functions, hooks, componentes, RLS, enums ou tipos do front.
- Sem rebuild/restart necessários no front.
