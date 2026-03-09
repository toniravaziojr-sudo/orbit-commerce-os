// =============================================
// PUBLIC THEME SETTINGS HOOK - Read published themeSettings
// Reads from storefront_template_sets.published_content.themeSettings
// REFACTORED: Uses centralized theme utils from src/lib/storefront-theme-utils.ts
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ThemeSettings } from './useThemeSettings';
import {
  FONT_FAMILY_MAP,
  getFontFamily,
  hexToHslValues,
  generateColorCssVars,
  generateButtonCssRules,
  generateAccentAndTagCssRules,
} from '@/lib/storefront-theme-utils';

// Re-export for backward compatibility
export { FONT_FAMILY_MAP, getFontFamily };

interface PublicThemeSettingsResult {
  themeSettings: ThemeSettings | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to read published themeSettings for public storefront
 * Reads from the active published template set's published_content.themeSettings
 * 
 * OPTIMIZATION: If bootstrapTemplate is provided (from usePublicStorefront),
 * skips all queries and extracts themeSettings directly from bootstrap data.
 */
export function usePublicThemeSettings(
  tenantSlug: string,
  bootstrapTemplate?: any,
): PublicThemeSettingsResult {
  // If bootstrap data is available, extract themeSettings directly — no queries needed
  const bootstrapThemeSettings = bootstrapTemplate?.published_content
    ? ((bootstrapTemplate.published_content as Record<string, unknown>)?.themeSettings as ThemeSettings | undefined) || null
    : undefined; // undefined means "no bootstrap", null means "bootstrap but no settings"

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
    // SKIP query entirely when bootstrap data is available
    enabled: !!tenantSlug && bootstrapThemeSettings === undefined,
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
  });

  // Use bootstrap data if available, otherwise query data
  const resolvedThemeSettings = bootstrapThemeSettings !== undefined
    ? bootstrapThemeSettings
    : (data || null);

  return {
    themeSettings: resolvedThemeSettings,
    isLoading: bootstrapThemeSettings !== undefined ? false : isLoading,
    error: bootstrapThemeSettings !== undefined ? null : (error as Error | null),
  };
}

/**
 * Get CSS variables from published themeSettings
 * Generates CSS with proper font-family values for typography
 */
export function getThemeSettingsCssVars(themeSettings: ThemeSettings | null): string {
  const cssVars: string[] = [];

  // Colors
  const colors = themeSettings?.colors;
  if (colors) {
    cssVars.push(...generateColorCssVars(colors));
  }

  // Typography - with proper font-family values
  const typography = themeSettings?.typography;
  if (typography) {
    const headingFontFamily = getFontFamily(typography.headingFont || 'inter');
    const bodyFontFamily = getFontFamily(typography.bodyFont || 'inter');
    const baseFontSize = typography.baseFontSize || 16;

    cssVars.push(`--sf-heading-font: ${headingFontFamily};`);
    cssVars.push(`--sf-body-font: ${bodyFontFamily};`);
    cssVars.push(`--sf-base-font-size: ${baseFontSize}px;`);
  } else {
    // Defaults
    cssVars.push(`--sf-heading-font: 'Inter', sans-serif;`);
    cssVars.push(`--sf-body-font: 'Inter', sans-serif;`);
    cssVars.push(`--sf-base-font-size: 16px;`);
  }

  return cssVars.join('\n');
}

/**
 * Generate complete CSS string for storefront theme injection
 * Includes both CSS variables and selector rules
 * REFACTORED: Uses shared button/tag CSS generators
 */
export function getStorefrontThemeCss(themeSettings: ThemeSettings | null): string {
  const typography = themeSettings?.typography;
  const colors = themeSettings?.colors;
  
  const headingFontFamily = getFontFamily(typography?.headingFont || 'inter');
  const bodyFontFamily = getFontFamily(typography?.bodyFont || 'inter');
  const baseFontSize = typography?.baseFontSize || 16;

  // Build color CSS variables using centralized generator
  const colorVars = generateColorCssVars(colors);
  const colorCss = colorVars.length > 0 ? colorVars.join('\n      ') : '';

  // Convert hex to HSL for Tailwind CSS variable override
  const primaryBgHex = colors?.buttonPrimaryBg || '#1a1a1a';
  const primaryTextHex = colors?.buttonPrimaryText || '#ffffff';
  const primaryHsl = hexToHslValues(primaryBgHex);
  const primaryFgHsl = hexToHslValues(primaryTextHex);

  // Generate button and tag rules from shared source
  const buttonRules = generateButtonCssRules('.storefront-container');
  const accentTagRules = generateAccentAndTagCssRules('.storefront-container');

  return `
    /* Storefront Theme - Typography & Colors */
    :root {
      --sf-heading-font: ${headingFontFamily};
      --sf-body-font: ${bodyFontFamily};
      --sf-base-font-size: ${baseFontSize}px;
      ${colorCss}
    }
    
    /* CRITICAL: Override Tailwind's --primary inside storefront to use theme colors */
    .storefront-container {
      --primary: ${primaryHsl};
      --primary-foreground: ${primaryFgHsl};
      font-family: var(--sf-body-font);
      font-size: var(--sf-base-font-size);
    }
    
    /* Apply heading font to all headings within storefront */
    .storefront-container h1,
    .storefront-container h2,
    .storefront-container h3,
    .storefront-container h4,
    .storefront-container h5,
    .storefront-container h6 {
      font-family: var(--sf-heading-font);
    }
    
    /* Apply body font to paragraphs, buttons, and general text */
    .storefront-container p,
    .storefront-container span,
    .storefront-container a,
    .storefront-container button,
    .storefront-container input,
    .storefront-container textarea,
    .storefront-container select,
    .storefront-container label,
    .storefront-container li {
      font-family: var(--sf-body-font);
    }

    ${buttonRules}
    ${accentTagRules}
  `;
}
