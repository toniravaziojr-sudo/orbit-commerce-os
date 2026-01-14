// =============================================
// BUILDER SIDEBAR - Unified left menu (Yampi-style)
// Shows only blocks from current page with drag/drop, visibility toggle, delete
// Structural blocks (Header/Footer/Page) are hidden but insertion zones remain
// =============================================

import { useState, useCallback } from 'react';
import { 
  GripVertical, 
  Eye, 
  EyeOff, 
  Trash2, 
  Plus, 
  Settings, 
  ChevronRight,
  Lock,
  Layers,
} from 'lucide-react';
import { BlockNode } from '@/lib/builder/types';
import { blockRegistry } from '@/lib/builder/registry';
import { STRUCTURAL_BLOCK_TYPES, isStructuralBlock } from '@/lib/builder/utils';
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
import { isBlockRequired, canDeleteBlock, getRequiredBlockInfo } from '@/lib/builder/pageContracts';

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

// Get direct children of the root (main sections), filtering out structural blocks
function getMainSections(content: BlockNode, hideStructural: boolean = true): BlockNode[] {
  if (!content.children) return [];
  if (!hideStructural) return content.children;
  // Filter out Header, Footer and other structural blocks from the visible list
  return content.children.filter(block => !isStructuralBlock(block.type));
}

// Get all sections including structural ones (for positioning calculations)
function getAllSections(content: BlockNode): BlockNode[] {
  if (!content.children) return [];
  return content.children;
}

// Sortable block item
function SortableBlockItem({
  block,
  isSelected,
  isLocked,
  lockReason,
  onSelect,
  onToggleHidden,
  onDelete,
}: {
  block: BlockNode;
  isSelected: boolean;
  isLocked: boolean;
  lockReason?: string;
  onSelect: () => void;
  onToggleHidden: () => void;
  onDelete: () => void;
}) {
  const definition = blockRegistry.get(block.type);
  const isHidden = block.props?.hidden === true;
  
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

  // Get display name - use block label or custom title from props
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

      {/* Block icon + name */}
      <button
        onClick={onSelect}
        className="flex-1 flex items-center gap-1.5 text-left min-w-0"
      >
        <span className="text-sm flex-shrink-0">{definition?.icon || '📦'}</span>
        <span className="text-xs font-medium truncate">{displayName}</span>
      </button>

      {/* Actions - show on hover */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Visibility toggle */}
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

        {/* Delete button - only if not locked */}
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
                Remover
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}

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
  
  // Get visible sections (without structural blocks like Header/Footer)
  const sections = getMainSections(content, true);
  // Get all sections for drag positioning
  const allSections = getAllSections(content);
  
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

    // Use visible sections for drag logic
    const activeIndex = sections.findIndex(s => s.id === active.id);
    const overIndex = sections.findIndex(s => s.id === over.id);

    if (activeIndex !== -1 && overIndex !== -1) {
      // Calculate actual index in allSections considering structural blocks
      const overBlock = sections[overIndex];
      const actualOverIndex = allSections.findIndex(s => s.id === overBlock.id);
      onMoveBlock(active.id as string, content.id, actualOverIndex);
    }
  };

  const getActiveBlockLabel = () => {
    if (!activeId) return '';
    const block = sections.find(s => s.id === activeId);
    if (!block) return '';
    const def = blockRegistry.get(block.type);
    return def?.label || block.type;
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header with template name */}
      <div className="p-3 border-b">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="font-semibold text-sm">{templateName}</span>
        </div>
      </div>

      {/* Sections list */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map(s => s.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-0.5">
                {sections.map((block) => {
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
                })}
              </div>
            </SortableContext>

            <DragOverlay>
              {activeId ? (
                <div className="bg-primary/10 border border-primary rounded-md px-3 py-2 text-sm font-medium shadow-lg">
                  {getActiveBlockLabel()}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>

          {/* Add section button */}
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 gap-2 text-muted-foreground hover:text-foreground justify-start"
            onClick={onOpenAddBlock}
          >
            <Plus className="h-4 w-4" />
            <span>Adicionar seção</span>
          </Button>
        </div>
      </ScrollArea>

      {/* Footer with theme settings */}
      <div className="border-t p-2">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider px-2 mb-1">
          Tema
        </div>
        <div className="text-sm font-medium px-2 mb-2">{templateName}</div>
        
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-between text-muted-foreground hover:text-foreground"
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
