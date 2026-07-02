## Contexto

Quando os Correios cancelam a pré-postagem (evento "Etiqueta cancelada pelo sistema de captação" ou similares vindos do rastreio), hoje o sistema:

- **Não detecta** o cancelamento — `delivery_status` permanece `label_created`, então o objeto continua parecendo "Despachado" na aba **Objetos emitidos**.
- **Não oferece** reemissão fora de rascunho — o `handleRetryShipment` atual só cobre objetos em `failed` (falha pré-despacho).
- **Não reenvia** a nova etiqueta à Pratika: o WMS ficaria com o código antigo (`AP151002065BR`).

## Correção arquitetural (revisão pós-doc)

Docs consultados: `docs/especificacoes/erp/logistica.md` §"Numeração própria" + memórias `shipment-own-numero-and-no-manual-create` e `shipping-canonical-link-is-pv-not-order`. Consequência:

- Reemissão **não pode atualizar** a linha atual do `shipments` com novo `tracking_code` — é proibido reaproveitar `numero`.
- Reemissão **cria um novo Objeto de Postagem** (novo `shipments.numero`, alocado pelo trigger `trg_shipments_set_numero`) a partir do **mesmo PV**, e marca o objeto antigo como `canceled` com referência cruzada em `metadata.reissued_to_shipment_id`. Vínculos de Pedido/NF/PV/Remessa/Cliente vêm naturalmente por serem derivados do PV.

## Entregas

### 1. Detecção automática do cancelamento pelos Correios

- Ampliar o parser de eventos do rastreio (função de ingestão Correios) para reconhecer descrições com "cancelada pelo sistema de captação", "objeto cancelado", "prepostagem cancelada" (case/acento-insensitive) e atualizar:
  - `shipments.delivery_status = 'canceled'`
  - `requires_action = true`, `action_reason = 'correios_prepost_canceled'`
- **Migração one-shot** (via tool insert, não migration): rodar o mesmo reconhecedor sobre `shipment_events` existentes para reclassificar retroativamente casos como o #668. Sem tocar em objetos com evento pós-despacho legítimo (posted/in_transit/delivered).
- Bucket UI já classifica `canceled + tracking` como `delivery_problem` (`shipmentBuckets.ts`) — o objeto migra sozinho para a aba **"Problemas de envio/entrega"**.

### 2. UI — botão "Reemitir etiqueta"

- Local: aba **"Problemas de envio/entrega"** do `ShipmentGenerator.tsx` (linha) e no `ShipmentDetailsCard`.
- Condição de exibição: `delivery_status ∈ {canceled}` **e** existe PV vinculado **e** NF autorizada (quando aplicável) **e** `kind='local'` (Correios direto — objetos gateway/Frenet ficam fora, conforme constraint `gateway-vs-local-shipping-routing`).
- Fluxo: `ReissueLabelDialog` mostra motivo, tracking antigo, dados do PV → confirma → chama edge `shipping-reissue-label` → mostra novo `AP...BR` e novo `#numero` → oferece "Imprimir etiqueta" (visualizador `/imprimir`) direto no modal.
- Badge no card do objeto antigo: "Etiqueta cancelada pelos Correios — reemitida no objeto #N".

Nada mais muda na UI. Nenhuma nova aba, nenhum novo módulo — só o botão contextual + badge.

### 3. Nova edge `shipping-reissue-label`

Fluxo transacional, com trava por estado e reuso máximo do que já existe:

