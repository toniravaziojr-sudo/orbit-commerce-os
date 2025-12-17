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
import { useCart } from '@/contexts/CartContext';

interface CartContentProps {
  tenantId: string;
}

export function CartContent({ tenantId }: CartContentProps) {
  const { items } = useCart();
  const hasItems = items.length > 0;

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
