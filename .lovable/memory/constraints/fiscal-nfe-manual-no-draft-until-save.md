---
name: Fiscal — NF Manual sem rascunho até Salvar
description: O botão "Nova NF-e" na aba Notas Fiscais NÃO pode criar registro no banco. Persistência é tardia, somente no primeiro Salvar.
type: constraint
---

# NF Manual: rascunho só nasce no primeiro Salvar

## Regra
O botão **"Nova NF-e"** (aba Notas Fiscais → FiscalInvoiceList) deve abrir o `InvoiceEditor` **apenas em memória**, com um `InvoiceData` vazio **sem `id`**. Nenhuma chamada a `fiscal-create-manual` pode acontecer nesse momento.

A linha em `fiscal_invoices` só é criada quando o usuário clica em **Salvar pela primeira vez**:
1. `handleSaveInvoice` detecta `!data.id` e chama `fiscal-create-manual` com `mode='nfe_manual'` para alocar a linha (número/série).
2. Em seguida chama `fiscal-update-draft` com o novo `invoice_id` para aplicar os dados do formulário.
3. Reflete o `id`/`numero`/`serie` no estado do editor (`setEditingInvoice`) para que Salvar/Emitir/Excluir subsequentes operem sobre a linha já persistida.

Se o usuário fechar o editor sem salvar, **nada fica no banco**.

## Proibido
- Chamar `fiscal-create-manual` dentro de `handleCreateNewInvoke` / equivalente.
- Pré-criar linha "vazia" só para reservar número — gera lixo na lista (ex.: "1-320" sem destinatário/valor).
- Mockar destinatário "CONSUMIDOR" ou item "PRODUTO" no draft inicial (já coberto por `fiscal-manual-nf-vs-pedido-venda-separation`).

## Por quê
O usuário relatou que clicar em "Nova NF-e" criava imediatamente um rascunho visível na lista, mesmo sem ter preenchido nada. Isso polui a aba Notas Fiscais com rascunhos órfãos, consome numeração fiscal e confunde a operação. NF é documento fiscal — a numeração só deve ser alocada quando o usuário declarar intenção real (Salvar).

## Como validar
1. Clicar em "Nova NF-e" e fechar o editor sem salvar → nenhuma linha nova em `fiscal_invoices`.
2. Clicar em "Nova NF-e", preencher e Salvar → 1 linha criada com `numero` sequencial e `fiscal_stage='pendencia'`.
