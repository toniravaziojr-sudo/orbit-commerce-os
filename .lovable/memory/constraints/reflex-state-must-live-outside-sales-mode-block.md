---
name: reflex-state-must-live-outside-sales-mode-block
description: Variáveis de estado de reflexo (firedReflexId etc.) usadas no fallback global do ai-support-chat devem ser declaradas no escopo externo, não dentro de if(salesModeEnabled).
type: constraint
---
**Regra:** Qualquer variável referenciada no caminho de fallback de resposta vazia (ou em qualquer trecho fora do bloco `if (salesModeEnabled) { ... }`) NÃO pode ser declarada dentro desse bloco. Declarar no escopo externo com valor padrão (`null`/`false`) e atribuir condicionalmente dentro do bloco.

**Por quê:** Em 2026-05-24 a Frente 5 (Reflex-Aware Fallback) introduziu `firedReflexId` dentro do bloco `salesModeEnabled` mas referenciada no fallback global. Resultado: `ReferenceError` quebrou TODA resposta da IA (qualquer turno → `INTERNAL_ERROR`), inclusive em tenants sem modo vendas.

**Como aplicar:** Ao tocar a pipeline `ai-support-chat/index.ts`, toda variável que cruzar a fronteira do bloco de modo vendas precisa estar hoisted. Code review obrigatório verificando escopo de variáveis `let`/`const` introduzidas em frentes de modo vendas.
