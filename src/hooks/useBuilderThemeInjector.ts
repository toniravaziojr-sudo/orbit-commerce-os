// =============================================
// BUILDER THEME INJECTOR HOOK - Injects theme CSS in builder preview
// Uses draft themeSettings for real-time preview
// =============================================

import { useEffect } from 'react';
import { useThemeSettings, ThemeTypography } from './useThemeSettings';
import { getFontFamily } from './usePublicThemeSettings';

const BUILDER_STYLE_ID = 'builder-theme-styles';

/**
 * Hook to inject theme CSS into the builder preview
 * Uses draft_content.themeSettings for real-time preview
 */
export function useBuilderThemeInjector(
  tenantId: string | undefined,
  templateSetId: string | undefined
) {
  const { themeSettings } = useThemeSettings(tenantId, templateSetId);

  useEffect(() => {
    if (!tenantId || !templateSetId) return;

    // Remove existing style element if present
    const existingStyle = document.getElementById(BUILDER_STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Generate CSS from draft themeSettings
    const typography = themeSettings?.typography;
    const headingFontFamily = getFontFamily(typography?.headingFont || 'inter');
    const bodyFontFamily = getFontFamily(typography?.bodyFont || 'inter');
    const baseFontSize = typography?.baseFontSize || 16;

    const css = `
      /* Builder Theme Preview - Typography */
      :root {
        --sf-heading-font: ${headingFontFamily};
        --sf-body-font: ${bodyFontFamily};
        --sf-base-font-size: ${baseFontSize}px;
      }
      
      /* Apply typography to builder preview canvas */
      .builder-preview-canvas,
      .storefront-container {
        font-family: var(--sf-body-font);
        font-size: var(--sf-base-font-size);
      }
      
      /* Apply heading font to all headings */
      .builder-preview-canvas h1,
      .builder-preview-canvas h2,
      .builder-preview-canvas h3,
      .builder-preview-canvas h4,
      .builder-preview-canvas h5,
      .builder-preview-canvas h6,
      .storefront-container h1,
      .storefront-container h2,
      .storefront-container h3,
      .storefront-container h4,
      .storefront-container h5,
      .storefront-container h6 {
        font-family: var(--sf-heading-font);
      }
      
      /* Apply body font to paragraphs, buttons, and general text */
      .builder-preview-canvas p,
      .builder-preview-canvas span,
      .builder-preview-canvas a,
      .builder-preview-canvas button,
      .builder-preview-canvas input,
      .builder-preview-canvas textarea,
      .builder-preview-canvas select,
      .builder-preview-canvas label,
      .builder-preview-canvas li,
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
    `;

    const styleElement = document.createElement('style');
    styleElement.id = BUILDER_STYLE_ID;
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    // Cleanup on unmount
    return () => {
      const styleToRemove = document.getElementById(BUILDER_STYLE_ID);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [tenantId, templateSetId, themeSettings?.typography]);
}
