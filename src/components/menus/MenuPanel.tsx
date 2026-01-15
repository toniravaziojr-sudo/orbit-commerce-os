import { useState, useEffect, useMemo, useCallback } from 'react';
import { MenuItem, useMenuItems } from '@/hooks/useMenus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Menu as MenuIcon, GripVertical, Pencil, Trash2, ChevronDown, ChevronRight, FolderOpen, FileText, Info, Save, X, AlertCircle } from 'lucide-react';
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
import { useToast } from '@/hooks/use-toast';

interface MenuItemWithChildren extends MenuItem {
  children: MenuItemWithChildren[];
}

// Local item for pending changes (may not have all DB fields yet)
interface LocalMenuItem {
  id: string;
  menu_id: string;
  label: string;
  item_type: 'category' | 'page' | 'external';
  ref_id: string | null;
  url: string | null;
  sort_order: number;
  parent_id: string | null;
  isNew?: boolean;
  isDeleted?: boolean;
}

interface MenuPanelProps {
  title: string;
  location: 'header' | 'footer_1' | 'footer_2'; // kept for compatibility but unused
  menuId: string | null;
  onCreateMenu: () => Promise<void>;
  onAddItem: (menuId: string, onItemCreated: (item: LocalMenuItem) => void) => void;
  onEditItem: (item: MenuItem, onItemUpdated: (item: LocalMenuItem) => void) => void;
  categories?: Array<{ id: string; name: string }>;
  pages?: Array<{ id: string; title: string }>;
}

interface LocalMenuItemWithChildren extends LocalMenuItem {
  children: LocalMenuItemWithChildren[];
}

interface SortableMenuItemRowProps {
  item: LocalMenuItemWithChildren;
  depth: number;
  isExpanded: boolean;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onEdit: (item: LocalMenuItem) => void;
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

  const isModified = item.isNew || item.isDeleted;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "flex items-center gap-2 p-2 border rounded-md bg-card transition-all group",
          isDragging && "opacity-50 ring-2 ring-primary",
          isNestingTarget && "border-primary border-dashed bg-primary/5",
          item.isNew && "border-green-500/50 bg-green-500/5",
          item.isDeleted && "border-destructive/50 bg-destructive/5 opacity-50 line-through"
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
          <p className={cn("text-sm font-medium truncate", item.isDeleted && "line-through")}>
            {item.label}
          </p>
        </div>

