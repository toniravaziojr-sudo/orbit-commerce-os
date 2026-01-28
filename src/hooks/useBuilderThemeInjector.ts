// =============================================
// BUILDER THEME INJECTOR HOOK - Injects theme CSS in builder preview
// Uses draft themeSettings for real-time preview (typography AND colors)
// =============================================

import { useEffect } from 'react';
import { useThemeSettings, ThemeTypography, ThemeColors, DEFAULT_THEME_COLORS } from './useThemeSettings';
import { getFontFamily } from './usePublicThemeSettings';

const BUILDER_STYLE_ID = 'builder-theme-styles';

/**
 * Convert hex color to HSL values string for CSS variable (without hsl() wrapper)
 * Returns format: "H S% L%" for use in Tailwind CSS variables
 */
function hexToHslValues(hex: string): string {
  // Remove # if present
  const cleanHex = hex.replace('#', '');
  
  // Parse RGB
  const r = parseInt(cleanHex.substring(0, 2), 16) / 255;
  const g = parseInt(cleanHex.substring(2, 4), 16) / 255;
  const b = parseInt(cleanHex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Hook to inject theme CSS into the builder preview
 * Uses draft_content.themeSettings for real-time preview
 * Injects BOTH typography AND color variables
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
    const colors = themeSettings?.colors;
    
    const headingFontFamily = getFontFamily(typography?.headingFont || 'inter');
    const bodyFontFamily = getFontFamily(typography?.bodyFont || 'inter');
    const baseFontSize = typography?.baseFontSize || 16;

    // Build color CSS variables from themeSettings.colors
    // Use saved colors or defaults (NOT blue!)
    const buttonPrimaryBg = colors?.buttonPrimaryBg || DEFAULT_THEME_COLORS.buttonPrimaryBg;
    const buttonPrimaryText = colors?.buttonPrimaryText || DEFAULT_THEME_COLORS.buttonPrimaryText;
    const buttonSecondaryBg = colors?.buttonSecondaryBg || DEFAULT_THEME_COLORS.buttonSecondaryBg;
    const buttonSecondaryText = colors?.buttonSecondaryText || DEFAULT_THEME_COLORS.buttonSecondaryText;
    const textPrimary = colors?.textPrimary || DEFAULT_THEME_COLORS.textPrimary;
    const textSecondary = colors?.textSecondary || DEFAULT_THEME_COLORS.textSecondary;

    // Convert hex to HSL for Tailwind CSS variable override
    const primaryHsl = hexToHslValues(buttonPrimaryBg);
    const primaryFgHsl = hexToHslValues(buttonPrimaryText);

    const css = `
      /* Builder Theme Preview - Typography & Colors */
      :root {
        --sf-heading-font: ${headingFontFamily};
        --sf-body-font: ${bodyFontFamily};
        --sf-base-font-size: ${baseFontSize}px;
        
        /* Theme colors - from Configurações do Tema > Cores */
        --theme-button-primary-bg: ${buttonPrimaryBg};
        --theme-button-primary-text: ${buttonPrimaryText};
        --theme-button-secondary-bg: ${buttonSecondaryBg};
        --theme-button-secondary-text: ${buttonSecondaryText};
        --theme-text-primary: ${textPrimary};
        --theme-text-secondary: ${textSecondary};
      }
      
      /* CRITICAL: Override Tailwind's --primary inside builder preview to use theme colors */
      /* This makes ALL bg-primary, text-primary, border-primary respect the theme */
      .builder-preview-canvas,
      .storefront-container {
        --primary: ${primaryHsl};
        --primary-foreground: ${primaryFgHsl};
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

      /* Theme-aware button styles for builder preview - !important to override Tailwind bg-primary */
      .builder-preview-canvas .sf-btn-primary,
      .storefront-container .sf-btn-primary {
        background-color: var(--theme-button-primary-bg) !important;
        color: var(--theme-button-primary-text) !important;
      }
      .builder-preview-canvas .sf-btn-primary:hover,
      .storefront-container .sf-btn-primary:hover {
        opacity: 0.9;
      }
      .builder-preview-canvas .sf-btn-secondary,
      .storefront-container .sf-btn-secondary {
        background-color: var(--theme-button-secondary-bg) !important;
        color: var(--theme-button-secondary-text) !important;
      }
      .builder-preview-canvas .sf-btn-secondary:hover,
      .storefront-container .sf-btn-secondary:hover {
        opacity: 0.9;
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
  }, [tenantId, templateSetId, themeSettings?.typography, themeSettings?.colors]);
}
