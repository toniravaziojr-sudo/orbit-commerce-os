# Builder — Regras e Especificações

> **Status:** CONCLUÍDO E PROTEGIDO ✅ — Qualquer alteração estrutural requer aprovação do usuário.

## Arquitetura Builder vs Storefront Público

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CAMADA DE PÁGINA                                 │
│  Arquivos: src/pages/storefront/Storefront*.tsx                         │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Buscar dados reais do banco (produtos, categorias, etc)              │
│  • Buscar settings do template PUBLICADO (published_content)            │
│  • Detectar modo preview (?preview=1)                                   │
│  • Montar BlockRenderContext completo                                   │
│  • Passar tudo para PublicTemplateRenderer                              │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                     PUBLIC TEMPLATE RENDERER                             │
│  Arquivo: src/components/storefront/PublicTemplateRenderer.tsx          │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Renderizar estrutura global (Header/Footer)                          │
│  • Gerenciar slots (afterHeaderSlot, afterContentSlot)                  │
│  • Aplicar overrides de página                                          │
│  • Passar context para BlockRenderer                                    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         BLOCK RENDERER                                   │
│  Arquivo: src/components/builder/BlockRenderer.tsx                      │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Mapear block.type para componente React                              │
│  • Passar props + context para cada bloco                               │
│  • Gerenciar isEditing vs público                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    BLOCK LAYOUT COMPONENT                                │
│  Ex: CategoryPageLayout, ProductDetailsBlock, CartBlock                 │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Ler settings específicos do context (categorySettings, etc)          │
│  • Aplicar toggles de visibilidade                                      │
│  • Integrar com useCart para funcionalidade real                        │
│  • Comportamento diferente baseado em isEditing                         │
│  • Renderizar UI final                                                  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Sistema de Tipografia Global

A tipografia da loja é gerenciada **exclusivamente** em **Configuração do tema > Tipografia** (`TypographySettings.tsx`).

### Arquitetura

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    THEME SETTINGS (draft_content)                        │
│  Arquivo: storefront_template_sets.draft_content.themeSettings          │
├─────────────────────────────────────────────────────────────────────────┤
│  typography: {                                                           │
│    headingFont: string,      ← Fonte dos títulos (H1-H6)               │
│    bodyFont: string,         ← Fonte do corpo (p, span, button, etc)   │
│    baseFontSize: number,     ← Tamanho base em px (12-20)              │
│  }                                                                       │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    FONT FAMILY MAP                                       │
│  Arquivo: src/hooks/usePublicThemeSettings.ts                           │
├─────────────────────────────────────────────────────────────────────────┤
│  FONT_FAMILY_MAP = {                                                     │
│    'inter': "'Inter', sans-serif",                                       │
│    'playfair': "'Playfair Display', serif",                              │
│    'bebas-neue': "'Bebas Neue', sans-serif",                             │
│    ...                                                                   │
│  }                                                                       │
│  Mapeia chave de fonte → CSS font-family                                │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    CSS INJECTION                                         │
├─────────────────────────────────────────────────────────────────────────┤
│  STOREFRONT PÚBLICO:                                                     │
│  StorefrontThemeInjector.tsx                                             │
│  → Injeta <style> no <head> com CSS para .storefront-container          │
│                                                                          │
│  BUILDER PREVIEW:                                                        │
│  useBuilderThemeInjector.ts                                              │
│  → Injeta <style> no <head> para preview em tempo real                  │
└─────────────────────────────────────────────────────────────────────────┘
```

### CSS Variables Geradas

| Variável | Descrição |
|----------|-----------|
| `--sf-heading-font` | font-family para H1-H6 |
| `--sf-body-font` | font-family para p, span, button, input, etc |
| `--sf-base-font-size` | Tamanho base em px |

### Seletores Aplicados

```css
/* Container principal */
.storefront-container {
  font-family: var(--sf-body-font);
  font-size: var(--sf-base-font-size);
}

/* Títulos */
.storefront-container h1, h2, h3, h4, h5, h6 {
  font-family: var(--sf-heading-font);
}

