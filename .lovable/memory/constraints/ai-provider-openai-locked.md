---
name: AI Provider Locked to OpenAI
description: Agente de Atendimento e chat de teste do Comando Central usam exclusivamente OpenAI. Proibido trocar de provedor sem solicitação explícita do operador.
type: constraint
---

# Provedor da IA travado em OpenAI

## Regra

A plataforma usa **um único provedor de IA** para o agente de Atendimento (WhatsApp/Web) e para o chat de teste do Comando Central: **OpenAI** (chamada direta, com `OPENAI_API_KEY`).

É **proibido**:
- Migrar qualquer um desses fluxos para Lovable AI Gateway, Gemini, Anthropic, ou qualquer outro gateway/provedor.
- Adicionar fallback automático para outro provedor "para não quebrar quando bate rate limit".
- Trocar de provedor sob justificativa de custo, latência, modernização ou unificação técnica.
- Manter dois provedores em paralelo entre o agente de produção e o chat de teste.

## Por quê

Em 24/mai/2026 o chat de teste rodava em Gemini via Lovable AI Gateway e devolveu `RATE_LIMIT` em sequência, dando a impressão de que a IA "não respondia". O agente de produção, em OpenAI direta, seguia funcionando. O operador determinou que **teste e produção precisam usar o mesmo provedor** para que o teste reflita exatamente o que o cliente vai receber. Qualquer divergência derrota o propósito do sandbox.

## Como aplicar

- Toda alteração no agente (`ai-support-chat`) ou no chat de teste (`chatgpt-chat`) deve manter `OPENAI_API_KEY` + endpoint `https://api.openai.com/v1/chat/completions`.
- Mudança de modelo dentro da OpenAI (ex.: gpt-5-mini → gpt-5) é permitida mediante pedido normal do operador.
- Mudança de **provedor** (sair da OpenAI) exige:
  1. Pedido explícito em chat pelo operador.
  2. Atualização desta memória + registro no changelog (`docs/especificacoes/whatsapp/ia-atendimento-changelog.md`).

## Fonte de verdade

- Registro #40 em `docs/especificacoes/whatsapp/ia-atendimento-changelog.md`.
- Edges: `supabase/functions/ai-support-chat/index.ts` e `supabase/functions/chatgpt-chat/index.ts`.
