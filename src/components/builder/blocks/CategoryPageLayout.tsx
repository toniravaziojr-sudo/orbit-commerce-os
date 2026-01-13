// =============================================
// CATEGORY PAGE LAYOUT - Layout com sidebar de filtros + grid de produtos
// =============================================

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { BlockRenderContext } from '@/lib/builder/types';
import { CategoryFilters } from './CategoryFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicProductUrl } from '@/lib/publicUrls';
import { useProductRatings } from '@/hooks/useProductRating';
import { RatingSummary } from '@/components/storefront/RatingSummary';


interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  product_images: { url: string; is_primary: boolean }[];
  tags?: string[];
}

interface CategoryPageLayoutProps {
  context: BlockRenderContext;
  limit?: number;
  columns?: number;
  showFilters?: boolean;
  isEditing?: boolean;
}

export function CategoryPageLayout({
  context,
  limit = 24,
  columns = 4,
  showFilters = true,
  isEditing = false,
}: CategoryPageLayoutProps) {
  const { tenantSlug, viewport, category, showRatings = true } = context;
  const isMobile = viewport === 'mobile';
  const categoryId = category?.id;
  const categorySlug = category?.slug;

  // Filter states
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 500]);
  const [sortBy, setSortBy] = useState('relevance');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  // Fetch tenant
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

  // Fetch products
  const { data: products, isLoading } = useQuery({
    queryKey: ['category-products', tenantId, categoryId, limit],
    queryFn: async () => {
      if (!tenantId || !categoryId) return [];

      const { data: productCategories } = await supabase
        .from('product_categories')
        .select('product_id, position')
        .eq('category_id', categoryId)
        .order('position', { ascending: true });

      if (!productCategories?.length) return [];

      const productIds = productCategories.map(pc => pc.product_id);
      const positionMap = new Map(productCategories.map(pc => [pc.product_id, pc.position]));

      const { data: prods, error } = await supabase
        .from('products')
        .select('id, name, slug, price, compare_at_price, product_images(url, is_primary)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .in('id', productIds)
        .limit(limit);

      if (error) throw error;

      return (prods || []).sort((a, b) => {
        const posA = positionMap.get(a.id) ?? 999999;
        const posB = positionMap.get(b.id) ?? 999999;
        return posA - posB;
      }) as Product[];
    },
    enabled: !!tenantId && !!categoryId,
  });

  // Sem fallback interno de demoProducts - empty state se não houver produtos
  const displayProducts = useMemo(() => {
    if (products && products.length > 0) return products;
    return [] as Product[];
  }, [products]);

  // Get product IDs for ratings
  const productIdsForRating = useMemo(() => 
    displayProducts.length === 0 ? [] : displayProducts.map(p => p.id), 
    [displayProducts]
  );
  const { data: ratingsMap } = useProductRatings(productIdsForRating);

  // Extract unique tags from products
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    displayProducts.forEach(p => {
      (p.tags || []).forEach(t => tags.add(t));
    });
    return Array.from(tags);
  }, [displayProducts]);

  // Filter and sort products
  const filteredProducts = useMemo(() => {
    let result = [...displayProducts];

    // Price filter
    result = result.filter(p => p.price >= priceRange[0] && p.price <= priceRange[1]);

    // Tags filter
    if (selectedTags.length > 0) {
      result = result.filter(p => 
        selectedTags.some(tag => (p.tags || []).includes(tag))
      );
    }

    // Sort
    switch (sortBy) {
      case 'price_asc':
        result.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        result.sort((a, b) => b.price - a.price);
        break;
      case 'newest':
        // Keep original order (assumed to be by date)
        break;
      default:
        // relevance - keep original order
        break;
    }

    return result;
  }, [displayProducts, priceRange, selectedTags, sortBy]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const getProductImage = (product: Product) => {
    const primary = product.product_images?.find(img => img.is_primary);
    return primary?.url || product.product_images?.[0]?.url || '/placeholder.svg';
  };

  const getGridCols = () => {
    if (viewport) {
      if (isMobile) return 'grid-cols-2';
      return showFilters ? 'grid-cols-3' : `grid-cols-${Math.min(columns, 4)}`;
    }
    return showFilters 
      ? 'grid-cols-2 lg:grid-cols-3' 
      : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
  };

  if (isLoading) {
    return (
      <div className="px-4 py-6">
        <div className={cn('grid gap-4', getGridCols())}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="aspect-square w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      {/* Mobile filters */}
      {showFilters && isMobile && (
        <CategoryFilters
          priceRange={priceRange}
          maxPrice={500}
          onPriceChange={setPriceRange}
          sortBy={sortBy}
          onSortChange={setSortBy}
          inStockOnly={inStockOnly}
          onStockChange={setInStockOnly}
          tags={availableTags}
          selectedTags={selectedTags}
          onTagsChange={setSelectedTags}
          isMobile={true}
          isEditing={isEditing}
        />
      )}

      <div className="flex gap-6">
        {/* Desktop sidebar filters */}
        {showFilters && !isMobile && (
          <CategoryFilters
            priceRange={priceRange}
            maxPrice={500}
            onPriceChange={setPriceRange}
            sortBy={sortBy}
            onSortChange={setSortBy}
            inStockOnly={inStockOnly}
            onStockChange={setInStockOnly}
            tags={availableTags}
            selectedTags={selectedTags}
            onTagsChange={setSelectedTags}
            isMobile={false}
            isEditing={isEditing}
          />
        )}

        {/* Products grid */}
        <div className="flex-1 relative">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">
                {displayProducts.length === 0 
                  ? 'Nenhum produto nesta categoria.' 
                  : 'Nenhum produto encontrado com os filtros selecionados.'
                }
              </p>
            </div>
          ) : (
            <div className={cn('grid gap-4', getGridCols())}>
              {filteredProducts.map((product) => {
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
                      {showRatings && rating && rating.count > 0 && (
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
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
