import React, { createContext, useContext, useState, useCallback } from "react";

interface CommandAssistantContextValue {
  isOpen: boolean;
  openAssistant: () => void;
  closeAssistant: () => void;
  toggleAssistant: () => void;
}

const CommandAssistantContext = createContext<CommandAssistantContextValue | null>(null);

export function CommandAssistantProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  const openAssistant = useCallback(() => setIsOpen(true), []);
  const closeAssistant = useCallback(() => setIsOpen(false), []);
  const toggleAssistant = useCallback(() => setIsOpen(prev => !prev), []);

  return (
    <CommandAssistantContext.Provider value={{ isOpen, openAssistant, closeAssistant, toggleAssistant }}>
      {children}
    </CommandAssistantContext.Provider>
  );
}

export function useCommandAssistantContext() {
  const context = useContext(CommandAssistantContext);
  if (!context) {
    throw new Error("useCommandAssistantContext must be used within CommandAssistantProvider");
  }
  return context;
}
