# Módulo: Pedidos (Admin)

> **Status:** ✅ Ativo  
> **Camada:** Layer 3 — Especificações / E-commerce  
> **Última atualização:** 2026-04-04  
> **Migrado de:** `docs/regras/pedidos.md`

---

## 1. Visão Geral

O módulo de Pedidos gerencia todo o ciclo de vida de uma venda, desde a criação até a entrega. Implementa uma máquina de estados para status do pedido, pagamento e envio, garantindo transições válidas. Todas as operações passam pela Edge Function `core-orders` para auditoria e consistência.

**REGRA FUNDAMENTAL (v2026-04-04, reforçada em v2026-04-19):** Pedidos só são criados após resposta da operadora de pagamento. Não existem mais "ghost orders". A numeração da loja só é consumida para pedidos reais.

> **v2026-04-19 — Pagar.me alinhado à regra:** A edge `pagarme-create-charge` agora opera como orquestrador (gateway-first): chama a Pagar.me primeiro e, somente após resposta, invoca `checkout-create-order` com `payment_gateway_id` já preenchido. A edge `checkout-create-order` rejeita qualquer criação de pedido sem `payment_gateway_id` (código `GATEWAY_CONFIRMATION_REQUIRED`). Falha técnica antes da resposta do gateway = nenhum pedido criado, nenhuma numeração consumida, sessão segue para o fluxo padrão de checkout abandonado em 30 min. Mercado Pago já seguia a regra (criação só via webhook).

---

## 2. Arquitetura de Componentes

### 2.1 Páginas

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/pages/Orders.tsx` | Lista de pedidos com filtros, estatísticas e paginação |
| `src/pages/OrderDetail.tsx` | Detalhes do pedido, itens, histórico, notas, rastreio |
| `src/pages/OrderNew.tsx` | Criação manual de pedidos. Depende do scroll global único do `AppShell`; não deve criar segundo scroll estrutural nem compensação extra de altura no contêiner raiz |

### 2.2 Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `OrderList.tsx` | Tabela com badges de status e ações |
| `OrderSourceBadge.tsx` | Badge de origem (Loja, ML, Shopee) |
| `OrderShippingMethod.tsx` | Método de envio |
| `ShipmentSection.tsx` | Rastreio e envio |
| `PaymentAttemptsCard.tsx` | Histórico de tentativas de pagamento |
| `OrderAlertsCard.tsx` | Alertas operacionais de pedidos (chargebacks) — exibido na Central de Execuções, aba Pedidos |

### 2.3 Hooks

| Arquivo | Responsabilidade |
|---------|------------------|
| `useOrders.ts` | Lista, cria, atualiza status, deleta via coreOrdersApi |
| `useOrderDetails.ts` | Busca pedido por ID/número via Edge Function |
| `useCustomerOrders.ts` | Pedidos do cliente logado (storefront) |
| `usePaymentTransactions.ts` | Tentativas de pagamento por order_id |
| `useRetryLinkedOrder.ts` | Vínculo bidirecional de retry |

### 2.4 Edge Functions

| Função | Responsabilidade |
|--------|------------------|
| `core-orders` | API canônica: createOrder, setOrderStatus, setPaymentStatus, setShippingStatus, addNote, updateTracking, deleteOrder |
| `get-order` | Busca segura (bypassa RLS para guest). Aceita com/sem `#`, normaliza. Ordena `created_at DESC LIMIT 1` para duplicatas |
| `checkout-create-order` | Criação de pedido via checkout do storefront — **só executa após resposta do gateway** |
| `shipment-ingest` | Ingestão de dados de envio/rastreio |
| `verify-payment-status` | Verificação ativa do status de pagamento junto à operadora (cron progressivo) |
| `monitor-chargebacks` | Monitoramento pós-venda de estornos (cron diário, 60 dias) |

---

## 3. Modelo de Dados

### 3.1 Tabela `orders`

