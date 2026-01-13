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
}

export function CartContent({ tenantId }: CartContentProps) {
  const { items, subtotal } = useCart();
  const { appliedDiscount, applyDiscount, removeDiscount } = useDiscount();
  const { config: cartConfig } = useCartConfig();
  const hasItems = items.length > 0;

  // Use centralized store host helper - always sends actual browser host
  const storeHost = getStoreHost();

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Cart Promo Banner - Conditional based on cart_config */}
      <CartPromoBanner config={cartConfig} />
      
      <h1 className="text-2xl font-bold mb-6">Meu Carrinho</h1>

      {/* Benefit Progress Bar - Always at top when has items */}
      {hasItems && (
        <div className="mb-6">
          <BenefitProgressBar />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column - Cart Items + Cross-sell APENAS */}
        <div className="lg:col-span-2 space-y-8">
          <CartItemsList />

          {/* Shipping Estimator - Conditional based on cart_config */}
          {hasItems && cartConfig.shippingCalculatorEnabled && (
            <div className="border rounded-lg p-4">
              <ShippingEstimator />
            </div>
          )}

          {/* Coupon Input - Conditional based on cart_config */}
          {hasItems && cartConfig.couponEnabled && (
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

          {/* APENAS Cross-sell no carrinho - ofertas vêm do Aumentar Ticket */}
          {hasItems && cartConfig.crossSellEnabled && (
            <CrossSellSection tenantId={tenantId} />
          )}
          
          {/* REMOVIDO: BundlesSection e BuyTogetherSection
           * - Bundles/Buy Together ficam na página do PRODUTO
           * - Order Bump fica no CHECKOUT
           */}
        </div>

        {/* Sidebar - Order Summary (Sticky on desktop) */}
        <div className="hidden lg:block">
          <CartSummary variant="sticky" />
        </div>
      </div>

      {/* Mobile Bottom Bar */}
      <CartSummary variant="mobile-bar" />

      {/* Mobile spacer to prevent content being hidden behind bottom bar */}
      {hasItems && <div className="h-24 lg:hidden" />}
    </div>
  );
}
