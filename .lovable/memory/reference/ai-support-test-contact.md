---
name: Contato de Teste Permanente — IA de Atendimento WhatsApp
description: Tenant e número fixos usados continuamente para validar o fluxo da IA de atendimento (modo vendas) no WhatsApp
type: reference
---

**Tenant de teste:** `respeiteohomem`
**Número WhatsApp do "cliente" de teste:** `73 991681425`
**Formato E.164:** `5573991681425`
**Formato canônico (com 9º dígito):** `5573991681425`

## Uso

Este é o contato fixo e contínuo para qualquer validação do fluxo da IA de atendimento WhatsApp (modo vendas) — pipeline F2, sales-state-machine, prompts de greeting/discovery/recommendation/product-detail/checkout-assist, scrubbers, anti-repetição, eco de saudação, bundle lock, price-on-demand, etc.

Sempre que o usuário pedir para "limpar histórico do número de teste", "resetar memória da IA do teste" ou "rodar teste do zero" sem especificar outro número, é **este** contato:
- Tenant: respeiteohomem
- Phone: 5573991681425

## Quando limpar (sob comando explícito do usuário)

Tabelas afetadas em uma limpeza completa para retestar do zero:
- `whatsapp_messages` — mensagens do WhatsApp deste número
- `support_conversations` / `chat_messages` — conversa e mensagens do atendimento
- `ai_memories` — memória persistente da IA para esse contato
- `ai_conversation_summaries` — resumos
- Estado do pipeline de vendas (state-machine cache, family_focus, OFFERED_BUNDLE_LOCK)

NÃO apagar o registro de `customers` salvo se o usuário pedir explicitamente "limpar tudo".

## Por que é reference (não session)

A memória de sessão é rotativa (top 2 assuntos) e foi descartando este contexto entre rodadas de validação. Como este número é usado continuamente em ciclos de correção da IA de atendimento, a referência precisa ser permanente.