```typescript
interface Order {
  id: string;                    // UUID PK
  tenant_id: string;             // FK → tenants
  customer_id: string | null;    // FK → customers
  order_number: string;          // Sequencial por tenant (#XXXX)
  
  // === Status ===
  status: OrderStatus;
  payment_status: PaymentStatus;
  shipping_status: ShippingStatus;
  
  // === Valores ===
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;                 // subtotal - discount + shipping + tax
  
  // === Pagamento ===
  payment_method: PaymentMethod | null;
  payment_gateway: string | null;
  payment_gateway_id: string | null;
  paid_at: string | null;
  installments: number | null;
  installment_value: number | null;
  
  // === Primeira Compra ===
  is_first_sale: boolean;        // Imutável. true = email novo no tenant + pagamento aprovado
  
  // === Envio ===
  shipping_carrier: string | null;
  shipping_service_code: string | null;
  shipping_service_name: string | null;
  shipping_estimated_days: number | null;
  tracking_code: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  
  // === Cliente (snapshot) ===
  customer_name: string;
  customer_email: string;        // Normalizado (lowercase, trim)
  customer_phone: string | null;
  customer_cpf: string | null;
  
  // === Endereço de Entrega ===
  shipping_street: string | null;
  shipping_number: string | null;
  shipping_complement: string | null;
  shipping_neighborhood: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  
  // === Endereço de Cobrança ===
  billing_street: string | null;
  billing_number: string | null;
  billing_complement: string | null;
  billing_neighborhood: string | null;
  billing_city: string | null;
  billing_state: string | null;
  billing_postal_code: string | null;
  billing_country: string | null;
  
  // === Notas ===
  customer_notes: string | null;  // Observações do cliente
  internal_notes: string | null;  // Notas internas (não visíveis ao cliente)
  
  // === Cancelamento ===
  cancelled_at: string | null;
  cancellation_reason: string | null;
  
  // === Marketplace ===
  source_order_number: string | null;
  source_platform: string | null;
  marketplace_source: string | null;
  marketplace_order_id: string | null;
  marketplace_data: Record<string, unknown> | null;
  
  // === Metadados ===
  currency: string | null;       // Default: BRL
  fx_rate: number | null;
  source_hash: string | null;    // Para deduplicação
  gateway_payload: Record<string, unknown> | null;
  
  // === Retry ===
  retry_from_order_id: string | null;
  retry_token: string | null;
  retry_token_expires_at: string | null;
  
  // === Auditoria ===
  canonical_total: number | null;
  checkout_attempt_id: string | null;  // UUID — idempotência
  
  // === Verificação de Pagamento ===
  next_payment_check_at: string | null;    // Próxima verificação agendada
  payment_check_count: number;             // Quantidade de verificações realizadas
  payment_max_expiry_at: string | null;    // Prazo máximo de expiração (consultado na operadora)
  chargeback_detected_at: string | null;   // Data de detecção do chargeback
  chargeback_deadline_at: string | null;   // Prazo final para resolução do chargeback
  
  created_at: string;
  updated_at: string;
}
```

### 3.1.1 Criação de Pedido — Regra Fundamental (v2026-04-04)

> **REGRA CRÍTICA:** Pedidos só existem após resposta da operadora de pagamento.

| Ponto | Descrição |
|-------|-----------|
| **Antes** | Pedido era criado no clique de "Finalizar Compra", antes da resposta do gateway. Isso gerava "ghost orders" sem `payment_gateway_id` |
| **Agora** | O sistema chama a operadora primeiro. Só após receber resposta (qualquer status: aprovado, recusado, pendente) é que o pedido é criado com numeração real |
| **Resultado** | Eliminação total de ghost orders. Todo pedido na base tem `payment_gateway_id` preenchido |

