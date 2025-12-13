// =============================================
// PUBLIC TEMPLATE HOOK - Fetch published templates
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { BlockNode } from '@/lib/builder/types';
import { getDefaultTemplate } from '@/lib/builder/defaults';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout';

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

      // Get the template for this page type
      const { data: template, error: templateError } = await supabase
        .from('storefront_page_templates')
        .select('published_version')
        .eq('tenant_id', tenant.id)
        .eq('page_type', pageType)
        .single();

      if (templateError && templateError.code !== 'PGRST116') {
        throw templateError;
      }

      // If no published version, return default
      if (!template?.published_version) {
        return {
          content: getDefaultTemplate(pageType),
          isDefault: true,
        };
      }

      // Get the published version content
      const { data: version, error: versionError } = await supabase
        .from('store_page_versions')
        .select('content')
        .eq('tenant_id', tenant.id)
        .eq('entity_type', 'template')
        .eq('page_type', pageType)
        .eq('version', template.published_version)
        .eq('status', 'published')
        .single();

      if (versionError) {
        // Fallback to default if version not found
        return {
          content: getDefaultTemplate(pageType),
          isDefault: true,
        };
      }

      return {
        content: version.content as unknown as BlockNode,
        isDefault: false,
      };
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  return {
    content: data?.content || getDefaultTemplate(pageType),
    isDefault: data?.isDefault ?? true,
    isLoading,
    error: error as Error | null,
  };
}
