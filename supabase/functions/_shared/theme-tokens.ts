// =============================================
// THEME TOKENS — Centralized design tokens for Edge functions
// Single source of truth for Edge-side theme CSS generation
// React counterpart: src/lib/storefront-theme-utils.ts
// 
// SYNC CONTRACT: Font map and color variables MUST match React counterpart
// =============================================

/**
 * Font family map — maps font value keys to CSS font-family strings
 * MUST stay in sync with src/lib/storefront-theme-utils.ts
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
 * Google Fonts name map for URL construction
 */
export const FONT_NAME_MAP: Record<string, string> = {
  'inter': 'Inter', 'roboto': 'Roboto', 'open-sans': 'Open+Sans', 'lato': 'Lato',
  'montserrat': 'Montserrat', 'poppins': 'Poppins', 'nunito': 'Nunito', 'raleway': 'Raleway',
  'source-sans-pro': 'Source+Sans+Pro', 'ubuntu': 'Ubuntu',
  'mulish': 'Mulish', 'work-sans': 'Work+Sans', 'quicksand': 'Quicksand', 'dm-sans': 'DM+Sans',
  'manrope': 'Manrope', 'outfit': 'Outfit', 'plus-jakarta-sans': 'Plus+Jakarta+Sans',
  'playfair': 'Playfair+Display', 'merriweather': 'Merriweather', 'lora': 'Lora',
  'pt-serif': 'PT+Serif', 'crimson-text': 'Crimson+Text',
  'libre-baskerville': 'Libre+Baskerville', 'cormorant-garamond': 'Cormorant+Garamond',
  'eb-garamond': 'EB+Garamond', 'bitter': 'Bitter',
  'abril-fatface': 'Abril+Fatface', 'bebas-neue': 'Bebas+Neue',
  'oswald': 'Oswald', 'josefin-sans': 'Josefin+Sans', 'righteous': 'Righteous',
};

/**
 * Generate color CSS variables from theme colors object
 * MUST stay in sync with generateColorCssVars in React counterpart
 */
