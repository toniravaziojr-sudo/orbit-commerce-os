import { useState, useEffect } from 'react';
import { useMenus, useMenuItems, MenuItem } from '@/hooks/useMenus';
import { useCategories } from '@/hooks/useProducts';
import { useStorePages } from '@/hooks/useStorePages';
import { useLandingPages } from '@/hooks/useLandingPages';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, GripVertical, Menu as MenuIcon, ChevronRight, ChevronDown, FolderOpen, FileText, Info } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
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

interface SortableMenuItemProps {
  item: MenuItemWithChildren;
  depth: number;
  isExpanded: boolean;
  onToggleExpand: (id: string) => void;
  onEdit: (item: MenuItem) => void;
  onDelete: (id: string) => void;
  shiftPressed: boolean;
  draggedOverId: string | null;
}

function SortableMenuItem({ 
  item, 
  depth, 
  isExpanded, 
  onToggleExpand, 
  onEdit, 
  onDelete,
  shiftPressed,
  draggedOverId,
}: SortableMenuItemProps) {
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

  const isDropTarget = draggedOverId === item.id && shiftPressed;

  return (
    <div ref={setNodeRef} style={style}>
      <div
        className={cn(
          "flex items-center gap-3 p-3 border rounded-lg bg-card transition-all",
          isDragging && "opacity-50 ring-2 ring-primary",
          isDropTarget && "ring-2 ring-green-500 bg-green-50 dark:bg-green-900/20"
        )}
        style={{ marginLeft: depth * 24 }}
      >
        <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing">
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>
        
        {item.children.length > 0 ? (
          <button
            onClick={() => onToggleExpand(item.id)}
            className="p-1 hover:bg-muted rounded"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <div className="w-6" />
        )}
        
        {item.children.length > 0 ? (
          <FolderOpen className="h-4 w-4 text-primary" />
        ) : (
          <FileText className="h-4 w-4 text-muted-foreground" />
        )}
        
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{item.label}</p>
          <p className="text-sm text-muted-foreground truncate">
            {item.item_type === 'category' && 'Categoria'}
            {item.item_type === 'page' && 'Página'}
            {item.item_type === 'external' && item.url}
          </p>
        </div>

        {isDropTarget && (
          <Badge className="bg-green-500 text-white text-xs shrink-0">
            Mover para dentro
          </Badge>
        )}

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" onClick={() => onEdit(item)}>
            <Pencil className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(item.id)}>
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      </div>
      
      {/* Render children */}
      {isExpanded && item.children.length > 0 && (
        <div className="mt-2 space-y-2">
          {item.children.map(child => (
            <SortableMenuItem
              key={child.id}
              item={child}
              depth={depth + 1}
              isExpanded={false}
              onToggleExpand={onToggleExpand}
              onEdit={onEdit}
              onDelete={onDelete}
              shiftPressed={shiftPressed}
              draggedOverId={draggedOverId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function Menus() {
  const { menus, isLoading, createMenu } = useMenus();
  const { categories } = useCategories();
  const { pages } = useStorePages();
  const { landingPages } = useLandingPages();
  
  const allPages = [
    ...(pages || []).map(p => ({ ...p, pageType: 'institutional' as const })),
    ...(landingPages || []).map(p => ({ ...p, pageType: 'landing_page' as const })),
  ];
  
  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [isItemDialogOpen, setIsItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [shiftPressed, setShiftPressed] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [draggedOverId, setDraggedOverId] = useState<string | null>(null);
  const [itemForm, setItemForm] = useState({
    label: '',
    item_type: 'category' as 'category' | 'page' | 'external',
    ref_id: '',
    url: '',
    parent_id: '' as string | null,
  });

  const { items, createItem, updateItem, deleteItem, reorderItems } = useMenuItems(selectedMenuId);

  const selectedMenu = menus?.find(m => m.id === selectedMenuId);

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

  const hierarchicalItems = buildHierarchy(items);
  const allItemIds = items?.map(i => i.id) || [];

  // Get root items only for sorting context
  const rootItemIds = hierarchicalItems.map(i => i.id);

  // Track shift key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setShiftPressed(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = (event: DragStartEvent) => {
    setDraggedId(event.active.id as string);
  };

  const handleDragOver = (event: any) => {
    const overId = event.over?.id as string | null;
    setDraggedOverId(overId);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedId(null);
    setDraggedOverId(null);
    
    if (!over || !items) return;
    
    const activeId = active.id as string;
    const overId = over.id as string;
    
    if (activeId === overId) return;
    
    if (shiftPressed) {
      // Move as child of target
      await supabase
        .from('menu_items')
        .update({ parent_id: overId })
        .eq('id', activeId);
      
      // Reorder children
      const targetItem = items.find(i => i.id === overId);
      const currentChildren = items.filter(i => i.parent_id === overId);
      for (let i = 0; i < currentChildren.length; i++) {
        await supabase
          .from('menu_items')
          .update({ sort_order: i })
          .eq('id', currentChildren[i].id);
      }
      
      // Add the new child at the end
      await supabase
        .from('menu_items')
        .update({ sort_order: currentChildren.length })
        .eq('id', activeId);
      
      reorderItems.mutate(items.map(i => i.id)); // Trigger refresh
    } else {
      // Reorder at same level
      const activeItem = items.find(i => i.id === activeId);
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
          
          reorderItems.mutate(items.map(i => i.id)); // Trigger refresh
        } else {
          // Moving from different parent - put at same level as target
          await supabase
            .from('menu_items')
            .update({ parent_id: overItem.parent_id })
            .eq('id', activeId);
          
          reorderItems.mutate(items.map(i => i.id)); // Trigger refresh
        }
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

  const handleCreateMenu = async (location: 'header' | 'footer') => {
    await createMenu.mutateAsync({
      name: location === 'header' ? 'Menu Principal' : 'Menu Rodapé',
      location,
    });
  };

  const resetItemForm = () => {
    setItemForm({ label: '', item_type: 'category', ref_id: '', url: '', parent_id: null });
    setEditingItem(null);
  };

  const handleEditItem = (item: any) => {
    setEditingItem(item);
    setItemForm({
      label: item.label,
      item_type: item.item_type,
      ref_id: item.ref_id || '',
      url: item.url || '',
      parent_id: item.parent_id || null,
    });
    setIsItemDialogOpen(true);
  };

  const handleSubmitItem = async () => {
    const data = {
      menu_id: selectedMenuId!,
      label: itemForm.label,
      item_type: itemForm.item_type,
      ref_id: itemForm.item_type !== 'external' ? itemForm.ref_id || null : null,
      url: itemForm.item_type === 'external' ? itemForm.url : null,
      sort_order: editingItem?.sort_order ?? (items?.length || 0),
      parent_id: itemForm.parent_id || null,
    };

    if (editingItem) {
      await updateItem.mutateAsync({ id: editingItem.id, ...data });
    } else {
      await createItem.mutateAsync(data);
    }
    setIsItemDialogOpen(false);
    resetItemForm();
  };

  const handleDeleteItem = async () => {
    if (deleteItemId) {
      await deleteItem.mutateAsync(deleteItemId);
      setDeleteItemId(null);
    }
  };

  const headerMenu = menus?.find(m => m.location === 'header');
  const footerMenu = menus?.find(m => m.location === 'footer');

  // Get parent options for dropdown
  const parentOptions = items?.filter(i => !i.parent_id) || [];

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Menus"
        description="Gerencie os menus de navegação da sua loja"
      />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Header Menu */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MenuIcon className="h-5 w-5" />
              Menu Header
            </CardTitle>
            {headerMenu && (
              <Badge variant="outline">Ativo</Badge>
            )}
          </CardHeader>
          <CardContent>
            {headerMenu ? (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setSelectedMenuId(headerMenu.id)}
              >
                Editar Itens
              </Button>
            ) : (
              <Button 
                className="w-full"
                onClick={() => handleCreateMenu('header')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Menu Header
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Footer Menu */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MenuIcon className="h-5 w-5" />
              Menu Footer
            </CardTitle>
            {footerMenu && (
              <Badge variant="outline">Ativo</Badge>
            )}
          </CardHeader>
          <CardContent>
            {footerMenu ? (
              <Button 
                variant="outline" 
                className="w-full"
                onClick={() => setSelectedMenuId(footerMenu.id)}
              >
                Editar Itens
              </Button>
            ) : (
              <Button 
                className="w-full"
                onClick={() => handleCreateMenu('footer')}
              >
                <Plus className="mr-2 h-4 w-4" />
                Criar Menu Footer
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Menu Items Editor */}
      {selectedMenu && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Itens do {selectedMenu.name}</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Arraste para reordenar ou use as setas
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setSelectedMenuId(null)}>
                Fechar
              </Button>
              <Button onClick={() => { resetItemForm(); setIsItemDialogOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Item
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Instructions */}
            <div className="mb-4 p-3 bg-muted/50 rounded-lg border">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="text-sm text-muted-foreground">
                  <p className="font-medium mb-1">Como organizar o menu:</p>
                  <ol className="list-decimal list-inside space-y-1">
                    <li>Arraste pelo ícone <GripVertical className="h-3 w-3 inline" /> para <strong>reordenar</strong> no mesmo nível</li>
                    <li>Segure <kbd className="px-1.5 py-0.5 bg-background border rounded text-xs">Shift</kbd> enquanto solta para criar <strong>submenu</strong></li>
                    <li>Ou selecione o "Item Pai" no formulário à direita ao editar</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Drag hint when shift is pressed */}
            {shiftPressed && draggedId && (
              <div className="mb-3 p-2 bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg text-sm text-green-800 dark:text-green-200 flex items-center gap-2">
                <ChevronRight className="h-4 w-4" />
                <span>Solte sobre um item para transformá-lo em submenu</span>
              </div>
            )}

            {hierarchicalItems.length > 0 ? (
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={allItemIds} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {hierarchicalItems.map(item => (
                      <SortableMenuItem
                        key={item.id}
                        item={item}
                        depth={0}
                        isExpanded={expandedIds.has(item.id)}
                        onToggleExpand={handleToggleExpand}
                        onEdit={handleEditItem}
                        onDelete={setDeleteItemId}
                        shiftPressed={shiftPressed}
                        draggedOverId={draggedOverId}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            ) : (
              <p className="text-center py-8 text-muted-foreground">
                Nenhum item adicionado. Clique em "Adicionar Item" para começar.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add/Edit Item Dialog */}
      <Dialog open={isItemDialogOpen} onOpenChange={(open) => { setIsItemDialogOpen(open); if (!open) resetItemForm(); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? 'Editar Item' : 'Adicionar Item'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>Tipo</Label>
              <Select 
                value={itemForm.item_type} 
                onValueChange={(v: 'category' | 'page' | 'external') => setItemForm({ ...itemForm, item_type: v, ref_id: '', url: '' })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="category">Categoria</SelectItem>
                  <SelectItem value="page">Página Institucional</SelectItem>
                  <SelectItem value="external">Link Externo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Rótulo</Label>
              <Input 
                value={itemForm.label} 
                onChange={(e) => setItemForm({ ...itemForm, label: e.target.value })}
                placeholder="Texto exibido no menu"
              />
            </div>

            <div>
              <Label>Item Pai (opcional)</Label>
              <Select 
                value={itemForm.parent_id || '_none'} 
                onValueChange={(v) => setItemForm({ ...itemForm, parent_id: v === '_none' ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="Nenhum (item raiz)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Nenhum (item raiz)</SelectItem>
                  {parentOptions.filter(p => p.id !== editingItem?.id).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Selecione um item pai para criar submenu
              </p>
            </div>

            {itemForm.item_type === 'category' && (
              <div>
                <Label>Categoria</Label>
                <Select value={itemForm.ref_id} onValueChange={(v) => setItemForm({ ...itemForm, ref_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma categoria" /></SelectTrigger>
                  <SelectContent>
                    {categories?.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {itemForm.item_type === 'page' && (
              <div>
                <Label>Página</Label>
                <Select value={itemForm.ref_id} onValueChange={(v) => {
                  const page = allPages.find(p => p.id === v);
                  if (page) {
                    const suggestedLabel = page.menu_label || page.title;
                    setItemForm({ ...itemForm, ref_id: v, label: itemForm.label || suggestedLabel });
                  } else {
                    setItemForm({ ...itemForm, ref_id: v });
                  }
                }}>
                  <SelectTrigger><SelectValue placeholder="Selecione uma página" /></SelectTrigger>
                  <SelectContent>
                    {allPages.filter(p => p.is_published).map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span>{p.menu_label || p.title}</span>
                          {p.show_in_menu && (
                            <span className="text-xs text-green-600">✓ Menu</span>
                          )}
                          <span className="text-xs text-muted-foreground">
                            ({p.pageType === 'landing_page' ? 'Landing' : 'Institucional'})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Páginas marcadas com ✓ foram configuradas para exibição no menu
                </p>
              </div>
            )}

            {itemForm.item_type === 'external' && (
              <div>
                <Label>URL</Label>
                <Input 
                  value={itemForm.url} 
                  onChange={(e) => setItemForm({ ...itemForm, url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}

            <Button 
              onClick={handleSubmitItem} 
              disabled={!itemForm.label || (itemForm.item_type !== 'external' && !itemForm.ref_id) || (itemForm.item_type === 'external' && !itemForm.url)}
              className="w-full"
            >
              {editingItem ? 'Salvar' : 'Adicionar'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteItemId} onOpenChange={() => setDeleteItemId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteItem}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
