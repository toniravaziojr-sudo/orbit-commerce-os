# Carrinho — Regras e Especificações

> **Status:** FUNCIONAL ✅ — Core implementado

> **Camada:** Layer 3 — Especificações / Storefront  
> **Migrado de:** `docs/regras/carrinho.md`  
> **Última atualização:** 2026-04-03


## Visão Geral

Sistema de carrinho de compras com mini-cart, página completa e ofertas de cross-sell.

---

## Rotas e Componentes

| Tipo | Rota/Componente | Descrição |
|------|-----------------|-----------|
| **Mini-Cart** | Drawer lateral (Edge) | Acesso rápido sem sair da página. Renderizado pelo Edge HTML. Link aponta para `/cart`. |
| **Página SPA** | `/cart` ou `/carrinho` (alias) | Página completa do carrinho (React SPA). Ambas as rotas são suportadas. |

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

### Formato Unificado localStorage (Phase 8 - v5.1.0)

**Chave:** `storefront_cart_{tenantSlug}`

**Formato:**
```json
{
  "items": [
    {
      "id": "uuid",           // UUID único do item no carrinho
      "product_id": "uuid",   // ID do produto no banco
      "variant_id": "uuid",   // ID da variante (opcional)
      "name": "Produto X",
      "sku": "",
      "price": 99.90,
      "quantity": 2,
      "image_url": "https://...",
      "free_shipping": false
    }
  ],
  "shipping": {
    "cep": "",
    "options": [],
    "selected": null
  }
}
```

**REGRA CRÍTICA:** Tanto o script de hidratação edge (vanilla JS) quanto o React
CartContext usam a **mesma chave e formato**. Isso garante que ao navegar de uma 
página edge-rendered para /carrinho (SPA), o carrinho é preservado.

**Migração automática:** O script edge detecta o formato antigo (`sf_cart_{slug}`)
e migra automaticamente para o novo formato na primeira carga.
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

## Cores Personalizadas do Carrinho [REMOVIDO]

> **[REMOVIDO em 2026-03-10]** — A funcionalidade de cores personalizadas por página foi **removida** do carrinho.
> O carrinho agora herda **obrigatoriamente** as cores globais do tema (Primário e Secundário).
> O checkout permanece como a **única** página SPA com suporte a cores personalizadas via `PageColorsInjector`.
>
> **Motivo:** Evitar inconsistência visual entre carrinho e o restante da loja.
> **UI Builder:** A seção "Cores Personalizadas" não aparece mais no painel de configuração do Carrinho.

---

## Ícone do Carrinho no Edge Header

| Comportamento | Descrição |
|---------------|-----------|
| **Edge Header** | O ícone do carrinho é um `<a href="/cart">` que navega para a página `/cart` (SPA) |
| **SPA Header** | O ícone do carrinho usa `<Link to="/cart">` via React Router |
| **Cart Drawer** | O drawer lateral continua disponível quando itens são adicionados via botão "Adicionar ao carrinho" nos grids |

> **Alteração em 2026-03-10:** O ícone do carrinho no Edge Header foi alterado de `data-sf-action="open-cart"` (abrir drawer) para `<a href="/cart">` (navegar para página do carrinho).

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

## Barra de Conversão (Benefit Progress Bar) — v2.0

A barra de progresso incentiva o cliente a atingir um valor mínimo para ganhar frete grátis. **A barra não possui regras próprias** — ela reflete o motor central de frete grátis (ver `docs/regras/logistica.md`).

### Configuração (`BenefitConfig` em `store_settings.benefit_config`)

| Campo | Tipo | Default | Descrição |
|-------|------|---------|-----------|
| `enabled` | boolean | false | Ativa/desativa a barra (não afeta regras reais) |
| `mode` | `'free_shipping' \| 'gift'` | `'free_shipping'` | Tipo de benefício |
| `rewardLabel` | string | `'Frete Grátis'` | Texto durante progresso |
| `successLabel` | string | `'🎉 Parabéns!...'` | Texto ao atingir |
| `progressColor` | string | `'#22c55e'` | Cor da barra |

> **[REMOVIDO] `thresholdValue`** — O valor-alvo agora vem automaticamente do motor central (menor `min_order_cents` das regras ativas de logística).
> **[REMOVIDO] `applyToExternalRules`** — A barra sempre reconhece todas as fontes (produto, cupom, logística) por padrão.

### Estados da Barra

