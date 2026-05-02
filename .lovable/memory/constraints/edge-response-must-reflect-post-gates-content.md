---
name: edge-response-must-reflect-post-gates-content
description: ai-support-chat response JSON `message` MUST carry the final post-gates aiContent, not the pre-gate snapshot inserted at STEP 9.
type: constraint
---
Em `ai-support-chat/index.ts`, a linha `messages` é inserida ANTES dos scrubbers (PACOTE C, FIX-C, FIX-D, Reg #11/15/17.4) e da regeneração anti-duplicidade. O texto final que vai pelo canal pode diferir do snapshot original.

A resposta JSON da edge function (`return new Response(... message: newMessage ...)`) DEVE refletir o `aiContent` final pós-gates. Sempre montar:
```ts
const finalMessageSnapshot = newMessage ? { ...newMessage, content: aiContent } : newMessage;
```
e retornar `message: finalMessageSnapshot`. O UPDATE em `messages.content` (Reg #2.12) já existia, mas o snapshot retornado precisa estar alinhado para clientes da edge (sandbox de testes, dashboards) verem a versão real entregue.

**Why:** sem isso, testes e dashboards mostravam frases pré-gate (ex.: muleta de descoberta) enquanto o canal entregava o texto pós-scrubber, causando falsos positivos na bateria de testes (Reg #17.5).
