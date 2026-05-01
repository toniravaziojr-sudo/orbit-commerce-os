---
name: Gates Must Reapply After Regeneration
description: Toda regeneração de resposta da IA (PACOTE E v2 anti-duplicado e futuras) deve reaplicar os gates determinísticos (price, greeting, checkout-url) sobre o texto regenerado antes de persistir. Caso contrário, os gates viram cosméticos.
type: constraint
---

**Regra:** sempre que `aiContent` for substituído após os gates de output (Reg #2.8 / #2.10 / #2.11), os mesmos gates DEVEM ser reaplicados sobre o novo texto antes da persistência.

**Por quê:** descoberto na Reg #2.11 (conversa `dc4943c8-…`). O greeting gate aplicou corretamente "Boa noite!" no turno 1, mas o bloco de regeneração por duplicado (`PACOTE E v2`, ai-support-chat ~6244) substituiu `aiContent = regenText` sem reaplicar nada. A regeneração crua da OpenAI veio com "Oi! Tudo bem?" e foi persistida — mascarando completamente o greeting mirror.

**Como aplicar:**
- Em `supabase/functions/ai-support-chat/index.ts`, qualquer ponto que faça `aiContent = <novo_texto>` após o bloco principal de gates DEVE rodar, em sequência: `scrubUnsolicitedPrice` → `gateGreetingMirror`/`gateGreetingMirrorFallback` → `enforceCheckoutUrlInText`.
- Ponto de referência atual: linhas ~6244 (regeneração anti-duplicado).
- Falhas de gate vão em `try/catch` com warn — nunca derrubam o turno.

**Sinal de regressão:** `ai_support_turn_log.metadata.greeting_scrub_reason = "prepended_…"` mas a mensagem persistida em `messages` não começa pela saudação espelhada. Isso = gate aplicou mas algo sobrescreveu depois sem reaplicar.
