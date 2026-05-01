---
name: Order status manual override policy
description: Política de override administrativo da máquina de estados de Pedidos. Edge core-orders aceita force=true apenas para owner/admin. Frontend abre dialog de confirmação só para transições não naturais.
type: constraint
---

# Política de Override Manual no Status de Pedidos

## Contexto
A edge `core-orders` valida transições por máquina de estados (`ORDER_TRANSITIONS`, `PAYMENT_TRANSITIONS`, `SHIPPING_TRANSITIONS`). Estados terminais (`payment_expired`, `cancelled`, `returning`, `invoice_cancelled`, `chargeback_lost`) não têm saída. Sem override, admin não conseguia corrigir manualmente status de pedidos parados nesses estados — universal, não específico de tenant.

## Regra
1. **Fluxo automático (sem `force`)** — webhooks, crons, automações continuam barrados pela máquina rígida. NÃO MUDAR esse comportamento.
2. **Override admin (`force: true`)** — `set_order_status`, `set_payment_status`, `set_shipping_status` aceitam `force` no body:
   - Apenas `owner` ou `admin` (NUNCA `operator`).
   - Pula `isValidTransition`.
   - Audit log com `action: 'set_*_status_override'` e `manual_override: true` em `after_json`.
   - `order_history` recebe prefixo `[OVERRIDE ADMIN]` na descrição.
   - Evento `order.*_status_changed` carrega `is_manual_override: true` no payload — consumidores externos decidem se reagem.
3. **Frontend** — `OrderDetail.tsx` espelha a máquina em `src/lib/orderTransitions.ts` (apenas para detectar transição não natural). Quando não natural:
   - Se role permite → abre `OrderStatusOverrideDialog` listando consequências; após confirmar, chama mutation com `force: true`.
   - Se role não permite → toast de erro.
4. **Status órfãos** — `chargeback_detected` e `chargeback_lost` DEVEM permanecer em `ORDER_STATUSES` da edge e na cópia client em `orderTransitions.ts`. `under_review` DEVE permanecer em `PAYMENT_STATUSES`.

## Anti-regressão
- NUNCA aceitar `force: true` sem checar role no servidor (bypass de privilégio).
- NUNCA expor `force` em chamadas automáticas (webhooks, crons). Usar somente em ação manual do admin.
- Se adicionar/alterar transição na edge, espelhar em `src/lib/orderTransitions.ts`.
- Se aparecer novo status no enum do banco, adicionar em `ORDER_STATUSES`/`PAYMENT_STATUSES`/`SHIPPING_STATUSES` da edge E no espelho client.
- Fonte de verdade da validação é o servidor; o client só decide se mostra dialog.

## Arquivos
- `supabase/functions/core-orders/index.ts` (handlers + transitions)
- `src/lib/coreApi.ts` (`force` opcional em setOrderStatus/setPaymentStatus/setShippingStatus)
- `src/hooks/useOrders.ts` (mutations propagam `force`)
- `src/lib/orderTransitions.ts` (espelho client)
- `src/components/orders/OrderStatusOverrideDialog.tsx`
- `src/pages/OrderDetail.tsx` (integração)
- Doc: `docs/especificacoes/ecommerce/pedidos.md` seção 4 (Máquina de Estados)
