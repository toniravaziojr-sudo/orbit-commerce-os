// =============================================
// PUBLIC THEME SETTINGS HOOK - Read published themeSettings
// Reads from storefront_template_sets.published_content.themeSettings
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ThemeSettings, ThemeColors } from './useThemeSettings';

interface PublicThemeSettingsResult {
  themeSettings: ThemeSettings | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to read published themeSettings for public storefront
 * Reads from the active published template set's published_content.themeSettings
 */
export function usePublicThemeSettings(tenantSlug: string): PublicThemeSettingsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-theme-settings', tenantSlug],
    queryFn: async () => {
      // First get the tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenant) {
        console.warn('Tenant not found for theme settings:', tenantSlug);
        return null;
      }

      // Get store settings to find the published_template_id
      const { data: storeSettings, error: settingsError } = await supabase
        .from('store_settings')
        .select('published_template_id, is_published')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (settingsError) {
        console.warn('Error fetching store settings:', settingsError);
        return null;
      }

      // If store is not published, return null
      if (!storeSettings?.is_published) {
        return null;
      }

      // Get the published template id
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
        return null;
      }

      // Get the published_content from the template set
      const { data: templateSet, error: templateError } = await supabase
        .from('storefront_template_sets')
        .select('published_content')
        .eq('id', templateSetId)
        .eq('tenant_id', tenant.id)
        .single();

      if (templateError) {
        console.warn('Template set not found:', templateError);
        return null;
      }

      // Extract themeSettings from published_content
      const publishedContent = templateSet.published_content as Record<string, unknown> | null;
      
      if (!publishedContent?.themeSettings) {
        return null;
      }

      return publishedContent.themeSettings as ThemeSettings;
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 15, // Cache for 15 minutes
    gcTime: 1000 * 60 * 30, // Keep in cache for 30 minutes
  });

  return {
    themeSettings: data || null,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Get CSS variables from published themeSettings
 */
export function getThemeSettingsCssVars(themeSettings: ThemeSettings | null): string {
  if (!themeSettings?.colors) {
    return '';
  }

  const colors = themeSettings.colors;
  const typography = themeSettings.typography;
  
  const cssVars: string[] = [];

  // Colors - using correct ThemeColors properties
  if (colors.buttonPrimaryBg) {
    cssVars.push(`--theme-button-primary-bg: ${colors.buttonPrimaryBg};`);
  }
  if (colors.buttonPrimaryText) {
    cssVars.push(`--theme-button-primary-text: ${colors.buttonPrimaryText};`);
  }
  if (colors.buttonSecondaryBg) {
    cssVars.push(`--theme-button-secondary-bg: ${colors.buttonSecondaryBg};`);
  }
  if (colors.buttonSecondaryText) {
    cssVars.push(`--theme-button-secondary-text: ${colors.buttonSecondaryText};`);
  }
  if (colors.textPrimary) {
    cssVars.push(`--theme-text-primary: ${colors.textPrimary};`);
  }
  if (colors.textSecondary) {
    cssVars.push(`--theme-text-secondary: ${colors.textSecondary};`);
  }

  // Typography
  if (typography?.headingFont) {
    cssVars.push(`--theme-heading-font: ${typography.headingFont};`);
  }
  if (typography?.bodyFont) {
    cssVars.push(`--theme-body-font: ${typography.bodyFont};`);
  }
  if (typography?.baseFontSize) {
    cssVars.push(`--theme-base-font-size: ${typography.baseFontSize}px;`);
  }

  return cssVars.join('\n');
}
