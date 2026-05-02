---
name: mid-thread-detection-must-use-sender-type-bot
description: Cálculo de greetIsMidThread no ai-support-chat MUST filtrar messages por sender_type==='bot', nunca por role==='assistant' (que é vocab OpenAI, não coluna da tabela messages).
type: constraint
---

A tabela `public.messages` usa `sender_type` ('customer' | 'bot' | 'agent'), nunca `role`. Em `supabase/functions/ai-support-chat/index.ts`, o cálculo de `greetIsMidThread` (Reg #14 — saudação no meio da thread não pode reabrir contexto) DEVE filtrar `messages.filter(m => m.sender_type === "bot")` para encontrar a última resposta do bot.

O bug original (até Reg #17.6) usava `m.role === "assistant"`, que NUNCA matchava (coluna inexistente). Resultado: `greetIsMidThread = false` permanente, gate `gateGreetingMirror` nunca aplicava o "Oi de novo. Em que posso continuar te ajudando?", e a IA reabria saudação completa ("Olá, boa noite, tudo bem? Como posso ajudar? Me conta o que está procurando.") toda vez que cliente digitava "Boa noite!" no meio da conversa.

**Pontos de atenção (todos no mesmo arquivo):**
1. Cálculo principal de `greetIsMidThread` antes do primeiro `gateGreetingMirror`.
2. Bloco pós-regeneração — recalcular `_greetIsMidThread` localmente E passar nos dois gates (`gateGreetingMirror` e `gateGreetingMirrorFallback`).

**Why:** auditoria Onda 17 (mai/2026) confirmou em sandbox que cliente após 2 turnos sobre shampoo digitou "Boa noite!" e recebeu saudação cheia ignorando contexto. Mesma família de bug da Reg #17.3 (`recentBotMessages` query) — qualquer leitura de histórico do bot dentro de `ai-support-chat` segue a mesma regra: `sender_type='bot'`, jamais `role='assistant'`.
