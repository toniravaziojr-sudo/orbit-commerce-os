// =============================================
// BUILDER THEME INJECTOR HOOK - Injects theme CSS in builder preview
// Uses DRAFT state for real-time preview (changes without saving)
// Falls back to saved themeSettings when no draft is available
// =============================================

import { useEffect } from 'react';
import { useThemeSettings, ThemeTypography, ThemeColors, DEFAULT_THEME_COLORS, DEFAULT_THEME_TYPOGRAPHY } from './useThemeSettings';
import { getFontFamily } from './usePublicThemeSettings';
import { useBuilderDraftTheme } from './useBuilderDraftTheme';

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
 * PRIORITY: Draft state (local unsaved) > Saved state (database)
 * This enables real-time preview without saving to database
 */
export function useBuilderThemeInjector(
  tenantId: string | undefined,
  templateSetId: string | undefined
) {
  const { themeSettings } = useThemeSettings(tenantId, templateSetId);
  const draftTheme = useBuilderDraftTheme();

  useEffect(() => {
    if (!tenantId || !templateSetId) return;

    // Remove existing style element if present
    const existingStyle = document.getElementById(BUILDER_STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
    }

    // PRIORITY: Use draft values if available, otherwise fall back to saved values
    // Draft values are set by ColorsSettings/TypographySettings for real-time preview
    const savedTypography = themeSettings?.typography;
    const savedColors = themeSettings?.colors;
    
    // Get effective values (draft overrides saved)
    const typography = draftTheme?.getEffectiveTypography(savedTypography) || savedTypography;
    const colors = draftTheme?.getEffectiveColors(savedColors) || savedColors;
    
    // Get effective custom CSS (draft overrides saved)
    const savedCustomCss = themeSettings?.customCss || '';
    const customCss = draftTheme?.getEffectiveCustomCss(savedCustomCss) || savedCustomCss;
    
    const headingFontFamily = getFontFamily(typography?.headingFont || 'inter');
    const bodyFontFamily = getFontFamily(typography?.bodyFont || 'inter');
    const baseFontSize = typography?.baseFontSize || 16;

    // Build color CSS variables from effective colors (draft or saved)
    const buttonPrimaryBg = colors?.buttonPrimaryBg || DEFAULT_THEME_COLORS.buttonPrimaryBg;
    const buttonPrimaryText = colors?.buttonPrimaryText || DEFAULT_THEME_COLORS.buttonPrimaryText;
    const buttonPrimaryHover = colors?.buttonPrimaryHover || DEFAULT_THEME_COLORS.buttonPrimaryHover;
    const buttonSecondaryBg = colors?.buttonSecondaryBg || DEFAULT_THEME_COLORS.buttonSecondaryBg;
    const buttonSecondaryText = colors?.buttonSecondaryText || DEFAULT_THEME_COLORS.buttonSecondaryText;
    const buttonSecondaryHover = colors?.buttonSecondaryHover || DEFAULT_THEME_COLORS.buttonSecondaryHover;
    const textPrimary = colors?.textPrimary || DEFAULT_THEME_COLORS.textPrimary;
    const textSecondary = colors?.textSecondary || DEFAULT_THEME_COLORS.textSecondary;
    // Special tag colors
    const successBg = colors?.successBg || DEFAULT_THEME_COLORS.successBg;
    const successText = colors?.successText || DEFAULT_THEME_COLORS.successText;
    const warningBg = colors?.warningBg || DEFAULT_THEME_COLORS.warningBg;
    const warningText = colors?.warningText || DEFAULT_THEME_COLORS.warningText;
    const dangerBg = colors?.dangerBg || DEFAULT_THEME_COLORS.dangerBg;
    const dangerText = colors?.dangerText || DEFAULT_THEME_COLORS.dangerText;
    const highlightBg = colors?.highlightBg || DEFAULT_THEME_COLORS.highlightBg;
    const highlightText = colors?.highlightText || DEFAULT_THEME_COLORS.highlightText;

    // Accent color (uses theme setting or default green)
    const accentColor = colors?.accentColor || DEFAULT_THEME_COLORS.accentColor;

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
        --theme-button-primary-hover: ${buttonPrimaryHover};
        --theme-button-secondary-bg: ${buttonSecondaryBg};
        --theme-button-secondary-text: ${buttonSecondaryText};
        --theme-button-secondary-hover: ${buttonSecondaryHover};
        --theme-text-primary: ${textPrimary};
        --theme-text-secondary: ${textSecondary};
        /* Accent color for UI elements (checkmarks, sliders, icons) */
        --theme-accent-color: ${accentColor};
        /* Special tag colors */
        --theme-success-bg: ${successBg};
        --theme-success-text: ${successText};
        --theme-warning-bg: ${warningBg};
        --theme-warning-text: ${warningText};
        --theme-danger-bg: ${dangerBg};
        --theme-danger-text: ${dangerText};
        --theme-highlight-bg: ${highlightBg};
        --theme-highlight-text: ${highlightText};
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

      /* Theme-aware button styles for builder preview - HIGH SPECIFICITY to override Tailwind */
      /* Using button.sf-btn-primary to beat Tailwind's hover:bg-primary/90 specificity */
      button.sf-btn-primary,
      .builder-preview-canvas button.sf-btn-primary,
      .storefront-container button.sf-btn-primary {
        background-color: var(--theme-button-primary-bg) !important;
        color: var(--theme-button-primary-text) !important;
        transition: background-color 0.2s ease, color 0.2s ease !important;
      }
      button.sf-btn-primary:hover,
      .builder-preview-canvas button.sf-btn-primary:hover,
      .storefront-container button.sf-btn-primary:hover {
        background-color: var(--theme-button-primary-hover) !important;
        color: var(--theme-button-primary-text) !important;
        opacity: 1 !important;
      }
      button.sf-btn-secondary,
      .builder-preview-canvas button.sf-btn-secondary,
      .storefront-container button.sf-btn-secondary {
        background-color: var(--theme-button-secondary-bg) !important;
        color: var(--theme-button-secondary-text) !important;
        transition: background-color 0.2s ease, color 0.2s ease !important;
      }
      button.sf-btn-secondary:hover,
      .builder-preview-canvas button.sf-btn-secondary:hover,
      .storefront-container button.sf-btn-secondary:hover {
        background-color: var(--theme-button-secondary-hover) !important;
        color: var(--theme-button-secondary-text) !important;
        opacity: 1 !important;
      }
      
      /* Special tag colors - theme-based classes */
      .builder-preview-canvas .sf-tag-success,
      .storefront-container .sf-tag-success {
        background-color: var(--theme-success-bg, #22c55e) !important;
        color: var(--theme-success-text, #ffffff) !important;
      }
      .builder-preview-canvas .sf-tag-warning,
      .storefront-container .sf-tag-warning {
        background-color: var(--theme-warning-bg, #f97316) !important;
        color: var(--theme-warning-text, #ffffff) !important;
      }
      .builder-preview-canvas .sf-tag-danger,
      .storefront-container .sf-tag-danger {
        background-color: var(--theme-danger-bg, #ef4444) !important;
        color: var(--theme-danger-text, #ffffff) !important;
      }
      .builder-preview-canvas .sf-tag-highlight,
      .storefront-container .sf-tag-highlight {
        background-color: var(--theme-highlight-bg, #3b82f6) !important;
        color: var(--theme-highlight-text, #ffffff) !important;
      }

      /* Custom CSS from theme settings */
      ${customCss}
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
  }, [
    tenantId, 
    templateSetId, 
    themeSettings?.typography, 
    themeSettings?.colors,
    themeSettings?.customCss,
    // Re-run when draft changes for real-time preview
    draftTheme?.draftColors,
    draftTheme?.draftTypography,
    draftTheme?.draftCustomCss,
  ]);
}
