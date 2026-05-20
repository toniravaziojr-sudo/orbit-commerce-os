## Entrega — Sincronização Pedido de Venda ↔ Nota Fiscal (2026-05-20)

### O que mudou para o usuário

1. **Novo status "NF criada"** (roxo) na aba Pedidos de Venda. Aparece automaticamente quando uma Nota Fiscal é gerada a partir do Pedido, mesmo que a Receita ainda não tenha autorizado. Disponível em filtros, badges e exportação.

2. **Transições automáticas** (qualquer origem de pedido — manual, duplicado ou da loja/marketplace):
   - Nota Fiscal criada (rascunho/pronta/pendente/rejeitada) → Pedido passa para "NF criada".
   - Nota Fiscal autorizada pela Receita → Pedido passa para "Concluído".
   - Todas as Notas Fiscais filhas excluídas → Pedido volta para "Em aberto" (ou "Pendente" se tiver pendência fiscal).
   - Duplicar um Pedido **não copia** o vínculo de NF — a duplicação nasce limpa.
   - Cancelado/Chargeback do pedido original continuam tendo prioridade absoluta.

3. **Vínculo visível no diálogo do Pedido**: bloco roxo "Vinculado à Nota Fiscal nº X" mostrando todas as NFs filhas ativas e seus status. Se todas foram excluídas, mostra aviso amarelo orientando criar uma nova nota.

4. **Bug de ordenação corrigido**: a lista de Pedidos de Venda agora tem ordem 100% estável (data + identificador como desempate). Recargas automáticas em segundo plano não mexem mais na posição de pedidos com data próxima — fim do "pedido pulando de posição sozinho".

5. **Bug de exclusão corrigido**: o botão Excluir do editor não falha mais silenciosamente. Se a exclusão for bloqueada por regra do sistema (nota com efeito fiscal, por exemplo), mostra mensagem clara em português. Notas sem efeito fiscal (rascunho, rejeitada, cancelada) podem ser excluídas normalmente.

### Como você valida

1. Abra um Pedido de Venda e crie uma NF a partir dele. O Pedido deve aparecer como **"NF criada"** (roxo) na aba Pedidos de Venda.
2. Autorize a NF (transmissão Sefaz). O Pedido deve virar **"Concluído"** automaticamente.
3. Exclua a NF (enquanto ainda for rascunho/rejeitada). O Pedido deve voltar para **"Em aberto"** ou **"Pendente"** com aviso.
4. Tente excluir uma NF autorizada pelo editor — deve aparecer mensagem clara explicando que não pode (e nada é apagado).
5. Recarregue a lista de Pedidos de Venda várias vezes — a ordem dos pedidos com data próxima deve permanecer a mesma.

### Documentação atualizada

- `docs/especificacoes/erp/erp-fiscal.md` — seção "Status visual do Pedido de Venda" agora descreve os 7 status, as transições e o vínculo PV↔NF.
- Memória anti-regressão: `mem://constraints/pv-status-mirrors-child-nf` (indexada).

### Bloco técnico (opcional)

- Migration adiciona overload `derive_pv_pedido_status(...,p_has_active_nf boolean)`, função `recompute_pv_pedido_status(uuid)` para PVs sem `order_id`, atualiza `sync_pedido_status_for_order` e `trg_nf_sync_pv_status` (agora cobre DELETE), recria o trigger com `INSERT OR UPDATE OR DELETE`, e roda reconciliação retroativa em todos os PVs com NF filha.
- Frontend: `pedidoStatus.ts` ganha `nf_criada` em type/config/options; `useFiscal.ts` adiciona desempate por `id` na query; `FiscalInvoiceList.handleDeleteInvoice` checa `count` e dá toast claro; `InvoiceEditor` carrega NFs filhas e renderiza bloco roxo (ou amarelo se nenhuma estiver ativa).
