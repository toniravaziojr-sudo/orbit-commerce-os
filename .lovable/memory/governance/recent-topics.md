---
name: Recent topics (rotativo, máx 2)
description: Cache rotativo dos 2 últimos assuntos tratados. Não é fonte de verdade — só ponteiro para retomar trabalho.
type: reference
---

# Assuntos recentes (rotativo)

## 1) Pedidos — Override Administrativo de Status — AJUSTE APLICADO
- Status: 📌 Ajuste aplicado — pendente de validação prática pelo usuário.
- Problema original: tenant amazgan não conseguia alterar manualmente status de pedido travado em estado terminal (`payment_expired`, `cancelled`, `invoice_cancelled`, `chargeback_lost`). Regressão universal: máquina de estados de `core-orders` não tinha rota de saída desses estados e tratava admin = webhook.
- Solução (Opção 1 — Override com Defesa em Camadas):
  - Edge `core-orders/index.ts`: adicionados statuses faltantes (`chargeback_detected`, `chargeback_lost`, `under_review`); novo parâmetro `force: true` em `set_order_status`/`set_payment_status`/`set_shipping_status` que pula `isValidTransition` apenas para `owner`/`admin`. Auditoria com prefixo `[OVERRIDE ADMIN]` e flag `is_manual_override: true` no evento.
  - Frontend: `src/lib/orderTransitions.ts` (espelho client da máquina), `src/components/orders/OrderStatusOverrideDialog.tsx` (avisa consequências), `src/pages/OrderDetail.tsx` integrado, `src/hooks/useOrders.ts` + `src/lib/coreApi.ts` propagam `force`.
  - Doc: `docs/especificacoes/ecommerce/pedidos.md` seção 5.2 reescrita (5.2.1 Fluxo Automático, 5.2.2 Override Admin, 5.2.3 Enum completo).
  - Memória: `mem://constraints/order-status-manual-override-policy.md` indexada.
- Pendente de validação:
  - Usuário precisa testar no tenant amazgan: abrir pedido travado, mudar status manualmente — dialog deve aparecer, override deve aplicar, history deve registrar `[OVERRIDE ADMIN]`.
  - Validar que webhook de pagamento ainda é barrado (sem `force` chegando dele).

## 2) IA Atendimento — Frente 3 (fechamento sem loop) — EM VALIDAÇÃO
- Status: Ajuste aplicado, validação parcial (ver memória `mem://constraints/ai-close-on-confirmed-intent-no-loop`).
- Pendência documental: Reg #8 (hotfix `customerName`) no changelog + memória `mem://constraints/greeting-mirror-vars-must-be-declared-at-handler-scope.md`.
