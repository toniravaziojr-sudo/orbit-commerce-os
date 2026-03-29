// =============================================
// MINI CART CONTEXT - Single source of truth for mini cart drawer state
// Prevents multiple MiniCartDrawer instances from conflicting
// =============================================

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface MiniCartContextType {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setOpen: (open: boolean) => void;
}

const MiniCartContext = createContext<MiniCartContextType>({
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
  setOpen: () => {},
});

export function MiniCartProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return (
    <MiniCartContext.Provider value={{ isOpen, open, close, toggle, setOpen: setIsOpen }}>
      {children}
    </MiniCartContext.Provider>
  );
}

export function useMiniCart() {
  return useContext(MiniCartContext);
}