// =============================================
// PRODUCT GRID BLOCK - Renders products for Home, Product page "related", etc.
// Este bloco é para vitrines genéricas (Destaques, Relacionados)
// NÃO contém lógica de página de Categoria (que fica em CategoryPageLayout)
// REGRAS.md linha 88: não duplicar lógica
// =============================================

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { BlockRenderContext } from '@/lib/builder/types';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { getPublicProductUrl } from '@/lib/publicUrls';

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

  // Compute grid columns based on viewport
  const gridCols = useMemo(() => {
    if (viewport) {
      if (isMobileViewport) return 'grid-cols-2';
      if (isTabletViewport) return columns <= 3 ? `grid-cols-${Math.min(columns, 3)}` : 'grid-cols-3';
      const desktopCols = Math.min(columns, 4);
      return `grid-cols-${desktopCols}`;
    }
    return {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-2 md:grid-cols-3',
      4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    }[columns] || 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  }, [viewport, isMobileViewport, isTabletViewport, columns]);

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

  if (displayProducts.length === 0) {
    if (isEditing) {
      return (
        <div className="p-4">
          <div className="flex items-center justify-center py-12 border-2 border-dashed border-muted-foreground/30 rounded-lg bg-muted/20">
            <div className="text-center">
              <p className="text-muted-foreground mb-2">Nenhum produto encontrado</p>
              <p className="text-sm text-muted-foreground">Adicione produtos em Produtos → Todos os Produtos</p>
            </div>
          </div>
        </div>
      );
    }
    return (
      <div className="p-4 text-center text-muted-foreground">
        <p>Nenhum produto encontrado.</p>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className={cn('grid gap-3 sm:gap-4', gridCols)}>
        {displayProducts.map((product) => {
          const productUrl = getPublicProductUrl(tenantSlug, product.slug);
          
          return (
            <a
              key={product.id}
              href={isEditing ? undefined : productUrl || undefined}
              className={cn(
                'group block bg-card rounded-lg overflow-hidden border transition-shadow hover:shadow-md relative',
                isEditing && 'pointer-events-none'
              )}
            >
              {/* Product Image */}
              <div className="aspect-square overflow-hidden bg-muted relative">
                <img
                  src={getProductImage(product)}
                  alt={product.name}
                  className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  loading="lazy"
                />
              </div>
              
              <div className="p-2 sm:p-3">
                <h3 className="font-medium text-xs sm:text-sm line-clamp-2 text-foreground">
                  {product.name}
                </h3>
                {showPrice && (
                  <div className="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
                    {product.compare_at_price && product.compare_at_price > product.price && (
                      <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                        {formatPrice(product.compare_at_price)}
                      </span>
                    )}
                    <span className="text-xs sm:text-sm font-semibold text-primary">
                      {formatPrice(product.price)}
                    </span>
                  </div>
                )}
                
                {/* Botão simples de ver produto - sem lógica de categoria */}
                {showButton && (
                  <div className="mt-2">
                    <span className="w-full py-1 sm:py-1.5 px-2 sm:px-3 text-[10px] sm:text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-center block">
                      {buttonText}
                    </span>
                  </div>
                )}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
