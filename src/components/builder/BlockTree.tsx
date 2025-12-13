// =============================================
// BLOCK TREE - Hierarchical tree view of blocks
// =============================================

import { useState } from 'react';
import { ChevronRight, ChevronDown, GripVertical, Layers } from 'lucide-react';
import { BlockNode } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { cn } from '@/lib/utils';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface BlockTreeProps {
  content: BlockNode;
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onMoveBlock: (blockId: string, newParentId: string, newIndex: number) => void;
  onScrollToBlock?: (id: string) => void;
}

export function BlockTree({ 
  content, 
  selectedBlockId, 
  onSelectBlock,
  onMoveBlock,
  onScrollToBlock,
}: BlockTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [activeId, setActiveId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const toggleExpand = (id: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedNodes(newExpanded);
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    // Find blocks
    const draggedId = active.id as string;
    const targetId = over.id as string;

    // Find parent of target to determine where to insert
    const targetParentId = findParentId(content, targetId) || 'root';
    const targetParent = findBlockById(content, targetParentId);
    
    if (targetParent?.children) {
      const targetIndex = targetParent.children.findIndex(c => c.id === targetId);
      onMoveBlock(draggedId, targetParentId, targetIndex);
    }
  };

  return (
    <div className="h-full overflow-auto p-2">
      <div className="flex items-center gap-2 px-2 py-1 mb-2 text-sm font-semibold text-muted-foreground">
        <Layers className="h-4 w-4" />
        <span>Estrutura</span>
      </div>
      
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <TreeNode
          node={content}
          depth={0}
          selectedBlockId={selectedBlockId}
          expandedNodes={expandedNodes}
          onSelect={(id) => {
            onSelectBlock(id);
            onScrollToBlock?.(id);
          }}
          onToggleExpand={toggleExpand}
        />
        
        <DragOverlay>
          {activeId ? (
            <div className="bg-primary/10 border border-primary rounded px-2 py-1 text-sm">
              {getBlockLabel(content, activeId)}
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

interface TreeNodeProps {
  node: BlockNode;
  depth: number;
  selectedBlockId: string | null;
  expandedNodes: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
}

function TreeNode({
  node,
  depth,
  selectedBlockId,
  expandedNodes,
  onSelect,
  onToggleExpand,
}: TreeNodeProps) {
  const definition = blockRegistry.get(node.type);
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedBlockId === node.id;
  const isRoot = node.id === 'root';

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: node.id,
    disabled: isRoot || definition?.isRemovable === false,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const childIds = node.children?.map(c => c.id) || [];

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          'flex items-center gap-1 px-2 py-1 rounded text-sm cursor-pointer hover:bg-muted',
          isSelected && 'bg-primary/10 text-primary',
          isDragging && 'opacity-50'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Drag Handle */}
        {!isRoot && definition?.isRemovable !== false && (
          <button
            className="cursor-grab hover:text-primary"
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-3 w-3" />
          </button>
        )}

        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
            className="hover:text-primary"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Icon */}
        <span className="text-xs opacity-60">{definition?.icon || '📦'}</span>

        {/* Label */}
        <span className="truncate flex-1">
          {definition?.label || node.type}
        </span>
      </div>

      {/* Children */}
      {hasChildren && isExpanded && (
        <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedBlockId={selectedBlockId}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

// Helper functions
function findBlockById(root: BlockNode, id: string): BlockNode | null {
  if (root.id === id) return root;
  if (!root.children) return null;
  for (const child of root.children) {
    const found = findBlockById(child, id);
    if (found) return found;
  }
  return null;
}

function findParentId(root: BlockNode, childId: string): string | null {
  if (!root.children) return null;
  for (const child of root.children) {
    if (child.id === childId) return root.id;
    const found = findParentId(child, childId);
    if (found) return found;
  }
  return null;
}

function getBlockLabel(root: BlockNode, id: string): string {
  const block = findBlockById(root, id);
  if (!block) return 'Bloco';
  const def = blockRegistry.get(block.type);
  return def?.label || block.type;
}
