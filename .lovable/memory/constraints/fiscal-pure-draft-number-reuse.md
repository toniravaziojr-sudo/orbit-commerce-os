---
name: Fiscal — reaproveitamento de número em rascunho puro
description: v2026-06-09 (Onda 3 rev2). Reverte numeração estritamente monotônica para rascunhos puros. NF rascunho sem chave_acesso e sem eventos SEFAZ pode ser excluída e reaproveitar número. PV em rascunho puro idem. numero_nfe_atual passa a ser marca alta da SEFAZ — só sobe em fiscal-submit/fiscal-emit. Triggers guard_nf_deletion_when_submitted_to_sefaz e audit_nf_deletion são obrigatórios.
type: constraint
---

# Numeração com reaproveitamento controlado (rascunho puro)

## Regra inegociável (v2026-06-09 — Onda 3 rev2)

### NF (Nota Fiscal)
- Próximo número = `max(maior NF local viva + 1, numero_nfe_atual)`.
- `fiscal_settings.numero_nfe_atual` é a **marca alta da SEFAZ**:
  nunca recua, só é incrementado em `fiscal-submit` e `fiscal-emit`
  quando o número é efetivamente queimado lá fora (sucesso, rejeição
  ou duplicidade).
- NF em **rascunho puro** — sem `chave_acesso` e sem nenhum evento
  `submitted/authorized/rejected/submission_error/numero_duplicado_sefaz`
  — pode ser excluída e o número volta ao pool.
- NF que tocou a SEFAZ: **proibido `DELETE`**. Trigger
  `trg_guard_nf_deletion_when_submitted_to_sefaz` (BEFORE DELETE em
  `fiscal_invoices`) bloqueia com código `NF_ALREADY_SUBMITTED_TO_SEFAZ`.
  Caminhos legítimos: Cancelamento ou Inutilização — número permanece
  queimado.

### PV (Pedido de Venda)
- Próximo número = `max(maior PV vivo + 1)`. Documento interno, não vai
  à SEFAZ; cursor não trava reuso.
- PV em rascunho puro (sem NF emitida vinculada, sem objeto logístico
  despachado e sem pedido pago ativo) pode ser excluído e o número
  volta ao pool. Bloqueios de pedido pago e objeto despachado
  continuam intactos (`trg_guard_pv_deletion_from_paid_order` e
  cascata por estado de remessa).

### Auditoria
- Toda exclusão de NF rascunho é gravada em `nf_deletion_audit` pela
  trigger `trg_audit_nf_deletion`.
- Toda exclusão de PV continua sendo gravada em `pv_deletion_audit`.

## O que NUNCA pode acontecer

- Edge de criação de rascunho chamar `syncFiscalNumberCursor` (avançar
  cursor por criação). Cursor só avança em `fiscal-submit` /
  `fiscal-emit` no caminho de sucesso/duplicidade.
- Permitir `DELETE` em NF com `chave_acesso` ou eventos de envio.
- Backfill que recue `numero_nfe_atual` abaixo do maior número que já
  tocou a SEFAZ.
- Tratar reuso de número de rascunho puro como bug.
- Reintroduzir regra "monotônica estrita" sem revogar esta constraint
  explicitamente no doc oficial.

## Arquivos

- Migração: `supabase/migrations/20260609193642_15940beb-...sql`
- Triggers: `guard_nf_deletion_when_submitted_to_sefaz`,
  `audit_nf_deletion` em `public.fiscal_invoices`.
- Tabela: `public.nf_deletion_audit`.
- Edges (criação de rascunho — SEM `syncFiscalNumberCursor`):
  `fiscal-prepare-invoice`, `fiscal-create-manual`,
  `fiscal-create-draft`, `fiscal-auto-create-drafts`.
- Edges (queima de número — bumpam cursor):
  `fiscal-submit`, `fiscal-emit`.
- UI: `src/components/fiscal/FiscalInvoiceList.tsx` (diálogo informa
  reuso e trata erro `NF_ALREADY_SUBMITTED_TO_SEFAZ`).

## Doc oficial

- `docs/especificacoes/erp/erp-fiscal.md` §"Numeração com
  reaproveitamento controlado (v2026-06-09 — Onda 3 rev2)".

## Memórias relacionadas

- `mem://constraints/nfe-numero-soberano-e-bloco-transportador`
- `mem://constraints/pv-from-paid-order-deletion-protected`
- `mem://constraints/fiscal-pv-and-nf-coexistence-partial-indexes`
- `mem://constraints/pv-pedido-status-mirror-from-order`
