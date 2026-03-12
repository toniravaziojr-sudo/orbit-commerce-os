/**
 * Storefront Cache Purge Utility
 * 
 * Call after saving products, templates, settings, or menus in the admin
 * to invalidate the edge-rendered HTML cache in Cloudflare.
 * 
 * This is fire-and-forget — errors are logged but don't block the user.
 */

import { supabase } from '@/integrations/supabase/client';

type ResourceType = 'product' | 'category' | 'template' | 'settings' | 'menu' | 'full';

interface PurgeOptions {
  tenantId: string;
  resourceType: ResourceType;
  resourceSlug?: string;
}

/**
 * Purge storefront edge cache after admin saves.
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
    // Fire and forget — don't break the admin flow
    console.warn('[cache-purge] Error:', err);
  }
}

/**
 * Convenience wrappers for common purge scenarios
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
// MENU AUTO-UPDATE — Debounced stale + purge + re-prerender
// ============================================

/** Module-level debounce state for menu auto-update */
let menuAutoUpdateTimer: ReturnType<typeof setTimeout> | null = null;
let menuAutoUpdatePending: string | null = null; // tenant_id waiting

interface MenuAutoUpdateResult {
  success: boolean;
  staleCount?: number;
  prerenderTriggered?: boolean;
  error?: string;
}

/**
 * Debounced menu auto-update: marks prerendered pages as stale,
 * purges CDN cache, and triggers background re-prerender.
 * 
 * Coalesces multiple calls within `delayMs` into a single execution.
 * Safe: if re-prerender fails, live-render fallback handles requests (~5s).
 * 
 * @param tenantId - Tenant to update
 * @param delayMs - Debounce window (default 5000ms)
 * @returns Promise that resolves when the debounced operation completes
 */
export function menuAutoUpdate(
  tenantId: string,
  delayMs = 5000
): Promise<MenuAutoUpdateResult> {
  return new Promise((resolve) => {
    // Clear any pending timer for this tenant
    if (menuAutoUpdateTimer) {
      clearTimeout(menuAutoUpdateTimer);
      menuAutoUpdateTimer = null;
    }

    menuAutoUpdatePending = tenantId;
    console.log(`[menu-auto-update] Debounce started for tenant ${tenantId} (${delayMs}ms)`);

    menuAutoUpdateTimer = setTimeout(async () => {
      menuAutoUpdateTimer = null;
      menuAutoUpdatePending = null;

      console.log(`[menu-auto-update] Executing for tenant ${tenantId}`);
      const result = await executeMenuAutoUpdate(tenantId);
      resolve(result);
    }, delayMs);
  });
}

/**
 * Internal: Execute the actual stale + purge + prerender pipeline.
 */
async function executeMenuAutoUpdate(tenantId: string): Promise<MenuAutoUpdateResult> {
  try {
    // Step 1: Mark ALL active prerendered pages as stale
    // This ensures the next visitor gets live-rendered content (fallback)
    console.log(`[menu-auto-update] Step 1: Marking pages stale for ${tenantId}`);
    const { data: staleResult, error: staleError } = await supabase
      .from('storefront_prerendered_pages')
      .update({ status: 'stale' })
      .eq('tenant_id', tenantId)
      .eq('status', 'active')
      .select('id');

    if (staleError) {
      console.warn('[menu-auto-update] Stale marking failed:', staleError.message);
      // Non-fatal: continue with cache purge
    }

    const staleCount = staleResult?.length || 0;
    console.log(`[menu-auto-update] Step 1 done: ${staleCount} pages marked stale`);

    // Step 2: Purge CDN cache (fire-and-forget)
    console.log(`[menu-auto-update] Step 2: Purging CDN cache`);
    await purgeStorefrontCache({ tenantId, resourceType: 'menu' });
    console.log(`[menu-auto-update] Step 2 done: CDN cache purged`);

    // Step 3: Trigger background re-prerender (fire-and-forget)
    // This calls storefront-prerender which will re-render ALL pages
    // and atomically activate them. Uses published_content, NOT drafts.
    console.log(`[menu-auto-update] Step 3: Triggering background re-prerender`);
    let prerenderTriggered = false;
    try {
      const { error: prerenderError } = await supabase.functions.invoke('storefront-prerender', {
        body: {
          tenant_id: tenantId,
          trigger_type: 'menu_update',
        },
      });

      if (prerenderError) {
        console.warn('[menu-auto-update] Re-prerender trigger failed:', prerenderError.message);
        // Non-fatal: live-render fallback will handle requests
      } else {
        prerenderTriggered = true;
        console.log(`[menu-auto-update] Step 3 done: re-prerender triggered`);
      }
    } catch (err) {
      console.warn('[menu-auto-update] Re-prerender error:', err);
      // Non-fatal
    }

    return {
      success: true,
      staleCount,
      prerenderTriggered,
    };
  } catch (err: any) {
    console.error('[menu-auto-update] Pipeline error:', err);
    return {
      success: false,
      error: err.message || 'Unknown error',
    };
  }
}
