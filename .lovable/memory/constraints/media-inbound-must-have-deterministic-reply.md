---
name: Mídia inbound — sem visão habilitada, resposta determinística (Reg #15)
description: gateMediaInbound substitui frases "estou analisando/só um instante" por pedido de descrição em texto quando a tool analyze_image não está disponível.
type: constraint
---

## Regra
`_shared/sales-pipeline/output-gates.ts`: `gateMediaInbound({ aiResponse, hasVisionTool, inboundIsMedia })` retorna `{ scrubbed:true, after: "Recebi sua mídia. Pra eu entender melhor, me descreve em texto o que você precisa que eu olhe?" }` quando a IA prometeu análise mas não há tool de visão. Wired em `ai-support-chat/index.ts` após gates de Reg #9.

## Por quê
Auditoria: 5 conversas (Anthero, Geraldo, Handy, Gilson, William) com inbound de mídia → IA respondia "só um instante enquanto eu analiso e já te respondo" e nunca voltava. Não existe tool analyze_image — promessa quebrada por padrão.

## Como aplicar
Reg #15. Quando alguma vez existir tool `analyze_image`, basta declará-la nas tools e o gate libera automaticamente (`hasVisionTool=true`).
