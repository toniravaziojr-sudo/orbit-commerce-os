---
name: messages-persistence-must-reflect-post-gates-output
description: Em ai-support-chat o INSERT de messages ocorre cedo (STEP 9) antes dos gates; obrigatório UPDATE pós-gates antes do envio para sincronizar messages.content com o texto efetivamente entregue.
type: constraint
---

Em `supabase/functions/ai-support-chat/index.ts`, a mensagem outbound é inserida em `messages` no STEP 9 (~linha 5748) ANTES de rodarem os gates determinísticos (price scrub, greeting mirror, checkout URL enforcer) e ANTES da regeneração anti-duplicidade (Pacote E v2). Como o envio ao WhatsApp (STEP 10) usa o `aiContent` em memória já mutado, o cliente recebe o texto correto, mas `messages.content` no banco fica defasado.

**Regra obrigatória:** após o cálculo de `finalResponseHash` (logo depois do bloco de regeneração) e ANTES do envio (STEP 10), executar `UPDATE messages SET content=aiContent WHERE id=newMessage.id`. Tolerante a falha (warn-only, não bloqueia envio).

**Por quê:** sem isso, histórico mostrado no dashboard, hash de anti-duplicação semântica do próximo turno (que lê histórico) e auditoria divergem do que foi efetivamente entregue ao cliente. Bug observado: gate de greeting aplicou "Boa noite!" mas o banco ficou com "Oi! Tudo bem?".

**Como aplicar:** se for adicionar um novo gate determinístico depois do STEP 9, garantir que ele rode antes do UPDATE de sync. Mover o INSERT para depois dos gates é tentador mas perigoso (quebra idempotência do `meta-whatsapp-send` que precisa do `message_id` pré-existente).

Reg #2.12 — 2026-05-01.
