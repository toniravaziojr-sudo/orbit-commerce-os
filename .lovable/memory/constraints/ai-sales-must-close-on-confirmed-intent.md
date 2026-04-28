---
name: IA Vendas — proibido pedir nova confirmação após cliente fechar
description: Quando cliente sinaliza fechamento ("sim/quero/manda/pode gerar") e IA pede "posso finalizar?" sem chamar generate_checkout_link, força handoff comercial em vez de loop infinito (Eixo 1.7).
type: constraint
---

## Regra

No `ai-support-chat` em sales mode, em estado `recommendation|consideration|decision|cart|checkout`:

Se `lastMessage` contém sinal de fechamento explícito (`/\b(sim,?\s*(pode|fecha|quero|manda)|pode\s+(gerar|mandar|enviar|finalizar)|gera\s+o\s+link|fechado|quero\s+fechar|vou\s+levar|finaliza)\b/i`) E a resposta da IA pede confirmação de novo (`posso finalizar?|quer que eu gere o link?|confirma se quer|posso seguir?`) E `generate_checkout_link` NÃO foi chamada neste turno:

→ Substitui por **"Vou chamar alguém da equipe pra fechar com você agora. Já te respondem por aqui."** e **força `shouldHandoff = true`** com `handoffReason = "confirmation_loop_detected"`.

## Por quê

Caso Luiz (ticket real): cliente disse "sim" 3 vezes; IA pediu confirmação a cada turno; venda perdida. O caminho feliz já existe via FIX-B (tool_choice forçado), este scrubber é a rede de segurança quando o forçamento não disparou (ex: estado degradado por outro scrubber, ou nome de estado divergente).

## Como aplicar

- Local: `supabase/functions/ai-support-chat/index.ts` — bloco `[Eixo 1.7] CLOSE-ON-CONFIRMED-INTENT`.
- Combina com FIX-B (`explicitBuyNow` + `tool_choice=generate_checkout_link`) em `checkout_assist`.
- O loop de confirmação é considerado falha grave: handoff é o destino correto, não outra resposta livre.

## Observação

`checkout_assist` exige `cart_id` ativo (Eixo 1.8). Sem carrinho, `nextPipelineState` é rebaixado para `decision`.
