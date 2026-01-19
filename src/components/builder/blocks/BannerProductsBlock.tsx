// =============================================
// BANNER + PRODUCTS BLOCK - Hybrid banner with products combo
// USA ProductCard compartilhado para respeitar categorySettings do tema
// =============================================

import { useBuilderProducts, formatProductPrice, getProductImage } from '@/hooks/useBuilderProducts';
import { useProductRatings } from '@/hooks/useProductRating';
import { useProductBadgesForProducts } from '@/hooks/useProductBadges';
import { BlockRenderContext } from '@/lib/builder/types';
import { cn } from '@/lib/utils';
import { Loader2, ImageIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { getPublicProductUrl, getPublicCheckoutUrl } from '@/lib/publicUrls';
import { ProductCard, ProductCardProduct } from './shared/ProductCard';
import { useCart } from '@/contexts/CartContext';
import { toast } from 'sonner';
import type { CategorySettings } from '@/hooks/usePageSettings';
import { useMemo, useState, useCallback } from 'react';

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
  
  // Get categorySettings from context (passed from VisualBuilder)
  const categorySettings: Partial<CategorySettings> = (context as any)?.categorySettings || {};
  
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

  // Get product IDs for batch rating and badge fetch
  const productIdsForRating = useMemo(() => products.map(p => p.id), [products]);
  const { data: ratingsMap } = useProductRatings(productIdsForRating);
  const { data: badgesMap } = useProductBadgesForProducts(productIdsForRating);

  // Cart functionality
  const { addItem: addToCart, items: cartItems } = useCart();
  const [addedProducts, setAddedProducts] = useState<Set<string>>(new Set());

  const isProductInCart = useCallback((productId: string) => {
    return cartItems.some(item => item.product_id === productId) || addedProducts.has(productId);
  }, [cartItems, addedProducts]);

  const handleAddToCart = useCallback((e: React.MouseEvent, product: ProductCardProduct) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) return;
    const primaryImage = product.product_images?.find(img => img.is_primary)?.url || product.product_images?.[0]?.url;
    addToCart({ product_id: product.id, name: product.name, sku: product.slug, price: product.price, quantity: 1, image_url: primaryImage });
    setAddedProducts(prev => new Set(prev).add(product.id));
    toast.success('Produto adicionado ao carrinho!');
  }, [addToCart, isEditing]);

  const handleQuickBuy = useCallback((e: React.MouseEvent, product: ProductCardProduct) => {
    e.preventDefault();
    e.stopPropagation();
    if (isEditing) return;
    const primaryImage = product.product_images?.find(img => img.is_primary)?.url || product.product_images?.[0]?.url;
    addToCart({ product_id: product.id, name: product.name, sku: product.slug, price: product.price, quantity: 1, image_url: primaryImage });
    const checkoutUrl = getPublicCheckoutUrl(context?.tenantSlug || '');
    window.location.href = checkoutUrl;
  }, [addToCart, context?.tenantSlug, isEditing]);

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
  
  // Always apply aspect ratio to match banner, regardless of product count
  const shouldApplyAspectRatio = !isMobile && productCount >= 1;

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
            'grid gap-3 overflow-hidden',
            isMobile ? 'grid-cols-2' : getProductGridClass(),
            shouldApplyAspectRatio && 'aspect-[4/5]', // Match banner aspect ratio
            // For single product, center content instead of stretching
            productCount === 1 && 'items-center justify-center'
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
                const rating = ratingsMap?.get(product.id);
                const badges = badgesMap?.get(product.id);
                
                // For 3 products, make the 3rd span full width
                const isLastOfThree = productCount === 3 && index === 2;
                
                return (
                  <div 
                    key={product.id} 
                    className={cn(
                      'overflow-hidden',
                      isLastOfThree && 'col-span-2',
                      // Single product: don't stretch, use natural height
                      productCount === 1 && 'max-h-[400px] w-full',
                      productCount === 2 && 'row-span-1'
                    )}
                  >
                    <ProductCard
                      product={product}
                      tenantSlug={context?.tenantSlug || ''}
                      isEditing={isEditing}
                      settings={categorySettings}
                      rating={rating}
                      badges={badges}
                      isAddedToCart={isProductInCart(product.id)}
                      onAddToCart={handleAddToCart}
                      onQuickBuy={handleQuickBuy}
                      variant="minimal"
                      className="h-full"
                    />
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
        {showCta && ctaText && (
          <div className="mt-6 text-center">
            {isEditing ? (
              <span className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium cursor-default">
                {ctaText}
              </span>
            ) : (
              <Link
                to={ctaUrl || '#'}
                className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
              >
                {ctaText}
              </Link>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
