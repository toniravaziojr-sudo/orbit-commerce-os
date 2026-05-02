---
name: lookup_customer normaliza email e phone antes do match
description: Tool lookup_customer faz lowercase+trim no email (ilike) e tenta variantes de phone (com/sem prefixo 55) só com dígitos.
type: constraint
---

## Regra
`supabase/functions/ai-support-chat/index.ts` case `lookup_customer`: email vai por `ilike` em lowercase/trim; phone tira tudo que não é dígito e tenta a variante com `55` quando o número não começa com isso, e a variante sem `55` quando começa.

## Por quê
Auditoria Respeite o Homem mostrou clientes recorrentes (William, Handy) caindo em "não encontrado" por mismatch de case no email ou formatação de phone (`+55 11 ...` vs `5511...`). O cliente já estava cadastrado — só o match estava falhando.

## Como aplicar
Reg #13. Qualquer outra busca de cliente por email/phone segue o mesmo padrão (lowercase email, dígitos puros para phone, variantes com/sem 55).
