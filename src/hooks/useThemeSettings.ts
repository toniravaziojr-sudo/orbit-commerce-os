// =============================================
// USE THEME SETTINGS - Centralized template-wide theme configuration
// All theme settings are stored in storefront_template_sets.draft_content.themeSettings
// This is the SINGLE SOURCE OF TRUTH for template-wide settings
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Json } from '@/integrations/supabase/types';
import type { BlockNode } from '@/lib/builder/types';

// ============================================
// GLOBAL REFS FOR HEADER/FOOTER DRAFT STATE
// Allows VisualBuilder to access draft state without prop drilling
// ============================================

interface HeaderFooterDraftRef {
  hasDraftChanges: boolean;
  clearDraft: () => void;
  getPendingChanges: () => { header?: ThemeHeaderConfig; footer?: ThemeFooterConfig } | null;
}

let globalHeaderDraftRef: HeaderFooterDraftRef | null = null;
let globalFooterDraftRef: HeaderFooterDraftRef | null = null;

// Change counter for external observers (triggers re-render in toolbar)
let headerFooterDraftChangeCounter = 0;
let headerFooterDraftListeners: Set<() => void> = new Set();

function notifyHeaderFooterDraftChange() {
  headerFooterDraftChangeCounter++;
  headerFooterDraftListeners.forEach(listener => listener());
}

export function getGlobalHeaderDraftRef() {
  return globalHeaderDraftRef;
}

export function getGlobalFooterDraftRef() {
  return globalFooterDraftRef;
}

// Hook to observe draft changes from outside (for toolbar isDirty)
export function useHeaderFooterDraftObserver(): number {
  const [counter, setCounter] = useState(headerFooterDraftChangeCounter);
  
  useEffect(() => {
    const listener = () => setCounter(headerFooterDraftChangeCounter);
    headerFooterDraftListeners.add(listener);
    return () => {
      headerFooterDraftListeners.delete(listener);
    };
  }, []);
  
  return counter;
}

// ============================================
// TYPES & INTERFACES
// ============================================

export interface ThemeColors {
  // Primary button colors
  buttonPrimaryBg: string;
  buttonPrimaryText: string;
  buttonPrimaryHover: string;
  // Secondary button colors
  buttonSecondaryBg: string;
  buttonSecondaryText: string;
  buttonSecondaryHover: string;
  // WhatsApp button colors
  whatsappColor: string;
  whatsappHover: string;
  // Text colors
  textPrimary: string;
  textSecondary: string;
  // Accent color for UI details (checkmarks, icons, links)
  accentColor: string;
  // Price color - exclusive for the main/discounted price value
  priceColor?: string;
  // Special tag colors
  successBg: string;
  successText: string;
  warningBg: string;
  warningText: string;
  dangerBg: string;
  dangerText: string;
  highlightBg: string;
  highlightText: string;
}

export interface ThemeTypography {
  headingFont: string;
  bodyFont: string;
  baseFontSize: number;
}

// Menu visual style type
export type MenuVisualStyle = 'classic' | 'elegant' | 'minimal';

// Logo size type
export type LogoSizeType = 'small' | 'medium' | 'large';

// Badge size type for footer seals/icons
export type BadgeSizeType = 'small' | 'medium' | 'large';

export interface ThemeHeaderConfig {
  menuId?: string;
  showSearch?: boolean;
  showCart?: boolean;
  sticky?: boolean;
  stickyOnMobile?: boolean;
  noticeEnabled?: boolean;
  noticeText?: string;
  noticeTexts?: string[]; // Multiple phrases for slide/fade rotation
  noticeBgColor?: string;
  noticeTextColor?: string;
  noticeAnimation?: 'none' | 'fade' | 'slide-vertical' | 'slide-horizontal' | 'marquee'; // Animation effect for notice bar
  noticeLinkEnabled?: boolean;
  noticeLinkLabel?: string;
  noticeLinkUrl?: string;
  noticeLinkColor?: string;
  customerAreaEnabled?: boolean;
  featuredPromosEnabled?: boolean;
  featuredPromosLabel?: string;
  featuredPromosTarget?: string;
  featuredPromosTextColor?: string;
  featuredPromosBgColor?: string; // Background/accent color for the badge
  featuredPromosThumbnail?: string; // Desktop only - thumbnail shown on hover
  headerBgColor?: string;
  headerTextColor?: string;
  headerIconColor?: string;
  // Visual menu style configuration
  menuVisualStyle?: MenuVisualStyle;
  menuShowParentTitle?: boolean; // Show parent category name as header in dropdown
  logoSize?: LogoSizeType; // small, medium, large - controls logo height in header
  // Navigation bar height configuration
  navBarHeight?: 'small' | 'medium' | 'large'; // small (32px), medium (40px), large (52px) - controls secondary nav height
}

