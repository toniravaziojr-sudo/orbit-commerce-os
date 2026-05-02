---
name: IA — vocativo deve suprimir placeholders genéricos
description: customer_name = "Cliente de teste"/"Lead"/"Contato" não pode virar vocativo; segue mesmo caminho de nome corporativo.
type: constraint
---

A heurística `looksGenericOrCorporate` em `supabase/functions/ai-support-chat/index.ts` (~linha 4555) DEVE incluir a lista de placeholders: `cliente`, `teste`, `test`, `contato`, `usuário`, `customer`, `lead`, `prospect`, `visitante`, `whatsapp`, `desconhecido`, `sem nome`, `não informado`, além dos termos corporativos legados (`loja|comercial|ltda|me|distribuidora|store|shop|sa|s/a|eireli|mei`).

**Por quê:** sem isso, a IA chama o cliente literalmente de "Cliente" no vocativo, queimando confiança. Reg #9 (02/mai/2026).

**Sinal de regressão:** mensagem outbound contendo `Olá, Cliente,` / `Oi Teste,` / `Olá Contato,` etc.
