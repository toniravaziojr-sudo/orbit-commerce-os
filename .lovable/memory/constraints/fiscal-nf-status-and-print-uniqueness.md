---
name: fiscal-nf-status-and-print-uniqueness
description: Lista de Notas Fiscais exibe 1 pílula por linha (estado mais recente vence); impressão de DANFE abre uma única aba; envio à Sefaz sempre tem modal central de progresso; aba Pedidos de Venda inicia com filtro Em aberto.
type: constraint
---

# Fiscal — UI da lista de Notas Fiscais e impressão (rev 2026-05-21)

## 1. Status visual: 1 pílula por linha, estado mais recente vence

A coluna **Status** da lista de Notas Fiscais (`FiscalInvoiceList` em modo `invoices`) **nunca** mostra duas pílulas empilhadas para a mesma nota.

Regra:
- `status='authorized'` + `danfe_printed_at IS NOT NULL` → exibe **apenas "Impressa"** (verde).
- `status='authorized'` + `danfe_printed_at IS NULL` → exibe **apenas "Autorizada"** (azul).
- Demais status (`pending`, `processing`, `rejected`, `cancelled`, `error`, devolvida) seguem com pílula única.

A regressão proibida é renderizar `"Autorizada" + "Impressa"` ao mesmo tempo na mesma célula (era o comportamento antigo até 2026-05-21). O histórico de impressão continua acessível na timeline da nota — não duplicar pílulas para mostrá-lo na lista.

**Onde checar:** bloco `<TableCell>` da coluna Status em `src/components/fiscal/FiscalInvoiceList.tsx` (~linhas 1650-1710).

## 2. Imprimir DANFE: 1 aba só

A abertura do PDF da DANFE acontece **exclusivamente** dentro de `InvoiceActionsDropdown.handlePrintDanfe`. O callback `onPrint` recebido do pai (`FiscalInvoiceList.handlePrintDanfe`) deve apenas:
- marcar `danfe_printed_at` e `printed_at` em `fiscal_invoices`;
- chamar `refetch()`;
- mostrar toast.

**Nunca** chamar `window.open(invoice.danfe_url)` no callback do pai — isso causa a regressão "DANFE abre duas abas" registrada em 2026-05-21.

Dentro do `handlePrintDanfe` do dropdown, o listener `'load'` da janela aberta deve usar guard `printed` para evitar `print()` duplicado (alguns navegadores disparam `load` mais de uma vez para PDFs embeds).

## 3. Feedback visual obrigatório: modal central em toda ação fiscal de longa duração

Toda ação fiscal que faz round-trip ao backend e pode bloquear o usuário **deve** controlar o estado `sendingState` que alimenta `SendingInvoiceModal`:
- **Criar Nota Fiscal a partir de Pedido de Venda** (individual ou lote) via `fiscal-prepare-invoice` → `kind: 'create'`.
- **Emitir NF-e à Receita** (individual ou lote) via `fiscal-submit` → `kind: 'send'` (default).

Regras:
- abrir antes da chamada (com `total`, `done: 0`, `kind`);
- atualizar a cada item processado em lote (`done` incrementa, manter o mesmo `kind`);
- fechar no `finally` (`setSendingState(null)`).

O modal é **não-dismissível** enquanto a operação está em andamento (`onPointerDownOutside`, `onEscapeKeyDown`, `onInteractOutside` preventDefault). Isso bloqueia duplo-clique e cliques fora.

A pílula "Processando…"/"Pronta para Emitir" na linha permanece como reforço, **não substitui** o modal.

**Componente fonte da verdade:** `src/components/fiscal/SendingInvoiceModal.tsx`.
**Regressão proibida:** chamar `fiscal-prepare-invoice` ou `fiscal-submit` na lista sem disparar o modal — a tela parece travada e o usuário clica de novo.

## 4. Aba Pedidos de Venda inicia com filtro "Em aberto"

`FiscalInvoiceList` montado com `mode='orders'` inicializa `statusFilter = ['em_aberto']`. Com `mode='invoices'`, inicializa `statusFilter = []` (sem filtro).

Justificativa de negócio: ao abrir o módulo Fiscal, o lojista vê primeiro o que precisa de ação, sem precisar filtrar manualmente. Filtro pode ser alterado normalmente.

## Documentação relacionada
- `docs/especificacoes/erp/erp-fiscal.md` — Regras Anti-Regressão #11, #12, #13, #14
- `docs/especificacoes/transversais/mapa-ui.md` — rota `/fiscal`
