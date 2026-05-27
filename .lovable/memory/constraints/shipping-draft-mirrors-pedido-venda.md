---
name: Remessa nasce do Pedido de Venda, nunca do Pedido original
description: O rascunho logístico e a remessa são filhos do Pedido de Venda fiscal (source_pedido_venda_id), criados pelo trigger trg_enqueue_shipping_draft_from_pv. Excluir PV em rascunho remove o rascunho logístico; nunca altera o pedido original.
type: constraint
---

# Remessa espelha o Pedido de Venda

## Regra

1. Despacho local (Correios/manual) só é enfileirado em `shipping_draft_queue` quando um Pedido de Venda raiz (`fiscal_invoices.fiscal_stage='pedido_venda'` e `source_order_invoice_id IS NULL`) é inserido. Responsável: trigger `trg_enqueue_shipping_draft_from_pv` (função `public.enqueue_shipping_draft_from_pv`).
2. `shipping_draft_queue.source_pedido_venda_id` e `shipments.source_pedido_venda_id` são o vínculo canônico com o PV. `order_id` permanece para histórico e para o fluxo automático vindo de pedido real, mas não é mais o owner.
3. Unicidade: 1 rascunho por PV (`shipping_draft_queue_pv_unique`).
4. PV manual ou duplicado (sem `order_id`) **gera remessa-rascunho normalmente**. O processador da fila (`scheduler-tick` PHASE 1.6) lê endereço, peso, dimensões e transportadora direto de `fiscal_invoices` + `fiscal_invoice_items` + `products` (via `sku=codigo_produto`). `shipments.order_id` e `shipping_draft_queue.order_id` aceitam NULL desde 2026-05-27.
5. Excluir um PV em rascunho cascateia a remoção do rascunho logístico via `ON DELETE CASCADE` em `source_pedido_venda_id`. Em `shipments`, o vínculo vira `NULL` (não apaga remessa já despachada).
6. Pedidos via gateway (Frenet etc.) continuam fora da fila local — `enqueue_fiscal_draft` enfileira em `gateway_sync_queue` e o gatilho de PV detecta `provider_kind='gateway'` e não cria rascunho local. Ver `mem://features/logistics/gateway-vs-local-shipping-routing`.
7. Marketplace (`reason='marketplace'`) é ignorado em ambos os caminhos.

## O que NUNCA pode acontecer

- Módulo Fiscal ou Logística **não pode** modificar `public.orders` do pedido original. Cancelamento/exclusão de PV nunca cascateia para o pedido.
- Não recolocar a inserção em `shipping_draft_queue` dentro de `enqueue_fiscal_draft` (caminho local) — duplicaria rascunhos.
- Não tornar `source_pedido_venda_id` opcional para rascunhos novos: todo rascunho criado após esta migração deve ter o vínculo. Registros legados podem ter `source_pedido_venda_id IS NULL` (backfill 14 remessas Correios de 20–29/abr/2026).
- Não remover a coluna `order_id` — é fonte histórica e usada por consultas legadas e relatórios.

## Arquivos

- Migração: `supabase/migrations/*shipping_draft_mirrors_pv*.sql` (2026-05-27).
- Funções: `public.enqueue_shipping_draft_from_pv`, `public.enqueue_fiscal_draft` (atualizada para remover ramo de despacho local).
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Origem do rascunho logístico" e `docs/especificacoes/erp/rascunhos-logisticos.md`.
- Relacionado: `mem://infrastructure/automation/atomic-order-draft-trigger`, `mem://features/logistics/shipping-management`, `mem://constraints/pv-pedido-status-mirror-from-order`.
