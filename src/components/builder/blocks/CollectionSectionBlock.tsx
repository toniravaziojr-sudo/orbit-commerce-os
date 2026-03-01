// =============================================
// COLLECTION SECTION BLOCK - Category/Collection products with "Ver todos"
// USA ProductCard compartilhado para respeitar categorySettings do tema
// =============================================

import { useBuilderProducts, formatProductPrice } from '@/hooks/useBuilderProducts';
import { useProductRatings } from '@/hooks/useProductRating';
import { useProductBadgesForProducts } from '@/hooks/useProductBadges';
import { BlockRenderContext } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { ChevronRight, Loader2, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPublicCategoryUrl, getPublicCheckoutUrl } from '@/lib/publicUrls';
import { useIsMobile } from '@/hooks/use-mobile';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useMemo, useState } from 'react';
import { ProductCard, formatPrice, ProductCardProduct } from './shared/ProductCard';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import type { CategorySettings } from '@/hooks/usePageSettings';

interface CollectionSectionBlockProps {
  title?: string;
  categoryId?: string;
  categorySlug?: string;
  displayStyle?: 'grid' | 'carousel';
  limit?: number;
  mobileColumns?: number;
  showViewAll?: boolean;
  showPrice?: boolean;
  showButton?: boolean;
  buttonText?: string;
  context?: BlockRenderContext;
  isEditing?: boolean;
}

