---
name: Recent topics (rotativo, máx 2)
description: Cache rotativo dos 2 últimos assuntos tratados. Não é fonte de verdade — só ponteiro para retomar trabalho.
type: reference
---

# Assuntos recentes (rotativo)

## 1) IA de Atendimento — Plano principal (RETOMADA EM ANDAMENTO)
- Status: Plano vivo. Frentes 1 (Reg #2.8 a #2.13), 2 (Reg #6 — variantes obrigatórias) e 3 (Reg #7 — fechamento sem loop) aplicadas e em validação. Frente 2.10 (Focus Snapshot + Exact Match) aplicada e em observação.
- Doc formal único: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (706 linhas, registros #1 a #7 + #2.x).
- Pendências conhecidas:
  - Hotfix `customerName` precisa virar memória `mem://constraints/greeting-mirror-vars-must-be-declared-at-handler-scope` e entrar como Reg #8 no changelog (citado em recent-topics anterior, ainda aberto).
  - Validação prática das Reg #2.10/#2.11/#2.13 em conversas reais (logs `[Reg #2.10]`, `[Reg #2.8]`, etc.).
  - Confirmar com usuário próximas frentes do plano principal (Frente 4+ ainda não definida).

## 2) Pedidos — Plano de Pedido Manual + Estorno Multi-Gateway (ENCERRADO)
- Status: ✅ Concluído e validado em 2026-05-01.
- Entregas: enums canônicos alinhados, `core-orders.create_order` com overrides, tela Novo Pedido refatorada, estorno real PagBank/Pagar.me/Mercado Pago, espelhamento de pedido manual no fluxo automático (fila fiscal + remessa).
- Memórias indexadas: `order-status-vocabulary-canonical`, `order-status-manual-override-policy`, `manual-order-must-mirror-checkout-pipeline`, `refund-multi-gateway-admin-only`.
- Sem pendências.
