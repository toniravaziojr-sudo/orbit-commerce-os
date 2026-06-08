---
name: Listagens operacionais sempre em ordem decrescente do número nativo do módulo
description: Pedidos, PVs, NFs, Objetos de Postagem, Remessas e Rastreios devem ser ordenados pelo número nativo (decrescente), nunca por data de criação. Garante que itens recriados por auto-cura/reconciliação voltem à posição correta em vez de irem para o topo.
type: constraint
---

# Ordenação universal por número nativo (decrescente)

## Regra inegociável (2026-06-08)

Toda listagem operacional do sistema deve ser ordenada por **número nativo
do módulo, decrescente**. Empate → desempate por data (mais novo em cima).

Módulos cobertos:

- Pedidos (`orders.order_number_int`)
- Pedidos de Venda Fiscal (`fiscal_invoices.numero`, stage `pedido_venda`)
- Notas Fiscais (`fiscal_invoices.numero`, stage `nf`)
- Objetos de Postagem (`shipments` — número/código sequencial)
- Remessas Correios (lote/protocolo numérico)
- Rastreios (número do objeto)

## Por que existe esta regra

Antes, a maioria das listas ordenava por `created_at DESC`. Quando um
item era recriado por auto-cura (reconciliação de PV órfão, recriação de
objeto após cancelamento, reabertura de remessa), ele aparecia no topo
porque a data de criação era nova — mesmo que o número fosse antigo.

Caso real que destravou esta regra: **PV 583 (Maria da Glória)** no
tenant Respeite o Homem em 2026-06-08. Após reconciliação, o PV voltou
a existir mas aparecia acima do PV 592, gerando confusão visual e
quebrando a leitura cronológica da operação.

## Implementação obrigatória

1. **Coluna gerada `orders.order_number_int`** (`bigint`), derivada de
   `regexp_replace(order_number, '\D', '', 'g')::bigint`, com índice
   composto `(tenant_id, order_number_int DESC)`.
   Hooks de pedido devem usar `.order('order_number_int', { ascending: false })`.

2. **Fiscal** (`fiscal_invoices`): ordenar por `numero DESC` no servidor
   (coluna já é numérica).

3. **Logística client-side** (Objetos, Remessas, Rastreios): usar
   `sortByNumberDesc` de `src/lib/sort-numeric.ts` após o fetch.
   Utilitário extrai apenas dígitos, ordena DESC e usa data como
   desempate.

4. Registros sem número (raríssimo) vão para o final, ordenados por
   data DESC entre si.

## O que NUNCA pode acontecer

- Voltar qualquer listagem operacional para `ORDER BY created_at DESC`
  como critério primário.
- Ordenar Pedidos por `order_number` (string) — números como "10" e "9"
  ficam fora de ordem. Usar sempre `order_number_int`.
- Inserir item recriado por auto-cura no topo da lista.
- Criar nova listagem operacional sem aplicar este padrão.

## Arquivos

- Utilitário: `src/lib/sort-numeric.ts` (`sortByNumberDesc`, `extractNumericKey`).
- Migração da coluna: `supabase/migrations/*orders_order_number_int_for_sort*.sql`.
- Hooks: `src/hooks/useOrders.ts`, `src/hooks/useFiscal.ts`.
- Componentes logística: `src/components/shipping/ShipmentGenerator.tsx`,
  `RemessasManager.tsx`, `TrackingTab.tsx`.
- Docs: `docs/especificacoes/transversais/padroes-operacionais.md`,
  `docs/especificacoes/erp/erp-fiscal.md`, `docs/especificacoes/erp/logistica.md`.
- Memórias relacionadas:
  - `mem://constraints/orphan-pv-shipment-reconciliation`
