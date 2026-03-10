// =============================================
// BUILDER THEME INJECTOR HOOK - Injects theme CSS in builder preview
// Uses DRAFT state for real-time preview (changes without saving)
// Falls back to saved themeSettings when no draft is available
// Also injects page-specific color overrides for cart/checkout
// REFACTORED: Uses centralized theme utils from src/lib/storefront-theme-utils.ts
// =============================================

import { useEffect } from 'react';
import { useThemeSettings, ThemeColors, DEFAULT_THEME_COLORS } from './useThemeSettings';
import { getFontFamily } from '@/lib/storefront-theme-utils';
import { hexToHslValues, generateButtonCssRules, generateTextColorCssRules, generateAccentAndTagCssRules } from '@/lib/storefront-theme-utils';
import { useBuilderDraftTheme } from './useBuilderDraftTheme';
import { useBuilderDraftPageSettings, PageSettingsKey } from './useBuilderDraftPageSettings';
import { getPageColorsCss, PageColors } from './usePageColors';
import type { CartSettings, CheckoutSettings } from './usePageSettings';

const BUILDER_STYLE_ID = 'builder-theme-styles';
const BUILDER_PAGE_COLORS_STYLE_ID = 'builder-page-colors-styles';

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
    const savedTypography = themeSettings?.typography;
    const savedColors = themeSettings?.colors;
    
    const typography = draftTheme?.getEffectiveTypography(savedTypography) || savedTypography;
    const colors = draftTheme?.getEffectiveColors(savedColors) || savedColors;
    
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
    const whatsappColor = colors?.whatsappColor || DEFAULT_THEME_COLORS.whatsappColor;
    const whatsappHover = colors?.whatsappHover || DEFAULT_THEME_COLORS.whatsappHover;
    const textPrimary = colors?.textPrimary || DEFAULT_THEME_COLORS.textPrimary;
    const textSecondary = colors?.textSecondary || DEFAULT_THEME_COLORS.textSecondary;
    const priceColor = colors?.priceColor || '';
    const successBg = colors?.successBg || DEFAULT_THEME_COLORS.successBg;
    const successText = colors?.successText || DEFAULT_THEME_COLORS.successText;
    const warningBg = colors?.warningBg || DEFAULT_THEME_COLORS.warningBg;
    const warningText = colors?.warningText || DEFAULT_THEME_COLORS.warningText;
    const dangerBg = colors?.dangerBg || DEFAULT_THEME_COLORS.dangerBg;
    const dangerText = colors?.dangerText || DEFAULT_THEME_COLORS.dangerText;
    const highlightBg = colors?.highlightBg || DEFAULT_THEME_COLORS.highlightBg;
    const highlightText = colors?.highlightText || DEFAULT_THEME_COLORS.highlightText;
    const accentColor = colors?.accentColor || DEFAULT_THEME_COLORS.accentColor;

    // Convert hex to HSL for Tailwind CSS variable override
    const primaryHsl = hexToHslValues(buttonPrimaryBg);
    const primaryFgHsl = hexToHslValues(buttonPrimaryText);

    // Generate button and tag rules from shared source
    const buttonRules = generateButtonCssRules('.storefront-container');
    const accentTagRules = generateAccentAndTagCssRules('.storefront-container');

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
        --theme-whatsapp-color: ${whatsappColor};
        --theme-whatsapp-hover: ${whatsappHover};
        --theme-text-primary: ${textPrimary};
        --theme-text-secondary: ${textSecondary};
        ${priceColor ? `--theme-price-color: ${priceColor};` : ''}
        --theme-accent-color: ${accentColor};
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

      ${buttonRules}
      ${accentTagRules}

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

    // Extract color fields
    const settings = effectiveSettings as Record<string, unknown>;
    const pageColors: PageColors = {
      buttonPrimaryBg: settings.buttonPrimaryBg as string | undefined,
      buttonPrimaryText: settings.buttonPrimaryText as string | undefined,
      buttonPrimaryHover: settings.buttonPrimaryHover as string | undefined,
      buttonSecondaryBg: settings.buttonSecondaryBg as string | undefined,
      buttonSecondaryText: settings.buttonSecondaryText as string | undefined,
      buttonSecondaryHover: settings.buttonSecondaryHover as string | undefined,
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
