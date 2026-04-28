---
name: Ambiguous Input Pre-Model Detector
description: Mensagens degeneradas do cliente devem ser interceptadas antes do modelo, com handoff após 3 ocorrências
type: constraint
---

O orquestrador `ai-support-chat` DEVE interceptar inputs degenerados ANTES de chamar o modelo.

**Definição de input degenerado:**
- texto vazio após trim
- nenhum caractere `[\p{L}\p{N}]` (só pontuação/emoji/símbolos)
- menos de 2 caracteres alfanuméricos latinos

**Quando aplica:** apenas em conversas com mais de 5 mensagens trocadas. Conversas novas seguem o fluxo de saudação normal (saudações curtas como "oi" não devem cair aqui).

**Comportamento:**
- 1ª e 2ª ocorrência seguida: responder "Não entendi sua última mensagem, pode reescrever, por favor?" SEM alterar `sales_state`. Incrementar `conversations.metadata.ambiguous_input_count`.
- 3ª ocorrência seguida: handoff idempotente por conversa com `reason='ambiguous_input'`. Conversa vai para `status='waiting_agent'`. Contador zera.
- Qualquer mensagem compreensível: contador zera.

**Por quê:** sem este detector, mensagens "..." ou "👍" sem contexto entram no modelo e geram respostas alucinadas, repetições, ou loops infinitos. O custo em tokens é desperdiçado e o cliente fica frustrado.

**Onde aplica:** `supabase/functions/ai-support-chat/index.ts`, logo após o D7 Media Gate e antes da classificação de intent. Spec: `docs/especificacoes/crm/crm-atendimento.md` §4.8.