export function CollectionSectionBlock({
  title = 'Nome da coleção',
  categoryId,
  categorySlug,
  displayStyle = 'grid',
  limit = 8,
  mobileColumns = 2,
  showViewAll = true,
  showPrice = true,
  showButton = false,
  buttonText = 'Ver produto',
  context,
  isEditing = false,
}: CollectionSectionBlockProps) {
  // Get categorySettings from context (passed from VisualBuilder)
  const categorySettings: Partial<CategorySettings> = (context as any)?.categorySettings || {};
  
  // Get tenantId directly from context if available (more reliable)
  const tenantIdFromContext = (context as any)?.settings?.tenant_id;

  // Hook must be called unconditionally (Rules of Hooks)
  const deviceIsMobile = useIsMobile();
  const isMobile = context?.viewport === 'mobile' || (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && deviceIsMobile);
  
  const { products, isLoading, error } = useBuilderProducts({
    tenantSlug: context?.tenantSlug || '',
    tenantId: tenantIdFromContext,
    source: categoryId ? 'category' : 'newest',
    categoryId,
    limit,
  });

  // Get product IDs for batch rating and badge fetch
  const productIds = useMemo(() => products.map(p => p.id), [products]);
  const { data: ratingsMap } = useProductRatings(productIds);
  const { data: badgesMap } = useProductBadgesForProducts(productIds);

  // Cart functionality
  const { addItem: addToCart, items: cartItems } = useCart();
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // Check if product was just added (temporary visual feedback only)
  const isProductJustAdded = useCallback((productId: string) => {
    return addedProducts.has(productId);
  }, [addedProducts]);

  const handleAddToCart = useCallback((e: React.MouseEvent, product: ProductCardProduct) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) return;
    const primaryImage = product.product_images?.find(img => img.is_primary)?.url || product.product_images?.[0]?.url;
    addToCart({ product_id: product.id, name: product.name, sku: product.slug, price: product.price, quantity: 1, image_url: primaryImage });
    setAddedProducts(prev => new Set(prev).add(product.id));
    toast.success('Produto adicionado ao carrinho!');
  }, [addToCart, isEditing]);

  const handleQuickBuy = useCallback((e: React.MouseEvent, product: ProductCardProduct) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) return;
    const primaryImage = product.product_images?.find(img => img.is_primary)?.url || product.product_images?.[0]?.url;
    addToCart({ product_id: product.id, name: product.name, sku: product.slug, price: product.price, quantity: 1, image_url: primaryImage });
    const checkoutUrl = getPublicCheckoutUrl(context?.tenantSlug || '');
    window.location.href = checkoutUrl;
  }, [addToCart, context?.tenantSlug, isEditing]);

  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: 'start',
    containScroll: 'trimSnaps',
    slidesToScroll: isMobile ? 2 : 4,
  });

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  // View all URL
  const viewAllUrl = categorySlug 
    ? getPublicCategoryUrl(context?.tenantSlug || '', categorySlug)
    : '#';

  if (isLoading) {
    return (
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </div>
    );
  }

  // Show demo products when editing and no products found
  if (products.length === 0) {
    if (isEditing) {
      const demoProducts = Array.from({ length: limit }, (_, i) => ({
        id: `demo-${i}`,
        name: `Produto da Coleção ${i + 1}`,
        price: 79.90 + (i * 20),
        compare_at_price: i % 2 === 0 ? 99.90 + (i * 20) : null,
      }));

      return (
        <div className="py-8">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex items-center gap-4 mb-6">
              <h2 className="text-2xl font-bold">{title}</h2>
              {showViewAll && (
                <span className="text-muted-foreground flex items-center gap-1">
                  Ver todos <ChevronRight className="h-4 w-4" />
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {demoProducts.map((product) => (
                <div key={product.id} className="group pointer-events-none">
                  <div className="aspect-square bg-muted/30 rounded-lg overflow-hidden mb-3 flex items-center justify-center">
                    <ImageIcon className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <h3 className="font-medium text-sm mb-1 text-muted-foreground">{product.name}</h3>
                  {showPrice && (
                    <div className="flex items-center gap-2">
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
                </div>
              ))}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-4">
              [Exemplo demonstrativo] Selecione uma categoria real no painel lateral
            </p>
          </div>
        </div>
      );
    }
    return null;
  }

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold">{title}</h2>
          {showViewAll && categorySlug && !isEditing && (
            <Link 
              to={viewAllUrl}
              className="text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
            >
              Ver todos <ChevronRight className="h-4 w-4" />
            </Link>
          )}
          {showViewAll && categorySlug && isEditing && (
            <span className="text-muted-foreground flex items-center gap-1 cursor-default">
              Ver todos <ChevronRight className="h-4 w-4" />
            </span>
          )}
        </div>

        {/* Products */}
        {displayStyle === 'carousel' ? (
          <div className="relative">
            <div className="overflow-hidden" ref={emblaRef}>
              <div className="flex gap-4">
                {products.map((product) => {
                  const rating = ratingsMap?.get(product.id);
                  const badges = badgesMap?.get(product.id);
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'flex-shrink-0',
                        isMobile ? 'w-[calc(50%-8px)]' : 'w-[calc(25%-12px)]'
                      )}
                    >
                      <ProductCard
                        product={product}
                        tenantSlug={context?.tenantSlug || ''}
                        isEditing={isEditing}
                        settings={categorySettings}
                        rating={rating}
                        badges={badges}
                        isAddedToCart={isProductJustAdded(product.id)}
                        onAddToCart={handleAddToCart}
                        onQuickBuy={handleQuickBuy}
                        variant="compact"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
            {/* Carousel Navigation */}
            {products.length > (isMobile ? 2 : 4) && (
              <>
                <button
                  onClick={scrollPrev}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 p-2 rounded-full bg-background shadow-lg hover:bg-muted transition-colors z-10"
                >
                  <ChevronRight className="h-5 w-5 rotate-180" />
                </button>
                <button
                  onClick={scrollNext}
                  className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 p-2 rounded-full bg-background shadow-lg hover:bg-muted transition-colors z-10"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
          </div>
        ) : (
          <div className={cn(
            'grid gap-2 sm:gap-4',
            isMobile 
              ? `grid-cols-${mobileColumns}` 
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          )}
          style={isMobile ? { gridTemplateColumns: `repeat(${mobileColumns}, 1fr)` } : undefined}
          >
            {products.map((product) => {
              const rating = ratingsMap?.get(product.id);
              const badges = badgesMap?.get(product.id);
              return (
                <ProductCard
                  key={product.id}
                  product={product}
                  tenantSlug={context?.tenantSlug || ''}
                  isEditing={isEditing}
                  settings={categorySettings}
                  rating={rating}
                  badges={badges}
                  isAddedToCart={isProductJustAdded(product.id)}
                  onAddToCart={handleAddToCart}
                  onQuickBuy={handleQuickBuy}
                  variant="compact"
                />
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
