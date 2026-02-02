# Carrinho — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core implementado

## Visão Geral

Sistema de carrinho de compras com mini-cart, página completa e ofertas de cross-sell.

---

## Rotas e Componentes

| Tipo | Rota/Componente | Descrição |
|------|-----------------|-----------|
| **Mini-Cart** | Drawer lateral | Acesso rápido sem sair da página |
| **Página** | `/loja/:slug/carrinho` | Página completa do carrinho |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CART CONTEXT                                    │
│  Arquivo: src/contexts/CartContext.tsx                                  │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Estado global do carrinho (items, totals)                            │
│  • Persistência em localStorage                                          │
│  • Sincronização com backend (checkout_sessions)                        │
│  • Operações: addItem, removeItem, updateQuantity, clear                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│  COMPONENTES DE UI                                                       │
│  • MiniCartDrawer (drawer lateral)                                      │
│  • CartBlock (página completa)                                          │
│  • CartItem (item individual)                                           │
│  • CartSummary (resumo com totais)                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Mini-Cart (Drawer)

### Estrutura Visual

```
┌─────────────────────────────────┐
│  🛒 Meu Carrinho (3 itens)  [X] │
├─────────────────────────────────┤
│  ┌─────┐ Produto 1              │
│  │ Img │ Tam: M | Cor: Azul     │
│  └─────┘ R$ 99,90  [- 1 +] [🗑] │
│  ─────────────────────────────  │
│  ┌─────┐ Produto 2              │
│  │ Img │                        │
│  └─────┘ R$ 149,90 [- 2 +] [🗑] │
├─────────────────────────────────┤
│  Subtotal:        R$ 349,70     │
│  Frete:           Calcular →    │
├─────────────────────────────────┤
│  [    VER CARRINHO    ]         │
│  [  FINALIZAR COMPRA  ]         │
└─────────────────────────────────┘
```

### Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `MiniCartDrawer` | `src/components/storefront/MiniCartDrawer.tsx` | Container drawer |
| `MiniCartItem` | `src/components/storefront/MiniCartItem.tsx` | Item individual |
| `MiniCartSummary` | `src/components/storefront/MiniCartSummary.tsx` | Resumo e CTAs |

### Configurações (via ThemeMiniCartConfig)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `cartActionType` | `'miniCart' \| 'goToCart' \| 'none'` | `'miniCart'` | Ação ao adicionar produto |
| `showAddToCartButton` | boolean | true | Mostrar botão de adicionar |
| `showCrossSell` | boolean | true | Mostrar cross-sell no mini-cart |
| `showCoupon` | boolean | true | Campo de cupom no mini-cart |
| `showShippingCalculator` | boolean | true | Calculadora de frete no mini-cart |
| `showFreeShippingProgress` | boolean | true | Barra de progresso para frete grátis |
| `showStockReservationTimer` | boolean | false | Timer de reserva de estoque |
| `stockReservationMinutes` | number | 15 | Minutos de reserva |

**NOTA:** Configuração centralizada em **Configurações do Tema → Carrinho Suspenso** (`MiniCartSettings.tsx`).

---

## Página do Carrinho

### Estrutura Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              HEADER                                      │
├─────────────────────────────────────────────────────────────────────────┤
│  🛒 MEU CARRINHO                                                        │
├─────────────────────────────────────────────────────────────────────────┤
│  ┌───────────────────────────────────────┐  ┌─────────────────────────┐│
│  │ ITENS DO CARRINHO                     │  │ RESUMO DO PEDIDO       ││
│  │                                       │  │                         ││
│  │ ┌─────┐ Produto 1                     │  │ Subtotal:    R$ 349,70 ││
│  │ │ Img │ Tam: M | Cor: Azul            │  │ Frete:       R$ 15,00  ││
│  │ └─────┘ R$ 99,90    [- 1 +]   [🗑]    │  │ Desconto:    -R$ 20,00 ││
│  │ ───────────────────────────────────── │  │ ─────────────────────  ││
│  │ ┌─────┐ Produto 2                     │  │ Total:       R$ 344,70 ││
│  │ │ Img │                               │  │                         ││
│  │ └─────┘ R$ 149,90   [- 2 +]   [🗑]    │  │ Cupom: [______] [OK]   ││
│  │                                       │  │                         ││
│  └───────────────────────────────────────┘  │ [FINALIZAR COMPRA]     ││
│                                             │                         ││
│                                             │ 🔒 Compra segura        ││
│                                             │ 📦 Frete grátis +R$199  ││
│                                             └─────────────────────────┘│
├─────────────────────────────────────────────────────────────────────────┤
│  📦 CALCULAR FRETE                                                      │
│  CEP: [________] [CALCULAR]                                            │
│                                                                         │
│  PAC - R$ 15,00 (5-8 dias úteis)                                       │
│  SEDEX - R$ 25,00 (2-3 dias úteis)                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  VOCÊ TAMBÉM PODE GOSTAR (Cross-sell)                                  │
│  [Produto A] [Produto B] [Produto C] [Produto D]                       │
├─────────────────────────────────────────────────────────────────────────┤
│  🔒 SELOS DE SEGURANÇA                                                  │
│  [SSL] [Compra Segura] [Pagamento Protegido]                           │
├─────────────────────────────────────────────────────────────────────────┤
│                              FOOTER                                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Componentes

