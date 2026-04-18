// =============================================
// STOREFRONT BOOTSTRAP CONTEXT
// Shares the bootstrap response loaded once by the layout
// (TenantStorefrontLayout / StorefrontLayout) so child pages
// (Cart, Checkout, ThankYou, etc.) don't re-fetch the same data.
// =============================================

import { createContext, useContext, ReactNode } from 'react';
import type { BootstrapData } from '@/hooks/useStorefrontBootstrap';

export interface StorefrontBootstrapContextValue {
  bootstrap: BootstrapData | null;
  isLoading: boolean;
}

const StorefrontBootstrapContext = createContext<StorefrontBootstrapContextValue | null>(null);

interface ProviderProps {
  bootstrap: BootstrapData | null;
  isLoading: boolean;
  children: ReactNode;
}

export function StorefrontBootstrapProvider({ bootstrap, isLoading, children }: ProviderProps) {
  return (
    <StorefrontBootstrapContext.Provider value={{ bootstrap, isLoading }}>
      {children}
    </StorefrontBootstrapContext.Provider>
  );
}

/**
 * Returns the bootstrap loaded by the parent layout, or `null` if not inside a provider.
 * Pages should prefer this over re-fetching the bootstrap themselves.
 */
export function useStorefrontBootstrapContext(): StorefrontBootstrapContextValue | null {
  return useContext(StorefrontBootstrapContext);
}
