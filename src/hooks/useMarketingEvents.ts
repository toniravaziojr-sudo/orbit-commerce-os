// =============================================
// USE MARKETING EVENTS
// Hook for tracking marketing events in storefront
// =============================================
// Phase 2: Deterministic event_id for Purchase
// Phase 5: PII enrichment for checkout events

import { useCallback, useRef } from 'react';
import { useMarketingTracker } from '@/components/storefront/MarketingTrackerProvider';
import { useCart } from '@/contexts/CartContext';
import { generateDeterministicPurchaseEventId } from '@/lib/marketingTracker';

/**
 * Resolve the Meta-facing content_id for a cart item or product.
 * Priority: meta_retailer_id > sku > product_id (UUID as last resort)
 */
function resolveItemMetaId(item: {
  product_id?: string;
  id?: string;
  sku?: string;
  meta_retailer_id?: string | null;
}): string {
  return item.meta_retailer_id || item.sku || item.product_id || item.id || '';
}

export interface CheckoutUserData {
  email?: string;
  phone?: string;
  name?: string;
  city?: string;
  state?: string;
  zip?: string;
}

/**
 * Hook to dispatch marketing events throughout the storefront
 */
export function useMarketingEvents() {
  const { tracker } = useMarketingTracker();
  const { items, subtotal, shipping } = useCart();
  const trackedRef = useRef<Set<string>>(new Set());

  const trackOnce = useCallback((key: string, fn: () => void) => {
    if (trackedRef.current.has(key)) return;
    trackedRef.current.add(key);
    fn();
    setTimeout(() => trackedRef.current.delete(key), 1000);
  }, []);

  const mapCartItemsForTracker = useCallback(() => {
    return items.map(item => ({
      id: item.product_id,
      sku: item.sku,
      metaContentId: item.meta_retailer_id || null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
    }));
  }, [items]);

  // Track category view
  const trackViewCategory = useCallback((category: {
    id: string;
    name: string;
    slug: string;
    productIds?: string[];
  }) => {
    if (!tracker) return;
    const key = `category_${category.id}`;
    trackOnce(key, () => {
      tracker.trackViewCategory({
        id: category.id,
        name: category.name,
        productIds: category.productIds,
      });
    });
  }, [tracker, trackOnce]);

  // Track product view
  const trackViewContent = useCallback((product: {
    id: string;
    sku?: string;
    meta_retailer_id?: string | null;
    name: string;
    price: number;
    category?: string;
  }) => {
    if (!tracker) return;
    const key = `product_${product.id}`;
    trackOnce(key, () => {
      tracker.trackViewContent({
        id: product.id,
        sku: product.sku,
        metaContentId: product.meta_retailer_id || null,
        name: product.name,
        price: product.price,
        category: product.category,
        currency: 'BRL',
      });
    });
  }, [tracker, trackOnce]);

  // Track add to cart
  const trackAddToCart = useCallback((item: {
    id: string;
    sku?: string;
    meta_retailer_id?: string | null;
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }) => {
    if (!tracker) return;
    tracker.trackAddToCart({
      id: item.id,
      sku: item.sku,
      metaContentId: item.meta_retailer_id || null,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      category: item.category,
      currency: 'BRL',
    });
  }, [tracker]);

  // Track initiate checkout
  const trackInitiateCheckout = useCallback(() => {
    if (!tracker || items.length === 0) return;
    const key = `checkout_${items.map(i => i.product_id).join('_')}`;
    trackOnce(key, () => {
      tracker.trackInitiateCheckout({
        items: mapCartItemsForTracker(),
        value: subtotal + (shipping.selected?.price || 0),
        currency: 'BRL',
      });
    });
  }, [tracker, items, subtotal, shipping.selected, trackOnce, mapCartItemsForTracker]);

  // Track lead (personal info submitted) — Phase 5: includes PII
  const trackLead = useCallback((customer: {
    email?: string;
    phone?: string;
    name?: string;
  }) => {
    if (!tracker) return;
    const key = `lead_${customer.email || 'anon'}`;
    trackOnce(key, () => {
      tracker.trackLead({
        email: customer.email,
        phone: customer.phone,
        name: customer.name,
        value: subtotal,
        currency: 'BRL',
      });
    });
  }, [tracker, subtotal, trackOnce]);

  // Track shipping info — Phase 5: accepts userData for PII enrichment
  const trackAddShippingInfo = useCallback((shippingTier: string, userData?: CheckoutUserData) => {
    if (!tracker || items.length === 0) return;
    const key = `shipping_${shippingTier}`;
    trackOnce(key, () => {
      tracker.trackAddShippingInfo({
        value: subtotal + (shipping.selected?.price || 0),
        currency: 'BRL',
        shippingTier,
        items: mapCartItemsForTracker(),
        userData,
      });
    });
  }, [tracker, items, subtotal, shipping.selected, trackOnce, mapCartItemsForTracker]);

  // Track payment info — Phase 5: accepts userData for PII enrichment
  const trackAddPaymentInfo = useCallback((paymentMethod: string, userData?: CheckoutUserData) => {
    if (!tracker || items.length === 0) return;
    const key = `payment_${paymentMethod}`;
    trackOnce(key, () => {
      tracker.trackAddPaymentInfo({
        value: subtotal + (shipping.selected?.price || 0),
        currency: 'BRL',
        paymentMethod,
        items: mapCartItemsForTracker(),
        userData,
      });
    });
  }, [tracker, items, subtotal, shipping.selected, trackOnce, mapCartItemsForTracker]);

  // Track purchase — Phase 2: deterministic event_id, Phase 5: PII enrichment
  const trackPurchase = useCallback((order: {
    order_id: string;
    value: number;
    items: Array<{ id: string; sku?: string; meta_retailer_id?: string | null; name: string; price: number; quantity: number }>;
    purchaseEventTiming?: 'all_orders' | 'paid_only';
    userData?: CheckoutUserData;
  }) => {
    if (!tracker) return;
    const key = `purchase_${order.order_id}`;
    trackOnce(key, () => {
      // Phase 2: Generate deterministic event_id based on mode
      const mode = order.purchaseEventTiming || 'all_orders';
      const deterministicEventId = generateDeterministicPurchaseEventId(mode, order.order_id);

      tracker.trackPurchase({
        order_id: order.order_id,
        value: order.value,
        currency: 'BRL',
        event_id: deterministicEventId,
        items: order.items.map(i => ({
          id: i.id,
          sku: i.sku,
          metaContentId: i.meta_retailer_id || null,
          name: i.name,
          price: i.price,
          quantity: i.quantity,
        })),
        userData: order.userData,
      });
    });
  }, [tracker, trackOnce]);

  return {
    trackViewCategory,
    trackViewContent,
    trackAddToCart,
    trackInitiateCheckout,
    trackLead,
    trackAddShippingInfo,
    trackAddPaymentInfo,
    trackPurchase,
  };
}