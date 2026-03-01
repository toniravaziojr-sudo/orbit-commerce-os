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

      // Get the page - filter by type to get correct content per page (institutional only)
      const { data: page, error: pageError } = await supabase
        .from('store_pages')
        .select('id, title, draft_version, published_version, content, type, template_id, individual_content')
        .eq('tenant_id', tenant.id)
        .eq('slug', pageSlug)
        .eq('type', 'institutional')
        .maybeSingle();

      if (pageError || !page) {
        throw new Error('Page not found');
      }

      // Use draft_version first, fallback to published_version
      const versionToUse = page.draft_version || page.published_version;

      if (versionToUse) {
        const { data: version, error: versionError } = await supabase
          .from('store_page_versions')
          .select('content')
          .eq('page_id', page.id)
          .eq('version', versionToUse)
          .maybeSingle();

        if (!versionError && version?.content) {
          return {
            content: version.content as unknown as BlockNode,
            pageTitle: page.title,
            pageId: page.id,
            individualContent: page.individual_content as string | null,
            canPreview: true,
          };
        }
      }
      
      // Fallback: use page.content directly if it has builder format
      if (page.content && typeof page.content === 'object' && 'type' in (page.content as object)) {
        return {
          content: page.content as unknown as BlockNode,
          pageTitle: page.title,
          pageId: page.id,
          individualContent: page.individual_content as string | null,
          canPreview: true,
        };
      }

      // Fallback to legacy content migration
      if (page.content) {
        const legacyText = typeof page.content === 'object' && page.content !== null && 'text' in page.content
          ? (page.content as { text: string }).text
          : '';
        
        if (legacyText) {
          const defaultTemplate = getDefaultTemplate('institutional');
          const updateContent = (node: BlockNode): BlockNode => {
            if (node.type === 'RichText') {
              return {
                ...node,
                props: {
                  ...node.props,
                  content: `<h1>${page.title}</h1>${legacyText.split('\n').filter(Boolean).map(p => `<p>${p}</p>`).join('')}`,
                },
              };
            }
            if (node.children) {
              return {
                ...node,
                children: node.children.map(updateContent),
              };
            }
            return node;
          };
          return {
            content: updateContent(defaultTemplate),
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

// Preview hook for landing pages
export function usePreviewLandingPageTemplate(tenantSlug: string, pageSlug: string): PreviewPageTemplateResult {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['preview-landing-page-template', tenantSlug, pageSlug, user?.id],
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

      // Get the page - must be landing_page type
      const { data: page, error: pageError } = await supabase
        .from('store_pages')
        .select('id, title, draft_version, published_version, content, type, individual_content')
        .eq('tenant_id', tenant.id)
        .eq('slug', pageSlug)
        .eq('type', 'landing_page')
        .maybeSingle();

      if (pageError || !page) {
        throw new Error('Landing page not found');
      }

      // Use draft_version first, fallback to published_version
      const versionToUse = page.draft_version || page.published_version;

      if (versionToUse) {
        const { data: version, error: versionError } = await supabase
          .from('store_page_versions')
          .select('content')
          .eq('tenant_id', tenant.id)
          .eq('entity_type', 'page')
          .eq('page_id', page.id)
          .eq('version', versionToUse)
          .maybeSingle();

        if (!versionError && version) {
          return {
            content: version.content as unknown as BlockNode,
            pageTitle: page.title,
            pageId: page.id,
            individualContent: page.individual_content as string | null,
            canPreview: true,
          };
        }
      }

      // Fallback to content field
      if (page.content && typeof page.content === 'object' && 'type' in (page.content as object)) {
        return {
          content: page.content as unknown as BlockNode,
          pageTitle: page.title,
          pageId: page.id,
          individualContent: page.individual_content as string | null,
          canPreview: true,
        };
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
