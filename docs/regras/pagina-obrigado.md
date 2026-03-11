# Página Obrigado (Thank You) — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core implementado

## Visão Geral

Página de confirmação pós-compra com detalhes do pedido e ofertas de upsell.

---

## Rota

`/loja/:slug/obrigado/:orderId`

---

## Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                         ✅ PEDIDO CONFIRMADO!                      │  │
│  │                                                                    │  │
│  │  Obrigado pela sua compra, [Nome do Cliente]!                     │  │
│  │  Seu pedido #12345 foi recebido com sucesso.                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  PRÓXIMOS PASSOS                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                     │
│  │ 📧 Email    │  │ 📦 Preparo  │  │ 🚚 Envio    │                     │
│  │ enviado     │  │ do pedido   │  │ em breve    │                     │
│  └─────────────┘  └─────────────┘  └─────────────┘                     │
├─────────────────────────────────────────────────────────────────────────┤
│  DETALHES DO PEDIDO                                                      │
│  ┌────────────────────────────────┐  ┌────────────────────────────────┐│
│  │ Itens do Pedido                │  │ Informações de Pagamento       ││
│  │ • Produto 1 - R$ 99,90         │  │ Método: PIX                    ││
│  │ • Produto 2 - R$ 149,90        │  │ Status: Aprovado               ││
│  │                                │  │                                ││
│  │ Subtotal: R$ 249,80            │  │ Endereço de Entrega            ││
│  │ Frete: R$ 15,00                │  │ Rua Example, 123               ││
│  │ Desconto: -R$ 20,00            │  │ São Paulo - SP                 ││
│  │ Total: R$ 244,80               │  │ CEP: 01234-567                 ││
│  └────────────────────────────────┘  └────────────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│  OFERTA EXCLUSIVA (Upsell)                                              │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  🎁 APROVEITE 20% OFF no próximo pedido!                          │  │
│  │                                                                    │  │
│  │  [Produto Upsell]  De R$ 199,90 por R$ 159,92                     │  │
│  │                                                                    │  │
│  │  [ADICIONAR AO PEDIDO - 1 CLICK]                                  │  │
│  │                                                                    │  │
│  │  ⏰ Oferta expira em 10:00                                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
├─────────────────────────────────────────────────────────────────────────┤
│  RASTREAMENTO                                                            │
│  Código: [Código de rastreio]  [Copiar] [Rastrear]                     │
├─────────────────────────────────────────────────────────────────────────┤
│  PRODUTOS QUE VOCÊ TAMBÉM PODE GOSTAR                                   │
│  [Grid de produtos relacionados]                                        │
├─────────────────────────────────────────────────────────────────────────┤
│                              FOOTER                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `StorefrontThankYou` | `src/pages/storefront/StorefrontThankYou.tsx` | Página container |
| `ThankYouBlock` | `src/components/builder/blocks/ThankYouBlock.tsx` | Layout principal |
| `OrderConfirmation` | `src/components/storefront/thankyou/OrderConfirmation.tsx` | Confirmação |
| `OrderDetails` | `src/components/storefront/thankyou/OrderDetails.tsx` | Detalhes do pedido |
| `UpsellSection` | `src/components/storefront/thankyou/UpsellSection.tsx` | Ofertas upsell |
| `TrackingInfo` | `src/components/storefront/thankyou/TrackingInfo.tsx` | Rastreamento |

---

## Settings (Builder)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderDetails` | boolean | true | Exibe detalhes do pedido |
| `showRelatedProducts` | boolean | true | Exibe produtos relacionados |
| `showTrackingInfo` | boolean | true | Exibe info de rastreio |
| `showUpsell` | boolean | true | Exibe ofertas upsell |
| `showNextSteps` | boolean | true | Exibe timeline de próximos passos |

---

## Hooks

| Hook | Função |
|------|--------|
| `useOrder` | Busca detalhes do pedido |
| `useUpsellRules` | Regras de upsell pós-compra |

---

## Upsell (Pós-Compra)

| Característica | Descrição |
|----------------|-----------|
| **Fonte** | Tabela `offer_rules` com `type='upsell'` |
| **Trigger** | Produtos no pedido recém-finalizado |
| **Tempo limite** | Timer countdown opcional |
| **1-Click** | Adiciona ao pedido sem novo checkout |
| **Desconto** | `percent` ou `fixed` |

### Regra Crítica de Ofertas

| Tipo de Oferta | Local Correto |
|----------------|---------------|
| Cross-sell | Carrinho |
| Order Bump | Checkout |
| Compre Junto | Página do Produto |
| **Upsell** | **Página Obrigado** |

---

## Dados do Pedido

| Campo | Fonte |
|-------|-------|
| Número | `order.id` (formatado) |
| Status | `order.status` |
| Itens | `order.items_snapshot` |
| Pagamento | `order.payment_method`, `order.payment_status` |
| Endereço | `order.shipping_*` ou join com `customer_addresses` |
| Rastreio | `order.tracking_code`, `order.tracking_url` |

---

## Timeline de Status

| Etapa | Ícone | Descrição |
|-------|-------|-----------|
| Confirmado | ✅ | Pedido recebido |
| Pagamento | 💳 | Aguardando/Aprovado |
| Preparação | 📦 | Separando produtos |
| Enviado | 🚚 | Em trânsito |
| Entregue | 🎉 | Finalizado |

---

## Ações Disponíveis

| Ação | Descrição |
|------|-----------|
| Copiar código rastreio | Clipboard API |
| Rastrear pedido | Link externo (Correios, etc) |
| Compartilhar | Share API (mobile) |
| Imprimir | Print do resumo |
| Continuar comprando | Link para home |

---

## SEO

| Meta | Valor |
|------|-------|
| `robots` | `noindex, nofollow` |
| `<title>` | "Pedido Confirmado - [Loja]" |

---

## Marketing Events (Pixel Tracking)

| Evento | Disparado em | Condição |
|--------|-------------|----------|
| `Purchase` | `CheckoutStepWizard.tsx` (primário) | Dispara ao criar pedido, antes do redirect |
| `Purchase` | `ThankYouContent.tsx` (backup) | Dispara quando pedido carrega E tracker está pronto |

### Regras
- Purchase dispara para **todos** os métodos de pagamento (PIX, Boleto, Cartão)
- Dedup via `purchaseTrackedRef` (ref local) + `trackOnce` key `purchase_{orderId}` — nunca duplica
- Não depende de `payment_status` — pedidos PIX/Boleto em `pending` são rastreados
- `content_ids` usam `resolveMetaContentId()` (meta_retailer_id || sku || id)

### Anti-Regressão: Race Condition do Tracker (v6.2.2)

**Problema corrigido:** O `MarketingTrackerProvider` inicializa o tracker de forma **deferida** (`requestIdleCallback` / `setTimeout 2s`). Se o pedido carrega antes do tracker, o `purchaseTrackedRef` era marcado antes do disparo efetivo, bloqueando o retry quando o tracker ficava pronto.

**Solução:** 
1. `ThankYouContent.tsx` verifica `if (!tracker) return` **ANTES** de marcar o ref
2. `purchaseTrackedRef` só é preenchido **APÓS** o `trackPurchase()` ser chamado com tracker disponível
3. `tracker` é adicionado como dependência do `useEffect`, garantindo re-execução quando ficar pronto
4. Import direto de `useMarketingTracker` para acessar o estado do tracker

---

## Pendências

- [ ] Upsell 1-click funcional
- [ ] Countdown timer para ofertas
- [ ] Compartilhamento social
- [ ] Email de confirmação visual
- [ ] QR Code para rastreio
