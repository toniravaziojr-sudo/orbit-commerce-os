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
