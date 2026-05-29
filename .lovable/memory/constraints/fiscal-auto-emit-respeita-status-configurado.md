---
name: Fiscal Auto-Emit Respeita emitir_apos_status
description: A auto-emissão de NF-e deve respeitar fiscal_settings.emitir_apos_status; nunca disparar fiscal-emit só porque o pedido virou pago quando o tenant escolheu 'ready_to_invoice'.
type: constraint
---

# Fiscal Auto-Emit — Respeitar emitir_apos_status

## Regra
`fiscal-auto-create-drafts` só pode invocar `fiscal-emit` quando TODAS as condições forem verdadeiras:
1. Emissor fiscal totalmente configurado (`isFiscalConfigured`).
2. `fiscal_settings.emissao_automatica === true`.
3. `numero > 0` (numeração válida atribuída ao rascunho).
4. **Status do pedido casa com `fiscal_settings.emitir_apos_status`:**
   - `'paid'` (legado) → dispara se `order.status IN ('paid','ready_to_invoice')`.
   - `'ready_to_invoice'` (padrão UI) → dispara SOMENTE quando `order.status='ready_to_invoice'`.

## Por quê
Antes desta regra (até 2026-05-29), o auto-emit disparava em qualquer pedido pago, ignorando a configuração escolhida pelo tenant. Isso violava o contrato da UI ("Emitir NF-e quando…") e podia gerar emissão prematura para tenants que dependem da revisão manual antes do faturamento.

## Como aplicar
- Rascunho de Pedido de Venda continua sendo criado sempre que o emissor está configurado (independe do toggle de auto-emit).
- A decisão de emitir é uma segunda etapa dentro de `fiscal-auto-create-drafts` (modo TRIGGER e CRON).
- Quando o pedido transita posteriormente para `ready_to_invoice` vindo de outro status, o gatilho `enqueue_fiscal_draft` re-enfileira o pedido. O consumidor detecta o rascunho já existente e dispara `fiscal-emit` no rascunho previamente criado, sem duplicar.
- Não criar cron novo para isto: o fluxo é 100% event-driven a partir do gatilho de pedidos. Toggle desligado = zero chamadas externas.

## Anti-regressão
- Qualquer alteração em `enqueue_fiscal_draft` deve preservar:
  - Re-enfileiramento na transição → `ready_to_invoice`.
  - Não duplicar rascunhos (`ON CONFLICT (order_id) DO NOTHING`).
- Qualquer alteração em `fiscal-auto-create-drafts` deve preservar:
  - A re-avaliação de auto-emit em rascunhos já existentes (loop `ordersWithExistingDraft`).
  - A checagem combinada das 4 condições acima antes de invocar `fiscal-emit`.

## Validação obrigatória ao mexer no fluxo
1. Tenant com `emitir_apos_status='ready_to_invoice'` + pedido pago → rascunho criado, **sem** chamada a `fiscal-emit` nos logs.
2. Mesmo pedido transita para `ready_to_invoice` → log "Auto-emit (rascunho existente) disparado".
3. Tenant com `emitir_apos_status='paid'` → emissão dispara já no pagamento.
4. `emissao_automatica=false` → nenhuma chamada a `fiscal-emit` em nenhum cenário.
