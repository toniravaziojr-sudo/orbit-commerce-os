## Resumo da reviravolta

A "regressão estrutural" diagnosticada antes **não existe**. A auditoria completa (banco, código de gateways, ML sync, docs Layer 2/3 e memórias) confirmou:

- **322 pedidos no DB usam `'approved'`**. Único `'paid'` é o **#668**, que **escrevi manualmente** durante a reconciliação, violando a regra oficial.
- **DB armazena `'approved'`** como valor canônico de "pago". `'paid'` é vocabulário **da UI/canônico de borda**, traduzido para `'approved'` pelo `toDbPaymentStatus` em `core-orders`.
- **Docs confirmam** (`erp-fiscal.md` §97-100): gatilho dispara em `NEW.payment_status = 'approved'`. **Consumidores estão corretos**.
- **Memória oficial** `manual-order-must-mirror-checkout-pipeline.md` proíbe explicitamente reverter `PAYMENT_CANONICAL_TO_DB.paid → 'paid'`.

**Causa real do #668 não propagar:** minha escrita manual de `'paid'` no DB.

## Plano de execução

### 1. Corrigir o #668 (alinhar ao padrão DB)
Atualizar via SQL:
- `payment_status: 'paid' → 'approved'`
- Manter `status = 'ready_to_invoice'`, `paid_at` e demais campos como estão.
- Registrar linha em `order_history` com nota `realign_payment_status_paid_to_approved_db_canonical`.

Isso destrava naturalmente:
- `after_order_approved_sync` → enrich_customer_from_order, `total_spent`, tag "Cliente", lista e-mail marketing.
- `fiscal-auto-create-drafts` (próximo tick) → Pedido de Venda → NF → etiqueta ML → Pratika.

Sem mexer em consumidor nenhum.

### 2. Blindar a regra contra repetição do meu erro

**2a. Memória nova** `mem://constraints/payment-status-db-canonical-is-approved`:
- DB armazena `'approved'`; `'paid'` é só canônico de borda (UI/edge).
- Toda escrita administrativa/reconciliação **deve passar por `core-orders.set_payment_status`** (que aplica `toDbPaymentStatus`).
- Proibido `UPDATE orders SET payment_status='paid'` direto no DB.
- Como detectar o erro: `SELECT COUNT(*) FROM orders WHERE payment_status='paid'` deve ser sempre 0.

**2b. Atualização das memórias existentes:**
- Reforçar `order-status-vocabulary-canonical.md`: incluir nota "DB canônico de 'pago' é `'approved'`, não `'paid'`" e referência cruzada à nova memória.

### 3. Documentação formal (Layer 2)

- `docs/especificacoes/ecommerce/pedidos.md` §4: adicionar caixa "Reconciliação manual e backfills" com a regra acima.
- `docs/tecnico/base-de-conhecimento-tecnico.md`: novo item "Anti-regressão — backfill de pagamento" descrevendo o incidente (escrevi `'paid'` direto, travou propagação) e a regra correta.

### 4. Validação técnica obrigatória

Após o UPDATE do #668:
1. `SELECT payment_status, status FROM orders WHERE id='29db1d2d-...'` → deve estar `approved` / `ready_to_invoice`.
2. `SELECT 1 FROM fiscal_draft_queue WHERE order_id='29db1d2d-...'` → linha pending criada pelo trigger.
3. `SELECT total_spent, is_first_sale FROM customers WHERE id=<customer_id_do_668>` → `total_spent > 0` após o trigger rodar.
4. Aguardar próximo tick do cron `fiscal-auto-create-drafts` (5 min): conferir geração de Pedido de Venda e NF.
5. `SELECT COUNT(*) FROM orders WHERE payment_status='paid'` → 0 globalmente.
6. Conferir `edge_logs` por 5 min: nenhum `22P02` nem erro de enum.

### 5. O que NÃO vou fazer (anti-regressão)

- **Não vou padronizar consumidores** para aceitar `'paid'`. Eles estão corretos.
- **Não vou tocar** em webhooks de gateway, `meli-sync-orders`, hooks de dashboard, monitor de chargebacks, `enrich-customers-pagarme`, `process-events`, `useDashboardMetrics`, `usePayments`, `useFinanceEntries`, `AdsRoiReportsTab` — todos filtram `'approved'` corretamente porque é o que o DB armazena.
- **Não vou alterar** `PAYMENT_CANONICAL_TO_DB` nem `toDbPaymentStatus`.

### 6. Pontos de parada (peço sua decisão se aparecer)

- Se ao re-rodar o cron fiscal o #668 falhar por outro motivo (item sem NCM, CPF ausente etc.), paro e te aviso — não é mais do escopo desta correção.
- #667 e #669: já destravados pela correção anterior do gatilho. Próximo tick do `expire-stale-orders` os marca como `payment_expired`. Sem ação manual.

## Estado da entrega

📌 STATUS: Diagnóstico concluído → aguardando aprovação do plano para executar correção pontual + blindagem documental.
