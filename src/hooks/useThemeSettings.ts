// =============================================
// USE THEME SETTINGS - Centralized template-wide theme configuration
// All theme settings are stored in storefront_template_sets.draft_content.themeSettings
// This is the SINGLE SOURCE OF TRUTH for template-wide settings
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import type { BlockNode } from '@/lib/builder/types';

// ============================================
// TYPES & INTERFACES
// ============================================

export interface ThemeColors {
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  textPrimary: string;
  textSecondary: string;
}

export interface ThemeTypography {
  headingFont: string;
  bodyFont: string;
  baseFontSize: number;
}

export interface ThemeHeaderConfig {
  menuId?: string;
  showSearch?: boolean;
  showCart?: boolean;
  sticky?: boolean;
  stickyOnMobile?: boolean;
  noticeEnabled?: boolean;
  noticeText?: string;
  noticeBgColor?: string;
  noticeTextColor?: string;
  noticeLinkEnabled?: boolean;
  noticeLinkLabel?: string;
  noticeLinkUrl?: string;
  noticeLinkColor?: string;
  customerAreaEnabled?: boolean;
  featuredPromosEnabled?: boolean;
  featuredPromosLabel?: string;
  featuredPromosTarget?: string;
  headerBgColor?: string;
  headerTextColor?: string;
  headerIconColor?: string;
}

export interface ThemeFooterConfig {
  menuId?: string;
  showSocial?: boolean;
  showLogo?: boolean;
  showSac?: boolean;
  showStoreInfo?: boolean;
  showCopyright?: boolean;
  copyrightText?: string;
  sacTitle?: string;
  footer1Title?: string;
  footer2Title?: string;
  footerBgColor?: string;
  footerTextColor?: string;
  footerTitlesColor?: string;
}

// Cart action type: what happens when user clicks "Add to cart"
export type CartActionType = 'miniCart' | 'goToCart' | 'none';

export interface ThemeMiniCartConfig {
  // Unified cart action: 'miniCart' (opens drawer), 'goToCart' (redirects), 'none' (just feedback)
  cartActionType: CartActionType;
  // Show add to cart button - required when cartActionType is not 'none'
  showAddToCartButton: boolean;
  showCrossSell: boolean;
  showCoupon: boolean;
  showShippingCalculator: boolean;
  showFreeShippingProgress: boolean;
  // freeShippingThreshold removed - now comes from Logistics > Cart Conversion (benefit_config)
  showStockReservationTimer: boolean;
  stockReservationMinutes: number;
}

export interface ThemePageSettings {
  category?: Record<string, boolean>;
  product?: Record<string, boolean>;
  cart?: Record<string, boolean>;
  checkout?: Record<string, boolean>;
  thank_you?: Record<string, boolean>;
  tracking?: Record<string, boolean>;
  blog?: Record<string, boolean>;
}

export interface ThemeSettings {
  colors?: ThemeColors;
  typography?: ThemeTypography;
  customCss?: string;
  header?: ThemeHeaderConfig;
  footer?: ThemeFooterConfig;
  miniCart?: ThemeMiniCartConfig;
  pageSettings?: ThemePageSettings;
}

// ============================================
// DEFAULT VALUES
// ============================================

export const DEFAULT_THEME_COLORS: ThemeColors = {
  buttonPrimaryBg: '#1a1a1a',
  buttonPrimaryText: '#ffffff',
  buttonSecondaryBg: '#f5f5f5',
  buttonSecondaryText: '#1a1a1a',
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
};

export const DEFAULT_THEME_TYPOGRAPHY: ThemeTypography = {
  headingFont: 'inter',
  bodyFont: 'inter',
  baseFontSize: 16,
};

export const DEFAULT_THEME_HEADER: ThemeHeaderConfig = {
  menuId: '',
  showSearch: true,
  showCart: true,
  sticky: true,
  stickyOnMobile: true,
  noticeEnabled: false,
  customerAreaEnabled: false,
  featuredPromosEnabled: false,
};

export const DEFAULT_THEME_FOOTER: ThemeFooterConfig = {
  menuId: '',
  showSocial: true,
  showLogo: true,
  showSac: true,
  showStoreInfo: true,
  showCopyright: true,
  copyrightText: '',
};

