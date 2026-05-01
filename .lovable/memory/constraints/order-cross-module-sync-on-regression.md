---
name: Order Cross-Module Sync on Regression
description: Toda transição de pedido para estado regressivo (cancelled, returned, chargeback_*, payment_expired, invoice_cancelled) DEVE marcar requires_action em fiscal_invoices/shipments, cancelar rascunhos pendentes e reverter métricas do cliente. Pipeline obrigatório de 3 camadas (triggers DB + order-regression-handler + UI).
type: constraint
---

**Estados regressivos canônicos:** `cancelled`, `returned`, `returning`, `chargeback_detected`, `chargeback_lost`, `payment_expired`, `invoice_cancelled`.

**Pipeline obrigatório (NÃO REMOVER NENHUMA CAMADA):**

1. **Triggers DB em `public.orders`** (defesa primária, sempre executa):
   - `handle_order_fiscal_alert` → `fiscal_invoices.requires_action = true` em NF-e `authorized`.
   - `handle_order_shipping_alert` → `shipments.requires_action = true` em remessas não entregues.
   - `cancel_pending_drafts_on_regression` → `status='cancelled'` + `cancelled_at` + `cancel_reason='order_regression:<motivo>'` em `fiscal_draft_queue`, `shipping_draft_queue`, `gateway_sync_queue`.
   - `handle_customer_regression` → dispara `recalc_customer_metrics` para reverter tags/métricas.

2. **Edge function `order-regression-handler`** (reforço idempotente): chamada fire-and-forget pelo `core-orders` em toda transição regressiva manual/automática, e por webhooks (chargeback/estorno) e cron `expire-stale-orders`. Reaplica as marcações acima e registra `regression_handled` em `order_history`.

3. **UI (sinalização visível):**
   - `OrderRegressionBanner` em `OrderDetail.tsx` lê `requires_action` e mostra ação manual.
   - `useExecutionCounts` expõe stats `Etiquetas a reverter` (card Pedidos) e `NF-e a cancelar (regressão)` (card Notas Fiscais) na Central de Execuções.

**Princípio fundamental:** automação **sinaliza** — não cancela NF-e autorizada nem etiqueta despachada automaticamente. A bandeira `requires_action` só é limpa por ação humana (`fiscal-cancel` para NF-e; ação na tela de Remessas para etiqueta).

**Por que existe:** antes desta regra, NF-e ficava válida para venda inexistente, etiquetas iam para os Correios em pedidos cancelados, métricas de cliente ficavam infladas e rascunhos órfãos travavam as filas. Risco fiscal + logístico + financeiro real.

**Anti-regressão — proibições:**
- Nunca remover qualquer um dos 4 triggers DB.
- Nunca tornar `order-regression-handler` síncrono/bloqueante (fire-and-forget).
- Nunca cancelar NF-e autorizada ou etiqueta despachada automaticamente.
- Nunca limpar `requires_action` por trigger ou cron — só ação humana.
- Toda nova rota de mudança de status (novo webhook, novo cron) DEVE chamar `order-regression-handler` se transicionar para estado regressivo.

**Docs formais:** `docs/especificacoes/ecommerce/pedidos.md` §4.6, `docs/especificacoes/erp/erp-fiscal.md`, `docs/especificacoes/erp/logistica.md`.
