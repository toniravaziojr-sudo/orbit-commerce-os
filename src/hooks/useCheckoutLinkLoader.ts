// =============================================
// CHECKOUT LINK LOADER - Processes ?product= and ?link= URL params
// Fetches product data and auto-adds to cart on checkout page load
// =============================================

import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/contexts/CartContext';
import { useDiscount } from '@/contexts/DiscountContext';
import { getStoreHost } from '@/lib/storeHost';

interface CheckoutLinkLoaderOptions {
  tenantId: string;
}

interface LoaderState {
  isLoading: boolean;
  error: string | null;
  /** Price override from checkout link (null = use original price) */
  priceOverride: number | null;
  /** Shipping override from checkout link (null = calculate normally) */
  shippingOverride: number | null;
  /** Checkout link slug used (for tracking) */
  linkSlug: string | null;
}

/**
 * Hook that reads checkout URL parameters and auto-populates the cart.
 * 
 * Supports two modes:
 * 1. ?product={slug}&qty={n} — Direct product link (simple add to cart)
 * 2. ?link={slug} — Custom checkout link with overrides (price, shipping, coupon, additional products)
 */
export function useCheckoutLinkLoader({ tenantId }: CheckoutLinkLoaderOptions): LoaderState {
  const { items, addItem, clearCart } = useCart();
  const { applyDiscount } = useDiscount();
  const processedRef = useRef(false);
  const [state, setState] = useState<LoaderState>({
    isLoading: false,
    error: null,
    priceOverride: null,
    shippingOverride: null,
    linkSlug: null,
  });

  useEffect(() => {
    if (processedRef.current || !tenantId) return;

    const searchParams = new URLSearchParams(window.location.search);
    const productSlug = searchParams.get('product');
    const linkSlug = searchParams.get('link');

    if (!productSlug && !linkSlug) return;

    processedRef.current = true;

    const processDirectProductLink = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        const qty = Math.max(1, parseInt(searchParams.get('qty') || '1', 10) || 1);

        const { data: product, error } = await supabase
          .from('products')
          .select('id, name, slug, price, sku, status, product_images(url, sort_order)')
          .eq('tenant_id', tenantId)
          .eq('slug', productSlug!)
          .eq('status', 'active')
          .maybeSingle();

        if (error) throw error;
        if (!product) {
          setState(prev => ({ ...prev, isLoading: false, error: 'Produto não encontrado' }));
          return;
        }

        // Clear cart and add the product
        clearCart();
        const mainImage = (product.product_images as any[])
          ?.sort((a: any, b: any) => (a.sort_order ?? 999) - (b.sort_order ?? 999))[0]?.url;

        addItem({
          product_id: product.id,
          name: product.name,
          sku: product.sku || '',
          price: product.price,
          quantity: qty,
          image_url: mainImage || '',
        });

        console.log('[CheckoutLinkLoader] Direct product link loaded:', product.name, 'qty:', qty);
        setState(prev => ({ ...prev, isLoading: false }));
      } catch (err: any) {
        console.error('[CheckoutLinkLoader] Error loading direct product:', err);
        setState(prev => ({ ...prev, isLoading: false, error: err.message }));
      }
    };

    const processCheckoutLink = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      try {
        // Fetch the checkout link with its product
        const { data: link, error } = await supabase
          .from('checkout_links')
          .select('*, products(id, name, slug, price, sku, status, product_images(url, sort_order))')
          .eq('tenant_id', tenantId)
          .eq('slug', linkSlug!)
          .eq('is_active', true)
          .maybeSingle();

        if (error) throw error;
        if (!link) {
          setState(prev => ({ ...prev, isLoading: false, error: 'Link de checkout não encontrado ou expirado' }));
          return;
        }

        // Check expiration
        if (link.expires_at && new Date(link.expires_at) < new Date()) {
          setState(prev => ({ ...prev, isLoading: false, error: 'Este link de checkout expirou' }));
          return;
        }

        const product = link.products as any;
        if (!product || product.status !== 'active') {
          setState(prev => ({ ...prev, isLoading: false, error: 'Produto do link não está disponível' }));
          return;
        }

        // Increment click count (fire-and-forget)
        supabase
          .from('checkout_links')
          .update({ click_count: (link.click_count || 0) + 1 })
          .eq('id', link.id)
          .then(() => {});

        // Clear cart and add main product
        clearCart();
        const mainImage = (product.product_images as any[])
          ?.sort((a: any, b: any) => (a.sort_order ?? 999) - (b.sort_order ?? 999))[0]?.url;

        const effectivePrice = link.price_override != null ? Number(link.price_override) : product.price;

        addItem({
          product_id: product.id,
          name: product.name,
          sku: product.sku || '',
          price: effectivePrice,
          quantity: link.quantity || 1,
          image_url: mainImage || '',
        });

        // Add additional products if any
        const additionalProducts = link.additional_products as Array<{ product_id: string; quantity: number }> | null;
        if (additionalProducts && additionalProducts.length > 0) {
          const productIds = additionalProducts.map(p => p.product_id);
          const { data: extraProducts } = await supabase
            .from('products')
            .select('id, name, slug, price, sku, status, product_images(url, sort_order)')
            .in('id', productIds)
            .eq('tenant_id', tenantId)
            .eq('status', 'active');

          if (extraProducts) {
            for (const extra of extraProducts) {
              const addConfig = additionalProducts.find(p => p.product_id === extra.id);
              const extraImage = (extra.product_images as any[])
                ?.sort((a: any, b: any) => (a.sort_order ?? 999) - (b.sort_order ?? 999))[0]?.url;

              addItem({
                product_id: extra.id,
                name: extra.name,
                sku: extra.sku || '',
                price: extra.price,
                quantity: addConfig?.quantity || 1,
                image_url: extraImage || '',
              });
            }
          }
        }

        // Apply coupon if specified
        // Apply coupon if specified (fire-and-forget, non-blocking)
        if (link.coupon_code) {
          const storeHost = getStoreHost();
          try {
            await applyDiscount(storeHost, link.coupon_code, effectivePrice * (link.quantity || 1));
            console.log('[CheckoutLinkLoader] Coupon applied:', link.coupon_code);
          } catch (couponErr) {
            console.warn('[CheckoutLinkLoader] Failed to apply coupon:', link.coupon_code, couponErr);
          }
        }

        console.log('[CheckoutLinkLoader] Checkout link loaded:', link.name);
        setState({
          isLoading: false,
          error: null,
          priceOverride: link.price_override != null ? Number(link.price_override) : null,
          shippingOverride: link.shipping_override != null ? Number(link.shipping_override) : null,
          linkSlug: linkSlug!,
        });
      } catch (err: any) {
        console.error('[CheckoutLinkLoader] Error loading checkout link:', err);
        setState(prev => ({ ...prev, isLoading: false, error: err.message }));
      }
    };

    if (linkSlug) {
      processCheckoutLink();
    } else if (productSlug) {
      processDirectProductLink();
    }
  }, [tenantId, addItem, clearCart, applyDiscount]);

  return state;
}
