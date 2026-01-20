// =============================================
// CANVAS RICH TEXT CONTEXT - Isolated context for RichText inline editing
// Manages the active editor instance and selection state
// =============================================

import { createContext, useContext, useRef, useCallback, useEffect, ReactNode } from 'react';

interface RichTextEditorInstance {
  element: HTMLElement;
  applyCommand: (command: string, value?: string) => boolean;
  applyFontSize: (size: string) => boolean;
  getSelection: () => Range | null;
  focus: () => void;
  getContent: () => string;
}

interface CanvasRichTextContextValue {
  // Register/unregister the active editor
  registerEditor: (id: string, instance: RichTextEditorInstance) => void;
  unregisterEditor: (id: string) => void;
  
  // Get the currently active editor (last focused)
  getActiveEditor: () => RichTextEditorInstance | null;
  getActiveEditorId: () => string | null;
  
  // Set which editor is active
  setActiveEditor: (id: string | null) => void;
  
  // Selection management
  saveSelection: () => void;
  restoreSelection: () => boolean;
  hasSelection: () => boolean;
  
  // Formatting lock to prevent content sync during operations
  setFormattingLock: (locked: boolean) => void;
  isFormattingLocked: () => boolean;
}

const CanvasRichTextContext = createContext<CanvasRichTextContextValue | null>(null);

export function CanvasRichTextProvider({ children }: { children: ReactNode }) {
  const editorsRef = useRef<Map<string, RichTextEditorInstance>>(new Map());
  const activeEditorIdRef = useRef<string | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const formattingLockRef = useRef(false);

  const registerEditor = useCallback((id: string, instance: RichTextEditorInstance) => {
    editorsRef.current.set(id, instance);
  }, []);

  const unregisterEditor = useCallback((id: string) => {
    editorsRef.current.delete(id);
    if (activeEditorIdRef.current === id) {
      activeEditorIdRef.current = null;
      savedSelectionRef.current = null;
    }
  }, []);

  const getActiveEditor = useCallback((): RichTextEditorInstance | null => {
    if (!activeEditorIdRef.current) return null;
    return editorsRef.current.get(activeEditorIdRef.current) || null;
  }, []);

  const getActiveEditorId = useCallback((): string | null => {
    return activeEditorIdRef.current;
  }, []);

  const setActiveEditor = useCallback((id: string | null) => {
    activeEditorIdRef.current = id;
    if (!id) {
      savedSelectionRef.current = null;
    }
  }, []);

  const saveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    const activeEditor = getActiveEditor();
    
    if (activeEditor && activeEditor.element.contains(range.commonAncestorContainer)) {
      savedSelectionRef.current = range.cloneRange();
    }
  }, [getActiveEditor]);
  
  // Auto-save selection on any selection change within registered editors
  // This ensures we capture the selection even when mouse ends outside canvas
  const autoSaveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return;
    }

    const range = selection.getRangeAt(0);
    
    // Check if selection is within ANY registered editor
    for (const [editorId, editor] of editorsRef.current.entries()) {
      if (editor.element.contains(range.commonAncestorContainer)) {
        // Set this editor as active if not already
        if (activeEditorIdRef.current !== editorId) {
          activeEditorIdRef.current = editorId;
        }
        savedSelectionRef.current = range.cloneRange();
        return;
      }
    }
  }, []);

  const restoreSelection = useCallback((): boolean => {
    if (!savedSelectionRef.current) return false;
    
    const activeEditor = getActiveEditor();
    if (!activeEditor) return false;
    
    // Ensure editor is focused first
    activeEditor.focus();
    
    const selection = window.getSelection();
    if (selection) {
      selection.removeAllRanges();
      selection.addRange(savedSelectionRef.current);
      return true;
    }
    return false;
  }, [getActiveEditor]);

  const hasSelection = useCallback((): boolean => {
    // Check saved selection first
    if (savedSelectionRef.current) return true;
    
    // Check if there's a live selection within any registered editor
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return false;
    
    const range = selection.getRangeAt(0);
    
    // Check against ALL registered editors, not just the active one
    for (const editor of editorsRef.current.values()) {
      if (editor.element.contains(range.commonAncestorContainer)) {
        return true;
      }
    }
    
    return false;
  }, []);
  
  // Global selection listener - auto-saves selection whenever user selects text in a rich text editor
  useEffect(() => {
    const handleSelectionChange = () => {
      autoSaveSelection();
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [autoSaveSelection]);

  const setFormattingLock = useCallback((locked: boolean) => {
    formattingLockRef.current = locked;
  }, []);

  const isFormattingLocked = useCallback(() => {
    return formattingLockRef.current;
  }, []);

  return (
    <CanvasRichTextContext.Provider value={{
      registerEditor,
      unregisterEditor,
      getActiveEditor,
      getActiveEditorId,
      setActiveEditor,
      saveSelection,
      restoreSelection,
      hasSelection,
      setFormattingLock,
      isFormattingLocked
    }}>
      {children}
    </CanvasRichTextContext.Provider>
  );
}

export function useCanvasRichText() {
  return useContext(CanvasRichTextContext);
}