export function generateColorCssVars(colors: any): string[] {
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

/**
 * Generate complete theme CSS for Edge HTML
 */
export function generateThemeCss(themeSettings: any): string {
  const typography = themeSettings?.typography;
  const colors = themeSettings?.colors;
  
  const headingFont = getFontFamily(typography?.headingFont || 'inter');
  const bodyFont = getFontFamily(typography?.bodyFont || 'inter');
  const baseFontSize = typography?.baseFontSize || 16;
  
  const colorVars = generateColorCssVars(colors);

  return `
    :root {
      --sf-heading-font: ${headingFont};
      --sf-body-font: ${bodyFont};
      --sf-base-font-size: ${baseFontSize}px;
      ${colorVars.join('\n      ')}
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: var(--sf-body-font);
      font-size: var(--sf-base-font-size);
      color: var(--theme-text-primary, #1a1a1a);
      background: #fff;
      -webkit-font-smoothing: antialiased;
    }
    h1,h2,h3,h4,h5,h6 { font-family: var(--sf-heading-font); }
    a { color: inherit; text-decoration: none; }
    img { max-width: 100%; height: auto; display: block; }
  `;
}

/**
 * Generate button CSS rules (minified for Edge HTML)
 */
export function generateButtonCssRules(): string {
  return `
    .sf-btn-primary,.sf-btn-outline-primary,.sf-btn-secondary,.sf-btn-outline-secondary{-webkit-tap-highlight-color:transparent;}
    .sf-btn-primary{background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);transition:all 0.2s ease;}
    @media(hover:hover){.sf-btn-primary:hover:not(:disabled){background:var(--theme-button-primary-hover,var(--theme-button-primary-bg,#333));transform:translateY(-1px);filter:brightness(1.1);box-shadow:0 2px 8px rgba(0,0,0,0.15);}}
    .sf-btn-primary:active:not(:disabled){transform:scale(0.93);filter:brightness(0.88);transition:transform 0.08s;box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);}
    .sf-btn-outline-primary{background:transparent;color:var(--theme-button-primary-bg,#1a1a1a);border:1px solid var(--theme-button-primary-bg,#1a1a1a);transition:all 0.2s ease;}
    @media(hover:hover){.sf-btn-outline-primary:hover:not(:disabled){background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);border-color:var(--theme-button-primary-bg,#1a1a1a);transform:translateY(-1px);box-shadow:0 2px 8px rgba(0,0,0,0.15);}}
    .sf-btn-outline-primary:active:not(:disabled){transform:scale(0.93);filter:brightness(0.88);background:var(--theme-button-primary-bg,#1a1a1a);color:var(--theme-button-primary-text,#fff);transition:transform 0.08s;box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);}
    .sf-btn-secondary{background:var(--theme-button-secondary-bg,#e5e5e5);color:var(--theme-button-secondary-text,#1a1a1a);transition:all 0.2s ease;}
    @media(hover:hover){.sf-btn-secondary:hover:not(:disabled){background:var(--theme-button-secondary-hover,var(--theme-button-secondary-bg,#d5d5d5));transform:translateY(-1px);filter:brightness(1.1);box-shadow:0 2px 8px rgba(0,0,0,0.15);}}
    .sf-btn-secondary:active:not(:disabled){transform:scale(0.93);filter:brightness(0.88);transition:transform 0.08s;box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);}
    .sf-btn-outline-secondary{background:transparent;color:var(--theme-button-secondary-text,#1a1a1a);border:1px solid var(--theme-button-secondary-bg,#e5e5e5);transition:all 0.2s ease;}
    @media(hover:hover){.sf-btn-outline-secondary:hover:not(:disabled){background:var(--theme-button-secondary-bg,#e5e5e5);color:var(--theme-button-secondary-text,#1a1a1a);border-color:var(--theme-button-secondary-bg,#e5e5e5);transform:translateY(-1px);}}
    .sf-btn-outline-secondary:active:not(:disabled){transform:scale(0.93);filter:brightness(0.88);transition:transform 0.08s;box-shadow:inset 0 2px 4px rgba(0,0,0,0.2);}
    .sf-price-color{color:var(--theme-price-color,var(--theme-text-primary,currentColor));}
    .sf-text-secondary{color:var(--theme-text-secondary,#666);}
    .sf-accent-icon,.sf-accent-check,.sf-accent-text{color:var(--theme-accent-color,#22c55e);}
    .sf-accent-bg{background:var(--theme-accent-color,#22c55e);color:#fff;}
    .sf-tag-success{background:var(--theme-success-bg,#22c55e);color:var(--theme-success-text,#fff);}
    .sf-tag-warning{background:var(--theme-warning-bg,#f97316);color:var(--theme-warning-text,#fff);}
    .sf-tag-danger{background:var(--theme-danger-bg,#ef4444);color:var(--theme-danger-text,#fff);}
    .sf-tag-highlight{background:var(--theme-highlight-bg,#3b82f6);color:var(--theme-highlight-text,#fff);}`;
}

/**
 * Get Google Fonts data (stylesheet + preload tags)
 */
export function getGoogleFontsData(themeSettings: any): { stylesheetTags: string; preloadTags: string } {
  const fonts = new Set<string>();
  const headingFont = themeSettings?.typography?.headingFont || 'inter';
  const bodyFont = themeSettings?.typography?.bodyFont || 'inter';
  
  if (FONT_NAME_MAP[headingFont]) fonts.add(FONT_NAME_MAP[headingFont]);
  if (FONT_NAME_MAP[bodyFont]) fonts.add(FONT_NAME_MAP[bodyFont]);
  
  if (fonts.size === 0) return { stylesheetTags: '', preloadTags: '' };
  
  const families = Array.from(fonts).map(f => `family=${f}:wght@400;500;600;700`).join('&');
  const cssUrl = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  
  const preloadTags = `<link rel="preload" href="${cssUrl}" as="style">`;
  const stylesheetTags = [
    '<link rel="preconnect" href="https://fonts.googleapis.com">',
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    `<link href="${cssUrl}" rel="stylesheet">`,
  ].join('\n  ');
  
  return { stylesheetTags, preloadTags };
}
