// =============================================
// PRODUCT GRID BLOCK - Renders products for Home, Product page "related", etc.
// Este bloco é para vitrines genéricas (Destaques, Relacionados)
// NÃO contém lógica de página de Categoria (que fica em CategoryPageLayout)
// REGRAS.md linha 88: não duplicar lógica
// USA ProductCard compartilhado para respeitar categorySettings do tema
// Suporta themeSettings.miniCart para comportamento unificado do carrinho
// =============================================

import { useMemo, useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { ProductCard, formatPrice, getProductImage, ProductCardProduct } from './shared/ProductCard';
import { useProductRatings } from '@/hooks/useProductRating';
import { useProductBadgesForProducts } from '@/hooks/useProductBadges';
import { useCart } from '@/contexts/CartContext';
import { getPublicCheckoutUrl } from '@/lib/publicUrls';
import { toast } from 'sonner';
import { MiniCartDrawer } from '@/components/storefront/MiniCartDrawer';
import type { CategorySettings } from '@/hooks/usePageSettings';

interface ProductGridBlockProps {
  source?: 'all' | 'featured' | 'category';
  categoryId?: string;
  limit?: number;
  columns?: number; // Legacy support
  columnsDesktop?: number;
  columnsMobile?: number;
  showPrice?: boolean;
  showButton?: boolean;
  buttonText?: string;
  context: BlockRenderContext;
  isEditing?: boolean;
}

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  is_featured: boolean;
  product_images: { url: string; is_primary: boolean }[];
}

