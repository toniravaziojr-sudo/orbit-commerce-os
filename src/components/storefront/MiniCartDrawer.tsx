// =============================================
// MINI CART DRAWER - Opens when adding to cart
// Uses ResponsiveDrawerLayout for anti-regression mobile CSS
// =============================================

import { useNavigate } from 'react-router-dom';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Minus, Plus, X, ShoppingCart } from 'lucide-react';
import { useCart, CartItem } from '@/contexts/CartContext';
import { getPublicCheckoutUrl, getPublicCartUrl } from '@/lib/publicUrls';
import { ResponsiveDrawerLayout } from '@/components/ui/responsive-drawer-layout';
import { calculateCartTotals, formatCurrency } from '@/lib/cartTotals';

interface MiniCartDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantSlug: string;
  isPreview?: boolean;
}

export function MiniCartDrawer({ 
  open, 
  onOpenChange, 
  tenantSlug,
  isPreview,
}: MiniCartDrawerProps) {
  const navigate = useNavigate();
  const { items, shipping, updateQuantity, removeItem } = useCart();

  // Use centralized totals calculation
  const totals = calculateCartTotals({
    items,
    selectedShipping: shipping.selected,
    discountAmount: 0,
  });

  const handleCheckout = () => {
    onOpenChange(false);
    const checkoutUrl = getPublicCheckoutUrl(tenantSlug, isPreview);
    navigate(checkoutUrl);
  };

  const handleGoToCart = () => {
    onOpenChange(false);
    const cartUrl = getPublicCartUrl(tenantSlug, isPreview);
    navigate(cartUrl);
  };

  const handleContinueShopping = () => {
    onOpenChange(false);
  };

  // Header component
  const Header = (
    <SheetHeader className="border-b px-4 py-4">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-5 w-5" />
        <SheetTitle className="text-base font-semibold">Carrinho</SheetTitle>
      </div>
    </SheetHeader>
  );

  // Body component - scrollable items list
  const Body = (
    <div className="px-4 py-4">
      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground py-12">
          <ShoppingCart className="h-12 w-12 mb-4 opacity-40" />
          <p className="text-sm">Seu carrinho está vazio</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <CartItemRow
              key={item.id}
              item={item}
              onUpdateQuantity={(qty) => updateQuantity(item.id, qty)}
              onRemove={() => removeItem(item.id)}
            />
          ))}
        </div>
      )}
    </div>
  );

  // Footer component - summary + CTAs
  const Footer = (
    <div className="border-t px-4 py-4 space-y-4 bg-background">
      {/* Summary */}
      {items.length > 0 && (
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Subtotal:</span>
            <span className="font-medium">{formatCurrency(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground text-xs">
            <span>Frete:</span>
            <span>{totals.shippingTotal > 0 ? formatCurrency(totals.shippingTotal) : 'A calcular'}</span>
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t">
            <span>Total:</span>
            <span>{formatCurrency(totals.grandTotal)}</span>
          </div>
        </div>
      )}

      {/* CTAs */}
      <div className="flex flex-col gap-2">
        <Button 
          onClick={handleCheckout}
          disabled={items.length === 0}
          className="w-full h-12 rounded-full font-semibold uppercase tracking-wide text-sm"
        >
          Iniciar Compra
        </Button>
        <Button
          variant="outline"
          onClick={handleGoToCart}
          disabled={items.length === 0}
          className="w-full h-12 rounded-full font-semibold uppercase tracking-wide text-sm"
        >
          Ir para o Carrinho
        </Button>
        <Button
          variant="ghost"
          onClick={handleContinueShopping}
          className="w-full h-10 rounded-full font-semibold uppercase tracking-wide text-xs"
        >
          Continuar Comprando
        </Button>
      </div>
    </div>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        className="p-0 w-full sm:w-[400px] sm:max-w-md"
        side="right"
      >
        <ResponsiveDrawerLayout
          header={Header}
          body={Body}
          footer={Footer}
        />
      </SheetContent>
    </Sheet>
  );
}

// Cart Item Row Component
function CartItemRow({ 
  item, 
  onUpdateQuantity, 
  onRemove 
}: { 
  item: CartItem;
  onUpdateQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex gap-3 py-2">
      {/* Image */}
      <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden flex-shrink-0">
        {item.image_url ? (
          <img 
            src={item.image_url} 
            alt={item.name} 
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground">
            <ShoppingCart className="h-6 w-6 opacity-50" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <h4 className="font-medium text-sm line-clamp-2">{item.name}</h4>
          <button 
            onClick={onRemove}
            className="text-muted-foreground hover:text-foreground p-1"
            aria-label="Remover item"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <p className="text-sm text-primary font-medium mt-1">
          R$ {item.price.toFixed(2).replace('.', ',')}
        </p>

        {/* Quantity Controls */}
        <div className="flex items-center gap-2 mt-2">
          <div className="flex items-center border rounded-full">
            <button
              onClick={() => onUpdateQuantity(Math.max(0, item.quantity - 1))}
              className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors rounded-l-full"
            >
              <Minus className="w-3 h-3" />
            </button>
            <span className="w-8 text-center text-sm">{item.quantity}</span>
            <button
              onClick={() => onUpdateQuantity(item.quantity + 1)}
              className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors rounded-r-full"
            >
              <Plus className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
