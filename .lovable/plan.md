

## Plano de Ajustes no Módulo Fiscal

### Situação Atual
- **Aba Pedidos em Aberto**: O botão "+Nova NF-e" contém NF-e de Saída, Inutilizar Numeração e Consultar por Chave — mas falta a opção de NF-e de Entrada
- **Aba Notas Fiscais**: Faltam o card "Devolvido" nos stats e a opção "Emitir Devolução" nas ações individuais por NF-e
- **Ações em massa**: Existem para a aba Pedidos em Aberto (emitir/excluir drafts, imprimir/XML de autorizadas), mas na aba Notas Fiscais a barra de ações em massa aparece com as mesmas opções — precisa incluir reenvio por email em massa
- **Ações individuais (InvoiceActionsDropdown)**: NF-e autorizada tem Imprimir, Baixar PDF/XML, Copiar Chave, Carta de Correção, Duplicar, Histórico, Cancelar — mas falta "Emitir Devolução" e "Reenviar por Email"

### Ajustes Planejados

**Ajuste 1 — Reestruturar botão "+Nova NF-e" na aba Pedidos em Aberto**
- Adicionar opção "NF-e de Entrada (Devolução)" ao dropdown, abrindo o `EntryInvoiceDialog` já existente
- Remover "Inutilizar Numeração" do dropdown (mover para Configurações Fiscais)
- Remover "Consultar por Chave" do dropdown (adicionar como opção no filtro de busca ou manter apenas na aba Notas Fiscais)

**Ajuste 2 — Adicionar card "Devolvido" na aba Notas Fiscais**
- Adicionar contagem de NFs com status de devolução (invoices que possuem `nfe_referenciada` preenchida ou que foram criadas como tipo_documento=0/finalidade=4)
- Novo StatCard com ícone de devolução e cor adequada
- Adicionar filtro correspondente no `invoiceStatusOptions`

**Ajuste 3 — Completar ações em massa e individuais na aba Notas Fiscais**
- **Ações em massa (barra de seleção)**: Garantir que Imprimir, Baixar XML, e Reenviar email funcionem para NFs autorizadas selecionadas
- **Ações individuais (InvoiceActionsDropdown)**: Adicionar "Emitir Devolução" para NF-e autorizada (abre EntryInvoiceDialog pré-preenchido com a chave da NF-e) e "Reenviar por Email" (invoca envio do DANFE por email ao destinatário)

**Ajuste 4 — Documentação**
- Atualizar a memória `features/fiscal/ui-ux-architecture-v3-0` com a estrutura completa dos botões, cards, ações em massa e ações individuais por status

### Arquivos Impactados
- `src/components/fiscal/FiscalInvoiceList.tsx` — reestruturar dropdowns, cards, ações em massa
- `src/components/fiscal/InvoiceActionsDropdown.tsx` — adicionar "Emitir Devolução" e "Reenviar Email"
- `src/components/fiscal/FiscalStatusFilter.tsx` — adicionar opção "Devolvido" nos filtros de notas
- `src/components/fiscal/EntryInvoiceDialog.tsx` — aceitar prop opcional `chaveAcesso` para pré-preenchimento
- `src/components/fiscal/FiscalSettingsContent.tsx` — verificar se já tem seção para Inutilização ou adicionar acesso
- Memória do projeto — atualizar documentação

