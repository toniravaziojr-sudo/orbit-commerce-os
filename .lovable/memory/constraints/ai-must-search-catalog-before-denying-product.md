---
name: IA não pode negar produto sem chamar search_products
description: Em sales mode, frase de negação ("não temos / não consta / não conheço") sem search_products no turno é regenerada para fala neutra (Eixo 1.6). Combina com FIX-C que cobre o inverso.
type: constraint
---

## Regra

No `ai-support-chat`, com `sales_mode_enabled=true`, se a resposta da IA contiver padrão de negação de produto E `search_products` NÃO foi chamada neste turno → o scrubber **substitui** a resposta por:

> "Deixa eu confirmar isso direito pra te responder com certeza. Pode me dizer de novo o nome ou a categoria do produto que você procura?"

## Por quê

Caso real: cliente cita "Fast Upgrade" (produto do catálogo); IA respondeu "não consigo confirmar esse produto" sem nem buscar. Padrão tóxico: cliente sente que o atendimento desconhece o que a empresa vende.

## Como aplicar

- Mantém-se em conjunto com **FIX-C** (que regenera quando search_products FOI chamado e retornou itens, mas IA negou mesmo assim).
- Locais: `supabase/functions/ai-support-chat/index.ts` — bloco `[Eixo 1.6] SEARCH-BEFORE-DENY`.
- NÃO desabilitar este scrubber sem reconciliar com `docs/especificacoes/whatsapp/pipeline-f2-vendas-ia.md` §7 (anti-padrões).