// Footer image section item
export interface FooterImageItem {
  imageUrl: string;
  linkUrl?: string;
}

// Footer image section data
export interface FooterImageSectionData {
  title: string;
  items: FooterImageItem[];
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
  // Image sections
  paymentMethods?: FooterImageSectionData;
  securitySeals?: FooterImageSectionData;
  shippingMethods?: FooterImageSectionData;
  officialStores?: FooterImageSectionData;
  // Newsletter section
  showNewsletter?: boolean;
  newsletterTitle?: string;
  newsletterSubtitle?: string;
  newsletterPlaceholder?: string;
  newsletterButtonText?: string;
  newsletterSuccessMessage?: string;
  newsletterListId?: string;
  // Visual menu style configuration
  menuVisualStyle?: MenuVisualStyle;
  // Badge size for footer seals/icons (small, medium, large)
  badgeSize?: BadgeSizeType;
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
  category?: Record<string, boolean | string | number | string[]>;
  product?: Record<string, boolean | string | number | string[]>;
  cart?: Record<string, boolean | string | number | string[]>;
  checkout?: Record<string, boolean | string | number | string[]>;
  thank_you?: Record<string, boolean | string | number | string[]>;
  tracking?: Record<string, boolean | string | number | string[]>;
  blog?: Record<string, boolean | string | number | string[]>;
  home?: Record<string, boolean | string | number | string[]>;
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
  // Primary button
  buttonPrimaryBg: '#1a1a1a',
  buttonPrimaryText: '#ffffff',
  buttonPrimaryHover: '#333333',
  // Secondary button
  buttonSecondaryBg: '#f5f5f5',
  buttonSecondaryText: '#1a1a1a',
  buttonSecondaryHover: '#e5e5e5',
  // WhatsApp button - uses official WhatsApp green by default
  whatsappColor: '#25D366',
  whatsappHover: '#128C7E',
  // Text
  textPrimary: '#1a1a1a',
  textSecondary: '#666666',
  // Accent color for UI details (checkmarks, icons, links)
  accentColor: '#22c55e',
  // Price color - empty means inherit from textPrimary
  priceColor: '',
  // Special tag colors
  successBg: '#22c55e',
  successText: '#ffffff',
  warningBg: '#f97316',
  warningText: '#ffffff',
  dangerBg: '#ef4444',
  dangerText: '#ffffff',
  highlightBg: '#3b82f6',
  highlightText: '#ffffff',
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
  sacTitle: '',
  footer1Title: '',
  footer2Title: '',
  footerBgColor: '',
  footerTextColor: '',
  footerTitlesColor: '',
  paymentMethods: { title: 'Formas de Pagamento', items: [] },
  securitySeals: { title: 'Selos de Segurança', items: [] },
  shippingMethods: { title: 'Formas de Envio', items: [] },
  officialStores: { title: 'Lojas Oficiais', items: [] },
  // Newsletter defaults
  showNewsletter: false,
  newsletterTitle: 'Receba nossas promoções',
  newsletterSubtitle: 'Inscreva-se para receber descontos exclusivos direto no seu e-mail!',
  newsletterPlaceholder: 'Seu e-mail',
  newsletterButtonText: '',
  newsletterSuccessMessage: 'Inscrito com sucesso!',
  newsletterListId: '',
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
    onMutate: async (updates: Partial<ThemeSettings>) => {
      // OPTIMISTIC UPDATE: Cancel outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ 
        queryKey: THEME_SETTINGS_KEYS.all(tenantId!, templateSetId!) 
      });
      
      // Snapshot current value
      const previousSettings = queryClient.getQueryData(
        THEME_SETTINGS_KEYS.all(tenantId!, templateSetId!)
      );
      
      // Optimistically update cache with merged settings
      queryClient.setQueryData(
        THEME_SETTINGS_KEYS.all(tenantId!, templateSetId!),
        (old: ThemeSettings | undefined) => ({
          ...old,
          ...updates,
        })
      );
      
      return { previousSettings };
    },
    onError: (error, _updates, context) => {
      console.error('[useThemeSettings] Save error:', error);
      toast.error('Erro ao salvar configurações do tema');
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(
          THEME_SETTINGS_KEYS.all(tenantId!, templateSetId!),
          context.previousSettings
        );
      }
    },
    onSuccess: () => {
      // Only invalidate global layout for preview - NOT theme settings
      // Theme settings are already updated via optimistic update
      // Invalidating here would cause race condition (stale DB data overwrites optimistic update)
      if (tenantId && templateSetId) {
        queryClient.invalidateQueries({ 
          queryKey: ['global-layout-editor', tenantId] 
        });
      }
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

// ============================================
// DRAFT-BASED HEADER HOOK (follows save flow)
// Changes are stored locally until user clicks "Salvar"
// ============================================

export function useThemeHeader(tenantId: string | undefined, templateSetId: string | undefined) {
  const queryClient = useQueryClient();
  const { themeSettings, isLoading, isSaving } = 
    useThemeSettings(tenantId, templateSetId);

  // Track draft changes with useState to trigger re-renders
  // These are LOCAL changes that haven't been saved to DB yet
  const [draftUpdates, setDraftUpdates] = useState<Partial<ThemeHeaderConfig>>({});

  // hasDraftChanges is TRUE when user has made changes but NOT saved
  const hasDraftChanges = Object.keys(draftUpdates).length > 0;

  // Base header from server (React Query cache)
  const serverHeader = {
    ...DEFAULT_THEME_HEADER,
    ...themeSettings?.header,
  };

  // Merge server header with any draft updates to get effective header
  // This ensures UI shows draft changes for immediate preview
  const header = {
    ...serverHeader,
    ...draftUpdates,
  };

  // updateHeader: Updates LOCAL draft state only (NO database save)
  // Changes are visible in builder preview but need "Salvar" to persist
  const updateHeader = useCallback((newHeader: Partial<ThemeHeaderConfig>) => {
    // Update draft state - this triggers re-render for preview
    setDraftUpdates(prev => ({ ...prev, ...newHeader }));
    
    // Notify global observers that draft changed (for toolbar isDirty)
    notifyHeaderFooterDraftChange();
    
    // Compute complete header for preview
    const updatedHeader = { 
      ...DEFAULT_THEME_HEADER,
      ...themeSettings?.header,
      ...draftUpdates,
      ...newHeader,
    };
    
    // Build header block for preview cache
    const headerBlock: BlockNode = {
      id: 'global-header',
      type: 'Header',
      props: updatedHeader,
    };
    
    // Update cache immediately for instant preview (NOT saving to DB)
    // IMPORTANT: Update BOTH header_config and draft_header_config
    // applyGlobalLayout reads header_config, so it must be updated for canvas preview
    if (tenantId) {
      queryClient.setQueryData(['global-layout-editor', tenantId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        return { ...old, header_config: headerBlock, draft_header_config: headerBlock };
      });
    }
    
    // Update themeSettings cache for preview
    if (tenantId && templateSetId) {
      queryClient.setQueryData(
        THEME_SETTINGS_KEYS.all(tenantId, templateSetId),
        (old: ThemeSettings | undefined) => ({
          ...old,
          header: updatedHeader,
        })
      );
    }
  }, [themeSettings?.header, draftUpdates, tenantId, templateSetId, queryClient]);

  // clearDraft: Called after save to reset draft state
  const clearDraft = useCallback(() => {
    setDraftUpdates({});
  }, []);

  // getPendingChanges: Returns changes to save (for VisualBuilder.handleSave)
  const getPendingChanges = useCallback(() => {
    if (!hasDraftChanges) return null;
    
    const fullHeader = {
      ...DEFAULT_THEME_HEADER,
      ...themeSettings?.header,
      ...draftUpdates,
    };
    
    return { header: fullHeader };
  }, [hasDraftChanges, themeSettings?.header, draftUpdates]);

  // Register global ref for access from VisualBuilder
  useEffect(() => {
    globalHeaderDraftRef = {
      hasDraftChanges,
      clearDraft,
      getPendingChanges: getPendingChanges as () => { header?: ThemeHeaderConfig; footer?: ThemeFooterConfig } | null,
    };
    return () => {
      globalHeaderDraftRef = null;
    };
  }, [hasDraftChanges, clearDraft, getPendingChanges]);

  return {
    header,
    updateHeader,
    isLoading,
    isSaving,
    hasDraftChanges,
    clearDraft,
    getPendingChanges,
  };
}

// ============================================
// DRAFT-BASED FOOTER HOOK (follows save flow)
// Changes are stored locally until user clicks "Salvar"
// ============================================

export function useThemeFooter(tenantId: string | undefined, templateSetId: string | undefined) {
  const queryClient = useQueryClient();
  const { themeSettings, isLoading, isSaving } = 
    useThemeSettings(tenantId, templateSetId);

  // Track draft changes with useState to trigger re-renders
  // These are LOCAL changes that haven't been saved to DB yet
  const [draftUpdates, setDraftUpdates] = useState<Partial<ThemeFooterConfig>>({});

  // hasDraftChanges is TRUE when user has made changes but NOT saved
  const hasDraftChanges = Object.keys(draftUpdates).length > 0;

  // Base footer from server (React Query cache)
  const serverFooter = {
    ...DEFAULT_THEME_FOOTER,
    ...themeSettings?.footer,
  };

  // Merge server footer with any draft updates to get effective footer
  // This ensures UI shows draft changes for immediate preview
  const footer = {
    ...serverFooter,
    ...draftUpdates,
  };

  // updateFooter: Updates LOCAL draft state only (NO database save)
  // Changes are visible in builder preview but need "Salvar" to persist
  const updateFooter = useCallback((newFooter: Partial<ThemeFooterConfig>) => {
    // Update draft state - this triggers re-render for preview
    setDraftUpdates(prev => ({ ...prev, ...newFooter }));
    
    // Notify global observers that draft changed (for toolbar isDirty)
    notifyHeaderFooterDraftChange();
    
    // Compute complete footer for preview
    const updatedFooter = { 
      ...DEFAULT_THEME_FOOTER,
      ...themeSettings?.footer,
      ...draftUpdates,
      ...newFooter,
    };
    
    // Build footer block for preview cache
    const footerBlock: BlockNode = {
      id: 'global-footer',
      type: 'Footer',
      props: updatedFooter,
    };
    
    // Update cache immediately for instant preview (NOT saving to DB)
    if (tenantId) {
      queryClient.setQueryData(['global-layout-editor', tenantId], (old: unknown) => {
        if (!old || typeof old !== 'object') return old;
        return { ...old, footer_config: footerBlock, draft_footer_config: footerBlock };
      });
    }
    
    // Update themeSettings cache for preview
    if (tenantId && templateSetId) {
      queryClient.setQueryData(
        THEME_SETTINGS_KEYS.all(tenantId, templateSetId),
        (old: ThemeSettings | undefined) => ({
          ...old,
          footer: updatedFooter,
        })
      );
    }
  }, [themeSettings?.footer, draftUpdates, tenantId, templateSetId, queryClient]);

  // clearDraft: Called after save to reset draft state
  const clearDraft = useCallback(() => {
    setDraftUpdates({});
  }, []);

  // getPendingChanges: Returns changes to save (for VisualBuilder.handleSave)
  const getPendingChanges = useCallback(() => {
    if (!hasDraftChanges) return null;
    
    const fullFooter = {
      ...DEFAULT_THEME_FOOTER,
      ...themeSettings?.footer,
      ...draftUpdates,
    };
    
    return { footer: fullFooter };
  }, [hasDraftChanges, themeSettings?.footer, draftUpdates]);

  // Register global ref for access from VisualBuilder
  useEffect(() => {
    globalFooterDraftRef = {
      hasDraftChanges,
      clearDraft,
      getPendingChanges: getPendingChanges as () => { header?: ThemeHeaderConfig; footer?: ThemeFooterConfig } | null,
    };
    return () => {
      globalFooterDraftRef = null;
    };
  }, [hasDraftChanges, clearDraft, getPendingChanges]);

  return {
    footer,
    updateFooter,
    isLoading,
    isSaving,
    hasDraftChanges,
    clearDraft,
    getPendingChanges,
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
  // Global layout
  'Header',
  'Footer',
  // Cart page
  'Cart',
  'CartSummary',
  'CrossSellSlot',
  // Checkout page
  'Checkout', 
  'CheckoutStepWizard',
  'CheckoutSteps',
  // Thank you page
  'ThankYou',
  'ThankYouContent',
  'UpsellSlot',
  // Other pages
  'TrackingLookup',
  'OrderTracking',
  'BlogListing',
  'BlogPostDetail',
  'AccountHub',
  'AccountDashboard',
  'AccountOrders',
  'AccountOrderDetail',
  'AccountProfile',
  'OrdersList',
  'OrderDetail',
  // Ecommerce core blocks
  'CategoryProducts',
  'CategoryPageLayout',
  'ProductDetail',
  'ProductDetails',
  'CompreJuntoSlot',
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
    'CartSummary': 'Páginas → Carrinho',
    'CrossSellSlot': 'Páginas → Carrinho',
    'Checkout': 'Páginas → Checkout',
    'CheckoutStepWizard': 'Páginas → Checkout',
    'CheckoutSteps': 'Páginas → Checkout',
    'ThankYou': 'Páginas → Obrigado',
    'ThankYouContent': 'Páginas → Obrigado',
    'UpsellSlot': 'Páginas → Obrigado',
    'TrackingLookup': 'Páginas → Rastreio',
    'OrderTracking': 'Páginas → Rastreio',
    'BlogListing': 'Páginas → Blog',
    'BlogPostDetail': 'Páginas → Blog',
    'CategoryProducts': 'Páginas → Categoria',
    'CategoryPageLayout': 'Páginas → Categoria',
    'ProductDetail': 'Páginas → Produto',
    'ProductDetails': 'Páginas → Produto',
    'CompreJuntoSlot': 'Páginas → Produto',
  };
  return sectionMap[blockType] || null;
}
