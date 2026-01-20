// =============================================
// BUILDER CONTEXT - Provides update functions to blocks
// =============================================

import { createContext, useContext } from 'react';

interface BuilderContextValue {
  updateProps: (blockId: string, props: Record<string, unknown>) => void;
  isEditing: boolean;
  selectedBlockId: string | null;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

export function BuilderContextProvider({ 
  children, 
  updateProps,
  isEditing,
  selectedBlockId
}: { 
  children: React.ReactNode;
  updateProps: (blockId: string, props: Record<string, unknown>) => void;
  isEditing: boolean;
  selectedBlockId: string | null;
}) {
  return (
    <BuilderContext.Provider value={{ updateProps, isEditing, selectedBlockId }}>
      {children}
    </BuilderContext.Provider>
  );
}

export function useBuilderContext() {
  const ctx = useContext(BuilderContext);
  return ctx;
}
