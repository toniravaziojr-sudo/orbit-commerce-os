// =============================================
// CHECKOUT ORDER SUMMARY - Sidebar desktop, collapsible mobile
// Uses centralized cartTotals for consistency
// Supports discount display and free shipping badge
// =============================================

import { useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { useDiscount, AppliedDiscount } from '@/contexts/DiscountContext';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, Loader2, ShoppingBag, Tag } from 'lucide-react';
import { calculateCartTotals, formatCurrency, formatPrice, debugCartTotals } from '@/lib/cartTotals';

type PaymentStatus = 'idle' | 'processing' | 'approved' | 'pending_payment' | 'failed';

interface CheckoutOrderSummaryProps {
  onSubmit: () => void;
  paymentStatus: PaymentStatus;
  discount?: number;
  appliedDiscount?: AppliedDiscount | null;
  freeShipping?: boolean;
}

export function CheckoutOrderSummary({ 
  onSubmit, 
  paymentStatus, 
  discount = 0,
  appliedDiscount,
  freeShipping = false,
}: CheckoutOrderSummaryProps) {
  const { items, shipping } = useCart();
  const [isOpen, setIsOpen] = useState(false);

  // Handle free shipping from discount
  const effectiveShipping = freeShipping 
    ? (shipping.selected ? { ...shipping.selected, price: 0, isFree: true } : null)
    : shipping.selected;

  // Use centralized totals calculation
  const totals = calculateCartTotals({
    items,
    selectedShipping: effectiveShipping,
    discountAmount: discount,
  });

  // Debug helper (dev only, triggered by ?debugCart=1)
  debugCartTotals('CheckoutOrderSummary', totals, shipping);

  const isProcessing = paymentStatus === 'processing';

  const ItemsList = () => (
    <div className="space-y-3">
      {items.map(item => (
        <div key={item.id} className="flex gap-3">
          <div className="w-12 h-12 bg-muted rounded-md overflow-hidden shrink-0">
            {item.image_url ? (
              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                <ShoppingBag className="h-4 w-4" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium line-clamp-1">{item.name}</p>
            <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
          </div>
          <p className="text-sm font-medium">
            R$ {formatPrice(item.price * item.quantity)}
          </p>
        </div>
      ))}
    </div>
  );

  const SummaryTotals = () => (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">Subtotal ({totals.itemCount} {totals.itemCount === 1 ? 'item' : 'itens'})</span>
        <span>{formatCurrency(totals.subtotal)}</span>
      </div>
      
      {effectiveShipping && (
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Frete ({effectiveShipping.label})</span>
          <span>
            {effectiveShipping.isFree || freeShipping ? (
              <span className="sf-tag-success font-medium px-2 py-0.5 rounded text-xs">Grátis</span>
            ) : (
              formatCurrency(totals.shippingTotal)
            )}
          </span>
        </div>
      )}

      {/* Discount line with coupon badge */}
      {(totals.discountTotal > 0 || appliedDiscount) && (
        <div className="flex justify-between text-sm sf-tag-success px-2 py-1 rounded">
          <span className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            {appliedDiscount?.discount_name || 'Desconto'}
            {appliedDiscount?.discount_code && (
              <Badge variant="secondary" className="text-xs px-1.5 py-0 font-mono">
                {appliedDiscount.discount_code}
              </Badge>
            )}
          </span>
          <span>- {formatCurrency(totals.discountTotal)}</span>
        </div>
      )}

      {/* Free shipping badge (separate from discount) */}
      {freeShipping && !effectiveShipping && (
        <div className="flex justify-between text-sm sf-tag-success px-2 py-1 rounded">
          <span className="flex items-center gap-1.5">
            <Tag className="h-3.5 w-3.5" />
            Frete grátis aplicado
          </span>
        </div>
      )}

      <Separator />

      <div className="flex justify-between font-semibold text-lg">
        <span>Total</span>
        <span>{formatCurrency(totals.grandTotal)}</span>
      </div>
    </div>
  );

  // Desktop version - sidebar (uses container query class sf-checkout-summary-desktop)
  const DesktopSummary = () => (
    <div className="sf-checkout-summary-desktop sticky top-4">
      <div className="p-6 border rounded-lg bg-card">
        <h3 className="font-semibold text-lg mb-4">Resumo do pedido</h3>
        
        <ItemsList />
        
        <Separator className="my-4" />
        
        <SummaryTotals />

        <Button 
          size="lg" 
          className="w-full mt-6"
          onClick={onSubmit}
          disabled={isProcessing || items.length === 0}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            'Finalizar pedido'
          )}
        </Button>
      </div>
    </div>
  );

  // Mobile version - collapsible with always visible total (uses container query class sf-checkout-summary-mobile)
  const MobileSummary = () => (
    <div className="sf-checkout-summary-mobile fixed bottom-0 left-0 right-0 bg-background border-t z-50">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
            <div className="flex items-center gap-2">
              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
              <span className="text-sm font-medium">
                {isOpen ? 'Ocultar resumo' : 'Ver resumo'}
              </span>
            </div>
            <span className="font-semibold">
              {formatCurrency(totals.grandTotal)}
            </span>
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-2 max-h-[40vh] overflow-y-auto">
            <ItemsList />
            <Separator className="my-4" />
            <SummaryTotals />
          </div>
        </CollapsibleContent>
      </Collapsible>

      <div className="p-4 pt-0 pb-safe">
        <Button 
          size="lg" 
          className="w-full"
          onClick={onSubmit}
          disabled={isProcessing || items.length === 0}
        >
          {isProcessing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Processando...
            </>
          ) : (
            `Finalizar • ${formatCurrency(totals.grandTotal)}`
          )}
        </Button>
      </div>
    </div>
  );

  return (
    <>
      <DesktopSummary />
      <MobileSummary />
    </>
  );
}