/* Corpo e elementos de UI */
.storefront-container p, span, a, button, input, textarea, select, label, li {
  font-family: var(--sf-body-font);
}
```

### Fontes Disponíveis

| Categoria | Fontes |
|-----------|--------|
| **Sans-serif** | Inter, Roboto, Open Sans, Lato, Montserrat, Poppins, Nunito, Raleway, Source Sans Pro, Ubuntu, Mulish, Work Sans, Quicksand, DM Sans, Manrope, Outfit, Plus Jakarta Sans |
| **Serif** | Playfair Display, Merriweather, Lora, PT Serif, Crimson Text, Libre Baskerville, Cormorant Garamond, EB Garamond, Bitter |
| **Display** | Abril Fatface, Bebas Neue, Oswald, Josefin Sans, Righteous |

### Arquivos Relacionados

| Arquivo | Responsabilidade |
|---------|------------------|
| `src/hooks/useThemeSettings.ts` | CRUD de themeSettings no draft_content |
| `src/hooks/usePublicThemeSettings.ts` | Leitura de published_content + FONT_FAMILY_MAP |
| `src/hooks/useBuilderThemeInjector.ts` | Injeção CSS no builder preview |
| `src/components/storefront/StorefrontThemeInjector.tsx` | Injeção CSS no storefront público |
| `src/components/builder/theme-settings/TypographySettings.tsx` | UI de configuração |

### Regras Obrigatórias

1. **NUNCA** adicionar configurações de fonte em outros lugares além de `themeSettings.typography`
2. **SEMPRE** usar `getFontFamily()` para converter chave → CSS font-family
3. **SEMPRE** incluir `StorefrontThemeInjector` no layout público
4. **SEMPRE** usar `useBuilderThemeInjector` no builder para preview em tempo real
5. A tipografia se aplica a **TODOS** os blocos (padrões e personalizados) via CSS global

---

## Fonte de Verdade dos Settings

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    STOREFRONT_TEMPLATE_SETS                              │
├─────────────────────────────────────────────────────────────────────────┤
│  draft_content: {                     ← Usado no BUILDER                │
│    home: BlockNode,                                                      │
│    category: BlockNode,                                                  │
│    product: BlockNode,                                                   │
│    ...                                                                   │
│    themeSettings: {                                                      │
│      headerConfig: {...},                                                │
│      footerConfig: {...},                                                │
│      miniCartEnabled: boolean,                                           │
│      pageSettings: {                  ← Settings por página             │
│        category: CategorySettings,                                       │
│        product: ProductSettings,                                         │
│        cart: CartSettings,                                               │
│        checkout: CheckoutSettings,                                       │
│        thankYou: ThankYouSettings,                                       │
│      }                                                                   │
│    }                                                                     │
│  }                                                                       │
│                                                                          │
│  published_content: {...}             ← Usado no STOREFRONT PÚBLICO     │
└─────────────────────────────────────────────────────────────────────────┘
```

**Regra de Leitura:**
- **Builder/Editor:** Sempre usa `draft_content`
- **Storefront Público:** Sempre usa `published_content`
- **Preview (?preview=1):** Usa `draft_content` para teste antes de publicar

---

## Settings por Página

### Categoria (CategorySettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showRatings` | boolean | true | Exibe estrelas de avaliação nas thumbs |
| `showBadges` | boolean | true | Exibe selos do menu "Aumentar Ticket" |
| `showAddToCartButton` | boolean | true | Exibe botão "Adicionar ao carrinho" |
| `quickBuyEnabled` | boolean | false | Botão principal vai direto ao checkout |
| `buyNowButtonText` | string | "Comprar agora" | Texto do botão principal |
| `customButtonEnabled` | boolean | false | Exibe botão personalizado |
| `customButtonText` | string | "" | Texto do botão personalizado |
| `customButtonColor` | string | "" | Cor do botão personalizado |
| `customButtonLink` | string | "" | URL do botão personalizado |
| `showBanner` | boolean | true | Exibe banner da categoria |
| `showCategoryName` | boolean | true | Exibe nome da categoria |

### CategoryBanner (Defaults do Builder)