export const DEFAULT_THEME_MINI_CART: ThemeMiniCartConfig = {
  cartActionType: 'miniCart', // Default: opens mini-cart drawer
  showAddToCartButton: true,
  showCrossSell: true,
  showCoupon: true,
  showShippingCalculator: true,
  showFreeShippingProgress: true,
  // freeShippingThreshold removed - now comes from benefit_config
  showStockReservationTimer: false,
  stockReservationMinutes: 15,
};

export const DEFAULT_PAGE_SETTINGS: ThemePageSettings = {
  category: {
    showCategoryName: true,
    showBanner: true,
    showRatings: true,
  },
  product: {
    showGallery: true,
    showDescription: true,
    showVariants: true,
    showStock: true,
    showRelatedProducts: true,
    showBuyTogether: true,
    showReviews: true,
    openMiniCartOnAdd: true,
    showGoToCartButton: true,
  },
  cart: {
    showCrossSell: true,
    shippingCalculatorEnabled: true,
    couponEnabled: true,
    sessionTrackingEnabled: true,
    bannerDesktopEnabled: false,
    bannerMobileEnabled: false,
  },
  checkout: {
    showOrderBump: true,
    showTimeline: true,
    couponEnabled: true,
    testimonialsEnabled: true,
    purchaseEventAllOrders: true,
  },
  thank_you: {
    showUpsell: true,
    showWhatsApp: true,
  },
};

// ============================================
// QUERY KEYS - Standardized with templateSetId
// ============================================

export const THEME_SETTINGS_KEYS = {
  all: (tenantId: string, templateSetId: string) => 
    ['theme-settings', tenantId, templateSetId] as const,
  colors: (tenantId: string, templateSetId: string) => 
    ['theme-settings-colors', tenantId, templateSetId] as const,
  typography: (tenantId: string, templateSetId: string) => 
    ['theme-settings-typography', tenantId, templateSetId] as const,
  customCss: (tenantId: string, templateSetId: string) => 
    ['theme-settings-custom-css', tenantId, templateSetId] as const,
  header: (tenantId: string, templateSetId: string) => 
    ['theme-settings-header', tenantId, templateSetId] as const,
  footer: (tenantId: string, templateSetId: string) => 
    ['theme-settings-footer', tenantId, templateSetId] as const,
  miniCart: (tenantId: string, templateSetId: string) => 
    ['theme-settings-mini-cart', tenantId, templateSetId] as const,
  pageSettings: (tenantId: string, templateSetId: string, pageType: string) => 
    ['page-settings', tenantId, templateSetId, pageType] as const,
};

// ============================================
// MAIN HOOK - Fetch all theme settings
// ============================================

