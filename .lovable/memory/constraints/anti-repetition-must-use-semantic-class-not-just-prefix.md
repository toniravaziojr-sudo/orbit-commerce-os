---
name: Anti-repetição usa classe semântica, não só prefix hash (Reg #16)
description: gateSemanticRepetition detecta pergunta aberta "procura algo específico ou prefere ver opções?" repetida em 2 turnos do bot e força closeLoopDetected.
type: constraint
---

## Regra
`_shared/sales-pipeline/output-gates.ts`: `gateSemanticRepetition({ aiResponse, recentBotMessages })`. Se a resposta atual bate o regex `(procura|busca) algo específico (ou|e) (prefere ver) opções/alternativas` E pelo menos 1 dos 2 últimos turnos do bot bate o mesmo regex, retorna `closeLoopDetected=true reason='semantic_open_question_repeated'` — herda no pipeline existente de regeneração.

## Por quê
Linha 43 do Mapa de qualidade do `ia-atendimento-changelog.md` estava ⚠️ Parcial desde Reg #2: hash de prefixo não pegava família semântica. Auditoria Respeite o Homem mostrou Geraldo (3x) e Anthero (3x) recebendo a mesma pergunta com palavras trocadas.

## Como aplicar
Reg #16. Novas famílias de pergunta repetida entram no mesmo gate como regex adicional.
