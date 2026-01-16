# Padrões de Arquitetura: Builder vs Storefront Público

> **Propósito:** Este documento define os padrões de implementação para garantir consistência entre o Builder (editor/preview) e o Storefront público em todas as páginas do sistema.

---

## 1. Arquitetura Geral

### 1.1 Fluxo de Dados

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

### 1.2 Fonte de Verdade dos Settings

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
│        ...                                                               │
│      }                                                                   │
│    }                                                                     │
│  }                                                                       │
│                                                                          │
│  published_content: {...}             ← Usado no STOREFRONT PÚBLICO     │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Padrão de Settings por Página

### 2.1 Estrutura de Query para Buscar Settings

```typescript
// Padrão: Buscar settings do template PUBLICADO
const { data: pageSettings } = useQuery({
  queryKey: ['[page]-settings-published', tenantSlug, isPreviewMode],
  queryFn: async () => {
    // 1. Buscar tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('slug', tenantSlug)
      .single();
    
    if (!tenant) return null;
    
    // 2. Buscar template publicado
    const { data: storeSettings } = await supabase
      .from('store_settings')
      .select('published_template_id')
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    
    const templateSetId = storeSettings?.published_template_id;
    
    // 3. Se não tem template, fallback para legacy (storefront_page_templates)
    if (!templateSetId) {
      const { data } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenant.id)
        .eq('page_type', '[pageType]')
        .maybeSingle();
      
      return data?.page_overrides?.[pageType + 'Settings'] || null;
    }
    
    // 4. Buscar de published_content (ou draft_content se preview)
    const contentField = isPreviewMode ? 'draft_content' : 'published_content';
    const { data: templateSet } = await supabase
      .from('storefront_template_sets')
      .select(contentField)
      .eq('id', templateSetId)
      .single();
    
    const content = templateSet?.[contentField];
    return content?.themeSettings?.pageSettings?.[pageType] || null;
  },
  enabled: !!tenantSlug,
});
```

### 2.2 Injeção de Settings no Context

```typescript
// Na página de storefront (ex: StorefrontCategory.tsx)
const context: BlockRenderContext = {
  tenantSlug,
  isPreview: isPreviewMode,
  category: categoryData,
  products: productsData,
  // Settings específicos da página
  categorySettings: {
    showRatings: pageSettings?.showRatings ?? true,
    showBadges: pageSettings?.showBadges ?? true,
    showAddToCartButton: pageSettings?.showAddToCartButton ?? true,
    quickBuyEnabled: pageSettings?.quickBuyEnabled ?? false,
    buyNowButtonText: pageSettings?.buyNowButtonText || 'Comprar agora',
    customButtonEnabled: pageSettings?.customButtonEnabled ?? false,
    customButtonText: pageSettings?.customButtonText || '',
    customButtonColor: pageSettings?.customButtonColor || '',
    customButtonLink: pageSettings?.customButtonLink || '',
  },
  // Theme settings globais
  themeSettings: {
    miniCartEnabled: themeSettings?.miniCartEnabled !== false,
    openMiniCartOnAdd: themeSettings?.openMiniCartOnAdd !== false,
  },
  settings: { /* store settings */ },
  headerMenu: [...],
  footerMenu: [...],
};
```

---

## 3. Definição de Settings por Página

### 3.1 Categoria (CategorySettings)

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
| `showCategoryName` | boolean | true | Exibe nome da categoria no banner |
| `showBanner` | boolean | true | Exibe banner da categoria |

### 3.2 Produto (ProductSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showGallery` | boolean | true | Exibe galeria de imagens secundárias |
| `showDescription` | boolean | true | Exibe descrição curta |
| `showVariants` | boolean | true | Exibe seletor de variantes |
| `showStock` | boolean | true | Exibe quantidade em estoque |
| `showRelatedProducts` | boolean | true | Exibe grid de produtos relacionados |
| `showBuyTogether` | boolean | true | Exibe seção "Compre Junto" |
| `showReviews` | boolean | true | Exibe avaliações e formulário |
| `showAddToCartButton` | boolean | true | Exibe botão adicionar ao carrinho |
| `showWhatsAppButton` | boolean | true | Exibe botão comprar pelo WhatsApp |
| `buyNowButtonText` | string | "Comprar agora" | Texto do botão principal |
| `openMiniCartOnAdd` | boolean | true | Abre mini-cart ao adicionar |

