# Plano — Integridade Fiscal × Logística (em andamento)

## Status: Proteções estruturais aplicadas — tema em pausa, retomar se reaparecer

### Contexto
Durante o E2E da Pratika (Respeite o Homem, 2026-06-05) foram descobertos três gaps estruturais entre Fiscal e Logística usando o pedido real #583 da Maria (em vez de uma duplicação como deveria ser o teste):

1. NF cancelada deixava etiqueta despachada ativa, sem nenhum aviso.
2. Objeto de postagem podia existir sem Remessa agrupadora, ficando visível em "Objetos" e invisível em "Remessas".
3. PV permanecia desaparecido da listagem mesmo após o cancelamento da NF (problema de UI já tratado em entregas anteriores; modelo PV × NF coexistente é o correto).

### Correções aplicadas nesta rodada (2026-06-05)
1. **Limpeza pontual #583 Maria:** NF cancelada removida, objeto e remessa órfãos apagados, PV 395 voltou para "Em aberto / Pronto para emitir".
2. **Auto-cura do agrupador:** todo objeto com rastreio passa a ter, na mesma transação, uma Remessa agrupadora válida. Garantido por gatilho no banco.
3. **Proteção de exclusão de Remessa:** agrupador com objetos ativos vinculados não pode ser apagado (mensagem PT-BR para o operador).
4. **Cascata no cancelamento da NF:** rascunhos são deletados, objetos despachados ganham flag "exige ação / NF cancelada".
5. **Documentação:**
   - `docs/especificacoes/erp/logistica.md` §"Integridade Objeto × Agrupador × NF".
   - `docs/especificacoes/erp/erp-fiscal.md` §"Cascata para a Logística ao cancelar a NF".
   - `mem://constraints/shipping-remessa-self-heal-and-cancel-cascade` (nova).
   - Índice de memórias atualizado.

### Pendências em aberto (para retomada futura, se reaparecer)
- **UI da aba Logística:** ainda não existe banner visual para objetos com `requires_action=true / invoice_cancelled`. Hoje a flag fica no banco e bloqueia, mas o operador precisa entrar no detalhe para entender o motivo. Decisão de UX pendente com o usuário.
- **Listagem de PV após NF cancelada:** confirmar com o usuário se a coexistência PV (em aberto) + NF (cancelada) deve aparecer com badge explícito na lista de PVs ou apenas no detalhe.
- **Política de teste E2E:** padronizar que todo teste fiscal seja feito sobre PV duplicado, nunca sobre pedido real — para evitar repetir o cenário Maria.

### Como retomar
Se houver novo bug nessa interface Fiscal × Logística:
1. Reler este plano + `mem://constraints/shipping-remessa-self-heal-and-cancel-cascade` + `mem://constraints/fiscal-pv-and-nf-coexistence-partial-indexes`.
2. Verificar se as três proteções estruturais ainda estão ativas no banco (gatilhos `trg_ensure_shipment_has_remessa`, `trg_guard_remessa_deletion` e a cascata em `fiscal-cancel`).
3. Decidir junto ao usuário se as pendências de UI acima entram no escopo.
