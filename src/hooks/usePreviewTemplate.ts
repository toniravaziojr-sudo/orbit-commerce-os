// =============================================
// PREVIEW TEMPLATE HOOK - Fetch draft templates for preview
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BlockNode } from '@/lib/builder/types';
import { getDefaultTemplate } from '@/lib/builder/defaults';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'tracking' | 'blog';

interface PreviewTemplateResult {
  content: BlockNode;
  isDefault: boolean;
  isLoading: boolean;
  error: Error | null;
  canPreview: boolean;
}

export function usePreviewTemplate(tenantSlug: string, pageType: PageType): PreviewTemplateResult {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['preview-template', tenantSlug, pageType, user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error('Authentication required for preview');
      }

      // First get the tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      // Check if user belongs to this tenant
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('tenant_id', tenant.id)
        .single();

      if (!userRole) {
        throw new Error('Access denied: not a member of this store');
      }

      // NEW MULTI-TEMPLATE SYSTEM: Read from storefront_template_sets.draft_content
      // This matches the save flow in VisualBuilder (useTemplateSetSave)
      const { data: storeSettings } = await supabase
        .from('store_settings')
        .select('published_template_id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      const templateSetId = storeSettings?.published_template_id;

      if (templateSetId) {
        const { data: templateSet, error: templateError } = await supabase
          .from('storefront_template_sets')
          .select('draft_content')
          .eq('id', templateSetId)
          .eq('tenant_id', tenant.id)
          .single();

        if (!templateError && templateSet?.draft_content) {
          const draftContent = templateSet.draft_content as unknown as Record<string, BlockNode | null> | null;
          if (draftContent && draftContent[pageType]) {
            return {
              content: draftContent[pageType] as BlockNode,
              isDefault: false,
              canPreview: true,
            };
          }
        }
      }

      // LEGACY FALLBACK: Read from storefront_page_templates + store_page_versions
      const { data: template, error: templateError } = await supabase
        .from('storefront_page_templates')
        .select('draft_version, published_version')
        .eq('tenant_id', tenant.id)
        .eq('page_type', pageType)
        .single();

      if (templateError && templateError.code !== 'PGRST116') {
        throw templateError;
      }

      const versionToUse = template?.draft_version || template?.published_version;

      if (!versionToUse) {
        return {
          content: getDefaultTemplate(pageType),
          isDefault: true,
          canPreview: true,
        };
      }

      const { data: version, error: versionError } = await supabase
        .from('store_page_versions')
        .select('content')
        .eq('tenant_id', tenant.id)
        .eq('entity_type', 'template')
        .eq('page_type', pageType)
        .eq('version', versionToUse)
        .single();

      if (versionError) {
        return {
          content: getDefaultTemplate(pageType),
          isDefault: true,
          canPreview: true,
        };
      }

      return {
        content: version.content as unknown as BlockNode,
        isDefault: false,
        canPreview: true,
      };
    },
    enabled: !!tenantSlug && !!user,
    staleTime: 1000 * 30,
  });

  if (!user) {
    return {
      content: getDefaultTemplate(pageType),
      isDefault: true,
      isLoading: false,
      error: new Error('Authentication required for preview'),
      canPreview: false,
    };
  }

  return {
    content: data?.content || getDefaultTemplate(pageType),
    isDefault: data?.isDefault ?? true,
    isLoading,
    error: error as Error | null,
    canPreview: data?.canPreview ?? false,
  };
}

// Preview hook for institutional pages
interface PreviewPageTemplateResult {
  content: BlockNode | null;
  isLoading: boolean;
  error: Error | null;
  canPreview: boolean;
  pageTitle: string | null;
  pageId: string | null;
  individualContent: string | null;
}

export function usePreviewPageTemplate(tenantSlug: string, pageSlug: string): PreviewPageTemplateResult {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['preview-page-template', tenantSlug, pageSlug, user?.id],
    queryFn: async () => {
      if (!user) {
        throw new Error('Authentication required for preview');
      }

      // First get the tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      // Check if user belongs to this tenant
      const { data: userRole } = await supabase
        .from('user_roles')
        .select('id')
        .eq('user_id', user.id)
        .eq('tenant_id', tenant.id)
        .single();

      if (!userRole) {
        throw new Error('Access denied: not a member of this store');
      }

      // UNIFIED: Get the page — NO type filter, works for all page types
      const { data: page, error: pageError } = await supabase
        .from('store_pages')
        .select('id, title, draft_content, content, type, template_id, individual_content')
        .eq('tenant_id', tenant.id)
        .eq('slug', pageSlug)
        .maybeSingle();

      if (pageError || !page) {
        throw new Error('Page not found');
      }

      // PRIORITY: draft_content > content > template.content > default
      // This is the unified save flow: builder saves to draft_content
      const draftContent = page.draft_content as unknown as BlockNode | null;
      if (draftContent && typeof draftContent === 'object' && 'type' in draftContent) {
        return {
          content: draftContent,
          pageTitle: page.title,
          pageId: page.id,
          individualContent: page.individual_content as string | null,
          canPreview: true,
        };
      }

      // Fallback: use published content field
      if (page.content && typeof page.content === 'object' && 'type' in (page.content as object)) {
        return {
          content: page.content as unknown as BlockNode,
          pageTitle: page.title,
          pageId: page.id,
          individualContent: page.individual_content as string | null,
          canPreview: true,
        };
      }

      // Fallback: template content
      if (page.template_id) {
        const { data: template } = await supabase
          .from('page_templates')
          .select('content')
          .eq('id', page.template_id)
          .single();

        if (template?.content) {
          return {
            content: template.content as unknown as BlockNode,
            pageTitle: page.title,
            pageId: page.id,
            individualContent: page.individual_content as string | null,
            canPreview: true,
          };
        }
      }

      return {
        content: getDefaultTemplate('institutional'),
        pageTitle: page.title,
        pageId: page.id,
        individualContent: page.individual_content as string | null,
        canPreview: true,
      };
    },
    enabled: !!tenantSlug && !!pageSlug && !!user,
    staleTime: 1000 * 30,
  });

  if (!user) {
    return {
      content: null,
      isLoading: false,
      error: new Error('Authentication required for preview'),
      canPreview: false,
      pageTitle: null,
      pageId: null,
      individualContent: null,
    };
  }

  return {
    content: data?.content || null,
    pageTitle: data?.pageTitle || null,
    pageId: data?.pageId || null,
    individualContent: data?.individualContent || null,
    isLoading,
    error: error as Error | null,
    canPreview: data?.canPreview ?? false,
  };
}

// Legacy alias: usePreviewLandingPageTemplate now unified into usePreviewPageTemplate
// (No type filter — works for all page types including landing_page)
export const usePreviewLandingPageTemplate = usePreviewPageTemplate;
