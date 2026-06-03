# Plano de ajuste — Proteção do Pedido de Venda, gap logístico e ajuste de UI

## Parte 1 — Proteção contra exclusão de PV de pedido real

**Como funciona hoje:** Qualquer PV pode ser excluído pela tela Fiscal, inclusive os que vieram de um pedido pago real. Não há bloqueio, nem aviso especial, nem registro do que foi excluído.

**O que será feito:**

1. **Bloqueio na exclusão de PV de pedido real pago**
   - Regra: se o PV está vinculado a um pedido cujo pagamento foi aprovado (ou em estado equivalente a pago), a exclusão é **bloqueada** tanto no banco quanto na tela.
   - Mensagem ao usuário: *"Este Pedido de Venda pertence a um pedido pago e não pode ser excluído. Se precisar descartar, cancele o pedido de origem na tela de Pedidos."*
   - PV manual (sem pedido vinculado) e PV de pedido não pago (expirado, cancelado, aguardando pagamento) continuam podendo ser excluídos normalmente.
   - Único caminho para descartar PV de pedido pago: **cancelar o pedido na tela de Pedidos** — a cascata existente cuida do resto.

2. **Camada dupla de proteção**
   - **Banco:** gatilho de segurança impede o delete com erro claro mesmo se vier por script, API ou bug.
   - **Tela:** o diálogo de exclusão consulta o estado do pedido de origem antes de abrir e, se for pedido pago, mostra o aviso e desabilita a confirmação.

## Parte 2 — Auditoria de exclusão de PV

- Toda exclusão de PV gera um registro de auditoria com: número do PV, pedido de origem, cliente, total, snapshot dos itens, quem excluiu, quando.
- Disponível em log interno para recuperação manual em caso de exclusão por engano.
- Sem nova tela neste momento (item 3 da conversa anterior foi descartado).

## Parte 3 — Cascata simplificada PV → Objeto de postagem

**Decisão do usuário:** sempre que o PV for removido, o objeto de postagem vinculado também é removido — sem exceções.

**O que será feito:**
- Atualizar a cascata existente para remover o objeto independentemente do estado dele (rascunho, etiqueta gerada, postado, em trânsito, etc.).
- Se a remessa agrupadora ficar vazia após a remoção, ela também é apagada.

**⚠️ Ressalva para sua decisão:** A regra atual preserva objetos já em movimento nos Correios (postado, em trânsito, entregue) para não perder histórico de rastreio físico. Como agora só se chega na remoção via cancelamento de pedido, isso só ocorreria ao cancelar um pedido com mercadoria já na rua — cenário raro mas possível. **Confirmo a cascata total** como você pediu, mas se quiser manter a exceção do "objeto em movimento", basta avisar antes da implementação.

## Parte 4 — Gap de 2 objetos logísticos no tenant Respeite o Homem

**Investigação (fonte: banco):**

271 PVs ativos vs 269 objetos logísticos. **5 PVs sem objeto** no banco — 3 são pedidos com chargeback (filtrados da lista) e **2 são pedidos reais pagos** prontos para faturar (pedidos #563 e #565). Esse é o gap visível na tela.

**Causa raiz:** o sistema só cria o objeto logístico **uma única vez**, quando o PV é criado. Se o objeto for apagado depois (limpeza manual, teste, falha pontual), não existe mecanismo automático que o recrie. O pedido fica órfão na fila de Logística para sempre.

**O que será feito:**

1. **Reconciliação automática (rede de segurança permanente)**
   - PV ativo de pedido pago sem objeto logístico vinculado → o sistema cria o rascunho do objeto automaticamente, em rotina periódica.
   - Resolve o problema de forma definitiva para qualquer caso futuro.
   - Pula pedidos cancelados, chargeback e marketplace.

2. **Reparo imediato dos 2 pedidos (#563 e #565)** — conforme aprovado, vai forçar a criação agora.

3. **Os 3 pedidos com chargeback (#416, #408, #173)** permanecem sem objeto, como esperado.

## Parte 5 — Ajuste de UI: rótulo do botão

**Como está:** "Criar novo rascunho"
**Como vai ficar:** "Criar novo objeto"

Ajuste em todos os lugares da tela de Logística onde o termo "rascunho" aparece como rótulo de botão referente à criação de objeto de postagem. Termos técnicos internos (status "rascunho" do objeto, etc.) permanecem — só os rótulos de **ação** mudam para "objeto".

## Parte 6 — Validação técnica obrigatória

Antes de declarar concluído, validar:

- Tentar excluir PV de pedido pago → bloqueado com mensagem clara.
- Excluir PV de pedido não pago/manual → funciona normalmente.
- Cancelar pedido pago → PV e objeto removidos juntos (cascata).
- Conferir registro de auditoria após exclusão permitida.
- Conferir que #563 e #565 aparecem em "Prontos para emitir" depois do reparo.
- Conferir que o total da fila bate com o total de PVs ativos (descontando chargeback).
- Forçar cenário de objeto removido manualmente → reconciliação o recria na próxima rodada.
- Conferir botão renomeado para "Criar novo objeto".

## Parte 7 — Documentação

- Especificação de Fiscal: regra de bloqueio + auditoria + descarte só via cancelamento de pedido.
- Especificação de Logística: cascata total PV → objeto + reconciliação automática + novo rótulo do botão.
- Memória anti-regressão: "PV de pedido pago é imutável" e "Objeto logístico é auto-reconciliado a partir do PV ativo".
- Atualizar memória existente da cascata (que hoje preserva objeto em movimento) para refletir a regra simplificada.
- Atualizar o mapa de UI com a mudança do rótulo do botão.
