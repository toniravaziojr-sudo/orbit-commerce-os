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

interface CanvasRichTextProviderProps {
  children: ReactNode;
  onBlockSelect?: (blockId: string) => void;
}

const CanvasRichTextContext = createContext<CanvasRichTextContextValue | null>(null);

export function CanvasRichTextProvider({ children, onBlockSelect }: CanvasRichTextProviderProps) {
  const editorsRef = useRef<Map<string, RichTextEditorInstance>>(new Map());
  const activeEditorIdRef = useRef<string | null>(null);
  const savedSelectionRef = useRef<Range | null>(null);
  const formattingLockRef = useRef(false);
  // Track the last notified block to avoid duplicate calls
  const lastNotifiedBlockRef = useRef<string | null>(null);

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
  // Also notifies the builder to select the block for the properties panel
  const autoSaveSelection = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      // Selection collapsed or empty - reset the last notified block
      lastNotifiedBlockRef.current = null;
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
        
        // CRITICAL: Always notify the builder to select this block
        // This ensures the properties panel shows even when mouse ends outside canvas
        if (onBlockSelect) {
          // Always notify - the builder will handle deduplication if needed
          onBlockSelect(editorId);
          lastNotifiedBlockRef.current = editorId;
        }
        return;
      }
    }
    
    // Selection is outside all editors - reset tracking
    lastNotifiedBlockRef.current = null;
  }, [onBlockSelect]);

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
  // CRITICAL: We use both selectionchange AND mouseup to ensure we capture the final selection
  // even when the mouse ends outside the canvas
  useEffect(() => {
    const handleSelectionChange = () => {
      autoSaveSelection();
    };
    
    // mouseup ensures we capture selection even if selectionchange doesn't fire
    // after the mouse is released outside the editor
    const handleMouseUp = () => {
      // Small delay to ensure the selection is finalized
      setTimeout(() => {
        autoSaveSelection();
      }, 0);
    };
    
    document.addEventListener('selectionchange', handleSelectionChange);
    document.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      document.removeEventListener('mouseup', handleMouseUp);
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
