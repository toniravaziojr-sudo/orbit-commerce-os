// =============================================
// BUILDER DRAFT PAGE SETTINGS - Local draft state for page settings
// Changes are reflected instantly in the builder preview
// but only saved to the database when user clicks "Salvar"
// =============================================

import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import type {
  CategorySettings,
  ProductSettings,
  CartSettings,
  CheckoutSettings,
  ThankYouSettings,
  HomeSettings,
} from '@/hooks/usePageSettings';

// Union type for all page settings
export type PageSettingsType = 
  | CategorySettings 
  | ProductSettings 
  | CartSettings 
  | CheckoutSettings 
  | ThankYouSettings
  | HomeSettings
  | Record<string, boolean | string | number | string[]>;

// Page type keys
export type PageSettingsKey = 'home' | 'category' | 'product' | 'cart' | 'checkout' | 'thank_you';

interface BuilderDraftPageSettingsContextValue {
  // Draft state - local changes not yet saved (keyed by page type)
  draftPageSettings: Record<PageSettingsKey, PageSettingsType | null>;
  
  // Check if there are unsaved changes for any page
  hasDraftChanges: boolean;
  
  // Check if specific page has draft changes
  hasPageDraftChanges: (pageType: PageSettingsKey) => boolean;
  
  // Update draft state for a specific page (triggers real-time preview update)
  setDraftPageSettings: (pageType: PageSettingsKey, settings: PageSettingsType) => void;
  
  // Get draft settings for a specific page
  getDraftPageSettings: <T extends PageSettingsType>(pageType: PageSettingsKey) => T | null;
  
  // Clear all draft changes (used after save or cancel)
  clearDraft: () => void;
  
  // Clear draft for specific page
  clearPageDraft: (pageType: PageSettingsKey) => void;
  
  // Get all pending changes for save operation (returns null if nothing to save)
  getPendingChanges: () => Record<PageSettingsKey, PageSettingsType> | null;
  
  // Get the effective settings (draft if available, otherwise saved)
  getEffectiveSettings: <T extends PageSettingsType>(
    pageType: PageSettingsKey, 
    savedSettings?: T
  ) => T | null;
}

const BuilderDraftPageSettingsContext = createContext<BuilderDraftPageSettingsContextValue | null>(null);

// Global ref for access outside React context (used by VisualBuilder.handleSave)
let globalDraftPageSettingsRef: BuilderDraftPageSettingsContextValue | null = null;

export function getGlobalDraftPageSettingsRef() {
  return globalDraftPageSettingsRef;
}

interface BuilderDraftPageSettingsProviderProps {
  children: ReactNode;
}

export function BuilderDraftPageSettingsProvider({ children }: BuilderDraftPageSettingsProviderProps) {
  const [draftPageSettings, setDraftPageSettingsState] = useState<Record<PageSettingsKey, PageSettingsType | null>>({
    home: null,
    category: null,
    product: null,
    cart: null,
    checkout: null,
    thank_you: null,
  });

  const hasDraftChanges = Object.values(draftPageSettings).some(v => v !== null);

  const hasPageDraftChanges = useCallback((pageType: PageSettingsKey): boolean => {
    return draftPageSettings[pageType] !== null;
  }, [draftPageSettings]);

  const setDraftPageSettings = useCallback((pageType: PageSettingsKey, settings: PageSettingsType) => {
    setDraftPageSettingsState(prev => ({
      ...prev,
      [pageType]: settings,
    }));
  }, []);

  const getDraftPageSettings = useCallback(<T extends PageSettingsType>(pageType: PageSettingsKey): T | null => {
    return draftPageSettings[pageType] as T | null;
  }, [draftPageSettings]);

  const clearDraft = useCallback(() => {
    setDraftPageSettingsState({
      home: null,
      category: null,
      product: null,
      cart: null,
      checkout: null,
      thank_you: null,
    });
  }, []);

  const clearPageDraft = useCallback((pageType: PageSettingsKey) => {
    setDraftPageSettingsState(prev => ({
      ...prev,
      [pageType]: null,
    }));
  }, []);

  const getPendingChanges = useCallback((): Record<PageSettingsKey, PageSettingsType> | null => {
    if (!hasDraftChanges) return null;
    
    const changes: Partial<Record<PageSettingsKey, PageSettingsType>> = {};
    
    for (const [key, value] of Object.entries(draftPageSettings)) {
      if (value !== null) {
        changes[key as PageSettingsKey] = value;
      }
    }
    
    return Object.keys(changes).length > 0 ? changes as Record<PageSettingsKey, PageSettingsType> : null;
  }, [hasDraftChanges, draftPageSettings]);

  const getEffectiveSettings = useCallback(<T extends PageSettingsType>(
    pageType: PageSettingsKey, 
    savedSettings?: T
  ): T | null => {
    // Draft takes priority, then saved
    const draft = draftPageSettings[pageType];
    if (draft !== null) return draft as T;
    return savedSettings || null;
  }, [draftPageSettings]);

  const value: BuilderDraftPageSettingsContextValue = {
    draftPageSettings,
    hasDraftChanges,
    hasPageDraftChanges,
    setDraftPageSettings,
    getDraftPageSettings,
    clearDraft,
    clearPageDraft,
    getPendingChanges,
    getEffectiveSettings,
  };

  // Update global ref for access outside React context
  useEffect(() => {
    globalDraftPageSettingsRef = value;
    return () => {
      globalDraftPageSettingsRef = null;
    };
  }, [value]);

  return (
    <BuilderDraftPageSettingsContext.Provider value={value}>
      {children}
    </BuilderDraftPageSettingsContext.Provider>
  );
}

// Hook to access draft page settings context
export function useBuilderDraftPageSettings() {
  const context = useContext(BuilderDraftPageSettingsContext);
  return context;
}
