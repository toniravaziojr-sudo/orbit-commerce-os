---
name: greeting-mirror-strip-must-be-iterative
description: O regex degeneratedHeadRe no gateGreetingMirror precisa rodar em loop (até 3x) para remover saudações encadeadas tipo "Oi! Tudo bem?", senão o prepend duplica a reciprocidade ("Boa noite, tudo bem? Tudo bem? ...").
type: constraint
---

Em `supabase/functions/_shared/sales-pipeline/output-gates.ts`, dentro de `gateGreetingMirror`, o `degeneratedHeadRe` casa apenas a primeira saudação degenerada do início do texto. Quando a IA escreve "Oi! Tudo bem? Me conta…", o regex casa só "Oi!" e o `stripped` mantém "Tudo bem? Me conta…". Como o `mandatoryOpening` reconstrói "Boa noite, tudo bem?", o resultado final fica "Boa noite, tudo bem? Tudo bem? Me conta…" — reciprocidade duplicada.

**Regra obrigatória:** o strip deve rodar em loop (até 3 passagens) sobre o `stripped`, removendo qualquer cabeça de saudação encadeada antes de prepender o `mandatoryOpening`. 3 passagens cobrem casos como "Oi! Tudo bem? Olá!" (raros mas possíveis em LLM verbosa) e dão margem segura sem custo perceptível.

**Por quê:** sem o loop, qualquer mudança de prompt que faça a IA encadear cumprimentos quebra a saída. O bug é silencioso (texto ainda parece coerente) mas degrada a qualidade da abertura — efeito amplificado em testes do Modo Vendas WhatsApp.

**Como aplicar:** se for adicionar nova alternativa ao regex (ex.: "salve", "fala"), garantir que o loop continue cobrindo (3 passagens é suficiente).

Reg #2.13 — 2026-05-01.
