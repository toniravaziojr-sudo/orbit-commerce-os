// =============================================
// USE PAGE SETTINGS - Hook to fetch page-specific settings
// Fetches from storefront_page_templates.page_overrides
// Used by builder blocks to respect toggle states
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Settings interfaces for different page types
export interface CategorySettings {
  showCategoryName?: boolean;
  showBanner?: boolean;
  showRatings?: boolean;
}

export interface ProductSettings {
  showGallery?: boolean;
  showDescription?: boolean;
  showVariants?: boolean;
  showStock?: boolean;
  showRelatedProducts?: boolean;
  showBuyTogether?: boolean;
  showReviews?: boolean;
  openMiniCartOnAdd?: boolean;
}

export interface CartSettings {
  showCrossSell?: boolean;
  miniCartEnabled?: boolean;
  showGoToCartButton?: boolean;
  shippingCalculatorEnabled?: boolean;
  couponEnabled?: boolean;
  sessionTrackingEnabled?: boolean;
  bannerDesktopEnabled?: boolean;
  bannerMobileEnabled?: boolean;
}

export interface CheckoutSettings {
  showOrderBump?: boolean;
  showTimeline?: boolean;
  couponEnabled?: boolean;
  testimonialsEnabled?: boolean;
  purchaseEventAllOrders?: boolean;
}

export interface ThankYouSettings {
  showUpsell?: boolean;
  showWhatsApp?: boolean;
}

export type PageSettings = CategorySettings | ProductSettings | CartSettings | CheckoutSettings | ThankYouSettings;

// Default settings by page type
const DEFAULT_SETTINGS: Record<string, PageSettings> = {
  category: {
    showCategoryName: true,
    showBanner: true,
    showRatings: true,
  } as CategorySettings,
  product: {
    showGallery: true,
    showDescription: true,
    showVariants: true,
    showStock: true,
    showRelatedProducts: true,
    showBuyTogether: true,
    showReviews: true,
    openMiniCartOnAdd: true,
  } as ProductSettings,
  cart: {
    showCrossSell: true,
    miniCartEnabled: true,
    showGoToCartButton: true,
    shippingCalculatorEnabled: true,
    couponEnabled: true,
    sessionTrackingEnabled: true,
    bannerDesktopEnabled: false,
    bannerMobileEnabled: false,
  } as CartSettings,
  checkout: {
    showOrderBump: true,
    showTimeline: true,
    couponEnabled: true,
    testimonialsEnabled: true,
    purchaseEventAllOrders: true,
  } as CheckoutSettings,
  thank_you: {
    showUpsell: true,
    showWhatsApp: true,
  } as ThankYouSettings,
};

function getSettingsKey(pageType: string): string {
  const keys: Record<string, string> = {
    category: 'categorySettings',
    product: 'productSettings',
    cart: 'cartSettings',
    checkout: 'checkoutSettings',
    thank_you: 'thankYouSettings',
  };
  return keys[pageType] || `${pageType}Settings`;
}

/**
 * Hook to fetch page settings
 * Now supports optional templateSetId for template-wide settings
 * Falls back to tenant-wide storefront_page_templates for compatibility
 */
export function usePageSettings<T extends PageSettings>(
  tenantId: string, 
  pageType: string,
  templateSetId?: string
) {
  return useQuery({
    // Include templateSetId in query key for proper caching
    queryKey: ['page-settings', tenantId, templateSetId || 'tenant', pageType],
    queryFn: async (): Promise<T> => {
      if (!tenantId || !pageType) {
        return (DEFAULT_SETTINGS[pageType] || {}) as T;
      }

      // If templateSetId is provided, try to get settings from template set first
      if (templateSetId) {
        const { data: templateSet, error: tsError } = await supabase
          .from('storefront_template_sets')
          .select('draft_content')
          .eq('id', templateSetId)
          .eq('tenant_id', tenantId)
          .maybeSingle();

        if (!tsError && templateSet?.draft_content) {
          const draftContent = templateSet.draft_content as Record<string, unknown>;
          const themeSettings = draftContent.themeSettings as Record<string, unknown> | undefined;
          const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
          
          if (pageSettings?.[pageType]) {
            return {
              ...(DEFAULT_SETTINGS[pageType] || {}),
              ...(pageSettings[pageType] as T),
            } as T;
          }
        }
      }

      // Fallback: get from storefront_page_templates (legacy/compatibility)
      const { data, error } = await supabase
        .from('storefront_page_templates')
        .select('page_overrides')
        .eq('tenant_id', tenantId)
        .eq('page_type', pageType)
        .maybeSingle();

      if (error) {
        console.error('Error fetching page settings:', error);
        return (DEFAULT_SETTINGS[pageType] || {}) as T;
      }

      const overrides = data?.page_overrides as Record<string, unknown> | null;
      const settingsKey = getSettingsKey(pageType);

      if (overrides?.[settingsKey]) {
        // Merge with defaults to ensure all keys exist
        return {
          ...(DEFAULT_SETTINGS[pageType] || {}),
          ...(overrides[settingsKey] as T),
        } as T;
      }

      return (DEFAULT_SETTINGS[pageType] || {}) as T;
    },
    enabled: !!tenantId && !!pageType,
    staleTime: 5000, // Refresh every 5 seconds to catch toggle changes
    refetchOnWindowFocus: true,
  });
}

// Convenience hooks for specific page types
export function useCartSettings(tenantId: string) {
  return usePageSettings<CartSettings>(tenantId, 'cart');
}

export function useProductPageSettings(tenantId: string) {
  return usePageSettings<ProductSettings>(tenantId, 'product');
}

export function useCheckoutSettings(tenantId: string) {
  return usePageSettings<CheckoutSettings>(tenantId, 'checkout');
}

export function useThankYouSettings(tenantId: string) {
  return usePageSettings<ThankYouSettings>(tenantId, 'thank_you');
}

export function useCategoryPageSettings(tenantId: string) {
  return usePageSettings<CategorySettings>(tenantId, 'category');
}
