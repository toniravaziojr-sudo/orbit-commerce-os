// =============================================
// PAGE OVERRIDES HOOK - Manage page-specific settings overrides
// =============================================

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Json } from '@/integrations/supabase/types';

export interface HeaderOverrides {
  noticeEnabled?: boolean;
}

export interface FooterOverrides {
  noticeEnabled?: boolean;
}

export interface PageOverrides {
  header?: HeaderOverrides;
  footer?: FooterOverrides;
}

interface UsePageOverridesParams {
  tenantId: string;
  pageType: 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'institutional' | 'landing_page';
  pageId?: string; // For institutional/landing_page
}

export function usePageOverrides({ tenantId, pageType, pageId }: UsePageOverridesParams) {
  const queryClient = useQueryClient();

  // Determine if this is a template or a page
  const isTemplate = !['institutional', 'landing_page'].includes(pageType);
  const queryKey = ['page-overrides', tenantId, pageType, pageId];

  // Fetch current overrides
  const { data: overrides, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (isTemplate) {
        // Fetch from storefront_page_templates
        const { data, error } = await supabase
          .from('storefront_page_templates')
          .select('page_overrides')
          .eq('tenant_id', tenantId)
          .eq('page_type', pageType)
          .maybeSingle();

        if (error) throw error;
        return (data?.page_overrides as PageOverrides) || {};
      } else {
        // Fetch from store_pages
        if (!pageId) return {};
        const { data, error } = await supabase
          .from('store_pages')
          .select('page_overrides')
          .eq('id', pageId)
          .maybeSingle();

        if (error) throw error;
        return (data?.page_overrides as PageOverrides) || {};
      }
    },
    enabled: !!tenantId && (isTemplate || !!pageId),
  });

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
