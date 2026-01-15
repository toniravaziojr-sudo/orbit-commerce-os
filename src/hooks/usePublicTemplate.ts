// =============================================
// PUBLIC TEMPLATE HOOK - Fetch published templates from storefront_template_sets
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BlockNode } from '@/lib/builder/types';
import { getDefaultTemplate } from '@/lib/builder/defaults';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you' | 'account' | 'account_orders' | 'account_order_detail' | 'tracking' | 'blog';

interface PublicTemplateResult {
  content: BlockNode;
  isDefault: boolean;
  isLoading: boolean;
  error: Error | null;
}

export function usePublicTemplate(tenantSlug: string, pageType: PageType): PublicTemplateResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-template', tenantSlug, pageType],
    queryFn: async () => {
      // First get the tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      // Get store settings to find the published_template_id
      const { data: storeSettings, error: settingsError } = await supabase
        .from('store_settings')
        .select('published_template_id, is_published')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (settingsError) {
        throw settingsError;
      }

      // If store is not published, return default
      if (!storeSettings?.is_published) {
        return {
          content: getDefaultTemplate(pageType),
          isDefault: true,
        };
      }

      // If no published template id, try to get any published template set
      let templateSetId = storeSettings.published_template_id;
      
      if (!templateSetId) {
        // Fallback: get the first published template set
        const { data: fallbackTemplate } = await supabase
          .from('storefront_template_sets')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('is_published', true)
          .limit(1)
          .maybeSingle();
        
        if (fallbackTemplate) {
          templateSetId = fallbackTemplate.id;
        }
      }

      if (!templateSetId) {
        return {
          content: getDefaultTemplate(pageType),
          isDefault: true,
        };
      }

      // Get the published content from the template set
      const { data: templateSet, error: templateError } = await supabase
        .from('storefront_template_sets')
        .select('published_content')
        .eq('id', templateSetId)
        .eq('tenant_id', tenant.id)
        .single();

      if (templateError) {
        console.warn('Template set not found:', templateError);
        return {
          content: getDefaultTemplate(pageType),
          isDefault: true,
        };
      }

      // Extract the page content from published_content
      const publishedContent = templateSet.published_content as unknown as Record<string, BlockNode | null> | null;
      
      if (!publishedContent || !publishedContent[pageType]) {
        return {
          content: getDefaultTemplate(pageType),
          isDefault: true,
        };
      }

      return {
        content: publishedContent[pageType] as BlockNode,
        isDefault: false,
      };
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes (published templates rarely change)
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });

  return {
    content: data?.content || getDefaultTemplate(pageType),
    isDefault: data?.isDefault ?? true,
    isLoading,
    error: error as Error | null,
  };
}

// Hook for institutional pages
interface PublicPageTemplateResult {
  content: BlockNode | null;
  isLoading: boolean;
  error: Error | null;
  pageTitle: string | null;
  pageId: string | null;
  individualContent: string | null;
  // SEO fields
  metaTitle: string | null;
  metaDescription: string | null;
  metaImageUrl: string | null;
  noIndex: boolean;
  canonicalUrl: string | null;
  pageType: string | null;
}

export function usePublicPageTemplate(tenantSlug: string, pageSlug: string): PublicPageTemplateResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-page-template', tenantSlug, pageSlug],
    queryFn: async () => {
      // First get the tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenant) {
        throw new Error('Tenant not found');
      }

      // Get the page with SEO fields - filter by type 'institutional' only
      const { data: page, error: pageError } = await supabase
        .from('store_pages')
        .select('id, title, published_version, is_published, content, type, meta_title, meta_description, meta_image_url, no_index, canonical_url, template_id, individual_content')
        .eq('tenant_id', tenant.id)
        .eq('slug', pageSlug)
        .eq('type', 'institutional')
        .maybeSingle();

      if (pageError || !page) {
        throw new Error('Page not found');
      }

      // Page must be published for public access
      if (!page.is_published) {
        throw new Error('Page not published');
      }

      // If page has a template_id, get content from page_templates table
      if (page.template_id) {
        const { data: template, error: templateError } = await supabase
          .from('page_templates')
          .select('content')
          .eq('id', page.template_id)
          .single();
        
        if (!templateError && template?.content) {
          return {
            content: template.content as unknown as BlockNode,
            pageTitle: page.title,
            pageId: page.id,
            individualContent: page.individual_content as string | null,
            metaTitle: page.meta_title,
            metaDescription: page.meta_description,
            metaImageUrl: page.meta_image_url,
            noIndex: page.no_index || false,
            canonicalUrl: page.canonical_url,
            pageType: page.type,
          };
        }
      }

      // Prepare SEO data
      const seoData = {
        metaTitle: page.meta_title,
        metaDescription: page.meta_description,
        metaImageUrl: page.meta_image_url,
        noIndex: page.no_index || false,
        canonicalUrl: page.canonical_url,
        pageType: page.type,
      };

      // If has published version, get that version's content
      if (page.published_version) {
        const { data: version, error: versionError } = await supabase
          .from('store_page_versions')
          .select('content')
          .eq('page_id', page.id)
          .eq('version', page.published_version)
          .eq('status', 'published')
          .maybeSingle();

        if (!versionError && version?.content) {
          return {
            content: version.content as unknown as BlockNode,
            pageTitle: page.title,
            pageId: page.id,
            individualContent: page.individual_content as string | null,
            ...seoData,
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
          ...seoData,
        };
      }

      // Fallback: try to migrate legacy content to builder format
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
            ...seoData,
          };
        }
      }

      // Return default template with page title
      const defaultTemplate = getDefaultTemplate('institutional');
      return {
        content: defaultTemplate,
        pageTitle: page.title,
        pageId: page.id,
        individualContent: page.individual_content as string | null,
        ...seoData,
      };
    },
    enabled: !!tenantSlug && !!pageSlug,
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes (published pages rarely change)
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });

  return {
    content: data?.content || null,
    pageTitle: data?.pageTitle || null,
    pageId: data?.pageId || null,
    individualContent: data?.individualContent || null,
    metaTitle: data?.metaTitle || null,
    metaDescription: data?.metaDescription || null,
    metaImageUrl: data?.metaImageUrl || null,
    noIndex: data?.noIndex || false,
    canonicalUrl: data?.canonicalUrl || null,
    pageType: data?.pageType || null,
    isLoading,
    error: error as Error | null,
  };
}
