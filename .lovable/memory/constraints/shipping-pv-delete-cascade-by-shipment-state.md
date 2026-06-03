---
name: Cascata de exclusão do Pedido de Venda decide por estado do objeto de postagem
description: Excluir PV apaga junto objetos em 'draft'/'label_created' e remessa órfã (rascunho/emitida vazia). Objetos em movimento (posted/in_transit/out_for_delivery/delivered/returned) permanecem; vínculo com PV é zerado via FK SET NULL.
type: constraint
---

# Cascata PV → Objeto de Postagem → Remessa

## Regra inegociável

1. **Gatilho `BEFORE DELETE` em `fiscal_invoices`**
   (`trg_cascade_delete_shipments_on_pv_delete`):
   - Só age quando `OLD.fiscal_stage = 'pedido_venda'` e
     `OLD.source_order_invoice_id IS NULL` (PV raiz). NF derivada não dispara.
   - `DELETE FROM shipments WHERE source_pedido_venda_id = OLD.id AND
     delivery_status IN ('draft','label_created')`.
   - Para qualquer outro `delivery_status`, o objeto permanece — a FK
     `shipments.source_pedido_venda_id ON DELETE SET NULL` zera o vínculo.

2. **Gatilho `AFTER DELETE` em `shipments`**
   (`trg_cleanup_empty_remessa_after_shipment_delete`):
   - Se a remessa apontada por `OLD.remessa_id` ficou com 0 objetos **e** está
     em `status IN ('rascunho','emitida')`, apaga a remessa.
   - Outros status de remessa (`parcial`, `despachada`, `finalizada`,
     `cancelada`) nunca são removidos automaticamente, mesmo vazios.

3. **Fila de rascunhos** (`shipping_draft_queue`) continua sendo apagada em
   cascata pela FK existente (`ON DELETE CASCADE` em
   `source_pedido_venda_id`). Nenhum gatilho adicional necessário.

4. **UI** (`FiscalInvoiceList`): ao abrir o diálogo de exclusão de um PV,
   consulta o objeto de postagem mais recente vinculado e exibe um aviso em
   PT-BR adaptado a cada cenário:
   - Sem objeto: confirmação simples.
   - Objeto apagável (`draft`/`label_created`): "O objeto também será excluído.
     Se a remessa ficar vazia, também será removida."
   - Objeto em movimento: "O objeto nº XXX já está em movimento pelos Correios
     e permanecerá no histórico de Remessas."

## O que NUNCA pode acontecer

- Apagar `shipments` em `posted`/`in_transit`/`out_for_delivery`/`delivered`/
  `returned` quando o PV de origem é excluído.
- Apagar remessa em `parcial`/`despachada`/`finalizada`/`cancelada`
  automaticamente, mesmo vazia.
- Bloquear exclusão de PV por causa de objeto em movimento (a regra é
  preservar o objeto, não impedir a exclusão).
- Apagar `customers`, leads, pedidos reais, audit_log ou métricas em cascata
  pela exclusão de PV.
- `shipments.invoice_id` apontar para um PV (sempre aponta para NF). Se
  alguma rota futura permitir, o `DELETE` do PV falhará pela FK
  `shipments_invoice_id_fkey` (sem `ON DELETE`).

## Critério de "em movimento"

`delivery_status IN ('posted','in_transit','out_for_delivery','delivered','returned')`.

Justificativa: após a correção de 2026-06-03, `'posted'` significa
"1º evento real dos Correios detectado pelo polling" (ver
`mem://constraints/shipping-emit-equals-dispatched-tracking-equals-shipped`).
Antes da correção, `'posted'` era atribuído na emissão e ambos os significados
colidiam — esta cascata depende da semântica corrigida.

## Arquivos

- Migração: `supabase/migrations/*cascade_delete_shipments_on_pv_delete*.sql`
  (2026-06-03).
- Funções: `public.cascade_delete_shipments_on_pv_delete()`,
  `public.cleanup_empty_remessa_after_shipment_delete()`.
- UI: `src/components/fiscal/FiscalInvoiceList.tsx` (estado
  `linkedShipmentImpact`, diálogo dinâmico).
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Exclusão em cascata".
- Memórias relacionadas:
  - `mem://constraints/shipping-canonical-link-is-pv-not-order`
  - `mem://constraints/shipping-draft-mirrors-pedido-venda`
  - `mem://constraints/shipping-objeto-vs-remessa-agrupadora`
  - `mem://constraints/shipping-emit-equals-dispatched-tracking-equals-shipped`
  - `mem://constraints/order-deletion-cancel-only-and-cascade-cleanup`
