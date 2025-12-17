// =============================================
// PRODUCT GRID BLOCK - Renders real products
// =============================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getPublicProductUrl } from '@/lib/publicUrls';
import { useProductRatings } from '@/hooks/useProductRating';
import { RatingSummary } from '@/components/storefront/RatingSummary';

interface ProductGridBlockProps {
  source?: 'all' | 'featured' | 'category';
  categoryId?: string;
  limit?: number;
  columns?: number;
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
  columns = 4,
  showPrice = true,
  showButton = true,
  buttonText = 'Ver produto',
  context,
  isEditing = false,
}: ProductGridBlockProps) {
  const { tenantSlug, viewport } = context;
  
  // Determine if mobile based on viewport context (for builder) or default to responsive CSS
  const isMobileViewport = viewport === 'mobile';
  const isTabletViewport = viewport === 'tablet';

  // Resolve category ID - use context.category.id if source is 'category' and categoryId is a placeholder
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
        // Need to join with product_categories
        const { data: productCategories } = await supabase
          .from('product_categories')
          .select('product_id, position')
          .eq('category_id', effectiveCategoryId)
          .order('position', { ascending: true });

        if (!productCategories?.length) return [];
        
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
        
        // Sort by position from product_categories
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

  // Get product IDs for batch rating fetch
  const productIdsForRating = useMemo(() => (products || []).map(p => p.id), [products]);
  const { data: ratingsMap } = useProductRatings(productIdsForRating);

  const getProductImage = (product: Product) => {
    const primary = product.product_images?.find(img => img.is_primary);
    return primary?.url || product.product_images?.[0]?.url || '/placeholder.svg';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  // Compute grid columns based on viewport context or responsive fallback
  const getGridCols = () => {
    // If viewport is set (in builder), use explicit values
    if (viewport) {
      if (isMobileViewport) {
        // Mobile: 2 columns max, 1 for small column counts
        return columns <= 2 ? 'grid-cols-1' : 'grid-cols-2';
      }
      if (isTabletViewport) {
        // Tablet: intermediate
        return columns <= 2 ? 'grid-cols-2' : 'grid-cols-3';
      }
      // Desktop: use configured columns
      return {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-3',
        4: 'grid-cols-4',
        5: 'grid-cols-5',
        6: 'grid-cols-6',
      }[columns] || 'grid-cols-4';
    }
    
    // Fallback to responsive CSS classes for public storefront
    return {
      1: 'grid-cols-1',
      2: 'grid-cols-2 sm:grid-cols-2',
      3: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-3',
      4: 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4',
      5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
      6: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6',
    }[columns] || 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-4';
  };

  const gridCols = getGridCols();

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

  if (!products?.length) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="text-sm">Nenhum produto encontrado</p>
        {isEditing && (
          <p className="text-xs mt-1">Adicione produtos na seção de Produtos do admin</p>
        )}
      </div>
    );
  }

  return (
    <div className={cn('grid gap-4 p-4', gridCols)}>
      {products.map((product) => {
        const rating = ratingsMap?.get(product.id);
        return (
          <a
            key={product.id}
            href={isEditing ? undefined : getPublicProductUrl(tenantSlug, product.slug) || undefined}
            className={cn(
              'group block bg-card rounded-lg overflow-hidden border transition-shadow hover:shadow-md',
              isEditing && 'pointer-events-none'
            )}
          >
            <div className="aspect-square overflow-hidden bg-muted">
              <img
                src={getProductImage(product)}
                alt={product.name}
                className="w-full h-full object-cover transition-transform group-hover:scale-105"
              />
            </div>
            <div className="p-3">
              {/* Rating - above product name */}
              {rating && rating.count > 0 && (
                <RatingSummary
                  average={rating.average}
                  count={rating.count}
                  variant="card"
                  className="mb-1"
                />
              )}
              <h3 className="font-medium text-sm line-clamp-2 text-foreground">
                {product.name}
              </h3>
              {showPrice && (
                <div className="mt-1 flex items-center gap-2">
                  {product.compare_at_price && product.compare_at_price > product.price && (
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
                <button className="mt-2 w-full py-1.5 px-3 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors">
                  {buttonText}
                </button>
              )}
            </div>
          </a>
        );
      })}
    </div>
  );
}
