// =============================================
// BANNER + PRODUCTS BLOCK - Hybrid banner with products combo
// =============================================

import { useBuilderProducts, formatProductPrice, getProductImage } from '@/hooks/useBuilderProducts';
import { BlockRenderContext } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { Loader2, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';

interface BannerProductsBlockProps {
  title?: string;
  description?: string;
  imageDesktop?: string;
  imageMobile?: string;
  source?: 'manual' | 'category';
  productIds?: string[] | string;
  categoryId?: string;
  limit?: number;
  showCta?: boolean;
  ctaText?: string;
  ctaUrl?: string;
  context?: BlockRenderContext;
  isEditing?: boolean;
}

export function BannerProductsBlock({
  title = 'Oferta Especial',
  description = '',
  imageDesktop,
  imageMobile,
  source = 'manual',
  productIds,
  categoryId,
  limit = 4,
  showCta = false,
  ctaText = 'Ver mais',
  ctaUrl = '#',
  context,
  isEditing = false,
}: BannerProductsBlockProps) {
  const isMobileDevice = useIsMobile();
  
  const isMobile = context?.viewport === 'mobile' || 
    (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && isMobileDevice);
  const imageUrl = isMobile && imageMobile ? imageMobile : imageDesktop;

  // Parse product IDs
  const productIdArray = Array.isArray(productIds)
    ? productIds.filter(Boolean)
    : typeof productIds === 'string' && productIds.trim()
      ? productIds.split(/[\n,]/).map(id => id.trim()).filter(Boolean)
      : [];

  const validCategoryId = categoryId && categoryId.trim() !== '';

  const effectiveSource = source === 'manual' && productIdArray.length > 0
    ? 'all'
    : source === 'category' && validCategoryId
      ? 'category'
      : 'newest';

  const { products, isLoading } = useBuilderProducts({
    tenantSlug: context?.tenantSlug || '',
    source: effectiveSource,
    categoryId: source === 'category' && validCategoryId ? categoryId : undefined,
    productIds: source === 'manual' && productIdArray.length > 0 ? productIdArray : undefined,
    limit,
  });

  const showEmptyState = (source === 'manual' && productIdArray.length === 0) ||
    (source === 'category' && !validCategoryId);

  // Get actual products to display
  const displayProducts = products.slice(0, limit);
  const productCount = displayProducts.length;

  // Determine grid class based on product count for proper filling
  const getProductGridClass = () => {
    if (productCount === 1) return 'grid-cols-1 grid-rows-1';
    if (productCount === 2) return 'grid-cols-1 grid-rows-2';
    if (productCount === 3) return 'grid-cols-2 grid-rows-2';
    return 'grid-cols-2 grid-rows-2'; // 4+
  };

  if (isLoading) {
    return (
      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-bold mb-2">{title}</h2>
          {description && (
            <p className="text-muted-foreground">{description}</p>
          )}
        </div>

        {/* Content Grid */}
        <div className={cn(
          'grid gap-4',
          isMobile ? 'grid-cols-1' : 'grid-cols-2'
        )}>
          {/* Banner - aspect ratio drives the height */}
          <div className="aspect-[4/5] bg-muted/30 rounded-lg overflow-hidden">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Adicione uma imagem</p>
                </div>
              </div>
            )}
          </div>

          {/* Products Grid - matches banner height */}
          <div className={cn(
            'grid gap-3',
            isMobile ? 'grid-cols-2' : getProductGridClass(),
            !isMobile && 'aspect-[4/5]' // Match banner aspect ratio on desktop
          )}>
            {showEmptyState ? (
              <div className="col-span-2 row-span-2 flex items-center justify-center">
                <p className="text-muted-foreground text-sm text-center">
                  {source === 'manual' 
                    ? 'Selecione produtos nas propriedades do bloco'
                    : 'Selecione uma categoria nas propriedades do bloco'}
                </p>
              </div>
            ) : productCount > 0 ? (
              displayProducts.map((product, index) => {
                const productImageUrl = getProductImage(product);
                const productUrl = `/store/${context?.tenantSlug}/product/${product.slug}`;
                
                // For 3 products, make the 3rd span full width
                const isLastOfThree = productCount === 3 && index === 2;
                
                return (
                  <div 
                    key={product.id} 
                    className={cn(
                      'group flex flex-col bg-card rounded-lg overflow-hidden border',
                      isLastOfThree && 'col-span-2',
                      // Single product takes all space
                      productCount === 1 && 'row-span-1',
                      // Two products each take half
                      productCount === 2 && 'row-span-1'
                    )}
                  >
                    {/* Product image fills available space */}
                    <div className="flex-1 min-h-0 bg-muted/30 overflow-hidden relative">
                      <img
                        src={productImageUrl}
                        alt={product.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      {/* Discount badge */}
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-xs font-medium px-2 py-1 rounded">
                          -{Math.round((1 - product.price / product.compare_at_price) * 100)}%
                        </span>
                      )}
                    </div>
                    {/* Product info - fixed height */}
                    <div className="p-2 flex-shrink-0">
                      <h3 className="font-medium text-xs line-clamp-1 text-primary hover:underline">
                        {isEditing ? (
                          <span className="cursor-default">{product.name}</span>
                        ) : (
                          <Link to={productUrl}>{product.name}</Link>
                        )}
                      </h3>
                      <div className="flex items-center gap-1 mt-0.5">
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-[10px] text-muted-foreground line-through">
                            {formatProductPrice(product.compare_at_price)}
                          </span>
                        )}
                        <span className="font-semibold text-xs">
                          {formatProductPrice(product.price)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 row-span-2 flex items-center justify-center">
                <p className="text-muted-foreground text-sm">
                  {source === 'category' 
                    ? 'Nenhum produto nesta categoria' 
                    : 'Nenhum produto disponível'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* CTA */}
        {showCta && ctaText && !isEditing && (
          <div className="mt-6 text-center">
            <Link
              to={ctaUrl}
              className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              {ctaText}
            </Link>
          </div>
        )}
        {showCta && ctaText && isEditing && (
          <div className="mt-6 text-center">
            <span className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium cursor-default">
              {ctaText}
            </span>
          </div>
        )}
      </div>
    </section>
  );
}
