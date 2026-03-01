// =============================================
// PRODUCT CARD - Componente compartilhado para exibição de produtos
// Centraliza configurações de visualização conforme categorySettings
// Usado por: ProductGridBlock, ProductCarouselBlock, CollectionSectionBlock,
//            BannerProductsBlock, FeaturedProductsBlock, CategoryPageLayout
// =============================================

import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ShoppingCart, Check } from 'lucide-react';
import { RatingSummary } from '@/components/storefront/RatingSummary';
import { ProductCardBadges, DynamicBadge } from '@/components/storefront/product/ProductCardBadges';
import { getPublicProductUrl } from '@/lib/publicUrls';
import { getProductCardImageUrl } from '@/lib/imageTransform';
import type { CategorySettings } from '@/hooks/usePageSettings';

// Tipo de produto compatível com os blocos
export interface ProductCardProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price?: number | null;
  product_images?: { url: string; is_primary?: boolean }[];
}

// Dados de rating
export interface ProductRating {
  average: number;
  count: number;
}

// Re-export DynamicBadge para uso externo
export type { DynamicBadge };

// Props do ProductCard
export interface ProductCardProps {
  product: ProductCardProduct;
  tenantSlug: string;
  isEditing?: boolean;
  
  // Configurações de visualização (vem do categorySettings do tema)
  settings?: Partial<CategorySettings>;
  
  // Dados dinâmicos
  rating?: ProductRating | null;
  badges?: DynamicBadge[];
  isAddedToCart?: boolean;
  
  // Callbacks
  onAddToCart?: (e: React.MouseEvent, product: ProductCardProduct) => void;
  onQuickBuy?: (e: React.MouseEvent, product: ProductCardProduct) => void;
  
  // Estilos
  className?: string;
  imageClassName?: string;
  variant?: 'default' | 'compact' | 'minimal';
}

// Helper para formatar preço
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(price);
};

// Helper para obter imagem do produto (otimizada via Supabase Image Transform)
const getProductImage = (product: ProductCardProduct) => {
  const primary = product.product_images?.find(img => img.is_primary);
  const rawUrl = primary?.url || product.product_images?.[0]?.url;
  return getProductCardImageUrl(rawUrl);
};