| Estado | Condição | Mensagem exemplo |
|--------|----------|-----------------|
| `hidden` | Barra desativada | — |
| `progress` | Subtotal < threshold da regra ativa | "Faltam R$ X para frete grátis" |
| `achieved` | Subtotal ≥ threshold | "Você ganhou frete grátis!" |
| `granted_by_coupon` | Cupom free_shipping aplicado | "Seu cupom liberou frete grátis" |
| `granted_by_product` | Item com `free_shipping=true` | "Carrinho com produto com frete grátis" |

### Renderização

A barra aparece em **ambos** os locais usando o mesmo componente:
- **Mini-cart lateral:** `<BenefitProgressBar compact />` dentro de `MiniCartDrawer.tsx`
- **Carrinho normal:** `<BenefitProgressBar />` dentro de `CartBlock.tsx`

> **[REMOVIDO]** `MiniCartBenefitBar` — Componente legado substituído por `BenefitProgressBar compact`.

### Arquivos

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/components/storefront/cart/BenefitProgressBar.tsx` | Componente visual unificado (suporta prop `compact`) |
| `src/components/shipping/CartConversionConfigTab.tsx` | UI admin (apenas controles visuais, sem regras de negócio) |
| `src/contexts/StorefrontConfigContext.tsx` | Provider com `useBenefit()` + fetch de `free_shipping_rules` + `logisticsThreshold` |
| `src/lib/storeConfigTypes.ts` | Interface `BenefitConfig` |

---

## Cálculo de Frete

| Integração | Status |
|------------|--------|
| Melhor Envio | 🟧 Planejado |
| Correios | 🟧 Planejado |
| Frete fixo | ✅ Implementado |
| Frete grátis | ✅ Implementado |

---

## Cores Personalizadas

A página do carrinho suporta personalização de cores de botões que sobrepõem as cores globais do tema.

### Campos de Configuração (em `themeSettings.pageSettings.cart`)

| Campo | Descrição |
|-------|-----------|
| `buttonPrimaryBg` | Cor de fundo do botão primário |
| `buttonPrimaryText` | Cor do texto do botão primário |
| `buttonPrimaryHover` | Cor de fundo no hover do botão primário |
| `buttonSecondaryBg` | Cor de fundo do botão secundário |
| `buttonSecondaryText` | Cor do texto do botão secundário |
| `buttonSecondaryHover` | Cor de fundo no hover do botão secundário |

### Regra de Herança

1. **Valores vazios** → Usa cores globais do tema (`themeSettings.colors`)
2. **Valores preenchidos** → Sobrepõe cores globais

### Arquivos Relevantes

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/hooks/usePageColors.ts` | Busca cores publicadas + gera CSS |
| `src/components/storefront/PageColorsInjector.tsx` | Injeta CSS no storefront público |
| `src/hooks/useBuilderThemeInjector.ts` | Injeta CSS no builder (draft + saved) |
| `src/components/builder/theme-settings/PageSettingsContent.tsx` | UI de edição |

### Classes de Botões

Os botões do carrinho usam classes semânticas:
- `sf-btn-primary` → Botão "Finalizar compra"
- `sf-btn-secondary` → Botão "Continuar comprando"

**PROIBIDO:** Usar `variant="ghost"` ou cores hardcoded nos botões.

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

---

## Correções Aplicadas

### CEP Input — Correção de máscara mobile/desktop (v8.6.1 — 2026-03-11)

| Campo | Valor |
|-------|-------|
| **Tipo** | Correção de Bug (encerrada) ✅ |
| **Localização** | `supabase/functions/storefront-html/index.ts`, `supabase/functions/_shared/block-compiler/blocks/product-details.ts`, `src/components/storefront/MiniCartDrawer.tsx`, `src/components/storefront/product/ShippingCalculator.tsx` |
| **Contexto** | Calculadora de frete no mini-cart (SPA) e página de produto (Edge + SPA) |
| **Problema** | Campo de CEP inseria hífens extras ("--") no mobile e desktop. Causa raiz: máscara visual conflitava com caret do navegador, e runtime real da storefront pública era Edge HTML (não React). |
| **Solução** | Máscara visual removida. Campo aceita apenas 8 dígitos puros. Input nativo: `type="text"`, `inputmode="numeric"`, `maxlength="8"`. Script global de hardening em `storefront-html` sanitiza via `beforeinput`/`paste`. |
| **Cache** | Requer re-prerender + purge CDN após alterações no Edge HTML para que URL pública reflita mudanças. |
| **Validação** | Confirmado por print do cliente em 2026-03-12: campos de CEP no mini-cart e página de produto exibem apenas dígitos (`45990408`). |
| **Afeta** | Mini-cart drawer (SPA), página de produto (Edge), carrinho (SPA), checkout (SPA) |

