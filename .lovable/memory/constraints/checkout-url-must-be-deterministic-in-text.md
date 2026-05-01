---
name: Checkout URL Must Be Deterministic In Text
description: Quando a tool generate_checkout_link é chamada com sucesso e devolve checkout_url, a URL DEVE aparecer textualmente na resposta da IA. Nunca confiar na LLM para colar — gate determinístico injeta.
type: constraint
---

**Regra:** o gate `enforceCheckoutUrlInText` em `supabase/functions/_shared/sales-pipeline/output-gates.ts` é a fonte de verdade da presença da URL no texto final. A LLM pode narrar ("aqui está o link"), mas a URL é sempre injetada/garantida deterministicamente após os gates.

**Por quê:** descoberto na Reg #2.11 (conversa `dc4943c8-…`, turno 5). A tool retornou `checkout_url` corretamente no JSON, a LLM redigiu "Aqui está o link, é só preencher seus dados…" — sem URL nenhuma. Cliente ficou sem como pagar.

**Como aplicar:**
- Gate roda em `ai-support-chat/index.ts` logo após o bloco price/greeting (Reg #2.11).
- Lê `toolResultsThisTurn`, pega o último `generate_checkout_link` com `success=true` e `checkout_url` string.
- 3 cenários: URL já presente → noop; outra URL no texto → substitui; sem URL → anexa em linha separada.
- Idempotente: rodar 2x não duplica.

**Não fazer:**
- Confiar em prompt da LLM ("não esqueça de colar a URL") — não é determinístico.
- Reescrever o gate para usar regex em vez de `tool_results` — perde-se a fonte autoritativa.

**Sinal de regressão:** mensagem persistida menciona "link" mas não tem `https://…/checkout?link=…` quando o turn-log diz `state_transition_reason=checkout_link_generated`.
