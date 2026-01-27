import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { usePlatformOperator } from '@/hooks/usePlatformOperator';

export type AdminMode = 'platform' | 'store';

interface AdminModeContextType {
  mode: AdminMode;
  setMode: (mode: AdminMode) => void;
  canSwitchMode: boolean;
  isPlatformMode: boolean;
  isStoreMode: boolean;
}

const AdminModeContext = createContext<AdminModeContextType | null>(null);

const STORAGE_KEY = 'admin-mode-preference';

interface AdminModeProviderProps {
  children: ReactNode;
}

/**
 * Provider para gerenciar o modo de visualização do admin.
 * 
 * - Platform Mode: Exibe módulos de administração da plataforma (Health, Billing, etc)
 * - Store Mode: Exibe módulos de cliente/loja (Produtos, Pedidos, CRM, etc)
 * 
 * Apenas platform operators podem alternar entre os modos.
 * Usuários normais sempre veem o modo store.
 */
export function AdminModeProvider({ children }: AdminModeProviderProps) {
  const { isPlatformOperator, isLoading } = usePlatformOperator();
  
  // Initialize from localStorage or default to 'platform' for admins
  const [mode, setModeState] = useState<AdminMode>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'platform' || stored === 'store') {
        return stored;
      }
    } catch {}
    return 'platform'; // Default for admins
  });

  // Persist mode changes
  const setMode = (newMode: AdminMode) => {
    if (!isPlatformOperator) return; // Only platform operators can switch
    setModeState(newMode);
    try {
      localStorage.setItem(STORAGE_KEY, newMode);
    } catch {}
  };

  // Reset to store mode if user is not a platform operator
  useEffect(() => {
    if (!isLoading && !isPlatformOperator && mode === 'platform') {
      setModeState('store');
    }
  }, [isPlatformOperator, isLoading, mode]);

  const value: AdminModeContextType = {
    mode: isPlatformOperator ? mode : 'store',
    setMode,
    canSwitchMode: isPlatformOperator,
    isPlatformMode: isPlatformOperator && mode === 'platform',
    isStoreMode: !isPlatformOperator || mode === 'store',
  };

  return (
    <AdminModeContext.Provider value={value}>
      {children}
    </AdminModeContext.Provider>
  );
}

export function useAdminMode() {
  const context = useContext(AdminModeContext);
  if (!context) {
    throw new Error('useAdminMode must be used within AdminModeProvider');
  }
  return context;
}

/**
 * Safe version of useAdminMode that returns defaults when outside provider.
 * Use this in components that might render both inside and outside AppShell.
 */
export function useAdminModeSafe() {
  const context = useContext(AdminModeContext);
  if (!context) {
    return {
      mode: 'store' as AdminMode,
      setMode: () => {},
      canSwitchMode: false,
      isPlatformMode: false,
      isStoreMode: true,
    };
  }
  return context;
}
