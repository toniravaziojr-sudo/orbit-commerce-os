---
name: IA — vocabulário de família cobre variações comuns do tenant
description: O detector de família em transitions.ts cobre não só as famílias-base (shampoo, condicionador, loção, creme...) mas também variações comuns: pós-barba/after-shave (→ loção), pomada, óleo, hidratante, barba, desodorante.
type: constraint
---

## Regra

Em `supabase/functions/_shared/sales-pipeline/transitions.ts`, `FAMILY_TOKENS` cobre famílias-base **e** variações comerciais frequentes:

- `shampoo`, `condicionador`, `creme`, `locao` (inclui pós-barba/after-shave), `balm`, `serum`, `tonico`, `mascara`, `gel`, `sabonete`, `pomada`, `oleo`, `hidratante`, `barba`, `desodorante`, `kit`, `combo`, `perfume`.

Quando uma variação comum tem família-mãe (ex.: "pós-barba" e "after-shave" → `locao`), o redirecionamento é feito no próprio regex da família-mãe, evitando proliferação de famílias.

## Por quê

Bateria de teste Respeite o Homem (mai/2026): ao mudar de "shampoo" para "loção pós-barba" na mesma conversa, a IA caía em fallback genérico ("deixa eu confirmar...") porque "pós-barba" não disparava `detectFamilyMentioned`. Sem detecção, o `familyChanged` não acionava, e a busca seguia presa na família anterior.

## Como aplicar

- Antes de adicionar uma nova família-base, verificar se ela é variação de uma família existente (e estender o regex da família-mãe) ou se é categoria realmente nova (e adicionar entrada própria + alias em `getCatalogFamilyAliases` se houver fungibilidade comercial).
- Sempre que esse arquivo for alterado, rodar os testes em `_shared/sales-pipeline/__tests__/catalog-probe-v2.test.ts`.
- Registro: Reg #30 em `docs/especificacoes/whatsapp/ia-atendimento-changelog.md`.
