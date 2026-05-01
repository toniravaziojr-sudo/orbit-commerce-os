---
name: Recent topics (rotativo, máx 2)
description: Cache rotativo dos 2 últimos assuntos tratados. Não é fonte de verdade — só ponteiro para retomar trabalho.
type: reference
---

# Assuntos recentes (rotativo)

## 1) IA Atendimento — Frente 3 (fechamento sem loop) — EM VALIDAÇÃO
- Status: Ajuste aplicado, validação parcial.
- O que foi feito:
  - Auto-Ready em `ai-support-chat/index.ts` (libera FIX-B mesmo com carrinho vazio quando há 1 produto apresentado/foco).
  - `enforceCloseOnConfirmedIntent` em `_shared/sales-pipeline/output-gates.ts` (rede de segurança que marca `semanticDuplicateDetected` para forçar regeneração com `tool_choice`).
  - Hotfix: `ReferenceError: customerName is not defined` (linhas 4280 e 6437/6446) — variáveis declaradas em `try` reusadas fora do escopo. Corrigido referenciando `conversation.customer_name` direto.
  - Doc: Reg #7 em `docs/especificacoes/whatsapp/ia-atendimento-changelog.md`.
  - Memória: `mem://constraints/ai-close-on-confirmed-intent-no-loop.md`.
- O que falta validar (próximo turno):
  - Roteiro completo do tenant Respeite o Homem via `ai-test-sandbox` Agent Mode: turno 1 saudação ✅, turno 2 (descoberta de produto) interrompido por timeout do conector de teste, turnos 3+ (recomendação → confirmação → fechamento) NÃO validados.
  - Verificar log `[Frente 3] checkout_auto_ready` e `[Frente 3] close_loop_detected` em produção.
- Pendência documental:
  - Registrar Reg #8 (hotfix `customerName`) no changelog.
  - Criar `mem://constraints/greeting-mirror-vars-must-be-declared-at-handler-scope.md`.

## 2) Pedidos — alteração manual de status NÃO funciona (NOVO — em diagnóstico)
- Reportado em: tenant amazgan.
- Suspeita do usuário: regressão universal (não pode ser específica de tenant).
- A investigar: RLS de `orders` (UPDATE), trigger que possa estar bloqueando, lógica de UI/edge.
