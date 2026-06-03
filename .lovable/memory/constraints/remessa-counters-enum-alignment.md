---
name: recalc_remessa_counters precisa bater com o enum delivery_status
description: A função recalc_remessa_counters e o trigger shipments_sync_remessa_counters só podem referenciar valores reais do enum delivery_status. "pending" não existe e qualquer referência trava todo UPDATE em shipments (incluindo o vínculo a uma remessa).
type: constraint
---

# Contadores da Remessa × enum delivery_status

## Regra

A função `public.recalc_remessa_counters(uuid)` é chamada por `tg_shipments_sync_remessa_counters` em todo INSERT/UPDATE/DELETE de `public.shipments`. Se a função referenciar um valor que NÃO existe em `delivery_status`, o PostgreSQL lança `22P02 invalid input value for enum delivery_status` e **rejeita o UPDATE original**. Isso significa que qualquer tentativa de vincular um objeto a uma remessa (`UPDATE shipments SET remessa_id = ...`) é silenciosamente revertida do lado do banco.

## Valores válidos hoje (`delivery_status`)

`draft`, `label_created`, `posted`, `in_transit`, `out_for_delivery`, `delivered`, `failed`, `returned`, `canceled`, `unknown`.

Definição operacional:
- **Não emitido** = `delivery_status IN ('draft','label_created')` (etiqueta gerada mas ainda não postada conta como pendente até o despacho real).
- **Emitido** = qualquer outro valor.
- **Falha** = `requires_action = true`.

## Por quê

03/06/2026 — bug encontrado em produção: a remessa `Remessa_03062026.101206` ficou eternamente em rascunho com contadores 0/0/0 e "Nenhum objeto vinculado", mesmo após o despacho bem-sucedido. Causa raiz: a função usava `'pending'` (valor inexistente), o trigger explodia, o UPDATE de vínculo era revertido — e o front nunca via o erro porque o cliente Supabase devolvia `linkErr` somente quando havia exceção propagada, mas a transação inteira já tinha sido abortada antes.

## Como aplicar

- Toda alteração no enum `delivery_status` exige revisar `recalc_remessa_counters` e qualquer outra função/policy que filtre por status.
- Toda alteração na função de contadores deve ser validada com um UPDATE real em `shipments` (mesmo no-op) antes do merge.
- Nenhum literal de status pode ser introduzido em função/policy sem confirmar via `enum_range(NULL::delivery_status)`.
- Reforço da memória `db-check-vs-ui-enum-alignment` — mesma classe de bug.

## Fonte de verdade

- Migração de correção: `supabase/migrations/*_fix_recalc_remessa_counters_enum.sql` (03/06/2026).
- Doc formal: `docs/especificacoes/erp/logistica.md` — seção "Objeto de Postagem × Remessa agrupadora", regra anti-regressão #9.
