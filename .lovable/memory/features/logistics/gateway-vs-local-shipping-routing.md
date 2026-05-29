---
name: Gateway vs Local Shipping Routing
description: shipping_providers.provider_kind define despacho local vs gateway. Pedidos gateway (Frenet) saem por cron automático.
type: feature
---

`shipping_providers.provider_kind` é a chave de roteamento de despacho. `kind = 'local'` (Correios) usa a tela de Remessas e etiqueta manual. `kind = 'gateway'` (Frenet hoje) usa fluxo 100% automático: o gatilho `trg_enqueue_fiscal_draft` em `orders` enfileira em `gateway_sync_queue` quando o pedido vira pago e o `resolve_order_shipping_provider` devolve kind=gateway; o cron `gateway-sync-order-every-2min` consome e chama a edge `gateway-sync-order` (POST Frenet `/shipping/order`). NF-e autorizada é anexada depois via `gateway-attach-fiscal-doc`.

Os 3 elos obrigatórios:
1. **Enfileiramento:** trigger em `orders` (já incluído em `enqueue_fiscal_draft`). Idempotente via `uq_gateway_sync_queue_order_action_pending`.
2. **Cron consumidor:** `gateway-sync-order-every-2min`, gateado por `cron_call_edge_if_active(['shipping_gateway'])`.
3. **Registry de uso:** módulo `shipping_gateway` em `system_resource_usage` + branch em `count_active_tenants_for_module` + trigger `trg_mark_shipping_gateway_active` em `shipping_providers`.

Regra de UX: **ativar a Frenet é suficiente** para que pedidos sejam enviados a ela. Cotação (`supports_quote`) e rastreamento (`supports_tracking`) são funções independentes e não bloqueiam o despacho.

Pedidos gateway são filtrados da fila local de Remessas via `orders.resolved_shipping_provider_kind` para evitar despacho duplicado.
