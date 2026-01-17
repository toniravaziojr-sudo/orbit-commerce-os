// =============================================
// CART CONTENT - Main cart page content
// Respects cart_config settings
// REGRA: Carrinho tem APENAS Cross-sell
// Order Bump fica no CHECKOUT
// Compre Junto fica na página do PRODUTO
// =============================================

import { CartItemsList } from './CartItemsList';
import { CartSummary } from './CartSummary';
import { ShippingEstimator } from './ShippingEstimator';
import { BenefitProgressBar } from './BenefitProgressBar';
import { CrossSellSection } from './CrossSellSection';
import { CartPromoBanner } from './CartPromoBanner';
import { CouponInput } from '@/components/storefront/CouponInput';
import { useCart } from '@/contexts/CartContext';
import { useDiscount } from '@/contexts/DiscountContext';
import { useCartConfig } from '@/contexts/StorefrontConfigContext';
import { getStoreHost } from '@/lib/storeHost';

interface CartContentProps {
  tenantId: string;
  showCrossSell?: boolean;
  showCoupon?: boolean;
  showShipping?: boolean;
  showBenefitBar?: boolean;
}

export function CartContent({ 
  tenantId, 
  showCrossSell = true,
  showCoupon,
  showShipping,
  showBenefitBar = true,
}: CartContentProps) {
  const { items, subtotal } = useCart();
  const { appliedDiscount, applyDiscount, removeDiscount } = useDiscount();
  const { config: cartConfig } = useCartConfig();
  const hasItems = items.length > 0;
  
  // Props take precedence over cartConfig, with sensible defaults
  const effectiveShowCrossSell = showCrossSell;
  const effectiveShowCoupon = showCoupon ?? cartConfig.couponEnabled;
  const effectiveShowShipping = showShipping ?? cartConfig.shippingCalculatorEnabled;
  const effectiveShowBenefitBar = showBenefitBar;

  // Use centralized store host helper - always sends actual browser host
  const storeHost = getStoreHost();

  // Empty cart - single unified empty state (anti-duplication)
  if (!hasItems) {
    return (
      <div className="container mx-auto px-4 py-8">
        <CartPromoBanner config={cartConfig} location="cart_page" />
        <h1 className="text-2xl font-bold mb-6">Meu Carrinho</h1>
        <CartSummary variant="default" />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Cart Promo Banner - Conditional based on cart_config */}
      <CartPromoBanner config={cartConfig} location="cart_page" />
      
      <h1 className="text-2xl font-bold mb-6">Meu Carrinho</h1>

      {/* Benefit Progress Bar - Conditional */}
      {effectiveShowBenefitBar && (
        <div className="mb-6">
          <BenefitProgressBar />
        </div>
      )}

      {/* Cart Layout - uses container query class for responsive behavior */}
      <div className="sf-cart-layout">
        {/* Main Column - Cart Items + Cross-sell */}
        <div className="space-y-6">
          <CartItemsList />

          {/* Shipping Estimator */}
          {effectiveShowShipping && (
            <div className="border rounded-lg p-4">
              <ShippingEstimator />
            </div>
          )}

          {/* Coupon Input */}
          {effectiveShowCoupon && (
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium mb-3">Cupom de desconto</h3>
              <CouponInput
                storeHost={storeHost}
                subtotal={subtotal}
                appliedDiscount={appliedDiscount}
                onApply={(discount) => {
                  applyDiscount(storeHost, discount.discount_code, subtotal);
                }}
                onRemove={removeDiscount}
              />
            </div>
          )}

          {/* Cross-sell - Conditional based on page settings */}
          {effectiveShowCrossSell && <CrossSellSection tenantId={tenantId} />}
        </div>

        {/* Sidebar - Order Summary */}
        <div className="sf-cart-summary">
          <CartSummary variant="sticky" />
        </div>
      </div>

      {/* Mobile Bottom Bar - shows on small screens */}
      <CartSummary variant="mobile-bar" />

      {/* Mobile spacer */}
      <div className="h-24 sf-show-mobile sf-hide-desktop" />
    </div>
  );
}
