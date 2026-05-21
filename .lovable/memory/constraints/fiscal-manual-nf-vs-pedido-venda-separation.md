---
name: fiscal-manual-nf-vs-pedido-venda-separation
description: Criação manual de Pedido de Venda (aba Pedidos de Venda) e criação manual de NF Fiscal (aba Notas Fiscais) são fluxos distintos. "Nova NF-e" deve criar rascunho LIMPO de NF, sem item mockado, sem destinatário pré-preenchido, em modo NF Fiscal (não em modo PV).
type: constraint
---

# Fiscal — Separação entre Pedido de Venda manual e NF Fiscal manual (rev 2026-05-21)

## Regra

A aba **Pedidos de Venda** e a aba **Notas Fiscais** têm botões de criação manual independentes, com semântica e payloads diferentes. **Proibido** unificar os dois fluxos.

### Pedido de Venda manual (aba Pedidos de Venda)
- Botão "Novo Pedido de Venda" abre `ManualInvoiceDialog`.
- Edge `fiscal-create-manual` é chamada com `mode='pedido_venda'` (default legado), destinatário e itens **obrigatórios**.
- Registro nasce com `fiscal_stage='pedido_venda'`.
- Editor abre em **modo Pedido de Venda** com validações de venda a consumidor.

### NF Fiscal manual (aba Notas Fiscais)
- Botão "Nova NF-e" chama diretamente `fiscal-create-manual` com `mode='nfe_manual'`.
- Payload **mínimo**: apenas `natureza_operacao`. Sem destinatário, sem itens, sem item mockado.
- Registro nasce com `fiscal_stage='pendencia'` (não `pedido_venda`).
- Editor abre em **modo NF Fiscal** (`isPedidoVenda=false`):
  - Título "Série X – Nº Y" (não "Pedido Nº…").
  - **Sem** painéis de pendência/avisos pré-renderizados.
  - **Sem** item "PRODUTO" mockado e **sem** destinatário "CONSUMIDOR" pré-preenchido.
  - Usuário escolhe natureza, destinatário e produto via "Buscar produto".
- Validações fiscais **só disparam ao Salvar/Emitir**, classificando para `pronta_emitir` ou `pendencia`.

## Regressões proibidas

1. "Nova NF-e" enviar payload com `destinatario.nome='CONSUMIDOR'` ou item mockado (`descricao='PRODUTO'`, `ncm='00000000'`). O editor deve nascer em branco.
2. `fiscal-create-manual` setar `fiscal_stage='pedido_venda'` quando chamado em `mode='nfe_manual'`. Isso reabriria o editor em modo PV e mostraria avisos de pendência prematuros.
3. Tentar item manual em branco no editor: a inclusão de produto na NF segue a memória `fiscal-product-completeness-on-add` — produto deve vir do cadastro completo via `ProductSelector`.

## Onde validar

- Edge: `supabase/functions/fiscal-create-manual/index.ts` (v8.7.0+) — bloco `creationMode` e `initialStage`.
- Frontend: `src/components/fiscal/FiscalInvoiceList.tsx` → `handleCreateNewInvoice` (não envia mock).
- Editor: `src/components/fiscal/InvoiceEditor.tsx` → `isPedidoVenda = invoiceStage === 'pedido_venda'`.

## Documentação relacionada
- `docs/especificacoes/erp/erp-fiscal.md` — seção "Criação manual".
- Memória `fiscal-pedido-venda-vs-nf-two-records` — separação de PV e NF como registros distintos.
- Memória `fiscal-product-completeness-on-add` — exigência de produto cadastrado.
