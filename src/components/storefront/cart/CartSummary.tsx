// =============================================
// CART SUMMARY - Order summary with totals and CTA
// =============================================

import { useNavigate, useParams } from 'react-router-dom';
import { useCart } from '@/contexts/CartContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, ArrowRight } from 'lucide-react';

interface CartSummaryProps {
  variant?: 'default' | 'sticky' | 'mobile-bar';
}

export function CartSummary({ variant = 'default' }: CartSummaryProps) {
  const navigate = useNavigate();
  const { tenantSlug } = useParams();
  const { items, subtotal, shipping, total } = useCart();

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
            <p className="text-xl font-bold">
              R$ {total.toFixed(2).replace('.', ',')}
            </p>
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
              <span className="text-muted-foreground">Subtotal ({items.length} {items.length === 1 ? 'item' : 'itens'})</span>
              <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
            </div>

            {shipping.selected && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Frete ({shipping.selected.label})</span>
                <span>
                  {shipping.selected.isFree ? (
                    <span className="text-green-600">Grátis</span>
                  ) : (
                    `R$ ${shipping.selected.price.toFixed(2).replace('.', ',')}`
                  )}
                </span>
              </div>
            )}

            <Separator />

            <div className="flex justify-between text-lg font-semibold">
              <span>Total</span>
              <span>R$ {total.toFixed(2).replace('.', ',')}</span>
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
          <span>R$ {subtotal.toFixed(2).replace('.', ',')}</span>
        </div>

        {shipping.selected && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Frete</span>
            <span>
              {shipping.selected.isFree ? (
                <span className="text-green-600">Grátis</span>
              ) : (
                `R$ ${shipping.selected.price.toFixed(2).replace('.', ',')}`
              )}
            </span>
          </div>
        )}

        <Separator />

        <div className="flex justify-between text-lg font-semibold">
          <span>Total</span>
          <span>R$ {total.toFixed(2).replace('.', ',')}</span>
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
