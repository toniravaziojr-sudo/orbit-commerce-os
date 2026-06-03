---
name: Cascata TOTAL de exclusão do Pedido de Venda — sem exceção por estado do objeto
description: Excluir PV apaga TODOS os objetos vinculados (qualquer delivery_status) e remessa órfã (rascunho/emitida vazia). FK ON DELETE SET NULL existe como rede de segurança, mas o gatilho sempre apaga o objeto antes.
type: constraint
---

# Cascata PV → Objeto de Postagem → Remessa (TOTAL)

## Regra inegociável (atualizada 2026-06-03)

1. **Gatilho `BEFORE DELETE` em `fiscal_invoices`**
   (`trg_cascade_delete_shipments_on_pv_delete`):
   - Só age quando `OLD.fiscal_stage = 'pedido_venda'` e
     `OLD.source_order_invoice_id IS NULL` (PV raiz). NF derivada não dispara.
   - `DELETE FROM shipments WHERE source_pedido_venda_id = OLD.id` — sem
     filtro por `delivery_status`. Apaga rascunho, etiqueta gerada, postado,
     em trânsito, entregue, devolvido, qualquer estado.
   - Justificativa: como exclusão de PV de pedido pago só pode ocorrer via
     cancelamento do pedido (ver
     `mem://constraints/pv-from-paid-order-deletion-protected`), o objeto
     também deve sumir junto com o PV.

2. **Gatilho `AFTER DELETE` em `shipments`**
   (`trg_cleanup_empty_remessa_after_shipment_delete`):
   - Se a remessa apontada por `OLD.remessa_id` ficou com 0 objetos **e** está
     em `status IN ('rascunho','emitida')`, apaga a remessa.
   - Outros status de remessa (`parcial`, `despachada`, `finalizada`,
     `cancelada`) nunca são removidos automaticamente, mesmo vazios.

3. **Fila de rascunhos** (`shipping_draft_queue`) continua sendo apagada em
   cascata pela FK existente (`ON DELETE CASCADE` em
   `source_pedido_venda_id`).

4. **UI** (`FiscalInvoiceList`): ao abrir o diálogo de exclusão de um PV,
   consulta o objeto de postagem mais recente e exibe um aviso em PT-BR
   informando que o objeto será excluído junto. Não há mais o caminho
   "objeto em movimento permanece" — foi descontinuado.

## O que NUNCA pode acontecer

- Apagar remessa em `parcial`/`despachada`/`finalizada`/`cancelada`
  automaticamente, mesmo vazia.
- Apagar `customers`, leads, pedidos reais, audit_log ou métricas em cascata
  pela exclusão de PV.
- `shipments.invoice_id` apontar para um PV (sempre aponta para NF). Se
  alguma rota futura permitir, o `DELETE` do PV falhará pela FK
  `shipments_invoice_id_fkey` (sem `ON DELETE`).
- Reintroduzir o filtro por `delivery_status` no gatilho de cascata. A regra
  é **TOTAL** desde 2026-06-03.

## Mudança 2026-06-03

Antes: cascata preservava objetos em movimento (`posted`, `in_transit`,
`out_for_delivery`, `delivered`, `returned`) e apenas zerava o FK via
`SET NULL`. Foi descontinuado por decisão de negócio — como exclusão de PV
de pedido pago foi bloqueada (ver
`mem://constraints/pv-from-paid-order-deletion-protected`), o único caminho
para excluir PV é cancelar o pedido, e nesse caso o objeto também deve sair.

## Arquivos

- Migração: `supabase/migrations/*reconcile-orphan-pv-shipments*.sql`
  (2026-06-03).
- Funções: `public.cascade_delete_shipments_on_pv_delete()`,
  `public.cleanup_empty_remessa_after_shipment_delete()`.
- UI: `src/components/fiscal/FiscalInvoiceList.tsx` (diálogo simplificado).
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Exclusão em cascata".
- Memórias relacionadas:
  - `mem://constraints/pv-from-paid-order-deletion-protected`
  - `mem://constraints/shipping-canonical-link-is-pv-not-order`
  - `mem://constraints/shipping-draft-mirrors-pedido-venda`
  - `mem://constraints/shipping-emit-equals-dispatched-tracking-equals-shipped`
  - `mem://constraints/orphan-pv-shipment-reconciliation`
