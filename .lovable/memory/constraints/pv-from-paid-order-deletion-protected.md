---
name: PV de pedido pago é imutável — só some via cancelamento do pedido
description: Bloqueio em banco (trg_guard_pv_deletion_from_paid_order) e na UI impede exclusão de Pedido de Venda vinculado a pedido pago/ativo. Único caminho de descarte é cancelar o pedido na tela de Pedidos. Toda exclusão de PV é auditada em pv_deletion_audit.
type: constraint
---

# PV de pedido pago é imutável

## Regra inegociável (2026-06-03)

1. **Bloqueio no banco** — `trg_guard_pv_deletion_from_paid_order` (BEFORE
   DELETE em `fiscal_invoices`):
   - Só age sobre PV raiz (`fiscal_stage='pedido_venda'` e
     `source_order_invoice_id IS NULL`).
   - PV manual (`order_id IS NULL`): liberado.
   - PV com `order_id`: consulta `orders.status` e `payment_status`.
     - Se pedido é "pago-like" (via `is_payment_approved` ou
       `order_status_implies_paid`) **e** não está em estado terminal
       (`cancelled`, `cancelled_by_user`, `refunded`, `expired`,
       `payment_expired`) → `RAISE EXCEPTION
       'PV_FROM_PAID_ORDER_PROTECTED: ...'` com `ERRCODE=42501`.
   - Quando o pedido vai para um dos estados terminais acima, a cascata
     existente do pedido apaga o PV; o gatilho deixa passar.

2. **Bloqueio na UI** — `FiscalInvoiceList.handleDeleteDraft`:
   - Antes de abrir o diálogo, consulta o pedido vinculado e, se for pago
     e ativo, abre o diálogo em modo **bloqueado** com texto:
     *"Este Pedido de Venda pertence a um pedido pago e não pode ser
     excluído. Para descartar, cancele o pedido de origem na tela de
     Pedidos."* — botão de confirmação é omitido.
   - Caso o usuário burle a UI, `executeDeleteInvoice` captura o erro
     `PV_FROM_PAID_ORDER_PROTECTED` e mostra toast equivalente.

3. **Auditoria** — `trg_audit_pv_deletion` (BEFORE DELETE):
   - Toda exclusão de PV raiz grava snapshot em `pv_deletion_audit`:
     número, série, pedido de origem (número e id), cliente (nome/doc),
     total, itens (jsonb), `deleted_by = auth.uid()`, `deleted_at`.
   - Tabela com RLS: integrantes do tenant podem ler seus próprios
     registros via `get_current_tenant_id(auth.uid())`. Service role tem
     ALL.

## O que NUNCA pode acontecer

- PV de pedido pago e ativo ser apagado pela UI ou por scripts.
- UI permitir o botão "Excluir" para PV bloqueado.
- Cron, edge function ou rotina manual apagar PV sem passar pela auditoria.
- Reintroduzir lista de status "deletáveis" sem incluir o bloqueio do
  pedido pago.
- Tabela `pv_deletion_audit` ser apagada/truncada — é registro permanente
  para recuperação manual.

## Arquivos

- Migração: `supabase/migrations/*reconcile-orphan-pv-shipments*.sql`
  (2026-06-03).
- Funções: `public.guard_pv_deletion_from_paid_order()`,
  `public.audit_pv_deletion()`.
- Tabela: `public.pv_deletion_audit`.
- UI: `src/components/fiscal/FiscalInvoiceList.tsx`
  (`handleDeleteDraft`, diálogo `confirmDeleteInvoice`, estado
  `paidOrderBlock`).
- Doc formal: `docs/especificacoes/fiscal/preflight-fiscal-logistico.md` e
  `docs/especificacoes/erp/logistica.md`.
- Memórias relacionadas:
  - `mem://constraints/shipping-pv-delete-cascade-by-shipment-state`
  - `mem://constraints/pv-pedido-status-mirror-from-order`
  - `mem://constraints/orphan-pv-shipment-reconciliation`
