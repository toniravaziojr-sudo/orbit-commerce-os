// =============================================
// CANVAS EDITOR CONTEXT - Bridge between canvas and properties panel
// Allows the right-side panel to apply formatting to canvas selection
// =============================================

import { createContext, useContext, useRef, useCallback, ReactNode } from 'react';

interface SavedSelection {
  range: Range;
  editorRef: HTMLElement;
}

interface CanvasEditorContextValue {
  // Register an editor as the active one
  registerEditor: (ref: HTMLElement | null) => void;
  // Get the active editor ref
  getActiveEditor: () => HTMLElement | null;
  // Save current selection (call before clicking panel buttons)
  saveSelection: () => void;
  // Get saved selection
  getSavedSelection: () => Range | null;
  // Restore saved selection and execute command
  execCommandOnCanvas: (command: string, value?: string) => boolean;
  // Check if canvas has active selection
  hasActiveSelection: () => boolean;
  // Formatting lock - prevents content sync during formatting
  setFormattingLock: (locked: boolean) => void;
  isFormattingLocked: () => boolean;
}

const CanvasEditorContext = createContext<CanvasEditorContextValue | null>(null);

export function CanvasEditorProvider({ children }: { children: ReactNode }) {
  const activeEditorRef = useRef<HTMLElement | null>(null);
  const savedSelectionRef = useRef<SavedSelection | null>(null);
  const formattingLockRef = useRef(false);

  const registerEditor = useCallback((ref: HTMLElement | null) => {
    activeEditorRef.current = ref;
  }, []);

  const getActiveEditor = useCallback(() => {
    return activeEditorRef.current;
  }, []);

  const setFormattingLock = useCallback((locked: boolean) => {
    formattingLockRef.current = locked;
  }, []);

  const isFormattingLocked = useCallback(() => {
    return formattingLockRef.current;
  }, []);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Check if selection is within the active editor OR if we have any selection with text
    if (activeEditorRef.current && activeEditorRef.current.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = {
        range: range.cloneRange(),
        editorRef: activeEditorRef.current
      };
    }
  }, []);

  const getSavedSelection = useCallback(() => {
    return savedSelectionRef.current?.range ?? null;
  }, []);

  const hasActiveSelection = useCallback(() => {
    // First check saved selection
    if (savedSelectionRef.current) return true;
    
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return false;
    
    if (selection.rangeCount === 0) return false;
    const range = selection.getRangeAt(0);
    return !!(activeEditorRef.current && activeEditorRef.current.contains(range.commonAncestorContainer));
  }, []);

  const execCommandOnCanvas = useCallback((command: string, value?: string): boolean => {
    // Set formatting lock
    formattingLockRef.current = true;
    
    // Try to use current selection first
    const selection = window.getSelection();
    
    if (selection && !selection.isCollapsed && activeEditorRef.current) {
      const range = selection.getRangeAt(0);
      if (activeEditorRef.current.contains(range.commonAncestorContainer)) {
        // Selection is in canvas, execute directly
        activeEditorRef.current.focus();
        document.execCommand(command, false, value);
        
        // Release lock after delay
        setTimeout(() => { formattingLockRef.current = false; }, 200);
        return true;
      }
    }
    
    // Otherwise, try to restore saved selection
    if (savedSelectionRef.current) {
      const { range, editorRef } = savedSelectionRef.current;
      
      // Ensure the editor is still in the DOM
      if (!document.body.contains(editorRef)) {
        savedSelectionRef.current = null;
        formattingLockRef.current = false;
        return false;
      }
      
      // Focus the editor
      editorRef.focus();
      
      // Restore the selection
      const newSelection = window.getSelection();
      if (newSelection) {
        newSelection.removeAllRanges();
        newSelection.addRange(range);
        
        // Execute the command
        document.execCommand(command, false, value);
        
        // Update saved selection with new range (in case content changed)
        if (newSelection.rangeCount > 0) {
          savedSelectionRef.current = {
            range: newSelection.getRangeAt(0).cloneRange(),
            editorRef
          };
        }
        
        // Release lock after delay
        setTimeout(() => { formattingLockRef.current = false; }, 200);
        return true;
      }
    }
    
    formattingLockRef.current = false;
    return false;
  }, []);

  return (
    <CanvasEditorContext.Provider value={{
      registerEditor,
      getActiveEditor,
      saveSelection,
      getSavedSelection,
      execCommandOnCanvas,
      hasActiveSelection,
      setFormattingLock,
      isFormattingLocked
    }}>
      {children}
    </CanvasEditorContext.Provider>
  );
}

export function useCanvasEditor() {
  return useContext(CanvasEditorContext);
}
