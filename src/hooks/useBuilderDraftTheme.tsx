// =============================================
// BUILDER DRAFT THEME - Local draft state for real-time preview
// Changes are reflected instantly in the builder preview
// but only saved to the database when user clicks "Salvar"
// =============================================

import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import { ThemeSettings, ThemeColors, ThemeTypography, DEFAULT_THEME_COLORS, DEFAULT_THEME_TYPOGRAPHY } from './useThemeSettings';

interface BuilderDraftThemeContextValue {
  // Draft state - local changes not yet saved
  draftColors: ThemeColors | null;
  draftTypography: ThemeTypography | null;
  draftCustomCss: string | null;
  
  // Check if there are unsaved changes
  hasDraftChanges: boolean;
  
  // Update draft state (triggers real-time preview update)
  setDraftColors: (colors: ThemeColors) => void;
  setDraftTypography: (typography: ThemeTypography) => void;
  setDraftCustomCss: (css: string) => void;
  
  // Clear all draft changes (used after save or cancel)
  clearDraft: () => void;
  
  // Get the effective theme settings (draft if available, otherwise saved)
  getEffectiveColors: (savedColors?: ThemeColors) => ThemeColors;
  getEffectiveTypography: (savedTypography?: ThemeTypography) => ThemeTypography;
  getEffectiveCustomCss: (savedCss?: string) => string;
  
  // Get pending changes for save operation (returns null if nothing to save)
  getPendingChanges: () => { colors?: ThemeColors; typography?: ThemeTypography; customCss?: string } | null;
}

const BuilderDraftThemeContext = createContext<BuilderDraftThemeContextValue | null>(null);

interface BuilderDraftThemeProviderProps {
  children: ReactNode;
}

export function BuilderDraftThemeProvider({ children }: BuilderDraftThemeProviderProps) {
  const [draftColors, setDraftColorsState] = useState<ThemeColors | null>(null);
  const [draftTypography, setDraftTypographyState] = useState<ThemeTypography | null>(null);
  const [draftCustomCss, setDraftCustomCssState] = useState<string | null>(null);

  const hasDraftChanges = draftColors !== null || draftTypography !== null || draftCustomCss !== null;

  const setDraftColors = useCallback((colors: ThemeColors) => {
    setDraftColorsState(colors);
  }, []);

  const setDraftTypography = useCallback((typography: ThemeTypography) => {
    setDraftTypographyState(typography);
  }, []);

  const setDraftCustomCss = useCallback((css: string) => {
    setDraftCustomCssState(css);
  }, []);

  const clearDraft = useCallback(() => {
    setDraftColorsState(null);
    setDraftTypographyState(null);
    setDraftCustomCssState(null);
  }, []);

  const getEffectiveColors = useCallback((savedColors?: ThemeColors): ThemeColors => {
    // Draft takes priority, then saved, then defaults
    return draftColors || savedColors || DEFAULT_THEME_COLORS;
  }, [draftColors]);

  const getEffectiveTypography = useCallback((savedTypography?: ThemeTypography): ThemeTypography => {
    return draftTypography || savedTypography || DEFAULT_THEME_TYPOGRAPHY;
  }, [draftTypography]);

  const getEffectiveCustomCss = useCallback((savedCss?: string): string => {
    if (draftCustomCss !== null) return draftCustomCss;
    return savedCss || '';
  }, [draftCustomCss]);

  const getPendingChanges = useCallback(() => {
    if (!hasDraftChanges) return null;
    
    const changes: { colors?: ThemeColors; typography?: ThemeTypography; customCss?: string } = {};
    if (draftColors) changes.colors = draftColors;
    if (draftTypography) changes.typography = draftTypography;
    if (draftCustomCss !== null) changes.customCss = draftCustomCss;
    
    return Object.keys(changes).length > 0 ? changes : null;
  }, [hasDraftChanges, draftColors, draftTypography, draftCustomCss]);

  const value: BuilderDraftThemeContextValue = {
    draftColors,
    draftTypography,
    draftCustomCss,
    hasDraftChanges,
    setDraftColors,
    setDraftTypography,
    setDraftCustomCss,
    clearDraft,
    getEffectiveColors,
    getEffectiveTypography,
    getEffectiveCustomCss,
    getPendingChanges,
  };

  return (
    <BuilderDraftThemeContext.Provider value={value}>
      {children}
    </BuilderDraftThemeContext.Provider>
  );
}

// Hook to access draft theme context
export function useBuilderDraftTheme() {
  const context = useContext(BuilderDraftThemeContext);
  return context; // May be null if outside provider
}

// Global ref to store draft theme functions for access in callbacks
// This allows handleSave to access the draft even when called from outside the provider
let globalDraftThemeRef: BuilderDraftThemeContextValue | null = null;

export function setGlobalDraftThemeRef(ref: BuilderDraftThemeContextValue | null) {
  globalDraftThemeRef = ref;
}

export function getGlobalDraftThemeRef(): BuilderDraftThemeContextValue | null {
  return globalDraftThemeRef;
}

// Component to sync draft theme context with global ref
export function DraftThemeRefSync() {
  const draftTheme = useBuilderDraftTheme();
  
  useEffect(() => {
    setGlobalDraftThemeRef(draftTheme);
    return () => setGlobalDraftThemeRef(null);
  }, [draftTheme]);
  
  return null;
}
