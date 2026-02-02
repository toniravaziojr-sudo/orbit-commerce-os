// =============================================
// USE PAGE COLORS - Fetch custom colors for cart/checkout pages
// Colors override the global theme when set (non-empty)
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface PageColors {
  buttonPrimaryBg?: string;
  buttonPrimaryText?: string;
  buttonPrimaryHover?: string;
  buttonSecondaryBg?: string;
  buttonSecondaryText?: string;
  buttonSecondaryHover?: string;
  // Checkout-specific: flags/tags color (badges like "Grátis", "Frete Grátis")
  flagsColor?: string;
}

/**
 * Fetches custom page colors from published template content
 * Used for cart and checkout pages to override theme colors
 */
export function usePageColors(tenantSlug: string, pageType: 'cart' | 'checkout') {
  return useQuery({
    queryKey: ['page-colors', tenantSlug, pageType],
    queryFn: async (): Promise<PageColors | null> => {
      if (!tenantSlug) return null;

      // Get tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenant) return null;

      // Get store settings to find published_template_id
      const { data: storeSettings, error: settingsError } = await supabase
        .from('store_settings')
        .select('published_template_id')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (settingsError) return null;

      const templateSetId = storeSettings?.published_template_id;
      if (!templateSetId) return null;

      // Get the published_content from the template set
      const { data: templateSet, error: templateError } = await supabase
        .from('storefront_template_sets')
        .select('published_content')
        .eq('id', templateSetId)
        .eq('tenant_id', tenant.id)
        .single();

      if (templateError || !templateSet) return null;

      // Extract page colors from published_content.themeSettings.pageSettings
      const publishedContent = templateSet.published_content as Record<string, unknown> | null;
      const themeSettings = publishedContent?.themeSettings as Record<string, unknown> | undefined;
      const pageSettings = themeSettings?.pageSettings as Record<string, unknown> | undefined;
      const pageConfig = pageSettings?.[pageType] as PageColors | undefined;

      if (!pageConfig) return null;

      // Return only if any color is set
      const hasColors = 
        pageConfig.buttonPrimaryBg || 
        pageConfig.buttonPrimaryText || 
        pageConfig.buttonPrimaryHover ||
        pageConfig.buttonSecondaryBg || 
        pageConfig.buttonSecondaryText ||
        pageConfig.buttonSecondaryHover ||
        pageConfig.flagsColor;

      return hasColors ? pageConfig : null;
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 2, // 2 minutes cache
  });
}

/**
 * Generates CSS string for page-specific color overrides
 * IMPORTANT: Uses high-specificity selectors with !important to override global theme
 */
export function getPageColorsCss(colors: PageColors | null | undefined): string {
  if (!colors) return '';

  const hasAnyColor = 
    colors.buttonPrimaryBg || 
    colors.buttonPrimaryText || 
    colors.buttonPrimaryHover ||
    colors.buttonSecondaryBg || 
    colors.buttonSecondaryText ||
    colors.buttonSecondaryHover ||
    colors.flagsColor;

  if (!hasAnyColor) return '';

  // Build CSS with high-specificity button rules (not just variables)
  // These rules use !important to override the global theme injector
  let css = `/* Page-specific color overrides - high specificity */\n`;

  // Primary button overrides
  if (colors.buttonPrimaryBg || colors.buttonPrimaryText) {
    css += `
    .storefront-container button[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]),
    .storefront-container a[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]),
    .storefront-container span[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]) {
      ${colors.buttonPrimaryBg ? `background-color: ${colors.buttonPrimaryBg} !important;` : ''}
      ${colors.buttonPrimaryText ? `color: ${colors.buttonPrimaryText} !important;` : ''}
    }`;
  }

  // Primary button hover override
  if (colors.buttonPrimaryHover) {
    css += `
    .storefront-container button[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover:not(:disabled),
    .storefront-container a[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover,
    .storefront-container span[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover {
      background-color: ${colors.buttonPrimaryHover} !important;
    }`;
  }

  // Secondary button overrides
  if (colors.buttonSecondaryBg || colors.buttonSecondaryText) {
    css += `
    .storefront-container button[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]),
    .storefront-container a[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]),
    .storefront-container span[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]) {
      ${colors.buttonSecondaryBg ? `background-color: ${colors.buttonSecondaryBg} !important;` : ''}
      ${colors.buttonSecondaryText ? `color: ${colors.buttonSecondaryText} !important;` : ''}
    }`;
  }

  // Secondary button hover override
  if (colors.buttonSecondaryHover) {
    css += `
    .storefront-container button[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover:not(:disabled),
    .storefront-container a[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover,
    .storefront-container span[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover {
      background-color: ${colors.buttonSecondaryHover} !important;
    }`;
  }

  // Flags/tags color override (checkout-specific)
  if (colors.flagsColor) {
    css += `
    /* Flags/Tags color override */
    .storefront-container .sf-tag-success,
    .storefront-container .sf-checkout-flag {
      background-color: color-mix(in srgb, ${colors.flagsColor} 15%, transparent) !important;
      color: ${colors.flagsColor} !important;
    }
    .storefront-container .sf-flag-text {
      color: ${colors.flagsColor} !important;
    }`;
  }

  // Also set CSS variables for any other components that might use them
  const vars: string[] = [];
  if (colors.buttonPrimaryBg) vars.push(`--theme-button-primary-bg: ${colors.buttonPrimaryBg};`);
  if (colors.buttonPrimaryText) vars.push(`--theme-button-primary-text: ${colors.buttonPrimaryText};`);
  if (colors.buttonPrimaryHover) vars.push(`--theme-button-primary-hover: ${colors.buttonPrimaryHover};`);
  if (colors.buttonSecondaryBg) vars.push(`--theme-button-secondary-bg: ${colors.buttonSecondaryBg};`);
  if (colors.buttonSecondaryText) vars.push(`--theme-button-secondary-text: ${colors.buttonSecondaryText};`);
  if (colors.buttonSecondaryHover) vars.push(`--theme-button-secondary-hover: ${colors.buttonSecondaryHover};`);
  if (colors.flagsColor) vars.push(`--theme-flags-color: ${colors.flagsColor};`);

  if (vars.length > 0) {
    css += `
    .storefront-container {
      ${vars.join('\n      ')}
    }`;
  }

  return css;
}