export function useThemeSettings(tenantId: string | undefined, templateSetId: string | undefined) {
  const queryClient = useQueryClient();

  // Fetch theme settings from template set
  const { data: themeSettings, isLoading, error } = useQuery({
    queryKey: templateSetId && tenantId 
      ? THEME_SETTINGS_KEYS.all(tenantId, templateSetId) 
      : ['theme-settings-disabled'],
    queryFn: async () => {
      if (!templateSetId || !tenantId) return null;

      const { data, error } = await supabase
        .from('storefront_template_sets')
        .select('draft_content')
        .eq('id', templateSetId)
        .single();

      if (error) throw error;

      const draftContent = data?.draft_content as Record<string, unknown> | null;
      
      // Check if themeSettings exists in draft_content
      if (draftContent?.themeSettings) {
        return draftContent.themeSettings as ThemeSettings;
      }

      // MIGRATION: If no themeSettings, migrate from legacy sources
      const migratedSettings = await migrateLegacySettings(tenantId);
      
      // Save migrated settings to template set
      if (migratedSettings) {
        const updatedDraftContent = {
          ...draftContent,
          themeSettings: migratedSettings,
        };

        await supabase
          .from('storefront_template_sets')
          .update({ 
            draft_content: updatedDraftContent as unknown as Json,
            updated_at: new Date().toISOString(),
          })
          .eq('id', templateSetId);
      }

      return migratedSettings || {};
    },
    enabled: !!templateSetId && !!tenantId,
    staleTime: 30000,
    refetchOnWindowFocus: false,
  });

  // Generic save mutation for any theme settings section
  const saveMutation = useMutation({
    mutationFn: async (updates: Partial<ThemeSettings>) => {
      if (!templateSetId || !tenantId) throw new Error('No template set');

      // Fetch current draft content
      const { data: current, error: fetchError } = await supabase
        .from('storefront_template_sets')
        .select('draft_content')
        .eq('id', templateSetId)
        .single();

      if (fetchError) throw fetchError;

      const draftContent = (current?.draft_content as Record<string, unknown>) || {};
      const currentThemeSettings = (draftContent.themeSettings as ThemeSettings) || {};

      // Merge updates into current theme settings
      const updatedThemeSettings: ThemeSettings = {
        ...currentThemeSettings,
        ...updates,
      };

      // Update draft content
      const updatedDraftContent = {
        ...draftContent,
        themeSettings: updatedThemeSettings,
      };

      const { error: updateError } = await supabase
        .from('storefront_template_sets')
        .update({ 
          draft_content: updatedDraftContent as unknown as Json,
          updated_at: new Date().toISOString(),
        })
        .eq('id', templateSetId);

      if (updateError) throw updateError;

      return updatedThemeSettings;
    },
    onSuccess: () => {
      if (tenantId && templateSetId) {
        // Invalidate all theme settings queries for this template
        queryClient.invalidateQueries({ 
          queryKey: THEME_SETTINGS_KEYS.all(tenantId, templateSetId) 
        });
        // Also invalidate the global layout cache for immediate preview update
        queryClient.invalidateQueries({ 
          queryKey: ['global-layout-editor', tenantId] 
        });
      }
    },
    onError: (error) => {
      console.error('[useThemeSettings] Save error:', error);
      toast.error('Erro ao salvar configurações do tema');
    },
  });

  // Canonical invalidation function
  const invalidateThemeSettings = () => {
    if (tenantId && templateSetId) {
      queryClient.invalidateQueries({ 
        queryKey: THEME_SETTINGS_KEYS.all(tenantId, templateSetId) 
      });
      queryClient.invalidateQueries({ 
        queryKey: ['global-layout-editor', tenantId] 
      });
    }
  };

  return {
    themeSettings: themeSettings || {},
    isLoading,
    error,
    saveThemeSettings: saveMutation.mutate,
    saveThemeSettingsAsync: saveMutation.mutateAsync,
    isSaving: saveMutation.isPending,
    invalidateThemeSettings,
  };
}

// ============================================
// SPECIALIZED HOOKS - For specific settings
// ============================================

export function useThemeColors(tenantId: string | undefined, templateSetId: string | undefined) {
  const { themeSettings, saveThemeSettings, isLoading, isSaving, invalidateThemeSettings } = 
    useThemeSettings(tenantId, templateSetId);

  const colors = {
    ...DEFAULT_THEME_COLORS,
    ...themeSettings?.colors,
  };

  const updateColors = (newColors: Partial<ThemeColors>) => {
    saveThemeSettings({ 
      colors: { ...colors, ...newColors } 
    });
  };

  return {
    colors,
    updateColors,
    isLoading,
    isSaving,
    invalidateThemeSettings,
  };
}

export function useThemeTypography(tenantId: string | undefined, templateSetId: string | undefined) {
  const { themeSettings, saveThemeSettings, isLoading, isSaving } = 
    useThemeSettings(tenantId, templateSetId);

  const typography = {
    ...DEFAULT_THEME_TYPOGRAPHY,
    ...themeSettings?.typography,
  };

  const updateTypography = (newTypography: Partial<ThemeTypography>) => {
    saveThemeSettings({ 
      typography: { ...typography, ...newTypography } 
    });
  };

  return {
    typography,
    updateTypography,
    isLoading,
    isSaving,
  };
}

export function useThemeCustomCss(tenantId: string | undefined, templateSetId: string | undefined) {
  const { themeSettings, saveThemeSettings, isLoading, isSaving } = 
    useThemeSettings(tenantId, templateSetId);

  const customCss = themeSettings?.customCss || '';

  const updateCustomCss = (newCss: string) => {
    saveThemeSettings({ customCss: newCss });
  };

  return {
    customCss,
    updateCustomCss,
    isLoading,
    isSaving,
  };
}

