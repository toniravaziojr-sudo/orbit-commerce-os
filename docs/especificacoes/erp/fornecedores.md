# ERP > Fornecedores

**Status:** Fase A entregue (cadastro). Fases B (uso no Fiscal), C ("Salvar na base" em NF/Pedido) e D (NF de Compra → módulo Compras automático) em andamento.

## Propósito

Cadastro único de fornecedores do tenant, usado como **fonte de verdade** por todos os módulos que precisem de um fornecedor (Compras, Fiscal, e futuras integrações). Espelha o papel que o cadastro de Clientes exerce para vendas.

## Rota

`/suppliers` — sidebar ERP > Fornecedores, ao lado de Fiscal, Financeiro e Compras.

## Estrutura do cadastro

Organizado em 4 abas no formulário:

### Dados básicos
- Tipo de pessoa (PF/PJ) — define qual documento usar
- Nome (sempre obrigatório, é o nome exibido)
- Razão social e Nome fantasia (apenas PJ)
- CNPJ (PJ) ou CPF (PF) — armazenado apenas em dígitos
- Indicador "Fornecedor estrangeiro"
- E-mail, telefone, telefone secundário
- Status ativo/inativo

### Endereço
Endereço estruturado: CEP, UF, cidade, logradouro, número, complemento, bairro, código IBGE do município, país.

### Fiscal
- Tipo de contribuinte: Contribuinte ICMS, Contribuinte isento, Não contribuinte (exigência SEFAZ)
- Inscrição Estadual + flag "Isento de IE" (quando isento, campo IE é desabilitado e zerado)
- Inscrição Municipal
- Observações fiscais (separadas das comerciais)

### Comercial
- Tipo de fornecedor (taxonomia gerenciável)
- Pessoa de contato
- Observações comerciais

## Regras de integridade

- **Documento único por tenant:** o mesmo CPF/CNPJ não pode estar em dois cadastros ativos do mesmo tenant. Garantido por índice único parcial no banco.
- **Soft delete:** "Inativar" marca `deleted_at` e `is_active = false`. Cadastros inativados somem das listas e seletores, mas o histórico em Compras e NFs permanece intacto.
- **Sem exclusão dura na UI:** segue o mesmo padrão de Clientes e Produtos.

## Integração com módulos

| Módulo | Como usa |
|---|---|
| **Compras** | Continua consumindo os fornecedores via `usePurchaseSuppliers` (compatibilidade total). A aba "Fornecedores" dentro de Compras será descontinuada em fase futura para evitar duplicidade de entrada — usuário será orientado a usar ERP > Fornecedores. |
| **Fiscal** (a entregar — Fase B) | Seletor de fornecedor nos editores de NF de Entrada/Compra, Remessa, Transferência, Devolução e Complementar de Entrada. |
| **"Salvar na base"** (a entregar — Fase C) | Botão dentro dos editores de NF de fornecedor para criar/atualizar cadastro a partir dos dados preenchidos, com verificação de duplicidade por documento. |
| **NF de Compra → Compras** (a entregar — Fase D) | NF de entrada gera automaticamente o registro correspondente no módulo Compras. |

## Decisão sobre duplicidade no "Salvar na base"

Quando o usuário tentar salvar um cadastro com CPF/CNPJ já existente:
1. Mostra aviso identificando o cadastro encontrado.
2. Oferece 3 opções: **Atualizar os dados existentes**, **Usar o cadastro existente como está** (apenas vincula), ou **Cancelar**.

Mesma regra aplicada ao "Salvar na base" de Clientes em Pedido de Venda e NF de Venda.

## Estrutura técnica (referência rápida)

- Tabela: `public.suppliers` (expandida em 2026-05-21).
- Tipos: `supplier_person_type` (PF/PJ), `supplier_contributor_type`.
- Função utilitária: `suppliers_doc_digits(cnpj, cpf, person_type)`.
- Índice único: `uq_suppliers_tenant_doc` (parcial, ignora soft-deleted e nulos).
- Hook React: `useSuppliers` (`src/hooks/useSuppliers.ts`) — expõe `findByDocument` para o fluxo "Salvar na base".
- Hook legado: `usePurchaseSuppliers` mantido como reexport para não quebrar o módulo Compras.
- RLS: herdada da tabela existente — acesso via `user_has_tenant_access(tenant_id)`.
