// =============================================
// USE CART TRACKING
// Inserts a record into the `carts` table whenever
// a cart goes from empty → has items (one record per session).
// Used by CartProvider to feed the Dashboard funnel metrics.
// =============================================

import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Tracks cart creation events by inserting into the `carts` table
 * when items are first added to the cart.
 * 
 * @param tenantId - The tenant UUID
 * @param itemCount - Current number of items in cart
 */
export function useCartTracking(tenantId: string, itemCount: number) {
  const hasTracked = useRef(false);

  useEffect(() => {
    if (!tenantId || itemCount === 0 || hasTracked.current) return;

    hasTracked.current = true;

    // Get or create a session ID for this browser session
    const sessionKey = `cart_session_${tenantId}`;
    let sessionId = sessionStorage.getItem(sessionKey);
    
    if (sessionId) {
      // Already tracked this session
      return;
    }

    sessionId = crypto.randomUUID();
    sessionStorage.setItem(sessionKey, sessionId);

    supabase
      .from('carts')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        status: 'active',
      })
      .then(({ error }) => {
        if (error) {
          console.error('[CartTracking] Failed to insert cart record:', error.message);
          // Remove session so it retries
          sessionStorage.removeItem(sessionKey);
          hasTracked.current = false;
        }
      });
  }, [tenantId, itemCount]);
}