        {item.isNew && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 bg-green-500/10 text-green-600 border-green-500/30">
            Novo
          </Badge>
        )}

        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {!item.isDeleted && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(item)}>
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onDelete(item.id)}>
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Render children */}
      {isExpanded && item.children.length > 0 && (
        <div className="mt-1 space-y-1">
          {item.children.filter(c => !c.isDeleted).map(child => (
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
// Moderado para detectar intenção clara de nesting
const NESTING_THRESHOLD = 50;
const UNNESTING_THRESHOLD = -50;

export default function MenuPanel({
  title,
  menuId,
  onCreateMenu,
  onAddItem,
  onEditItem,
}: MenuPanelProps) {
  const { items: dbItems, isLoading } = useMenuItems(menuId);
  const { toast } = useToast();
  
  // Local state for pending changes
  const [localItems, setLocalItems] = useState<LocalMenuItem[]>([]);
  const [originalItems, setOriginalItems] = useState<LocalMenuItem[]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [nestingTargetId, setNestingTargetId] = useState<string | null>(null);
  const [isUnnesting, setIsUnnesting] = useState(false);
  // Track drop position indicator
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | 'inside' | null>(null);

  // Sync local state with DB items when they change
  useEffect(() => {
    if (dbItems) {
      const mapped: LocalMenuItem[] = dbItems.map(item => ({
        id: item.id,
        menu_id: item.menu_id,
        label: item.label,
        item_type: item.item_type,
        ref_id: item.ref_id,
        url: item.url,
        sort_order: item.sort_order,
        parent_id: item.parent_id,
      }));
      setLocalItems(mapped);
      setOriginalItems(mapped);
      setHasChanges(false);
    }
  }, [dbItems]);

  // Detect changes
  useEffect(() => {
    const hasNewItems = localItems.some(i => i.isNew);
    const hasDeletedItems = localItems.some(i => i.isDeleted);
    const hasOrderChanges = JSON.stringify(localItems.filter(i => !i.isNew && !i.isDeleted).map(i => ({ id: i.id, parent_id: i.parent_id, sort_order: i.sort_order }))) 
      !== JSON.stringify(originalItems.map(i => ({ id: i.id, parent_id: i.parent_id, sort_order: i.sort_order })));
    
    setHasChanges(hasNewItems || hasDeletedItems || hasOrderChanges);
  }, [localItems, originalItems]);

  // Build hierarchical structure
  const buildHierarchy = (flatItems: LocalMenuItem[]): LocalMenuItemWithChildren[] => {
    if (!flatItems) return [];

    const itemMap = new Map<string, LocalMenuItemWithChildren>();
    const rootItems: LocalMenuItemWithChildren[] = [];

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

  const visibleItems = localItems.filter(i => !i.isDeleted);
  const hierarchicalItems = useMemo(() => buildHierarchy(visibleItems), [visibleItems]);
  const allItemIds = useMemo(() => visibleItems.map(i => i.id), [visibleItems]);

  // Get flat list to find "item above" for nesting
  const flattenedItems = useMemo(() => {
    const result: LocalMenuItem[] = [];
    const flatten = (items: LocalMenuItemWithChildren[]) => {
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
    if (localItems.length > 0) {
      const parents = localItems.filter(i => localItems.some(child => child.parent_id === i.id));
      setExpandedIds(new Set(parents.map(p => p.id)));
    }
  }, [localItems]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const activeId = event.active.id as string;
    setDraggedId(activeId);
    setNestingTargetId(null);
    setIsUnnesting(false);
    setDropTargetId(null);
    setDropPosition(null);
  };

  const handleDragMove = (event: DragMoveEvent) => {
    if (!draggedId || !localItems) return;

    const deltaX = event.delta.x;
    const deltaY = Math.abs(event.delta.y);
    const absX = Math.abs(deltaX);
    const draggedItem = localItems.find(i => i.id === draggedId);

    // Se movimento vertical é dominante, não ativa nesting/unnesting por horizontal
    // Mas ainda assim podemos indicar onde vai ser dropado
    if (deltaY > absX * 2) {
      setNestingTargetId(null);
      setIsUnnesting(false);
      return;
    }

    // Dragging LEFT beyond threshold = unnest (remove from submenu)
    if (deltaX < UNNESTING_THRESHOLD && draggedItem?.parent_id) {
      setIsUnnesting(true);
      setNestingTargetId(null);
      setDropPosition('inside');
      return;
    }

    // Dragging RIGHT beyond threshold = nest under item above
    if (deltaX > NESTING_THRESHOLD) {
      const draggedIndex = flattenedItems.findIndex(i => i.id === draggedId);
      if (draggedIndex > 0) {
        const itemAbove = flattenedItems[draggedIndex - 1];
        // Only nest if item above is not already the parent AND not same item
        if (itemAbove && itemAbove.id !== draggedItem?.parent_id) {
          setNestingTargetId(itemAbove.id);
          setIsUnnesting(false);
          setDropPosition('inside');
          return;
        }
      }
    }

    setNestingTargetId(null);
    setIsUnnesting(false);
    setDropPosition(null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const wasNesting = nestingTargetId !== null;
    const wasUnnesting = isUnnesting;
    const targetId = nestingTargetId;

    setDraggedId(null);
    setNestingTargetId(null);
    setIsUnnesting(false);
    setDropTargetId(null);
    setDropPosition(null);

    if (!localItems.length) return;

    const activeId = active.id as string;
    const activeItem = localItems.find(i => i.id === activeId);

    // Unnesting: dragged left = move to root level
    if (wasUnnesting && activeItem?.parent_id) {
      // Encontrar o parent atual e colocar DEPOIS dele no nível do parent
      const currentParent = localItems.find(i => i.id === activeItem.parent_id);
      const grandParentId = currentParent?.parent_id || null;
      const siblingsOfParent = localItems.filter(i => i.parent_id === grandParentId && !i.isDeleted);
      const parentIndex = siblingsOfParent.findIndex(i => i.id === currentParent?.id);
      const newSortOrder = parentIndex >= 0 ? parentIndex + 1 : siblingsOfParent.length;

      setLocalItems(prev => {
        const updated = prev.map(i => {
          if (i.id === activeId) {
            return { ...i, parent_id: grandParentId, sort_order: newSortOrder };
          }
          // Shift items after insertion point
          if (i.parent_id === grandParentId && i.sort_order >= newSortOrder && !i.isDeleted && i.id !== activeId) {
            return { ...i, sort_order: i.sort_order + 1 };
          }
          return i;
        });
        return updated;
      });
      return;
    }

    // Nesting: dragged right = move as child of item above
    if (wasNesting && targetId) {
      const currentChildren = localItems.filter(i => i.parent_id === targetId && !i.isDeleted);

      setLocalItems(prev => prev.map(i => 
        i.id === activeId ? { ...i, parent_id: targetId, sort_order: currentChildren.length } : i
      ));
      return;
    }

    // Normal reorder - drop sobre outro item
    if (!over) return;
    const overId = over.id as string;
    if (activeId === overId) return;

    const overItem = localItems.find(i => i.id === overId);

    if (activeItem && overItem) {
      // O item vai para o MESMO NÍVEL do item sobre o qual foi solto
      const targetParentId = overItem.parent_id;
      
      // Pegar todos os irmãos no nível alvo (excluindo o item arrastado se já estiver lá)
      const siblings = localItems.filter(i => 
        i.parent_id === targetParentId && !i.isDeleted && i.id !== activeId
      );
      
      // Encontrar a posição do overItem nos irmãos
      const overIndex = siblings.findIndex(i => i.id === overId);
      
      // Inserir DEPOIS do overItem
      const insertIndex = overIndex + 1;

      setLocalItems(prev => {
        // Primeiro, remover o activeItem da contagem de sort_order anterior
        const updated: LocalMenuItem[] = [];
        
        // Reconstruir os irmãos com o novo item inserido
        const newSiblings = [...siblings];
        newSiblings.splice(insertIndex, 0, { ...activeItem, parent_id: targetParentId, sort_order: insertIndex });
        
        // Atualizar sort_order de todos os irmãos
        const siblingUpdates = new Map<string, number>();
        newSiblings.forEach((item, index) => {
          siblingUpdates.set(item.id, index);
        });

        prev.forEach(i => {
          if (i.id === activeId) {
            // Mover para novo parent com novo sort_order
            updated.push({ ...i, parent_id: targetParentId, sort_order: siblingUpdates.get(i.id) ?? 0 });
          } else if (siblingUpdates.has(i.id)) {
            // Atualizar sort_order dos irmãos
            updated.push({ ...i, sort_order: siblingUpdates.get(i.id)! });
          } else {
            updated.push(i);
          }
        });

        return updated;
      });
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

  const handleDeleteItem = (id: string) => {
    const item = localItems.find(i => i.id === id);
    if (!item) return;

    if (item.isNew) {
      // Just remove from local state if it's a new item
      setLocalItems(prev => prev.filter(i => i.id !== id));
    } else {
      // Mark as deleted
      setLocalItems(prev => prev.map(i => 
        i.id === id ? { ...i, isDeleted: true } : i
      ));
    }
    
    // Also mark children as deleted
    const markChildrenDeleted = (parentId: string) => {
      setLocalItems(prev => prev.map(i => {
        if (i.parent_id === parentId) {
          markChildrenDeleted(i.id);
          return i.isNew ? null : { ...i, isDeleted: true };
        }
        return i;
      }).filter(Boolean) as LocalMenuItem[]);
    };
    markChildrenDeleted(id);
  };

  const handleAddItem = useCallback((newItem: LocalMenuItem) => {
    setLocalItems(prev => [...prev, { ...newItem, isNew: true }]);
  }, []);

  const handleEditItem = useCallback((item: MenuItem) => {
    onEditItem(item, (updatedItem) => {
      setLocalItems(prev => prev.map(i => 
        i.id === updatedItem.id ? { ...updatedItem, isNew: i.isNew } : i
      ));
    });
  }, [onEditItem]);

  const handleSave = async () => {
    if (!menuId) return;
    setIsSaving(true);

    try {
      // 1. Delete items marked as deleted
      const deletedIds = localItems.filter(i => i.isDeleted && !i.isNew).map(i => i.id);
      if (deletedIds.length > 0) {
        const { error } = await supabase
          .from('menu_items')
          .delete()
          .in('id', deletedIds);
        if (error) throw error;
      }

      // 2. Insert new items
      const newItems = localItems.filter(i => i.isNew && !i.isDeleted);
      if (newItems.length > 0) {
        const { data: tenant } = await supabase
          .from('menus')
          .select('tenant_id')
          .eq('id', menuId)
          .single();

        const { error } = await supabase
          .from('menu_items')
          .insert(newItems.map(item => ({
            id: item.id,
            menu_id: item.menu_id,
            tenant_id: tenant?.tenant_id,
            label: item.label,
            item_type: item.item_type,
            ref_id: item.ref_id,
            url: item.url,
            sort_order: item.sort_order,
            parent_id: item.parent_id,
          })));
        if (error) throw error;
      }

      // 3. Update existing items (order/parent changes)
      const existingItems = localItems.filter(i => !i.isNew && !i.isDeleted);
      for (const item of existingItems) {
        const original = originalItems.find(o => o.id === item.id);
        if (original && (original.parent_id !== item.parent_id || original.sort_order !== item.sort_order || original.label !== item.label)) {
          const { error } = await supabase
            .from('menu_items')
            .update({
              parent_id: item.parent_id,
              sort_order: item.sort_order,
              label: item.label,
              item_type: item.item_type,
              ref_id: item.ref_id,
              url: item.url,
            })
            .eq('id', item.id);
          if (error) throw error;
        }
      }

      toast({ title: 'Menu salvo com sucesso!' });
      
      // Refresh from DB
      const { data: refreshedItems } = await supabase
        .from('menu_items')
        .select('*')
        .eq('menu_id', menuId)
        .order('sort_order');
      
      if (refreshedItems) {
        const mapped: LocalMenuItem[] = refreshedItems.map(item => ({
          id: item.id,
          menu_id: item.menu_id,
          label: item.label,
          item_type: item.item_type as 'category' | 'page' | 'external',
          ref_id: item.ref_id,
          url: item.url,
          sort_order: item.sort_order,
          parent_id: item.parent_id,
        }));
        setLocalItems(mapped);
        setOriginalItems(mapped);
      }
      
      setHasChanges(false);
    } catch (error: any) {
      toast({ title: 'Erro ao salvar menu', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDiscard = () => {
    setLocalItems(originalItems);
    setHasChanges(false);
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="flex flex-row items-center justify-between py-3 px-4 shrink-0">
        <CardTitle className="text-base flex items-center gap-2">
          <MenuIcon className="h-4 w-4" />
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30">
              <AlertCircle className="h-3 w-3 mr-1" />
              Não salvo
            </Badge>
          )}
          {menuId && !hasChanges && (
            <Badge variant="outline" className="text-xs">Ativo</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto px-4 pb-4 space-y-3">
        {/* Save/Discard buttons */}
        {hasChanges && (
          <div className="flex gap-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={isSaving}
              className="flex-1"
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Salvando...' : 'Salvar alterações'}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleDiscard}
              disabled={isSaving}
            >
              <X className="h-4 w-4 mr-2" />
              Descartar
            </Button>
          </div>
        )}

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
            onAddItem(menuId, handleAddItem);
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
                {hierarchicalItems.filter(i => !i.isDeleted).map(item => (
                  <SortableMenuItemRow
                    key={item.id}
                    item={item}
                    depth={0}
                    isExpanded={expandedIds.has(item.id)}
                    expandedIds={expandedIds}
                    onToggleExpand={handleToggleExpand}
                    onEdit={handleEditItem}
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
          <div className="pt-2 border-t">
            <div className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <Info className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                → direita = submenu · ← esquerda = voltar
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
