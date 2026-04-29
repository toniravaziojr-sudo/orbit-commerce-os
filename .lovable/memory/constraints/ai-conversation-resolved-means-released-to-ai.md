---
name: AI Conversation Resolved Means Released to AI
description: Encerrar conversa = devolver controle para IA. resolved + assigned_to=NULL é o contrato. Próxima mensagem do cliente reabre automaticamente.
type: constraint
---
# Encerrar conversa = devolver controle para a IA

## Regra
Quando humano clica "Encerrar conversa", a conversa DEVE virar `status=resolved` E `assigned_to=NULL` simultaneamente. NUNCA apenas resolved sem limpar assigned_to.

## Contrato
- `useConversations.updateStatus({status:'resolved'})` zera `assigned_to`, `assigned_at` e carimba `resolved_at`.
- Trigger `handle_conversation_assignment_status` preserva resolved quando assigned_to é limpo (não devolve para waiting_agent).
- Gate `should-ai-respond.ts` NÃO bloqueia status `resolved` (apenas open, waiting_customer, spam).
- `ai-support-chat` reabre `resolved` → `bot` ao receber nova mensagem inbound do cliente quando assigned_to está nulo.

## Por que
Cliente que volta dias depois NÃO pode ficar parado esperando humano novamente. A IA precisa retomar automaticamente. Se algum dos 4 contratos quebrar, conversas resolved viram "buracos negros" silenciosos.

## Como aplicar
- Toda nova lógica que mexer em status `resolved` deve preservar `assigned_to=NULL` no encerramento manual.
- Ao adicionar novos status na conversation, revisar o gate em `should-ai-respond.ts` e a reabertura em `ai-support-chat`.
- Ao mexer em `handle_conversation_assignment_status`, validar que `resolved` + clear assigned_to NÃO regride status.
