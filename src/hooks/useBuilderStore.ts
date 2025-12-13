// =============================================
// BUILDER STORE - State management with undo/redo
// =============================================

import { useState, useCallback, useMemo } from 'react';
import type { BlockNode } from '@/lib/builder/types';
import { 
  cloneBlockNode, 
  findBlockById, 
  updateBlockProps, 
  addBlockChild, 
  removeBlock, 
  moveBlock, 
  duplicateBlock 
} from '@/lib/builder/utils';
import { blockRegistry } from '@/lib/builder/registry';
import { createEmptyPage } from '@/lib/builder/types';

const MAX_HISTORY = 50;

interface BuilderStoreState {
  content: BlockNode;
  selectedBlockId: string | null;
  history: BlockNode[];
  historyIndex: number;
  isDirty: boolean;
}

export function useBuilderStore(initialContent?: BlockNode) {
  const [state, setState] = useState<BuilderStoreState>(() => ({
    content: initialContent || createEmptyPage(),
    selectedBlockId: null,
    history: [initialContent || createEmptyPage()],
    historyIndex: 0,
    isDirty: false,
  }));

  // Push to history
  const pushHistory = useCallback((newContent: BlockNode) => {
    setState(prev => {
      // Trim future history if we're not at the end
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(cloneBlockNode(newContent));
      
      // Limit history size
      if (newHistory.length > MAX_HISTORY) {
        newHistory.shift();
      }
      
      return {
        ...prev,
        content: newContent,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,
      };
    });
  }, []);

  // Set content without history (for initial load)
  const setContent = useCallback((content: BlockNode) => {
    setState({
      content,
      selectedBlockId: null,
      history: [cloneBlockNode(content)],
      historyIndex: 0,
      isDirty: false,
    });
  }, []);

  // Mark as clean (after save)
  const markClean = useCallback(() => {
    setState(prev => ({ ...prev, isDirty: false }));
  }, []);

  // Select a block
  const selectBlock = useCallback((id: string | null) => {
    setState(prev => ({ ...prev, selectedBlockId: id }));
  }, []);

  // Get selected block
  const selectedBlock = useMemo(() => {
    if (!state.selectedBlockId) return null;
    return findBlockById(state.content, state.selectedBlockId);
  }, [state.content, state.selectedBlockId]);

  // Get selected block definition
  const selectedBlockDefinition = useMemo(() => {
    if (!selectedBlock) return null;
    return blockRegistry[selectedBlock.type] || null;
  }, [selectedBlock]);

  // Update block props
  const updateProps = useCallback((blockId: string, props: Record<string, unknown>) => {
    const newContent = updateBlockProps(state.content, blockId, props);
    pushHistory(newContent);
  }, [state.content, pushHistory]);

  // Add a new block
  const addBlock = useCallback((type: string, parentId?: string, index?: number) => {
    const definition = blockRegistry[type];
    if (!definition) return;

    const newBlock: BlockNode = {
      id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      props: { ...definition.defaultProps },
      children: definition.canHaveChildren ? [] : undefined,
    };

    const targetParentId = parentId || 'root';
    const newContent = addBlockChild(state.content, targetParentId, newBlock, index);
    pushHistory(newContent);
    selectBlock(newBlock.id);
  }, [state.content, pushHistory, selectBlock]);

  // Remove a block
  const removeBlockById = useCallback((blockId: string) => {
    const block = findBlockById(state.content, blockId);
    if (!block) return;

    const definition = blockRegistry[block.type];
    if (definition?.isRemovable === false) return;

    const newContent = removeBlock(state.content, blockId);
    pushHistory(newContent);
    
    if (state.selectedBlockId === blockId) {
      selectBlock(null);
    }
  }, [state.content, state.selectedBlockId, pushHistory, selectBlock]);

  // Move a block
  const moveBlockById = useCallback((blockId: string, newParentId: string, newIndex: number) => {
    const newContent = moveBlock(state.content, blockId, newParentId, newIndex);
    pushHistory(newContent);
  }, [state.content, pushHistory]);

  // Duplicate a block
  const duplicateBlockById = useCallback((blockId: string) => {
    const block = findBlockById(state.content, blockId);
    if (!block) return;

    const definition = blockRegistry[block.type];
    if (definition?.isRemovable === false) return;

    const newContent = duplicateBlock(state.content, blockId);
    pushHistory(newContent);
  }, [state.content, pushHistory]);

  // Undo
  const undo = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex <= 0) return prev;
      const newIndex = prev.historyIndex - 1;
      return {
        ...prev,
        content: cloneBlockNode(prev.history[newIndex]),
        historyIndex: newIndex,
        isDirty: true,
      };
    });
  }, []);

  // Redo
  const redo = useCallback(() => {
    setState(prev => {
      if (prev.historyIndex >= prev.history.length - 1) return prev;
      const newIndex = prev.historyIndex + 1;
      return {
        ...prev,
        content: cloneBlockNode(prev.history[newIndex]),
        historyIndex: newIndex,
        isDirty: true,
      };
    });
  }, []);

  // Can undo/redo
  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  return {
    // State
    content: state.content,
    selectedBlockId: state.selectedBlockId,
    selectedBlock,
    selectedBlockDefinition,
    isDirty: state.isDirty,
    canUndo,
    canRedo,

    // Actions
    setContent,
    markClean,
    selectBlock,
    updateProps,
    addBlock,
    removeBlock: removeBlockById,
    moveBlock: moveBlockById,
    duplicateBlock: duplicateBlockById,
    undo,
    redo,
  };
}

export type BuilderStore = ReturnType<typeof useBuilderStore>;
