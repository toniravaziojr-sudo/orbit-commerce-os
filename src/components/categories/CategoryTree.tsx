import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Category } from '@/hooks/useProducts';
import { CategoryTreeItem } from './CategoryTreeItem';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FolderTree } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export interface CategoryNode extends Category {
  children: CategoryNode[];
  depth: number;
}

interface CategoryTreeProps {
  categories: Category[];
  onEdit: (category: Category) => void;
  onDelete: (id: string) => void;
  onMoveCategory: (categoryId: string, newParentId: string | null, newPosition: number) => Promise<void>;
}

// Build tree structure from flat list
function buildTree(categories: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>();
  const roots: CategoryNode[] = [];

  // First pass: create nodes
  categories.forEach(cat => {
    map.set(cat.id, { ...cat, children: [], depth: 0 });
  });

  // Second pass: build tree
  categories.forEach(cat => {
    const node = map.get(cat.id)!;
    if (cat.parent_id && map.has(cat.parent_id)) {
      const parent = map.get(cat.parent_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Sort each level by sort_order
  const sortNodes = (nodes: CategoryNode[]): CategoryNode[] => {
    return nodes
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
      .map(node => ({ ...node, children: sortNodes(node.children) }));
  };

  return sortNodes(roots);
}

// Flatten tree for rendering with dnd-kit
function flattenTree(nodes: CategoryNode[], depth = 0): CategoryNode[] {
  return nodes.reduce<CategoryNode[]>((acc, node) => {
    acc.push({ ...node, depth });
    if (node.children.length > 0) {
      acc.push(...flattenTree(node.children, depth + 1));
    }
    return acc;
  }, []);
}

// Check if targetId is a descendant of nodeId
function isDescendant(categories: Category[], nodeId: string, targetId: string): boolean {
  const children = categories.filter(c => c.parent_id === nodeId);
  if (children.some(c => c.id === targetId)) return true;
  return children.some(c => isDescendant(categories, c.id, targetId));
}

export function CategoryTree({ categories, onEdit, onDelete, onMoveCategory }: CategoryTreeProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [shiftPressed, setShiftPressed] = useState(false);

  // Listen for Shift key to toggle drop mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setShiftPressed(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Use a higher distance threshold to prevent accidental drags when clicking buttons
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const tree = useMemo(() => buildTree(categories), [categories]);
  
  // Only flatten visible nodes (respecting collapsed state)
  const flattenedItems = useMemo(() => {
    const flatten = (nodes: CategoryNode[], depth = 0): CategoryNode[] => {
      return nodes.reduce<CategoryNode[]>((acc, node) => {
        acc.push({ ...node, depth });
        if (node.children.length > 0 && expandedIds.has(node.id)) {
          acc.push(...flatten(node.children, depth + 1));
        }
        return acc;
      }, []);
    };
    return flatten(tree);
  }, [tree, expandedIds]);

  const activeItem = useMemo(
    () => flattenedItems.find(item => item.id === activeId),
    [flattenedItems, activeId]
  );

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  // Auto-expand all on mount
  useEffect(() => {
    const allParentIds = categories.filter(c => 
      categories.some(child => child.parent_id === c.id)
    ).map(c => c.id);
    setExpandedIds(new Set(allParentIds));
  }, [categories]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    const wasShiftPressed = shiftPressed; // Capture at the moment of drop
    
    setActiveId(null);
    setOverId(null);

    if (!over || active.id === over.id) return;

    const draggedId = active.id as string;
    const targetId = over.id as string;

    // Anti-cycle check: can't drop onto self or descendant
    if (draggedId === targetId || isDescendant(categories, draggedId, targetId)) {
      return;
    }

    const draggedItem = categories.find(c => c.id === draggedId);
    const targetItem = categories.find(c => c.id === targetId);

    if (!draggedItem || !targetItem) return;

    let newParentId: string | null;
    let newPosition: number;

    if (wasShiftPressed) {
      // Drop as child of target: make the dragged item a child of the target
      newParentId = targetId;
      const targetChildren = categories.filter(c => c.parent_id === targetId);
      newPosition = targetChildren.length; // Add at the end of children
      
      // Auto-expand the target so user can see the new child
      setExpandedIds(prev => new Set([...prev, targetId]));
    } else {
      // Drop as sibling: place after the target in the same level
      newParentId = targetItem.parent_id;
      const siblings = categories.filter(c => c.parent_id === newParentId);
      const targetIndex = siblings.findIndex(c => c.id === targetId);
      newPosition = targetIndex + 1;
    }

    await onMoveCategory(draggedId, newParentId, newPosition);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  const hasChildren = (id: string) => categories.some(c => c.parent_id === id);

  // Check if currently dropping as child (shift pressed while over a valid target)
  const isDropAsChildTarget = (id: string) => {
    if (!activeId || !overId || activeId === id) return false;
    if (overId !== id) return false;
    if (!shiftPressed) return false;
    // Can't drop onto descendant
    if (isDescendant(categories, activeId, id)) return false;
    return true;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FolderTree className="h-5 w-5" />
          Árvore de Categorias
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Helper text when dragging */}
        {activeId && (
          <Alert className="py-2">
            <AlertDescription className="text-sm">
              {shiftPressed ? (
                <span className="text-green-600 dark:text-green-400 font-medium">
                  ✓ Solte para mover DENTRO da categoria (subcategoria)
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Segure <kbd className="px-1.5 py-0.5 bg-muted rounded border text-xs font-mono">Shift</kbd> para mover dentro de outra categoria
                </span>
              )}
            </AlertDescription>
          </Alert>
        )}

        {categories.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            Nenhuma categoria cadastrada
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            onDragCancel={handleDragCancel}
          >
            <SortableContext
              items={flattenedItems.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-1">
                {flattenedItems.map(item => (
                  <CategoryTreeItem
                    key={item.id}
                    category={item}
                    depth={item.depth}
                    isExpanded={expandedIds.has(item.id)}
                    hasChildren={hasChildren(item.id)}
                    onToggleExpand={() => toggleExpanded(item.id)}
                    onEdit={() => onEdit(item)}
                    onDelete={() => onDelete(item.id)}
                    isOver={overId === item.id && !shiftPressed}
                    isDragging={activeId === item.id}
                    isDropAsChildTarget={isDropAsChildTarget(item.id)}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeItem ? (
                <div className={`bg-card border rounded-md p-2 shadow-lg opacity-90 ${shiftPressed ? 'ring-2 ring-green-500' : ''}`}>
                  <span className="font-medium">{activeItem.name}</span>
                  {shiftPressed && (
                    <span className="ml-2 text-xs text-green-600">→ subcategoria</span>
                  )}
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Help text always visible */}
        {categories.length > 0 && !activeId && (
          <div className="mt-4 p-3 bg-muted/50 rounded-lg border border-dashed">
            <p className="text-sm font-medium mb-2">Como organizar categorias:</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              <li className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-primary/10 text-primary text-[10px] font-bold">1</span>
                <span>Arraste pelo ícone <span className="font-mono">⋮⋮</span> para <strong>reordenar</strong> no mesmo nível</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-green-500/10 text-green-600 text-[10px] font-bold">2</span>
                <span>Segure <kbd className="px-1.5 py-0.5 bg-background rounded border text-[10px] font-mono mx-1">Shift</kbd> enquanto solta para criar <strong>subcategoria</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="inline-flex items-center justify-center w-5 h-5 rounded bg-muted text-muted-foreground text-[10px] font-bold">3</span>
                <span>Ou selecione a "Categoria Pai" no formulário à direita ao editar</span>
              </li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
