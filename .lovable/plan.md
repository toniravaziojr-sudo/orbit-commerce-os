# Plano Principal — IA de Atendimento (reconstruído 2026-05-02)

## Origem
Plano aprovado em 2026-04-30 / 2026-05-01 com 9 frentes paralelas para sanar problemas observados na conversa Respeite o Homem 14:14 BRT e completar a maturidade da IA de Atendimento (modo informativo + vendas). Reconstruído a partir do histórico de chat (#9727 a #9815) cruzado com `docs/especificacoes/whatsapp/ia-atendimento-changelog.md`.

## Fundação (entregue antes das frentes)
- ✅ Changelog formal vivo: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` (registros #1 a #7 + #2.x).
- ✅ Sandbox "Chat IA (teste)" em `/crm/atendimento` — espelho fiel da produção, 100% efêmero, mesma edge `ai-support-chat` com `test_mode: true`. Bloqueia escrita real (cart/order/leads/messages). Permissão `crm.atendimento.chat_teste_ia` (default owner/admin). Reg #3.

## As 9 frentes (status atual)

| # | Frente | Status | Reg | Observação |
|---|---|---|---|---|
| 9 | Venda IA + Atribuição (badge "Venda IA" + categoria atribuição + trigger DB) | ✅ Validado E2E sintético | #4 | Pendente confirmação real do usuário com cliente pagando |
| 8 | Saudação formal (sem gírias, "Olá + período BRT + tudo bem?", "hoje" para recorrente) | ✅ Aplicado | #5 | Pendente teste no sandbox: "Eai" → resposta formal |
| 2 | Variantes obrigatórias condicionais ao cadastro | ✅ Aplicado | #6 | Pendente validação prática |
| 7 | Fechamento sem loop em intenção confirmada | ✅ Aplicado | #7 | Pendente validação prática |
| 5 | Anti-repetição semântica (família) | ✅ Aplicado em ondas anteriores | #2.5 + #2.10 | Working Memory + Focus Snapshot ativos |
| 3 | Limites do scrubber de saudação (strip iterativo) | ✅ Aplicado | #2.13 | Em observação |
| 6 | Tom robótico residual | ⚠️ Parcial | — | Coberto indiretamente por #5 (saudação formal) — falta auditoria dedicada |
| 4 | Loop de confirmação edge cases | ⚠️ Parcial | — | Coberto por #7 (fechamento sem loop) — falta auditoria de edge cases (ambiguidade no "sim", "fechado") |
| 1 | Sandbox stale (atualização de config sem F5) | ❌ Pendente | — | Não foi atacada; sandbox usa snapshot de config no boot da sessão |
| — | **Reg #8 — Hotfix `customerName` re-resolvido por call site** | ✅ Formalizado 02/mai/2026 | #8 | Memória `greeting-mirror-vars-must-be-declared-at-handler-scope` indexada |

## Pendências formais conhecidas
- **Reg #8 — hotfix `customerName` (variável escopo handler):** já aplicada no código, mas falta virar registro formal no changelog + memória `mem://constraints/greeting-mirror-vars-must-be-declared-at-handler-scope`.
- **Validação prática pelo usuário** das Reg #2.10, #2.11, #2.13, #4, #5, #6, #7 em conversas reais (logs `[Reg #2.x]`, `[Reg #2.8]`, badge "Venda IA" em pedido pago real).

## Próximos passos disponíveis (a definir com o usuário)
1. **Frente 1 — Sandbox stale:** invalidar cache de config quando admin salvar, recarregar snapshot a cada turno.
2. **Frente 4 — Loop de confirmação edge cases:** auditoria de ambiguidades ("sim claro", "fechou", "tá bom") que ainda escapam do `enforceCloseOnConfirmedIntent`.
3. **Frente 6 — Tom robótico residual:** auditoria de respostas longas, listas formais, abertura repetitiva fora do mirror.
4. **Reg #8:** formalizar no changelog + memória anti-regressão.
5. **Validação prática:** rodar bateria pelo sandbox dos cenários cobertos pelas Reg #4 a #7 e relatar logs.

## Por que essa é a forma mais sólida
- Plano original mantém ordem aprovada (9 → 8 → 2 → 7 → 5 → 3 → 6 → 4 → 1).
- Cada frente entregue tem registro formal no changelog + memória anti-regressão indexada — fonte de verdade auditável.
- Sandbox permite validar próximas frentes antes de tocar produção.
- Pendências residuais (#1, #4 parcial, #6 parcial, Reg #8) estão isoladas e não bloqueiam nada já entregue.
