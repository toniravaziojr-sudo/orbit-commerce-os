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
  // Returns { ok: boolean, blockId?: string, reason?: string } for feedback
  const addBlock = useCallback((type: string, parentId?: string, index?: number): { ok: boolean; blockId?: string; reason?: string } => {
    const definition = blockRegistry.get(type);
    if (!definition) {
      console.warn(`[addBlock] Block type "${type}" not found in registry`);
      return { ok: false, reason: `Tipo de bloco "${type}" não encontrado` };
    }

    const newBlock: BlockNode = {
      id: `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`,
      type,
      props: { ...definition.defaultProps },
      children: definition.canHaveChildren ? [] : undefined,
    };

    console.log('[addBlock] Creating block:', { type, parentId, index, newBlockId: newBlock.id });

    let result: { ok: boolean; blockId?: string; reason?: string } = { ok: false, reason: 'Erro desconhecido' };

    setState(prev => {
      // CRITICAL: Use structuredClone for full immutability (new reference)
      const clonedContent = structuredClone(prev.content);
      
      // Resolve the correct parent and index using current state
      let targetParentId: string;
      let targetIndex: number | undefined;
      
      if (parentId !== undefined) {
        // Explicit parent provided
        targetParentId = parentId;
        targetIndex = index;
      } else {
        // Resolve the best insert target based on current selection
        const resolved = resolveInsertTarget(clonedContent, prev.selectedBlockId);
        targetParentId = resolved.parentId;
        targetIndex = resolved.index;
      }
      
      console.log('[addBlock] Current content:', { 
        contentId: clonedContent.id, 
        contentType: clonedContent.type,
        childrenCount: clonedContent.children?.length,
        targetParentId,
        targetIndex,
        selectedBlockId: prev.selectedBlockId
      });
      
      const newContent = addBlockChild(clonedContent, targetParentId, newBlock, targetIndex);
      
      // Verify block was added AND reference changed
      const addedBlock = findBlockById(newContent, newBlock.id);
      const referenceChanged = newContent !== prev.content;
      
      if (!addedBlock) {
        console.error('[addBlock] Block was NOT added! Parent not found or addBlockChild failed.');
        console.groupCollapsed('[ADD_BLOCK_FAIL] Diagnostic');
        console.log('targetParentId:', targetParentId);
        console.log('targetIndex:', targetIndex);
        console.log('prevContentId:', prev.content.id);
        console.log('newContentId:', newContent.id);
        console.log('childrenCount before:', prev.content.children?.length);
        console.log('childrenCount after:', newContent.children?.length);
        console.groupEnd();
        result = { ok: false, reason: `Não foi possível inserir no container "${targetParentId}"` };
        return prev;
      }
      
      console.log('[addBlock] Block added successfully:', { 
        newBlockId: newBlock.id, 
        newChildrenCount: newContent.children?.length,
        referenceChanged 
      });
      
      const newHistory = prev.history.slice(0, prev.historyIndex + 1);
      newHistory.push(cloneBlockNode(newContent));
      if (newHistory.length > MAX_HISTORY) newHistory.shift();
      
      result = { ok: true, blockId: newBlock.id };
      
      return {
        ...prev,
        content: newContent,
        selectedBlockId: newBlock.id,
        history: newHistory,
        historyIndex: newHistory.length - 1,
        isDirty: true,
      };
    });

    return result;
  }, []);

  // Remove a block - uses functional setState to avoid stale closure
  const removeBlockById = useCallback((blockId: string) => {
    setState(prev => {
      // CRITICAL: Never allow deleting the root block
      if (blockId === prev.content?.id) {
        console.warn('[Builder] Attempted to delete root block - blocked');
        return prev;
      }

      const block = findBlockById(prev.content, blockId);
      if (!block) return prev;

      // CRITICAL: NEVER delete Header or Footer
      if (['Header', 'Footer'].includes(block.type)) {
        console.warn('[Builder] Attempted to delete Header/Footer - blocked');
        return prev;
      }

      // CRITICAL: Protect structural container types
      const structuralTypes = ['Page', 'Section', 'Layout', 'StorefrontWrapper', 'PageWrapper'];
      if (structuralTypes.includes(block.type)) {
        // Check if this is a direct child of root (main structure)
        const isDirectChildOfRoot = prev.content?.children?.some(c => c.id === blockId);
        if (isDirectChildOfRoot) {
          // Count how many Sections exist at root level
          const sectionCount = prev.content?.children?.filter(c => c.type === 'Section').length || 0;
          // If this is the last/only Section, don't delete
          if (block.type === 'Section' && sectionCount <= 1) {
            console.warn('[Builder] Cannot delete last Section - blocked');
            return prev;
          }
          // Check if it contains essential blocks
          const hasEssentialChild = block.children?.some(child => 
            ['Header', 'Footer'].includes(child.type)
          );
          if (hasEssentialChild) {
            console.warn('[Builder] Attempted to delete container with essential blocks - blocked');
            return prev;
          }
        }
      }

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
