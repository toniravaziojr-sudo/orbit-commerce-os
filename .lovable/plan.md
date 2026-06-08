
# Ajuste do fluxo Fiscal × Logístico (NF cancelada / PV excluído)

## Regras de negócio aprovadas

### Regra 1 — Quando posso cancelar uma NF
A NF de venda só pode ser cancelada se **não houver objeto logístico associado** OU se o objeto estiver em um destes estados:
- "Etiqueta gerada" (objeto criado/pronto, ainda não despachado fisicamente)
- "Cancelado"

Em qualquer outro estado do objeto (postado, em trânsito, saindo para entrega, entregue ou devolvido), o cancelamento é **bloqueado** tanto no botão (desabilitado com tooltip) quanto na confirmação (mensagem em destaque dentro do diálogo) e também no servidor.

#### Mensagens exibidas ao usuário (PT-BR, em destaque no diálogo)
- Objeto **postado / em trânsito / saindo para entrega**:
  > "Não é possível cancelar esta NF: o pedido já foi despachado e está em rota de entrega (rastreio: AP000000000BR). Para cancelar a NF, primeiro cancele o objeto de postagem no módulo de Logística."
- Objeto **entregue**:
  > "Não é possível cancelar esta NF: o pedido já foi entregue ao cliente (rastreio: AP000000000BR, entregue em 08/06/2026). Notas de pedidos entregues não podem ser canceladas — utilize uma NF de devolução se for o caso."
- Objeto **devolvido**:
  > "Não é possível cancelar esta NF: o pedido foi devolvido. Registre uma NF de devolução em vez de cancelar a original."

Em todos os casos, o número do rastreio e a data relevante aparecem dentro da mensagem para o usuário entender o porquê do bloqueio.

### Regra 2 — O que acontece com o PV quando a NF é cancelada
- O PV volta para **"Pedido em aberto"** (status visual).
- **Nenhuma observação extra** é exibida (sem "NF cancelada", sem "Pedido sem itens", sem nada).
- Qualquer pendência fiscal antiga grudada no PV é **limpa**, porque o PV volta ao começo do ciclo e pode ser reaproveitado para emitir uma nova NF.

### Regra 3 — O que acontece quando excluo um PV
O objeto logístico vinculado segue o PV:

| Situação do objeto | O que acontece |
|---|---|
| Objeto sem remessa | Excluído junto com o PV |
| Objeto sozinho dentro de uma remessa | Objeto **e** remessa excluídos |
| Objeto em uma remessa com outros objetos | Objeto **marcado como "cancelado" dentro da remessa** (não exclui o objeto nem a remessa) |

A remessa deixa de contar este objeto nos totais quando ele está cancelado.

---

## O que muda no sistema

### A. Trava no cancelamento de NF (com mensagens claras)
- Antes de chamar o cancelamento, o sistema consulta o estado do objeto logístico vinculado.
- Se o estado não permitir, o botão de "Cancelar NF" fica desabilitado com tooltip resumido e, ao tentar abrir o diálogo, a mensagem completa (com rastreio e data) aparece em destaque dentro do próprio diálogo, substituindo o formulário de justificativa.
- A API recusa a operação com a mesma mensagem em PT-BR (defesa em profundidade).

### B. Cancelamento da NF → PV em aberto, sem observação
- Ao cancelar a NF, o sistema limpa as pendências antigas do PV e força o recálculo do status.
- A regra de derivação passa a tratar "NF derivada cancelada" como sinal explícito de **voltar para "em aberto"**, sem deixar resíduo de pendência herdada.

### C. Nova cascata de exclusão do PV
- A cascata atual (que apaga objeto + remessa vazia) passa a respeitar o agrupamento:
  - Remessa com **1 único objeto** → cascata TOTAL (apaga objeto e remessa).
  - Remessa com **vários objetos** → o objeto do PV excluído fica **marcado como cancelado** dentro da remessa.
- O diálogo de exclusão do PV mostra o que vai acontecer em linguagem clara antes de confirmar.

### D. Estado pós-correção do caso atual (PV 403 / NF 404 / AP053729025BR)
- Limpa a pendência fantasma "Pedido sem itens" do PV 403.
- Trata o objeto AP053729025BR conforme a nova regra (objeto isolado, sem remessa → liberado para exclusão junto com o PV).
- Libera a exclusão da NF 404 e do PV 403 para você refazer o teste do zero.

---

## Validação técnica (executada ao final)
1. Consulta direta no banco confirmando: PV 403 em "em aberto" sem pendências, objeto AP053729025BR no estado correto, NF 404 excluível.
2. Simulação dos três cenários da Regra 3 (objeto sem remessa, sozinho na remessa, acompanhado).
3. Tentativa de cancelar uma NF com objeto "postado" → deve recusar com a mensagem completa em PT-BR.
4. Cancelar uma NF com objeto "etiqueta gerada" → PV volta para "em aberto" limpo.

---

## Documentação a atualizar (mesma entrega)
1. `docs/especificacoes/erp/logistica.md` — seções "Exclusão em cascata" e "Cancelamento de NF × Objeto" (incluindo as mensagens exibidas).
2. `docs/especificacoes/erp/fiscal.md` (ou equivalente) — regra de retorno do PV para "em aberto" e bloqueios de cancelamento.
3. `docs/especificacoes/transversais/mapa-ui.md` — diálogos de cancelar NF (com novas mensagens) e excluir PV.
4. Memórias anti-regressão:
   - Atualizar `mem://constraints/shipping-pv-delete-cascade-by-shipment-state` (objeto acompanhado vira cancelado, não some).
   - Criar `mem://constraints/nf-cancel-blocked-by-shipment-state` (trava + mensagens PT-BR obrigatórias com rastreio e data).
   - Criar `mem://constraints/nf-cancel-reopens-pv-clean` (PV volta para em aberto, sem observação).

---

## Bloco técnico (opcional, para registro)
- Edge `fiscal-cancel`: pré-validação consultando `shipments` por `invoice_id`/`source_pedido_venda_id`/`nfe_key`; permitir só `delivery_status IN ('draft','label_created','cancelled')` ou ausência de shipment; payload de erro `code: 'shipment_blocks_cancel'` + `message` PT-BR com `tracking_code` e `delivered_at` quando aplicável. Após cancelar com sucesso, limpar `pendencia_motivos` do PV pai e chamar `recompute_pv_pedido_status`.
- Função `derive_pv_pedido_status`: tratar "NF derivada cancelada" como sinal de "em_aberto" (não terminal).
- Trigger `cascade_delete_shipments_on_pv_delete`: se a remessa tem outros shipments, `UPDATE shipments SET delivery_status='cancelled', cancelled_reason='pv_deleted'`; senão, `DELETE` (e a remessa vazia cai pelo gatilho existente).
- Frontend `FiscalInvoiceList`: hook lê o shipment vinculado, desabilita o botão "Cancelar NF" com tooltip resumido e renderiza a mensagem completa dentro do diálogo (Alert em destaque) com `tracking_code` e `delivered_at` formatados em BRT.
