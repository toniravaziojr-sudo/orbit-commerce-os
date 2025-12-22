// =============================================
// CART SUMMARY - Order summary with totals and CTA
// Uses centralized cartTotals for consistency
// =============================================

import { useNavigate, useParams } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { useDiscount } from '@/contexts/DiscountContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, ArrowRight, Tag } from 'lucide-react';
import { calculateCartTotals, formatCurrency, debugCartTotals } from '@/lib/cartTotals';

interface CartSummaryProps {
  variant?: 'default' | 'sticky' | 'mobile-bar';
}

export function CartSummary({ variant = 'default' }: CartSummaryProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
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
    navigate(`/store/${tenantSlug}/checkout`);
  };

  const handleContinueShopping = () => {
    navigate(`/store/${tenantSlug}`);
  };

  if (items.length === 0) {
    return (
      <div className="p-6 border rounded-lg bg-muted/30 text-center">
        <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-muted-foreground mb-4">Seu carrinho está vazio</p>
        <Button onClick={handleContinueShopping}>
          Continuar comprando
        </Button>
      </div>
    );
  }

  // Mobile bottom bar variant
  if (variant === 'mobile-bar') {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 pb-safe z-50 md:hidden">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-xl font-bold">{formatCurrency(totals.grandTotal)}</p>
            {appliedDiscount && (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <Tag className="h-3 w-3" />
                {appliedDiscount.discount_code}
              </p>
            )}
          </div>
          <Button 
            size="lg" 
            onClick={handleCheckout}
            className="flex-1 max-w-[200px]"
          >
            Finalizar compra
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  // Sticky desktop variant
  if (variant === 'sticky') {
    return (
      <div className="sticky top-4">
        <div className="p-6 border rounded-lg bg-card">
          <h3 className="font-semibold text-lg mb-4">Resumo do pedido</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal ({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'itens'})</span>
              <span>{formatCurrency(totals.subtotal)}</span>
            </div>

            {appliedDiscount && totals.discountTotal > 0 && (
              <div className="flex justify-between text-green-600">
                <span className="flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  Desconto ({appliedDiscount.discount_code})
                </span>
                <span>-{formatCurrency(totals.discountTotal)}</span>
              </div>
            )}

            {effectiveShipping && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete ({effectiveShipping.label})</span>
                <span>
                  {effectiveShipping.isFree ? (
                    <span className="text-green-600">Grátis</span>
                  ) : (
                    formatCurrency(totals.shippingTotal)
                  )}
                </span>
              </div>
            )}

            {appliedDiscount?.free_shipping && (
              <div className="text-xs text-green-600 flex items-center gap-1">
                <Tag className="h-3 w-3" />
                Frete grátis aplicado via cupom
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>{formatCurrency(totals.grandTotal)}</span>
            </div>
          </div>

          <Button 
            size="lg" 
            className="w-full mt-6"
            onClick={handleCheckout}
          >
            Finalizar compra
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <Button 
            variant="ghost" 
            className="w-full mt-2"
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
        size="lg" 
        className="w-full mt-6"
        onClick={handleCheckout}
      >
        Finalizar compra
        <ArrowRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );
}
