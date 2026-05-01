---
name: AI Test Must Use Sandbox Edge
description: Testes sequenciais de roteiro da IA de Atendimento só são válidos quando passam pela edge ai-test-sandbox; chamar ai-support-chat direto perde isolamento e quebra rastreabilidade.
type: constraint
---

## Regra

Roteiros de teste sequenciais (multi-turno) da IA de Atendimento DEVEM ser executados exclusivamente via edge `ai-test-sandbox` (modo usuário com JWT, ou Agent Mode com `x-agent-mode: true` + service role + tenant Respeite o Homem).

Antes de declarar "teste executado", verificar:
1. A `conversation_id` retornada existe em `public.conversations`.
2. `conversations.metadata.is_sandbox === true`.
3. As mensagens do roteiro estão em `public.messages` com `metadata.is_sandbox=true`.

## Por quê

Reg #2.10: um "teste de 6 turnos" anterior gerou rastros em `ai_support_turn_log` mas a `conversation_id` não existia em `conversations`. Significa que a chamada foi feita direto na `ai-support-chat` (provavelmente passando um UUID inventado), pulando o gate de isolamento. Resultado: nenhuma mensagem persistida, métricas contaminadas se a flag de sandbox não for aplicada, impossível auditar o que a IA respondeu, e conclusões do "teste" ficaram em cima de telemetria parcial.

## Como aplicar

- Local: `supabase/functions/ai-test-sandbox/index.ts` (cria conversa + mensagens com `is_sandbox=true` antes de invocar `ai-support-chat`).
- Quando o teste for automatizado (Agent Mode), verificar que `requestedTenant === d1a4d0ed-8842-495e-b741-540a9a345b25` e que o `Authorization` carrega `SUPABASE_SERVICE_ROLE_KEY`.
- Toda nova ferramenta interna de teste sequencial (CLI, edge auxiliar, script) deve passar pela mesma edge — não criar atalho.
