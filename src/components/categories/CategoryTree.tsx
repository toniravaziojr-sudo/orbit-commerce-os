import { useState, useMemo } from 'react';
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

  const toggleExpanded = (id: string) => {
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

  // Auto-expand all on mount
  useMemo(() => {
    const allParentIds = categories.filter(c => 
      categories.some(child => child.parent_id === c.id)
    ).map(c => c.id);
    setExpandedIds(new Set(allParentIds));
  }, [categories.length]);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  };

  const handleDragOver = (event: DragOverEvent) => {
    setOverId(event.over?.id as string || null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
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

    // Determine new parent and position
    // If dropping on an item, we make the dragged item a sibling after the target
    // To make it a child, user can drop on the expand area (future enhancement)
    const newParentId = targetItem.parent_id;
    
    // Calculate new position: right after target
    const siblings = categories.filter(c => c.parent_id === newParentId);
    const targetIndex = siblings.findIndex(c => c.id === targetId);
    const newPosition = targetIndex + 1;

    await onMoveCategory(draggedId, newParentId, newPosition);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverId(null);
  };

  const hasChildren = (id: string) => categories.some(c => c.parent_id === id);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <FolderTree className="h-5 w-5" />
          Árvore de Categorias
        </CardTitle>
      </CardHeader>
      <CardContent>
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
                    isOver={overId === item.id}
                    isDragging={activeId === item.id}
                  />
                ))}
              </div>
            </SortableContext>
            <DragOverlay>
              {activeItem ? (
                <div className="bg-card border rounded-md p-2 shadow-lg opacity-90">
                  <span className="font-medium">{activeItem.name}</span>
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        )}
      </CardContent>
    </Card>
  );
}
