// =============================================
// PAGE COLORS INJECTOR - Injects page-specific CSS overrides
// For cart and checkout pages to override theme colors
// =============================================

import { useEffect } from 'react';
import { usePageColors, getPageColorsCss } from '@/hooks/usePageColors';

const STYLE_ID = 'page-colors-styles';

interface PageColorsInjectorProps {
  tenantSlug: string;
  pageType: 'cart' | 'checkout';
}

export function PageColorsInjector({ tenantSlug, pageType }: PageColorsInjectorProps) {
  const { data: pageColors } = usePageColors(tenantSlug, pageType);

  useEffect(() => {
    // Remove existing style element if present
    const existingStyle = document.getElementById(STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Only inject if we have custom colors
    if (!pageColors) return;

    const css = getPageColorsCss(pageColors);
    if (!css) return;

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
  }, [pageColors]);

  // This component doesn't render anything visible
  return null;
}
