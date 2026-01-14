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
  duplicateBlock,
  resolveInsertTarget
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

  // Set content without history (for initial load)
  const setContent = useCallback((content: BlockNode, preserveSelection?: boolean) => {
    setState(prev => {
      // If preserving selection, verify the selected block still exists in new content
      let newSelectedBlockId = preserveSelection ? prev.selectedBlockId : null;
      if (newSelectedBlockId) {
        const stillExists = findBlockById(content, newSelectedBlockId);
        if (!stillExists) {
          newSelectedBlockId = null;
        }
      }
      return {
        content,
        selectedBlockId: newSelectedBlockId,
        history: [cloneBlockNode(content)],
        historyIndex: 0,
        isDirty: false,
      };
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
    return blockRegistry.get(selectedBlock.type) || null;
  }, [selectedBlock]);

  // Update block props
  const updateProps = useCallback((blockId: string, props: Record<string, unknown>) => {
    setState(prev => {
      const newContent = updateBlockProps(prev.content, blockId, props);
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(cloneBlockNode(newContent));
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        ...prev,
        content: newContent,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,
      };
    });
  }, []);

  // Add a new block - uses functional setState to avoid stale closure
  const addBlock = useCallback((type: string, parentId?: string, index?: number) => {
    const definition = blockRegistry.get(type);
    if (!definition) {
      console.warn(`[addBlock] Block type "${type}" not found in registry`);
      return;
    }

    const newBlock: BlockNode = {
      id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type,
      props: { ...definition.defaultProps },
      children: definition.canHaveChildren ? [] : undefined,
    };

    console.log('[addBlock] Creating block:', { type, parentId, index, newBlockId: newBlock.id });

    setState(prev => {
      // Resolve the correct parent and index using current state
      let targetParentId: string;
      let targetIndex: number | undefined;
      
      if (parentId !== undefined) {
        // Explicit parent provided
        targetParentId = parentId;
        targetIndex = index;
      } else {
        // Resolve the best insert target based on current selection
        const resolved = resolveInsertTarget(prev.content, prev.selectedBlockId);
        targetParentId = resolved.parentId;
        targetIndex = resolved.index;
      }
      
      console.log('[addBlock] Current content:', { 
        contentId: prev.content.id, 
        contentType: prev.content.type,
        childrenCount: prev.content.children?.length,
        targetParentId,
        targetIndex,
        selectedBlockId: prev.selectedBlockId
      });
      
      const newContent = addBlockChild(prev.content, targetParentId, newBlock, targetIndex);
      
      // Verify block was added
      const addedBlock = findBlockById(newContent, newBlock.id);
      if (!addedBlock) {
        console.error('[addBlock] Block was NOT added! Check addBlockChild logic.');
        return prev;
      }
      
      console.log('[addBlock] Block added successfully:', { 
        newBlockId: newBlock.id, 
        newChildrenCount: newContent.children?.length 
      });
      
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(cloneBlockNode(newContent));
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      
      return {
        ...prev,
        content: newContent,
        selectedBlockId: newBlock.id,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,
      };
    });
  }, []);

  // Remove a block - uses functional setState to avoid stale closure
  const removeBlockById = useCallback((blockId: string) => {
    setState(prev => {
      const block = findBlockById(prev.content, blockId);
      if (!block) return prev;

      const definition = blockRegistry.get(block.type);
      if (definition?.isRemovable === false) return prev;

      const newContent = removeBlock(prev.content, blockId);
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(cloneBlockNode(newContent));
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      
      return {
        ...prev,
        content: newContent,
        selectedBlockId: prev.selectedBlockId === blockId ? null : prev.selectedBlockId,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,
      };
    });
  }, []);

  // Move a block - uses functional setState to avoid stale closure
  const moveBlockById = useCallback((blockId: string, newParentId: string, newIndex: number) => {
    setState(prev => {
      const newContent = moveBlock(prev.content, blockId, newParentId, newIndex);
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(cloneBlockNode(newContent));
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        ...prev,
        content: newContent,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,
      };
    });
  }, []);

  // Duplicate a block - uses functional setState to avoid stale closure
  const duplicateBlockById = useCallback((blockId: string) => {
    setState(prev => {
      const block = findBlockById(prev.content, blockId);
      if (!block) return prev;

      const definition = blockRegistry.get(block.type);
      if (definition?.isRemovable === false) return prev;

      const newContent = duplicateBlock(prev.content, blockId);
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(cloneBlockNode(newContent));
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        ...prev,
        content: newContent,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,
      };
    });
  }, []);

  // Toggle block visibility - uses functional setState to avoid stale closure
  const toggleBlockHidden = useCallback((blockId: string) => {
    setState(prev => {
      const block = findBlockById(prev.content, blockId);
      if (!block) return prev;

      // Need to toggle hidden on the block node itself, not props
      const toggleHiddenInTree = (node: BlockNode): BlockNode => {
        if (node.id === blockId) {
          return { ...node, hidden: !node.hidden };
        }
        if (node.children) {
          return { ...node, children: node.children.map(toggleHiddenInTree) };
        }
        return node;
      };
      
      const newContent = toggleHiddenInTree(prev.content);
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(cloneBlockNode(newContent));
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      return {
        ...prev,
        content: newContent,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,
      };
    });
  }, []);

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
    toggleHidden: toggleBlockHidden,
    undo,
    redo,
  };
}

export type BuilderStore = ReturnType<typeof useBuilderStore>;
