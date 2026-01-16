// =============================================
// PRODUCT GRID BLOCK - Renders real products
// Conforme docs/REGRAS.md - Funcionalidades da página de Categoria
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
import { useProductBadgesForProduct } from '@/hooks/useProductBadges';
import { ShoppingCart } from 'lucide-react';


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

// Category settings from context
interface CategorySettingsFromContext {
  showRatings?: boolean;
  showBadges?: boolean;
  showAddToCartButton?: boolean;
  quickBuyEnabled?: boolean;
  buyNowButtonText?: string;
  customButtonEnabled?: boolean;
  customButtonText?: string;
  customButtonColor?: string;
  customButtonLink?: string;
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
  
  // Get category settings from context (passed from VisualBuilder/StorefrontCategory)
  const categorySettings: CategorySettingsFromContext = (context as any).categorySettings || {};
  
  const showRatings = categorySettings.showRatings ?? true;
  const showBadges = categorySettings.showBadges ?? true;
  const showAddToCartButton = categorySettings.showAddToCartButton ?? true;
  const quickBuyEnabled = categorySettings.quickBuyEnabled ?? false;
  const buyNowButtonText = categorySettings.buyNowButtonText || 'Comprar agora';
  const customButtonEnabled = categorySettings.customButtonEnabled ?? false;
  const customButtonText = categorySettings.customButtonText || '';
  const customButtonColor = categorySettings.customButtonColor || '';
  const customButtonLink = categorySettings.customButtonLink || '';
  
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

  // Sem fallback interno de demoProducts - empty state se não houver produtos
  const displayProducts = useMemo(() => {
    if (products && products.length > 0) return products;
    return [] as Product[];
  }, [products]);

  // Get product IDs for batch rating fetch - always compute even if loading
  const productIdsForRating = useMemo(() => displayProducts.map(p => p.id), [displayProducts]);
  const { data: ratingsMap } = useProductRatings(productIdsForRating);

  // Compute grid columns based on viewport context or responsive fallback
  // Desktop: 4 cols, Tablet: 3 cols, Mobile: 2 cols (with configurable max)
  const gridCols = useMemo(() => {
    // If viewport is set (in builder), use explicit values
    if (viewport) {
      if (isMobileViewport) {
        // Mobile: always 2 columns
        return 'grid-cols-2';
      }
      if (isTabletViewport) {
        // Tablet: 3 columns max
        return columns <= 3 ? `grid-cols-${Math.min(columns, 3)}` : 'grid-cols-3';
      }
      // Desktop: use configured columns (max 4 for reasonable card sizes)
      const desktopCols = Math.min(columns, 4);
      return `grid-cols-${desktopCols}`;
    }
    
    // Fallback to responsive CSS classes for public storefront
    // Pattern: 2 cols mobile, 3 cols tablet (md), 4 cols desktop (lg)
    return {
      1: 'grid-cols-1',
      2: 'grid-cols-2',
      3: 'grid-cols-2 md:grid-cols-3',
      4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      5: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
      6: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    }[columns] || 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  }, [viewport, isMobileViewport, isTabletViewport, columns]);

  // Helper functions (pure, no hooks)
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

  // === CONDITIONAL RETURNS AFTER ALL HOOKS ===
  
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
          const rating = ratingsMap?.get(product.id);
          
          // Determine product URL based on quickBuy setting
          // quickBuy vai direto ao checkout (implementar rota de checkout com produto)
          const productUrl = getPublicProductUrl(tenantSlug, product.slug);
          
          return (
            <div
              key={product.id}
              className={cn(
                'group block bg-card rounded-lg overflow-hidden border transition-shadow hover:shadow-md relative',
                isEditing && 'pointer-events-none'
              )}
            >
              {/* Product Image with link */}
              <a href={isEditing ? undefined : productUrl || undefined}>
                <div className="aspect-square overflow-hidden bg-muted relative">
                  <img
                    src={getProductImage(product)}
                    alt={product.name}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
              </a>
              
              <div className="p-2 sm:p-3">
                {showRatings && rating && rating.count > 0 && (
                  <RatingSummary
                    average={rating.average}
                    count={rating.count}
                    variant="card"
                    className="mb-1"
                  />
                )}
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
                
                {/* Botões conforme REGRAS.md:
                    - Se Add to Cart ativo: 1º Carrinho, 2º Custom, 3º Comprar agora
                    - Se Add to Cart desativado: 1º Custom, 2º Comprar agora
                */}
                {showButton && (
                  <div className="mt-2 flex flex-col gap-1">
                    {/* 1º Adicionar ao carrinho (se ativo) */}
                    {showAddToCartButton && (
                      <button 
                        className="w-full py-1 sm:py-1.5 px-2 sm:px-3 text-[10px] sm:text-xs border border-primary text-primary bg-transparent rounded-md hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
                      >
                        <ShoppingCart className="h-3 w-3" />
                        <span>Adicionar</span>
                      </button>
                    )}
                    
                    {/* 2º Botão personalizado (se ativo) - sempre no meio */}
                    {customButtonEnabled && customButtonText && (
                      <a
                        href={customButtonLink || '#'}
                        className="w-full py-1 sm:py-1.5 px-2 sm:px-3 text-[10px] sm:text-xs rounded-md text-center transition-colors"
                        style={{ 
                          backgroundColor: customButtonColor || '#6366f1',
                          color: '#ffffff'
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {customButtonText}
                      </a>
                    )}
                    
                    {/* 3º Botão principal "Comprar agora" - sempre por último */}
                    <a
                      href={isEditing ? undefined : productUrl || undefined}
                      className="w-full py-1 sm:py-1.5 px-2 sm:px-3 text-[10px] sm:text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-center"
                    >
                      {buyNowButtonText}
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
