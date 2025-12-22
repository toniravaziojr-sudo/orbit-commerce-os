// =============================================
// COLLECTION SECTION BLOCK - Category/Collection products with "Ver todos"
// =============================================

import { useBuilderProducts, formatProductPrice, getProductImage } from '@/hooks/useBuilderProducts';
import { useProductRatings } from '@/hooks/useProductRating';
import { BlockRenderContext } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { ChevronRight, Loader2, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { getPublicCategoryUrl, getPublicProductUrl } from '@/lib/publicUrls';
import { useIsMobile } from '@/hooks/use-mobile';
import useEmblaCarousel from 'embla-carousel-react';
import { useCallback, useMemo } from 'react';
import { RatingSummary } from '@/components/storefront/RatingSummary';

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
  const showRatings = context?.showRatings !== false;
  const isMobile = context?.viewport === 'mobile' || (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && useIsMobile());
  
  const { products, isLoading, error } = useBuilderProducts({
    tenantSlug: context?.tenantSlug || '',
    source: categoryId ? 'category' : 'newest',
    categoryId,
    limit,
  });

  // Get product IDs for batch rating fetch
  const productIds = useMemo(() => products.map(p => p.id), [products]);
  const { data: ratingsMap } = useProductRatings(productIds);

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

  if (products.length === 0) {
    return (
      <div className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold">{title}</h2>
            {showViewAll && (
              <span className="text-muted-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1">
                Ver todos <ChevronRight className="h-4 w-4" />
              </span>
            )}
          </div>
          <div className="text-center py-12 text-muted-foreground">
            <p>Nenhum produto encontrado</p>
          </div>
        </div>
      </div>
    );
  }

  const ProductCard = ({ product }: { product: typeof products[0] }) => {
    const imageUrl = getProductImage(product);
    const productUrl = getPublicProductUrl(context?.tenantSlug || '', product.slug) || '/';
    const rating = ratingsMap?.get(product.id);
    
    return (
      <div className="group">
        <div className="aspect-square bg-muted/30 rounded-lg overflow-hidden mb-3">
          <img
            src={imageUrl}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        {/* Rating - above product name (respects showRatings setting) */}
        {showRatings && rating && rating.count > 0 && (
          <RatingSummary
            average={rating.average}
            count={rating.count}
            variant="card"
            className="mb-1"
          />
        )}
        <h3 className="font-medium text-sm mb-1 line-clamp-2">{product.name}</h3>
      {showPrice && (
        <div className="flex items-center gap-2 mb-2">
          {product.compare_at_price && product.compare_at_price > product.price && (
            <span className="text-xs text-muted-foreground line-through">
              {formatProductPrice(product.compare_at_price)}
            </span>
          )}
          <span className="font-semibold text-primary">
            {formatProductPrice(product.price)}
          </span>
        </div>
      )}
      {showButton && (
        isEditing ? (
          <span className="block w-full text-center py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium cursor-default">
            {buttonText}
          </span>
        ) : (
          <Link
            to={productUrl}
            className="block w-full text-center py-2 px-4 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            {buttonText}
          </Link>
        )
      )}
    </div>
    );
  };

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
                {products.map((product) => (
                  <div
                    key={product.id}
                    className={cn(
                      'flex-shrink-0',
                      isMobile ? 'w-[calc(50%-8px)]' : 'w-[calc(25%-12px)]'
                    )}
                  >
                    <ProductCard product={product} />
                  </div>
                ))}
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
            'grid gap-4',
            isMobile 
              ? `grid-cols-${mobileColumns}` 
              : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
          )}
          style={isMobile ? { gridTemplateColumns: `repeat(${mobileColumns}, 1fr)` } : undefined}
          >
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
