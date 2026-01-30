// =============================================
// FEATURED PRODUCTS BLOCK - Manual product selection only
// USA ProductCard compartilhado para respeitar categorySettings do tema
// =============================================

import { useMemo, useState, useCallback } from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useBuilderProducts } from '@/hooks/useBuilderProducts';
import { useProductRatings } from '@/hooks/useProductRating';
import { useProductBadgesForProducts } from '@/hooks/useProductBadges';
import { ProductCard, formatPrice, ProductCardProduct } from './shared/ProductCard';
import { useCart } from '@/contexts/CartContext';
import { getPublicCheckoutUrl } from '@/lib/publicUrls';
import { toast } from 'sonner';
import type { CategorySettings } from '@/hooks/usePageSettings';

interface FeaturedProductsBlockProps {
  title?: string;
  productIds?: string[] | string; // Array (new) or string (legacy)
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

export function FeaturedProductsBlock({
  title,
  productIds = [],
  limit = 4,
  columns, // Legacy
  columnsDesktop = 4,
  columnsMobile = 2,
  showPrice = true,
  showButton = true,
  buttonText = 'Ver produto',
  context,
  isEditing = false,
}: FeaturedProductsBlockProps) {
  const { tenantSlug, viewport } = context;

  // Get categorySettings from context (passed from VisualBuilder)
  const categorySettings: Partial<CategorySettings> = (context as any)?.categorySettings || {};

  // Parse productIds: support both array (new) and string (legacy)
  const parsedProductIds = Array.isArray(productIds)
    ? productIds.filter(Boolean)
    : typeof productIds === 'string' && (productIds as string).trim()
      ? (productIds as string).split(/[,\n]/).map(id => id.trim()).filter(Boolean)
      : [];

  const hasProducts = parsedProductIds.length > 0;

  const { products, isLoading } = useBuilderProducts({
    tenantSlug,
    source: hasProducts ? 'all' : 'newest',
    productIds: hasProducts ? parsedProductIds : undefined,
    limit: hasProducts ? parsedProductIds.length : limit,
  });

  // Get product IDs for batch rating and badge fetch
  const productIdsForRating = useMemo(() => products.map(p => p.id), [products]);
  const { data: ratingsMap } = useProductRatings(productIdsForRating);
  const { data: badgesMap } = useProductBadgesForProducts(productIdsForRating);

  // Cart functionality
  const { addItem: addToCart, items: cartItems } = useCart();
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // Check if product is in cart
  const isProductInCart = useCallback((productId: string) => {
    return cartItems.some(item => item.product_id === productId) || addedProducts.has(productId);
  }, [cartItems, addedProducts]);

  // Handle add to cart
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
  }, [addToCart, isEditing]);

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
  
  // Determine if we're in mobile viewport (from builder context)
  const isMobileViewport = viewport === 'mobile';
  const isTabletViewport = viewport === 'tablet';
  
  // Build responsive grid classes
  const getGridClass = () => {
    // In builder with explicit viewport, use that
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
  };
  
  const gridCols = getGridClass();

  if (isLoading) {
    return (
      <div className="py-8 px-4">
        {title && <Skeleton className="h-8 w-48 mb-6" />}
        <div className={cn('grid gap-4', gridCols)}>
          {Array.from({ length: limit }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show demo products when editing and no products configured
  if (!hasProducts || !products?.length) {
    if (isEditing) {
      const demoProducts = Array.from({ length: limit }, (_, i) => ({
        id: `demo-${i}`,
        name: `Produto Exemplo ${i + 1}`,
        price: 99.90 + (i * 20),
        compare_at_price: i % 2 === 0 ? 129.90 + (i * 20) : null,
      }));

      return (
        <div className="py-8 px-4">
          {title && (
            <h2 className="text-2xl font-bold mb-6 text-foreground">{title}</h2>
          )}
          <div className={cn('grid gap-4', gridCols)}>
            {demoProducts.map((product) => (
              <div
                key={product.id}
                className="group block bg-card rounded-lg overflow-hidden border pointer-events-none"
              >
                <div className="aspect-square overflow-hidden bg-muted flex items-center justify-center">
                  <span className="text-4xl text-muted-foreground/30">📦</span>
                </div>
                <div className="p-3">
                  <h3 className="font-medium text-sm line-clamp-2 text-foreground">
                    {product.name}
                  </h3>
                  {showPrice && (
                    <div className="mt-1 flex items-center gap-2">
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
                    <button className="mt-2 w-full py-1.5 px-3 text-xs bg-primary text-primary-foreground rounded-md">
                      {buttonText}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-center text-muted-foreground mt-4">
            [Exemplo demonstrativo] Selecione produtos reais no painel lateral
          </p>
        </div>
      );
    }
    return null;
  }

  return (
    <div className="py-8 px-4">
      {title && (
        <h2 className="text-2xl font-bold mb-6 text-foreground">{title}</h2>
      )}

      <div className={cn('grid gap-4', gridCols)}>
        {products.map((product) => {
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
    </div>
  );
}
