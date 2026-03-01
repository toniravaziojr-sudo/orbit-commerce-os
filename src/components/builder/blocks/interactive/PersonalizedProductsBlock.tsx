// =============================================
// PERSONALIZED PRODUCTS BLOCK - "Recommended for you" section
// USA ProductCard compartilhado para respeitar categorySettings do tema
// =============================================

import React, { useMemo, useState, useCallback } from 'react';
import { Sparkles, RefreshCw, ShoppingBag, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockRenderContext } from '@/lib/builder/types';
import { ProductCard, formatPrice, ProductCardProduct } from '../shared/ProductCard';
import type { CategorySettings } from '@/hooks/usePageSettings';
import { useProductRatings } from '@/hooks/useProductRating';
import { useProductBadgesForProducts } from '@/hooks/useProductBadges';
import { useCart } from '@/contexts/CartContext';
import { getPublicCheckoutUrl } from '@/lib/publicUrls';
import { toast } from 'sonner';

interface ProductItem {
  id?: string;
  name?: string;
  slug?: string;
  price?: number;
  originalPrice?: number;
  compare_at_price?: number | null;
  image?: string;
  product_images?: { url: string; is_primary?: boolean }[];
  badge?: string;
}

interface PersonalizedProductsBlockProps {
  title?: string;
  subtitle?: string;
  layout?: 'grid' | 'carousel' | 'list';
  columns?: number;
  showViewedRecently?: boolean;
  showRecommended?: boolean;
  showBuyAgain?: boolean;
  products?: ProductItem[];
  context?: BlockRenderContext;
  isEditing?: boolean;
}

const defaultProducts: ProductItem[] = [
  {
    id: '1',
    name: 'Camiseta Premium',
    slug: 'camiseta-premium',
    price: 89.90,
    originalPrice: 129.90,
    compare_at_price: 129.90,
    image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=300&h=300&fit=crop',
    badge: 'Recomendado',
  },
  {
    id: '2',
    name: 'Tênis Esportivo',
    slug: 'tenis-esportivo',
    price: 299.90,
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=300&fit=crop',
    badge: 'Baseado em sua navegação',
  },
  {
    id: '3',
    name: 'Mochila Casual',
    slug: 'mochila-casual',
    price: 149.90,
    image: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=300&h=300&fit=crop',
    badge: 'Você pode gostar',
  },
  {
    id: '4',
    name: 'Relógio Smart',
    slug: 'relogio-smart',
    price: 499.90,
    originalPrice: 699.90,
    compare_at_price: 699.90,
    image: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=300&h=300&fit=crop',
    badge: 'Popular',
  },
];

export function PersonalizedProductsBlock({
  title = 'Recomendados para Você',
  subtitle = 'Produtos selecionados com base em suas preferências',
  layout = 'grid',
  columns = 4,
  showViewedRecently = true,
  showRecommended = true,
  showBuyAgain = false,
  products,
  context,
  isEditing = false,
}: PersonalizedProductsBlockProps) {
  const tenantSlug = context?.tenantSlug || '';
  
  // Get categorySettings from context (passed from VisualBuilder)
  const categorySettings: Partial<CategorySettings> = (context as any)?.categorySettings || {};

  // IMPORTANT: Demo products should ONLY appear in builder/editor mode
  // In public storefront, show nothing if no real products exist
  const hasRealProducts = products && products.length > 0;
  const displayProducts = hasRealProducts ? products : (isEditing ? defaultProducts : []);
  
  // Normalize products to ProductCard format
  const normalizedProducts: ProductCardProduct[] = useMemo(() => 
    displayProducts.map(p => ({
      id: p.id || '',
      name: p.name || '',
      slug: p.slug || '',
      price: p.price || 0,
      compare_at_price: p.compare_at_price || p.originalPrice || null,
      product_images: p.product_images || (p.image ? [{ url: p.image, is_primary: true }] : []),
    })), [displayProducts]);
  
  // Get product IDs for batch rating and badge fetch
  const productIds = useMemo(() => normalizedProducts.map(p => p.id).filter(Boolean), [normalizedProducts]);
  const { data: ratingsMap } = useProductRatings(productIds);
  const { data: badgesMap } = useProductBadgesForProducts(productIds);

  // Cart functionality
  const { addItem: addToCart, items: cartItems } = useCart();
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  // Check if product was just added (temporary visual feedback only)
  const isProductJustAdded = useCallback((productId: string) => {
    return addedProducts.has(productId);
  }, [addedProducts]);

  // Handle add to cart
  const handleAddToCart = useCallback((e: React.MouseEvent, product: ProductCardProduct) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isEditing) return;
    
    const primaryImage = product.product_images?.find(img => img.is_primary)?.url || product.product_images?.[0]?.url;
    
    addToCart({
      product_id: product.id,
      name: product.name,
      sku: product.slug,
      price: product.price,
      quantity: 1,
      image_url: primaryImage,
    });
    
    setAddedProducts(prev => new Set(prev).add(product.id));
    toast.success('Produto adicionado ao carrinho!');
  }, [addToCart, isEditing]);

  // Handle quick buy (redirect to checkout)
  const handleQuickBuy = useCallback((e: React.MouseEvent, product: ProductCardProduct) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isEditing) return;
    
    const primaryImage = product.product_images?.find(img => img.is_primary)?.url || product.product_images?.[0]?.url;
    
    // Add to cart first
    addToCart({
      product_id: product.id,
      name: product.name,
      sku: product.slug,
      price: product.price,
      quantity: 1,
      image_url: primaryImage,
    });
    
    // Redirect to checkout
    const checkoutUrl = getPublicCheckoutUrl(tenantSlug);
    window.location.href = checkoutUrl;
  }, [addToCart, tenantSlug, isEditing]);

  // Don't render anything in public mode if no real products
  if (displayProducts.length === 0) {
    return null;
  }

  const gridColsClass = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
    5: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5',
  }[columns] || 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';

  return (
    <section className="py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header com ícone e título */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">{title}</h2>
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>
          
          {/* Filtros de tipo */}
          <div className="flex items-center gap-2 flex-wrap">
            {showViewedRecently && (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                <Eye className="w-3.5 h-3.5" />
                Vistos recentemente
              </button>
            )}
            {showRecommended && (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-primary text-primary-foreground transition-colors">
                <Sparkles className="w-3.5 h-3.5" />
                Para você
              </button>
            )}
            {showBuyAgain && (
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full bg-muted hover:bg-muted/80 text-muted-foreground transition-colors">
                <RefreshCw className="w-3.5 h-3.5" />
                Comprar novamente
              </button>
            )}
          </div>
        </div>

        {/* Grid de produtos */}
        <div className={cn('grid gap-2 sm:gap-4 lg:gap-6', gridColsClass)}>
          {normalizedProducts.map((product, index) => {
            const rating = ratingsMap?.get(product.id);
            const badges = badgesMap?.get(product.id);
            return (
              <ProductCard
                key={product.id || index}
                product={product}
                tenantSlug={tenantSlug}
                isEditing={isEditing}
                settings={categorySettings}
                rating={rating}
                badges={badges}
                isAddedToCart={isProductJustAdded(product.id)}
                onAddToCart={handleAddToCart}
                onQuickBuy={handleQuickBuy}
                variant="compact"
              />
            );
          })}
        </div>

        {isEditing && (
          <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-dashed border-border">
            <p className="text-sm text-muted-foreground text-center">
              ⚡ Os produtos serão personalizados automaticamente com base no comportamento do usuário
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