### 3.3 Carrinho (CartSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showCrossSell` | boolean | true | Exibe produtos sugeridos |
| `showCouponField` | boolean | true | Exibe campo de cupom |
| `showTrustBadges` | boolean | true | Exibe selos de confiança |
| `showShippingCalculator` | boolean | true | Exibe calculadora de frete |

### 3.4 Checkout (CheckoutSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderSummary` | boolean | true | Exibe resumo do pedido |
| `showCouponField` | boolean | true | Exibe campo de cupom |
| `allowGuestCheckout` | boolean | true | Permite checkout sem login |

### 3.5 Obrigado (ThankYouSettings)

| Setting | Tipo | Default | Descrição |
|---------|------|---------|-----------|
| `showOrderDetails` | boolean | true | Exibe detalhes do pedido |
| `showRelatedProducts` | boolean | true | Exibe produtos relacionados |
| `showTrackingInfo` | boolean | true | Exibe info de rastreio |

---

## 4. Padrão de Integração com Carrinho

### 4.1 Imports Necessários

```typescript
import { useCart } from '@/contexts/CartContext';
import { MiniCartDrawer } from '@/components/storefront/MiniCartDrawer';
import { getPublicCheckoutUrl } from '@/lib/publicUrls';
import { toast } from 'sonner';
```

### 4.2 Setup no Componente

```typescript
export function PageLayoutBlock({ context, isEditing }: Props) {
  const { addItem } = useCart();
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // Ler settings do context
  const settings = (context as any)?.pageSettings || {};
  const themeSettings = (context as any)?.themeSettings || {};
  
  const miniCartEnabled = themeSettings.miniCartEnabled !== false;
  const openMiniCartOnAdd = themeSettings.openMiniCartOnAdd !== false;
```

### 4.3 Handler de Adicionar ao Carrinho

```typescript
const handleAddToCart = (product: Product, e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  // Montar item do carrinho
  const cartItem = {
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity: 1,
    imageUrl: product.images?.[0]?.url,
    sku: product.sku || product.slug,
  };
  
  // Adicionar ao carrinho
  addItem(cartItem, (addedItem) => {
    // Callback após adicionar
    if (miniCartEnabled && openMiniCartOnAdd) {
      // Abre o mini-cart lateral
      setMiniCartOpen(true);
    } else {
      // Feedback visual: botão muda para "Adicionado"
      setAddedProducts(prev => new Set(prev).add(product.id));
      toast.success('Produto adicionado ao carrinho');
      
      // Reset após 2 segundos
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

### 4.4 Handler de Compra Rápida

```typescript
const handleQuickBuy = (product: Product, e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  const cartItem = {
    productId: product.id,
    name: product.name,
    price: product.price,
    quantity: 1,
    imageUrl: product.images?.[0]?.url,
    sku: product.sku || product.slug,
  };
  
  addItem(cartItem, () => {
    // Redireciona para checkout
    const checkoutUrl = getPublicCheckoutUrl(tenantSlug);
    window.location.href = checkoutUrl;
  });
};
```

### 4.5 Renderização do Botão

```typescript
{/* Botão Adicionar ao Carrinho */}
{showAddToCartButton && (
  <Button
    variant="outline"
    size="sm"
    onClick={(e) => handleAddToCart(product, e)}
    disabled={addedProducts.has(product.id)}
    className="w-full"
  >
    {addedProducts.has(product.id) ? (
      <>
        <Check className="h-4 w-4 mr-1" />
        Adicionado
      </>
    ) : (
      <>
        <ShoppingCart className="h-4 w-4 mr-1" />
        Adicionar
      </>
    )}
  </Button>
)}

{/* Botão Comprar Agora / Compra Rápida */}
<Button
  size="sm"
  className="w-full"
  onClick={(e) => {
    if (quickBuyEnabled) {
      handleQuickBuy(product, e);
    } else {
      // Navega para página do produto
      window.location.href = `/${tenantSlug}/produto/${product.slug}`;
    }
  }}
>
  {buyNowButtonText}
