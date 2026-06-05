---
name: NF — normalização universal de totais antes da SEFAZ
description: fiscal-prepare-invoice recalcula valor_produtos, valor_desconto e valor_total a partir dos itens reais antes de marcar a NF como Pronta para Emitir. Bloqueia em qualquer caminho (UI, duplicação, importação, edição) a regressão "desconto fantasma" que causou rejeição NA01.
type: constraint
---

# NF — normalização universal de totais

## Regra

`fiscal-prepare-invoice` é a fronteira única entre o Pedido de Venda e a NF que vai à SEFAZ. Antes de marcar a NF como `pronta_emitir`, é obrigatório:

1. Recalcular `valor_produtos = Σ(quantidade × valor_unitario)` a partir dos itens reais.
2. Limitar `valor_desconto` entre `0` e `valor_produtos` (nunca negativo, nunca maior que produtos).
3. Recalcular `valor_total = max(0, produtos − desconto + frete + seguro + outras_despesas)`.
4. Persistir os três valores no registro da NF e registrar evento `totals_normalized` em `fiscal_invoice_events` com snapshot antes/depois.

Tolerância numérica: `0.01` (centavo).

## O que NUNCA pode acontecer

- NF ser enviada à SEFAZ com `valor_total ≠ produtos − desconto + frete + seguro + outras` (rejeição NA01 / 533 / 534).
- Outro módulo recriar essa normalização em paralelo — o ponto único é `fiscal-prepare-invoice`.
- `valor_desconto` negativo ou maior que `valor_produtos`.
- Aplicar a regra antes de `unbundleFiscalItems()` (kits ainda inteiros distorcem o somatório).

## Por que existe

Pedidos antigos / importações / edições manuais podem carregar desconto "fantasma": preço unitário já descontado + `valor_desconto` divergente, ou cabeçalho com total que não fecha com os itens. O motor de duplicação não pode confiar no PV de origem. A blindagem no `prepare-invoice` garante que qualquer caminho de criação caia no mesmo gate antes da SEFAZ.

## Arquivos

- `supabase/functions/fiscal-prepare-invoice/index.ts` — bloco "BLINDAGEM UNIVERSAL DE SOMAS".
- Doc formal: `docs/especificacoes/erp/erp-fiscal.md` §"Normalização de totais PV→NF".
- Memórias relacionadas:
  - `mem://constraints/fiscal-kit-unbundling-at-nf-time`
  - `mem://constraints/preflight-fiscal-logistico-portao-unico`
  - `mem://constraints/correios-default-nfe-plus-dc-and-pratika-key-sanitize`

## Validação E2E

Confirmado no teste real 2026-06-05 (PV #393 → NF #396 autorizada). A primeira tentativa (NF #395) foi rejeitada justamente por desconto fantasma de R$17,87 herdado do pedido #581; esta blindagem elimina o sintoma em qualquer caminho futuro.
