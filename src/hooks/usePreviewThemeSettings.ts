// =============================================
// PREVIEW THEME SETTINGS HOOK - Read draft themeSettings for preview mode
// Reads from storefront_template_sets.draft_content.themeSettings
// Used by StorefrontThemeInjector when ?preview=1
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { ThemeSettings } from './useThemeSettings';

interface PreviewThemeSettingsResult {
  themeSettings: ThemeSettings | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to read DRAFT themeSettings for preview mode.
 * Reads from storefront_template_sets.draft_content.themeSettings
 * (not published_content), so saved-but-unpublished theme changes
 * are reflected immediately in preview.
 * 
 * Only enabled when isPreview=true to avoid unnecessary queries.
 */
export function usePreviewThemeSettings(
  tenantSlug: string,
  isPreview: boolean,
): PreviewThemeSettingsResult {
  const { user } = useAuth();

  const { data, isLoading, error } = useQuery({
    queryKey: ['preview-theme-settings', tenantSlug, user?.id],
    queryFn: async () => {
      if (!user) return null;

      // Get tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenant) return null;

      // Get the published_template_id (points to the active template set)
      const { data: storeSettings } = await supabase
        .from('store_settings')
        .select('published_template_id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      const templateSetId = storeSettings?.published_template_id;
      if (!templateSetId) return null;

      // Read draft_content (not published_content) for preview
      const { data: templateSet, error: templateError } = await supabase
        .from('storefront_template_sets')
        .select('draft_content')
        .eq('id', templateSetId)
        .eq('tenant_id', tenant.id)
        .single();

      if (templateError || !templateSet?.draft_content) return null;

      const draftContent = templateSet.draft_content as Record<string, unknown> | null;
      if (!draftContent?.themeSettings) return null;

      return draftContent.themeSettings as ThemeSettings;
    },
    // Only fetch when in preview mode AND authenticated
    enabled: isPreview && !!tenantSlug && !!user,
    // No stale time — always fetch fresh draft on preview
    staleTime: 0,
    gcTime: 1000 * 60 * 5,
  });

  return {
    themeSettings: data || null,
    isLoading: isPreview ? isLoading : false,
    error: isPreview ? (error as Error | null) : null,
  };
}
