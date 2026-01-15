// =============================================
// BUILDER UTILS - Utility functions for builder
// =============================================

import type { BlockNode } from './types';
import { blockRegistry } from './registry';

// Structural block types that are "infrastructure" and hidden from user management
// Section is included to hide the "LayoutDashboard Seção" from sidebar while keeping it as internal container
export const STRUCTURAL_BLOCK_TYPES = new Set(['Header', 'Footer', 'Page', 'Section']);

// Generate unique ID
export function generateBlockId(type: string): string {
  return `${type.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Check if a block type is structural (infrastructure)
export function isStructuralBlock(blockType: string): boolean {
  return STRUCTURAL_BLOCK_TYPES.has(blockType);
}

// Get the best insert index for a new block (after Header, before Footer)
// Returns the index where new blocks should be inserted by default
export function getDefaultInsertIndex(content: BlockNode): number {
  if (!content.children || content.children.length === 0) return 0;
  
  // Find Footer index - insert before it
  const footerIndex = content.children.findIndex(child => child.type === 'Footer');
  if (footerIndex !== -1) return footerIndex;
  
  // No footer found, insert at end
  return content.children.length;
}

// Get user-managed blocks (excluding structural blocks)
export function getUserManagedBlocks(content: BlockNode): BlockNode[] {
  if (!content.children) return [];
  return content.children.filter(child => !isStructuralBlock(child.type));
}

// Resolve the correct parent ID and insert index for adding a block
// This ensures blocks are added to the right place in the tree
// Key insight: blocks should be added as siblings of other content blocks,
// NOT inside structural containers like Header/Footer
export function resolveInsertTarget(content: BlockNode, selectedBlockId: string | null): {
  parentId: string;
  index: number | undefined;
} {
  console.log('[resolveInsertTarget] Called with:', { 
    contentId: content.id, 
    contentType: content.type,
    childrenCount: content.children?.length,
    selectedBlockId 
  });
  
  // Find the best container for new blocks
  // Priority:
  // 1. If selected block has a parent that accepts children, insert as sibling
  // 2. If there's a Section container, insert inside it
  // 3. Otherwise, insert directly into root (Page)
  
  // If we have a selected block, try to insert as sibling
  if (selectedBlockId && content.children) {
    // Check if selected block is a direct child of content
    const selectedIndex = content.children.findIndex(child => child.id === selectedBlockId);
    if (selectedIndex !== -1) {
      // Calculate insert position (after selected, but before Footer if exists)
      let insertIndex = selectedIndex + 1;
      // Don't insert after Footer
      const footerIndex = content.children.findIndex(child => child.type === 'Footer');
      if (footerIndex !== -1 && insertIndex > footerIndex) {
        insertIndex = footerIndex;
      }
      console.log('[resolveInsertTarget] Found selected as direct child, returning:', { parentId: content.id, index: insertIndex });
      return { parentId: content.id, index: insertIndex };
    }
    
    // Check if selected block is inside a Section
    for (let i = 0; i < content.children.length; i++) {
      const child = content.children[i];
      if (child.type === 'Section' && child.children) {
        const innerIndex = child.children.findIndex(c => c.id === selectedBlockId);
        if (innerIndex !== -1) {
          // Insert after the selected block inside the Section
          console.log('[resolveInsertTarget] Found selected inside Section, returning:', { parentId: child.id, index: innerIndex + 1 });
          return { parentId: child.id, index: innerIndex + 1 };
        }
      }
    }
  }
  
  // No selection or selection not found - find the best default container
  if (content.children) {
    // Look for a Section that can receive children
    for (let i = 0; i < content.children.length; i++) {
      const child = content.children[i];
      if (child.type === 'Section') {
        // Insert at the end of this Section's children
        const sectionChildCount = child.children?.length || 0;
        console.log('[resolveInsertTarget] Found Section container, returning:', { parentId: child.id, index: sectionChildCount });
        return { parentId: child.id, index: sectionChildCount };
      }
    }
    
    // No Section found - insert directly into root, before Footer
    const footerIndex = content.children.findIndex(child => child.type === 'Footer');
    const insertIndex = footerIndex !== -1 ? footerIndex : content.children.length;
    console.log('[resolveInsertTarget] No Section, inserting into root before Footer:', { parentId: content.id, index: insertIndex });
    return { parentId: content.id, index: insertIndex };
  }
  
  // Fallback: insert into root
  console.log('[resolveInsertTarget] Fallback, returning root:', { parentId: content.id, index: undefined });
  return { parentId: content.id, index: undefined };
}

// Deep clone a block node
export function cloneBlockNode(node: BlockNode): BlockNode {
  return JSON.parse(JSON.stringify(node));
}

// Find a block by ID in the tree
export function findBlockById(root: BlockNode, id: string): BlockNode | null {
  if (root.id === id) return root;
  
  if (root.children) {
    for (const child of root.children) {
      const found = findBlockById(child, id);
      if (found) return found;
    }
  }
  
  return null;
}

// Find parent of a block
export function findParentBlock(root: BlockNode, id: string): BlockNode | null {
  if (root.children) {
    for (const child of root.children) {
      if (child.id === id) return root;
      const found = findParentBlock(child, id);
      if (found) return found;
    }
  }
  return null;
}

// Find block path (array of indices to reach the block)
export function findBlockPath(root: BlockNode, id: string, path: number[] = []): number[] | null {
  if (root.id === id) return path;
  
  if (root.children) {
    for (let i = 0; i < root.children.length; i++) {
      const found = findBlockPath(root.children[i], id, [...path, i]);
      if (found) return found;
    }
  }
  
  return null;
}

// Update a block's props
export function updateBlockProps(
  root: BlockNode,
  id: string,
  props: Partial<Record<string, unknown>>
): BlockNode {
  const cloned = cloneBlockNode(root);
  const block = findBlockById(cloned, id);
  
  if (block) {
    block.props = { ...block.props, ...props };
  }
  
  return cloned;
}

// Add a block as child
export function addBlockChild(
  root: BlockNode,
  parentId: string,
  newBlock: BlockNode,
  index?: number
): BlockNode {
  console.log('[addBlockChild] Called with:', { parentId, newBlockId: newBlock.id, newBlockType: newBlock.type, index });
  
  const cloned = cloneBlockNode(root);
  const parent = findBlockById(cloned, parentId);
  
  if (!parent) {
    console.error('[addBlockChild] Parent NOT found:', parentId);
    console.error('[addBlockChild] Root structure:', { rootId: root.id, rootType: root.type, childrenCount: root.children?.length });
    return cloned; // Return unchanged
  }
  
  console.log('[addBlockChild] Parent found:', { parentId: parent.id, parentType: parent.type, existingChildren: parent.children?.length || 0 });
  
  if (!parent.children) parent.children = [];
  
  if (index !== undefined && index >= 0 && index <= parent.children.length) {
    parent.children.splice(index, 0, newBlock);
    console.log('[addBlockChild] Inserted at index:', index);
  } else {
    parent.children.push(newBlock);
    console.log('[addBlockChild] Pushed to end, new length:', parent.children.length);
  }
  
  return cloned;
}

// Remove a block from tree
export function removeBlock(root: BlockNode, id: string): BlockNode {
  // CRITICAL: Never remove the root block itself
  if (root.id === id) {
    console.warn('[Builder] Cannot remove root block');
    return root;
  }
  
  const cloned = cloneBlockNode(root);
  
  // Protected structural types that should never be deleted if they contain essential blocks
  const structuralTypes = ['Page', 'Section', 'Layout', 'StorefrontWrapper', 'PageWrapper'];
  
  function removeFromChildren(node: BlockNode): boolean {
    if (!node.children) return false;
    
    const index = node.children.findIndex(child => child.id === id);
    if (index !== -1) {
      const targetBlock = node.children[index];
      
      // Check if block is removable via registry
      const blockDef = blockRegistry.get(targetBlock.type);
      if (blockDef?.isRemovable === false) {
        return false;
      }
      
      // CRITICAL: Don't delete structural blocks that contain Header/Footer
      if (structuralTypes.includes(targetBlock.type)) {
        const hasEssential = targetBlock.children?.some(child => 
          ['Header', 'Footer'].includes(child.type)
        );
        if (hasEssential) {
          console.warn('[Builder] Cannot remove structural block containing Header/Footer');
          return false;
        }
      }
      
      node.children.splice(index, 1);
      return true;
    }
    
    for (const child of node.children) {
      if (removeFromChildren(child)) return true;
    }
    
    return false;
  }
  
  removeFromChildren(cloned);
  return cloned;
}

// Move a block to a new position
export function moveBlock(
  root: BlockNode,
  blockId: string,
  newParentId: string,
  newIndex: number
): BlockNode {
  const block = findBlockById(root, blockId);
  if (!block) return root;
  
  // Clone the block before removing
  const blockClone = cloneBlockNode(block);
  
  // Remove from current position
  let result = removeBlock(root, blockId);
  
  // Add to new position
  result = addBlockChild(result, newParentId, blockClone, newIndex);
  
  return result;
}

// Duplicate a block
export function duplicateBlock(root: BlockNode, id: string): BlockNode {
  const block = findBlockById(root, id);
  if (!block) return root;
  
  const parent = findParentBlock(root, id);
  if (!parent || !parent.children) return root;
  
  const blockIndex = parent.children.findIndex(child => child.id === id);
  if (blockIndex === -1) return root;
  
  // Clone and regenerate IDs
  const duplicate = regenerateIds(cloneBlockNode(block));
  
  return addBlockChild(root, parent.id, duplicate, blockIndex + 1);
}

// Regenerate all IDs in a block tree
export function regenerateIds(node: BlockNode): BlockNode {
  const newNode: BlockNode = {
    ...node,
    id: generateBlockId(node.type),
    props: { ...node.props },
  };
  
  if (node.children) {
    newNode.children = node.children.map(child => regenerateIds(child));
  }
  
  return newNode;
}

// Validate block structure
export function validateBlockNode(node: BlockNode): boolean {
  if (!node.id || !node.type) return false;
  
  const definition = blockRegistry.get(node.type);
  if (!definition) {
    // Unknown block type - still valid, will use fallback
    console.warn(`Unknown block type: ${node.type}`);
    return true;
  }
  
  // Check children constraints
  if (node.children && !definition.canHaveChildren) {
    console.warn(`Block ${node.type} should not have children`);
    return false;
  }
  
  if (
    node.children &&
    definition.slotConstraints?.maxChildren &&
    node.children.length > definition.slotConstraints.maxChildren
  ) {
    console.warn(`Block ${node.type} exceeds max children limit`);
    return false;
  }
  
  // Recursively validate children
  if (node.children) {
    return node.children.every(child => validateBlockNode(child));
  }
  
  return true;
}

// Get flattened list of all blocks
export function flattenBlocks(root: BlockNode): BlockNode[] {
  const result: BlockNode[] = [root];
  
  if (root.children) {
    for (const child of root.children) {
      result.push(...flattenBlocks(child));
    }
  }
  
  return result;
}
