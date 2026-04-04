/**
 * Storefront Cache Purge & Auto-Update Utilities
 * 
 * Provides two layers:
 * 1. `cachePurge.*` — CDN-only purge (used for manual "Clear Cache" button)
 * 2. `storefrontAutoUpdate()` — Full pipeline: stale → purge → re-prerender
 *    (used by all admin mutations that affect storefront content)
 */

import { supabase } from '@/integrations/supabase/client';

type ResourceType = 'product' | 'category' | 'template' | 'settings' | 'menu' | 'full';

interface PurgeOptions {
  tenantId: string;
  resourceType: ResourceType;
  resourceSlug?: string;
}

/**
 * Purge storefront edge cache (CDN only — step 2 of 3).
 * Fire-and-forget: does not throw, logs errors silently.
 */
export async function purgeStorefrontCache(options: PurgeOptions): Promise<void> {
  const { tenantId, resourceType, resourceSlug } = options;

  try {
    const { error } = await supabase.functions.invoke('storefront-cache-purge', {
      body: {
        tenant_id: tenantId,
        resource_type: resourceType,
        resource_slug: resourceSlug,
      },
    });

    if (error) {
      console.warn('[cache-purge] Failed to purge cache:', error.message);
    } else {
      console.log(`[cache-purge] Purged ${resourceType}${resourceSlug ? '/' + resourceSlug : ''}`);
    }
  } catch (err) {
    console.warn('[cache-purge] Error:', err);
  }
}

/**
 * Convenience wrappers for CDN-only purge.
 * 
 * ⚠️ These only purge CDN cache (step 2 of 3).
 * For admin mutations, use `storefrontAutoUpdate()` instead.
 * Keep these for: manual "Clear Cache" button, Builder publish flow (has own pipeline).
 */
export const cachePurge = {
  product: (tenantId: string, slug?: string) =>
    purgeStorefrontCache({ tenantId, resourceType: 'product', resourceSlug: slug }),

  category: (tenantId: string, slug?: string) =>
    purgeStorefrontCache({ tenantId, resourceType: 'category', resourceSlug: slug }),

  template: (tenantId: string) =>
    purgeStorefrontCache({ tenantId, resourceType: 'template' }),

  settings: (tenantId: string) =>
    purgeStorefrontCache({ tenantId, resourceType: 'settings' }),

  menu: (tenantId: string) =>
    purgeStorefrontCache({ tenantId, resourceType: 'menu' }),

  full: (tenantId: string) =>
    purgeStorefrontCache({ tenantId, resourceType: 'full' }),
};

// ============================================
// STOREFRONT AUTO-UPDATE — Unified pipeline (stale + purge + re-prerender)
// ============================================

/** Module-level debounce state for storefront auto-update */
let storefrontAutoUpdateTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Unified storefront auto-update: marks prerendered pages as stale,
 * purges CDN cache, and triggers background re-prerender.
 * 
 * Coalesces multiple calls within `delayMs` into a single execution.
 * Fire-and-forget: errors are logged but never block the admin flow.
 * 
 * USE THIS for all admin mutations that affect storefront content:
 * - Category CRUD and product-category links
 * - Menu CRUD (useMenus)
 * - Store settings changes
 * 
 * DO NOT USE for:
 * - Product CRUD → handled server-side by core-products Edge Function
 * - Builder publish → has its own pipeline with retry and user feedback
 * - Manual "Clear Cache" button → use cachePurge.full()
 * 
 * @param tenantId - Tenant to update
 * @param reason - Trigger reason for logging (e.g. 'category_created', 'menu_updated')
 * @param delayMs - Debounce window (default 3000ms)
 */
export function storefrontAutoUpdate(
  tenantId: string,
  reason = 'storefront_change',
  delayMs = 3000
): void {
  if (storefrontAutoUpdateTimer) {
    clearTimeout(storefrontAutoUpdateTimer);
    storefrontAutoUpdateTimer = null;
  }

  console.log(`[storefront-auto-update] Debounce started: ${reason} for tenant ${tenantId} (${delayMs}ms)`);

  storefrontAutoUpdateTimer = setTimeout(async () => {
    storefrontAutoUpdateTimer = null;
    console.log(`[storefront-auto-update] Executing: ${reason} for tenant ${tenantId}`);

    try {
      // Step 1: Mark pages stale → Edge stops serving old HTML
      const { error: staleError } = await supabase
        .from('storefront_prerendered_pages')
        .update({ status: 'stale' })
        .eq('tenant_id', tenantId)
        .eq('status', 'active');

      if (staleError) {
        console.warn('[storefront-auto-update] Stale marking failed:', staleError.message);
      }

      // Step 2: Purge CDN cache
      await purgeStorefrontCache({ tenantId, resourceType: 'full' });

      // Step 3: Re-prerender (fire-and-forget)
      const { error: prerenderError } = await supabase.functions.invoke('storefront-prerender', {
        body: { tenant_id: tenantId, trigger_type: reason },
      });

      if (prerenderError) {
        console.warn('[storefront-auto-update] Re-prerender failed:', prerenderError.message);
      } else {
        console.log(`[storefront-auto-update] Done: ${reason}`);
      }
    } catch (err) {
      console.warn(`[storefront-auto-update] Pipeline error (${reason}):`, err);
    }
  }, delayMs);
}

/**
 * @deprecated Use `storefrontAutoUpdate()` instead. Kept for backward compatibility.
 */
export const catalogAutoUpdate = storefrontAutoUpdate;

/**
 * @deprecated Use `storefrontAutoUpdate()` instead. Kept for backward compatibility.
 */
export function menuAutoUpdate(
  tenantId: string,
  delayMs = 5000
): Promise<{ success: boolean; staleCount?: number; prerenderTriggered?: boolean; error?: string }> {
  return new Promise((resolve) => {
    // Reuse the unified timer
    if (storefrontAutoUpdateTimer) {
      clearTimeout(storefrontAutoUpdateTimer);
      storefrontAutoUpdateTimer = null;
    }

    console.log(`[storefront-auto-update] Menu debounce started for tenant ${tenantId} (${delayMs}ms)`);

    storefrontAutoUpdateTimer = setTimeout(async () => {
      storefrontAutoUpdateTimer = null;
      console.log(`[storefront-auto-update] Executing menu update for tenant ${tenantId}`);

      try {
        // Step 1: Mark stale
        const { data: staleResult, error: staleError } = await supabase
          .from('storefront_prerendered_pages')
          .update({ status: 'stale' })
          .eq('tenant_id', tenantId)
          .eq('status', 'active')
          .select('id');

        if (staleError) {
          console.warn('[storefront-auto-update] Stale marking failed:', staleError.message);
        }

        const staleCount = staleResult?.length || 0;

        // Step 2: Purge CDN
        await purgeStorefrontCache({ tenantId, resourceType: 'menu' });

        // Step 3: Re-prerender
        let prerenderTriggered = false;
        try {
          const { error: prerenderError } = await supabase.functions.invoke('storefront-prerender', {
            body: { tenant_id: tenantId, trigger_type: 'menu_update' },
          });
          prerenderTriggered = !prerenderError;
          if (prerenderError) {
            console.warn('[storefront-auto-update] Re-prerender failed:', prerenderError.message);
          }
        } catch (err) {
          console.warn('[storefront-auto-update] Re-prerender error:', err);
        }

        resolve({ success: true, staleCount, prerenderTriggered });
      } catch (err: any) {
        console.error('[storefront-auto-update] Pipeline error:', err);
        resolve({ success: false, error: err.message || 'Unknown error' });
      }
    }, delayMs);
  });
}
