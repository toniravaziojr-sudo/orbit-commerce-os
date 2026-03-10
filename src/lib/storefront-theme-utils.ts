// =============================================
// STOREFRONT THEME UTILITIES — Centralized design tokens
// Single source of truth for React-side theme CSS generation
// Edge counterpart: supabase/functions/_shared/theme-tokens.ts
// =============================================

/**
 * Convert hex color to HSL values string for CSS variable (without hsl() wrapper)
 * Returns format: "H S% L%" for use in Tailwind CSS variables
 * 
 * SHARED: Used by useBuilderThemeInjector.ts AND usePublicThemeSettings.ts
 */
export function hexToHslValues(hex: string): string {
  const cleanHex = hex.replace('#', '');
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
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Font family map — maps font value keys to CSS font-family strings
 * 
 * SYNC CONTRACT: Must match supabase/functions/_shared/theme-tokens.ts
 */
export const FONT_FAMILY_MAP: Record<string, string> = {
  // Sans-serif
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
  // Serif
  'playfair': "'Playfair Display', serif",
  'merriweather': "'Merriweather', serif",
  'lora': "'Lora', serif",
  'pt-serif': "'PT Serif', serif",
  'crimson-text': "'Crimson Text', serif",
  'libre-baskerville': "'Libre Baskerville', serif",
  'cormorant-garamond': "'Cormorant Garamond', serif",
  'eb-garamond': "'EB Garamond', serif",
  'bitter': "'Bitter', serif",
  // Display
  'abril-fatface': "'Abril Fatface', cursive",
  'bebas-neue': "'Bebas Neue', sans-serif",
  'oswald': "'Oswald', sans-serif",
  'josefin-sans': "'Josefin Sans', sans-serif",
  'righteous': "'Righteous', cursive",
};

export function getFontFamily(fontValue: string): string {
  return FONT_FAMILY_MAP[fontValue] || FONT_FAMILY_MAP['inter'];
}

/**
 * Generate button CSS rules for sf-btn-* classes
 * Shared between Builder preview (scoped to .storefront-container) and Public storefront
 * 
 * @param scope - CSS selector prefix (e.g. '.storefront-container' or '' for global)
 */
export function generateButtonCssRules(scope: string): string {
  const s = scope ? `${scope} ` : '';
  return `
    /* PRIMARY BUTTON — specificity: ${s ? '0,2,0+' : '0,1,0+'} */
    ${s}button[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]),
    ${s}a[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]),
    ${s}span[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]) {
      background-color: var(--theme-button-primary-bg, #1a1a1a);
      color: var(--theme-button-primary-text, #ffffff);
      transition: all 0.2s ease;
    }
    ${s}button[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover:not(:disabled),
    ${s}a[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover,
    ${s}span[class*="sf-btn-primary"]:not([class*="sf-btn-outline"]):hover {
      background-color: var(--theme-button-primary-hover, var(--theme-button-primary-bg, #333333));
      color: var(--theme-button-primary-text, #ffffff);
      opacity: 1;
      transform: translateY(-1px);
      filter: brightness(1.05);
    }
    /* OUTLINE PRIMARY */
    ${s}button[class*="sf-btn-outline-primary"],
    ${s}a[class*="sf-btn-outline-primary"],
    ${s}span[class*="sf-btn-outline-primary"] {
      background-color: transparent;
      color: var(--theme-button-primary-bg, #1a1a1a);
      border: 1px solid var(--theme-button-primary-bg, #1a1a1a);
      transition: all 0.2s ease;
    }
    ${s}button[class*="sf-btn-outline-primary"]:hover:not(:disabled),
    ${s}a[class*="sf-btn-outline-primary"]:hover,
    ${s}span[class*="sf-btn-outline-primary"]:hover {
      background-color: var(--theme-button-primary-bg, #1a1a1a);
      color: var(--theme-button-primary-text, #ffffff);
      border-color: var(--theme-button-primary-bg, #1a1a1a);
      opacity: 1;
      transform: translateY(-1px);
    }
    /* SECONDARY BUTTON */
    ${s}button[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]),
    ${s}a[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]),
    ${s}span[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]) {
      background-color: var(--theme-button-secondary-bg, #e5e5e5);
      color: var(--theme-button-secondary-text, #1a1a1a);
      transition: all 0.2s ease;
    }
    ${s}button[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover:not(:disabled),
    ${s}a[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover,
    ${s}span[class*="sf-btn-secondary"]:not([class*="sf-btn-outline"]):hover {
      background-color: var(--theme-button-secondary-hover, var(--theme-button-secondary-bg, #d5d5d5));
      color: var(--theme-button-secondary-text, #1a1a1a);
      opacity: 1;
      transform: translateY(-1px);
      filter: brightness(1.05);
    }
    /* OUTLINE SECONDARY */
    ${s}button[class*="sf-btn-outline-secondary"],
    ${s}a[class*="sf-btn-outline-secondary"],
    ${s}span[class*="sf-btn-outline-secondary"] {
      background-color: transparent;
      color: var(--theme-button-secondary-text, #1a1a1a);
      border: 1px solid var(--theme-button-secondary-bg, #e5e5e5);
      transition: all 0.2s ease;
    }
    ${s}button[class*="sf-btn-outline-secondary"]:hover:not(:disabled),
    ${s}a[class*="sf-btn-outline-secondary"]:hover,
    ${s}span[class*="sf-btn-outline-secondary"]:hover {
      background-color: var(--theme-button-secondary-bg, #e5e5e5);
      color: var(--theme-button-secondary-text, #1a1a1a);
      border-color: var(--theme-button-secondary-bg, #e5e5e5);
      opacity: 1;
      transform: translateY(-1px);
    }`;
}

/**
 * Generate text and price color CSS rules
 * Applies --theme-text-primary, --theme-text-secondary, --theme-price-color to semantic classes
 */
export function generateTextColorCssRules(scope: string): string {
  const s = scope ? `${scope} ` : '';
  return `
    /* Price color */
    ${s}.sf-price-color {
      color: var(--theme-price-color, var(--theme-text-primary, currentColor));
    }
    /* Text secondary class (for Edge/manual usage) */
    ${s}.sf-text-secondary {
      color: var(--theme-text-secondary, #666666);
    }`;
}

/**
 * Generate accent and tag CSS rules
 */
export function generateAccentAndTagCssRules(scope: string): string {
  const s = scope ? `${scope} ` : '';
  return `
    /* Accent color classes */
    ${s}.sf-accent-icon, ${s}.sf-accent-check, ${s}.sf-accent-text {
      color: var(--theme-accent-color, #22c55e);
    }
    ${s}.sf-accent-bg {
      background-color: var(--theme-accent-color, #22c55e);
      color: #ffffff;
    }
    ${s}.sf-accent-bg-light {
      background-color: color-mix(in srgb, var(--theme-accent-color, #22c55e) 15%, transparent);
    }
    ${s}.sf-accent-border {
      border-color: var(--theme-accent-color, #22c55e);
    }
    /* Tag colors */
    ${s}.sf-tag-success {
      background-color: var(--theme-success-bg, #22c55e);
      color: var(--theme-success-text, #ffffff);
    }
    ${s}.sf-tag-warning {
      background-color: var(--theme-warning-bg, #f97316);
      color: var(--theme-warning-text, #ffffff);
    }
    ${s}.sf-tag-danger {
      background-color: var(--theme-danger-bg, #ef4444);
      color: var(--theme-danger-text, #ffffff);
    }
    ${s}.sf-tag-highlight {
      background-color: var(--theme-highlight-bg, #3b82f6);
      color: var(--theme-highlight-text, #ffffff);
    }`;
}

/**
 * Generate color CSS variables from theme colors object
 * 
 * @returns Array of CSS variable declarations (without :root wrapper)
 */
export function generateColorCssVars(colors: Record<string, any> | null | undefined): string[] {
  if (!colors) return [];
  const vars: string[] = [];
  
  if (colors.buttonPrimaryBg) vars.push(`--theme-button-primary-bg: ${colors.buttonPrimaryBg};`);
  if (colors.buttonPrimaryText) vars.push(`--theme-button-primary-text: ${colors.buttonPrimaryText};`);
  if (colors.buttonPrimaryHover) vars.push(`--theme-button-primary-hover: ${colors.buttonPrimaryHover};`);
  if (colors.buttonSecondaryBg) vars.push(`--theme-button-secondary-bg: ${colors.buttonSecondaryBg};`);
  if (colors.buttonSecondaryText) vars.push(`--theme-button-secondary-text: ${colors.buttonSecondaryText};`);
  if (colors.buttonSecondaryHover) vars.push(`--theme-button-secondary-hover: ${colors.buttonSecondaryHover};`);
  if (colors.textPrimary) vars.push(`--theme-text-primary: ${colors.textPrimary};`);
  if (colors.textSecondary) vars.push(`--theme-text-secondary: ${colors.textSecondary};`);
  if (colors.priceColor) vars.push(`--theme-price-color: ${colors.priceColor};`);
  
  // WhatsApp
  const whatsappColor = colors.whatsappColor || '#25D366';
  const whatsappHover = colors.whatsappHover || '#128C7E';
  vars.push(`--theme-whatsapp-color: ${whatsappColor};`);
  vars.push(`--theme-whatsapp-hover: ${whatsappHover};`);
  
  // Accent
  const accentColor = colors.accentColor || '#22c55e';
  if (colors.accentColor) vars.push(`--theme-accent-color: ${colors.accentColor};`);
  
  // Tag colors — success inherits from accent if not set
  const successBg = colors.successBg || accentColor;
  vars.push(`--theme-success-bg: ${successBg};`);
  if (colors.successText) vars.push(`--theme-success-text: ${colors.successText};`);
  if (colors.warningBg) vars.push(`--theme-warning-bg: ${colors.warningBg};`);
  if (colors.warningText) vars.push(`--theme-warning-text: ${colors.warningText};`);
  if (colors.dangerBg) vars.push(`--theme-danger-bg: ${colors.dangerBg};`);
  if (colors.dangerText) vars.push(`--theme-danger-text: ${colors.dangerText};`);
  if (colors.highlightBg) vars.push(`--theme-highlight-bg: ${colors.highlightBg};`);
  if (colors.highlightText) vars.push(`--theme-highlight-text: ${colors.highlightText};`);
  
  return vars;
}
