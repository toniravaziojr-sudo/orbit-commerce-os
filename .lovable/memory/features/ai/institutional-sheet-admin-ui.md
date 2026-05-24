---
name: Frente 6 — Ficha Institucional do tenant editável via UI
description: Edição em Configurações > IA > Conhecimento Essencial. Persiste em ai_support_config.metadata.institutional_sheet. Bloco institucional do prompt nunca inventa quando campo está vazio.
type: feature
---

## Regra

A Ficha Institucional do tenant é editável em `Configurações > IA > Conhecimento Essencial` pelo componente `AIInstitutionalSheetSection`. Persiste 9 campos opcionais em `ai_support_config.metadata.institutional_sheet` (jsonb):

`delivery_coverage`, `business_hours`, `payment_methods`, `coupons_policy`, `guarantee_policy`, `social_proof`, `physical_store`, `contact_human`, `notes`.

A função `buildInstitutionalBlock` (em `_shared/sales-pipeline/institutional-sheet.ts`) é a única consumidora oficial do jsonb e injeta o bloco no prompt apenas para buckets institucionais/objeção/política comercial. Quando um campo está em branco, a IA é instruída a NÃO inventar e oferecer humano.

## Por quê

Antes da Frente 6, a ficha existia em código (default vazio) e UPDATE direto no banco era a única forma de popular. P-EXEC-2 do plano pós-Frentes B–E.

## Como aplicar

- Toda alteração visual ou de campo da ficha começa por `AIInstitutionalSheetSection.tsx`. Não criar fonte paralela em outra tela.
- Persistir SEMPRE em `metadata.institutional_sheet` (não criar coluna nova).
- Campo vazio = ausência consciente. NÃO popular default cosmético no banco.
