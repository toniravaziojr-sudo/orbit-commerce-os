---
name: Greeting Mirror Must Work Without TPR
description: Todo gate determinístico de saudação precisa funcionar mesmo quando o Turn Pre-Router (LLM classifier) cai; depender só do TPR deixa a regra silenciosa em produção.
type: constraint
---

## Regra

O `gateGreetingMirror` (que lê `TurnClassification` do TPR) DEVE ter um fallback determinístico que detecta período do dia e "tudo bem?" direto na mensagem do cliente, sem depender do classificador LLM. Esse fallback é `gateGreetingMirrorFallback` em `output-gates.ts`.

## Por quê

O TPR usa `google/gemini-2.5-flash-lite` via Lovable AI Gateway com timeout 3.5s. Quando ele cai (rate limit, timeout, erro de rede), `turnClassification.source !== "llm"` e o gate principal é pulado. Antes do Reg #2.10, nesse caso o código pulava direto pro `scrubGreetingReciprocity` legado, que tem o bug AND/OR conhecido — saudação degenerada ("Oi!" pra cliente que disse "Boa noite") passava limpa.

## Como aplicar

- Local: `supabase/functions/_shared/sales-pipeline/output-gates.ts` (`gateGreetingMirrorFallback`).
- Plugado em `ai-support-chat/index.ts` no bloco `else` do `if (turnClassification.source === "llm")`.
- Mesma lógica vale para QUALQUER novo gate criado: se ler do TPR, tem que ter fallback determinístico.
