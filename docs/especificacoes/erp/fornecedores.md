# ERP > Fornecedores

**Status:** Fases A (cadastro), B/C-Fornecedor (uso no Fiscal de Entrada + "Salvar na base" de fornecedor), C-Cliente (Salvar na base de cliente em Pedido de Venda/NF manual com tratamento de duplicidade) e D (NF de Compra com fornecedor vinculado gera registro automático em Compras) entregues.

## Integração com Fiscal (Fase B/C — Entrada)

Na criação de NF-e de Entrada (Compra, Remessa, Transferência, Devolução, Outros), o campo Remetente/Fornecedor passa a oferecer:

1. **Busca na base** — autocomplete por nome, CNPJ ou CPF; ao escolher, os campos de identificação e endereço são preenchidos automaticamente e o fornecedor fica marcado como "Vinculado à base".
2. **Preenchimento manual** — quando o fornecedor não existe ainda, o usuário pode digitar nome e documento direto no formulário.
3. **Salvar na base** — botão explícito que cria o fornecedor no cadastro central. Se já existir um cadastro com o mesmo CPF/CNPJ, abre um diálogo com 3 opções: **Usar cadastro existente**, **Atualizar dados** ou **Cancelar**.

O vínculo com a base é **opcional para emitir a NF** — o fluxo nunca trava por causa do cadastro. Mas usar a base garante reuso de dados fiscais (IE, endereço completo) em emissões futuras.


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
| **Fiscal — Entrada** | Seletor de fornecedor nos editores de NF de Entrada/Compra, Remessa, Transferência, Devolução e Outros. |
| **"Salvar na base" — Fornecedor** | Botão dentro do editor de NF de Entrada que cria/atualiza cadastro a partir dos dados preenchidos, com verificação de duplicidade por documento (3 opções: usar / atualizar / cancelar). |
| **"Salvar na base" — Cliente** | Botão dentro do Pedido de Venda / NF manual que cria/atualiza cadastro de cliente a partir dos dados do destinatário, com a mesma regra de duplicidade. Aparece apenas no modo "Preencher manualmente". |
| **NF de Compra → Compras (automático)** | Ao salvar uma NF-e de Entrada do tipo **Compra** com fornecedor vinculado à base, o sistema cria automaticamente um registro em Compras (`status = pending`, vínculo `entry_invoice_id`). Se a criação automática falhar, o usuário é avisado e a NF segue válida — basta registrar a compra manualmente. |


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
