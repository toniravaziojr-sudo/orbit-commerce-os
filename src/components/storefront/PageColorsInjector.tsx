// =============================================
// PAGE COLORS INJECTOR - Injects page-specific CSS overrides
// For cart and checkout pages to override theme colors
// =============================================

import { useEffect } from 'react';
import { usePageColors, getPageColorsCss } from '@/hooks/usePageColors';

const STYLE_ID = 'page-colors-styles';

interface PageColorsInjectorProps {
  tenantSlug: string;
  pageType: 'checkout';
}

export function PageColorsInjector({ tenantSlug, pageType }: PageColorsInjectorProps) {
  const { data: pageColors } = usePageColors(tenantSlug, pageType);

  useEffect(() => {
    // Only inject if we have custom colors
    if (!pageColors) {
      // No page colors — remove any existing override
      const existing = document.getElementById(STYLE_ID);
      if (existing) existing.remove();
      return;
    }

    const css = getPageColorsCss(pageColors);
    if (!css) {
      const existing = document.getElementById(STYLE_ID);
      if (existing) existing.remove();
      return;
    }

    // Update in-place to avoid CSS flash
    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle) {
      existingStyle.textContent = css;
    } else {
      const styleElement = document.createElement('style');
      styleElement.id = STYLE_ID;
      styleElement.textContent = css;
      document.head.appendChild(styleElement);
    }

    // Cleanup on unmount — page-specific overrides MUST be removed
    // when leaving the page (e.g., leaving checkout restores default theme)
    return () => {
      const styleToRemove = document.getElementById(STYLE_ID);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [pageColors]);

  // This component doesn't render anything visible
  return null;
}
