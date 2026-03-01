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

import { useState, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { BlockRenderContext } from '@/lib/builder/types';
import { CategoryFilters } from './CategoryFilters';
import { Skeleton } from '@/components/ui/skeleton';
import { getPublicProductUrl, getPublicCheckoutUrl } from '@/lib/publicUrls';
import { useProductRatings } from '@/hooks/useProductRating';
import { RatingSummary } from '@/components/storefront/RatingSummary';
import { ShoppingCart, Check } from 'lucide-react';
import { useProductBadgesForProducts } from '@/hooks/useProductBadges';
import { ProductCardBadges } from '@/components/storefront/product/ProductCardBadges';
import { useCart } from '@/contexts/CartContext';
import { MiniCartDrawer } from '@/components/storefront/MiniCartDrawer';
import { toast } from 'sonner';

interface Product {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  product_images: { url: string; is_primary: boolean }[];
  tags?: string[];
}

// Dados fictícios para preview no builder quando não há produtos
const DEMO_PRODUCTS = [
  { name: 'Produto Exemplo 1', price: 149.90, compareAtPrice: 199.90, rating: 5, reviewCount: 127 },
  { name: 'Produto Exemplo 2', price: 89.90, compareAtPrice: null, rating: 4, reviewCount: 43 },
  { name: 'Produto Exemplo 3', price: 199.90, compareAtPrice: 249.90, rating: 5, reviewCount: 89 },
  { name: 'Produto Exemplo 4', price: 59.90, compareAtPrice: 79.90, rating: 4, reviewCount: 156 },
  { name: 'Produto Exemplo 5', price: 299.90, compareAtPrice: null, rating: 5, reviewCount: 67 },
  { name: 'Produto Exemplo 6', price: 129.90, compareAtPrice: 159.90, rating: 4, reviewCount: 34 },
  { name: 'Produto Exemplo 7', price: 179.90, compareAtPrice: null, rating: 5, reviewCount: 211 },
  { name: 'Produto Exemplo 8', price: 99.90, compareAtPrice: 139.90, rating: 4, reviewCount: 78 },
];

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
  customButtonColor?: string;       // Legado
  customButtonBgColor?: string;     // Cor de fundo
  customButtonTextColor?: string;   // Cor do texto
  customButtonHoverColor?: string;  // Cor de hover
  customButtonLink?: string;
}