export function ProductCard({
  product,
  tenantSlug,
  isEditing = false,
  settings = {},
  rating,
  badges,
  isAddedToCart = false,
  onAddToCart,
  onQuickBuy,
  className,
  imageClassName,
  variant = 'default',
}: ProductCardProps) {
  // Extrair configurações com defaults seguros
  const showRatings = settings.showRatings ?? true;
  const showBadges = settings.showBadges ?? true;
  const showAddToCartButton = settings.showAddToCartButton ?? true;
  const quickBuyEnabled = settings.quickBuyEnabled ?? false;
  const buyNowButtonText = settings.buyNowButtonText || 'Comprar agora';
  const customButtonEnabled = settings.customButtonEnabled ?? false;
  const customButtonText = settings.customButtonText || '';
  const customButtonBgColor = settings.customButtonBgColor || settings.customButtonColor || '';
  const customButtonTextColor = settings.customButtonTextColor || '#ffffff';
  const customButtonHoverColor = settings.customButtonHoverColor || '';
  const customButtonLink = settings.customButtonLink || '';
  
  const productUrl = getPublicProductUrl(tenantSlug, product.slug);
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  
  // Container principal com link
  // WYSIWYG: Permitir hover effects mesmo em modo de edição (pointer-events removido)
  const CardWrapper = ({ children }: { children: React.ReactNode }) => {
    if (isEditing) {
      return (
        <div className={cn(
          'group block bg-card rounded-lg overflow-hidden border transition-shadow hover:shadow-md',
          className
        )}>
          {children}
        </div>
      );
    }
    
    return (
      <a
        href={productUrl || undefined}
        className={cn(
          'group block bg-card rounded-lg overflow-hidden border transition-shadow hover:shadow-md',
          className
        )}
      >
        {children}
      </a>
    );
  };
  
  // Renderização minimal - RESPEITA categorySettings do tema
  // Variante mais compacta, mas ainda segue as configurações globais
  if (variant === 'minimal') {
    return (
      <CardWrapper>
        <div className={cn('aspect-square overflow-hidden bg-muted relative', imageClassName)}>
          <img
            src={getProductImage(product)}
            alt={product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            decoding="async"
            width={400}
            height={400}
          />
          {showBadges && badges && badges.length > 0 && (
            <ProductCardBadges badges={badges} />
          )}
          {hasDiscount && (
            <span 
              className="absolute top-2 right-2 text-xs font-medium px-2 py-1 rounded"
              style={{
                backgroundColor: 'var(--theme-danger-bg, #ef4444)',
                color: 'var(--theme-danger-text, #ffffff)',
              }}
            >
              -{Math.round((1 - product.price / product.compare_at_price!) * 100)}%
            </span>
          )}
        </div>
        <div className="p-2 sm:p-3">
          {/* Rating - respeitando categorySettings.showRatings */}
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
          <div className="mt-1 flex flex-wrap items-center gap-1 sm:gap-2">
            {hasDiscount && (
              <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                {formatPrice(product.compare_at_price!)}
              </span>
            )}
            <span className="text-xs sm:text-sm font-semibold text-primary">
              {formatPrice(product.price)}
            </span>
          </div>
          
          {/* Botões - mesma lógica das outras variantes */}
          <div className="mt-2 flex flex-col gap-1.5">
            {/* 1º Botão "Adicionar ao carrinho" (se ativo) */}
            {showAddToCartButton && onAddToCart && (
              <button 
                className={cn(
                  "w-full py-1.5 px-3 text-xs rounded-md transition-colors flex items-center justify-center gap-1",
                  isAddedToCart
                    ? "bg-green-500 text-white border-green-500"
                    : "sf-btn-outline-primary"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!isEditing) onAddToCart(e, product);
                }}
                disabled={isEditing}
              >
                {isAddedToCart ? (
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
            
            {/* 2º Botão personalizado (se ativo) */}
            {customButtonEnabled && customButtonText && (
              <a
                href={isEditing ? undefined : (customButtonLink || '#')}
                className={cn(
                  "w-full py-1.5 px-3 text-xs rounded-md text-center transition-colors",
                  !customButtonBgColor && "sf-btn-secondary"
                )}
                style={customButtonBgColor ? { 
                  backgroundColor: customButtonBgColor,
                  color: customButtonTextColor,
                } : undefined}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isEditing) e.preventDefault();
                }}
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
            
            {/* 3º Botão principal "Comprar agora" - só exibe se quickBuyEnabled */}
            {quickBuyEnabled && (
              onQuickBuy ? (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!isEditing) onQuickBuy(e, product);
                  }}
                  disabled={isEditing}
                  className="w-full py-1.5 px-3 text-xs rounded-md hover:opacity-90 transition-colors text-center disabled:opacity-50 sf-btn-primary"
                >
                  {buyNowButtonText}
                </button>
              ) : (
                <span className="w-full py-1.5 px-3 text-xs rounded-md text-center sf-btn-primary">
                  {buyNowButtonText}
                </span>
              )
            )}
          </div>
        </div>
      </CardWrapper>
    );
  }
  
  // Renderização compact (imagem + rating + nome + preço + botões conforme settings)
  // REGRA: Variante compact também deve respeitar categorySettings do tema
  if (variant === 'compact') {
    return (
      <CardWrapper>
        <div className={cn('aspect-square overflow-hidden bg-muted relative', imageClassName)}>
          <img
            src={getProductImage(product)}
            alt={product.name}
            className="w-full h-full object-cover transition-transform group-hover:scale-105"
            loading="lazy"
            decoding="async"
            width={400}
            height={400}
          />
          {showBadges && badges && badges.length > 0 && (
            <ProductCardBadges badges={badges} />
          )}
        </div>
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
          <div className="mt-1 flex items-center gap-1 sm:gap-2 flex-wrap">
            {hasDiscount && (
              <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
                {formatPrice(product.compare_at_price!)}
              </span>
            )}
            <span className="text-xs sm:text-sm font-semibold text-primary">
              {formatPrice(product.price)}
            </span>
          </div>
          
          {/* Botões conforme categorySettings - mesmo comportamento que variant default */}
          <div className="mt-2 flex flex-col gap-1 sm:gap-1.5">
            {/* 1º Botão "Adicionar ao carrinho" (se ativo) */}
            {showAddToCartButton && onAddToCart && (
              <button 
                className={cn(
                  "w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md transition-colors flex items-center justify-center gap-1",
                  isAddedToCart
                    ? "bg-green-500 text-white border-green-500"
                    : "sf-btn-outline-primary"
                )}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onAddToCart(e, product);
                }}
              >
                {isAddedToCart ? (
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
            
            {/* 2º Botão personalizado (se ativo) */}
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
            
            {/* 3º Botão principal "Comprar agora" - só exibe se quickBuyEnabled */}
            {quickBuyEnabled && (
              onQuickBuy ? (
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onQuickBuy(e, product);
                  }}
                  className="w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md hover:opacity-90 transition-colors text-center sf-btn-primary"
                >
                  {buyNowButtonText}
                </button>
              ) : (
                <span className="w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md text-center sf-btn-primary">
                  {buyNowButtonText}
                </span>
              )
            )}
          </div>
        </div>
      </CardWrapper>
    );
  }
  
  // Renderização default (completa com todos os botões)
  return (
    <CardWrapper>
      {/* Product Image */}
      <div className={cn('aspect-square overflow-hidden bg-muted relative', imageClassName)}>
        <img
          src={getProductImage(product)}
          alt={product.name}
          className="w-full h-full object-cover transition-transform group-hover:scale-105"
          loading="lazy"
          decoding="async"
          width={400}
          height={400}
        />
        {showBadges && badges && badges.length > 0 && (
          <ProductCardBadges badges={badges} />
        )}
      </div>
      
      {/* Product Info */}
      <div className="p-2 sm:p-3">
        {/* Rating acima do nome */}
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
        <div className="mt-1 flex items-center gap-1 sm:gap-2 flex-wrap">
          {hasDiscount && (
            <span className="text-[10px] sm:text-xs text-muted-foreground line-through">
              {formatPrice(product.compare_at_price!)}
            </span>
          )}
          <span className="text-xs sm:text-sm font-semibold text-primary">
            {formatPrice(product.price)}
          </span>
        </div>
        
        {/* Botões conforme REGRAS.md linha 79-84 */}
        <div className="mt-2 flex flex-col gap-1 sm:gap-1.5">
          {/* 1º Botão "Adicionar ao carrinho" (se ativo) */}
          {showAddToCartButton && onAddToCart && (
            <button 
              className={cn(
                "w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md transition-colors flex items-center justify-center gap-1",
                isAddedToCart
                  ? "bg-green-500 text-white border-green-500"
                  : "sf-btn-outline-primary"
              )}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAddToCart(e, product);
              }}
            >
              {isAddedToCart ? (
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
          
          {/* 2º Botão personalizado (se ativo) */}
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
          
          {/* 3º Botão principal "Comprar agora" - só exibe se quickBuyEnabled */}
          {quickBuyEnabled && (
            onQuickBuy ? (
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onQuickBuy(e, product);
                }}
                className="w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md hover:opacity-90 transition-colors text-center sf-btn-primary"
              >
                {buyNowButtonText}
              </button>
            ) : (
              <span className="w-full py-1 px-1.5 sm:py-1.5 sm:px-3 text-[11px] sm:text-xs rounded-md text-center sf-btn-primary">
                {buyNowButtonText}
              </span>
            )
          )}
        </div>
      </div>
    </CardWrapper>
  );
}

// Export helper functions para uso em outros componentes
export { formatPrice, getProductImage };
