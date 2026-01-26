// =============================================
// THEME CONTEXT - Global theme for storefront blocks
// =============================================

import { createContext, useContext, ReactNode } from 'react';

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  foreground: string;
  muted: string;
  mutedForeground: string;
  border: string;
}

export interface StorefrontTheme {
  colors: ThemeColors;
  storeName?: string;
  logoUrl?: string;
}

const defaultTheme: StorefrontTheme = {
  colors: {
    primary: 'hsl(var(--primary))',
    secondary: 'hsl(var(--secondary))',
    accent: 'hsl(var(--accent))',
    background: 'hsl(var(--background))',
    foreground: 'hsl(var(--foreground))',
    muted: 'hsl(var(--muted))',
    mutedForeground: 'hsl(var(--muted-foreground))',
    border: 'hsl(var(--border))',
  },
};

const ThemeContext = createContext<StorefrontTheme>(defaultTheme);

interface ThemeProviderProps {
  children: ReactNode;
  settings?: {
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    store_name?: string | null;
    logo_url?: string | null;
  } | null;
}

export function ThemeProvider({ children, settings }: ThemeProviderProps) {
  // NOTE: Colors are now managed via Configuração do tema > Cores (useThemeSettings)
  // Legacy primary_color/secondary_color/accent_color from store_settings are no longer used
  const theme: StorefrontTheme = {
    colors: {
      primary: defaultTheme.colors.primary,
      secondary: defaultTheme.colors.secondary,
      accent: defaultTheme.colors.accent,
      background: defaultTheme.colors.background,
      foreground: defaultTheme.colors.foreground,
      muted: defaultTheme.colors.muted,
      mutedForeground: defaultTheme.colors.mutedForeground,
      border: defaultTheme.colors.border,
    },
    storeName: settings?.store_name || undefined,
    logoUrl: settings?.logo_url || undefined,
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useStorefrontTheme() {
  return useContext(ThemeContext);
}

// Helper to get CSS variable from hex color
export function hexToHsl(hex: string): string {
  if (!hex || !hex.startsWith('#')) return hex;
  
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return hex;
  
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

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

// Inject theme CSS variables
export function getThemeCssVariables(settings?: ThemeProviderProps['settings']): React.CSSProperties {
  if (!settings) return {};
  
  const vars: Record<string, string> = {};
  
  if (settings.primary_color) {
    vars['--theme-primary'] = settings.primary_color;
  }
  if (settings.secondary_color) {
    vars['--theme-secondary'] = settings.secondary_color;
  }
  if (settings.accent_color) {
    vars['--theme-accent'] = settings.accent_color;
  }
  
  return vars as React.CSSProperties;
}
