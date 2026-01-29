// =============================================
// PRODUCT CTAs - Buy now, Add to cart, WhatsApp buttons
// =============================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useMarketingEvents } from '@/hooks/useMarketingEvents';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Loader2, Check, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { getPublicCheckoutUrl, getPublicCartUrl } from '@/lib/publicUrls';
import type { CartActionType } from '@/hooks/useThemeSettings';

interface ProductCTAsProps {
  productId?: string;
  productName: string;
  productSku: string;
  productPrice: number;
  productStock: number;
  allowBackorder: boolean;
  imageUrl?: string;
  tenantSlug: string;
  isPreview?: boolean;
  isEditing?: boolean;
  isInteractMode?: boolean;
  openMiniCartOnAdd?: boolean;
  onOpenMiniCart?: () => void;
  // Novos campos conforme REGRAS.md
  showWhatsAppButton?: boolean;
  showAddToCartButton?: boolean;
  buyNowButtonText?: string;
  miniCartEnabled?: boolean;        // Do tema (não da página)
  hasRequiredVariant?: boolean;     // Se tem variantes obrigatórias
  variantSelected?: boolean;        // Se alguma variante está selecionada
  // Cart action type: what happens on "Add to Cart" click
  cartActionType?: CartActionType;
}

export function ProductCTAs({
  productId,
  productName,
  productSku,
  productPrice,
  productStock,
  allowBackorder,
  imageUrl,
  tenantSlug,
  isPreview,
  isEditing,
  isInteractMode,
  openMiniCartOnAdd,
  onOpenMiniCart,
  showWhatsAppButton = true,
  showAddToCartButton = true,
  buyNowButtonText = 'Comprar agora',
  miniCartEnabled = true,
  hasRequiredVariant = false,
  variantSelected = true,
  cartActionType = 'miniCart',
}: ProductCTAsProps) {
  const navigate = useNavigate();
  const { items, addItem } = useCart();
  const { trackAddToCart } = useMarketingEvents();
  
  // Find if product already in cart (only in Preview/Public/Interact mode)
  const shouldAllowCartOps = !isEditing || isInteractMode;
  const cartItem = shouldAllowCartOps ? items.find(i => i.product_id === productId) : null;
  
  // Local quantity state - always starts at 1 and resets on product change
  const [localQuantity, setLocalQuantity] = React.useState(1);
  
  // Reset local quantity when product changes
  React.useEffect(() => {
    setLocalQuantity(1);
  }, [productId]);
  
  // State for UI feedback
  const [isAddingToCart, setIsAddingToCart] = React.useState(false);
  const [addedFeedback, setAddedFeedback] = React.useState(false);
  
  const isOutOfStock = productStock <= 0 && !allowBackorder;
  const maxQuantity = allowBackorder ? 999 : productStock;
  
  // Regra de segurança: desabilita compra se variante obrigatória não selecionada
  const requiresVariantSelection = hasRequiredVariant && !variantSelected;
  const quantity = localQuantity;
  
  const handleQuantityChange = React.useCallback((newQty: number) => {
    if (newQty < 1 || newQty > maxQuantity) return;
    setLocalQuantity(newQty);
  }, [maxQuantity]);
  
  const handleAddToCart = React.useCallback(() => {
    if (!productId || isOutOfStock || isAddingToCart || requiresVariantSelection) return;
    
    setIsAddingToCart(true);
    
    addItem({
      product_id: productId,
      name: productName,
      sku: productSku,
      price: productPrice,
      quantity: quantity,
      image_url: imageUrl,
    });
    
    trackAddToCart({
      id: productId,
      name: productName,
      price: productPrice,
      quantity: quantity,
    });
    
    setTimeout(() => {
      setIsAddingToCart(false);
      setAddedFeedback(true);
      toast.success('Produto adicionado ao carrinho!');
      
      // Handle cart action based on cartActionType
      if (cartActionType === 'goToCart') {
        // Redirect to cart page
        const cartUrl = getPublicCartUrl(tenantSlug, isPreview);
        navigate(cartUrl);
      } else if (cartActionType === 'miniCart' && openMiniCartOnAdd && miniCartEnabled && onOpenMiniCart) {
        // Open mini-cart drawer
        onOpenMiniCart();
      }
      // If cartActionType === 'none', just show the toast (already done above)
      
      setTimeout(() => {
        setAddedFeedback(false);
      }, 2000);
    }, 150);
  }, [productId, productName, productSku, productPrice, quantity, imageUrl, isOutOfStock, isAddingToCart, addItem, openMiniCartOnAdd, miniCartEnabled, onOpenMiniCart, trackAddToCart, requiresVariantSelection, cartActionType, tenantSlug, isPreview, navigate]);
  
  const handleBuyNow = React.useCallback(() => {
    if (!productId || isOutOfStock || isAddingToCart || requiresVariantSelection) return;
    
    addItem({
      product_id: productId,
      name: productName,
      sku: productSku,
      price: productPrice,
      quantity: quantity,
      image_url: imageUrl,
    });
    
    trackAddToCart({
      id: productId,
      name: productName,
      price: productPrice,
      quantity: quantity,
    });
    
    const checkoutUrl = getPublicCheckoutUrl(tenantSlug, isPreview);
    navigate(checkoutUrl);
  }, [productId, productName, productSku, productPrice, quantity, imageUrl, isOutOfStock, isAddingToCart, addItem, tenantSlug, isPreview, navigate, trackAddToCart, requiresVariantSelection]);
  
  const handleWhatsApp = React.useCallback(() => {
    const whatsappNumber = '5511919555920';
    const message = encodeURIComponent(`Quero comprar por aqui o "${productName}"`);
    const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${message}`;
    window.open(whatsappUrl, '_blank');
  }, [productName]);
  
  const disableInteraction = isEditing && !isInteractMode;
  const disableBuyButtons = disableInteraction || requiresVariantSelection;

  return (
    <div className="space-y-3 pt-2">
      {/* Mensagem de seleção obrigatória */}
      {requiresVariantSelection && (
        <p className="text-sm text-amber-600 text-center font-medium">
          Selecione uma opção
        </p>
      )}
      
      {/* Quantity selector + Comprar agora in row */}
      <div className="flex gap-3">
        {/* Quantity Selector */}
        <div className="flex items-center border rounded-full overflow-hidden">
          <button
            type="button"
            onClick={() => handleQuantityChange(quantity - 1)}
            disabled={quantity <= 1 || disableInteraction}
            className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Minus className="w-4 h-4" />
          </button>
          <span className="w-8 text-center font-medium">{quantity}</span>
          <button
            type="button"
            onClick={() => handleQuantityChange(quantity + 1)}
            disabled={quantity >= maxQuantity || disableInteraction}
            className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        {/* Comprar Agora - Uses theme primary button colors via sf-btn-primary class */}
        {/* IMPORTANT: variant="ghost" removes Tailwind's hover:bg-primary/90 so our CSS takes over */}
        <Button
          variant="ghost"
          onClick={handleBuyNow}
          disabled={isOutOfStock || isAddingToCart || disableBuyButtons}
          className="flex-1 h-10 rounded-full sf-btn-primary font-semibold uppercase tracking-wide text-sm"
        >
          {isAddingToCart ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            buyNowButtonText
          )}
        </Button>
      </div>
      
      {/* Adicionar ao Carrinho - Uses theme secondary button colors via sf-btn-secondary class */}
      {/* IMPORTANT: Uses unstyled button base so our CSS takes over */}
      {showAddToCartButton && (
        <Button
          variant="ghost"
          onClick={handleAddToCart}
          disabled={isOutOfStock || isAddingToCart || disableBuyButtons}
          className="w-full h-12 rounded-full sf-btn-secondary font-semibold uppercase tracking-wide text-sm border-2"
          style={{
            borderColor: 'var(--theme-button-primary-bg)',
          }}
        >
          {isAddingToCart ? (
            <Loader2 className="w-4 h-4 animate-spin mr-2" />
          ) : addedFeedback ? (
            <>
              <Check className="w-4 h-4 mr-2" />
              Adicionado!
            </>
          ) : (
            'Adicionar ao carrinho'
          )}
        </Button>
      )}
      
      {/* Comprar pelo WhatsApp - usa cor de sucesso do tema */}
      {showWhatsAppButton && (
        <Button
          variant="outline"
          onClick={handleWhatsApp}
          disabled={disableInteraction}
          className="w-full h-12 rounded-full font-semibold uppercase tracking-wide text-sm border-2"
          style={{
            borderColor: 'var(--theme-success-bg, #22c55e)',
            color: 'var(--theme-success-bg, #22c55e)',
          }}
        >
          <MessageCircle className="w-5 h-5 mr-2" />
          Comprar pelo WhatsApp
        </Button>
      )}
      
      {/* Out of stock message */}
      {isOutOfStock && (
        <p className="text-sm text-destructive text-center">Produto indisponível</p>
      )}
    </div>
  );
}
