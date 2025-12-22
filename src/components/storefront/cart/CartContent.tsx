// =============================================
// CART CONTENT - Main cart page content
// =============================================

import { CartItemsList } from './CartItemsList';
import { CartSummary } from './CartSummary';
import { ShippingEstimator } from './ShippingEstimator';
import { BenefitProgressBar } from './BenefitProgressBar';
import { CrossSellSection } from './CrossSellSection';
import { BundlesSection } from './BundlesSection';
import { BuyTogetherSection } from './BuyTogetherSection';
import { CouponInput } from '@/components/storefront/CouponInput';
import { useCart } from '@/contexts/CartContext';
import { useDiscount } from '@/contexts/DiscountContext';
import { useParams } from 'react-router-dom';

interface CartContentProps {
  tenantId: string;
}

export function CartContent({ tenantId }: CartContentProps) {
  const { items, subtotal } = useCart();
  const { tenantSlug } = useParams();
  const { appliedDiscount, applyDiscount, removeDiscount } = useDiscount();
  const hasItems = items.length > 0;

  // Build store host for discount validation
  const storeHost = `${tenantSlug}.shops.${window.location.hostname.includes('localhost') ? 'comandocentral.com.br' : window.location.hostname.split('.').slice(-2).join('.')}`;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Meu Carrinho</h1>

      {/* Benefit Progress Bar - Always at top when has items */}
      {hasItems && (
        <div className="mb-6">
          <BenefitProgressBar />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column - Cart Items + AOV */}
        <div className="lg:col-span-2 space-y-8">
          <CartItemsList />

          {/* Shipping Estimator */}
          {hasItems && (
            <div className="border rounded-lg p-4">
              <ShippingEstimator />
            </div>
          )}

          {/* Coupon Input */}
          {hasItems && (
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

          {/* AOV Sections - Only show when has items */}
          {hasItems && (
            <>
              <CrossSellSection tenantId={tenantId} />
              <BundlesSection tenantId={tenantId} />
              <BuyTogetherSection tenantId={tenantId} />
            </>
          )}
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
