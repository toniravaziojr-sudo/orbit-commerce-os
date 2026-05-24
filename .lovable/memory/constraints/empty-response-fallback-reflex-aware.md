---
name: Empty Response Fallback — Reflex Aware
description: When LLM returns empty content and a deterministic reflex fired, fallback comes from the reflex table, not from the state table.
type: constraint
---

# Fallback de resposta vazia obriga consultar reflexo (Frente 5)

## Regra
Quando a IA retorna `content=""` (modelo travou, finish_reason=length, etc.), o fallback final **DEVE consultar primeiro a tabela `FALLBACK_BY_REFLEX[firedReflexId]`** antes de qualquer outro caminho. Apenas se nenhum reflexo disparou é que entram os caminhos antigos (handoff, mídia, tools_humanized, state_promise).

## Reflexos cobertos
- `thanks_terminal` → "Tmj, qualquer coisa me chama!"
- `social_noise` → "kkk 👍"
- `presence_ping` → "Tô aqui sim! Em que posso ajudar?"
- `hesitation` → "Tranquilo, sem pressa. Qualquer coisa me chama."
- `cep_received` → "Anotei o CEP, um instante."
- `shipping_question` → "Pra te passar o frete certinho preciso do CEP, pode me mandar?"
- `post_sale_question` → "Me passa o número do pedido (ou e-mail) que eu já vejo aqui."
- `short_turn_with_intent` → "Beleza, deixa eu te mostrar as opções."

## Por que
Sem essa regra, mesmo quando o reflexo determinístico instruía o modelo, um `content=""` caía em `FALLBACK_PROMISE_BY_STATE[discovery]` e a muleta vencia o reflexo. Foi a causa raiz do regresso "vlw / kkkk / alô?".

## Tag de log obrigatória
`[FALLBACK-EMPTY-RESPONSE source=reflex|actionable_handoff|commercial_veto|inbound_media|tools_humanized|state_promise reflexId=… state=…]`

## Onde
`supabase/functions/ai-support-chat/index.ts`, bloco de fallback de resposta vazia (linha ~7437).
