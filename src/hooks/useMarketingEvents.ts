// =============================================
// USE MARKETING EVENTS
// Hook for tracking marketing events in storefront
// =============================================

import { useCallback, useRef } from 'react';
import { useMarketingTracker } from '@/components/storefront/MarketingTrackerProvider';
import { useCart } from '@/contexts/CartContext';

/**
 * Hook to dispatch marketing events throughout the storefront
 * Provides functions for each event type with proper deduplication
 */
export function useMarketingEvents() {
  const { tracker } = useMarketingTracker();
  const { items, subtotal, shipping } = useCart();
  const trackedRef = useRef<Set<string>>(new Set());

  // Dedupe helper - prevents double-firing in React StrictMode
  const trackOnce = useCallback((key: string, fn: () => void) => {
    if (trackedRef.current.has(key)) return;
    trackedRef.current.add(key);
    fn();
    // Clear after a short delay to allow re-tracking on new navigation
    setTimeout(() => trackedRef.current.delete(key), 1000);
  }, []);

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
    name: string;
    price: number;
    category?: string;
  }) => {
    if (!tracker) return;
    const key = `product_${product.id}`;
    trackOnce(key, () => {
      tracker.trackViewContent({
        id: product.id,
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
    name: string;
    price: number;
    quantity: number;
    category?: string;
  }) => {
    if (!tracker) return;
    // No dedup for add to cart - user can add multiple times
    tracker.trackAddToCart({
      id: item.id,
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
        items: items.map(item => ({
          id: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        value: subtotal + (shipping.selected?.price || 0),
        currency: 'BRL',
      });
    });
  }, [tracker, items, subtotal, shipping.selected, trackOnce]);

  // Track lead (personal info submitted)
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

  // Track shipping info added
  const trackAddShippingInfo = useCallback((shippingTier: string) => {
    if (!tracker || items.length === 0) return;
    const key = `shipping_${shippingTier}`;
    trackOnce(key, () => {
      tracker.trackAddShippingInfo({
        value: subtotal + (shipping.selected?.price || 0),
        currency: 'BRL',
        shippingTier,
        items: items.map(item => ({
          id: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });
    });
  }, [tracker, items, subtotal, shipping.selected, trackOnce]);

  // Track payment info added
  const trackAddPaymentInfo = useCallback((paymentMethod: string) => {
    if (!tracker || items.length === 0) return;
    const key = `payment_${paymentMethod}`;
    trackOnce(key, () => {
      tracker.trackAddPaymentInfo({
        value: subtotal + (shipping.selected?.price || 0),
        currency: 'BRL',
        paymentMethod,
        items: items.map(item => ({
          id: item.product_id,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
      });
    });
  }, [tracker, items, subtotal, shipping.selected, trackOnce]);

  // Track purchase
  const trackPurchase = useCallback((order: {
    order_id: string;
    value: number;
    items: Array<{ id: string; name: string; price: number; quantity: number }>;
  }) => {
    if (!tracker) return;
    const key = `purchase_${order.order_id}`;
    trackOnce(key, () => {
      tracker.trackPurchase({
        order_id: order.order_id,
        value: order.value,
        currency: 'BRL',
        items: order.items,
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
