import { useState, useEffect, useMemo, useRef } from 'react';
import { MenuItem, useMenuItems } from '@/hooks/useMenus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Menu as MenuIcon, GripVertical, Pencil, Trash2, ChevronDown, ChevronRight, FolderOpen, FileText, Info } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragMoveEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';

interface MenuItemWithChildren extends MenuItem {
  children: MenuItemWithChildren[];
}

interface MenuPanelProps {
  title: string;
  location: 'header' | 'footer_1' | 'footer_2';
  menuId: string | null;
  onCreateMenu: () => Promise<void>;
  onAddItem: (menuId: string) => void;
  onEditItem: (item: MenuItem) => void;
  categories?: Array<{ id: string; name: string }>;
  pages?: Array<{ id: string; title: string }>;
}

interface SortableMenuItemRowProps {
  item: MenuItemWithChildren;
  depth: number;
  isExpanded: boolean;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  isNestingTarget: boolean;
}

function SortableMenuItemRow({
  item,
  depth,
  isExpanded,
  expandedIds,
  onToggleExpand,
  onEdit,
  onDelete,
  isNestingTarget,
}: SortableMenuItemRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "flex items-center gap-2 p-2 border rounded-md bg-card transition-all group",
          isDragging && "opacity-50 ring-2 ring-primary",
          isNestingTarget && "border-primary border-dashed bg-primary/5"
        )}
        style={{ marginLeft: depth * 20 }}
      >
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {item.children.length > 0 ? (
          <button
            onClick={() => onToggleExpand(item.id)}
            className="p-0.5 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
          </button>
        ) : (
          <div className="w-4" />
        )}

        {item.children.length > 0 ? (
          <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
        ) : (
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.label}</p>
        </div>

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </div>
      </div>

      {/* Render children */}
      {isExpanded && item.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {item.children.map(child => (
            <SortableMenuItemRow
              key={child.id}
              item={child}
              depth={depth + 1}
              isExpanded={expandedIds.has(child.id)}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              isNestingTarget={false}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Threshold in pixels for horizontal drag to trigger nesting/unnesting
const NESTING_THRESHOLD = 40;
const UNNESTING_THRESHOLD = -40;

export default function MenuPanel({
  title,
  menuId,
  onCreateMenu,
  onAddItem,
  onEditItem,
}: MenuPanelProps) {
  const { items, reorderItems, deleteItem } = useMenuItems(menuId);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [nestingTargetId, setNestingTargetId] = useState<string | null>(null);
  const [isUnnesting, setIsUnnesting] = useState(false);

  // Build hierarchical structure
  const buildHierarchy = (flatItems: MenuItem[] | undefined): MenuItemWithChildren[] => {
    if (!flatItems) return [];

    const itemMap = new Map<string, MenuItemWithChildren>();
    const rootItems: MenuItemWithChildren[] = [];

    flatItems.forEach(item => {
      itemMap.set(item.id, { ...item, children: [] });
    });

    flatItems.forEach(item => {
      const menuItem = itemMap.get(item.id)!;
      if (item.parent_id && itemMap.has(item.parent_id)) {
        itemMap.get(item.parent_id)!.children.push(menuItem);
      } else {
        rootItems.push(menuItem);
      }
    });

    rootItems.sort((a, b) => a.sort_order - b.sort_order);
    rootItems.forEach(item => {
      item.children.sort((a, b) => a.sort_order - b.sort_order);
    });

    return rootItems;
  };

  const hierarchicalItems = useMemo(() => buildHierarchy(items), [items]);
  const allItemIds = useMemo(() => items?.map(i => i.id) || [], [items]);

  // Get flat list to find "item above" for nesting
  const flattenedItems = useMemo(() => {
    const result: MenuItem[] = [];
    const flatten = (items: MenuItemWithChildren[]) => {
      items.forEach(item => {
        result.push(item);
        if (item.children.length > 0) {
          flatten(item.children);
        }
      });
    };
    flatten(hierarchicalItems);
    return result;
  }, [hierarchicalItems]);

  // Expand all items by default
  useEffect(() => {
    if (items) {
      const parents = items.filter(i => items.some(child => child.parent_id === i.id));
      setExpandedIds(new Set(parents.map(p => p.id)));
    }
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setDraggedId(activeId);
    setNestingTargetId(null);
    setIsUnnesting(false);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!draggedId || !items) return;

    const deltaX = event.delta.x;
    const draggedItem = items.find(i => i.id === draggedId);

    // Dragging LEFT beyond threshold = unnest (remove from submenu)
    if (deltaX < UNNESTING_THRESHOLD && draggedItem?.parent_id) {
      setIsUnnesting(true);
      setNestingTargetId(null);
      return;
    }

    // Dragging RIGHT beyond threshold = nest under item above
    if (deltaX > NESTING_THRESHOLD) {
      const draggedIndex = flattenedItems.findIndex(i => i.id === draggedId);
      if (draggedIndex > 0) {
        const itemAbove = flattenedItems[draggedIndex - 1];
        if (itemAbove && itemAbove.id !== draggedItem?.parent_id) {
          setNestingTargetId(itemAbove.id);
          setIsUnnesting(false);
          return;
        }
      }
    }

    setNestingTargetId(null);
    setIsUnnesting(false);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const wasNesting = nestingTargetId !== null;
    const wasUnnesting = isUnnesting;
    const targetId = nestingTargetId;

    setDraggedId(null);
    setNestingTargetId(null);
    setIsUnnesting(false);

    if (!items) return;

    const activeId = active.id as string;
    const activeItem = items.find(i => i.id === activeId);

    // Unnesting: dragged left = move to root level
    if (wasUnnesting && activeItem?.parent_id) {
      const rootItems = items.filter(i => !i.parent_id);
      const newSortOrder = rootItems.length;

      await supabase
        .from('menu_items')
        .update({ parent_id: null, sort_order: newSortOrder })
        .eq('id', activeId);

      reorderItems.mutate(items.map(i => i.id));
      return;
    }

    // Nesting: dragged right = move as child
    if (wasNesting && targetId) {
      const currentChildren = items.filter(i => i.parent_id === targetId);

      await supabase
        .from('menu_items')
        .update({ parent_id: targetId, sort_order: currentChildren.length })
        .eq('id', activeId);

      reorderItems.mutate(items.map(i => i.id));
      return;
    }

    // Normal reorder
    if (!over) return;
    const overId = over.id as string;
    if (activeId === overId) return;

    const overItem = items.find(i => i.id === overId);

    if (activeItem && overItem) {
      // Same parent level reorder
      const siblings = items.filter(i => i.parent_id === overItem.parent_id);
      const oldIndex = siblings.findIndex(i => i.id === activeId);
      const newIndex = siblings.findIndex(i => i.id === overId);

      if (oldIndex !== -1) {
        const reordered = arrayMove(siblings, oldIndex, newIndex);
        const orderedIds = reordered.map(i => i.id);

        // Update sort orders
        for (let i = 0; i < orderedIds.length; i++) {
          await supabase
            .from('menu_items')
            .update({ sort_order: i, parent_id: overItem.parent_id })
            .eq('id', orderedIds[i]);
        }

        reorderItems.mutate(items.map(i => i.id));
      } else {
        // Moving from different parent - put at same level as target
        await supabase
          .from('menu_items')
          .update({ parent_id: overItem.parent_id })
          .eq('id', activeId);

        reorderItems.mutate(items.map(i => i.id));
      }
    }
  };

  const handleToggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDeleteItem = async (id: string) => {
    if (confirm('Excluir este item e todos os seus subitens?')) {
      await deleteItem.mutateAsync(id);
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MenuIcon className="h-4 w-4" />
          {title}
        </CardTitle>
        {menuId && (
          <Badge variant="outline" className="text-xs">Ativo</Badge>
        )}
      </CardHeader>
      <CardContent className="flex-1 overflow-auto px-4 pb-4 space-y-3">
        {/* Add Item Button */}
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={async () => {
            if (!menuId) {
              await onCreateMenu();
              return;
            }
            onAddItem(menuId);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar item
        </Button>

        {/* Simple drag hint */}
        {draggedId && (nestingTargetId || isUnnesting) && (
          <div className={cn(
            "p-2 rounded text-xs flex items-center gap-2 border",
            nestingTargetId ? "bg-primary/10 border-primary/30 text-primary" : "bg-muted border-muted-foreground/30 text-muted-foreground"
          )}>
            {nestingTargetId ? (
              <>
                <ChevronRight className="h-3 w-3" />
                <span>→ Submenu</span>
              </>
            ) : (
              <>
                <ChevronRight className="h-3 w-3 rotate-180" />
                <span>← Voltar ao nível principal</span>
              </>
            )}
          </div>
        )}

        {/* Tree */}
        {hierarchicalItems.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={allItemIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1">
                {hierarchicalItems.map(item => (
                  <SortableMenuItemRow
                    key={item.id}
                    item={item}
                    depth={0}
                    isExpanded={expandedIds.has(item.id)}
                    expandedIds={expandedIds}
                    onToggleExpand={handleToggleExpand}
                    onEdit={onEditItem}
                    onDelete={handleDeleteItem}
                    isNestingTarget={nestingTargetId === item.id}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : menuId ? (
          <p className="text-center py-4 text-xs text-muted-foreground">
            Nenhum item. Clique em "Adicionar item".
          </p>
        ) : (
          <p className="text-center py-4 text-xs text-muted-foreground">
            Clique em "Adicionar item" para começar.
          </p>
        )}

        {/* Instructions at bottom */}
        {hierarchicalItems.length > 0 && (
          <div className="pt-2 border-t space-y-2">
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                → direita = submenu · ← esquerda = voltar
              </span>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-700 dark:text-amber-400">
              <Info className="h-3 w-3 shrink-0" />
              <span>As alterações são salvas automaticamente ao adicionar, editar ou arrastar itens.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}