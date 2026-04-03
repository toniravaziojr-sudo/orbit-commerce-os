# Módulo: Pedidos (Admin)

> **Status:** ✅ Ativo  
> **Camada:** Layer 3 — Especificações / E-commerce  
> **Última atualização:** 2026-04-03  
> **Migrado de:** `docs/regras/pedidos.md`

---

## 1. Visão Geral

O módulo de Pedidos gerencia todo o ciclo de vida de uma venda, desde a criação até a entrega. Implementa uma máquina de estados para status do pedido, pagamento e envio, garantindo transições válidas. Todas as operações passam pela Edge Function `core-orders` para auditoria e consistência.

---

## 2. Arquitetura de Componentes

### 2.1 Páginas

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/pages/Orders.tsx` | Lista de pedidos com filtros, estatísticas e paginação |
| `src/pages/OrderDetail.tsx` | Detalhes do pedido, itens, histórico, notas, rastreio |
| `src/pages/OrderNew.tsx` | Criação manual de pedidos |

### 2.2 Componentes

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/components/orders/OrderList.tsx` | Tabela com badges de status e ações |
| `src/components/orders/OrderSourceBadge.tsx` | Badge de origem (Loja, ML, Shopee) |
| `src/components/orders/OrderShippingMethod.tsx` | Método de envio |
| `src/components/orders/ShipmentSection.tsx` | Rastreio e envio |
| `src/components/orders/PaymentAttemptsCard.tsx` | Histórico de tentativas de pagamento |

### 2.3 Hooks

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/hooks/useOrders.ts` | Lista, cria, atualiza status, deleta via coreOrdersApi |
| `src/hooks/useOrderDetails.ts` | Busca pedido por ID/número via Edge Function |
| `src/hooks/useCustomerOrders.ts` | Pedidos do cliente logado (storefront) |
| `src/hooks/usePaymentTransactions.ts` | Tentativas de pagamento por order_id |
| `src/hooks/useRetryLinkedOrder.ts` | Vínculo bidirecional de retry |

### 2.4 Edge Functions

| Função | Responsabilidade |
|--------|------------------|
| `core-orders` | API canônica: createOrder, setOrderStatus, setPaymentStatus, setShippingStatus, addNote, updateTracking, deleteOrder |
| `get-order` | Busca segura de pedido (bypassa RLS para guest) |
| `checkout-create-order` | Criação de pedido via checkout do storefront |
| `shipment-ingest` | Ingestão de dados de envio/rastreio |
| `expire-stale-orders` | Cancela pedidos expirados (cron) |

---

## 3. Modelo de Dados

### 3.1 Tabela `orders`

```typescript
interface Order {
  id: string;                    // UUID PK
  tenant_id: string;             // FK → tenants
  customer_id: string | null;    // FK → customers
  order_number: string;          // Sequencial por tenant (ex: "ORD-0001")
  
  // Status
  status: OrderStatus;
  payment_status: PaymentStatus;
  shipping_status: ShippingStatus;
  
  // Valores
  subtotal: number;
  discount_total: number;
  shipping_total: number;
  tax_total: number;
  total: number;                 // subtotal - discount + shipping + tax
  
  // Pagamento
  payment_method: PaymentMethod | null;
  payment_gateway: string | null;
  payment_gateway_id: string | null;
  paid_at: string | null;
  installments: number | null;
  installment_value: number | null;
  
  // Primeira Compra
  is_first_sale: boolean;        // Imutável
  
  // Envio
  shipping_carrier: string | null;
  shipping_service_code: string | null;
  shipping_service_name: string | null;
  shipping_estimated_days: number | null;
  tracking_code: string | null;
  tracking_url: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  
  // Cliente (snapshot)
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_cpf: string | null;
  
  // Endereços (shipping + billing)
  // ...
  
  // Marketplace
  source_order_number: string | null;
  source_platform: string | null;
  marketplace_source: string | null;
  marketplace_order_id: string | null;
  marketplace_data: Record<string, unknown> | null;
  
