// =============================================
// FEATURED PRODUCTS BLOCK - Manual product selection only
// USA ProductCard compartilhado para respeitar categorySettings do tema
// =============================================

import { useMemo } from 'react';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useBuilderProducts } from '@/hooks/useBuilderProducts';
import { useProductRatings } from '@/hooks/useProductRating';
import { ProductCard, formatPrice } from './shared/ProductCard';
import type { CategorySettings } from '@/hooks/usePageSettings';

interface FeaturedProductsBlockProps {
  title?: string;
  productIds?: string[] | string; // Array (new) or string (legacy)
  limit?: number;
  columns?: number;
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
  columns = 4,
  showPrice = true,
  showButton = true,
  buttonText = 'Ver produto',
  context,
  isEditing = false,
}: FeaturedProductsBlockProps) {
  const { tenantSlug } = context;

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

  // Get product IDs for batch rating fetch
  const productIdsForRating = useMemo(() => products.map(p => p.id), [products]);
  const { data: ratingsMap } = useProductRatings(productIdsForRating);

  const gridCols = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
    6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
  }[columns] || 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4';

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
          return (
            <ProductCard
              key={product.id}
              product={product}
              tenantSlug={tenantSlug}
              isEditing={isEditing}
              settings={categorySettings}
              rating={rating}
              variant="compact"
            />
          );
        })}
      </div>
    </div>
  );
}
