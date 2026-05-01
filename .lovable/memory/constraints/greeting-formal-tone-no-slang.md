---
name: Saudação formal padrão da IA (sem gírias)
description: IA de Atendimento responde toda saudação no formato formal "Olá[, Nome], [período], tudo bem? Como posso ajudar[ hoje]?". Mapeia gírias do cliente (Eai/Opa/Salve) para "Olá". Período calculado em BRT se cliente não disse. "hoje" + nome só para cliente recorrente.
type: constraint
---

## Regra
Toda saudação da IA usa formato formal padrão, mesmo se o cliente abriu com gíria. Tom casual só será permitido via override futuro em `ai_support_config.greeting_style` quando algum tenant pedir.

## Formato canônico
- Cliente novo: `"Olá, [período], tudo bem? Como posso ajudar?"`
- Cliente recorrente (`messages.length > 1 || !!customerId`): `"Olá[, Nome], [período], tudo bem? Como posso ajudar hoje?"`

## Fonte de verdade
- `greeting-mirror.ts`: detecta gíria → mapeia para "Olá"; calcula período BRT (UTC-3 fixo) se cliente não disse.
- `output-gates.ts` (`gateGreetingMirror` + `gateGreetingMirrorFallback`): gate determinístico que reescreve resposta da IA fora do padrão.
- `greeting-scrub.ts`: fallback legado.
- 4 chamadas em `ai-support-chat/index.ts` passam `isRecurring` + `customerName`.

## Anti-regressão
- BRT é UTC-3 fixo (Brasil sem DST desde 2019) — não usar `toLocaleString` nem `Intl.DateTimeFormat` com timezone (lento e instável em Deno edge).
- Strip iterativo (até 3x) cobre: oi, olá, opa, eai, salve, hey, hello, hi, alô, bom dia/tarde/noite, tudo bem.
- "Como posso te ajudar hoje?" estava EXPLICITAMENTE proibido no mirror antigo — agora é a frase padrão de cliente recorrente. Não reintroduzir o bloqueio.

## Doc formal
`docs/especificacoes/whatsapp/ia-atendimento-changelog.md` Registro #5.
