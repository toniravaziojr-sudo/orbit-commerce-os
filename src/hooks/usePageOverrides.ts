// =============================================
// PAGE OVERRIDES HOOK - Manage page-specific settings overrides
// =============================================

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export interface HeaderOverrides {
  noticeEnabled?: boolean;
  headerEnabled?: boolean;  // Exibir/ocultar header nesta página
  showHeaderMenu?: boolean; // Exibir/ocultar o menu dentro do header nesta página
}

export interface FooterOverrides {
  noticeEnabled?: boolean;
  footerEnabled?: boolean;  // Exibir/ocultar footer nesta página
  showFooter1?: boolean;    // Exibir/ocultar menu footer 1
  showFooter2?: boolean;    // Exibir/ocultar menu footer 2
}

export interface PageOverrides {
  header?: HeaderOverrides;
  footer?: FooterOverrides;
}

interface UsePageOverridesParams {
  tenantId: string;
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'institutional' | 'landing_page' | 'tracking' | 'blog' | 'page_template';
  pageId?: string; // For institutional/landing_page
}

export function usePageOverrides({ tenantId, pageType, pageId }: UsePageOverridesParams) {
  const queryClient = useQueryClient();

  // Determine if this is a template or a page
  const isTemplate = !['institutional', 'landing_page'].includes(pageType);
  const queryKey = ['page-overrides', tenantId, pageType, pageId];

  // Fetch current overrides - NEVER throws
  const { data: overrides, isLoading, error, isFetched } = useQuery({
    queryKey,
    queryFn: async (): Promise<PageOverrides> => {
      console.log('[usePageOverrides] Fetching for:', { tenantId, pageType, pageId, isTemplate });
      
      if (!tenantId) {
        console.warn('[usePageOverrides] No tenantId, returning empty');
        return {};
      }

      try {
        if (isTemplate) {
          // Fetch from storefront_page_templates
          const { data, error } = await supabase
            .from('storefront_page_templates')
            .select('page_overrides')
            .eq('tenant_id', tenantId)
            .eq('page_type', pageType)
            .maybeSingle();

          if (error) {
            console.error('[usePageOverrides] Template query error:', error);
            return {};
          }
          
          console.log('[usePageOverrides] Template data:', data ? 'found' : 'not found');
          return (data?.page_overrides as PageOverrides) || {};
        } else {
          // Fetch from store_pages
          if (!pageId) {
            console.warn('[usePageOverrides] No pageId for non-template');
            return {};
          }
          
          const { data, error } = await supabase
            .from('store_pages')
            .select('page_overrides')
            .eq('id', pageId)
            .maybeSingle();

          if (error) {
            console.error('[usePageOverrides] Page query error:', error);
            return {};
          }
          
          console.log('[usePageOverrides] Page data:', data ? 'found' : 'not found');
          return (data?.page_overrides as PageOverrides) || {};
        }
      } catch (err) {
        console.error('[usePageOverrides] Unexpected error:', err);
        return {};
      }
    },
    enabled: true, // Always enabled - handle missing data inside queryFn
    staleTime: 30000,
    retry: 1,
  });

  // Log state for debugging
  useEffect(() => {
    console.log('[usePageOverrides] State:', {
      tenantId,
      pageType,
      isLoading,
      isFetched,
      hasData: overrides !== undefined,
      error: error?.message,
    });
  }, [tenantId, pageType, isLoading, isFetched, overrides, error]);

  // Update header overrides
  const updateHeaderOverrides = useMutation({
    mutationFn: async (headerOverrides: HeaderOverrides) => {
      const newOverrides: PageOverrides = {
        ...(overrides || {}),
        header: {
          ...(overrides?.header || {}),
          ...headerOverrides,
        },
      };

      if (isTemplate) {
        const { error } = await supabase
          .from('storefront_page_templates')
          .update({ page_overrides: newOverrides as unknown as Json })
          .eq('tenant_id', tenantId)
          .eq('page_type', pageType);

        if (error) throw error;
      } else {
        if (!pageId) throw new Error('pageId required for page overrides');
        const { error } = await supabase
          .from('store_pages')
          .update({ page_overrides: newOverrides as unknown as Json })
          .eq('id', pageId);

        if (error) throw error;
      }

      return newOverrides;
    },
    onSuccess: (newOverrides) => {
      queryClient.setQueryData(queryKey, newOverrides);
    },
  });

  // Update footer overrides
  const updateFooterOverrides = useMutation({
    mutationFn: async (footerOverrides: FooterOverrides) => {
      const newOverrides: PageOverrides = {
        ...(overrides || {}),
        footer: {
          ...(overrides?.footer || {}),
          ...footerOverrides,
        },
      };

      if (isTemplate) {
        const { error } = await supabase
          .from('storefront_page_templates')
          .update({ page_overrides: newOverrides as unknown as Json })
          .eq('tenant_id', tenantId)
          .eq('page_type', pageType);

        if (error) throw error;
      } else {
        if (!pageId) throw new Error('pageId required for page overrides');
        const { error } = await supabase
          .from('store_pages')
          .update({ page_overrides: newOverrides as unknown as Json })
          .eq('id', pageId);

        if (error) throw error;
      }

      return newOverrides;
    },
    onSuccess: (newOverrides) => {
      queryClient.setQueryData(queryKey, newOverrides);
    },
  });

  // Clear a specific header override (revert to global)
  const clearHeaderOverride = useMutation({
    mutationFn: async (key: keyof HeaderOverrides) => {
      const currentHeader = overrides?.header || {};
      const { [key]: _, ...rest } = currentHeader;
      
      const newOverrides: PageOverrides = {
        ...(overrides || {}),
        header: Object.keys(rest).length > 0 ? rest : undefined,
      };

      // Clean up empty header object
      if (!newOverrides.header || Object.keys(newOverrides.header).length === 0) {
        delete newOverrides.header;
      }

      if (isTemplate) {
        const { error } = await supabase
          .from('storefront_page_templates')
          .update({ page_overrides: newOverrides as unknown as Json })
          .eq('tenant_id', tenantId)
          .eq('page_type', pageType);

        if (error) throw error;
      } else {
        if (!pageId) throw new Error('pageId required for page overrides');
        const { error } = await supabase
          .from('store_pages')
          .update({ page_overrides: newOverrides as unknown as Json })
          .eq('id', pageId);

        if (error) throw error;
      }

      return newOverrides;
    },
    onSuccess: (newOverrides) => {
      queryClient.setQueryData(queryKey, newOverrides);
    },
  });

  // Clear a specific footer override (revert to global)
  const clearFooterOverride = useMutation({
    mutationFn: async (key: keyof FooterOverrides) => {
      const currentFooter = overrides?.footer || {};
      const { [key]: _, ...rest } = currentFooter;
      
      const newOverrides: PageOverrides = {
        ...(overrides || {}),
        footer: Object.keys(rest).length > 0 ? rest : undefined,
      };

      // Clean up empty footer object
      if (!newOverrides.footer || Object.keys(newOverrides.footer).length === 0) {
        delete newOverrides.footer;
      }

      if (isTemplate) {
        const { error } = await supabase
          .from('storefront_page_templates')
          .update({ page_overrides: newOverrides as unknown as Json })
          .eq('tenant_id', tenantId)
          .eq('page_type', pageType);

        if (error) throw error;
      } else {
        if (!pageId) throw new Error('pageId required for page overrides');
        const { error } = await supabase
          .from('store_pages')
          .update({ page_overrides: newOverrides as unknown as Json })
          .eq('id', pageId);

        if (error) throw error;
      }

      return newOverrides;
    },
    onSuccess: (newOverrides) => {
      queryClient.setQueryData(queryKey, newOverrides);
    },
  });

  return {
    overrides: overrides || {},
    isLoading,
    updateHeaderOverrides,
    clearHeaderOverride,
    updateFooterOverrides,
    clearFooterOverride,
    // Helper to get effective header notice enabled state
    getEffectiveHeaderNoticeEnabled: (globalNoticeEnabled: boolean): boolean => {
      const override = overrides?.header?.noticeEnabled;
      return override !== undefined ? override : globalNoticeEnabled;
    },
    // Check if there's a header notice override
    hasHeaderNoticeOverride: (): boolean => {
      return overrides?.header?.noticeEnabled !== undefined;
    },
    // Helper to get effective footer notice enabled state
    getEffectiveFooterNoticeEnabled: (globalNoticeEnabled: boolean): boolean => {
      const override = overrides?.footer?.noticeEnabled;
      return override !== undefined ? override : globalNoticeEnabled;
    },
    // Check if there's a footer notice override
    hasFooterNoticeOverride: (): boolean => {
      return overrides?.footer?.noticeEnabled !== undefined;
    },
    // Helper to get effective header enabled state
    getEffectiveHeaderEnabled: (globalHeaderEnabled: boolean): boolean => {
      const override = overrides?.header?.headerEnabled;
      return override !== undefined ? override : globalHeaderEnabled;
    },
    // Check if there's a header enabled override
    hasHeaderEnabledOverride: (): boolean => {
      return overrides?.header?.headerEnabled !== undefined;
    },
    // Helper to get effective footer enabled state
    getEffectiveFooterEnabled: (globalFooterEnabled: boolean): boolean => {
      const override = overrides?.footer?.footerEnabled;
      return override !== undefined ? override : globalFooterEnabled;
    },
    // Check if there's a footer enabled override
    hasFooterEnabledOverride: (): boolean => {
      return overrides?.footer?.footerEnabled !== undefined;
    },
    // Helper to get effective show footer 1 state
    getEffectiveShowFooter1: (globalShowFooter1: boolean): boolean => {
      const override = overrides?.footer?.showFooter1;
      return override !== undefined ? override : globalShowFooter1;
    },
    // Check if there's a show footer 1 override
    hasShowFooter1Override: (): boolean => {
      return overrides?.footer?.showFooter1 !== undefined;
    },
    // Helper to get effective show footer 2 state
    getEffectiveShowFooter2: (globalShowFooter2: boolean): boolean => {
      const override = overrides?.footer?.showFooter2;
      return override !== undefined ? override : globalShowFooter2;
    },
    // Check if there's a show footer 2 override
    hasShowFooter2Override: (): boolean => {
      return overrides?.footer?.showFooter2 !== undefined;
    },
  };
}

/**
 * Utility function to calculate effective notice enabled state
 * Priority: override > global
 */
export function getEffectiveNoticeEnabled(
  globalNoticeEnabled: boolean,
  pageOverrides?: PageOverrides
): boolean {
  const override = pageOverrides?.header?.noticeEnabled;
  return override !== undefined ? override : globalNoticeEnabled;
}
