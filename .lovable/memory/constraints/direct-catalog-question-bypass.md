---
name: Catalog Probe direto a kit/família — bypass de enforceFamilyBaseFirst
description: Quando o cliente pergunta diretamente "qual o kit mais completo?" / "tem shampoo?" sem dor declarada, o pipeline NÃO força agregação família-base. Mantém o pool natural com kits visíveis.
type: constraint
---

## Regra

`enforceFamilyBaseFirst` só pode rodar quando o turno NÃO é uma pergunta direta de catálogo. O detector `detectDirectCatalogQuestion` (em `_shared/sales-pipeline/direct-catalog-question.ts`) é executado antes do v2 e devolve `directKitQuestion` / `directFamilyQuestion`.

Critérios:
- **directKitQuestion** dispara quando: turno bare "kit?" / "combo?" OU regex pergunta direta sobre kit ("qual o kit mais completo?", "tem algum kit?", "me mostra o kit").
- **directFamilyQuestion** dispara quando: turno até 10 palavras + interrogativa + pelo menos 1 família mencionada (shampoo/balm/loção/condicionador/máscara/creme/sérum/óleo) E sem dor declarada.

Quando qualquer um dispara, `enforceFamilyBaseFirst` é bypassed. O pool natural já respeita "base antes de kit" dentro de cada família individualmente — kits ficam visíveis para o LLM oferecer.

## Por quê

Antes desta regra, "qual o kit mais completo?" caía em `enforceFamilyBaseFirst` que: detectava família dominante por maioria do pool → forçava bases primeiro → ranqueava kits por último, escondendo o kit que o cliente pediu. Cenário B4.1 ficava em muleta.

## Como aplicar

- NÃO desligar a flag arch18 — a regra base de "kit de quantidade fora da vitrine inicial" segue ativa quando NÃO é pergunta direta.
- Adicionar nova família ao detector → atualizar `FAMILY_DIRECT_TOKENS` em `direct-catalog-question.ts`.
- Threshold "≤10 palavras" não pode ser flexibilizado sem revalidar B4.1.
- Dor declarada SEMPRE bloqueia `directFamilyQuestion` — necessidade clínica vai para o caminho de `enforceFamilyBaseFirst`.

## Fonte de verdade

- Código: `supabase/functions/_shared/sales-pipeline/direct-catalog-question.ts`, integração em `supabase/functions/ai-support-chat/index.ts` (bloco arch18On).
- Doc formal: `docs/especificacoes/whatsapp/ia-atendimento-changelog.md` — Registro #41.
