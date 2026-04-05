/**
 * Storefront Cache Purge & Auto-Update Utilities
 *
 * Two layers:
 * 1. `cachePurge.*` — CDN-only purge (manual "Clear Cache" button)
 * 2. `storefrontAutoUpdate()` — Full sequential pipeline: stale → purge → re-prerender
 *    (used by admin mutations that affect storefront content)
 */

import { supabase } from '@/integrations/supabase/client';

type ResourceType = 'product' | 'category' | 'template' | 'settings' | 'menu' | 'full';

interface PurgeOptions {
  tenantId: string;
  resourceType: ResourceType;
  resourceSlug?: string;
}

// ── CDN-only purge (step 2 of 3) ──

/**
 * Purge storefront edge cache (CDN only).
 * Fire-and-forget: does not throw, logs errors silently.
 */
async function purgeStorefrontCache(options: PurgeOptions): Promise<boolean> {
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
      return false;
    }

    console.log(`[cache-purge] Purged ${resourceType}${resourceSlug ? '/' + resourceSlug : ''}`);
    return true;
  } catch (err) {
    console.warn('[cache-purge] Error:', err);
    return false;
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

// ── Step 1: Mark prerendered pages as stale ──

async function markPagesStale(tenantId: string): Promise<number> {
  const { data, error } = await supabase
    .from('storefront_prerendered_pages')
    .update({ status: 'stale' })
    .eq('tenant_id', tenantId)
    .eq('status', 'active')
    .select('id');

  if (error) {
    console.warn('[storefront-auto-update] Stale marking failed:', error.message);
    return 0;
  }

  return data?.length || 0;
}

// ── Step 3: Trigger re-prerender ──

async function triggerReprerender(tenantId: string, reason: string): Promise<boolean> {
  const { error } = await supabase.functions.invoke('storefront-prerender', {
    body: { tenant_id: tenantId, trigger_type: reason },
  });

  if (error) {
    console.warn('[storefront-auto-update] Re-prerender failed:', error.message);
    return false;
  }

  return true;
}

// ── Sequential pipeline orchestrator ──

async function executeRevalidationPipeline(tenantId: string, reason: string): Promise<void> {
  console.log(`[storefront-auto-update] Executing: ${reason} for tenant ${tenantId}`);

  // Step 1: Mark stale FIRST → guarantees live-render even if purge/prerender fail
  const staleCount = await markPagesStale(tenantId);
  console.log(`[storefront-auto-update] ${staleCount} pages marked stale`);

  // Step 2: Purge CDN — wait for confirmation before prerender
  const purged = await purgeStorefrontCache({ tenantId, resourceType: 'full' });
  console.log(`[storefront-auto-update] CDN purge: ${purged ? 'OK' : 'FAILED'}`);

  // Step 3: Re-prerender ONLY after purge is confirmed/attempted
  const prerendered = await triggerReprerender(tenantId, reason);
  console.log(`[storefront-auto-update] Re-prerender: ${prerendered ? 'OK' : 'FAILED'}`);

  console.log(`[storefront-auto-update] Pipeline done: ${reason}`);
}

// ── Debounced auto-update (public API) ──

let storefrontAutoUpdateTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Unified storefront auto-update: sequential pipeline with debounce.
 *
 * Pipeline: mark stale → purge CDN (confirmed) → re-prerender
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
 */
export function storefrontAutoUpdate(
  tenantId: string,
  reason = 'storefront_change',
  delayMs = 3000,
): void {
  if (storefrontAutoUpdateTimer) {
    clearTimeout(storefrontAutoUpdateTimer);
    storefrontAutoUpdateTimer = null;
  }

  console.log(`[storefront-auto-update] Debounce: ${reason} (${delayMs}ms)`);

  storefrontAutoUpdateTimer = setTimeout(async () => {
    storefrontAutoUpdateTimer = null;
    try {
      await executeRevalidationPipeline(tenantId, reason);
    } catch (err) {
      console.warn(`[storefront-auto-update] Pipeline error (${reason}):`, err);
    }
  }, delayMs);
}

// ── Backward compatibility aliases ──

/** @deprecated Use `storefrontAutoUpdate()` instead. */
export const catalogAutoUpdate = storefrontAutoUpdate;

/** @deprecated Use `storefrontAutoUpdate()` instead. */
export function menuAutoUpdate(
  tenantId: string,
  delayMs = 5000,
): Promise<{ success: boolean; staleCount?: number; prerenderTriggered?: boolean; error?: string }> {
  return new Promise((resolve) => {
    if (storefrontAutoUpdateTimer) {
      clearTimeout(storefrontAutoUpdateTimer);
      storefrontAutoUpdateTimer = null;
    }

    storefrontAutoUpdateTimer = setTimeout(async () => {
      storefrontAutoUpdateTimer = null;
      try {
        const staleCount = await markPagesStale(tenantId);
        await purgeStorefrontCache({ tenantId, resourceType: 'menu' });
        const prerenderTriggered = await triggerReprerender(tenantId, 'menu_update');
        resolve({ success: true, staleCount, prerenderTriggered });
      } catch (err: any) {
        console.error('[storefront-auto-update] Pipeline error:', err);
        resolve({ success: false, error: err.message || 'Unknown error' });
      }
    }, delayMs);
  });
}