| Prop | Default | Descrição |
|------|---------|-----------|
| `showTitle` | true | Exibe título da categoria sobre o banner |
| `titlePosition` | 'center' | Posição do título: 'left', 'center', 'right' |
| `overlayOpacity` | 0 | Opacidade do overlay escuro (0-100). Default 0 = sem escurecimento |
| `height` | 'md' | Altura do banner: 'sm', 'md', 'lg' |

> **Nota (2025-01-25):** `overlayOpacity` default alterado de 40→0 em `defaults.ts` e `pageContracts.ts` para evitar escurecimento automático.

### Produto (ProductSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showGallery` | boolean | true | Exibe galeria de imagens secundárias |
| `showDescription` | boolean | true | Exibe descrição curta |
| `showVariants` | boolean | true | Exibe seletor de variantes |
| `showStock` | boolean | true | Exibe quantidade em estoque |
| `showReviews` | boolean | true | Exibe avaliações e formulário |
| `showBuyTogether` | boolean | true | Exibe seção "Compre Junto" |
| `showRelatedProducts` | boolean | true | Exibe grid de produtos relacionados |
| `showWhatsAppButton` | boolean | true | Exibe botão "Comprar pelo WhatsApp" |
| `showAddToCartButton` | boolean | true | Exibe botão "Adicionar ao carrinho" |
| `showBadges` | boolean | true | Exibe selos do produto |
| `showShippingCalculator` | boolean | true | Exibe calculadora de frete |
| `showAdditionalHighlight` | boolean | false | Exibe banners de destaque adicional |
| `showFloatingCart` | boolean | true | Exibe popup de carrinho rápido |
| `buyNowButtonText` | string | "Comprar agora" | Texto do botão principal |
| `cartActionType` | CartActionType | "miniCart" | Ação ao clicar em "Adicionar ao carrinho" |

### Carrinho (CartSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showCrossSell` | boolean | true | Exibe produtos sugeridos |
| `showCouponField` | boolean | true | Exibe campo de cupom |
| `showTrustBadges` | boolean | true | Exibe selos de confiança |
| `showShippingCalculator` | boolean | true | Exibe calculadora de frete |

### Checkout (CheckoutSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderSummary` | boolean | true | Exibe resumo do pedido |
| `showCouponField` | boolean | true | Exibe campo de cupom |
| `allowGuestCheckout` | boolean | true | Permite checkout sem login |

### Obrigado (ThankYouSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderDetails` | boolean | true | Exibe detalhes do pedido |
| `showRelatedProducts` | boolean | true | Exibe produtos relacionados |
| `showTrackingInfo` | boolean | true | Exibe info de rastreio |

---

## Integração com Carrinho

### Regras Obrigatórias

1. **SEMPRE** usar `useCart()` do `@/contexts/CartContext` para operações de carrinho
2. **SEMPRE** renderizar `MiniCartDrawer` quando `miniCartEnabled !== false`
3. **SEMPRE** implementar feedback visual "Adicionado" quando mini-cart está desabilitado
4. **SEMPRE** usar `getPublicCheckoutUrl(tenantSlug)` para compra rápida

### Padrão de Handler

```typescript
const handleAddToCart = (product: Product, e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  const cartItem = {
    product_id: product.id,
    name: product.name,
    price: product.price,
    quantity: 1,
    image_url: product.images?.[0]?.url,
    sku: product.sku || product.slug,
  };
  
  addItem(cartItem, (addedItem) => {
    if (miniCartEnabled && openMiniCartOnAdd) {
      setMiniCartOpen(true);
    } else {
      setAddedProducts(prev => new Set(prev).add(product.id));
      toast.success('Produto adicionado ao carrinho');
      setTimeout(() => {
        setAddedProducts(prev => {
          const newSet = new Set(prev);
          newSet.delete(product.id);
          return newSet;
        });
      }, 2000);
    }
  });
};
```

---

## Comportamento Builder vs Público

| Contexto | Dados Reais | Dados Demo |
|----------|-------------|------------|
| **Builder** (`isEditing=true`) | ✅ Exibe | ✅ Exibe como fallback |
| **Storefront Público** (`isEditing=false`) | ✅ Exibe | ❌ Não renderiza |

### Indicadores Visuais de Demo

