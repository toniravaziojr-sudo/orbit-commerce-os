---
name: bot-history-query-must-use-sender-type
description: Queries for previous bot messages in ai-support-chat MUST filter by sender_type='bot', never role='assistant' (which is OpenAI vocab, not the messages table column).
type: constraint
---
A tabela `public.messages` usa `sender_type` ('customer' | 'bot' | 'agent'), não `role`. Em `ai-support-chat/index.ts`, qualquer query para recuperar histórico de mensagens do bot DEVE usar `.eq("sender_type", "bot")`.

O bug anterior usava `.eq("role", "assistant")` (Reg #16 inicial), o que sempre retornava vazio e desativava silenciosamente o gate de anti-repetição semântica.

**Why:** sem isso, gateSemanticRepetition nunca disparou em produção e o loop "Você procura algo específico ou opções?" se repetia indefinidamente (auditoria mai/2026, Reg #17.3).
