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
  // Restore saved selection and execute command
  execCommandOnCanvas: (command: string, value?: string) => boolean;
  // Check if canvas has active selection
  hasActiveSelection: () => boolean;
}

const CanvasEditorContext = createContext<CanvasEditorContextValue | null>(null);

export function CanvasEditorProvider({ children }: { children: ReactNode }) {
  const activeEditorRef = useRef<HTMLElement | null>(null);
  const savedSelectionRef = useRef<SavedSelection | null>(null);

  const registerEditor = useCallback((ref: HTMLElement | null) => {
    activeEditorRef.current = ref;
  }, []);

  const getActiveEditor = useCallback(() => {
    return activeEditorRef.current;
  }, []);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      savedSelectionRef.current = null;
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Check if selection is within the active editor
    if (activeEditorRef.current && activeEditorRef.current.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = {
        range: range.cloneRange(),
        editorRef: activeEditorRef.current
      };
    }
  }, []);

  const hasActiveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return false;
    
    const range = selection.getRangeAt(0);
    return !!(activeEditorRef.current && activeEditorRef.current.contains(range.commonAncestorContainer));
  }, []);

  const execCommandOnCanvas = useCallback((command: string, value?: string): boolean => {
    // Try to use current selection first
    const selection = window.getSelection();
    
    if (selection && !selection.isCollapsed && activeEditorRef.current) {
      const range = selection.getRangeAt(0);
      if (activeEditorRef.current.contains(range.commonAncestorContainer)) {
        // Selection is in canvas, execute directly
        activeEditorRef.current.focus();
        document.execCommand(command, false, value);
        return true;
      }
    }
    
    // Otherwise, try to restore saved selection
    if (savedSelectionRef.current) {
      const { range, editorRef } = savedSelectionRef.current;
      
      // Ensure the editor is still in the DOM
      if (!document.body.contains(editorRef)) {
        savedSelectionRef.current = null;
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
        
        return true;
      }
    }
    
    return false;
  }, []);

  return (
    <CanvasEditorContext.Provider value={{
      registerEditor,
      getActiveEditor,
      saveSelection,
      execCommandOnCanvas,
      hasActiveSelection
    }}>
      {children}
    </CanvasEditorContext.Provider>
  );
}

export function useCanvasEditor() {
  return useContext(CanvasEditorContext);
}