</Button>
```

### 4.6 MiniCartDrawer no Final do Componente

```tsx
{/* Mini Cart Drawer */}
{miniCartEnabled && (
  <MiniCartDrawer
    open={miniCartOpen}
    onOpenChange={setMiniCartOpen}
    tenantSlug={tenantSlug}
  />
)}
```

---

## 5. Padrão de Comportamento: Builder vs Público

### 5.1 Diferenças de Comportamento

| Aspecto | Builder (isEditing=true) | Público (isEditing=false) |
|---------|--------------------------|---------------------------|
| **Dados** | Produtos de exemplo ou amostra aleatória | Dados reais do banco |
| **Cliques** | Bloqueados ou modo interativo | Funcionais |
| **Carrinho** | Simulado ou desabilitado | useCart real |
| **Links** | Não navegam | Navegam normalmente |
| **Settings** | draft_content | published_content |

### 5.2 Guard de Edição

```typescript
// No componente de bloco
if (isEditing && !isInteractMode) {
  // Renderiza versão estática/preview
  return <PreviewVersion {...props} />;
}

// Renderiza versão funcional
return <FunctionalVersion {...props} />;
```

### 5.3 Dados de Exemplo no Builder

```typescript
// Quando não há dados reais
const displayProducts = useMemo(() => {
  if (realProducts?.length > 0) {
    return realProducts;
  }
  
  if (isEditing) {
    // Retorna produtos de exemplo para visualização
    return generateExampleProducts(limit);
  }
  
  return [];
}, [realProducts, isEditing, limit]);
```

---

## 6. Checklist de Implementação por Página

### ✅ Categoria (IMPLEMENTADO)

- [x] Settings via context (categorySettings)
- [x] useCart integrado
- [x] MiniCartDrawer
- [x] Feedback "Adicionado"
- [x] Compra rápida → checkout
- [x] Botão personalizado
- [x] Selos/badges
- [x] Avaliações

### 🔲 Produto (A IMPLEMENTAR)

- [ ] Settings via context (productSettings)
- [ ] useCart integrado
- [ ] MiniCartDrawer
- [ ] Feedback "Adicionado"
- [ ] Compra rápida → checkout
- [ ] WhatsApp button
- [ ] Galeria
- [ ] Variantes
- [ ] Compre Junto
- [ ] Produtos relacionados

### 🔲 Carrinho (A IMPLEMENTAR)

- [ ] Settings via context (cartSettings)
- [ ] Cross-sell
- [ ] Cupom
- [ ] Trust badges
- [ ] Calculadora de frete

### 🔲 Checkout (A IMPLEMENTAR)

- [ ] Settings via context (checkoutSettings)
- [ ] Resumo do pedido
- [ ] Guest checkout

### 🔲 Obrigado (A IMPLEMENTAR)

- [ ] Settings via context (thankYouSettings)
- [ ] Detalhes do pedido
- [ ] Produtos relacionados

---

## 7. Arquivos Relacionados

| Arquivo | Propósito |
|---------|-----------|
| `src/pages/storefront/Storefront*.tsx` | Páginas públicas - buscam dados e settings |
| `src/components/storefront/PublicTemplateRenderer.tsx` | Renderizador de template |
| `src/components/builder/BlockRenderer.tsx` | Mapeia blocos para componentes |
| `src/components/builder/blocks/*Layout.tsx` | Componentes de layout por página |
| `src/contexts/CartContext.tsx` | Context do carrinho |
| `src/lib/publicUrls.ts` | URLs públicas (checkout, produto, etc) |
| `src/hooks/usePageSettings.ts` | Hook para buscar settings |
| `docs/REGRAS.md` | Regras funcionais por página |

---

## 8. Regras Críticas

1. **NUNCA** fazer queries de settings dentro dos blocos - sempre receber via context
2. **SEMPRE** usar `published_content` no público e `draft_content` no builder
3. **SEMPRE** ter fallback para `storefront_page_templates` (legacy)
4. **NUNCA** duplicar lógica entre páginas - criar hooks/utils compartilhados
5. **SEMPRE** seguir os defaults definidos neste documento
6. **SEMPRE** consultar `docs/REGRAS.md` para regras funcionais específicas
