# Memory: features/fiscal/ui-simplification-standard
Updated: 2026-04-14

## Fluxo Fiscal — Interface (rev3)

### Aba "Pedidos em Aberto" (mode=orders)
- Lista rascunhos de diversas origens (lojas, marketplaces, manual)
- Botão **"Novo Pedido"** abre `ManualInvoiceDialog` — formulário simplificado:
  - Cliente (busca por full_name, email ou cpf com dropdown de resultados + join em customer_addresses)
  - Produtos (descrição, código, unidade, qtd, valor)
  - Observações
- **SEM campos fiscais** (NCM, CFOP, CSOSN preenchidos automaticamente pelo backend)
- Pedidos em aberto são NF-e de venda/saída — ao emitir, transformam-se em NF-e

### Aba "Notas Fiscais" (mode=invoices)
- Lista NF-e emitidas (autorizadas, pendentes, rejeitadas, canceladas)
- Botão **"Nova NF-e"** → cria rascunho vazio e abre o **InvoiceEditor** completo (6 abas)
- ~~Botão "NF-e de Entrada"~~ REMOVIDO na rev3
- Tipo de NF (Saída, Entrada, Devolução, Remessa, Transferência, Outros) é selecionado dentro do InvoiceEditor na aba Geral
- ~~Menu "Ações"~~ REMOVIDO (redundante)
- ~~"Consultar por Chave"~~ REMOVIDO (campo de busca já cobre essa funcionalidade)

### Distinção Pedido vs NF-e
- Pedido = prévia da NF, dados comerciais apenas (cliente, produtos, valores)
- NF-e = documento fiscal completo com dados tributários, transporte, pagamento
- O dialog de "Novo Pedido" NÃO é igual ao editor de NF-e

### Doc formal
Fonte de verdade: `docs/especificacoes/erp/erp-fiscal.md` — LEITURA OBRIGATÓRIA antes de qualquer implementação no módulo fiscal.