export function CategoryPageLayout({
  context,
  limit = 8, // REGRAS.md: 8 produtos por padrão no preview do builder
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
  const customButtonBgColor = categorySettings.customButtonBgColor || categorySettings.customButtonColor || '';
  const customButtonTextColor = categorySettings.customButtonTextColor || '#ffffff';
  const customButtonHoverColor = categorySettings.customButtonHoverColor || '';
  const customButtonLink = categorySettings.customButtonLink || '';

  // Theme settings for mini-cart (unified cartActionType from themeSettings.miniCart)
  const themeSettings = (context as any)?.themeSettings || {};
  const miniCartConfig = themeSettings.miniCart || {};
  const cartActionType = miniCartConfig.cartActionType ?? 'miniCart';
  const miniCartEnabled = cartActionType === 'miniCart';

  // Cart integration for add to cart functionality
  const { addItem } = useCart();

  // State for mini-cart drawer
  const [miniCartOpen, setMiniCartOpen] = useState(false);
  
  // State for tracking which products show "Adicionado" feedback
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

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

  // Fetch products - with fallback to random products if no category
  const { data: products, isLoading } = useQuery({
    queryKey: ['category-products', tenantId, categoryId, limit],
    queryFn: async () => {
      if (!tenantId) return [];

      // If we have a categoryId, fetch products from that category
      if (categoryId) {
        const { data: productCategories } = await supabase
          .from('product_categories')
          .select('product_id, position')
          .eq('category_id', categoryId)
          .order('position', { ascending: true });

        if (productCategories?.length) {
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
        }
      }

      // Fallback: fetch random products from tenant for preview
      // This ensures the builder always shows product placeholders with real data when available
      const { data: prods, error } = await supabase
        .from('products')
        .select('id, name, slug, price, compare_at_price, product_images(url, is_primary)')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
        .limit(limit);

      if (error) throw error;
      return (prods || []) as Product[];
    },
    enabled: !!tenantId,
  });

  // Use products or empty array (will show placeholders)
  const displayProducts = useMemo(() => {
    return products || [];
  }, [products]);

  // Get product IDs for ratings
  const productIdsForRating = useMemo(() => 
    displayProducts.length === 0 ? [] : displayProducts.map(p => p.id), 
    [displayProducts]
  );
  const { data: ratingsMap } = useProductRatings(productIdsForRating);
  
  // Fetch badges for all products in the grid
  const { data: badgesMap } = useProductBadgesForProducts(productIdsForRating);

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
    // Sempre retorna a URL do produto para navegação normal
    return getPublicProductUrl(tenantSlug, product.slug);
  };

  // Handler para compra rápida - adiciona ao carrinho e vai para checkout
  const handleQuickBuy = (e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Adiciona ao carrinho
    addItem({
      product_id: product.id,
      name: product.name,
      sku: product.slug, // Usa slug como SKU fallback
      price: product.price,
      quantity: 1,
      image_url: getProductImage(product),
    });
    
    // Redireciona para checkout
    const checkoutUrl = getPublicCheckoutUrl(tenantSlug);
    window.location.href = checkoutUrl;
  };

  // Handler para adicionar ao carrinho - feedback visual + mini-cart condicional
  const handleAddToCart = useCallback((e: React.MouseEvent, product: Product) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Adiciona ao carrinho
    addItem({
      product_id: product.id,
      name: product.name,
      sku: product.slug,
      price: product.price,
      quantity: 1,
      image_url: getProductImage(product),
    });
    
    // Mostra feedback "Adicionado" no botão
    setAddedProducts(prev => new Set(prev).add(product.id));
    toast.success('Produto adicionado ao carrinho!');
    
    // Se cartActionType é 'miniCart', abre o drawer
    if (cartActionType === 'miniCart') {
      setMiniCartOpen(true);
    }
    
    // Remove o feedback depois de 2 segundos
    setTimeout(() => {
      setAddedProducts(prev => {
        const next = new Set(prev);
        next.delete(product.id);
        return next;
      });
    }, 2000);
  }, [addItem, cartActionType]);

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
    <div className="px-2 sm:px-4 py-6">
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
            // Dados fictícios para preview no builder - permite visualizar e configurar aparência
            <div className={cn('grid gap-4', getGridCols())}>
              {DEMO_PRODUCTS.map((demoProduct, i) => (
                <div key={i} className="group bg-card rounded-lg overflow-hidden border">
                  {/* Demo Product Image */}
                  <div className="aspect-square bg-muted flex items-center justify-center relative">
                    <svg className="w-12 h-12 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {/* Demo badge quando showBadges ativo */}
                    {showBadges && i === 0 && (
                      <span 
                        className="absolute top-2 left-2 text-white text-[10px] px-1.5 py-0.5 rounded font-medium sf-tag-danger"
                        style={{ backgroundColor: 'var(--theme-danger-bg, #ef4444)' }}
                      >
                        -20%
                      </span>
                    )}
                  </div>
                  
                  {/* Demo Product Info */}
                   <div className="p-2 sm:p-3">
                    {/* Demo rating quando showRatings ativo */}
                    {showRatings && (
                      <div className="flex items-center gap-1 mb-1">
                        {Array.from({ length: 5 }).map((_, starIndex) => (
                          <svg
                            key={starIndex}
                            className="w-3 h-3"
                            style={{ 
                              color: starIndex < demoProduct.rating 
                                ? 'var(--theme-warning-bg, #facc15)' 
                                : 'hsl(var(--muted-foreground) / 0.3)',
                              fill: starIndex < demoProduct.rating 
                                ? 'var(--theme-warning-bg, #facc15)' 
                                : 'transparent',
                            }}
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        ))}
                        <span className="text-[10px] text-muted-foreground">({demoProduct.reviewCount})</span>
                      </div>
                    )}
                    
                    <h3 className="font-medium text-xs sm:text-sm line-clamp-2 text-foreground">
                      {demoProduct.name}
                    </h3>
                    
                    {/* Demo Price */}
                    <div className="mt-1 flex items-center gap-1 sm:gap-2">
                      {demoProduct.compareAtPrice && (
                        <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                          {formatPrice(demoProduct.compareAtPrice)}
                        </span>
                      )}
                      <span className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--theme-text-primary, #1a1a1a)' }}>
                        {formatPrice(demoProduct.price)}
                      </span>
                    </div>
                    
                    {/* Demo Buttons - mesma ordem da versão real */}
                    <div className="mt-2 flex flex-col gap-1 sm:gap-1.5">
                      {/* 1º Botão "Adicionar ao carrinho" (se ativo) */}
                      {showAddToCartButton && (
                        <button 
                          className="w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs border bg-transparent rounded-md hover:opacity-80 transition-colors flex items-center justify-center gap-1"
                          style={{
                            borderColor: 'var(--theme-button-primary-bg)',
                            color: 'var(--theme-button-primary-bg)',
                          }}
                        >
                          <ShoppingCart className="h-3 w-3" />
                          <span>Adicionar</span>
                        </button>
                      )}
                      
                      {/* 2º Botão personalizado (se ativo) */}
                      {customButtonEnabled && customButtonText && (
                        <button
                          className={cn(
                            "w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md text-center transition-colors",
                            !customButtonBgColor && "sf-btn-secondary"
                          )}
                          style={customButtonBgColor ? { 
                            backgroundColor: customButtonBgColor,
                            color: customButtonTextColor,
                            '--hover-bg': customButtonHoverColor || customButtonBgColor,
                          } as React.CSSProperties : undefined}
                          onMouseEnter={(e) => {
                            if (customButtonHoverColor) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = customButtonHoverColor;
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (customButtonBgColor) {
                              (e.currentTarget as HTMLElement).style.backgroundColor = customButtonBgColor;
                            }
                          }}
                        >
                          {customButtonText}
                        </button>
                      )}
                      
                      {/* 3º Botão principal "Comprar agora" - usa sf-btn-primary para respeitar tema */}
                      <button className="w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md hover:opacity-90 transition-colors sf-btn-primary">
                        {buyNowButtonText}
                      </button>
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
                      {/* Render dynamic badges when showBadges is enabled */}
                      {showBadges && badgesMap && (
                        <ProductCardBadges badges={badgesMap.get(product.id) || []} />
                      )}
                    </div>
                    
                    {/* Product Info */}
                    <div className="p-2 sm:p-3">
                      {/* REGRAS.md linha 78: Avaliações abaixo do nome */}
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
                      
                      {/* Price */}
                      <div className="mt-1 flex items-center gap-1 sm:gap-2">
                        {product.compare_at_price && product.compare_at_price > product.price && (
                          <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                            {formatPrice(product.compare_at_price)}
                          </span>
                        )}
                        <span className="text-xs sm:text-sm font-semibold" style={{ color: 'var(--theme-text-primary, #1a1a1a)' }}>
                          {formatPrice(product.price)}
                        </span>
                      </div>
                      
                      {/* REGRAS.md linha 79-84: Botões com ordem específica */}
                      <div className="mt-2 flex flex-col gap-1 sm:gap-1.5">
                        {/* 1º Botão "Adicionar ao carrinho" (se ativo) */}
                        {showAddToCartButton && (
                          <button 
                            className={cn(
                              "w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md transition-colors flex items-center justify-center gap-1",
                              addedProducts.has(product.id)
                                ? "text-white sf-accent-bg"
                                : "border bg-transparent hover:opacity-80"
                            )}
                            style={addedProducts.has(product.id) 
                              ? { backgroundColor: 'var(--theme-accent-color, var(--theme-success-bg, #22c55e))' }
                              : {
                                  borderColor: 'var(--theme-button-primary-bg)',
                                  color: 'var(--theme-button-primary-bg)',
                                }
                            }
                            onClick={(e) => handleAddToCart(e, product)}
                          >
                            {addedProducts.has(product.id) ? (
                              <>
                                <Check className="h-3 w-3" />
                                <span>Adicionado</span>
                              </>
                            ) : (
                              <>
                                <ShoppingCart className="h-3 w-3" />
                                <span>Adicionar</span>
                              </>
                            )}
                          </button>
                        )}
                        
                        {/* 2º Botão personalizado (se ativo) - sempre no meio */}
                        {customButtonEnabled && customButtonText && (
                          <a
                            href={customButtonLink || '#'}
                            className={cn(
                              "w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md text-center transition-colors",
                              !customButtonBgColor && "sf-btn-secondary"
                            )}
                            style={customButtonBgColor ? { 
                              backgroundColor: customButtonBgColor,
                              color: customButtonTextColor,
                            } : undefined}
                            onClick={(e) => e.stopPropagation()}
                            onMouseEnter={(e) => {
                              if (customButtonHoverColor) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = customButtonHoverColor;
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (customButtonBgColor) {
                                (e.currentTarget as HTMLElement).style.backgroundColor = customButtonBgColor;
                              }
                            }}
                          >
                            {customButtonText}
                          </a>
                        )}
                        
                        {/* 3º Botão principal "Comprar agora" - sempre por último */}
                        {/* Se quickBuyEnabled, usa handleQuickBuy; senão, navega para produto */}
                        {quickBuyEnabled ? (
                          <button
                            onClick={(e) => handleQuickBuy(e, product)}
                            className="w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md hover:opacity-90 transition-colors text-center sf-btn-primary"
                          >
                            {buyNowButtonText}
                          </button>
                        ) : (
                          <a
                            href={isEditing ? undefined : productUrl || undefined}
                            className="w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md hover:opacity-90 transition-colors text-center sf-btn-primary"
                          >
                            {buyNowButtonText}
                          </a>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </div>
      
      {/* Mini Cart Drawer - só renderiza se miniCartEnabled */}
      {miniCartEnabled && (
        <MiniCartDrawer
          open={miniCartOpen}
          onOpenChange={setMiniCartOpen}
          tenantSlug={tenantSlug}
          isPreview={context?.isPreview}
        />
      )}
    </div>
  );
}
