// =============================================
// STOREFRONT THEME INJECTOR - Injects theme CSS into document
// Applies typography and colors from published themeSettings
// OPTIMIZED: Accepts bootstrapTemplate to skip separate queries
// =============================================

import { useEffect } from 'react';
import { usePublicThemeSettings, getStorefrontThemeCss } from '@/hooks/usePublicThemeSettings';

interface StorefrontThemeInjectorProps {
  tenantSlug: string;
  /** Template from bootstrap — skips separate queries when provided */
  bootstrapTemplate?: any;
}

const STYLE_ID = 'storefront-theme-styles';

/**
 * Injects theme CSS variables and rules into the document head
 * This ensures typography and colors are applied globally across the storefront
 */
export function StorefrontThemeInjector({ tenantSlug, bootstrapTemplate }: StorefrontThemeInjectorProps) {
  const { themeSettings } = usePublicThemeSettings(tenantSlug, bootstrapTemplate);

  useEffect(() => {
    // Generate CSS from theme settings
    const css = getStorefrontThemeCss(themeSettings);

    // Update in-place to prevent CSS flash during re-renders
    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle) {
      existingStyle.textContent = css;
    } else {
      const styleElement = document.createElement('style');
      styleElement.id = STYLE_ID;
      styleElement.textContent = css;
      document.head.appendChild(styleElement);
    }

    // CRITICAL: Do NOT remove styles on unmount.
    // The theme must persist across page navigations within the storefront.
    // Removing it causes the "white screen" bug and branding flicker.
    // See: memory/infrastructure/css-injection-and-theme-lifecycle-rule
  }, [themeSettings]);

  // This component doesn't render anything visible
  return null;
}