export function useThemeHeader(tenantId: string | undefined, templateSetId: string | undefined) {
  const queryClient = useQueryClient();
  const { themeSettings, saveThemeSettings, isLoading, isSaving } = 
    useThemeSettings(tenantId, templateSetId);

  const header = {
    ...DEFAULT_THEME_HEADER,
    ...themeSettings?.header,
  };

  const updateHeader = (newHeader: Partial<ThemeHeaderConfig>) => {
    const updatedHeader = { ...header, ...newHeader };
    
    // Update cache immediately for instant preview
    if (tenantId) {
      const headerBlock: BlockNode = {
        id: 'global-header',
        type: 'Header',
        props: updatedHeader,
      };
      queryClient.setQueryData(['global-layout-editor', tenantId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        return { ...old, header_config: headerBlock };
      });
    }
    
    saveThemeSettings({ header: updatedHeader });
  };

  return {
    header,
    updateHeader,
    isLoading,
    isSaving,
  };
}

export function useThemeFooter(tenantId: string | undefined, templateSetId: string | undefined) {
  const queryClient = useQueryClient();
  const { themeSettings, saveThemeSettings, isLoading, isSaving } = 
    useThemeSettings(tenantId, templateSetId);

  const footer = {
    ...DEFAULT_THEME_FOOTER,
    ...themeSettings?.footer,
  };

  const updateFooter = (newFooter: Partial<ThemeFooterConfig>) => {
    const updatedFooter = { ...footer, ...newFooter };
    
    // Update cache immediately for instant preview
    if (tenantId) {
      const footerBlock: BlockNode = {
        id: 'global-footer',
        type: 'Footer',
        props: updatedFooter,
      };
      queryClient.setQueryData(['global-layout-editor', tenantId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        return { ...old, footer_config: footerBlock };
      });
    }
    
    saveThemeSettings({ footer: updatedFooter });
  };

  return {
    footer,
    updateFooter,
    isLoading,
    isSaving,
  };
}

export function useThemeMiniCart(tenantId: string | undefined, templateSetId: string | undefined) {
  const { themeSettings, saveThemeSettings, isLoading, isSaving } = 
    useThemeSettings(tenantId, templateSetId);

  const miniCart = {
    ...DEFAULT_THEME_MINI_CART,
    ...themeSettings?.miniCart,
  };

  const updateMiniCart = (newMiniCart: Partial<ThemeMiniCartConfig>) => {
    saveThemeSettings({ 
      miniCart: { ...miniCart, ...newMiniCart } 
    });
  };

  return {
    miniCart,
    updateMiniCart,
    isLoading,
    isSaving,
  };
}

export function useThemePageSettings(
  tenantId: string | undefined, 
  templateSetId: string | undefined,
  pageType: string
) {
  const { themeSettings, saveThemeSettings, isLoading, isSaving } = 
    useThemeSettings(tenantId, templateSetId);

  const pageSettings = {
    ...DEFAULT_PAGE_SETTINGS[pageType as keyof typeof DEFAULT_PAGE_SETTINGS],
    ...themeSettings?.pageSettings?.[pageType as keyof ThemePageSettings],
  };

  const updatePageSettings = (newSettings: Record<string, boolean>) => {
    const currentPageSettings = themeSettings?.pageSettings || {};
    saveThemeSettings({ 
      pageSettings: {
        ...currentPageSettings,
        [pageType]: { ...pageSettings, ...newSettings },
      },
    });
  };

  return {
    pageSettings,
    updatePageSettings,
    isLoading,
    isSaving,
  };
}

// ============================================
// MIGRATION HELPER - One-time migration from legacy sources
// ============================================

