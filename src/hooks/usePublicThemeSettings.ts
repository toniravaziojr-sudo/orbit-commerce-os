// =============================================
// PUBLIC THEME SETTINGS HOOK - Read published themeSettings
// Reads from storefront_template_sets.published_content.themeSettings
// =============================================

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { ThemeSettings, ThemeColors } from './useThemeSettings';

// ============================================
// FONT FAMILY MAP - Maps font value to CSS font-family
// ============================================
export const FONT_FAMILY_MAP: Record<string, string> = {
  // Sans-serif fonts
  'inter': "'Inter', sans-serif",
  'roboto': "'Roboto', sans-serif",
  'open-sans': "'Open Sans', sans-serif",
  'lato': "'Lato', sans-serif",
  'montserrat': "'Montserrat', sans-serif",
  'poppins': "'Poppins', sans-serif",
  'nunito': "'Nunito', sans-serif",
  'raleway': "'Raleway', sans-serif",
  'source-sans-pro': "'Source Sans Pro', sans-serif",
  'ubuntu': "'Ubuntu', sans-serif",
  'mulish': "'Mulish', sans-serif",
  'work-sans': "'Work Sans', sans-serif",
  'quicksand': "'Quicksand', sans-serif",
  'dm-sans': "'DM Sans', sans-serif",
  'manrope': "'Manrope', sans-serif",
  'outfit': "'Outfit', sans-serif",
  'plus-jakarta-sans': "'Plus Jakarta Sans', sans-serif",
  // Serif fonts
  'playfair': "'Playfair Display', serif",
  'merriweather': "'Merriweather', serif",
  'lora': "'Lora', serif",
  'pt-serif': "'PT Serif', serif",
  'crimson-text': "'Crimson Text', serif",
  'libre-baskerville': "'Libre Baskerville', serif",
  'cormorant-garamond': "'Cormorant Garamond', serif",
  'eb-garamond': "'EB Garamond', serif",
  'bitter': "'Bitter', serif",
  // Display fonts
  'abril-fatface': "'Abril Fatface', cursive",
  'bebas-neue': "'Bebas Neue', sans-serif",
  'oswald': "'Oswald', sans-serif",
  'josefin-sans': "'Josefin Sans', sans-serif",
  'righteous': "'Righteous', cursive",
};

/**
 * Get the CSS font-family string for a font value
 */
export function getFontFamily(fontValue: string): string {
  return FONT_FAMILY_MAP[fontValue] || FONT_FAMILY_MAP['inter'];
}

