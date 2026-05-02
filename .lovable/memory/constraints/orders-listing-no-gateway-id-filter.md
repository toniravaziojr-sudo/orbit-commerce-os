---
name: Orders Listing — No Gateway ID Filter
description: Listagem de pedidos NÃO pode filtrar por payment_gateway_id. Regra gateway-first garante integridade na criação; filtro na leitura bloqueia pedidos manuais e marketplace.
type: constraint
---

A query de listagem de pedidos em `src/hooks/useOrders.ts` (e qualquer view futura de pedidos no admin) **NÃO pode** ter `.not('payment_gateway_id', 'is', null)` ou equivalente. Isso vale para a query principal E para as queries de estatísticas/contadores.

**Por quê:** A regra gateway-first (`docs/especificacoes/ecommerce/pedidos.md` §16, vigente desde 19/abr/2026) garante que nenhum pedido novo do storefront seja criado sem `payment_gateway_id` (a edge `checkout-create-order` rejeita com `GATEWAY_CONFIRMATION_REQUIRED`). A integridade contra "ghost orders" é **na criação**, não na leitura.

Pedidos legítimos sem `payment_gateway_id`:
- **Manuais** (criados via `/orders/new` no admin) — `sales_channel = 'admin'/'manual'`, `payment_gateway IS NULL`.
- **Marketplace/Importação** — `source_platform IS NOT NULL` ou `marketplace_source IS NOT NULL`.
- **Órfãos pré-gateway-first** — apenas histórico anterior a 19/abr/2026, já migrados em 2026-05-02 para `cancelled` com motivo "Órfão pré-gateway-first".

**Sintoma se a regra for violada:** Usuário cria pedido manual, recebe toast "Pedido criado com sucesso", mas pedido nunca aparece na lista nem nos contadores. Já aconteceu em maio/2026 (pedido #392).

**Diagnóstico para sintomas semelhantes ("criei X mas não aparece"):** Antes de investigar trigger, RLS ou cache, rodar `SELECT * FROM orders WHERE order_number = 'X'`. Se o registro está lá, o problema está na query da listagem, não na criação.

**Regra geral derivada:** Quando um filtro existe "pra esconder dados sujos", investigar se a fonte do dado sujo foi corrigida. Se sim, **remover o filtro** em vez de mantê-lo "por garantia" — ele cria contradições silenciosas com a evolução das regras do sistema.
