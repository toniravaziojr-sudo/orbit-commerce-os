// =============================================
// USE VISITOR TRACKING
// Client-side visit tracking for SPA storefront routes
// Records visits to storefront_visits table via anon key
// Works alongside the Edge-rendered beacon in storefront-html
// =============================================

import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

/**
 * Cookie helpers — mirror the Edge-rendered beacon logic
 */
function getOrCreateVisitorId(): string {
  const match = document.cookie.match(/(?:^|;\s*)_sf_vid=([^;]*)/);
  if (match) return decodeURIComponent(match[1]);

  const id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  const expires = new Date();
  expires.setFullYear(expires.getFullYear() + 1);
  document.cookie = `_sf_vid=${id};path=/;expires=${expires.toUTCString()};SameSite=Lax`;
  return id;
}

/**
 * Determine page type from pathname
 */
function resolvePageType(pathname: string): string {
  if (pathname.match(/\/produto\//)) return 'product';
  if (pathname.match(/\/categoria\//) || pathname.match(/\/colecao\//)) return 'category';
  if (pathname.match(/\/blog/)) return 'blog';
  if (pathname.match(/\/cart|\/carrinho/)) return 'cart';
  if (pathname.match(/\/checkout/)) return 'checkout';
  if (pathname === '/' || pathname.match(/\/store\/[^/]+\/?$/)) return 'home';
  return 'page';
}

/**
 * Hook that tracks page visits on every route change.
 * Uses the same _sf_vid cookie and storefront_visits table as the Edge beacon.
 * Deduplicates: only fires once per pathname per session.
 */
export function useVisitorTracking(tenantId: string | undefined) {
  const location = useLocation();
  const trackedPaths = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!tenantId) return;

    const pathname = location.pathname;
    // Deduplicate within session — don't re-track same path
    if (trackedPaths.current.has(pathname)) return;
    trackedPaths.current.add(pathname);

    const visitorId = getOrCreateVisitorId();
    const pageType = resolvePageType(pathname);

    // Fire and forget — use the Supabase client (uses anon key)
    supabase
      .from('storefront_visits' as any)
      .insert({
        tenant_id: tenantId,
        visitor_id: visitorId,
        page_path: pathname,
        page_type: pageType,
        referrer: document.referrer || null,
        user_agent: navigator.userAgent || null,
      } as any)
      .then(({ error }) => {
        if (error) {
          console.warn('[useVisitorTracking] Failed to record visit:', error.message);
        }
      });
  }, [tenantId, location.pathname]);
}