// =============================================
// STOREFRONT CHECKOUT PREFETCH
// Triggers async download of the checkout chunk + warms
// the bootstrap cache so the cart→checkout transition
// is instant (no Suspense fallback, no second loader).
// =============================================

import { useEffect } from 'react';

let checkoutChunkPromise: Promise<unknown> | null = null;

/**
 * Eagerly downloads the StorefrontCheckout chunk.
 * Safe to call multiple times — the import is memoized.
 */
export function prefetchCheckoutChunk(): Promise<unknown> {
  if (!checkoutChunkPromise) {
    checkoutChunkPromise = import('@/pages/storefront/StorefrontCheckout').catch((err) => {
      // If the prefetch fails, allow a future retry
      checkoutChunkPromise = null;
      throw err;
    });
  }
  return checkoutChunkPromise;
}

/**
 * React hook variant — fires the prefetch on mount.
 * Use it on the cart page so the checkout JS is already in cache
 * when the user clicks "Finalizar".
 */
export function usePrefetchCheckout(enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    // Defer slightly so it doesn't compete with cart's own LCP work
    const id = window.setTimeout(() => {
      void prefetchCheckoutChunk();
    }, 200);
    return () => window.clearTimeout(id);
  }, [enabled]);
}
