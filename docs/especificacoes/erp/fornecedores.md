# ERP > Fornecedores

**Status:** Fases A (cadastro), B/C-Fornecedor (uso no Fiscal de Entrada + "Salvar na base" de fornecedor), C-Cliente (Salvar na base de cliente em Pedido de Venda/NF manual com tratamento de duplicidade) e D (NF de Compra com fornecedor vinculado gera registro automático em Compras) entregues.

**Validação end-to-end (2026-05-21, tenant Respeite o Homem):** "Salvar na base" testado nos dois lados — Cliente (a partir do Pedido de Venda) e Fornecedor (a partir da NF de Entrada). Cadastros gravados com sucesso, trava de duplicidade por CPF/CNPJ funcionando, limpeza confirmada. Durante o teste foi corrigido bug do "Salvar cliente na base" que falhava 100% por divergência de formato no tipo de pessoa — formato esperado pelo cadastro de Clientes é minúsculo (`pf`/`pj`), enquanto Fornecedores usa maiúsculo (`PF`/`PJ`). Ver memória anti-regressão `customers-person-type-lowercase`.

## Integração com Fiscal (Fase B/C — Entrada)

Na criação de NF-e de Entrada (Compra, Remessa, Transferência, Devolução, Outros), o campo Remetente/Fornecedor passa a oferecer:

1. **Busca na base** — autocomplete por nome, CNPJ ou CPF; ao escolher, os campos de identificação e endereço são preenchidos automaticamente e o fornecedor fica marcado como "Vinculado à base".
2. **Preenchimento manual** — quando o fornecedor não existe ainda, o usuário pode digitar nome e documento direto no formulário.
3. **Salvar na base** — botão explícito que cria o fornecedor no cadastro central. Se já existir um cadastro com o mesmo CPF/CNPJ, abre um diálogo com 3 opções: **Usar cadastro existente**, **Atualizar dados** ou **Cancelar**.

O vínculo com a base é **opcional para emitir a NF** — o fluxo nunca trava por causa do cadastro. Mas usar a base garante reuso de dados fiscais (IE, endereço completo) em emissões futuras.

### Retificação 2026-05-24 — Salvamento completo do fornecedor

Antes desta data, o "Salvar na base" dentro da NF gravava apenas nome e CNPJ/CPF. Endereço, IE, código IBGE do município, e-mail e telefone ficavam em branco e o tipo de contribuinte caía sempre em "Não contribuinte" — obrigando o lojista a abrir o cadastro central depois para completar.

A partir de 2026-05-24 o salvamento passa a persistir, em uma única ação, tudo o que está disponível no destinatário da NF:

- Nome / Razão Social, CNPJ ou CPF
- Inscrição Estadual e flag de isento
- **Tipo de contribuinte inferido automaticamente** a partir do indicador de IE da NF: 1 → Contribuinte ICMS, 2 → Contribuinte isento, 9 → Não contribuinte. Sem indicador, usa a presença da IE como pista
- Endereço completo: CEP, logradouro, número, complemento, bairro, cidade, UF e **código IBGE do município**
- E-mail e telefone

Quando algum dado essencial não estiver preenchido na NF (endereço ou IE), o cadastro nasce parcial e o sistema avisa em destaque, sem bloquear: "Fornecedor salvo, mas faltou [campo]. Você pode completar em Fornecedores quando quiser."

**Atualização de duplicado:** quando o CNPJ/CPF já existe e o usuário escolhe "Atualizar dados existentes", o mesmo enriquecimento é aplicado, incluindo IBGE e tipo de contribuinte. Política preservada — campo vazio na NF **não** sobrescreve campo preenchido no cadastro existente.

### Retificação 2026-05-25 — Enriquecimento padrão Cliente (IE digitada vence)

A partir de 2026-05-25 o "Salvar na base" e o "Atualizar cadastro" seguem exatamente o mesmo padrão de enriquecimento aplicado a Clientes (memória `profile-enrichment-policy-standard`): a NF aberta no editor é tratada como a **fonte mais recente** sobre o fornecedor.

Regras consolidadas:

- **Campo não-vazio na NF sobrescreve** o cadastro (nome, e-mail, telefone, endereço completo, IBGE).
- **Campo vazio preserva** o que já está salvo — nunca apaga dado existente.
- **Documento (CPF/CNPJ) e tipo de pessoa** são imutáveis após criação.
- **Inscrição Estadual digitada vence o indicador IE.** Se o usuário escreveu uma IE no formulário, o fornecedor é gravado como Contribuinte ICMS com aquela IE — mesmo que o indicador esteja em 2 (isento) ou 9 (não contribuinte). Esta era a causa raiz do incidente K LOGISTICA (2026-05-25), em que a IE digitada na NF era descartada pelo indicador padrão 9.
- **Auto-flip do indicador IE na UI.** Quando o usuário digita uma IE válida e o indicador estava em 9 (não contribuinte), o seletor é promovido automaticamente para 1 (Contribuinte ICMS). O usuário pode mudar manualmente depois.
- **Indicador 2 / 9 só apaga IE existente** se o cadastro já estava sem IE. Se já havia IE salva, ela é preservada (regra "campo vazio não apaga").



### UI unificada do cartão Fornecedor / Remetente (rev 2026-05-24)

No editor de NF de Entrada (tipos: Compra, Remessa, Transferência, Devolução, Outros), a aba **Dest.** exibe um **único cartão "Fornecedor / Remetente"** que funde o que antes eram três seções separadas (autocomplete, dados básicos e endereço).

Estrutura do cartão, de cima para baixo:

1. **Busca e vínculo (topo)** — campo de autocomplete por nome, CNPJ ou CPF; ao escolher um cadastro da base, todos os campos abaixo são preenchidos automaticamente e o cartão exibe o status "Vinculado à base" com opção de desvincular.
2. **Identificação** — Razão Social / Nome, CNPJ/CPF, Inscrição Estadual, flag de isento e tipo de contribuinte.
3. **Endereço completo** — CEP, logradouro, número, complemento, bairro, cidade, UF e código IBGE.
4. **Contato** — e-mail e telefone.
5. **Ação no rodapé** — o botão **"Salvar na base"** fica no final do cartão, após todos os campos, e persiste em uma única ação tudo o que está visível no formulário. Se o fornecedor já estiver vinculado, o botão muda para **"Atualizar cadastro com estes dados"** e aplica a mesma política de enriquecimento com preservação de campos preenchidos. Essa unificação elimina a confusão anterior em que o botão de salvar aparecia em um cartão separado (só com nome e CNPJ) enquanto os dados completos ficavam em outro.






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
