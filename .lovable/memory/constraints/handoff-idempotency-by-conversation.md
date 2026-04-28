---
name: Handoff Idempotency by Conversation
description: request_human_handoff deve reaproveitar ticket aberto/pending da mesma conversa em vez de criar duplicatas
type: constraint
---

A tool `request_human_handoff` (sales mode WhatsApp e atendimento IA) DEVE ser idempotente por conversa.

**Regra:**
Antes de criar um novo `support_tickets`, consultar tickets com:
- `tenant_id = <tenant>`
- `source_conversation_id = <conversationId>`
- `status IN ('open','pending')`

Se existir, **atualizar** o ticket encontrado (priority + metadata + last_handoff_at) e retornar o mesmo `ticket_id`. NÃO criar novo.

**Por quê:** sem idempotência, a IA pode chamar a tool múltiplas vezes na mesma conversa (mensagens em sequência, retry, gatilhos sobrepostos), gerando dezenas de tickets para o mesmo cliente — inflando a fila de atendimento e quebrando a métrica de handoffs únicos.

**Onde aplica:** `supabase/functions/ai-support-chat/index.ts` no case `request_human_handoff`. Qualquer nova edge function que escale para humano DEVE seguir o mesmo padrão.

**Spec:** `docs/especificacoes/crm/crm-atendimento.md` §4.2.
