import { ShoppingCart, Tag, CreditCard } from 'lucide-react';
import { formatCurrency } from '@/lib/cartTotals';
import type { AppliedDiscount } from '@/contexts/DiscountContext';

interface OrderSummarySidebarProps {
  items: any[];
  totals: {
    subtotal: number;
    shippingTotal: number;
    discountTotal: number;
    grandTotal: number;
    itemCount: number;
    totalItems: number;
    paymentMethodDiscount?: number;
  };
  shipping: any;
  appliedDiscount?: AppliedDiscount | null;
  freeShipping?: boolean;
  paymentMethodDiscountAmount?: number;
  paymentMethod?: string;
}

// Order Summary Sidebar
export function OrderSummarySidebar({
  items,
  totals,
  shipping,
  appliedDiscount,
  freeShipping,
  paymentMethodDiscountAmount = 0,
  paymentMethod,
}: OrderSummarySidebarProps) {
  const methodLabel =
    paymentMethod === 'pix' ? 'PIX' :
    paymentMethod === 'boleto' ? 'Boleto' :
    paymentMethod === 'credit_card' ? 'Cartão' : '';

  return (
    <div className="bg-card border rounded-lg p-4">
      <h3 className="font-semibold mb-4">Resumo do pedido</h3>

      {/* Items preview */}
      <div className="space-y-3 mb-4 max-h-48 overflow-y-auto">
        {items.map((item) => (
          <div key={item.id} className="flex gap-3">
            <div className="w-12 h-12 bg-muted rounded overflow-hidden flex-shrink-0">
              {item.image_url ? (
                <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium line-clamp-1">{item.name}</p>
              <p className="text-xs text-muted-foreground">Qtd: {item.quantity}</p>
            </div>
            <p className="text-sm font-medium">{formatCurrency(item.price * item.quantity)}</p>
          </div>
        ))}
      </div>

      <div className="border-t pt-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span>Subtotal ({totals.totalItems} {totals.totalItems === 1 ? 'item' : 'itens'})</span>
          <span>{formatCurrency(totals.subtotal)}</span>
        </div>
        <div className="flex justify-between text-muted-foreground">
          <span>Frete</span>
          <span>
            {!shipping ? 'A calcular' : freeShipping ? (
              <span className="sf-flag-text font-medium" style={{ color: 'var(--theme-flags-color, var(--theme-accent-color, #22c55e))' }}>Grátis</span>
            ) : (
              formatCurrency(totals.shippingTotal)
            )}
          </span>
        </div>
        {shipping && (
          <div className="text-xs text-muted-foreground">
            {shipping.label} • {shipping.deliveryDays} dia(s)
          </div>
        )}

        {/* Coupon discount line */}
        {(totals.discountTotal > 0 || appliedDiscount) && (
          <div className="flex justify-between" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
            <span className="flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" />
              {appliedDiscount?.discount_name || 'Desconto'}
              {appliedDiscount?.is_auto_applied && (
                <span className="text-xs font-normal">(automático)</span>
              )}
            </span>
            <span>- {formatCurrency(totals.discountTotal)}</span>
          </div>
        )}

        {/* Payment method discount line */}
        {paymentMethodDiscountAmount > 0 && (
          <div className="flex justify-between" style={{ color: 'var(--theme-accent-color, #22c55e)' }}>
            <span className="flex items-center gap-1">
              <CreditCard className="h-3.5 w-3.5" />
              Desconto {methodLabel}
            </span>
            <span>- {formatCurrency(paymentMethodDiscountAmount)}</span>
          </div>
        )}

        <div className="flex justify-between font-bold text-base pt-2 border-t">
          <span>Total</span>
          <span>{formatCurrency(totals.grandTotal)}</span>
        </div>
      </div>
    </div>
  );
}