---

### Cart Tracking — Persistência de eventos para funil do Dashboard (v8.11.0 — 2026-03-12)

| Campo | Valor |
|-------|-------|
| **Tipo** | Função / Hook / Edge Script |
| **Localização** | `supabase/functions/storefront-html/index.ts` (Edge), `src/hooks/useCartTracking.ts` (SPA) |
| **Contexto** | Funil de conversão no Dashboard (Central de Comando) |
| **Descrição** | Insere um registro na tabela `public.carts` na primeira vez que um visitante adiciona um item ao carrinho (1 registro por sessão do browser). |
| **Comportamento Edge (primário)** | Dentro de `addToCart()`, verifica `sessionStorage` pela chave `cart_session_{tenantId}`. Se não existir, gera `session_id` via `crypto.randomUUID()`, faz POST direto ao REST API do Supabase (`/rest/v1/carts`), e salva no `sessionStorage` em caso de sucesso. |
| **Comportamento SPA (fallback)** | Hook `useCartTracking(tenantId, itemCount)` executa a mesma lógica para cobrir cenários onde o SPA carrega com carrinho já populado (hidratação do localStorage). |
| **Deduplicação** | `sessionStorage` garante 1 insert por sessão de browser. Chave: `cart_session_{tenantId}`. |
| **RLS** | Policy `Anyone can create carts` (INSERT, roles=public, WITH CHECK=true). |
| **Tabela** | `public.carts` — campos usados: `tenant_id`, `session_id`, `status` ('active'). |
| **Afeta** | Bloco "Funil de Conversão" no Dashboard → card "Carrinho". |
| **Erros/Edge cases** | Se o insert falhar (rede, RLS), o `sessionStorage` não é salvo, permitindo retry na próxima adição. |

---

### Funil de Conversão Completo — Dashboard (v8.12.0 — 2026-03-12)

| Campo | Valor |
|-------|-------|
| **Tipo** | Regra Lógica / UI / Migration |
| **Localização** | `src/components/dashboard/DashboardMetricsGrid.tsx`, `src/hooks/useDashboardMetrics.ts`, `supabase/functions/checkout-session-heartbeat/index.ts`, `src/components/storefront/checkout/CheckoutStepWizard.tsx` |
| **Contexto** | Central de Execuções (Dashboard) — Bloco "Funil de Conversão" |
| **Descrição** | Funil completo com 7 etapas horizontais: Visitas Únicas > Carrinho > Checkout > Lead > Add Frete > Add Pagamento > Compras |
| **Fontes de dados** | Visitas: RPC `count_unique_visitors` (unique por visitor_id). Carrinho: tabela `carts` (count). Checkout: tabela `checkout_sessions` (count total). Lead: `checkout_sessions.contact_captured_at IS NOT NULL` (count). Add Frete: `checkout_sessions.shipping_selected_at IS NOT NULL` (count). Add Pagamento: `checkout_sessions.payment_selected_at IS NOT NULL` (count). Compras: tabela `orders` (count total). |
| **Regra de unicidade** | Apenas "Visitas Únicas" aplica dedup por visitor_id. Todos os demais eventos contam cada ocorrência. |
| **Persistência de etapas** | Quando o evento de marketing é disparado no CheckoutStepWizard, um heartbeat simultâneo é enviado ao Edge Function `checkout-session-heartbeat` com `step: 'shipping_selected'` ou `step: 'payment_selected'`, que seta os timestamps correspondentes na tabela `checkout_sessions`. |
| **Migration** | Adicionadas colunas `shipping_selected_at` e `payment_selected_at` (timestamptz, nullable) em `checkout_sessions`. |
| **UI Ajustes** | 1) Bloco "Faturamento" renomeado para "Desempenho Geral" e mesclado com "Desempenho de Marketing". 2) Bloco "Pedidos & Financeiro" movido para 2º lugar com card "Total de Pedidos" adicionado no início. 3) Funil expandido para 7 cards compactos. |
| **Afeta** | Dashboard, checkout-session-heartbeat edge function, CheckoutStepWizard |