export function ProductGridBlock({
  source = 'all',
  categoryId,
  limit = 8,
  columns, // Legacy
  columnsDesktop = 4,
  columnsMobile = 2,
  showPrice = true,
  showButton = true,
  buttonText = 'Ver produto',
  context,
  isEditing = false,
}: ProductGridBlockProps) {
  const { tenantSlug, viewport } = context;
  
  // Get categorySettings from context (passed from VisualBuilder)
  const categorySettings: Partial<CategorySettings> = (context as any)?.categorySettings || {};

  // Theme settings for mini-cart (unified cartActionType from themeSettings.miniCart)
  const themeSettings = (context as any)?.themeSettings || {};
  const miniCartConfig = themeSettings.miniCart || {};
  const cartActionType = miniCartConfig.cartActionType ?? 'miniCart';
  const miniCartEnabled = cartActionType === 'miniCart';
  
  // Determine if mobile based on viewport context
  const isMobileViewport = viewport === 'mobile';
  const isTabletViewport = viewport === 'tablet';

  // Resolve category ID
  const effectiveCategoryId = 
    source === 'category' 
      ? (categoryId && !categoryId.includes('{{') ? categoryId : context?.category?.id)
      : categoryId;

  // Fetch tenant first to get tenantId
  const { data: tenant } = useQuery({
    queryKey: ['tenant-by-slug', tenantSlug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!tenantSlug,
  });

  const tenantId = tenant?.id;

  // Fetch products based on source
  const { data: products, isLoading } = useQuery({
    queryKey: ['builder-products', tenantId, source, effectiveCategoryId, limit],
    queryFn: async () => {
      if (!tenantId) return [];

      let query = supabase
        .from('products')
        .select('id, name, slug, price, compare_at_price, is_featured, product_images(url, is_primary)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .limit(limit);

      if (source === 'featured') {
        query = query.eq('is_featured', true);
      } else if (source === 'category' && effectiveCategoryId) {
        const { data: productCategories } = await supabase
          .from('product_categories')
          .select('product_id, position')
          .eq('category_id', effectiveCategoryId)
          .order('position', { ascending: true });

        if (!productCategories?.length) {
          const { data: fallbackProducts, error: fallbackError } = await supabase
            .from('products')
            .select('id, name, slug, price, compare_at_price, is_featured, product_images(url, is_primary)')
            .eq('tenant_id', tenantId)
            .eq('status', 'active')
            .limit(limit)
            .order('created_at', { ascending: false });
          
          if (fallbackError) throw fallbackError;
          return (fallbackProducts || []) as Product[];
        }
        
        const productIds = productCategories.map(pc => pc.product_id);
        const positionMap = new Map(productCategories.map(pc => [pc.product_id, pc.position]));
        
        const { data: prods, error } = await supabase
          .from('products')
          .select('id, name, slug, price, compare_at_price, is_featured, product_images(url, is_primary)')
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .in('id', productIds)
          .limit(limit);
        
        if (error) throw error;
        
        const sortedProducts = (prods || []).sort((a, b) => {
          const posA = positionMap.get(a.id) ?? 999999;
          const posB = positionMap.get(b.id) ?? 999999;
          return posA - posB;
        });
        
        return sortedProducts as Product[];
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
    enabled: !!tenantId && (source !== 'category' || !!effectiveCategoryId),
  });

  const displayProducts = useMemo(() => {
    if (products && products.length > 0) return products;
    return [] as Product[];
  }, [products]);

  // Get product IDs for batch rating and badge fetch
  const productIds = useMemo(() => displayProducts.map(p => p.id), [displayProducts]);
  const { data: ratingsMap } = useProductRatings(productIds);
  const { data: badgesMap } = useProductBadgesForProducts(productIds);

  // Cart functionality
  const { addItem: addToCart, items: cartItems } = useCart();
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());
  const [miniCartOpen, setMiniCartOpen] = useState(false);

  // Check if product is in cart
  const isProductInCart = useCallback((productId: string) => {
    return cartItems.some(item => item.product_id === productId) || addedProducts.has(productId);
  }, [cartItems, addedProducts]);

  // Handle add to cart - respects themeSettings.miniCart.cartActionType
  const handleAddToCart = useCallback((e: React.MouseEvent, product: ProductCardProduct) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isEditing) return;
    
    const primaryImage = product.product_images?.find(img => img.is_primary)?.url || product.product_images?.[0]?.url;
    
    addToCart({
      product_id: product.id,
      name: product.name,
      sku: product.slug,
      price: product.price,
      quantity: 1,
      image_url: primaryImage,
    });
    
    setAddedProducts(prev => new Set(prev).add(product.id));
    toast.success('Produto adicionado ao carrinho!');
    
    // If cartActionType is 'miniCart', open the drawer
    if (cartActionType === 'miniCart') {
      setMiniCartOpen(true);
    }
    
    // Remove feedback after 2 seconds
    setTimeout(() => {
      setAddedProducts(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);
  }, [addToCart, isEditing, cartActionType]);

  // Handle quick buy
  const handleQuickBuy = useCallback((e: React.MouseEvent, product: ProductCardProduct) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isEditing) return;
    
    const primaryImage = product.product_images?.find(img => img.is_primary)?.url || product.product_images?.[0]?.url;
    
    addToCart({
      product_id: product.id,
      name: product.name,
      sku: product.slug,
      price: product.price,
      quantity: 1,
      image_url: primaryImage,
    });
    
    const checkoutUrl = getPublicCheckoutUrl(tenantSlug);
    window.location.href = checkoutUrl;
  }, [addToCart, tenantSlug, isEditing]);

  // Effective columns - use legacy "columns" prop if new props not set
  const effectiveDesktopCols = columnsDesktop || columns || 4;
  const effectiveMobileCols = columnsMobile || 2;

  // Compute grid columns based on viewport
  const gridCols = useMemo(() => {
    if (viewport) {
      if (isMobileViewport) {
        return `grid-cols-${Math.min(effectiveMobileCols, 2)}`;
      }
      if (isTabletViewport) {
        return `grid-cols-${Math.min(effectiveDesktopCols, 3)}`;
      }
      return `grid-cols-${effectiveDesktopCols}`;
    }
    
    // For storefront (no explicit viewport), use responsive classes
    const mobileCols = Math.min(effectiveMobileCols, 2);
    const tabletCols = Math.min(effectiveDesktopCols, 3);
    const desktopCols = effectiveDesktopCols;
    
    return `grid-cols-${mobileCols} sm:grid-cols-${tabletCols} lg:grid-cols-${desktopCols}`;
  }, [viewport, isMobileViewport, isTabletViewport, effectiveDesktopCols, effectiveMobileCols]);

  if (isLoading) {
    return (
      <div className={cn('grid gap-4 p-4', gridCols)}>
        {Array.from({ length: limit }).map((_, i) => (
          <div key={i} className="space-y-3">
            <Skeleton className="aspect-square w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ))}
      </div>
    );
  }

  // Show demo products when editing and no products found
  if (displayProducts.length === 0) {
    if (isEditing) {
      const demoProducts = Array.from({ length: limit }, (_, i) => ({
        id: `demo-${i}`,
        name: `Produto Exemplo ${i + 1}`,
        slug: `demo-${i}`,
        price: 89.90 + (i * 25),
        compare_at_price: i % 2 === 0 ? 119.90 + (i * 25) : null,
        product_images: [] as { url: string; is_primary: boolean }[],
      }));

      return (
        <div className="relative">
          <div className={cn('grid gap-3 sm:gap-4', gridCols)}>
            {demoProducts.map((product) => (
              <div
                key={product.id}
                className="group bg-card rounded-lg overflow-hidden border transition-shadow hover:shadow-md pointer-events-none"
              >
                <div className="aspect-square overflow-hidden bg-muted flex items-center justify-center">
                  <span className="text-4xl text-muted-foreground/30">📦</span>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm text-foreground line-clamp-2 mb-1">
                    {product.name}
                  </h3>
                  {showPrice && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {product.compare_at_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.compare_at_price)}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-primary">
                        {formatPrice(product.price)}
                      </span>
                    </div>
                  )}
                  {showButton && (
                    <button className="mt-2 w-full py-1.5 text-xs bg-primary text-primary-foreground rounded-md">
                      {buttonText}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground mt-4">
            [Exemplo demonstrativo] Adicione produtos reais em Produtos
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="relative">
      <div className={cn('grid gap-3 sm:gap-4', gridCols)}>
        {displayProducts.map((product) => {
          const rating = ratingsMap?.get(product.id);
          const badges = badgesMap?.get(product.id);
          
          return (
            <ProductCard
              key={product.id}
              product={product}
              tenantSlug={tenantSlug}
              isEditing={isEditing}
              settings={categorySettings}
              rating={rating}
              badges={badges}
              isAddedToCart={isProductInCart(product.id)}
              onAddToCart={handleAddToCart}
              onQuickBuy={handleQuickBuy}
              variant="compact"
            />
          );
        })}
      </div>
      
      {/* Mini Cart Drawer - only render if miniCartEnabled */}
      {miniCartEnabled && (
        <MiniCartDrawer
          open={miniCartOpen}
          onOpenChange={setMiniCartOpen}
          tenantSlug={tenantSlug}
          isPreview={context?.isPreview}
        />
      )}
    </div>
  );
}
