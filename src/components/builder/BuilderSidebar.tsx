// =============================================
// BUILDER SIDEBAR - Unified left menu (Yampi-style)
// Shows "Estrutura Padrão" grouping for essential blocks
// plus user-customizable blocks with drag/drop, visibility toggle, delete
// =============================================

import { useState, useMemo, useCallback } from 'react';
import { 
  GripVertical, 
  Eye, 
  EyeOff, 
  Trash2, 
  Plus, 
  Settings, 
  ChevronRight,
  ChevronDown,
  Lock,
  Layers,
  Package,
} from 'lucide-react';
import { BlockNode } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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
import { isBlockRequired, canDeleteBlock, getRequiredBlockInfo, getPageContract } from '@/lib/builder/pageContracts';

// Virtual ID for the "Estrutura Padrão" group
const STANDARD_STRUCTURE_ID = '__standard_structure__';

interface BuilderSidebarProps {
  content: BlockNode;
  selectedBlockId: string | null;
  pageType: string;
  onSelectBlock: (id: string) => void;
  onMoveBlock: (blockId: string, newParentId: string, newIndex: number) => void;
  onToggleHidden: (blockId: string) => void;
  onDeleteBlock: (blockId: string) => void;
  onOpenAddBlock: () => void;
  onOpenThemeSettings: () => void;
  templateName?: string;
}

// SYSTEM BLOCKS - These are essential page structure elements
// They are grouped under "Estrutura Padrão" and cannot be deleted
// Their settings are controlled via Theme Settings > Pages
const SYSTEM_BLOCKS = new Set([
  // Infrastructure - always hidden entirely (not even in "Estrutura Padrão")
  'Header', 'Footer', 'Page',
  
  // System features - Category page (grouped in Estrutura Padrão)
  'CategoryBanner', 'ProductGrid', 'CategoryPageLayout',
  
  // System features - Product page (grouped in Estrutura Padrão)
  'ProductDetails', 'CompreJuntoSlot',
  
  // System features - Cart/Checkout/Thank-you (grouped in Estrutura Padrão)
  'Cart', 'Checkout', 'ThankYou',
  
  // System features - Offer slots
  'CrossSellSlot', 'UpsellSlot',
  
  // System features - Account pages
  'AccountHub', 'OrdersList', 'OrderDetail',
  
  // System features - Other system pages
  'TrackingLookup', 'BlogListing',
]);

// Infrastructure blocks that should be completely hidden (not even in Estrutura Padrão)
const INFRASTRUCTURE_BLOCKS = new Set(['Header', 'Footer', 'Page', 'Section']);

// Get label for the "Estrutura Padrão" based on page type
function getStructureLabel(pageType: string): string {
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
      return 'Confirmação do Pedido';
    case 'account':
      return 'Área do Cliente';
    case 'account_orders':
      return 'Meus Pedidos';
    case 'account_order_detail':
      return 'Detalhes do Pedido';
    default:
      return 'Estrutura Padrão';
  }
}

// Analyze content to separate system blocks (for "Estrutura Padrão") vs custom blocks
function analyzeBlocks(content: BlockNode): {
  systemBlocks: BlockNode[];
  customBlocks: BlockNode[];
} {
  const system: BlockNode[] = [];
  const custom: BlockNode[] = [];
  
  if (!content.children) return { systemBlocks: system, customBlocks: custom };
  
  // Process all children, flattening Sections
  for (const block of content.children) {
    // Skip infrastructure blocks entirely
    if (INFRASTRUCTURE_BLOCKS.has(block.type)) {
      // For Section blocks, process their children
      if (block.type === 'Section' && block.children) {
        for (const child of block.children) {
          if (INFRASTRUCTURE_BLOCKS.has(child.type)) continue;
          
          if (SYSTEM_BLOCKS.has(child.type)) {
            system.push(child);
          } else {
            custom.push(child);
          }
        }
      }
      continue;
    }
    
    // Categorize non-infrastructure blocks
    if (SYSTEM_BLOCKS.has(block.type)) {
      system.push(block);
    } else {
      custom.push(block);
    }
  }
  
  return { systemBlocks: system, customBlocks: custom };
}

// Find the parent of a block (for move operations)
function findBlockParent(content: BlockNode, blockId: string): BlockNode | null {
  if (!content.children) return null;
  for (const child of content.children) {
    if (child.id === blockId) return content;
    if (child.children) {
      const found = findBlockParent(child, blockId);
      if (found) return found;
    }
  }
  return null;
}