1. **Gate de estado**: só permite reemitir se o objeto atual tem `delivery_status='canceled'` **e** não houver evento pós-despacho real (posted/in_transit/out_for_delivery/delivered/returned) — reaproveita a lógica da constraint `nf-cancel-blocked-by-shipment-state`. Mensagem PT-BR se bloqueado.
2. **Trava de concorrência**: advisory lock por `source_pedido_venda_id` para impedir dupla reemissão.
3. **Cria novo shipments** (INSERT sem `numero` — trigger aloca) copiando do antigo: `tenant_id`, `order_id`, `invoice_id`, `source_pedido_venda_id`, `remessa_id`, `carrier`, `service_code`, `service_name`, `nfe_key`, `metadata` (peso/dimensões), `delivery_status='draft'`, `source='reissue'`, `metadata.reissued_from_shipment_id = <antigo>`.
4. **Reaproveita `shipping-create-shipment`** (extraindo a função `emitPrepostagem` para módulo compartilhado se necessário, ou invocando por chamada interna) para efetivar a pré-postagem CWS e obter novo `AP...BR` + `provider_shipment_id`.
5. **Atualiza objeto antigo**: garante `delivery_status='canceled'`, `metadata.reissued_to_shipment_id = <novo>`, `requires_action=false`.
6. **Ressincroniza Pratika**: enfileira `wms-pratika-send` com `action='update_tracking'` + `force=true` (caminho administrativo já existente), passando `invoice_id` e o novo `tracking_code`. Registra em `wms_pratika_logs` como `operation='tracking_reissue'`.
7. **Marketplace (genérico e defensivo)**: se `orders.channel` for marketplace (ML/TikTok), enfileira reenvio do rastreio na fila apropriada (`meli_invoice_send_queue` para ML). Pedido #668 é loja/WhatsApp, mas mantemos genérico para não gerar dívida.
8. **Auditoria**: registra em `core_audit_log` (ator, motivo, tracking antigo/novo, shipment antigo/novo).
9. Retorna `{ success, old_tracking, new_tracking, new_shipment_id, label_url }` para a UI abrir impressão direta.

### 4. Documentação (obrigatória — bloqueia fechamento)

- Nova memória `mem://constraints/shipment-reissue-after-correios-cancel` — regras: novo shipments (numero novo), gate por estado, ressync Pratika + marketplace, reconhecedor no parser.
- Atualiza `mem://features/external-apps/wms-pratika-integration` incluindo a operação `tracking_reissue`.
- Atualiza `docs/especificacoes/erp/logistica.md` com seção "Reemissão após cancelamento pelos Correios".
- Atualiza `.lovable/memory/index.md`.
- Atualiza `docs/especificacoes/transversais/assuntos-em-andamento.md` fechando este incidente.

### 5. Validação técnica (executada antes de fechar)

- Rodar reconhecedor sobre `shipment_events` e conferir que o pedido #668 sai para "Problemas de envio/entrega" com o rótulo correto.
- Reemitir a etiqueta do #668 pela UI, confirmar:
  - Novo `shipments.numero` alocado, PV/NF/remessa herdados.
  - Objeto antigo com `delivery_status='canceled'` e `reissued_to_shipment_id` preenchido.
  - Log `tracking_reissue` em `wms_pratika_logs` com `status='success'`.
  - Impressão da nova etiqueta via `/imprimir?source=etiqueta&id=<novo>` funciona.
  - NF #450 intacta, remessa agrupadora não duplicou.

## O que NÃO vai mudar (anti-regressão)

- Fluxo `handleRetryShipment` para rascunhos em `failed` (pré-despacho) permanece — reemissão é **específica para pós-despacho cancelado pelos Correios**.
- NF, PV, cliente, itens, remessa: nenhum registro recriado; o novo `shipments` herda por referência.
- Objetos gateway (Frenet, ML full/flex): fora de escopo — seguem regra própria da transportadora.
- Numeração de `shipments` continua monotônica; nada é reaproveitado.
- `shipping-create-shipment` não muda contrato público — só extraímos função interna se necessário.

## Perguntas em aberto para você decidir

1. **Motivo do cancelamento no diálogo de reemissão**: campo obrigatório (livre) ou opcional? Sugiro **opcional** com placeholder "Cancelado pelos Correios — reemitindo" para não travar o operador.
2. **Custo da etiqueta**: cada pré-postagem CWS pode gerar cobrança nova dos Correios. Sigo com "reemite sem prompt de custo" (o operador já sabe que reemitir gera nova etiqueta), ou você quer aviso explícito no diálogo?

Se preferir não decidir agora, sigo com opcional + sem aviso de custo (padrão mais fluido para operação).