**Fluxo de criação:**
1. Cliente clica "Finalizar Compra"
2. Sistema chama a operadora de pagamento (Pagar.me, Mercado Pago, PagBank)
3. Operadora responde (qualquer status)
4. `checkout-create-order` cria o pedido real com `payment_gateway_id` preenchido
5. Numeração da loja é consumida (#XXXX)
6. Cliente é criado/atualizado no módulo de Clientes (somente se pagamento aprovado — ver seção 7.3)
7. `checkout_session` muda para `converted`

**Se a operadora NÃO responder** (timeout, erro de rede, tab fechada):
- NENHUM pedido é criado
- NENHUMA numeração é consumida
- A `checkout_session` permanece `active` → pode virar `abandoned` após 30 min

**Legado — Ghost Orders (encerrado em 2026-05-02):**
O conceito de "ghost order" (`payment_gateway_id IS NULL`) foi eliminado na v2026-04-04 pela regra gateway-first. Em 2026-05-02, os 79 pedidos legados pré-19/abr restantes (que ficaram pendentes/expirados sem `payment_gateway_id`) foram migrados para `cancelled` com motivo "Órfão pré-gateway-first". A partir desta data, **a listagem de pedidos NÃO filtra mais por `payment_gateway_id`** — esse filtro estava bloqueando indevidamente pedidos manuais (criados via `/orders/new`) e importações de marketplace, que legitimamente não têm `payment_gateway_id`. Regra anti-regressão: nunca reintroduzir `.not('payment_gateway_id', 'is', null)` em queries de listagem de pedidos. A integridade contra ghost orders é garantida pelo gateway-first na criação, não por filtro na leitura.

---

### 3.2 Tipos de Status

#### Status do Pedido

```typescript
type OrderStatus = 
  | 'awaiting_confirmation'    // Aguardando confirmação
  | 'ready_to_invoice'         // Pronto para emitir NF
  | 'invoice_pending_sefaz'    // Pendente SEFAZ
  | 'invoice_authorized'       // NF Autorizada
  | 'invoice_issued'           // NF Emitida
  | 'dispatched'               // Despachado
  | 'completed'                // Concluído
  | 'returning'                // Em devolução
  | 'payment_expired'          // Pagamento expirado
  | 'invoice_rejected'         // NF Rejeitada
  | 'invoice_cancelled'        // NF Cancelada
  | 'chargeback_detected'      // Chargeback detectado (NOVO v2026-04-07)
  | 'chargeback_lost'          // Chargeback perdido (NOVO v2026-04-07)
  | 'chargeback_recovered';    // Chargeback recuperado (NOVO v2026-04-07)
```

#### Status de Pagamento

```typescript
type PaymentStatus = 
  | 'awaiting_payment'       // Aguardando
  | 'paid'                   // Pago
  | 'declined'               // Recusado
  | 'cancelled'              // Cancelado
  | 'refunded'               // Estornado
  | 'under_review'           // Em análise — chargeback em andamento (NOVO v2026-04-07)
  | 'chargeback_requested';  // Estorno solicitado (legado, substituído por under_review)
```

#### Status de Envio

```typescript
type ShippingStatus = 
  | 'awaiting_shipment' | 'label_generated' | 'shipped'
  | 'in_transit' | 'arriving' | 'delivered'
  | 'problem' | 'awaiting_pickup' | 'returning' | 'returned';
```

### 3.3 Tabela `order_items`

```typescript
interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  variant_id: string | null;
  sku: string;
  product_name: string;
  variant_name: string | null;
  product_slug: string | null;
  product_image_url: string | null;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;           // (unit_price * quantity) - discount
  weight: number | null;
  tax_amount: number | null;
  cost_price: number | null;
  barcode: string | null;
  ncm: string | null;
  tenant_id: string | null;
  created_at: string;
}
```

### 3.4 Tabela `order_history`

```typescript
interface OrderHistory {
  id: string;
  order_id: string;
  author_id: string | null;
  action: string;                // "status_change", "note_added"
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  description: string | null;
  created_at: string;
}
```

---

## 4. Máquina de Estados

### 4.1 Transições de Status do Pedido

```mermaid
stateDiagram-v2
    [*] --> awaiting_confirmation
    awaiting_confirmation --> ready_to_invoice: Pagamento aprovado
    awaiting_confirmation --> payment_expired: Expirado/Falhou
    ready_to_invoice --> invoice_pending_sefaz: NF submetida
    ready_to_invoice --> invoice_rejected: SEFAZ rejeitou
    invoice_pending_sefaz --> invoice_authorized: SEFAZ aprovou
    invoice_pending_sefaz --> invoice_rejected: SEFAZ rejeitou
    invoice_authorized --> invoice_issued: NF impressa
    invoice_authorized --> invoice_cancelled: Cancelamento
    invoice_issued --> dispatched: Despachado
    invoice_issued --> invoice_cancelled: Cancelamento
    dispatched --> completed: Chegou ao destino
    dispatched --> returning: Devolução
    completed --> returning: Devolução
    invoice_rejected --> ready_to_invoice: Reemissão
```

### 4.2 Transições de Pagamento

| De | Para | Válido | Descrição |
|----|------|--------|-----------|
| `awaiting_payment` | `paid`, `declined`, `cancelled` | ✅ | Resposta inicial do gateway |
| `paid` | `refunded`, `under_review` | ✅ | Estorno ou chargeback detectado |
| `under_review` | `paid` | ✅ | Chargeback recuperado |
| `under_review` | `refunded` | ✅ | Chargeback perdido |
| `declined` | `awaiting_payment`, `cancelled` | ✅ | Retry ou cancelamento |
| `cancelled` | - | ❌ (final) | - |
| `refunded` | - | ❌ (final) | - |

### 4.3 Transições de Envio

| De | Para | Válido |
|----|------|--------|
| `awaiting_shipment` | `label_generated`, `problem` | ✅ |
| `label_generated` | `shipped`, `problem` | ✅ |
| `shipped` | `in_transit`, `problem` | ✅ |
| `in_transit` | `arriving`, `delivered`, `problem`, `awaiting_pickup` | ✅ |
| `arriving` | `delivered`, `problem` | ✅ |
| `delivered` | `returning` | ✅ |
| `problem` | `awaiting_shipment`, `returning`, `returned` | ✅ |
| `awaiting_pickup` | `delivered`, `returning` | ✅ |
| `returning` | `returned` | ✅ |
| `returned` | - | ❌ (final) |

### 4.4 Transições Automáticas

| Evento | De (status) | Para (status) | De (payment) | Para (payment) | Mecanismo |
|--------|-------------|---------------|--------------|-----------------|-----------|
| Webhook pagamento aprovado | `awaiting_confirmation` | `ready_to_invoice` | `awaiting_payment` | `paid` | `pagarme-webhook` / webhook da operadora |
| Verificação ativa: pagamento aprovado | `awaiting_confirmation` | `ready_to_invoice` | `awaiting_payment` | `paid` | `verify-payment-status` (cron) |
| Verificação ativa: expirado/cancelado | `awaiting_confirmation` | `payment_expired` | — | `cancelled` | `verify-payment-status` (cron) |
| Chargeback detectado | `*` (qualquer) | `chargeback_detected` | `paid`/`approved` | `under_review` | `monitor-chargebacks` (cron) |
| Chargeback recuperado | `chargeback_detected` | (restaura status anterior) | `under_review` | `paid` | `monitor-chargebacks` (cron) |
| Chargeback perdido | `chargeback_detected` | `chargeback_lost` | `under_review` | `refunded` | `monitor-chargebacks` (cron) |
| Chargeback prazo excedido | `chargeback_detected` | `chargeback_lost` | `under_review` | `refunded` | `monitor-chargebacks` (cron) |
| Estorno direto (sem disputa) | — | — | `paid`/`approved` | `refunded` | `monitor-chargebacks` (cron) |

### 4.5 Normalização de Status (ANTI-REGRESSÃO)

Todo lookup de status na UI **DEVE** usar funções de normalização:

```typescript
// ✅ CORRETO
const normalizedStatus = normalizeOrderStatus(order.status);
const cfg = ORDER_STATUS_CONFIG[normalizedStatus];

// ❌ PROIBIDO
const cfg = ORDER_STATUS_CONFIG[order.status as OrderStatus] || ORDER_STATUS_CONFIG.awaiting_confirmation;
```

| Função | Mapeia |
|--------|--------|
| `normalizeOrderStatus()` | `pending→awaiting_confirmation`, `paid→ready_to_invoice`, `cancelled→payment_expired`, `delivered→completed`, `chargeback_detected→chargeback_detected`, `chargeback_lost→chargeback_lost` |
| `normalizePaymentStatus()` | `approved→paid`, `pending→awaiting_payment`, `chargeback_requested→under_review`, `under_review→under_review` |
| `normalizeShippingStatus()` | `pending→awaiting_shipment`, `processing→label_generated` |

---

### 4.6 Sincronia Cross-Module em Regressão (v2026-05-01)

**Problema resolvido:** quando um pedido aprovado avança para o fluxo Fiscal e Logístico (NF-e emitida, etiqueta despachada) e depois regride por um motivo legítimo (cancelamento manual, chargeback detectado, pagamento expirado pós-aprovação, devolução), os módulos a jusante deixavam o documento/etiqueta ativos sem alerta. Resultado: NF-e válida para venda inexistente, etiqueta gerada para pedido cancelado, métricas de cliente infladas e rascunhos órfãos nas filas.

**Estados regressivos canônicos:**
`cancelled`, `returned`, `returning`, `chargeback_detected`, `chargeback_lost`, `payment_expired`, `invoice_cancelled`.

**Pipeline obrigatório (toda transição que entra em estado regressivo):**

| Camada | Componente | Responsabilidade |
|--------|------------|------------------|
| 1. Trigger DB | `handle_order_fiscal_alert` | Marca `fiscal_invoices.requires_action = true` + `action_reason` em NF-e `authorized` do pedido |
| 1. Trigger DB | `handle_order_shipping_alert` | Marca `shipments.requires_action = true` + `action_reason` em remessas não entregues |
| 1. Trigger DB | `cancel_pending_drafts_on_regression` | Cancela linhas `pending`/`processing` em `fiscal_draft_queue`, `shipping_draft_queue`, `gateway_sync_queue` (preenche `cancelled_at` + `cancel_reason`) |
| 1. Trigger DB | `handle_customer_regression` | Dispara `recalc_customer_metrics` para reverter tags/métricas (ex.: comprador frequente) |
| 2. Edge Function | `order-regression-handler` | Orquestrador idempotente. Reforça as marcações acima e registra entrada em `order_history` com sumário (`regression_handled`). Chamado fire-and-forget pelo `core-orders` em toda transição regressiva manual ou automática, e por webhooks (chargeback/estorno) e cron `expire-stale-orders` |
| 2. Edge Function | `fiscal-cancel` | Ao cancelar NF-e autorizada, registra log no `order_history` e sinaliza remessas pendentes para revisão manual |
| 3. UI | `OrderRegressionBanner` (em `OrderDetail`) | Exibe NF-e e etiquetas com `requires_action = true`, motivo da regressão e ação manual sugerida |
| 3. UI | `ExecutionsQueue` (Central de Execuções) | Cards "Pedidos" e "Notas Fiscais" expõem stats `Etiquetas a reverter` e `NF-e a cancelar (regressão)` |

**O que NÃO é automático (decisão de produto):**
- Cancelamento ativo de NF-e autorizada (exige justificativa fiscal e prazo SEFAZ).
- Cancelamento de etiqueta já despachada (exige processo logístico de devolução).

A automação **sinaliza**; a ação destrutiva fica com o operador. A bandeira `requires_action` só é limpa por ação humana via `fiscal-cancel` (NF-e) ou ação explícita na tela de Remessas (etiqueta).

**Colunas de auditoria adicionadas:**
- `fiscal_invoices.requires_action`, `action_reason`, `action_dismissed_at`
- `shipments.requires_action`, `action_reason`
- `fiscal_draft_queue` / `shipping_draft_queue` / `gateway_sync_queue`: `cancelled_at`, `cancel_reason`

**Detalhe técnico crítico (lições do teste E2E 2026-05-01):**
- As 4 funções de trigger comparam `orders.status` (enum `order_status`) contra `TEXT[]` de estados regressivos. **Postgres não casta enum→text implicitamente em `ANY()`** — sem `NEW.status::text` e `OLD.status::text` toda `UPDATE orders` falha com erro `42883` e bloqueia pagamento, cancelamento, webhooks e cron de expiração em produção. Validação obrigatória ao alterar essas funções: rodar um `UPDATE orders SET status='awaiting_confirmation' WHERE id=...` real antes de fechar a entrega.
- Quando `resolve_order_shipping_provider` retorna `unresolved` (pedido sem CEP/transportadora resolvida), o pipeline atual ainda enfileira em `shipping_draft_queue` com `provider='manual'` como fallback. Comportamento intencional para que o operador receba a remessa na tela manual.

**Teste E2E executado em 2026-05-01:**
- 1 pedido fluxo feliz: `pending → awaiting_confirmation → ready_to_invoice → invoice_pending_sefaz → invoice_authorized → invoice_issued → dispatched → completed` ✅
- 5 pedidos regressão: `cancelled`, `payment_expired`, `invoice_cancelled`, `chargeback_detected`, `returned` — todas as 4 triggers e o handler comportaram como especificado ✅
- Teste rodou no tenant Respeite o Homem com pedidos/cliente/NF-e/remessas marcados `[E2E-TEST]` e `[E2E-REG]`, removidos integralmente ao fim sem rastro.

**Anti-regressão:** ver `mem://constraints/order-cross-module-sync-on-regression`.

---

## 5. Fluxos de Negócio

### 5.1 Criação via Checkout (v2026-04-04)

```mermaid
graph TD
    A[Cliente clica Finalizar Compra] --> B[Chama operadora de pagamento]
    B --> C{Operadora respondeu?}
    C -->|Não - timeout/erro| D[NENHUM pedido criado]
    D --> E[checkout_session permanece active]
    C -->|Sim - qualquer status| F[checkout-create-order]
    F --> G[Valida dados e estoque]
    G --> H[Cria pedido REAL com payment_gateway_id]
    H --> I[Cria order_items]
    I --> J[Reserva estoque - soft lock]
    J --> K[Registra histórico]
    K --> L[checkout_session → converted]
    L --> M[Retorna order_id]
```

### 5.2 Atualização de Status

Existem **duas vias** de atualização — fluxo automático (rígido) e override administrativo (flexível com auditoria).

```mermaid
graph TD
    A[Origem da mudança] --> B{force=true?}
    B -->|Não - webhook/cron/UI normal| C[core-orders.setOrderStatus]
    C --> D{Transição válida na máquina?}
    D -->|Não| E[Retorna INVALID_TRANSITION]
    D -->|Sim| F[Atualiza orders]
    B -->|Sim - admin override| G{Role = owner/admin?}
    G -->|Não| H[Retorna FORBIDDEN]
    G -->|Sim| I[Pula validação de transição]
    I --> F
    F --> J[order_history com prefixo OVERRIDE ADMIN se force]
    J --> K[Evento order.status_changed com is_manual_override]
```

#### 5.2.1 Fluxo Automático (sem `force`)
- Webhooks de pagamento, crons (`verify-payment-status`, `monitor-chargebacks`), automações fiscais e de envio **NUNCA** enviam `force: true`.
- Tentativa de transição inválida retorna `INVALID_TRANSITION` — comportamento intencional para proteger integridade do fluxo.

#### 5.2.2 Override Administrativo (`force: true`)
- Disponível em `set_order_status`, `set_payment_status`, `set_shipping_status` da edge `core-orders`.
- Validação server-side: apenas membros com role `owner` ou `admin` (operador é negado com `FORBIDDEN`).
- Pula `isValidTransition` e permite qualquer destino dentro do enum válido.
- Auditoria obrigatória:
  - `audit_logs.action = 'set_*_status_override'` com `manual_override: true` em `after_json`.
  - `order_history.description` recebe prefixo `[OVERRIDE ADMIN]`.
  - Evento publicado em `order_events` carrega `is_manual_override: true` no payload — consumidores externos (notificações, fiscal, etc.) decidem se reagem.
- Frontend (`OrderDetail.tsx`) espelha a máquina em `src/lib/orderTransitions.ts` apenas para detectar transições não naturais e abrir `OrderStatusOverrideDialog` listando consequências (NFe draft, recálculo de LTV, notificações). A validação real é sempre no servidor.

#### 5.2.3 Statuses suportados (enum completo)
- **Order:** `awaiting_confirmation`, `ready_to_invoice`, `invoice_pending_sefaz`, `invoice_authorized`, `invoice_issued`, `invoice_rejected`, `invoice_cancelled`, `dispatched`, `completed`, `returning`, `returned`, `payment_expired`, `cancelled`, `chargeback_detected`, `chargeback_lost`, `pending`, `awaiting_payment`, `paid`, `processing`, `shipped`, `in_transit`, `delivered`.
- **Payment:** `awaiting_payment`, `paid`, `declined`, `cancelled`, `refunded`, `under_review`.
- **Shipping:** `awaiting_shipment`, `label_generated`, `shipped`, `in_transit`, `arriving`, `delivered`, `problem`, `awaiting_pickup`, `returning`, `returned`.

### 5.3 Rastreio

1. Admin adiciona código via `updateTracking`
2. `shipment-ingest` cria registro de envio
3. Cron `tracking-poll` consulta transportadora
4. Atualizações refletem em `shipping_status`

---

## 6. UI/UX

**Regra de layout (2026-05-02):** a tela `/orders/new` usa exclusivamente o scroll vertical do `AppShell`. O conteúdo não deve adicionar padding inferior artificial na raiz da página. Em grids de múltiplas colunas, cards laterais de resumo/status devem usar altura intrínseca (sem esticar até a coluna principal), para não amplificar a percepção de “espaço branco” no fim da tela.

### 6.1 Lista de Pedidos

| Coluna | Largura | Conteúdo |
|--------|---------|----------|
| Pedido | 100px | OrderSourceBadge (sm) + número (font-semibold) |
| Cliente | min 180px | Nome (truncate 200px) + email (xs, truncate) |
| Status | 140px | Badge com ícone + label (text-xs, whitespace-nowrap) |
| Envio | 120px | Badge com ícone + tooltip (transportadora + rastreio) |
| Método | 90px | Label curta: PIX, Cartão, Boleto (text-xs font-medium) |
| Pagamento | 120px | Badge de status (text-xs, whitespace-nowrap) |
| Total | 110px, right | Valor (font-semibold) + badge "1ª" se first_sale |
| Data | 130px | dd/mm/yyyy hh:mm (text-xs) |
| Ações | 40px | Dropdown (ver, alterar status, excluir) |

| Elemento | Comportamento |
|----------|---------------|
| Busca | Por número, nome ou email |
| Filtros | Status, pagamento, envio, 1ª Venda. Período via `DateRangeFilter` |
| Estatísticas | 4 cards: Total, Aprovados, NF Emitida, Enviados — queries separadas com filtros ativos |
| 1ª Venda | Badge "1ª" ao lado do valor + toggle de filtro |
| Paginação | 50 por página |

### 6.1.1 Flag "1ª Venda"

- `orders.is_first_sale` (boolean, imutável) — definido no momento em que o pagamento é aprovado
- **Regra de negócio:** Um pedido é marcado como "1ª Venda" **somente se** o cliente **não existia** no módulo de Clientes do tenant **antes** desse pedido ser aprovado. É o primeiro pedido aprovado de um cliente **inexistente** na base.
- **Critérios cumulativos:**
  1. O email do pedido **não** possui registro ativo na tabela de clientes do tenant
  2. O pagamento foi aprovado (`payment_status = approved`)
  3. Não existe outro pedido aprovado com o mesmo email no tenant
- Clientes importados de outras plataformas **já existem** na base → seus pedidos nunca são "1ª Venda"
- Pedidos importados: `is_first_sale = false` por padrão
- Gravado por: trigger `trg_recalc_customer_on_order` (BEFORE UPDATE) — fonte primária e autoritativa
- Consumido diretamente do banco (sem cálculo no frontend)
- Badge verde "1ª" em `OrderList.tsx` ao lado do valor
- Filtro toggle em `Orders.tsx`
- Desacoplado de `customers.total_orders`

### 6.2 Detalhes do Pedido

| Seção | Conteúdo |
|-------|----------|
| Cabeçalho | Número, data, badges de status |
| Cliente | Nome, email, telefone, link para perfil |
| Itens | Lista com imagem, nome, quantidade, valor |
| Valores | Subtotal, desconto, frete, total |
| Endereço | Entrega e cobrança |
| Pagamento | Método, gateway, data, código operadora |
| Tentativas | Histórico de `payment_transactions` |
| Envio | Transportadora, rastreio, timeline |
| Histórico | Todas as alterações com timestamp e autor |
| Notas | Internas (admin) e do cliente |

### 6.2.1 Card: Tentativas de Pagamento

| Campo | Valor |
|-------|-------|
| Componente | `PaymentAttemptsCard.tsx` |
| Hook | `usePaymentTransactions.ts` |
| Descrição | Log de tentativas com: status, badge, data, método, operadora, valor (dividido por 100 — centavos), código da transação (monospace), mensagem de erro |
| Condições | Só renderiza se há ≥ 1 tentativa |
| Ordenação | Data descendente |

### 6.3 Retry (Retentativa de Pagamento)

- Banner azul: "Este pedido foi criado como retentativa do pedido #X"
- Banner amarelo: "Este pedido foi substituído pelo pedido #Y"
- Hook: `useRetryLinkedOrder.ts` — busca bidirecional
- Ícone `Link2` (text-info) na lista quando `retry_from_order_id` existe
- Tooltip: "Retentativa de pagamento"

### 6.4 Stat Card "Recusados"

- Página Pagamentos: card com `declinedCount` e `declinedTotal`
- Variante `destructive`, ícone `XCircle`
- Conta apenas pedidos do mês com `payment_gateway_id`

### 6.5 Integridade do GMV

GMV filtra apenas `payment_status = 'approved'` — declined e substituídos NÃO entram.

---

## 7. Ciclo de Vida Automatizado

### 7.1 Sistema de Verificação de Pagamento — Verificação Inicial (v2026-04-04)

> **Mecanismo:** Cron de 1 minuto (`verify-payment-status`) consulta tabela de controle para decidir quais pedidos verificar.

Quando um pedido é criado, o sistema inicia verificação ativa do status de pagamento junto à operadora responsável, seguindo uma escala progressiva:

| Período desde criação | Frequência de verificação |
|----------------------|--------------------------|
| 0–60 minutos | A cada 1 minuto |
| 1h–48h | A cada 1 hora |
| 48h–5 dias | A cada 12 horas |
| 5 dias+ | A cada 24 horas |

**Prazo máximo:** Consultado automaticamente na operadora. Fallbacks conservadores:
- PIX: 30 minutos
- Boleto: 3 dias
- Cartão de crédito: imediato (resposta síncrona)

**Status finais aceitos:**
- `approved` → `payment_status = paid`
- Expirado → `payment_status = cancelled`, `status = payment_expired`
- Cancelado → `payment_status = cancelled`
- Recusado → `payment_status = declined`

**Se nenhum status final ao fim do prazo máximo:** `payment_status = cancelled`, `status = payment_expired`.

**Campos de controle na tabela `orders`:**
- `next_payment_check_at` — quando a próxima verificação deve ocorrer
- `payment_check_count` — quantas verificações já foram feitas
- `payment_max_expiry_at` — prazo máximo (consultado na operadora ou fallback)

**Compatibilidade multi-gateway:** A verificação usa o campo `payment_gateway` do pedido para rotear a consulta para a API correta (Pagar.me, Mercado Pago, PagBank). Se uma nova operadora for adicionada, basta implementar o adapter de consulta.

**Coexistência com webhooks:** A verificação ativa é **complementar** aos webhooks. Webhooks continuam sendo a fonte primária de atualização. A verificação ativa serve como fallback para casos onde o webhook falha, atrasa ou não chega.

### 7.2 Sistema de Monitoramento Pós-Venda — Chargebacks (v2026-04-07)

> **Mecanismo:** Cron via `scheduler-tick` (`monitor-chargebacks` v2.0) verifica todos os pedidos aprovados nos últimos 60 dias.
> **Gateways suportados:** Pagar.me e Mercado Pago (multi-gateway, baseado em `orders.payment_gateway`).
> **Frequência:** A cada 12 horas (00:00 e 12:00 UTC), controlado por gate horário no `scheduler-tick`.

| Fase | Duração | Ação |
|------|---------|------|
| Monitoramento regular | 60 dias após aprovação | Verificação a cada 12 horas via scheduler-tick |
| Chargeback detectado | +15 dias após detecção | Verificação a cada 12 horas para resolução |

**Paginação e rate limiting:**
- Processa em lotes de 30 pedidos por página
- Delay de 200ms entre chamadas individuais ao gateway
- Delay de 500ms entre páginas
- Máximo de 30 páginas (900 pedidos) por execução
- Credenciais cacheadas por tenant para evitar consultas repetidas ao banco

**Fluxo de chargeback (v2026-04-07 — ATUALIZADO):**

**Cores visuais dos status de chargeback:**
- `chargeback_detected` / `under_review` → **Amarelo** (em análise, atenção)
- `chargeback_lost` / `refunded` → **Vermelho** (perdido/estornado)
- `chargeback_recovered` → **Verde** (resolvido a favor da loja)

1. `monitor-chargebacks` detecta chargeback:
   - `payment_status` → `under_review` (Em análise — amarelo)
   - `status` → `chargeback_detected` (Chargeback detectado — amarelo)
   - `status_before_chargeback` salvo para restauração futura
   - `chargeback_detected_at` é preenchido
   - `chargeback_deadline_at` = detecção + 15 dias
2. Verificação contínua por 15 dias:
   - **Chargeback recuperado:**
     - `payment_status` → `paid`
     - `status` → `chargeback_recovered` (verde)
     - Preserva `status_before_chargeback` e `chargeback_detected_at` para histórico
   - **Chargeback perdido:**
     - `payment_status` → `refunded`
     - `status` → `chargeback_lost` (vermelho)
3. Se nenhuma resolução em 15 dias → mesma ação de "chargeback perdido"
4. Estornos diretos (sem chargeback) → `payment_status = refunded` (status do pedido não muda)

### 7.3 Sistema de Identificação de Clientes (v2026-04-05)

> **Mecanismo:** Dois triggers em `orders` (BEFORE + AFTER) + cron de reconciliação (fallback).

Quando um pedido tem `payment_status` mudado para `approved`, o sistema executa dois estágios sequenciais:

#### Estágio 1 — BEFORE UPDATE (`trg_recalc_customer_on_order`)

1. **Busca cliente por email** no módulo de Clientes
2. **Se NÃO existe:**
   - Cria cadastro do cliente (email, nome, telefone, CPF)
   - Marca pedido com `is_first_sale = true`
   - Vincula `customer_id` ao pedido
3. **Se JÁ existe:**
   - Vincula `customer_id` ao pedido (se não vinculado)
   - `is_first_sale` permanece `false`

#### Estágio 2 — AFTER UPDATE (`after_order_approved_sync`)

4. **Garante tag "Cliente"** via `ensure_customer_tag`
5. **Recalcula métricas** via `recalc_customer_metrics` (com pedido já commitado — resolve race condition do padrão BEFORE anterior)
6. **Sincroniza** subscriber na lista "Clientes" do email marketing via `upsert_subscriber_only`

**REGRA:** Cliente NUNCA é criado antes do pagamento ser aprovado. O checkout armazena dados do cliente na `checkout_session`, mas o registro no módulo de Clientes só ocorre após confirmação de pagamento.

> **Histórico:** Até 2026-04-04, as etapas 1-6 eram executadas em um único trigger BEFORE, o que causava métricas zeradas porque `recalc_customer_metrics` não enxergava o pedido corrente.

### 7.4 Registro em `order_history`

Mudanças por webhook, verificação ativa e cron registradas automaticamente:
- `action`: `status_changed` ou `payment_status_changed`
- `description`: inclui origem (ex: "webhook Pagar.me", "verificação ativa", "PIX expirado (automático)", "chargeback detectado")

---

## 8. Regras de Negócio

### 8.1 Numeração

- Formato: `#XXXX` (sequencial por tenant)
- Campo `next_order_number` na tabela `tenants`
- Default para novos tenants: 1
- Nunca reutilizado
- Após importação: `next_order_number` = MAX + 1
- **Numeração só é consumida para pedidos reais** (após resposta do gateway)

### 8.2 Exclusão

- Apenas `pending` ou `cancelled` podem ser excluídos
- Pedidos pagos/processados: cancelar, não excluir
- `core-orders.deleteOrder` valida regras

### 8.3 Estoque

- **Soft lock (reserva)** na criação do pedido (que agora só ocorre após resposta do gateway)
- **Baixa definitiva** após confirmação de pagamento aprovado
- Revertido em cancelamento/expiração (se configurado)
- Não revertido em devolução (gestão manual)
- Em caso de estoque insuficiente: ALERTA por padrão (permite venda), BLOQUEIO RÍGIDO como configuração opcional

### 8.4 Métodos de Pagamento

```typescript
type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'boleto' | 'mercado_pago' | 'pagarme';
```

### 8.5 Origens

| Origem | Descrição |
|--------|-----------|
| `null` | Loja própria (storefront) |
| `mercadolivre` | Mercado Livre |
| `shopee` | Shopee |
| `amazon` | Amazon |
| `magazineluiza` | Magazine Luiza |

---

## 9. Integração com Outros Módulos

| Módulo | Integração |
|--------|------------|
| Clientes | Vínculo por `customer_email`. Cliente criado apenas após pagamento aprovado |
| Checkouts Abandonados | Checkout sem resposta do gateway permanece como sessão (pode virar abandonado) |
| Produtos | Items referenciam `product_id` |
| Descontos | `discount_total` e cupom |
| Fiscal | Geração de NF-e a partir do pedido |
| Notificações | Emails transacionais |
| Marketplaces | Sincronização (ML, Shopee) |
| Afiliados | Comissão calculada |
| Email Marketing | Lista "Cliente Potencial" (checkouts abandonados) e "Clientes" (pedidos aprovados) |

---

## 10. Regras Visuais — Responsividade Mobile

| Elemento | Comportamento Mobile | Arquivo |
|----------|---------------------|---------|
| Tabela de pedidos | `overflow-x-auto` com `min-w-[900px]` | `OrderList.tsx` |
| Filtros | `w-full sm:w-44` | `Orders.tsx` |
| Container filtros | `flex-wrap w-full sm:w-auto` | `Orders.tsx` |
| Paginação | Botões numéricos ocultos (`hidden sm:flex`), apenas Anterior/Próximo | `Orders.tsx` |
| Texto paginação | `text-center sm:text-left` | `Orders.tsx` |
| Container paginação | `flex-col gap-3 sm:flex-row` | `Orders.tsx` |

---

## 11. Permissões (RBAC)

| Rota | Módulo | Submódulo |
|------|--------|-----------|
| `/orders` | `ecommerce` | `orders` |
| `/orders/:id` | `ecommerce` | `orders` |
| `/orders/new` | `ecommerce` | `orders` |

---

## 12. Arquivos Relacionados

- `src/pages/Orders.tsx`, `OrderDetail.tsx`, `OrderNew.tsx`
- `src/components/orders/*`
- `src/hooks/useOrders.ts`, `useOrderDetails.ts`, `usePaymentTransactions.ts`, `useRetryLinkedOrder.ts`
- `src/types/orderStatus.ts`
- `src/lib/coreApi.ts` (coreOrdersApi)
- `supabase/functions/core-orders/`
- `supabase/functions/get-order/`
- `supabase/functions/checkout-create-order/`
- `supabase/functions/pagarme-webhook/`
- `supabase/functions/verify-payment-status/`
- `supabase/functions/monitor-chargebacks/`

---

## 13. Pendências

- [ ] Exportação de pedidos (CSV/Excel)
- [ ] Impressão de etiqueta integrada
- [ ] Split de pedido (múltiplos envios)
- [ ] Edição de itens após criação
- [ ] Reembolso parcial
- [x] ~~Eliminação de ghost orders~~ — Implementado (v2026-04-04)
- [x] ~~Verificação ativa de pagamento~~ — Especificado (v2026-04-04)
- [x] ~~Monitoramento de chargebacks~~ — Especificado (v2026-04-04)

---

*Fim do documento.*