// =============================================
// STANDARD STRUCTURE ITEM - The grouped "Estrutura Padrão"
// =============================================

interface StandardStructureItemProps {
  systemBlocks: BlockNode[];
  pageType: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

function StandardStructureItem({
  systemBlocks,
  pageType,
  isExpanded,
  onToggleExpand,
}: StandardStructureItemProps) {
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

  const label = getStructureLabel(pageType);

  return (
    <div ref={setNodeRef} style={style}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                'group flex items-center gap-1 px-2 py-1.5 rounded-md transition-all',
                'bg-muted/50 border border-dashed border-muted-foreground/30',
                'hover:bg-muted/70 hover:border-muted-foreground/50',
                isDragging && 'opacity-50 shadow-lg'
              )}
            >
              {/* Drag handle */}
              <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted"
              >
                <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
              </div>

              {/* Expand/Collapse */}
              {systemBlocks.length > 0 ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand();
                  }}
                  className="p-0.5 rounded hover:bg-muted"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              ) : (
                <span className="w-4" />
              )}

              {/* Icon + Label */}
              <div className="flex-1 flex items-center gap-1.5 min-w-0">
                <Package className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="text-xs font-medium text-muted-foreground truncate">
                  {label}
                </span>
              </div>
              
              {/* Count badge */}
              <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                {systemBlocks.length}
              </span>
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="text-xs max-w-[220px]">
            <p>
              Blocos essenciais da página. Arraste para reposicionar.
              <br />
              <span className="text-muted-foreground">
                Configurações em "Tema → Páginas"
              </span>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Expanded children (read-only display of system blocks) */}
      {isExpanded && systemBlocks.length > 0 && (
        <div className="ml-4 mt-0.5 space-y-0.5 border-l border-muted-foreground/20 pl-2">
          {systemBlocks.map((block) => {
            const definition = blockRegistry.get(block.type);
            const displayName = definition?.label || block.type;
            
            return (
              <div
                key={block.id}
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-muted-foreground"
              >
                <Lock className="h-3 w-3 opacity-50" />
                <span className="truncate">{displayName}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================
// SORTABLE BLOCK ITEM - Custom blocks that can be edited/deleted
// =============================================

interface SortableBlockItemProps {
  block: BlockNode;
  isSelected: boolean;
  isLocked: boolean;
  lockReason?: string;
  onSelect: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}

function SortableBlockItem({
  block,
  isSelected,
  isLocked,
  lockReason,
  onSelect,
  onToggleHidden,
  onDelete,
}: SortableBlockItemProps) {
  const definition = blockRegistry.get(block.type);
  const isHidden = block.hidden === true || block.props?.hidden === true;
  
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: block.id,
    disabled: isLocked,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const displayName = (block.props?.title as string) || 
                      (block.props?.heading as string) || 
                      definition?.label || 
                      block.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-1 px-2 py-1.5 rounded-md border transition-all',
        'hover:bg-muted/50',
        isSelected && 'bg-primary/10 border-primary',
        !isSelected && 'border-transparent',
        isDragging && 'opacity-50 shadow-lg',
        isHidden && 'opacity-50'
      )}
    >
      {/* Drag handle */}
      <div
        {...attributes}
        {...listeners}
        className={cn(
          'cursor-grab active:cursor-grabbing p-0.5 rounded hover:bg-muted',
          isLocked && 'cursor-not-allowed opacity-30'
        )}
      >
        {isLocked ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Lock className="h-3.5 w-3.5 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent side="right" className="text-xs max-w-[200px]">
                {lockReason || 'Bloco obrigatório'}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>

      {/* Block name */}
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-1.5 text-left min-w-0"
      >
        <span className="text-xs font-medium truncate">{displayName}</span>
      </button>

      {/* Visibility toggle - show on hover */}
      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleHidden();
                }}
                className="p-1 rounded hover:bg-muted"
              >
                {isHidden ? (
                  <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              {isHidden ? 'Mostrar' : 'Ocultar'}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        
        {/* Delete button - only for non-locked blocks */}
        {!isLocked && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete();
                  }}
                  className="p-1 rounded hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                Excluir
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================

export function BuilderSidebar({
  content,
  selectedBlockId,
  pageType,
  onSelectBlock,
  onMoveBlock,
  onToggleHidden,
  onDeleteBlock,
  onOpenAddBlock,
  onOpenThemeSettings,
  templateName = 'Tema',
}: BuilderSidebarProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [isStructureExpanded, setIsStructureExpanded] = useState(true);
  
  // Check if this is a system page (structure controlled by pageContracts)
  const pageContract = getPageContract(pageType);
  const isSystemPage = pageContract?.isSystemPage === true;
  
  // Analyze content to separate system vs custom blocks
  const { systemBlocks, customBlocks } = useMemo(() => {
    return analyzeBlocks(content);
  }, [content]);
  
  // Build virtual items list for DnD
  // Order: [Estrutura Padrão] -> [Custom Blocks]
  // In future, we can track relative positions for more flexibility
  const virtualItems = useMemo(() => {
    const items: Array<{ id: string; type: 'standard' | 'custom'; block?: BlockNode }> = [];
    
    // Add "Estrutura Padrão" if there are system blocks
    if (systemBlocks.length > 0) {
      items.push({ id: STANDARD_STRUCTURE_ID, type: 'standard' });
    }
    
    // Add custom blocks
    for (const block of customBlocks) {
      items.push({ id: block.id, type: 'custom', block });
    }
    
    return items;
  }, [systemBlocks, customBlocks]);
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const targetId = over.id as string;

    // For now, prevent reordering involving the standard structure
    // TODO: Implement full reordering support for virtual node
    if (draggedId === STANDARD_STRUCTURE_ID || targetId === STANDARD_STRUCTURE_ID) {
      return;
    }

    // Find custom blocks for reordering
    const activeIndex = customBlocks.findIndex(b => b.id === draggedId);
    const overIndex = customBlocks.findIndex(b => b.id === targetId);

    if (activeIndex !== -1 && overIndex !== -1) {
      const activeBlock = customBlocks[activeIndex];
      const parent = findBlockParent(content, activeBlock.id);
      if (parent) {
        onMoveBlock(draggedId, parent.id, overIndex);
      }
    }
  };

  const getActiveLabel = useCallback(() => {
    if (!activeId) return '';
    if (activeId === STANDARD_STRUCTURE_ID) {
      return getStructureLabel(pageType);
    }
    const block = customBlocks.find(b => b.id === activeId);
    if (!block) return '';
    const def = blockRegistry.get(block.type);
    return def?.label || block.type;
  }, [activeId, customBlocks, pageType]);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with template name */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{templateName}</span>
        </div>
      </div>

      {/* Blocks list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
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
              <div className="space-y-0.5">
                {virtualItems.map((item) => {
                  if (item.type === 'standard') {
                    return (
                      <StandardStructureItem
                        key={STANDARD_STRUCTURE_ID}
                        systemBlocks={systemBlocks}
                        pageType={pageType}
                        isExpanded={isStructureExpanded}
                        onToggleExpand={() => setIsStructureExpanded(!isStructureExpanded)}
                      />
                    );
                  } else if (item.block) {
                    const block = item.block;
                    const isRequired = isBlockRequired(pageType, block.type);
                    const canDelete = canDeleteBlock(pageType, block.type);
                    const requiredInfo = getRequiredBlockInfo(pageType, block.type);
                    const isLocked = isRequired && !canDelete;
                    
                    return (
                      <SortableBlockItem
                        key={block.id}
                        block={block}
                        isSelected={selectedBlockId === block.id}
                        isLocked={isLocked}
                        lockReason={requiredInfo?.label ? `Estrutura obrigatória: ${requiredInfo.label}` : undefined}
                        onSelect={() => onSelectBlock(block.id)}
                        onToggleHidden={() => onToggleHidden(block.id)}
                        onDelete={() => onDeleteBlock(block.id)}
                      />
                    );
                  }
                  return null;
                })}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeId ? (
                <div className="bg-primary/10 border border-primary rounded-md px-3 py-2 text-sm font-medium shadow-lg">
                  {getActiveLabel()}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Add section button - always visible */}
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 gap-2 text-muted-foreground hover:text-foreground hover:bg-muted justify-start border-dashed"
            onClick={onOpenAddBlock}
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar seção</span>
          </Button>
        </div>
      </ScrollArea>

      {/* Footer with theme settings */}
      <div className="border-t p-3 bg-muted/30">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 font-medium">
          Tema
        </div>
        <div className="text-sm font-semibold mb-3 text-foreground">{templateName}</div>
        
        <Button
          size="sm"
          className="w-full justify-between bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          onClick={onOpenThemeSettings}
        >
          <div className="flex items-center gap-2">
            <Settings className="h-4 w-4" />
            <span>Configurações do tema</span>
          </div>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