| Componente | Arquivo | Função |
|------------|---------|--------|
| `StorefrontCart` | `src/pages/storefront/StorefrontCart.tsx` | Página container |
| `CartBlock` | `src/components/builder/blocks/CartBlock.tsx` | Layout principal |
| `CartItemList` | `src/components/storefront/cart/CartItemList.tsx` | Lista de itens |
| `CartSummary` | `src/components/storefront/cart/CartSummary.tsx` | Resumo lateral |
| `CrossSellSection` | `src/components/storefront/cart/CrossSellSection.tsx` | Produtos sugeridos |

---

## Settings (Builder)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showCrossSell` | boolean | true | Exibe cross-sell |
| `showCouponField` | boolean | true | Campo de cupom |
| `showTrustBadges` | boolean | true | Selos de confiança |
| `showShippingCalculator` | boolean | true | Calculadora de frete |

---

## Cores Personalizadas (Builder)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `buttonPrimaryBg` | string | '' | Cor de fundo do botão primário (herda do tema se vazio) |
| `buttonPrimaryText` | string | '' | Cor do texto do botão primário (herda do tema se vazio) |
| `buttonSecondaryBg` | string | '' | Cor de fundo do botão secundário (herda do tema se vazio) |
| `buttonSecondaryText` | string | '' | Cor do texto do botão secundário (herda do tema se vazio) |

### Regra de Herança

1. Se a cor estiver **vazia** (`''`), o botão usa as cores do **tema global**
2. Se a cor estiver **preenchida**, ela **sobrescreve** o tema
3. Configuração em: **Configurações do Tema > Páginas > Carrinho > Cores Personalizadas**

---

## Context API

### CartItem Interface

```typescript
interface CartItem {
  id: string;
  product_id: string;
  variant_id?: string;
  name: string;
  price: number;
  quantity: number;
  image_url?: string;
  sku?: string;
  variant_label?: string;
}
```

### Métodos Disponíveis

| Método | Parâmetros | Descrição |
|--------|------------|-----------|
| `addItem` | `item: CartItem, callback?: fn` | Adiciona item |
| `removeItem` | `id: string` | Remove item |
| `updateQuantity` | `id: string, quantity: number` | Atualiza qtd |
| `clearCart` | - | Limpa carrinho |
| `getTotal` | - | Retorna total |
| `getItemCount` | - | Retorna qtd total |

---

## Cross-sell

| Característica | Descrição |
|----------------|-----------|
| **Fonte** | Tabela `offer_rules` com `type='cross_sell'` |
| **Trigger** | Produtos no carrinho |
| **Limite** | Máximo 4 produtos sugeridos |
| **Filtro** | Exclui produtos já no carrinho |

### Regra Crítica de Ofertas

| Tipo de Oferta | Local Correto |
|----------------|---------------|
| **Cross-sell** | **Carrinho** |
| Order Bump | Checkout |
| Compre Junto | Página do Produto |
| Upsell | Página Obrigado |

---

## Cupom de Desconto

| Validação | Descrição |
|-----------|-----------|
| `code` | Código do cupom |
| `is_active` | Cupom ativo |
| `usage_limit` | Não excedeu limite |
| `min_purchase` | Carrinho atinge mínimo |
| `expires_at` | Não expirado |

---

## Cálculo de Frete

| Integração | Status |
|------------|--------|
| Melhor Envio | 🟧 Planejado |
| Correios | 🟧 Planejado |
| Frete fixo | ✅ Implementado |
| Frete grátis | ✅ Implementado |

---

## Persistência

| Tipo | Método |
|------|--------|
| **Local** | `localStorage` com key `cart_{tenantId}` |
| **Backend** | Tabela `checkout_sessions` (após identificação) |

---

## Comportamento

| Ação | Feedback |
|------|----------|
| Adicionar item | Toast + Mini-cart abre (se habilitado) |
| Remover item | Confirmação + Toast |
| Carrinho vazio | Mensagem + CTA "Continuar comprando" |
| Erro de estoque | Toast de erro + Ajuste automático |

---

## Responsividade

| Elemento | Desktop | Mobile |
|----------|---------|--------|
| Layout | 2 colunas | 1 coluna |
| Mini-cart | Drawer direita | Drawer fullscreen |
| Cross-sell | 4 produtos | 2 produtos (swipe) |

---

## Pendências

- [ ] Salvar carrinho no backend (usuário logado)
- [ ] Recuperar carrinho abandonado
- [ ] Estoque em tempo real
- [ ] Reserva de estoque temporária
- [ ] Desconto progressivo por quantidade
