

## Refatoração UI/UX do Módulo Fiscal

### Situação Atual

A página Fiscal possui 3 abas principais (NFs Saída, NFs Entrada, Configurações), e dentro de cada lista há 6 sub-abas de status (Prontas para Emitir, Autorizadas, Emitidas, Pendentes SEFAZ, Rejeitadas, Canceladas). Isso gera muita fragmentação.

### Nova Estrutura

Duas abas principais + botão de Configurações separado:

```text
┌──────────────────────────────────────────────────────┐
│  Fiscal                              [Configurações] │
│  Gestão de notas fiscais eletrônicas (NF-e)          │
├─────────────────────┬────────────────────────────────┤
│  Pedidos em Aberto  │  Notas Fiscais                 │
├─────────────────────┴────────────────────────────────┤
│  [Filtro Status ▾] [Filtro Loja ▾] [Filtro Data ▾]  │
│  ─────────────────────────────────────────────────── │
│  Tabela de dados...                                  │
└──────────────────────────────────────────────────────┘
```

**Aba 1 — Pedidos em Aberto**
- Mostra todos os drafts (fiscal_invoices com status `draft`) de todas as lojas
- Filtro de status contextual: Pronta para emitir, Chargeback em andamento, Venda cancelada, etc. (baseado no `order_status` do pedido vinculado)
- Filtros de loja e data mantidos
- Ações: emitir, editar, excluir, emissão em lote

**Aba 2 — Notas Fiscais**
- Mostra todas as NFs que já passaram pelo processo de emissão (status ≠ `draft`)
- Filtro de status: Autorizada, Impressa, Pendente SEFAZ, Rejeitada, Cancelada, Devolução
- Filtros de loja e data mantidos
- Ações: imprimir DANFE, baixar XML, cancelar, corrigir (CC-e), consultar status

**Botão Configurações** — fora das abas, no canto superior direito do header

### O que muda

1. **`Fiscal.tsx`** — Reescrever: 2 abas (pedidos / notas) + botão Configurações separado. Remove distinção Saída/Entrada como aba principal.

2. **`FiscalInvoiceList.tsx`** — Refatorar: remover as sub-abas internas de status. Substituir por um filtro dropdown de status. Receber novo prop `mode: 'orders' | 'invoices'` em vez de `tipoDocumento`. No modo `orders`, filtra `status = 'draft'`. No modo `invoices`, filtra `status != 'draft'`.

3. **`useFiscal.ts`** — Ajustar `useFiscalInvoices` para suportar o novo filtro por modo (draft vs não-draft) e `useFiscalStats` para refletir as contagens corretas por aba.

4. **Filtro de status** — Novo componente dropdown (ou reutilizar padrão existente) para filtrar por status contextual dentro de cada aba.

### O que NÃO muda (preservação de fluxo)

- Nenhuma edge function é alterada
- Nenhuma tabela ou migration é necessária
- O fluxo de criação automática de drafts permanece intacto
- As ações (emitir, cancelar, corrigir, imprimir) continuam usando as mesmas funções
- Todos os dialogs (ManualInvoiceDialog, InvoiceEditor, CancelInvoiceDialog, etc.) permanecem inalterados
- A query ao banco continua a mesma, apenas o filtro client-side muda
- NFs de entrada continuam acessíveis (serão exibidas na aba Notas Fiscais com indicação visual)

### Passos de Implementação

1. Criar componente `FiscalStatusFilter` — dropdown multi-select para filtrar por status
2. Refatorar `FiscalInvoiceList` — aceitar `mode` prop, remover sub-abas, usar filtro dropdown
3. Reescrever `Fiscal.tsx` — 2 abas + botão Configurações
4. Ajustar hooks de stats para nova contagem por aba

