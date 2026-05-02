---
name: Saudação não reseta thread ativa (Reg #14)
description: Se a última mensagem do bot tem menos de 30 minutos, gateGreetingMirror substitui a saudação completa por "Oi de novo[, Nome]. Em que posso continuar te ajudando?".
type: constraint
---

## Regra
Em `_shared/sales-pipeline/output-gates.ts`, `gateGreetingMirror` aceita `isMidThread`. Quando true E `pipelineState='greeting'`, substitui a resposta inteira pela frase curta de continuação — NÃO emite "Me conta o que está procurando" (que reseta discovery).

`isMidThread` é calculado em `ai-support-chat/index.ts` antes do gate: `Date.now() - last_assistant_message.created_at < 30min`.

## Por quê
Auditoria Respeite o Homem: clientes (Geraldo, Antônio) mandavam "Oi" no meio da conversa para retomar atenção, e a IA ressetava todo o contexto de discovery, repetindo o ciclo "me conta o que procura". Frustração imediata.

## Como aplicar
Reg #14. Janela de 30min escolhida para cobrir pausas naturais (WhatsApp) sem segurar contexto velho.
