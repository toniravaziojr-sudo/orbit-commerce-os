---
name: empty-response-fallback-must-route-by-intent
description: Empty AI response fallback in ai-support-chat MUST route by intent (handoff for actionable, media prompt for media inbound), never use a universal discovery muleta.
type: constraint
---
Quando o modelo retorna conteúdo vazio em `ai-support-chat/index.ts`, o fallback NUNCA pode ser uma frase universal de descoberta ("Deixa eu entender melhor. Você procura algo específico ou quer ver opções?"). Esse padrão criava muleta que mascarava reclamações, pedidos de ação e mídia recebida.

**Regra (Reg #17.1):** o fallback de resposta vazia DEVE rotear por intenção:
1. Se `intentClassification.intent` é `complaint` ou `action_request` (ou `requires_action=true`) e nenhuma tool de ação rodou → forçar handoff humano (`shouldHandoff=true`).
2. Se o último inbound do cliente é mídia (image/audio/document) e não há vision tool → pedir descrição em texto.
3. Caso contrário, usar fallback do `pipelineState` (sem catch-all genérico).

**Why:** muleta universal silenciava reclamações e gerava loop semântico repetitivo (auditoria Respeite o Homem, mai/2026).
