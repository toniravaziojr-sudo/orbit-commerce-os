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

    // Check sessionStorage BEFORE marking as tracked
    const sessionKey = `cart_session_${tenantId}`;
    const existingSessionId = sessionStorage.getItem(sessionKey);
    
    if (existingSessionId) {
      // Already tracked this browser session — skip
      hasTracked.current = true;
      return;
    }

    const sessionId = crypto.randomUUID();

    // Insert first, only persist sessionKey on success
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
          // Don't mark as tracked so it retries on next render
        } else {
          console.log('[CartTracking] Cart record inserted for session:', sessionId);
          sessionStorage.setItem(sessionKey, sessionId);
          hasTracked.current = true;
        }
      });
  }, [tenantId, itemCount]);
}