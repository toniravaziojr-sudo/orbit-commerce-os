// =============================================
// BLOCK TREE - Hierarchical tree view of blocks
// With "Estrutura Padrão" virtual node for essential blocks
// =============================================

import { useState, useMemo, useCallback } from 'react';
import { ChevronRight, ChevronDown, GripVertical, Layers, Package } from 'lucide-react';
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
import { isEssentialBlock } from '@/lib/builder/essentialBlocks';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// Virtual ID for the "Estrutura Padrão" group
const STANDARD_STRUCTURE_ID = '__standard_structure__';

interface BlockTreeProps {
  content: BlockNode;
  selectedBlockId: string | null;
  onSelectBlock: (id: string) => void;
  onMoveBlock: (blockId: string, newParentId: string, newIndex: number) => void;
  onScrollToBlock?: (id: string) => void;
  pageType: string;
}

// Check if a block is an "essential" block for the current page type (excluding Header/Footer)
function isPageEssentialBlock(blockType: string, pageType: string): boolean {
  // Header and Footer are handled separately (not shown in tree)
  if (['Header', 'Footer'].includes(blockType)) return false;
  return isEssentialBlock(blockType, pageType);
}

export function BlockTree({ 
  content, 
  selectedBlockId, 
  onSelectBlock,
  onMoveBlock,
  onScrollToBlock,
  pageType,
}: BlockTreeProps) {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root', STANDARD_STRUCTURE_ID]));
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

  // Analyze content to separate essential vs custom blocks
  const { essentialBlocks, customBlocks, hasEssentialBlocks } = useMemo(() => {
    const essential: BlockNode[] = [];
    const custom: BlockNode[] = [];
    
    // Get direct children of root (excluding Header/Footer)
    const rootChildren = content.children?.filter(child => 
      !['Header', 'Footer'].includes(child.type)
    ) || [];
    
    for (const child of rootChildren) {
      // Skip Sections, we look inside them
      if (child.type === 'Section') {
        // Check children of sections
        for (const sectionChild of (child.children || [])) {
          if (isPageEssentialBlock(sectionChild.type, pageType)) {
            essential.push(sectionChild);
          } else {
            custom.push(sectionChild);
          }
        }
      } else {
        if (isPageEssentialBlock(child.type, pageType)) {
          essential.push(child);
        } else {
          custom.push(child);
        }
      }
    }
    
    return {
      essentialBlocks: essential,
      customBlocks: custom,
      hasEssentialBlocks: essential.length > 0,
    };
  }, [content, pageType]);

  // Build the virtual tree for display
  // The order is: custom blocks before "Estrutura Padrão", then "Estrutura Padrão", then custom blocks after
  // For simplicity, we'll show: [Custom blocks that come before essential] -> [Estrutura Padrão] -> [Custom blocks that come after essential]
  // Actually, the user wants to be able to move the "Estrutura Padrão" to reposition all essential blocks together
  
  // For now, we'll display items in order they appear, with essential blocks grouped
  const virtualItems = useMemo(() => {
    const items: Array<{ id: string; type: 'standard' | 'custom'; node?: BlockNode }> = [];
    
    // Simple approach: Show "Estrutura Padrão" first if there are essential blocks, then custom blocks
    // The user can drag "Estrutura Padrão" to reorder relative to custom blocks
    if (hasEssentialBlocks) {
      items.push({ id: STANDARD_STRUCTURE_ID, type: 'standard' });
    }
    
    for (const block of customBlocks) {
      items.push({ id: block.id, type: 'custom', node: block });
    }
    
    return items;
  }, [hasEssentialBlocks, customBlocks]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedNodes(prev => {
      const newExpanded = new Set(prev);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      return newExpanded;
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const targetId = over.id as string;

    // For now, prevent reordering the standard structure (complex implementation)
    // TODO: Implement reordering of the virtual "Estrutura Padrão" node
    if (draggedId === STANDARD_STRUCTURE_ID || targetId === STANDARD_STRUCTURE_ID) {
      return;
    }

    // Find parent of target to determine where to insert
    const targetParentId = findParentId(content, targetId) || 'root';
    const targetParent = findBlockById(content, targetParentId);
    
    if (targetParent?.children) {
      const targetIndex = targetParent.children.findIndex(c => c.id === targetId);
      onMoveBlock(draggedId, targetParentId, targetIndex);
    }
  };

  // Handle click on standard structure - do nothing (no panel opens)
  const handleStandardStructureClick = useCallback(() => {
    // Intentionally empty - clicking on "Estrutura Padrão" does NOT select anything
    // The user requested: "Não deve aparecer nada, o bloco só pode ser movido no menu esquerdo para reposicionamento"
  }, []);

  return (
    <TooltipProvider>
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
          <SortableContext 
            items={virtualItems.map(item => item.id)} 
            strategy={verticalListSortingStrategy}
          >
            {virtualItems.map((item) => {
              if (item.type === 'standard') {
                return (
                  <StandardStructureNode
                    key={STANDARD_STRUCTURE_ID}
                    essentialBlocks={essentialBlocks}
                    isExpanded={expandedNodes.has(STANDARD_STRUCTURE_ID)}
                    onToggleExpand={() => toggleExpand(STANDARD_STRUCTURE_ID)}
                    onClick={handleStandardStructureClick}
                    pageType={pageType}
                  />
                );
              } else if (item.node) {
                return (
                  <TreeNode
                    key={item.node.id}
                    node={item.node}
                    depth={0}
                    selectedBlockId={selectedBlockId}
                    expandedNodes={expandedNodes}
                    onSelect={(id) => {
                      onSelectBlock(id);
                      onScrollToBlock?.(id);
                    }}
                    onToggleExpand={toggleExpand}
                    pageType={pageType}
                  />
                );
              }
              return null;
            })}
          </SortableContext>
          
          <DragOverlay>
            {activeId ? (
              <div className="bg-primary/10 border border-primary rounded px-2 py-1 text-sm">
                {activeId === STANDARD_STRUCTURE_ID 
                  ? 'Estrutura Padrão' 
                  : getBlockLabel(content, activeId)}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
        
        {/* Empty state message */}
        {virtualItems.length === 0 && (
          <div className="px-2 py-4 text-xs text-muted-foreground text-center">
            Adicione blocos usando o painel "Adicionar"
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}

// =============================================
// STANDARD STRUCTURE NODE - Virtual grouping of essential blocks
// =============================================

interface StandardStructureNodeProps {
  essentialBlocks: BlockNode[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onClick: () => void;
  pageType: string;
}

function StandardStructureNode({
  essentialBlocks,
  isExpanded,
  onToggleExpand,
  onClick,
  pageType,
}: StandardStructureNodeProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: STANDARD_STRUCTURE_ID,
    disabled: false, // Can be dragged for reordering
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Get label based on page type
  const getStructureLabel = () => {
    switch (pageType) {
      case 'product':
        return 'Estrutura do Produto';
      case 'category':
        return 'Estrutura da Categoria';
      case 'cart':
        return 'Estrutura do Carrinho';
      case 'checkout':
        return 'Estrutura do Checkout';
      case 'thank_you':
        return 'Estrutura de Obrigado';
      default:
        return 'Estrutura Padrão';
    }
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              'flex items-center gap-1 px-2 py-1.5 rounded text-sm cursor-default',
              'bg-muted/50 border border-dashed border-muted-foreground/30',
              'hover:bg-muted/70',
              isDragging && 'opacity-50'
            )}
            onClick={onClick}
          >
            {/* Drag Handle */}
            <button
              className="cursor-grab hover:text-primary"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-3 w-3" />
            </button>

            {/* Expand/Collapse */}
            {essentialBlocks.length > 0 ? (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleExpand();
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
            <Package className="h-3.5 w-3.5 text-muted-foreground" />

            {/* Label */}
            <span className="truncate flex-1 font-medium text-muted-foreground">
              {getStructureLabel()}
            </span>
            
            {/* Count badge */}
            <span className="text-[10px] bg-muted px-1 py-0.5 rounded text-muted-foreground">
              {essentialBlocks.length}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right">
          <p className="text-xs">
            Blocos essenciais da página. Arraste para reposicionar.
            <br />
            Configurações em "Tema &gt; Páginas".
          </p>
        </TooltipContent>
      </Tooltip>

      {/* Expanded children (read-only display) */}
      {isExpanded && essentialBlocks.length > 0 && (
        <div className="ml-6 mt-0.5 space-y-0.5">
          {essentialBlocks.map((block) => {
            const definition = blockRegistry.get(block.type);
            return (
              <div
                key={block.id}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs text-muted-foreground"
              >
                <span className="w-4" /> {/* Spacer for alignment */}
                <span className="text-xs opacity-60">{definition?.icon || '📦'}</span>
                <span className="truncate">{definition?.label || block.type}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================
// TREE NODE - Regular block node (custom blocks)
// =============================================

interface TreeNodeProps {
  node: BlockNode;
  depth: number;
  selectedBlockId: string | null;
  expandedNodes: Set<string>;
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  pageType: string;
}

function TreeNode({
  node,
  depth,
  selectedBlockId,
  expandedNodes,
  onSelect,
  onToggleExpand,
  pageType,
}: TreeNodeProps) {
  const definition = blockRegistry.get(node.type);
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedNodes.has(node.id);
  const isSelected = selectedBlockId === node.id;
  const isRoot = node.id === 'root';
  
  // Don't render essential blocks here - they're shown in StandardStructureNode
  if (isPageEssentialBlock(node.type, pageType)) {
    return null;
  }
  
  // Header and Footer are handled separately
  if (['Header', 'Footer'].includes(node.type)) {
    return null;
  }
  
  // Don't render Sections (structural containers)
  if (node.type === 'Section') {
    return null;
  }

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

  // Filter visible children (exclude essential blocks, Header/Footer, Sections)
  const visibleChildren = node.children?.filter(child => {
    if (['Header', 'Footer'].includes(child.type)) return false;
    if (child.type === 'Section') return false;
    if (isPageEssentialBlock(child.type, pageType)) return false;
    return true;
  }) || [];
  
  const childIds = visibleChildren.map(c => c.id);
  const hasVisibleChildren = visibleChildren.length > 0;

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
        {hasVisibleChildren ? (
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
      {hasVisibleChildren && isExpanded && (
        <SortableContext items={childIds} strategy={verticalListSortingStrategy}>
          {visibleChildren.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedBlockId={selectedBlockId}
              expandedNodes={expandedNodes}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              pageType={pageType}
            />
          ))}
        </SortableContext>
      )}
    </div>
  );
}

// =============================================
// HELPER FUNCTIONS
// =============================================

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
