// =============================================
// PREVIEW TEMPLATE HOOK - Fetch draft templates for preview
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { BlockNode } from '@/lib/builder/types';
import { getDefaultTemplate } from '@/lib/builder/defaults';

type PageType = 'home' | 'category' | 'product' | 'cart' | 'checkout';

interface PreviewTemplateResult {
  content: BlockNode;
  isDefault: boolean;
  isLoading: boolean;
  error: Error | null;
  canPreview: boolean;
}

export function usePreviewTemplate(tenantSlug: string, pageType: PageType): PreviewTemplateResult {
  const { user, currentTenant } = useAuth();

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

      // Get the template for this page type
      const { data: template, error: templateError } = await supabase
        .from('storefront_page_templates')
        .select('draft_version, published_version')
        .eq('tenant_id', tenant.id)
        .eq('page_type', pageType)
        .single();

      if (templateError && templateError.code !== 'PGRST116') {
        throw templateError;
      }

      // Use draft_version first, fallback to published_version
      const versionToUse = template?.draft_version || template?.published_version;

      // If no version, return default
      if (!versionToUse) {
        return {
          content: getDefaultTemplate(pageType),
          isDefault: true,
          canPreview: true,
        };
      }

      // Get the version content (draft or published)
      const { data: version, error: versionError } = await supabase
        .from('store_page_versions')
        .select('content')
        .eq('tenant_id', tenant.id)
        .eq('entity_type', 'template')
        .eq('page_type', pageType)
        .eq('version', versionToUse)
        .single();

      if (versionError) {
        // Fallback to default if version not found
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
    staleTime: 1000 * 30, // Cache for 30 seconds (shorter for preview)
  });

  // User not logged in
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
