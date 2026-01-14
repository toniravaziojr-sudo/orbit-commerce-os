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
export function resolveInsertTarget(content: BlockNode, selectedBlockId: string | null): {
  parentId: string;
  index: number | undefined;
} {
  // The root content is always the parent for top-level blocks
  // We insert directly into content.children
  const parentId = content.id;
  
  // Calculate insert index: after selected block, or at default position
  let index: number | undefined = undefined;
  
  if (selectedBlockId && content.children) {
    const selectedIndex = content.children.findIndex(child => child.id === selectedBlockId);
    if (selectedIndex !== -1) {
      // Insert after selected block
      index = selectedIndex + 1;
    }
  }
  
  // If no valid selected block, use default insert position (before Footer)
  if (index === undefined) {
    index = getDefaultInsertIndex(content);
  }
  
  return { parentId, index };
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
  const cloned = cloneBlockNode(root);
  const parent = findBlockById(cloned, parentId);
  
  if (parent) {
    if (!parent.children) parent.children = [];
    
    if (index !== undefined && index >= 0 && index <= parent.children.length) {
      parent.children.splice(index, 0, newBlock);
    } else {
      parent.children.push(newBlock);
    }
  }
  
  return cloned;
}

// Remove a block from tree
export function removeBlock(root: BlockNode, id: string): BlockNode {
  const cloned = cloneBlockNode(root);
  
  function removeFromChildren(node: BlockNode): boolean {
    if (!node.children) return false;
    
    const index = node.children.findIndex(child => child.id === id);
    if (index !== -1) {
      // Check if block is removable
      const blockDef = blockRegistry.get(node.children[index].type);
      if (blockDef?.isRemovable === false) {
        return false;
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
