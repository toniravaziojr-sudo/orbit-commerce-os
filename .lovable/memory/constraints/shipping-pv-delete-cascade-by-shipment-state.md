---
name: Cascata de exclusão do PV respeita agrupamento por remessa
description: Excluir PV remove o objeto sem remessa OU sozinho na remessa (e a remessa vazia em rascunho/emitida). Objeto acompanhado por outros na mesma remessa é marcado como cancelled (action_reason=pv_deleted) dentro da remessa — não exclui nem o objeto nem a remessa. Revisão 2026-06-08 (antes era TOTAL incondicional).
type: constraint
---

# Cascata PV → Objeto de Postagem → Remessa (respeita agrupamento)

## Regra inegociável (atualizada 2026-06-08)

1. **Gatilho `BEFORE DELETE` em `fiscal_invoices`**
   (`trg_cascade_delete_shipments_on_pv_delete`):
   - Só age quando `OLD.fiscal_stage = 'pedido_venda'` e
     `OLD.source_order_invoice_id IS NULL` (PV raiz).
   - Para cada `shipments WHERE source_pedido_venda_id = OLD.id`, decide
     individualmente:
     - Se `remessa_id IS NULL` → `DELETE`.
     - Se está sozinho na remessa (nenhum outro shipment vivo no mesmo
       `remessa_id`, ignorando os já `cancelled`) → `DELETE`.
     - Se está acompanhado → `UPDATE delivery_status='cancelled',
       action_reason='pv_deleted', requires_action=false`. **Não exclui**
       o objeto nem a remessa.

2. **Gatilho `AFTER DELETE` em `shipments`**
   (`trg_cleanup_empty_remessa_after_shipment_delete`):
   - Se a remessa ficou com 0 objetos **e** está em
     `status IN ('rascunho','emitida')`, apaga a remessa.
   - Outros status (`parcial`, `despachada`, `finalizada`, `cancelada`)
     nunca são removidos automaticamente.

3. **Fila de rascunhos** (`shipping_draft_queue`) continua apagada em
   cascata pela FK `ON DELETE CASCADE` em `source_pedido_venda_id`.

4. **UI** (`FiscalInvoiceList`): o diálogo de exclusão do PV mostra em
   PT-BR o que vai acontecer com o objeto vinculado (excluído ou
   marcado como cancelado dentro da remessa).

## Por que mudou (2026-06-08)

A regra anterior (TOTAL incondicional, 2026-06-03) apagava qualquer
objeto, mesmo dentro de uma remessa agrupada que ainda tinha outros
objetos vivos. Isso quebrava o agrupador (caso real: remessa com
múltiplos PVs, exclusão de 1 PV abria buraco no XLS de despacho).
A revisão restaura a integridade do agrupador: **o objeto desaparece
fisicamente só quando a remessa também pode sumir**; caso contrário,
fica cancelado dentro dela.

## O que NUNCA pode acontecer

- Apagar shipment que está em remessa com outros shipments vivos.
- Apagar remessa em `parcial`/`despachada`/`finalizada`/`cancelada`
  automaticamente, mesmo vazia.
- Apagar `customers`, leads, pedidos reais, audit_log ou métricas em
  cascata pela exclusão de PV.
- `shipments.invoice_id` continuar apontando para um PV após a exclusão
  (a FK é `ON DELETE SET NULL` desde 2026-06-08).
- Reintroduzir a cascata TOTAL incondicional sem reavaliar o caso
  multi-PV em remessa.

## Arquivos

- Migração: `supabase/migrations/*` (2026-06-08, cascade respeitando agrupamento).
- Funções: `public.cascade_delete_shipments_on_pv_delete()`,
  `public.cleanup_empty_remessa_after_shipment_delete()`.
- UI: `src/components/fiscal/FiscalInvoiceList.tsx` (diálogo de exclusão).
- Doc formal: `docs/especificacoes/erp/logistica.md` §"Exclusão em cascata".
- Memórias relacionadas:
  - `mem://constraints/pv-from-paid-order-deletion-protected`
  - `mem://constraints/shipping-canonical-link-is-pv-not-order`
  - `mem://constraints/shipping-draft-mirrors-pedido-venda`
  - `mem://constraints/nf-cancel-blocked-by-shipment-state`
  - `mem://constraints/nf-cancel-reopens-pv-clean`
