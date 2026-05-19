# Plano — Pedidos de Venda do módulo Fiscal como espelho fiel do módulo de Pedidos (core)

## Diagnóstico — o que está quebrado hoje

Auditoria do fluxo Pedidos → aba **Pedidos de Venda** do Fiscal encontrou 4 falhas estruturais que se reforçam:

**1. Gatilho de criação do Pedido de Venda usa vocabulário legado.**
O sistema só cria o registro fiscal quando o pedido entra em pagamento "aprovado" no vocabulário antigo. O vocabulário oficial atual é outro. Resultado: parte dos pedidos aprovados nunca é enfileirada e nasce sem PV (caso do pedido #182 no respeiteohomem).

**2. O Pedido de Venda é uma "foto" — não acompanha o ciclo de vida do pedido.**
Depois de criado, o PV não recebe nenhuma atualização quando o pedido muda (cancela, vira chargeback, é recuperado, é devolvido). A lista do Fiscal hoje tenta ler um indicador de estado do pedido que **nem existe** na base — por isso os status "Cancelado" e "Chargeback" no filtro **nunca disparam**, apesar de aparecerem no código.

**3. Regressões cancelam só a fila, não o PV já materializado.**
Quando um pedido vira chargeback/cancelado/expirado, o sistema cancela apenas itens ainda em processamento. O PV que já existe continua marcado como "em aberto" para sempre. Foi exatamente o caso do Marcos (#476, expirado) e do Luiz (#173, chargeback).

**4. Não existe caminho de volta nem distinção entre estados de chargeback.**
- "Chargeback em andamento" (disputa aberta) hoje não existe — fica como "em aberto" normal.
- "Chargeback perdido" não tem visual próprio.
- "Chargeback recuperado" não devolve o PV para "em aberto".

---

## Regra de negócio final (a ser implementada)

### Os 6 status oficiais do Pedido de Venda

| Status PV | Quando aparece | Cor |
|---|---|---|
| **Pedido em aberto** | Pedido aprovado, sem NF autorizada e sem pendência | Azul |
| **Pendente** | Falta dado fiscal obrigatório (NCM, peso, endereço, etc.) | Amarelo |
| **Concluído** | Já existe NF autorizada derivada deste PV | Verde |
| **Chargeback em andamento** | Pedido com chargeback detectado, em disputa | Laranja |
| **Chargeback perdido** | Disputa de chargeback perdida (terminal) | Vermelho |
| **Cancelado** | Pedido cancelado, expirado pelo prazo, ou devolvido | Cinza/Vermelho |

Cada status tem filtro próprio na aba Pedidos de Venda e card de contagem no topo.

### Mapeamento completo de cada status do módulo Pedidos (core) → status do Pedido de Venda

Esta é a fonte única de verdade. Toda mudança no pedido refaz o cálculo automaticamente.

| Status no módulo Pedidos | Status no Pedido de Venda (Fiscal) |
|---|---|
| `pending` / `awaiting_payment` / `awaiting_confirmation` | **Não gera PV** (ainda não aprovado) |
| `paid` / `ready_to_invoice` | Pedido em aberto |
| `processing` | Pedido em aberto |
| `invoice_pending_sefaz` | Pedido em aberto |
| `invoice_rejected` | Pedido em aberto (com pendência sinalizada) |
| `invoice_authorized` / `invoice_issued` | Concluído |
| `shipped` / `in_transit` / `dispatched` | Concluído |
| `delivered` / `completed` / `fulfilled` | Concluído |
| `chargeback_detected` | **Chargeback em andamento** |
| `chargeback_recovered` | Pedido em aberto (volta) |
| `chargeback_lost` | **Chargeback perdido** (terminal) |
| `payment_expired` | Cancelado |
| `cancelled` / `cancelled_by_user` | Cancelado |
| `invoice_cancelled` | Cancelado |
| `returning` / `returned` | Cancelado |

E como complemento (independente do status do pedido):
- Existe NF autorizada derivada → força **Concluído**.
- Falta dado fiscal obrigatório → força **Pendente** (quando ainda não foi para chargeback/cancelado).

### Regra de precedência (resolve ambiguidade)

Quando mais de uma regra se aplica ao mesmo PV, vale a primeira que casar (de cima para baixo):

1. Chargeback perdido (terminal)
2. Cancelado / expirado / devolvido
3. Chargeback em andamento
4. Concluído (NF autorizada derivada existe)
5. Pendente (falta dado fiscal)
6. Pedido em aberto (padrão)

**Justificativa técnica:** chargeback_lost e cancelado são estados terminais do pedido — mesmo que tenha tido NF emitida antes, operacionalmente o pedido "morreu" e o PV precisa refletir isso. A NF emitida continua existindo na aba "Notas Fiscais" com a bandeira de "ação manual necessária" para cancelamento contábil, como já funciona hoje (regra de segurança fiscal preservada).

### Princípio de segurança preservado

Automação **nunca** cancela NF-e já autorizada nem etiqueta despachada. A mudança no PV é apenas sinalização visual e de filtro — a NF já emitida continua válida no SEFAZ até ação humana, com a bandeira de alerta que já existe hoje.

---

## Plano de execução (4 etapas, com confirmação entre cada uma)

### Etapa 1 — Modelo de dados e fonte de verdade
1. Acrescentar no Pedido de Venda um indicador sincronizado do status atual do pedido (denormalização controlada, atualizada por gatilho automático).
2. Gatilho no pedido propaga o status atual para todos os PVs vinculados em **qualquer** mudança de status do pedido.
3. Backfill único dos PVs existentes para preencher o indicador com o status atual do pedido vinculado.

### Etapa 2 — Gatilho de criação à prova de vocabulário
1. Corrigir o gatilho de enfileiramento para reconhecer **todos** os estados de pagamento aprovado (vocabulário antigo e novo).
2. Garantir que pedidos que nascem ou pulam direto para estados pós-pagamento (`paid`, `processing`, `shipped`, etc.) também enfileirem, se ainda não tiverem PV.
3. Rotina de reconciliação detecta pedidos aprovados sem PV e enfileira (rede de proteção).

### Etapa 3 — Transições especiais (chargeback e retorno)
1. `chargeback_detected` no pedido → PV recebe estado "Chargeback em andamento".
2. `chargeback_lost` → PV vira "Chargeback perdido" (terminal).
3. `chargeback_recovered` → PV volta para "Pedido em aberto".
4. `cancelled`, `cancelled_by_user`, `payment_expired`, `returned`, `returning`, `invoice_cancelled` → PV vira "Cancelado".
5. Emissão de NF autorizada a partir do PV → PV vira "Concluído" automaticamente (já existe vínculo `source_order_invoice_id`; só padronizar e proteger).
6. Reabertura de pedido cancelado para um estado aprovado → PV volta para "Pedido em aberto".

### Etapa 4 — UI: status, filtros e contadores fiéis
1. Atualizar a fonte única de derivação do status do PV para usar o indicador sincronizado (em vez do campo fantasma de hoje).
2. Adicionar o novo status **"Chargeback em andamento"** e o filtro correspondente na aba Pedidos de Venda.
3. Separar visualmente "Chargeback em andamento" (laranja) de "Chargeback perdido" (vermelho) e de "Cancelado" (cinza).
4. Cards de contagem da aba Pedidos de Venda passam a refletir os 6 status oficiais.
5. Conciliação visual com o card "Aprovados / Aguardando NF" do módulo Pedidos: ambos passam a contar exatamente a mesma base (todo pedido aprovado sem NF autorizada).

---

## O que NÃO entra nesta entrega
- Reconciliação do tenant respeiteohomem (registros órfãos, duplicados, pedido #182 sem PV, PV do chargeback do Luiz, PV do Marcos cancelado, duplicatas dos #209/#210). Fica para a entrega seguinte, **depois** que o fluxo estiver à prova de erros — exatamente como você pediu.
- Mudança em NF-e já autorizada. Continua sendo ação manual com bandeira de alerta (regra de segurança fiscal/contábil).
- Mudanças no módulo Pedidos em si. Esta entrega só ensina o Fiscal a refletir corretamente o que já existe no core.

---

## Documentação que será atualizada na mesma entrega
- Doc do módulo Fiscal — nova máquina de estados do PV, tabela de mapeamento completa e regra de precedência.
- Doc do módulo Pedidos — referência cruzada da propagação para Fiscal.
- Mapa de UI — novo status "Chargeback em andamento", novo filtro e novos cards.
- Memória de governança "regressão entre módulos" — incluir a expansão do PV (não só fila).
- Nova memória de governança "espelhamento Pedidos → Pedido de Venda do Fiscal" para evitar regressão futura.

---

## Validação obrigatória ao final
Antes de fechar como "Corrigido e validado", a IA executa em ambiente real um pedido de cada cenário e confirma o status visual do PV resultante:

1. Pedido novo aprovado → PV "em aberto".
2. Emitir NF do PV → PV vira "Concluído".
3. Cancelar pedido aprovado → PV vira "Cancelado".
4. Expirar pagamento → PV vira "Cancelado".
5. Marcar como `chargeback_detected` → PV vira "Chargeback em andamento".
6. Marcar como `chargeback_lost` → PV vira "Chargeback perdido".
7. Marcar como `chargeback_recovered` → PV volta para "em aberto".
8. Devolução / `returning` → PV vira "Cancelado".
9. Conferir contagem dos cards do Fiscal vs cards do módulo Pedidos — devem bater.

---

## Status

**Aguardando sua confirmação para iniciar a Etapa 1.** Cada etapa é aplicada e validada antes de seguir para a próxima, sem risco de quebrar o fluxo ativo.
