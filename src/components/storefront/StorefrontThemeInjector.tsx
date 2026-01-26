// =============================================
// STOREFRONT THEME INJECTOR - Injects theme CSS into document
// Applies typography and colors from published themeSettings
// =============================================

import { useEffect } from 'react';
import { usePublicThemeSettings, getStorefrontThemeCss } from '@/hooks/usePublicThemeSettings';

interface StorefrontThemeInjectorProps {
  tenantSlug: string;
}

const STYLE_ID = 'storefront-theme-styles';

/**
 * Injects theme CSS variables and rules into the document head
 * This ensures typography and colors are applied globally across the storefront
 */
export function StorefrontThemeInjector({ tenantSlug }: StorefrontThemeInjectorProps) {
  const { themeSettings } = usePublicThemeSettings(tenantSlug);

  useEffect(() => {
    // Remove existing style element if present
    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Generate and inject new CSS
    const css = getStorefrontThemeCss(themeSettings);
    
    const styleElement = document.createElement('style');
    styleElement.id = STYLE_ID;
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    // Cleanup on unmount
    return () => {
      const styleToRemove = document.getElementById(STYLE_ID);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [themeSettings]);

  // This component doesn't render anything visible
  return null;
}
