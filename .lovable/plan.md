## Diagnóstico

#665 (AD624331900BR) e #670 (AD625921695BR) já estão **A caminho** no ML e em `in_transit` em `marketplace_shipments`. Mesmo assim:
- `orders.#665`: `invoice_authorized`, `shipping_status=pending`, `tracking_code=null`, `shipped_at=null`.
- `orders.#670`: `processing`, `shipping_status=pending`, `tracking_code=null`, `shipped_at=null`.

**Causa raiz:** falta a ponte `marketplace_shipments → orders` que o fluxo interno já tem em `shipment-ingest`. `meli-fetch-shipment` escreve só em `marketplace_shipments`; e `meli-sync-orders` mapeia apenas `meliOrder.status` (que para o vendedor fica em `paid`, nunca vira `shipped`).

**Lição reaproveitada do fluxo interno (não reinventar):**
- Vocabulário canônico de `orders.shipping_status`: `awaiting_shipment | label_generated | shipped | in_transit | arriving | delivered | problem | returned`. Nunca usar `pending` (o ML usa, mas a UI da loja não).
- `orders.status='dispatched'` só é setado se o status atual está em `preDispatchOrderStatuses` (`paid, processing, ready_to_invoice, pending, awaiting_shipment, invoice_pending_sefaz, invoice_authorized, invoice_issued, fulfilled`). Nunca regredir.
- Sempre gravar `shipped_at` / `delivered_at` na transição.
- Auditar em `order_history` (`action='shipment_updated'`).
- Padrão arquitetural: ação fica em Edge Function (não em trigger SQL).
- `payment_status` canônico = `approved`.

## Plano (escopo backend; UI fora)

### 1. `meli-fetch-shipment` ganha o mesmo bloco do `shipment-ingest`
Depois do upsert em `marketplace_shipments`, e somente quando há `resolvedOrderId`:
- Ler `orders.status, shipping_status, tracking_code` atuais.
- Mapear `marketplace_shipments.status` (vocab ML: `awaiting_invoice | ready_to_ship | label_issued | in_transit | shipped | delivered | problem | returned | cancelled`) → `orders.shipping_status` canônico (mesmo dicionário do `shipment-ingest`).
- Atualizar `tracking_code`, `shipping_carrier` se vazios ou diferentes.
- Se status novo ∈ `{ready_to_ship, label_issued, in_transit, shipped, delivered}` **e** `orders.status` ∈ `preDispatchOrderStatuses`: setar `status='dispatched'` + `shipped_at=now()` (se nulo).
- Se status novo = `delivered`: setar `delivered_at=now()` e, se ainda pré-entrega, `status='delivered'`.
- Se status novo = `problem`: só ajusta `shipping_status='problem'`, não toca em `orders.status`.
- Nunca regredir pedidos em `shipped/in_transit/delivered/completed/cancelled/returning/returned`.
- Registrar `order_history` com `action='shipment_updated'` e contexto (`source='marketplace_shipment'`).

### 2. `meli-sync-orders` deixa de rebaixar pedidos avançados
Antes do `UPDATE`/`UPSERT`:
- Se já existe `orders` com `status` ∈ `{invoice_authorized, invoice_issued, dispatched, shipped, in_transit, delivered, completed, cancelled, returning, returned}` → **não** sobrescrever `status` (preservar). `payment_status` e demais campos seguem normalmente.
- Quando o ML reportar `cancelled`, mantém a regra atual de promover para `cancelled` com metadados (já existe).
- `payment_status` segue sendo espelhado, mas com canônico `approved` (já está correto).

### 3. Backfill cirúrgico (alinhar #665 e #670 + qualquer outro órfão)
Single shot via Edge `meli-fetch-shipment` reexecutado para cada `marketplace_shipments` ML com `status` ∈ `{ready_to_ship,label_issued,in_transit,shipped,delivered}` cujo `orders.status` esteja em pré-despacho. Como o próprio bloco da Onda 1 cuida da promoção, basta reprocessar — sem `UPDATE` solto no banco. Lista esperada hoje: 2 pedidos (#665, #670).

### 4. Documentação + memória anti-regressão
- `docs/especificacoes/logistica/logistica-externa.md` ganha seção "Promoção de status do pedido a partir do shipment marketplace", citando o paralelo com `shipment-ingest` e o dicionário de mapeamento.
- `docs/especificacoes/marketplaces/mercado-livre.md` §"Sync de Pedidos v3.12" — registrar a guarda contra rebaixamento.
- Nova memória `mem://constraints/marketplace-shipment-promotes-order-mirrors-shipment-ingest` referenciando `mem://constraints/shipment-ingest-adopt-draft-and-auto-dispatch` como modelo.
- Atualizar `mem://index.md`.

### 5. Validação técnica obrigatória
1. SQL: pedidos ML com `marketplace_shipments.status='in_transit'` e `orders.shipping_status='pending'` → **0**.
2. `orders.#665` em `dispatched`, `shipping_status='in_transit'`, `tracking_code='AD624331900BR'`, `shipped_at` preenchido.
3. `orders.#670` idem com `AD625921695BR`.
4. Re-sync simulado de pedido em `invoice_authorized` → permanece `invoice_authorized` (não rebaixa).
5. Logs `meli-fetch-shipment` sem erro nos 5 min pós-deploy.

## Fora do escopo (passa por você se for necessário)
- Mexer na UI de `/orders` ou `/external-shipping`.
- Criar trigger SQL nova em `marketplace_shipments` (padrão do projeto manda ação em edge).
- Tocar no fluxo local (`shipment-ingest`, `shipping-create-shipment`, gatilho de PV) — já consolidados.
- Mudar vocabulário de `marketplace_shipments.status` (mantemos o do ML; tradução acontece só no momento de escrever em `orders`).

Confirma que sigo?