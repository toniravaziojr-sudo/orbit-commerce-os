# Memory: features/fiscal/ui-simplification-standard
Updated: 2026-04-14

## Fluxo Fiscal — Interface (rev4)

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
- Tipo de NF (Saída, Entrada, Devolução, Remessa, Transferência) é selecionado dentro do InvoiceEditor na aba Geral

### Naturezas de Operação (rev4 — 2026-04-14)
- Tabela `fiscal_operation_natures` é a fonte de verdade
- InvoiceEditor carrega naturezas ativas do banco, filtradas pelo tipo de nota selecionado
- Ao selecionar uma natureza, CFOP, indicador de presença e consumidor final são preenchidos automaticamente
- Ao trocar o tipo de nota, natureza e CFOP são resetados
- DEFAULT_NATURES expandido com 18 naturezas comuns de e-commerce (vendas, entradas, remessas, devoluções, transferência, bonificação)
- Seed automático: ao acessar a tela de configuração sem naturezas, as padrão são criadas

### Distinção Pedido vs NF-e
- Pedido = prévia da NF, dados comerciais apenas (cliente, produtos, valores)
- NF-e = documento fiscal completo com dados tributários, transporte, pagamento
- O dialog de "Novo Pedido" NÃO é igual ao editor de NF-e

### Doc formal
Fonte de verdade: `docs/especificacoes/erp/erp-fiscal.md` — LEITURA OBRIGATÓRIA antes de qualquer implementação no módulo fiscal.
