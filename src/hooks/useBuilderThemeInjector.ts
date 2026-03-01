// =============================================
// BUILDER THEME INJECTOR HOOK - Injects theme CSS in builder preview
// Uses DRAFT state for real-time preview (changes without saving)
// Falls back to saved themeSettings when no draft is available
// Also injects page-specific color overrides for cart/checkout
// =============================================

import { useEffect } from 'react';
import { useThemeSettings, ThemeTypography, ThemeColors, DEFAULT_THEME_COLORS, DEFAULT_THEME_TYPOGRAPHY } from './useThemeSettings';
import { getFontFamily } from './usePublicThemeSettings';
import { useBuilderDraftTheme } from './useBuilderDraftTheme';
import { useBuilderDraftPageSettings, PageSettingsKey } from './useBuilderDraftPageSettings';
import { getPageColorsCss, PageColors } from './usePageColors';
import type { CartSettings, CheckoutSettings } from './usePageSettings';

const BUILDER_STYLE_ID = 'builder-theme-styles';
const BUILDER_PAGE_COLORS_STYLE_ID = 'builder-page-colors-styles';

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
  templateSetId: string | undefined,
  currentPageType?: string
) {
  const { themeSettings } = useThemeSettings(tenantId, templateSetId);
  const draftTheme = useBuilderDraftTheme();
  const draftPageSettings = useBuilderDraftPageSettings();

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
    // WhatsApp button colors
    const whatsappColor = colors?.whatsappColor || DEFAULT_THEME_COLORS.whatsappColor;
    const whatsappHover = colors?.whatsappHover || DEFAULT_THEME_COLORS.whatsappHover;
    const textPrimary = colors?.textPrimary || DEFAULT_THEME_COLORS.textPrimary;
    const textSecondary = colors?.textSecondary || DEFAULT_THEME_COLORS.textSecondary;
    // Price color - exclusive for main/discounted price
    const priceColor = colors?.priceColor || '';
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
        /* WhatsApp button colors */
        --theme-whatsapp-color: ${whatsappColor};
        --theme-whatsapp-hover: ${whatsappHover};
        --theme-text-primary: ${textPrimary};
        --theme-text-secondary: ${textSecondary};
        /* Price color - exclusive for main/discounted price */
        ${priceColor ? `--theme-price-color: ${priceColor};` : ''}
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
      
      /* CRITICAL: Override Tailwind's --primary inside storefront to use theme colors */
      /* This makes ALL bg-primary, text-primary, border-primary respect the theme */
      .storefront-container {
        --primary: ${primaryHsl};
        --primary-foreground: ${primaryFgHsl};
        font-family: var(--sf-body-font);
        font-size: var(--sf-base-font-size);
      }
      
      /* Apply heading font to all headings */
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
      /* Theme-aware button styles - uses .storefront-container for proper scoping */
      /* IMPORTANT: Uses attribute selector [class*="sf-btn-"] for reliable single-class matching */
      /* Combined with !important to override Tailwind's hover:bg-accent from ghost variant */
      
      /* PRIMARY BUTTON - Normal state */
      .storefront-container button[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]),
      .storefront-container span[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]),
      .storefront-container a[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]) {
        background-color: var(--theme-button-primary-bg) !important;
        color: var(--theme-button-primary-text) !important;
        transition: all 0.2s ease !important;
      }
      
      /* PRIMARY BUTTON - Hover state */
      .storefront-container button[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover:not(:disabled),
      .storefront-container span[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover,
      .storefront-container a[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover {
        background-color: var(--theme-button-primary-hover) !important;
        color: var(--theme-button-primary-text) !important;
        opacity: 1 !important;
        transform: translateY(-1px) !important;
        filter: brightness(1.05) !important;
      }
      
      /* OUTLINE PRIMARY BUTTON - Normal state (transparent bg with primary border/text) */
      .storefront-container button[class*="sf-btn-outline-primary"],
      .storefront-container span[class*="sf-btn-outline-primary"],
      .storefront-container a[class*="sf-btn-outline-primary"] {
        background-color: transparent !important;
        color: var(--theme-button-primary-bg) !important;
        border: 1px solid var(--theme-button-primary-bg) !important;
        transition: all 0.2s ease !important;
      }
      
      /* OUTLINE PRIMARY BUTTON - Hover state (fill with primary bg) */
      .storefront-container button[class*="sf-btn-outline-primary"]:hover:not(:disabled),
      .storefront-container span[class*="sf-btn-outline-primary"]:hover,
      .storefront-container a[class*="sf-btn-outline-primary"]:hover {
        background-color: var(--theme-button-primary-bg) !important;
        color: var(--theme-button-primary-text) !important;
        border-color: var(--theme-button-primary-bg) !important;
        opacity: 1 !important;
        transform: translateY(-1px) !important;
      }
      
      /* SECONDARY BUTTON - Normal state */
      .storefront-container button[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]),
      .storefront-container span[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]),
      .storefront-container a[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]) {
        background-color: var(--theme-button-secondary-bg) !important;
        color: var(--theme-button-secondary-text) !important;
        transition: all 0.2s ease !important;
      }
      
      /* SECONDARY BUTTON - Hover state */
      .storefront-container button[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover:not(:disabled),
      .storefront-container span[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover,
      .storefront-container a[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover {
        background-color: var(--theme-button-secondary-hover) !important;
        color: var(--theme-button-secondary-text) !important;
        opacity: 1 !important;
        transform: translateY(-1px) !important;
        filter: brightness(1.05) !important;
      }
      
      /* OUTLINE SECONDARY BUTTON - Normal state */
      .storefront-container button[class*="sf-btn-outline-secondary"],
      .storefront-container span[class*="sf-btn-outline-secondary"],
      .storefront-container a[class*="sf-btn-outline-secondary"] {
        background-color: transparent !important;
        color: var(--theme-button-secondary-text) !important;
        border: 1px solid var(--theme-button-secondary-bg) !important;
        transition: all 0.2s ease !important;
      }
      
      /* OUTLINE SECONDARY BUTTON - Hover state */
      .storefront-container button[class*="sf-btn-outline-secondary"]:hover:not(:disabled),
      .storefront-container span[class*="sf-btn-outline-secondary"]:hover,
      .storefront-container a[class*="sf-btn-outline-secondary"]:hover {
        background-color: var(--theme-button-secondary-bg) !important;
        color: var(--theme-button-secondary-text) !important;
        border-color: var(--theme-button-secondary-bg) !important;
        opacity: 1 !important;
        transform: translateY(-1px) !important;
      }
      
      /* Special tag colors - theme-based classes */
      .storefront-container .sf-tag-success {
        background-color: var(--theme-success-bg, #22c55e);
        color: var(--theme-success-text, #ffffff);
      }
      .storefront-container .sf-tag-warning {
        background-color: var(--theme-warning-bg, #f97316);
        color: var(--theme-warning-text, #ffffff);
      }
      .storefront-container .sf-tag-danger {
        background-color: var(--theme-danger-bg, #ef4444);
        color: var(--theme-danger-text, #ffffff);
      }
      .storefront-container .sf-tag-highlight {
        background-color: var(--theme-highlight-bg, #3b82f6);
        color: var(--theme-highlight-text, #ffffff);
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

  // Second effect: Inject page-specific color overrides for cart/checkout
  // PRIORITY: Draft > Saved > (none)
  useEffect(() => {
    // Remove existing page colors style element if present
    const existingStyle = document.getElementById(BUILDER_PAGE_COLORS_STYLE_ID);
    if (existingStyle) {
      existingStyle.remove();
    }

    // Only apply for cart or checkout pages
    if (currentPageType !== 'cart' && currentPageType !== 'checkout') return;
    
    const pageKey = currentPageType as PageSettingsKey;
    const draftSettings = draftPageSettings?.getDraftPageSettings(pageKey);
    
    // Get saved page settings from themeSettings.pageSettings
    const savedPageSettings = themeSettings?.pageSettings?.[pageKey] as (CartSettings | CheckoutSettings) | undefined;
    
    // PRIORITY: Draft takes precedence over saved
    const effectiveSettings = draftSettings || savedPageSettings;
    
    if (!effectiveSettings) return;

    // Extract color fields - use type assertion since we checked pageType
    const settings = effectiveSettings as Record<string, unknown>;
    const pageColors: PageColors = {
      buttonPrimaryBg: settings.buttonPrimaryBg as string | undefined,
      buttonPrimaryText: settings.buttonPrimaryText as string | undefined,
      buttonPrimaryHover: settings.buttonPrimaryHover as string | undefined,
      buttonSecondaryBg: settings.buttonSecondaryBg as string | undefined,
      buttonSecondaryText: settings.buttonSecondaryText as string | undefined,
      buttonSecondaryHover: settings.buttonSecondaryHover as string | undefined,
      // Checkout-specific: flags color
      flagsColor: settings.flagsColor as string | undefined,
    };

    const css = getPageColorsCss(pageColors);
    if (!css) return;

    const styleElement = document.createElement('style');
    styleElement.id = BUILDER_PAGE_COLORS_STYLE_ID;
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    // Cleanup on unmount
    return () => {
      const styleToRemove = document.getElementById(BUILDER_PAGE_COLORS_STYLE_ID);
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [
    currentPageType,
    draftPageSettings?.draftPageSettings,
    themeSettings?.pageSettings,
  ]);
}
