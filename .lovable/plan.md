

# Plano Revisado v2: Corrigir Fluxo Fiscal (Pedidos + Notas Fiscais)

## Correções aplicadas (2026-04-14)

### 1. Botão "Novo Pedido" na aba Pedidos em Aberto
- Renomeado de "Novo Rascunho" para **"Novo Pedido"**.

### 2. Aba Notas Fiscais — remoção do dropdown Ações
- Removido dropdown "Ações" desnecessário.
- **"NF-e de Entrada"** agora é botão direto ao lado de "Nova NF-e".
- **"Consultar por Chave"** removido (já funciona pelo campo de busca existente que busca por `chave_acesso`).

### 3. Remoção de lógica duplicada no ManualInvoiceDialog
- Removido o seletor "Importar de Pedido (opcional)" que duplicava a escolha entre manual/existente.
- Título do dialog alterado para **"Novo Pedido"**.

### 4. Correção da busca de clientes
- Campo corrigido de `name` para `full_name` (nome real da coluna na tabela `customers`).
- Endereço agora vem da tabela `customer_addresses` (join), não de colunas inexistentes `address_*` na tabela `customers`.
- Prioriza endereço marcado como `is_default`, ou usa o primeiro disponível.
- Filtro `deleted_at IS NULL` adicionado para excluir clientes removidos.
