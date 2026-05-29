
# Plano (revisado) — Corrigir fluxo Frenet ponta-a-ponta e alinhar docs

## Diagnóstico atualizado (após releitura dos docs e do banco)

O doc de logística descreve corretamente a **intenção** do fluxo gateway (Frenet): pedido aprovado com transportadora `kind=gateway` deveria ser sincronizado automaticamente via `gateway-sync-order`, e a NF-e anexada via `gateway-attach-fiscal-doc`. Mas no sistema real **faltam dois elos**:

1. **Não existe enfileiramento automático.** Nenhum gatilho/edge enfileira em `gateway_sync_queue` quando um pedido aprovado tem provedor gateway. O único job na fila é resíduo antigo (tenant desativado).
2. **Não existe cron consumindo a fila.** A função existe e funciona quando chamada manualmente, mas nada a aciona.

Resultado: hoje, ativar a Frenet **não faz pedido nenhum chegar lá automaticamente**.

Funções de cotação e rastreamento são realmente independentes do despacho (já validado).

## O que será feito (decisões técnicas)

### 1. Enfileiramento automático (elo que faltava)
- Criar gatilho no banco que, ao pedido entrar em estado "pago/aprovado" **e** o provedor resolvido ser `kind=gateway`, insere uma linha em `gateway_sync_queue` com `action='sync_order'`, `status='pending'`, vinculada ao `provider_id` correto.
- Idempotente: índice único `(order_id, action)` filtrando `status IN ('pending','processing','done')` para evitar duplicar job se o pedido oscilar de status.
- Reaproveita o mesmo padrão do enfileiramento fiscal já existente (mesma família de triggers atômicos).

### 2. Cron consumidor da fila
- Criar cron a cada 2 minutos chamando `gateway-sync-order`.
- Padrão obrigatório do projeto: chave anon hardcoded no header (proibido usar GUC de service_role, conforme regra de governança) e **gate `cron_call_edge_if_active(['shipping_gateway'])`** para o cron dormir quando nenhum tenant tem gateway ativo.

### 3. Registry de "Recurso em uso"
- Registrar novo módulo `shipping_gateway` em `system_resource_usage` (grupo "Logística & Fiscal").
- Implementar branch correspondente em `count_active_tenants_for_module` contando tenants com `shipping_providers.provider='frenet' AND is_enabled=true`.
- Trigger `AFTER INSERT/UPDATE` em `shipping_providers` chamando `mark_module_active_by_event('shipping_gateway')` para acordar o cron imediatamente quando alguém ativa a Frenet.

### 4. Backfill de pedidos já aprovados com provedor gateway
- Script único enfileirando todos os pedidos pagos/aprovados das últimas 24h com `resolved_shipping_provider_kind='gateway'` que ainda não têm `external_ref`. Sem ação destrutiva.

### 5. Limpeza pontual do job órfão de 01/05
- **Não automático.** Pedirei autorização explícita antes (regra de ações destrutivas).

### 6. Atualização de documentação
- **`docs/especificacoes/erp/logistica.md`**: adicionar seção "Fluxo automático de despacho gateway" descrevendo gatilho → fila → cron a cada 2min → Frenet → anexa NF-e; e seção "Funções independentes por transportadora" (ativação ≠ cotação ≠ rastreamento).
- **`docs/especificacoes/plataforma/recursos-em-uso-e-crons-adormecidos.md`**: registrar `shipping_gateway` no inventário e o gate do cron.
- **`docs/especificacoes/transversais/mapa-ui.md`**: ajustar descrição dos toggles dos cards de Meios de Envio (3 chaves independentes).
- **Memória `mem://features/logistics/gateway-vs-local-shipping-routing`**: o índice de memórias referencia esse arquivo mas ele não existe em disco — criar com o conteúdo canônico (regra de despacho local vs gateway + os 3 elos: enfileiramento + cron + registry).

### 7. Validação técnica (executada por mim ao final)
- Conferir que o cron foi criado, está ativo e gateado.
- Confirmar que o registry marca `shipping_gateway` como ativo (tenant `respeiteohomem` tem Frenet habilitada).
- Acionar o cron manualmente, ler logs e conferir que o job de teste sai como `done` com `external_ref` da Frenet.
- Forçar um pedido de teste no tenant `respeiteohomem`, conferir enfileiramento pelo gatilho e processamento pelo cron.
- Reportar no formato obrigatório `🔍 VALIDAÇÃO TÉCNICA EXECUTADA`.

## O que NÃO muda
- Sem alteração de UI/UX (mudanças visuais seriam levadas a você antes).
- Sem mudança de contrato das edges `gateway-sync-order` e `gateway-attach-fiscal-doc`.
- Sem mexer em cotação, rastreamento, fila de Remessas local (Correios) ou regras fiscais.
- Sem nova dependência externa.

## Risco e reversão
- Cron isolado e gateado: se algo der errado, basta desativá-lo.
- Trigger de enfileiramento é idempotente e só atua em pedidos com provedor gateway resolvido — não afeta Correios nem marketplaces.
- Backfill restrito a 24h e a pedidos sem `external_ref`.

Se aprovar, sigo direto para a implementação e fecho com a validação técnica e atualização das docs.
