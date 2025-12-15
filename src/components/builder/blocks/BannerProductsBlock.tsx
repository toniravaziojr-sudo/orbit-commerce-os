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
  productIds?: string[] | string; // Array (new) or string (legacy)
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
  productIds,
  categoryId,
  limit = 4,
  showCta = false,
  ctaText = 'Ver mais',
  ctaUrl = '#',
  context,
  isEditing = false,
}: BannerProductsBlockProps) {
  // Hook must be called unconditionally (React rules)
  const isMobileDevice = useIsMobile();
  
  // Determine mobile state: editor viewport override takes priority
  const isMobile = context?.viewport === 'mobile' || 
    (context?.viewport !== 'desktop' && context?.viewport !== 'tablet' && isMobileDevice);
  const imageUrl = isMobile && imageMobile ? imageMobile : imageDesktop;

  // Parse product IDs if provided - support both array and string
  const productIdArray = Array.isArray(productIds)
    ? productIds.filter(Boolean)
    : typeof productIds === 'string' && productIds.trim()
      ? productIds.split(/[\n,]/).map(id => id.trim()).filter(Boolean)
      : [];

  const { products, isLoading } = useBuilderProducts({
    tenantSlug: context?.tenantSlug || '',
    source: productIdArray.length > 0 ? 'all' : (categoryId ? 'category' : 'newest'),
    categoryId: productIdArray.length === 0 ? categoryId : undefined,
    productIds: productIdArray.length > 0 ? productIdArray : undefined,
    limit,
  });

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
          {/* Banner */}
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

          {/* Products Grid */}
          <div className={cn(
            'grid gap-4',
            isMobile ? 'grid-cols-2' : 'grid-cols-2'
          )}>
            {products.length > 0 ? (
              products.slice(0, 4).map((product) => {
                const productImageUrl = getProductImage(product);
                const productUrl = `/store/${context?.tenantSlug}/product/${product.slug}`;
                return (
                  <div key={product.id} className="group">
                    <div className="aspect-square bg-muted/30 rounded-lg overflow-hidden mb-2 relative">
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
                    <h3 className="font-medium text-sm line-clamp-2 text-primary hover:underline">
                      {isEditing ? (
                        <span className="cursor-default">{product.name}</span>
                      ) : (
                        <Link to={productUrl}>
                          {product.name}
                        </Link>
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-1">
                      {product.compare_at_price && product.compare_at_price > product.price && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatProductPrice(product.compare_at_price)}
                        </span>
                      )}
                      <span className="font-semibold">
                        {formatProductPrice(product.price)}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="col-span-2 flex items-center justify-center py-8">
                <p className="text-muted-foreground text-sm">
                  {isEditing ? 'Configure a fonte de produtos' : 'Nenhum produto disponível'}
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