interface PublicThemeSettingsResult {
  themeSettings: ThemeSettings | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to read published themeSettings for public storefront
 * Reads from the active published template set's published_content.themeSettings
 */
export function usePublicThemeSettings(tenantSlug: string): PublicThemeSettingsResult {
  const { data, isLoading, error } = useQuery({
    queryKey: ['public-theme-settings', tenantSlug],
    queryFn: async () => {
      // First get the tenant ID from slug
      const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('id')
        .eq('slug', tenantSlug)
        .single();

      if (tenantError || !tenant) {
        console.warn('Tenant not found for theme settings:', tenantSlug);
        return null;
      }

      // Get store settings to find the published_template_id
      const { data: storeSettings, error: settingsError } = await supabase
        .from('store_settings')
        .select('published_template_id, is_published')
        .eq('tenant_id', tenant.id)
        .maybeSingle();

      if (settingsError) {
        console.warn('Error fetching store settings:', settingsError);
        return null;
      }

      // If store is not published, return null
      if (!storeSettings?.is_published) {
        return null;
      }

      // Get the published template id
      let templateSetId = storeSettings.published_template_id;
      
      if (!templateSetId) {
        // Fallback: get the first published template set
        const { data: fallbackTemplate } = await supabase
          .from('storefront_template_sets')
          .select('id')
          .eq('tenant_id', tenant.id)
          .eq('is_published', true)
          .limit(1)
          .maybeSingle();
        
        if (fallbackTemplate) {
          templateSetId = fallbackTemplate.id;
        }
      }

      if (!templateSetId) {
        return null;
      }

      // Get the published_content from the template set
      const { data: templateSet, error: templateError } = await supabase
        .from('storefront_template_sets')
        .select('published_content')
        .eq('id', templateSetId)
        .eq('tenant_id', tenant.id)
        .single();

      if (templateError) {
        console.warn('Template set not found:', templateError);
        return null;
      }

      // Extract themeSettings from published_content
      const publishedContent = templateSet.published_content as Record<string, unknown> | null;
      
      if (!publishedContent?.themeSettings) {
        return null;
      }

      return publishedContent.themeSettings as ThemeSettings;
    },
    enabled: !!tenantSlug,
    staleTime: 1000 * 60 * 2, // Cache for 2 minutes - allows quick updates after publishing
    gcTime: 1000 * 60 * 10, // Keep in cache for 10 minutes
  });

  return {
    themeSettings: data || null,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Get CSS variables from published themeSettings
 * Generates CSS with proper font-family values for typography
 */
export function getThemeSettingsCssVars(themeSettings: ThemeSettings | null): string {
  const cssVars: string[] = [];

  // Colors
  const colors = themeSettings?.colors;
  if (colors) {
    if (colors.buttonPrimaryBg) {
      cssVars.push(`--theme-button-primary-bg: ${colors.buttonPrimaryBg};`);
    }
    if (colors.buttonPrimaryText) {
      cssVars.push(`--theme-button-primary-text: ${colors.buttonPrimaryText};`);
    }
    if (colors.buttonSecondaryBg) {
      cssVars.push(`--theme-button-secondary-bg: ${colors.buttonSecondaryBg};`);
    }
    if (colors.buttonSecondaryText) {
      cssVars.push(`--theme-button-secondary-text: ${colors.buttonSecondaryText};`);
    }
    if (colors.textPrimary) {
      cssVars.push(`--theme-text-primary: ${colors.textPrimary};`);
    }
    if (colors.textSecondary) {
      cssVars.push(`--theme-text-secondary: ${colors.textSecondary};`);
    }
  }

  // Typography - with proper font-family values
  const typography = themeSettings?.typography;
  if (typography) {
    const headingFontFamily = getFontFamily(typography.headingFont || 'inter');
    const bodyFontFamily = getFontFamily(typography.bodyFont || 'inter');
    const baseFontSize = typography.baseFontSize || 16;

    cssVars.push(`--sf-heading-font: ${headingFontFamily};`);
    cssVars.push(`--sf-body-font: ${bodyFontFamily};`);
    cssVars.push(`--sf-base-font-size: ${baseFontSize}px;`);
  } else {
    // Defaults
    cssVars.push(`--sf-heading-font: 'Inter', sans-serif;`);
    cssVars.push(`--sf-body-font: 'Inter', sans-serif;`);
    cssVars.push(`--sf-base-font-size: 16px;`);
  }

  return cssVars.join('\n');
}

/**
 * Generate complete CSS string for storefront theme injection
 * Includes both CSS variables and selector rules
 */
export function getStorefrontThemeCss(themeSettings: ThemeSettings | null): string {
  const typography = themeSettings?.typography;
  const colors = themeSettings?.colors;
  
  const headingFontFamily = getFontFamily(typography?.headingFont || 'inter');
  const bodyFontFamily = getFontFamily(typography?.bodyFont || 'inter');
  const baseFontSize = typography?.baseFontSize || 16;

  // Build color CSS variables
  const colorVars: string[] = [];
  if (colors?.buttonPrimaryBg) {
    colorVars.push(`--theme-button-primary-bg: ${colors.buttonPrimaryBg};`);
  }
  if (colors?.buttonPrimaryText) {
    colorVars.push(`--theme-button-primary-text: ${colors.buttonPrimaryText};`);
  }
  if (colors?.buttonPrimaryHover) {
    colorVars.push(`--theme-button-primary-hover: ${colors.buttonPrimaryHover};`);
  }
  if (colors?.buttonSecondaryBg) {
    colorVars.push(`--theme-button-secondary-bg: ${colors.buttonSecondaryBg};`);
  }
  if (colors?.buttonSecondaryText) {
    colorVars.push(`--theme-button-secondary-text: ${colors.buttonSecondaryText};`);
  }
  if (colors?.buttonSecondaryHover) {
    colorVars.push(`--theme-button-secondary-hover: ${colors.buttonSecondaryHover};`);
  }
  if (colors?.textPrimary) {
    colorVars.push(`--theme-text-primary: ${colors.textPrimary};`);
  }
  if (colors?.textSecondary) {
    colorVars.push(`--theme-text-secondary: ${colors.textSecondary};`);
  }
  // Price color - exclusive for main/discounted price value
  if (colors?.priceColor) {
    colorVars.push(`--theme-price-color: ${colors.priceColor};`);
  }
  // WhatsApp button colors
  const whatsappColor = colors?.whatsappColor || '#25D366';
  const whatsappHover = colors?.whatsappHover || '#128C7E';
  colorVars.push(`--theme-whatsapp-color: ${whatsappColor};`);
  colorVars.push(`--theme-whatsapp-hover: ${whatsappHover};`);
  // Accent color for UI details
  const accentColor = colors?.accentColor || '#22c55e';
  if (colors?.accentColor) {
    colorVars.push(`--theme-accent-color: ${colors.accentColor};`);
  }
  // Special tag colors - SUCCESS inherits from accent if not explicitly set
  // This ensures consistent coloring when user only changes accent color
  const successBg = colors?.successBg || accentColor;
  colorVars.push(`--theme-success-bg: ${successBg};`);
  if (colors?.successText) {
    colorVars.push(`--theme-success-text: ${colors.successText};`);
  }
  if (colors?.warningBg) {
    colorVars.push(`--theme-warning-bg: ${colors.warningBg};`);
  }
  if (colors?.warningText) {
    colorVars.push(`--theme-warning-text: ${colors.warningText};`);
  }
  if (colors?.dangerBg) {
    colorVars.push(`--theme-danger-bg: ${colors.dangerBg};`);
  }
  if (colors?.dangerText) {
    colorVars.push(`--theme-danger-text: ${colors.dangerText};`);
  }
  if (colors?.highlightBg) {
    colorVars.push(`--theme-highlight-bg: ${colors.highlightBg};`);
  }
  if (colors?.highlightText) {
    colorVars.push(`--theme-highlight-text: ${colors.highlightText};`);
  }

  const colorCss = colorVars.length > 0 ? colorVars.join('\n      ') : '';

  // Convert hex to HSL for Tailwind CSS variable override
  // This ensures ALL components using bg-primary inherit the theme color
  const primaryBgHex = colors?.buttonPrimaryBg || '#1a1a1a';
  const primaryTextHex = colors?.buttonPrimaryText || '#ffffff';
  const primaryHsl = hexToHslValues(primaryBgHex);
  const primaryFgHsl = hexToHslValues(primaryTextHex);

  return `
    /* Storefront Theme - Typography & Colors */
    :root {
      --sf-heading-font: ${headingFontFamily};
      --sf-body-font: ${bodyFontFamily};
      --sf-base-font-size: ${baseFontSize}px;
      ${colorCss}
    }
    
    /* CRITICAL: Override Tailwind's --primary inside storefront to use theme colors */
    /* This makes ALL bg-primary, text-primary, border-primary respect the theme */
    .storefront-container {
      --primary: ${primaryHsl};
      --primary-foreground: ${primaryFgHsl};
      font-family: var(--sf-body-font);
      font-size: var(--sf-base-font-size);
    }
    
    /* Apply heading font to all headings within storefront */
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

    /* Theme-aware button styles for storefront - attribute selectors for reliable matching */
    /* Uses [class*="sf-btn-"] to match single class in className attribute */
    /* Combined with !important to override Tailwind's compiled styles */
    
    /* PRIMARY BUTTON - Normal state */
    .storefront-container button[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]),
    .storefront-container a[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]),
    .storefront-container span[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]) {
      background-color: var(--theme-button-primary-bg, #1a1a1a) !important;
      color: var(--theme-button-primary-text, #ffffff) !important;
      transition: all 0.2s ease !important;
    }
    
    /* PRIMARY BUTTON - Hover state */
    .storefront-container button[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover:not(:disabled),
    .storefront-container a[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover,
    .storefront-container span[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover {
      background-color: var(--theme-button-primary-hover, var(--theme-button-primary-bg, #333333)) !important;
      color: var(--theme-button-primary-text, #ffffff) !important;
      opacity: 1 !important;
      transform: translateY(-1px) !important;
      filter: brightness(1.05) !important;
    }
    
    /* OUTLINE PRIMARY BUTTON - Normal state (transparent bg with primary border/text) */
    .storefront-container button[class*="sf-btn-outline-primary"],
    .storefront-container a[class*="sf-btn-outline-primary"],
    .storefront-container span[class*="sf-btn-outline-primary"] {
      background-color: transparent !important;
      color: var(--theme-button-primary-bg, #1a1a1a) !important;
      border: 1px solid var(--theme-button-primary-bg, #1a1a1a) !important;
      transition: all 0.2s ease !important;
    }
    
    /* OUTLINE PRIMARY BUTTON - Hover state (fill with primary bg) */
    .storefront-container button[class*="sf-btn-outline-primary"]:hover:not(:disabled),
    .storefront-container a[class*="sf-btn-outline-primary"]:hover,
    .storefront-container span[class*="sf-btn-outline-primary"]:hover {
      background-color: var(--theme-button-primary-bg, #1a1a1a) !important;
      color: var(--theme-button-primary-text, #ffffff) !important;
      border-color: var(--theme-button-primary-bg, #1a1a1a) !important;
      opacity: 1 !important;
      transform: translateY(-1px) !important;
    }
    
    /* SECONDARY BUTTON - Normal state */
    .storefront-container button[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]),
    .storefront-container a[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]),
    .storefront-container span[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]) {
      background-color: var(--theme-button-secondary-bg, #e5e5e5) !important;
      color: var(--theme-button-secondary-text, #1a1a1a) !important;
      transition: all 0.2s ease !important;
    }
    
    /* SECONDARY BUTTON - Hover state */
    .storefront-container button[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover:not(:disabled),
    .storefront-container a[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover,
    .storefront-container span[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover {
      background-color: var(--theme-button-secondary-hover, var(--theme-button-secondary-bg, #d5d5d5)) !important;
      color: var(--theme-button-secondary-text, #1a1a1a) !important;
      opacity: 1 !important;
      transform: translateY(-1px) !important;
      filter: brightness(1.05) !important;
    }
    
    /* OUTLINE SECONDARY BUTTON - Normal state */
    .storefront-container button[class*="sf-btn-outline-secondary"],
    .storefront-container a[class*="sf-btn-outline-secondary"],
    .storefront-container span[class*="sf-btn-outline-secondary"] {
      background-color: transparent !important;
      color: var(--theme-button-secondary-text, #1a1a1a) !important;
      border: 1px solid var(--theme-button-secondary-bg, #e5e5e5) !important;
      transition: all 0.2s ease !important;
    }
    
    /* OUTLINE SECONDARY BUTTON - Hover state */
    .storefront-container button[class*="sf-btn-outline-secondary"]:hover:not(:disabled),
    .storefront-container a[class*="sf-btn-outline-secondary"]:hover,
    .storefront-container span[class*="sf-btn-outline-secondary"]:hover {
      background-color: var(--theme-button-secondary-bg, #e5e5e5) !important;
      color: var(--theme-button-secondary-text, #1a1a1a) !important;
      border-color: var(--theme-button-secondary-bg, #e5e5e5) !important;
      opacity: 1 !important;
      transform: translateY(-1px) !important;
    }
    
    /* Accent color for UI details (checkmarks, icons, links, text) */
    .storefront-container .sf-accent-icon,
    .storefront-container .sf-accent-check,
    .storefront-container .sf-accent-text {
      color: var(--theme-accent-color, #22c55e) !important;
    }
    .storefront-container .sf-accent-bg {
      background-color: var(--theme-accent-color, #22c55e) !important;
      color: #ffffff !important;
    }
    .storefront-container .sf-accent-bg-light {
      background-color: color-mix(in srgb, var(--theme-accent-color, #22c55e) 15%, transparent) !important;
    }
    
    /* Accent border */
    .storefront-container .sf-accent-border {
      border-color: var(--theme-accent-color, #22c55e) !important;
    }
    
    /* Special tag colors - theme-based classes */
    .storefront-container .sf-tag-success {
      background-color: var(--theme-success-bg, #22c55e) !important;
      color: var(--theme-success-text, #ffffff) !important;
    }
    .storefront-container .sf-tag-warning {
      background-color: var(--theme-warning-bg, #f97316) !important;
      color: var(--theme-warning-text, #ffffff) !important;
    }
    .storefront-container .sf-tag-danger {
      background-color: var(--theme-danger-bg, #ef4444) !important;
      color: var(--theme-danger-text, #ffffff) !important;
    }
    .storefront-container .sf-tag-highlight {
      background-color: var(--theme-highlight-bg, #3b82f6) !important;
      color: var(--theme-highlight-text, #ffffff) !important;
    }
  `;
}

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