  // Retry
  retry_from_order_id: string | null;
  retry_token: string | null;
  retry_token_expires_at: string | null;
  
  // Auditoria de preço
  canonical_total: number | null;
  
  created_at: string;
  updated_at: string;
}
```

### 3.1.1 Regra de Pedidos Fantasma (Ghost Orders)

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Lógica — CRÍTICA |
| **Descrição** | Pedidos sem `payment_gateway_id` não aparecem nas listas |
| **Filtro canônico** | `.not('payment_gateway_id', 'is', null)` — obrigatório em TODAS as queries |
| **Cron** | `expire-stale-orders` cancela após 30min |

**Garantia tripla de gravação do `payment_gateway_id`:**

| Ponto | Quando |
|-------|--------|
| 1. Função de cobrança | Ao receber resposta da operadora (qualquer status) |
| 2. Webhook (redundância) | Em toda notificação de pagamento |
| 3. Importação | Ao importar de outras plataformas |

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
  | 'invoice_cancelled';       // NF Cancelada
```

#### Status de Pagamento

```typescript
type PaymentStatus = 
  | 'awaiting_payment'
  | 'paid'
  | 'declined'
  | 'cancelled'
  | 'refunded';
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
  quantity: number;
  unit_price: number;
  discount_amount: number;
  total_price: number;
  weight: number | null;
  ncm: string | null;
}
```

### 3.4 Tabela `order_history`

```typescript
interface OrderHistory {
  id: string;
  order_id: string;
  author_id: string | null;
  action: string;
  previous_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  description: string | null;
  created_at: string;
}
```

---

## 4. Máquina de Estados

### 4.1 Transições de Status do Pedido

```
Pedido criado → Aguardando confirmação
  ├─ Pagamento expirado
  └─ Pagamento aprovado → Pronto para emitir NF
       ├─ NF Rejeitada → pode voltar para Pronto
       └─ Pendente SEFAZ → NF Autorizada → NF Emitida → Despachado
            ├─ Concluído
            └─ Em devolução
```

### 4.2 Transições Automáticas

| Evento | De | Para | Mecanismo |
|--------|----|------|-----------|
| Webhook pagamento aprovado | `awaiting_confirmation` | `ready_to_invoice` | webhook |
| PIX/Boleto expirado | `awaiting_confirmation` | `payment_expired` | cron |
| Pagamento recusado | `awaiting_confirmation` | `payment_expired` | cron |

### 4.3 Normalização de Status (ANTI-REGRESSÃO)

Todo lookup de status na UI **DEVE** usar funções de normalização:

| Função | Mapeia |
|--------|--------|
| `normalizeOrderStatus()` | `pending→awaiting_confirmation`, `paid→ready_to_invoice`, etc. |
| `normalizePaymentStatus()` | `approved→paid`, `pending→awaiting_payment`, etc. |
| `normalizeShippingStatus()` | `pending→awaiting_shipment`, etc. |

---

## 5. Fluxos de Negócio

### 5.1 Criação via Checkout

```
Cliente finaliza → checkout-create-order → Valida dados/estoque → Cria pedido → Cria items → Decrementa estoque → Registra histórico → Dispara evento
```

### 5.2 Rastreio

1. Admin adiciona código via `updateTracking`
2. `shipment-ingest` cria registro de envio
3. Cron `tracking-poll` consulta transportadora
4. Atualizações refletem em `shipping_status`

---

## 6. UI/UX

### 6.1 Lista de Pedidos

| Coluna | Largura | Conteúdo |
|--------|---------|----------|
| Pedido | 100px | Badge origem + número |
| Cliente | min 180px | Nome + email |
| Status | 140px | Badge com ícone |
| Envio | 120px | Badge + tooltip |
| Método | 90px | PIX, Cartão, Boleto |
| Pagamento | 120px | Badge de status |
| Total | 110px, right | Valor + badge "1ª" se first_sale |
| Data | 130px | dd/mm/yyyy hh:mm |
| Ações | 40px | Dropdown |

