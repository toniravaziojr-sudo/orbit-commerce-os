---
name: Recent topics (rotativo, máx 2)
description: Cache rotativo dos 2 últimos assuntos tratados. Não é fonte de verdade — só ponteiro para retomar trabalho.
type: reference
---

# Assuntos recentes (rotativo)

## 1) IA de Atendimento — Plano principal de 9 frentes (RETOMADA EM ANDAMENTO)
- Status: 6 frentes entregues (9, 8, 2, 7, 5, 3); 2 parciais (6, 4); 1 pendente (1 — sandbox stale); Reg #8 (`customerName`) por formalizar.
- Plano completo: `.lovable/plan.md` (reconstruído 2026-05-02 a partir do chat #9727-#9815 + changelog formal).
- Doc fonte de verdade: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (Reg #1 a #7 + #2.x).
- Próximo passo: aguardando usuário escolher entre Frente 1 (sandbox stale), Frente 4 (loop confirmação edge cases), Frente 6 (tom robótico), Reg #8 (formalizar) ou rodar validação prática pelo sandbox.
- Memórias técnicas chave: `sales-pipeline-tpr-and-output-gates` (#2.8), `sales-pipeline-v2-9-working-memory-shadow-mode`, `sales-pipeline-v2-10-focus-snapshot-and-exact-match`, `sales-attribution-venda-ia-tag` (#4), `greeting-formal-tone-no-slang` (#5).

## 2) Pedidos — Plano de Pedido Manual + Estorno Multi-Gateway (ENCERRADO)
- Status: ✅ Concluído e validado em 2026-05-01.
- Entregas: enums canônicos, `core-orders.create_order` com overrides, tela Novo Pedido refatorada, estorno real PagBank/Pagar.me/Mercado Pago, espelhamento de pedido manual no fluxo automático (fila fiscal + remessa).
- Memórias indexadas: `order-status-vocabulary-canonical`, `order-status-manual-override-policy`, `manual-order-must-mirror-checkout-pipeline`, `refund-multi-gateway-admin-only`.
- Sem pendências.