| Indicador | Estilo | Descrição |
|-----------|--------|-----------|
| Opacidade | `opacity-50` | Elementos demo ficam semi-transparentes |
| Badge | `[Demo]` | Tag visual indicando conteúdo fictício |
| Border | `border-dashed` | Borda tracejada em alguns elementos |

---

## Responsividade — Container Queries

| Classe | Breakpoint | Uso |
|--------|------------|-----|
| `.sf-*-mobile` | Container < 768px | Exibe versão mobile |
| `.sf-*-desktop` | Container ≥ 768px | Exibe versão desktop |

**Regra Fixa:** Usar classes `sf-*` (container queries) em vez de `md:`, `lg:` (media queries) dentro do storefront.

---

## Sistema de Edição de Texto Rico (RichText)

### Arquitetura Canônica

O sistema de edição inline usa uma arquitetura **uncontrolled** para estabilidade visual:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     CANVAS RICH TEXT CONTEXT                            │
│  Arquivo: src/components/builder/CanvasRichTextContext.tsx              │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Registrar/desregistrar instâncias de editores ativos                 │
│  • Salvar e restaurar seleções de texto                                 │
│  • Sincronizar seleção com o estado global do Builder                   │
│  • Gerenciar lock de formatação durante operações                       │
│  • Capturar seleções via eventos globais (selectionchange + mouseup)    │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                         RICH TEXT BLOCK                                  │
│  Arquivo: src/components/builder/blocks/content/RichTextBlock.tsx       │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Renderizar contentEditable para edição inline                        │
│  • Registrar instância no CanvasRichTextContext                         │
│  • Bloquear atalhos globais (Backspace/Delete) durante edição           │
│  • Sincronizar innerHTML com estado global via commit (debounce/blur)   │
└─────────────────────────────────────────────────────────────────────────┘
                                    ↓
┌─────────────────────────────────────────────────────────────────────────┐
│                    RICH TEXT EDITOR (PAINEL LATERAL)                    │
│  Arquivo: src/components/builder/panels/RichTextEditor.tsx              │
├─────────────────────────────────────────────────────────────────────────┤
│  Responsabilidades:                                                      │
│  • Exibir controles de formatação (Negrito, Itálico, Fonte, Tamanho)   │
│  • Restaurar seleção antes de aplicar comandos                          │
│  • Aplicar comandos via execCommand no canvas                           │
│  • Gerenciar tamanhos de fonte em PX (12px a 48px)                      │
└─────────────────────────────────────────────────────────────────────────┘
```

### Sincronização de Seleção

| Evento | Ação | Propósito |
|--------|------|-----------|
| `selectionchange` | `autoSaveSelection()` | Captura seleções durante arraste |
| `mouseup` | `autoSaveSelection()` + delay | Garante captura quando mouse termina fora do canvas |
| `onBlockSelect` | `store.selectBlock(blockId)` | Sincroniza com estado global do Builder |

**Regra Crítica:** A seleção de texto SEMPRE notifica o Builder para exibir o painel de propriedades, independentemente de onde o ponteiro do mouse termina.

### Controles de Formatação

| Controle | Fonte | Valores |
|----------|-------|---------|
| Negrito | Painel lateral | Toggle via execCommand |
| Itálico | Painel lateral | Toggle via execCommand |
| Sublinhado | Painel lateral | Toggle via execCommand |
| Fonte | Painel lateral | Lista de fontes do tema |
| Tamanho | Painel lateral | 12px, 14px, 16px, 18px, 20px, 24px, 28px, 32px, 36px, 40px, 48px |

**Regra Fixa:** Editor flutuante foi REMOVIDO. Todos os controles são centralizados no painel lateral (menu principal).

### Regras de Implementação

1. **NUNCA** usar edição controlada (React state) para conteúdo inline — causa flickering
2. **SEMPRE** usar commit via debounce ou blur para sincronizar com estado global
3. **SEMPRE** bloquear eventos de teclado globais (Delete/Backspace) dentro do bloco
4. **SEMPRE** registrar instância no CanvasRichTextContext ao montar
5. **SEMPRE** restaurar seleção antes de aplicar formatação via painel lateral
