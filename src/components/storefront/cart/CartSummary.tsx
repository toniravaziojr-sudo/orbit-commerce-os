// =============================================
// CART SUMMARY - Order summary with totals and CTA
// Uses centralized cartTotals for consistency
// =============================================

import { useNavigate } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useDiscount } from '@/contexts/DiscountContext';
import { useTenantSlug } from '@/hooks/useTenantSlug';
import { useStorefrontUrls } from '@/hooks/useStorefrontUrls';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, ArrowRight, Tag } from 'lucide-react';
import { calculateCartTotals, formatCurrency, debugCartTotals } from '@/lib/cartTotals';

interface CartSummaryProps {
  variant?: 'default' | 'sticky' | 'mobile-bar';
}

export function CartSummary({ variant = 'default' }: CartSummaryProps) {
  const navigate = useNavigate();
  const tenantSlug = useTenantSlug();
  const urls = useStorefrontUrls(tenantSlug);
  const { items, shipping } = useCart();
  const { appliedDiscount, getDiscountAmount } = useDiscount();

  // Calculate discount amount based on current subtotal
  const rawSubtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const discountAmount = getDiscountAmount(rawSubtotal, shipping.selected?.price || 0);
  
  // Handle free shipping from coupon
  const effectiveShipping = appliedDiscount?.free_shipping 
    ? { ...shipping.selected, isFree: true, price: 0 }
    : shipping.selected;

  // Use centralized totals calculation
  const totals = calculateCartTotals({
    items,
    selectedShipping: effectiveShipping,
    discountAmount,
  });

  // Debug helper (dev only, triggered by ?debugCart=1)
  debugCartTotals('CartSummary', totals, shipping);

  const handleCheckout = () => {
    navigate(urls.checkout());
  };

  const handleContinueShopping = () => {
    navigate(urls.home());
  };

  if (items.length === 0) {
    return (
      <div className="p-6 border rounded-lg bg-muted/30 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Seu carrinho está vazio</p>
        <Button onClick={handleContinueShopping} className="sf-btn-secondary">
          Continuar comprando
        </Button>
      </div>
    );
  }

  // Mobile bottom bar variant - uses container query class sf-show-mobile
  if (variant === 'mobile-bar') {
    return (
      <div className="sf-show-mobile fixed bottom-0 left-0 right-0 bg-background border-t p-4 pb-safe z-50">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{formatCurrency(totals.grandTotal)}</p>
            {appliedDiscount && (
              <p className="text-xs text-green-600 flex items-center gap-1 truncate">
                <Tag className="h-3 w-3 shrink-0" />
                <span className="truncate">{appliedDiscount.discount_code}</span>
              </p>
            )}
          </div>
          <Button 
            variant="ghost"
            size="lg" 
            onClick={handleCheckout}
            className="shrink-0 sf-btn-primary"
          >
            Finalizar
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Sticky desktop variant - uses container query class sf-show-desktop
  if (variant === 'sticky') {
    return (
      <div className="sf-show-desktop sticky top-4">
        <div className="p-6 border rounded-lg bg-card">
          <h3 className="font-semibold text-lg mb-4">Resumo do pedido</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal ({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'itens'})</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>

            {appliedDiscount && totals.discountTotal > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1 min-w-0">
                  <Tag className="h-3 w-3 shrink-0" />
                  <span className="truncate">Desconto ({appliedDiscount.discount_code})</span>
                </span>
                <span className="shrink-0">-{formatCurrency(totals.discountTotal)}</span>
              </div>
            )}

            {effectiveShipping && (
              <div className="flex justify-between">
                <span className="text-muted-foreground truncate">Frete ({effectiveShipping.label})</span>
                <span className="shrink-0">
                  {effectiveShipping.isFree ? (
                    <span style={{ color: 'var(--theme-accent-color, #22c55e)' }}>Grátis</span>
                  ) : (
                    formatCurrency(totals.shippingTotal)
                  )}
                </span>
              </div>
            )}

            {appliedDiscount?.free_shipping && (
              <div 
                className="text-xs flex items-center gap-1"
                style={{ color: 'var(--theme-accent-color, #22c55e)' }}
              >
                <Tag className="h-3 w-3 shrink-0" />
                <span className="truncate">Frete grátis aplicado via cupom</span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>

          <Button 
            variant="ghost"
            size="lg" 
            className="w-full mt-6 sf-btn-primary"
            onClick={handleCheckout}
          >
            Finalizar compra
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button 
            variant="ghost" 
            className="w-full mt-2 sf-btn-secondary"
            onClick={handleContinueShopping}
          >
            Continuar comprando
          </Button>
        </div>
      </div>
    );
  }

  // Default variant
  return (
    <div className="p-6 border rounded-lg bg-card">
      <h3 className="font-semibold text-lg mb-4">Resumo do pedido</h3>
      
      <div className="space-y-3">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>

        {appliedDiscount && totals.discountTotal > 0 && (
          <div className="flex justify-between text-green-600">
            <span className="flex items-center gap-1">
              <Tag className="h-3 w-3" />
              Desconto
            </span>
            <span>-{formatCurrency(totals.discountTotal)}</span>
          </div>
        )}

        {effectiveShipping && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frete</span>
            <span>
              {effectiveShipping.isFree ? (
                <span className="text-green-600">Grátis</span>
              ) : (
                formatCurrency(totals.shippingTotal)
              )}
            </span>
          </div>
        )}

        <Separator />

        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>{formatCurrency(totals.grandTotal)}</span>
        </div>
      </div>

      <Button 
        variant="ghost"
        size="lg" 
        className="w-full mt-6 sf-btn-primary"
        onClick={handleCheckout}
      >
        Finalizar compra
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
