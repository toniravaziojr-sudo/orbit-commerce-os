---
name: Turn Orchestrator — turno consolidado é fonte única para roteamento
description: Em chamadas orquestradas, lastMessageContent DEVE ser substituído pelo agregado das mensagens do buffer antes de TPR/state/greeting/sales/prompt.
type: constraint
---

Em `supabase/functions/ai-support-chat/index.ts`, quando `isOrchestratorCall=true`, o código DEVE consolidar as mensagens do buffer (snapshot_message_ids) em um único texto e SOBRESCREVER `lastMessageContent` ANTES de:

- TPR (`classifyTurn`)
- detector de input degenerado / ambiguous_input
- `decideNextState` / state machine
- greeting detection (`isPureGreeting`) e greeting mirror (`detectGreetingEcho`)
- sales trigger / `detectInformationalProductQuestion` / `detectFamilyMentioned`
- product/family focus
- prompt principal e tools (`search_products`)

**Por quê:** sem isso, "?" sozinho como última msg cai em greeting/ambíguo e a IA ignora a dor declarada nos fragmentos anteriores ("tenho entradas", "esse shampoo serve"). Incidente real WhatsApp 02/mai/2026 → resposta "Olá, Burst, boa noite, tudo bem? Como posso ajudar hoje?".

**Sinal de regressão:** bot responde greeting genérico em turno multi-mensagem com dor/produto/pergunta declarados.

**Nota:** placeholders de teste (`burst`, `sandbox`, `dry_run`) estão na lista `looksGenericOrCorporate` para nunca virarem vocativo.
