---
name: IA Vendas — promessa de link sem chamar tool força regeneração
description: "Tô gerando o link" sem generate_checkout_link com success=true dispara enforcePromiseWithoutAction → semanticDuplicateDetected → regen com tool_choice.
type: constraint
---

Em `supabase/functions/_shared/sales-pipeline/output-gates.ts`, o gate `enforcePromiseWithoutAction` detecta padrões de promessa de link (`tô gerando|estou gerando|vou gerar (o )?link|gerando seu link|preparando o link|deixa eu gerar o link|vou te mandar o link…`) na resposta da IA quando NÃO houve `generate_checkout_link` chamada com `success=true` neste turno e a resposta não contém URL `https?://`. 

Quando dispara, o handler em `ai-support-chat/index.ts` (~linha 6310) marca `closeLoopDetected=true`, que herda em `semanticDuplicateDetected=true` e força regeneração com `tool_choice` no mesmo mecanismo da Reg #2.16. NÃO reescreve texto.

**Por quê:** descoberto na Reg #9 (rodada 02/mai/2026). Cliente disse "manda o link" e a IA respondeu "tô gerando o link, só me passa CEP" sem nunca chamar a tool — venda travada.

**Sinal de regressão:** log `[Reg #9] promise_without_action match=…` repetido em turnos consecutivos sem `[FIX-B] forcing tool_choice=generate_checkout_link` no turno seguinte.