| Elemento | Comportamento |
|----------|---------------|
| Busca | Por número, nome ou email |
| Filtros | Status, pagamento, envio, 1ª Venda. Período via `DateRangeFilter` |
| Estatísticas | 4 cards (Total, Aprovados, NF Emitida, Enviados) — queries separadas |
| Paginação | 50 por página |

### 6.1.1 Flag "1ª Venda"

- `orders.is_first_sale` (boolean, imutável) — definido na criação
- Badge verde "1ª" ao lado do valor quando `true`
- Filtro toggle na lista

### 6.2 Detalhes do Pedido

| Seção | Conteúdo |
|-------|----------|
| Cabeçalho | Número, data, badges |
| Cliente | Nome, email, telefone, link perfil |
| Itens | Lista com imagem, nome, qtd, valor |
| Valores | Subtotal, desconto, frete, total |
| Pagamento | Método, gateway, data, código operadora |
| Tentativas | Histórico de payment_transactions |
| Envio | Transportadora, rastreio, timeline |
| Histórico | Alterações com timestamp e autor |

### 6.3 Retry (Retentativa de Pagamento)

- Banner azul: "Este pedido foi criado como retentativa do pedido #X"
- Banner amarelo: "Este pedido foi substituído pelo pedido #Y"
- Ícone `Link2` na lista quando `retry_from_order_id` existe

---

## 7. Ciclo de Vida Automatizado

### 7.1 Expiração Automática (cron: `expire-stale-orders-every-15m`)

| Tipo | Prazo | Ação |
|------|-------|------|
| PIX pendente | 1 hora | Cancelado |
| Boleto pendente | 4 dias | Cancelado |
| Pedido órfão (sem transação) | 30 min | Cancelado |
| `payment_status=declined` + `status=pending` | Imediato | Cancelado |

### 7.2 Registro em `order_history`

Mudanças por webhook e cron registradas automaticamente com origem descritiva.

---

## 8. Regras de Negócio

### 8.1 Numeração

- Formato: `#XXXX` (sequencial por tenant)
- Default para novos tenants: 1
- Nunca reutilizado
- Após importação: MAX + 1

### 8.2 Exclusão

- Apenas pedidos `pending` ou `cancelled` podem ser excluídos
- Pedidos pagos: cancelar, não excluir

### 8.3 Estoque

- Decrementado na criação
- Revertido em cancelamento (se configurado)
- Não revertido em devolução (manual)

### 8.4 Métodos de Pagamento

```typescript
type PaymentMethod = 'pix' | 'credit_card' | 'debit_card' | 'boleto' | 'mercado_pago' | 'pagarme';
```

### 8.5 Origens

| Origem | Descrição |
|--------|-----------|
| `null` | Loja própria |
| `mercadolivre` | Mercado Livre |
| `shopee` | Shopee |

---

## 9. Integração com Outros Módulos

| Módulo | Integração |
|--------|------------|
| Clientes | Vínculo por `customer_email` |
| Produtos | Items referenciam `product_id` |
| Descontos | `discount_total` e cupom |
| Fiscal | Geração de NF-e |
| Notificações | Emails transacionais |
| Marketplaces | Sincronização |
| Afiliados | Comissão calculada |

---

## 10. Permissões (RBAC)

| Rota | Módulo | Submódulo |
|------|--------|-----------|
| `/orders` | `ecommerce` | `orders` |
| `/orders/:id` | `ecommerce` | `orders` |
| `/orders/new` | `ecommerce` | `orders` |

---

## 11. Pendências

- [ ] Exportação de pedidos (CSV/Excel)
- [ ] Impressão de etiqueta integrada
- [ ] Split de pedido (múltiplos envios)
- [ ] Edição de itens após criação
- [ ] Reembolso parcial

---

*Fim do documento.*
