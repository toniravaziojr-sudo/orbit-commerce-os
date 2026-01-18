// =============================================
// PRODUCT CAROUSEL BLOCK - Real products with embla-carousel
// USA ProductCard compartilhado para respeitar categorySettings do tema
// =============================================

import { useMemo, useState, useCallback } from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useBuilderProducts, formatProductPrice, ProductSource } from '@/hooks/useBuilderProducts';
import { useProductRatings } from '@/hooks/useProductRating';
import { useProductBadgesForProducts } from '@/hooks/useProductBadges';
import { ProductCard, formatPrice, ProductCardProduct } from './shared/ProductCard';
import type { CategorySettings } from '@/hooks/usePageSettings';
import { useCart } from '@/contexts/CartContext';
import { getPublicCheckoutUrl } from '@/lib/publicUrls';
import { toast } from 'sonner';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselPrevious,
  CarouselNext,
} from '@/components/ui/carousel';

interface ProductCarouselBlockProps {
  title?: string;
  source?: ProductSource;
  categoryId?: string;
  limit?: number;
  showPrice?: boolean;
  showButton?: boolean;
  buttonText?: string;
  context: BlockRenderContext;
  isEditing?: boolean;
}

export function ProductCarouselBlock({
  title,
  source = 'featured',
  categoryId,
  limit = 8,
  showPrice = true,
  showButton = true,
  buttonText = 'Ver produto',
  context,
  isEditing = false,
}: ProductCarouselBlockProps) {
  const { tenantSlug } = context;

  // Get categorySettings from context (passed from VisualBuilder)
  const categorySettings: Partial<CategorySettings> = (context as any)?.categorySettings || {};

  // Resolve category ID from context if needed
  const effectiveCategoryId =
    source === 'category'
      ? (categoryId && !categoryId.includes('{{') ? categoryId : context?.category?.id)
      : categoryId;

  const { products, isLoading } = useBuilderProducts({
    tenantSlug,
    source,
    categoryId: effectiveCategoryId,
    limit,
  });

  // Get product IDs for batch rating and badge fetch
  const productIds = useMemo(() => products.map(p => p.id), [products]);
  const { data: ratingsMap } = useProductRatings(productIds);
  const { data: badgesMap } = useProductBadgesForProducts(productIds);

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

  // Handle quick buy (redirect to checkout)
  const handleQuickBuy = useCallback((e: React.MouseEvent, product: ProductCardProduct) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isEditing) return;
    
    const primaryImage = product.product_images?.find(img => img.is_primary)?.url || product.product_images?.[0]?.url;
    
    // Add to cart first
    addToCart({
      product_id: product.id,
      name: product.name,
      sku: product.slug,
      price: product.price,
      quantity: 1,
      image_url: primaryImage,
    });
    
    // Redirect to checkout
    const checkoutUrl = getPublicCheckoutUrl(tenantSlug);
    window.location.href = checkoutUrl;
  }, [addToCart, tenantSlug, isEditing]);

  if (isLoading) {
    return (
      <div className="py-8 px-4">
        {title && <Skeleton className="h-8 w-48 mb-6" />}
        <div className="flex gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-48 space-y-3">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Show demo carousel when editing and no products found
  if (!products?.length) {
    if (isEditing) {
      const demoProducts = Array.from({ length: limit }, (_, i) => ({
        id: `demo-${i}`,
        name: `Produto Exemplo ${i + 1}`,
        price: 79.90 + (i * 15),
        compare_at_price: i % 2 === 0 ? 99.90 + (i * 15) : null,
      }));

      return (
        <div className="py-8 px-4">
          {title && (
            <h2 className="text-2xl font-bold mb-6 text-foreground">{title}</h2>
          )}
          <Carousel opts={{ align: 'start' }} className="w-full">
            <CarouselContent className="-ml-2 md:-ml-4">
              {demoProducts.map((product) => (
                <CarouselItem
                  key={product.id}
                  className="pl-2 md:pl-4 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
                >
                  <div className="block bg-card rounded-lg overflow-hidden border h-full pointer-events-none">
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
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="hidden sm:flex -left-4" />
            <CarouselNext className="hidden sm:flex -right-4" />
          </Carousel>
          <p className="text-xs text-center text-muted-foreground mt-4">
            [Exemplo demonstrativo] Adicione produtos reais em Produtos
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
      
      <Carousel
        opts={{
          align: 'start',
          loop: products.length > 4,
        }}
        className="w-full"
      >
        <CarouselContent className="-ml-2 md:-ml-4">
          {products.map((product) => {
            const rating = ratingsMap?.get(product.id);
            const badges = badgesMap?.get(product.id);
            return (
              <CarouselItem
                key={product.id}
                className="pl-2 md:pl-4 basis-1/2 sm:basis-1/3 md:basis-1/4 lg:basis-1/5"
              >
                <ProductCard
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
                  className="h-full"
                />
              </CarouselItem>
            );
          })}
        </CarouselContent>
        <CarouselPrevious className="hidden sm:flex -left-4" />
        <CarouselNext className="hidden sm:flex -right-4" />
      </Carousel>
    </div>
  );
}
