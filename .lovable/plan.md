

# Plano Revisado: Corrigir Fluxo Fiscal (Pedidos + Notas Fiscais)

## Entendimento Correto

- **Aba "Pedidos em Aberto"**: Lista rascunhos de pedidos vindos de lojas/marketplaces **E** permite criar novos rascunhos manualmente. Botão "Novo Rascunho" abre formulário simplificado (sem escolha de tipo de NF).
- **Aba "Notas Fiscais"**: Lista NFs emitidas **E** permite criar NF manual com editor completo (tipo, entrada/saída, etc.). Botão "Nova NF-e" + dropdown "Ações" (NF-e de Entrada, Consultar por Chave).

## O que será feito

### 1. Aba "Pedidos em Aberto" — manter botão de criação de rascunho
- O botão "Nova NF-e" já existe aqui e continuará. Ele abre o `ManualInvoiceDialog` para criar um novo rascunho de pedido.
- O label será ajustado para **"Novo Rascunho"** para deixar claro que é um rascunho/pedido, não uma NF emitida.

### 2. Aba "Notas Fiscais" — adicionar botão "Nova NF-e"
- Adicionar botão principal **"Nova NF-e"** que abre o editor completo para criar uma nota fiscal manual (com escolha de tipo, entrada/saída, etc.).
- Manter o dropdown "Ações" ao lado com "NF-e de Entrada" e "Consultar por Chave".

### 3. Busca de cliente no ManualInvoiceDialog
- Seletor com duas opções: **"Cliente existente"** (busca por nome/email/CPF com debounce na tabela `customers`) e **"Preencher manualmente"** (campos vazios + opção de cadastrar novo cliente).

## Arquivos impactados

| Arquivo | Alteração |
|---|---|
| `FiscalInvoiceList.tsx` | Ajustar label do botão na aba orders para "Novo Rascunho"; adicionar botão "Nova NF-e" na aba invoices |
| `ManualInvoiceDialog.tsx` | Implementar busca de cliente existente com autocomplete |

