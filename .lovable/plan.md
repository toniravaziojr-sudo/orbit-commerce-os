
## Diagnóstico revisado (causa raiz do fluxo, não do caso)

O caso da Maria da Glória (PV 395) não é incidente isolado — é sintoma de **3 falhas combinadas no fluxo de criação do objeto de postagem**:

**Falha 1 — Dedup cego no processador da fila de rascunhos.**
Quando o processador encontra qualquer objeto de postagem já existente para aquele Pedido de Venda, ele marca o item da fila como "concluído", mesmo que esse objeto seja de uma tentativa antiga (no caso, uma NF de homologação descartada depois). Se aquele objeto desaparecer em seguida (cancelamento de NF, limpeza), o PV fica sem objeto e sem rastro de que precisa de um novo.

**Falha 2 — Limpeza de NF cancelada removeu o objeto válido.**
O descarte de NF de homologação levou junto o objeto de postagem. Hoje o sistema é 100% produção, então isso não se repete por essa via — mas o resíduo do PV 395 ficou.

**Falha 3 — A reconciliação automática existente não consegue consertar esses casos.**
A rotina de 15 em 15 minutos que recria objetos órfãos não enfileira novamente porque a fila tem regra de "1 entrada por PV" — e como já existe uma entrada antiga marcada como "concluída", a nova é bloqueada e o PV fica órfão para sempre.

**Conclusão:** o PV 395 não é o problema. O problema é que o sistema não tem como se autocurar quando o objeto some depois de a fila ter sido marcada como concluída.

---

## O que será corrigido (correção de fluxo)

### 1. Regra de unicidade da fila vira "só enquanto está aberta"
A trava de "1 entrada por PV" passa a valer apenas para entradas em aberto (pendente/em processamento). Entradas concluídas, canceladas ou falhas ficam preservadas para auditoria, mas não impedem que a reconciliação abra uma nova quando precisar. Isso destrava a autocura.

### 2. Reconciliação automática passa a tratar PVs órfãos com histórico
A rotina já existente passa a detectar também o cenário "PV ativo, pedido pago, sem objeto, mas com entrada antiga concluída na fila" — e enfileira uma nova tentativa. Continua respeitando todos os filtros atuais (não toca em marketplace, gateway, cancelado, chargeback, devolução).

### 3. Dedup do processador fica honesto
A verificação de duplicidade passa a considerar apenas objetos de postagem **ativos** (ignora os cancelados/descartados). Se não houver objeto ativo, o processador cria de fato — não marca a fila como concluída por engano. Adicionalmente, registra qual objeto foi considerado como "já existente" para auditoria futura.

### 4. Conserto da Maria da Glória sai de graça
Com as correções acima em vigor, a próxima execução automática da rotina (a cada 15 min) detecta o PV 395 como órfão, enfileira uma nova entrada e o processador cria o objeto de postagem normalmente. Nenhuma chamada manual ao Correios, nenhum mexer em pedido real, nenhum despacho automático — o objeto aparece como rascunho na aba Remessas, pronto para o operador emitir quando quiser.

---

## O que NÃO muda

- Nenhuma mudança na tela de Remessas, Fiscal ou Pedidos.
- Nenhuma mudança em regra de negócio (status, prazos, fluxo PV→NF, Pratika, Correios).
- Nenhum despacho automático novo. O sistema continua só **gerando rascunho**; a emissão de etiqueta segue manual.
- PV de marketplace, gateway (Frenet), cancelado, chargeback e devolução continuam fora da reconciliação, como hoje.
- PV manual sem pedido real continua sob controle exclusivo do usuário.

---

## Validação após aplicar

1. Confirmar que o PV 395 ganhou uma nova entrada na fila no ciclo seguinte de reconciliação.
2. Confirmar que o objeto de postagem da Maria da Glória foi criado como rascunho.
3. Confirmar que ela aparece na aba Remessas como pronta para emitir.
4. Confirmar que nenhum outro PV ativo foi tocado indevidamente (varredura nos 290 PVs do tenant).
5. Confirmar que pedidos cancelados/chargeback/marketplace/gateway continuaram ignorados.

---

## Documentação a atualizar (na mesma entrega)

- Atualizar a regra oficial de reconciliação de objeto órfão para refletir a nova unicidade parcial e o tratamento de entradas concluídas órfãs.
- Atualizar a especificação de logística com o novo comportamento do dedup do processador.
- Registrar como regra anti-regressão: "dedup do processador só considera objeto ativo; fila aceita reabertura via reconciliação quando PV está ativo e sem objeto".

---

## Detalhes técnicos (bloco opcional)

- Tornar o índice `shipping_draft_queue_pv_unique` parcial: `WHERE status IN ('pending','processing')`.
- Ajustar `reconcile_orphan_pv_shipments` para detectar PVs ativos sem `shipments` e sem entrada `pending/processing` na fila (a presença de entrada `done/cancelled/failed` deixa de bloquear).
- Em `scheduler-tick` PHASE 1.6, alterar dedup para `delivery_status <> 'cancelled'` (ou equivalente "ativo"); ao decidir pular por dedup, gravar `dedup_shipment_id` em `shipping_draft_queue.metadata` para forense.
- Conserto do PV 395 deixa de exigir intervenção: cai naturalmente no cron `reconcile-orphan-pv-shipments-15m` após o deploy. Opcionalmente, disparar a função manualmente uma vez logo após o deploy para encurtar a espera.
- Sem novas tabelas, sem nova UI, sem novo cron, sem nova edge function.

---

Confirma que eu sigo nessa direção?
