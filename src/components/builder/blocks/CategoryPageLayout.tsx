// =============================================
// CATEGORY PAGE LAYOUT - Layout com sidebar de filtros + grid de produtos
// Conforme docs/REGRAS.md linha 67-88 - funcionalidades obrigatórias:
// - Compra rápida (checkout direto ou página produto)
// - Exibir/ocultar avaliações
// - Exibir/ocultar botão adicionar ao carrinho
// - Alterar texto "Comprar agora"
// - Mostrar/ocultar selos
// - Botão personalizado com ordem específica
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
import { ShoppingCart } from 'lucide-react';

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

// Interface para categorySettings do contexto (conforme REGRAS.md)
interface CategorySettingsFromContext {
  showCategoryName?: boolean;
  showBanner?: boolean;
  showRatings?: boolean;
  quickBuyEnabled?: boolean;
  showAddToCartButton?: boolean;
  showBadges?: boolean;
  buyNowButtonText?: string;
  customButtonEnabled?: boolean;
  customButtonText?: string;
  customButtonColor?: string;
  customButtonLink?: string;
}

export function CategoryPageLayout({
  context,
  limit = 24,
  columns = 4,
  showFilters = true,
  isEditing = false,
}: CategoryPageLayoutProps) {
  const { tenantSlug, viewport, category } = context;
  const isMobile = viewport === 'mobile';
  const categoryId = category?.id;
  const categorySlug = category?.slug;

  // REGRAS.md: Consumir categorySettings do contexto
  const categorySettings: CategorySettingsFromContext = (context as any)?.categorySettings || {};
  
  // Extrair configurações com defaults seguros
  const showRatings = categorySettings.showRatings ?? true;
  const showBadges = categorySettings.showBadges ?? true;
  const showAddToCartButton = categorySettings.showAddToCartButton ?? true;
  const quickBuyEnabled = categorySettings.quickBuyEnabled ?? false;
  const buyNowButtonText = categorySettings.buyNowButtonText || 'Comprar agora';
  const customButtonEnabled = categorySettings.customButtonEnabled ?? false;
  const customButtonText = categorySettings.customButtonText || '';
  const customButtonColor = categorySettings.customButtonColor || '';
  const customButtonLink = categorySettings.customButtonLink || '';

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

  // REGRAS.md linha 76: compra rápida vai direto ao checkout
  const getProductUrl = (product: Product) => {
    if (quickBuyEnabled) {
      // TODO: Implementar rota de checkout direto com produto
      // Por enquanto, usa a página do produto
      return getPublicProductUrl(tenantSlug, product.slug);
    }
    return getPublicProductUrl(tenantSlug, product.slug);
  };

  // Handler para adicionar ao carrinho (abre carrinho lateral)
  const handleAddToCart = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    // TODO: Integrar com hook de carrinho
    console.log('Add to cart:', product.id);
  };

  // Use container query class for responsive grid
  const getGridCols = () => {
    // sf-product-grid handles responsiveness via container queries
    return 'sf-product-grid';
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
            // Sempre mostrar placeholders estruturais quando não há produtos
            <div className={cn('grid gap-4', getGridCols())}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-card rounded-lg overflow-hidden border">
                  <div className="aspect-square bg-muted flex items-center justify-center">
                    <svg className="w-10 h-10 text-muted-foreground/40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="p-3 space-y-2">
                    <div className="h-4 bg-muted rounded w-3/4" />
                    <div className="h-4 bg-muted rounded w-1/3" />
                    <div className="mt-2 space-y-1.5">
                      <div className="h-7 bg-muted rounded w-full" />
                      <div className="h-7 bg-primary/20 rounded w-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={cn('grid gap-4', getGridCols())}>
              {filteredProducts.map((product) => {
                const rating = ratingsMap?.get(product.id);
                const productUrl = getProductUrl(product);
                
                return (
                  <a
                    key={product.id}
                    href={isEditing ? undefined : productUrl || undefined}
                    className={cn(
                      'group block bg-card rounded-lg overflow-hidden border transition-shadow hover:shadow-md',
                      isEditing && 'pointer-events-none'
                    )}
                  >
                    {/* Product Image */}
                    <div className="aspect-square overflow-hidden bg-muted relative">
                      <img
                        src={getProductImage(product)}
                        alt={product.name}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                      />
                      {/* TODO: Renderizar selos (badges) quando showBadges=true */}
                    </div>
                    
                    {/* Product Info */}
                    <div className="p-3">
                      {/* REGRAS.md linha 78: Avaliações abaixo do nome */}
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
                      
                      {/* Price */}
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
                      
                      {/* REGRAS.md linha 79-84: Botões com ordem específica */}
                      <div className="mt-2 flex flex-col gap-1.5">
                        {/* 1º Botão "Adicionar ao carrinho" (se ativo) */}
                        {showAddToCartButton && (
                          <button 
                            className="w-full py-1.5 px-3 text-xs border border-primary text-primary bg-transparent rounded-md hover:bg-primary/10 transition-colors flex items-center justify-center gap-1"
                            onClick={(e) => handleAddToCart(e, product)}
                          >
                            <ShoppingCart className="h-3 w-3" />
                            <span>Adicionar</span>
                          </button>
                        )}
                        
                        {/* 2º Botão personalizado (se ativo) - sempre no meio */}
                        {customButtonEnabled && customButtonText && (
                          <a
                            href={customButtonLink || '#'}
                            className="w-full py-1.5 px-3 text-xs rounded-md text-center transition-colors"
                            style={{ 
                              backgroundColor: customButtonColor || 'hsl(var(--primary))',
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
                          className="w-full py-1.5 px-3 text-xs bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors text-center"
                        >
                          {buyNowButtonText}
                        </a>
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