async function migrateLegacySettings(tenantId: string): Promise<ThemeSettings | null> {
  try {
    // Fetch legacy settings from store_settings
    const { data: storeSettings } = await supabase
      .from('store_settings')
      .select('primary_color, secondary_color, accent_color, cart_config')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    // Fetch legacy header/footer from storefront_global_layout
    const { data: globalLayout } = await supabase
      .from('storefront_global_layout')
      .select('header_config, footer_config')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    const migratedSettings: ThemeSettings = {
      colors: {
        ...DEFAULT_THEME_COLORS,
        buttonPrimaryBg: storeSettings?.primary_color || DEFAULT_THEME_COLORS.buttonPrimaryBg,
        buttonSecondaryBg: storeSettings?.secondary_color || DEFAULT_THEME_COLORS.buttonSecondaryBg,
      },
      typography: DEFAULT_THEME_TYPOGRAPHY,
      customCss: '',
      header: globalLayout?.header_config 
        ? { ...DEFAULT_THEME_HEADER, ...((globalLayout.header_config as unknown as BlockNode)?.props || {}) } as ThemeHeaderConfig
        : DEFAULT_THEME_HEADER,
      footer: globalLayout?.footer_config 
        ? { ...DEFAULT_THEME_FOOTER, ...((globalLayout.footer_config as unknown as BlockNode)?.props || {}) } as ThemeFooterConfig
        : DEFAULT_THEME_FOOTER,
      miniCart: storeSettings?.cart_config
        ? ({
            ...DEFAULT_THEME_MINI_CART,
            // Migrate from legacy: if miniCartEnabled was false, set to 'none'
            cartActionType: ((storeSettings.cart_config as Record<string, unknown>).miniCartEnabled as boolean ?? true) 
              ? 'miniCart' 
              : 'none',
            showAddToCartButton: true,
            showCrossSell: (storeSettings.cart_config as Record<string, unknown>).miniCartShowCrossSell as boolean ?? true,
            showCoupon: (storeSettings.cart_config as Record<string, unknown>).miniCartShowCoupon as boolean ?? true,
            showShippingCalculator: (storeSettings.cart_config as Record<string, unknown>).miniCartShowShipping as boolean ?? true,
            showFreeShippingProgress: (storeSettings.cart_config as Record<string, unknown>).miniCartShowFreeShippingProgress as boolean ?? true,
          } as ThemeMiniCartConfig)
        : DEFAULT_THEME_MINI_CART,
      pageSettings: DEFAULT_PAGE_SETTINGS,
    };

    console.log('[migrateLegacySettings] Migrated settings for tenant:', tenantId);
    return migratedSettings;
  } catch (error) {
    console.error('[migrateLegacySettings] Error:', error);
    return null;
  }
}

// ============================================
// SYSTEM BLOCKS - List of blocks that should be configured via Theme Settings
// ============================================

export const SYSTEM_BLOCKS = [
  'Header',
  'Footer',
  'Cart',
  'Checkout', 
  'CheckoutStepWizard',
  'ThankYou',
  'ThankYouContent',
  'TrackingLookup',
  'OrderTracking',
  'BlogListing',
  'BlogPostDetail',
  'AccountDashboard',
  'AccountOrders',
  'AccountOrderDetail',
  'AccountProfile',
  'CategoryProducts',
  'ProductDetail',
] as const;

export type SystemBlockType = typeof SYSTEM_BLOCKS[number];

export function isSystemBlock(blockType: string): boolean {
  return SYSTEM_BLOCKS.includes(blockType as SystemBlockType);
}

// Get the Theme Settings section for a system block
export function getThemeSettingsSection(blockType: string): string | null {
  const sectionMap: Record<string, string> = {
    'Header': 'Cabeçalho',
    'Footer': 'Rodapé',
    'Cart': 'Páginas → Carrinho',
    'Checkout': 'Páginas → Checkout',
    'CheckoutStepWizard': 'Páginas → Checkout',
    'ThankYou': 'Páginas → Obrigado',
    'ThankYouContent': 'Páginas → Obrigado',
    'TrackingLookup': 'Páginas → Rastreio',
    'OrderTracking': 'Páginas → Rastreio',
    'BlogListing': 'Páginas → Blog',
    'BlogPostDetail': 'Páginas → Blog',
    'CategoryProducts': 'Páginas → Categoria',
    'ProductDetail': 'Páginas → Produto',
  };
  return sectionMap[blockType] || null;
}
